import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Clock, AlertTriangle, Package, ChevronDown, Activity as ActivityIcon, FileText, Timer, Filter, Globe, Loader2 } from 'lucide-react';
import { ProductionEntry } from '../types';
import { ACTIVITIES_LIST, ACTIVITY_STANDARDS, PLANT_REGISTRY, calculateAvailableMinutes, AMBERNATH_BREAK_TIMES, MODELS_LIST, getModelContext } from '../constants';
import { supabase } from '../supabase';

interface DashboardProps {
  entries: ProductionEntry[];
  plant: string;
  userRole?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ entries, plant, userRole }) => {
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('All');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('All');
  const [pipelineView, setPipelineView] = useState<'active' | 'completed'>('active');
  const hasSetDefaultModel = useRef(false);

  const isGlobal = userRole === 'admin' || userRole === 'management';

  const normalizedEntries = useMemo(() => {
    return entries.map(e => {
      const m = e.model.toUpperCase();
      if (['CHILLER', 'CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'ADANI', 'NH'].includes(m)) return { ...e, model: 'CHILLER' };
      if (m === 'CH' || m === 'DSE') return { ...e, model: 'PDX' };
      return e;
    });
  }, [entries]);

  const toTitleCase = (str: string) => {
    if (!str) return 'N/A';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTimeDisplay = (time: string | undefined) => {
    if (!time || time === 'N/A' || time === '-' || time.trim() === '') return '-';
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return time;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  // 1. Filtered entries based on selected Plant and Model
  const filteredEntries = useMemo(() => {
    return normalizedEntries.filter(e => {
      const plantMatch = selectedPlantFilter === 'All' || e.plant === selectedPlantFilter;
      
      let modelMatch = false;
      if (selectedModelFilter === 'All') {
        modelMatch = true;
      } else if (selectedModelFilter === 'CHILLER') {
        // Group NH, CH, and ADANI under the "CHILLER" filter
        modelMatch = ['CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'CHILLER', 'ADANI'].includes(e.model.toUpperCase());
      } else {
        modelMatch = e.model.toUpperCase() === selectedModelFilter.toUpperCase();
      }
      
      return plantMatch && modelMatch;
    });
  }, [normalizedEntries, selectedPlantFilter, selectedModelFilter]);

  const stats = useMemo(() => {
    if (!filteredEntries.length) return null;
    const uniqueUnits = new Set(filteredEntries.map(e => e.serialNo)).size;
    const totalManhours = filteredEntries.reduce((acc, e) => acc + e.manhoursEngaged, 0);
    const avgVariance = filteredEntries.reduce((acc, e) => acc + e.variance, 0) / (filteredEntries.length || 1);
    const totalLoss = filteredEntries.reduce((acc, e) => acc + e.lossHours, 0);
    return { 
      uniqueUnits, 
      totalManhours: Number(totalManhours.toFixed(2)), 
      avgVariance: Number(avgVariance.toFixed(2)), 
      totalLoss: Number(totalLoss.toFixed(2)) 
    };
  }, [filteredEntries]);

  // Helper to determine active activity for a set of entries
  const getActiveActivityName = (unitEntries: ProductionEntry[]) => {
    const activityStatus: Record<string, { hasStart: boolean; hasEnd: boolean }> = {};
    unitEntries.forEach(e => {
      if (e.is_gap || e.activity === "Inter-Activity Idle Time") return;
      if (!activityStatus[e.activity]) activityStatus[e.activity] = { hasStart: false, hasEnd: false };
      if (e.status === 'In Progress') activityStatus[e.activity].hasStart = true;
      if (e.status === 'Completed') activityStatus[e.activity].hasEnd = true;
    });
    return Object.keys(activityStatus).find(act => activityStatus[act].hasStart && !activityStatus[act].hasEnd);
  };

  // Units list for the selector
  const unitsList = useMemo(() => {
    const units: Record<string, { 
      serialNo: string; 
      model: string; 
      plant: string;
      completedActivities: number; 
      lastEntry: ProductionEntry;
      allEntries: ProductionEntry[];
      activeActivity?: string;
    }> = {};

    normalizedEntries.forEach(e => {
      const isIdle = e.activity === "Inter-Activity Idle Time" || e.is_gap;
      if (!units[e.serialNo]) {
        units[e.serialNo] = { 
          serialNo: e.serialNo, 
          model: e.model, 
          plant: e.plant,
          completedActivities: 0, 
          lastEntry: e,
          allEntries: [] 
        };
      }
      if (e.status === 'Completed' && !isIdle) units[e.serialNo].completedActivities += 1;
      units[e.serialNo].allEntries.push(e);
      if (new Date(e.createdAt).getTime() > new Date(units[e.serialNo].lastEntry.createdAt).getTime()) {
        units[e.serialNo].lastEntry = e;
      }
    });

    // Post-process to find active activities
    Object.values(units).forEach(u => {
      u.activeActivity = getActiveActivityName(u.allEntries);
    });

    return Object.values(units).sort((a, b) => new Date(b.lastEntry.createdAt).getTime() - new Date(a.lastEntry.createdAt).getTime());
  }, [normalizedEntries]);

  // Filtered unit dropdown list
  const FINISHING_ACTIVITIES = [
    'Finishing',
    'Finishing Activity',
    'Testing'
  ];

  const isUnitCompleted = (u: typeof unitsList[0]): boolean => {
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const finishingEntry = u.allEntries
      .filter(e => FINISHING_ACTIVITIES.includes(e.activity) && e.status === 'Completed')
      .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())[0];
    if (!finishingEntry) return false;
    const entryMonth = finishingEntry.productionDate.substring(0, 7);
    return entryMonth < currentYearMonth;
  };

  const filteredUnitsList = useMemo(() => {
    return unitsList.filter(u => {
      const plantMatch = selectedPlantFilter === 'All' || u.plant === selectedPlantFilter;
      let modelMatch = false;
      if (selectedModelFilter === 'All') {
        modelMatch = true;
      } else if (selectedModelFilter === 'CHILLER') {
        modelMatch = ['CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'CHILLER', 'ADANI'].includes(u.model.toUpperCase());
      } else {
        modelMatch = u.model.toUpperCase() === selectedModelFilter.toUpperCase();
      }
      if (!plantMatch || !modelMatch) return false;
      return pipelineView === 'completed' ? isUnitCompleted(u) : !isUnitCompleted(u);
    });
  }, [unitsList, selectedPlantFilter, selectedModelFilter, pipelineView]);

  const availablePlants = useMemo(() => {
    const plants = new Set(normalizedEntries.map(e => e.plant));
    plants.add('CHAKAN');
    plants.add('AMBERNATH');
    return ['All', ...Array.from(plants).sort()];
  }, [normalizedEntries]);

  const availableModels = useMemo(() => {
    const models = new Set<string>();
    
    // 1. Add models from normalized data
    const relevantEntries = normalizedEntries.filter(e => selectedPlantFilter === 'All' || e.plant === selectedPlantFilter);
    relevantEntries.forEach(e => {
      const m = e.model.toUpperCase();
      if (m === 'LI7') models.add('Li7');
      else if (m === 'LI7 PCA') models.add('Li7 PCA');
      else if (m === '2X') models.add('2X');
      else if (m === '3X') models.add('3X');
      else if (m === 'STS') models.add('STS');
      else if (['CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'CHILLER', 'ADANI'].includes(m)) models.add('CHILLER');
      else models.add(e.model);
    });

    // 2. If a specific plant is selected, ensure all its registry models are available
    const p = selectedPlantFilter?.toUpperCase();
    if (p !== 'ALL' && PLANT_REGISTRY[p]) {
      Object.keys(PLANT_REGISTRY[p].models).forEach(m => {
        const up = m.toUpperCase();
        if (['CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'CHILLER', 'ADANI'].includes(up)) models.add('CHILLER');
        else models.add(m);
      });
    }
    
    const list = Array.from(models).sort((a, b) => {
      const order = ['2X', '3X', 'STS', 'Li7', 'Li7 PCA'];
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return ['All', ...list];
  }, [entries, selectedPlantFilter]);

  // Reset model filter if it's no longer available for the selected plant
  useEffect(() => {
    if (selectedModelFilter !== 'All' && !availableModels.includes(selectedModelFilter)) {
      setSelectedModelFilter('All');
    }
  }, [selectedPlantFilter, availableModels, selectedModelFilter]);

  // Reset filters if context changes
  useEffect(() => {
    if (filteredUnitsList.length > 0) {
      const isStillValid = filteredUnitsList.some(u => u.serialNo === selectedSerial);
      if (!isStillValid) {
        setSelectedSerial(filteredUnitsList[0].serialNo);
      }
    } else {
      setSelectedSerial(null);
    }
  }, [filteredUnitsList, selectedSerial]);

  const pipelineActivities = useMemo(() => {
    const m = selectedModelFilter.toUpperCase();
    if (m === 'ALL' || m === 'CHILLER') return ACTIVITIES_LIST;

    // Search for model in PLANT_REGISTRY
    const plants = Object.keys(PLANT_REGISTRY);
    for (const pKey of plants) {
      const plantData = PLANT_REGISTRY[pKey as keyof typeof PLANT_REGISTRY];
      const modelKeys = Object.keys(plantData.models);
      const foundKey = modelKeys.find(k => k.toUpperCase() === m);
      if (foundKey) {
        const modelConfig = (plantData.models as any)[foundKey];
        return Object.values(modelConfig.mapping).flat() as string[];
      }
    }

    // For general/mixed pipeline, use the Chakan baseline
    return ACTIVITIES_LIST;
  }, [selectedModelFilter]);

  // Start with the cached version from the global entries list
  const cachedUnitDetail = useMemo(() => {
    if (!selectedSerial) return null;
    return unitsList.find(u => u.serialNo === selectedSerial);
  }, [selectedSerial, unitsList]);

  // Fetch ALL entries for the selected unit directly from Supabase
  // to ensure no activities are missing due to the global 1000-entry limit
  const [fullUnitEntries, setFullUnitEntries] = useState<ProductionEntry[] | null>(null);

  useEffect(() => {
    if (!selectedSerial) {
      setFullUnitEntries(null);
      return;
    }

    let isActive = true;

    const fetchFullUnit = async () => {
      try {
        const { data, error } = await supabase
          .from('production_entries')
          .select('*')
          .ilike('serial_no', selectedSerial.trim())
          .order('production_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (!isActive || error || !data) return;

        const mapped: ProductionEntry[] = data.map((item: any) => ({
          id: String(item.id),
          plant: item.plant || 'CHAKAN',
          stage: item.station || '',
          productLine: item.product_line || '',
          model: item.model || '',
          serialNo: (item.serial_no || '').trim(),
          unitSrNo: (item.unit_sr_no || '').trim(),
          soSqNo: (item.so_sq_no || '').trim(),
          productionDate: item.production_date || '',
          endDate: item.end_date,
          shift: item.shift || 'Shift 1',
          activity: (item.stage || '').trim(),
          manpower: Number(item.manpower) || 0,
          manpowerNames: Array.isArray(item.manpower_names) ? item.manpower_names : [],
          assignments: Array.isArray(item.shift_assignments) ? item.shift_assignments : [],
          startTime: item.start_time || '00:00',
          endTime: item.end_time || '00:00',
          standardCycleTime: Number(item.standard_cycle_time) || 0,
          actualCycleTime: Number(item.actual_cycle_time) || 0,
          shift1ActualMinutes: Number(item.shift1_actual_minutes) || 0,
          shift2ActualMinutes: Number(item.shift2_actual_minutes) || 0,
          variance: Number(item.variance) || 0,
          manhoursEngaged: Number(item.manhours_engaged) || 0,
          lossHours: Number(item.loss_hours) || 0,
          lossReason: item.loss_reason || '',
          affectedParameter: item.affected_parameter,
          defectCategory: item.defect_category,
          issueDescription: item.issue_description,
          notes: item.notes || '',
          status: item.status || 'Completed',
          is_gap: item.is_gap || false,
          createdAt: item.created_at || new Date().toISOString(),
          userEmail: item.user_email
        }));

        if (isActive) setFullUnitEntries(mapped);
      } catch (err) {
        console.warn("Full unit fetch failed, using cached data:", err);
      }
    };

    fetchFullUnit();
    return () => { isActive = false; };
  }, [selectedSerial]);

  // Merge: use full Supabase fetch if available, otherwise fall back to cached
  const selectedUnitDetail = useMemo(() => {
    if (!cachedUnitDetail) return null;

    if (fullUnitEntries && fullUnitEntries.length > 0) {
      // Replace allEntries with the complete dataset
      const completedCount = new Set(
        fullUnitEntries.filter(e => e.status === 'Completed' && !e.is_gap && e.activity !== "Inter-Activity Idle Time").map(e => e.activity)
      ).size;

      return {
        ...cachedUnitDetail,
        allEntries: fullUnitEntries,
        completedActivities: completedCount,
        activeActivity: getActiveActivityName(fullUnitEntries)
      };
    }

    return cachedUnitDetail;
  }, [cachedUnitDetail, fullUnitEntries]);

  const timelineNodes = useMemo(() => {
    if (!selectedUnitDetail) return [];

    const prodEntries = [...selectedUnitDetail.allEntries]
      .sort((a, b) => new Date(`${a.productionDate}T${a.startTime}`).getTime() - new Date(`${b.productionDate}T${b.startTime}`).getTime());

    // Stage 1: Consolidate activity shifts and identify logged gaps
    const consolidatedActivities: any[] = [];
    const loggedGaps: any[] = [];

    const safeParseMs = (dateStr: string, timeStr: string) => {
      if (!dateStr || !timeStr) return NaN;
      const [y, m, d] = dateStr.split('-').map(Number);
      const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
      return new Date(y, m - 1, d, hh, mm, 0).getTime();
    };

    prodEntries.forEach(e => {
      const startMs = safeParseMs(e.productionDate, e.startTime);
      const endMs = e.status === 'Completed' ? safeParseMs(e.endDate || e.productionDate, e.endTime) : Date.now();

      if (e.activity === "Inter-Activity Idle Time" || e.is_gap) {
        loggedGaps.push({ 
          type: 'gap', 
          startMs, 
          endMs, 
          idleStart: e.startTime,
          idleEnd: e.endTime,
          lossHours: (e.actualCycleTime / 60).toFixed(2),
          date: e.productionDate, 
          isLogged: true, 
          shifts: [e] 
        });
        return;
      }

      const existing = consolidatedActivities.find(a => a.activityName === e.activity);
      if (existing) {
        existing.shifts.push(e);
        existing.startMs = Math.min(existing.startMs, startMs);
        existing.endMs = Math.max(existing.endMs, endMs);
      } else {
        consolidatedActivities.push({ type: 'activity', activityName: e.activity, shifts: [e], startMs, endMs });
      }
    });

    // Recalculate true start/end times for consolidated activities
    consolidatedActivities.forEach(a => {
      const firstShift = a.shifts.sort((s1: any, s2: any) => safeParseMs(s1.productionDate, s1.startTime) - safeParseMs(s2.productionDate, s2.startTime))[0];
      const lastShift = a.shifts.find((s: any) => s.status === 'Completed') || a.shifts[a.shifts.length - 1];
      
      a.startTime = firstShift.startTime;
      a.date = firstShift.productionDate;
      a.endTime = lastShift.status === 'Completed' ? lastShift.endTime : '-';
      a.startMs = safeParseMs(a.date, a.startTime);
      a.endMs = lastShift.status === 'Completed' ? safeParseMs(lastShift.endDate || lastShift.productionDate, lastShift.endTime) : Date.now();
    });

    // Stage 2: Identify implicit gaps
    const implicitGaps: any[] = [];
    const allNodes = [...consolidatedActivities, ...loggedGaps].sort((a, b) => a.startMs - b.startMs);
    const inProgressActivity = consolidatedActivities.find(a => a.shifts.some((s: any) => s.status === 'In Progress'));
    
    if (allNodes.length > 0) {
      let maxEndMs = allNodes[0].endMs;
      let lastNodeWithMaxEnd = allNodes[0];

      for (let i = 1; i < allNodes.length; i++) {
        const currentNode = allNodes[i];
        const gapStartMs = maxEndMs;
        const gapEndMs = currentNode.startMs;

        if (gapEndMs > gapStartMs + 60000) { // More than 1 min gap
          if (inProgressActivity && gapStartMs >= inProgressActivity.startMs) continue;

          const unitModel = (selectedUnitDetail?.model || selectedModelFilter).toUpperCase();
          const customBreaks = (['LI7', 'LI7 PCA', '2X', '3X', 'STS'].includes(unitModel)) ? AMBERNATH_BREAK_TIMES : undefined;
          const workingGapMins = calculateAvailableMinutes(gapStartMs, gapEndMs, customBreaks);
          const wallClockMins = (gapEndMs - gapStartMs) / 60000;

          if (workingGapMins >= 1 || wallClockMins >= 1) {
            implicitGaps.push({
              type: 'gap',
              startMs: gapStartMs,
              endMs: gapEndMs,
              idleStart: lastNodeWithMaxEnd.type === 'gap' ? lastNodeWithMaxEnd.shifts[0].endTime : lastNodeWithMaxEnd.endTime,
              idleEnd: currentNode.type === 'gap' ? currentNode.shifts[0].startTime : currentNode.startTime,
              lossHours: ((workingGapMins || wallClockMins) / 60).toFixed(2),
              date: new Date(gapStartMs - new Date(gapStartMs).getTimezoneOffset() * 60000).toISOString().split('T')[0],
              isLogged: false,
            });
          }
        }

        if (currentNode.endMs > maxEndMs) {
          maxEndMs = currentNode.endMs;
          lastNodeWithMaxEnd = currentNode;
        }
      }
    }

    // Stage 3: Final combination and sort
    return [...allNodes, ...implicitGaps].sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      if (a.type === 'activity' && b.type === 'gap') return -1; // activity first
      if (a.type === 'gap' && b.type === 'activity') return 1; // gap second
      return a.endMs - b.endMs;
    });

  }, [selectedUnitDetail, selectedModelFilter]);

  const currentStandards = useMemo(() => {
    // Priority: Selected Unit's Model > Selected Model Filter > Default (NH)
    if (selectedUnitDetail) {
      const context = getModelContext(selectedUnitDetail.serialNo, selectedUnitDetail.model, selectedUnitDetail.plant);
      return context.standards;
    }

    const modelToUse = selectedModelFilter.toUpperCase();
    
    if (modelToUse === 'LI7') return PLANT_REGISTRY.AMBERNATH.models.Li7.standards;
    if (modelToUse === 'LI7 PCA') return PLANT_REGISTRY.AMBERNATH.models["Li7 PCA"].standards;
    if (modelToUse === '2X') return PLANT_REGISTRY.AMBERNATH.models["2X"].standards;
    if (modelToUse === '3X') return PLANT_REGISTRY.AMBERNATH.models["3X"].standards;
    if (modelToUse === 'STS') return PLANT_REGISTRY.AMBERNATH.models["STS"].standards;
    if (['CHILLER', 'CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'ADANI'].includes(modelToUse)) {
      // For standards, we need to know the specific type if possible, 
      // but if we only have "CHILLER", we default to NH
      if (modelToUse === 'CHILLER_CH') return PLANT_REGISTRY.CHAKAN.models.CHILLER_CH.standards;
      if (modelToUse === 'CHILLER_ADANI' || modelToUse === 'ADANI') return PLANT_REGISTRY.CHAKAN.models.CHILLER_ADANI.standards;
      return PLANT_REGISTRY.CHAKAN.models.CHILLER_NH.standards;
    }
    if (modelToUse === 'PDX') return PLANT_REGISTRY.CHAKAN.models.PDX.standards;
    
    return ACTIVITY_STANDARDS;
  }, [selectedModelFilter, selectedUnitDetail]);

  const getStandardValue = (activityName: string, fallback: number = 0) => {
    if (!activityName) return fallback;
    const normalized = activityName.toUpperCase();
    const match = Object.entries(currentStandards).find(([k]) => k.toUpperCase() === normalized);
    return match ? (match[1] as number) : fallback;
  };

  const benchmarkData = useMemo(() => {
    const activityData: Record<string, { standard: number; unitTotals: Record<string, number> }> = {};
    
    filteredEntries.forEach(e => {
      // Exclude In Progress entries and Gap/Idle entries from the performance benchmark
      if (e.status === 'In Progress' || e.is_gap || e.activity === "Inter-Activity Idle Time") return;
      
      if (!activityData[e.activity]) {
        const std = getStandardValue(e.activity, e.standardCycleTime || 0);
        activityData[e.activity] = { standard: std, unitTotals: {} };
      }
      
      const unitKey = e.serialNo;
      activityData[e.activity].unitTotals[unitKey] = (activityData[e.activity].unitTotals[unitKey] || 0) + e.actualCycleTime;
    });

    return Object.entries(activityData)
      .map(([name, data]) => {
        const unitValues = Object.values(data.unitTotals);
        const avgActual = unitValues.length > 0 
          ? Math.round(unitValues.reduce((a, b) => a + b, 0) / unitValues.length)
          : 0;

        return { 
          name, 
          Standard: data.standard, 
          Actual: avgActual 
        };
      })
      .slice(0, 5);
  }, [filteredEntries, currentStandards]);

  const bottleneckData = useMemo(() => {
    const losses: Record<string, number> = {};
    filteredEntries.forEach(e => {
      // Exclude Gap/Idle entries from the bottleneck analysis to focus only on production activities
      if (e.is_gap || e.activity === "Inter-Activity Idle Time") return;
      losses[e.activity] = (losses[e.activity] || 0) + e.lossHours;
    });
    return Object.entries(losses)
      .map(([name, hours]) => ({ name, hours: Number(hours.toFixed(2)) }))
      .filter(item => item.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [filteredEntries]);

  const activePipelines = useMemo(() => {
    const results: Record<string, { activity: string; model: string; plant: string; isInProgress: boolean }> = {};
    
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const FINISHING_ACTS = ['Finishing', 'Finishing Activity', 'Testing'];

    // Group entries by unit
    const unitEntriesMap: Record<string, ProductionEntry[]> = {};
    (entries || []).forEach(e => {
      if (e.is_gap || e.activity === "Inter-Activity Idle Time") return;
      if (!unitEntriesMap[e.serialNo]) unitEntriesMap[e.serialNo] = [];
      unitEntriesMap[e.serialNo].push(e);
    });

    Object.entries(unitEntriesMap).forEach(([sn, unitEntries]) => {
      const activeAct = getActiveActivityName(unitEntries);
      const sorted = [...unitEntries].sort((a, b) => {
        const dateA = new Date(`${a.productionDate}T${a.startTime || '00:00'}`).getTime();
        const dateB = new Date(`${b.productionDate}T${b.startTime || '00:00'}`).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const last = sorted[sorted.length - 1];

      // Exclude units whose finishing activity completed in a previous month
      const finishingEntry = unitEntries
        .filter(e => FINISHING_ACTS.includes(e.activity) && e.status === 'Completed')
        .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())[0];
      if (finishingEntry && finishingEntry.productionDate.substring(0, 7) < currentYearMonth) return;

      if (activeAct) {
        results[sn] = {
          activity: activeAct,
          model: last.model,
          plant: last.plant,
          isInProgress: true
        };
      } else {
        results[sn] = {
          activity: last.activity,
          model: last.model,
          plant: last.plant,
          isInProgress: false
        };
      }
    });

    return results;
  }, [entries]);

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
        <ActivityIcon size={48} className="text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-800">No Data Reported</h3>
        <p className="text-slate-500 text-center max-w-sm">Awaiting input from the production line.</p>
      </div>
    );
  }

  const completedActivitiesCount = selectedUnitDetail ? new Set(selectedUnitDetail.allEntries.filter(e => e.status === 'Completed').map(e => e.activity)).size : 0;
  const overallProgress = Math.round((completedActivitiesCount / pipelineActivities.length) * 100);

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard icon={<Package className="text-blue-500" />} label="Active Serial Units" value={stats?.uniqueUnits.toString() || '0'} subtext="Unique Serial numbers tracked" />
        <KPICard icon={<Clock className="text-amber-500" />} label="Engaged Manhours" value={stats?.totalManhours.toFixed(1) || '0'} unit="Hrs" subtext="Total labor input" />
        <KPICard icon={<TrendingUp className={stats?.avgVariance && stats.avgVariance > 0 ? 'text-red-500' : 'text-green-500'} />} label="Avg Time Variance" value={stats?.avgVariance.toFixed(1) || '0'} unit="Min" subtext="Per activity deviation" />
        <KPICard icon={<AlertTriangle className="text-rose-500" />} label="Loss Time" value={stats?.totalLoss.toFixed(1) || '0'} unit="Hrs" subtext="Aggregate downtime" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 px-2">
          {isGlobal && (
            <div className="flex items-center gap-2 bg-slate-900/5 p-1.5 rounded-2xl border border-slate-200">
              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                <Globe size={14} className="text-blue-500" />
              </div>
              <div className="flex gap-1">
                {availablePlants.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlantFilter(p)}
                    className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                      selectedPlantFilter === p
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Filter size={14} className="text-slate-400" />
            </div>
            <div className="flex gap-1">
              {availableModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModelFilter(m)}
                  className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedModelFilter === m
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-50 rounded-2xl text-blue-600 shadow-sm">
                <ActivityIcon size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Live Production Pipeline</h3>
                <p className="text-sm text-slate-500">Real-time unit tracking for {selectedPlantFilter === 'All' ? 'Full Enterprise' : selectedPlantFilter}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-x-auto pb-4 custom-scrollbar">
            <div className={`flex items-start gap-0 px-4 ${
              (['2X', '3X'].includes(selectedModelFilter.toUpperCase())) 
                ? 'min-w-[2000px]' 
                : (['LI7', 'LI7 PCA', 'STS'].includes(selectedModelFilter.toUpperCase()))
                  ? 'min-w-[1200px]'
                  : 'min-w-[2500px]'
            }`}>
              {pipelineActivities.map((act, idx) => {
                const activeUnits = Object.entries(activePipelines)
                  .filter(([_, data]: [string, any]) => {
                    const plantMatch = selectedPlantFilter === 'All' || data.plant === selectedPlantFilter;
                    const modelMatch = selectedModelFilter === 'All' 
                      ? true 
                      : selectedModelFilter === 'CHILLER'
                        ? ['CHILLER_NH', 'CHILLER_CH', 'CHILLER_ADANI', 'CHILLER', 'ADANI'].includes(data.model.toUpperCase())
                        : data.model.toUpperCase() === selectedModelFilter.toUpperCase();
                    const activityMatch = data.activity.trim().toUpperCase() === act.trim().toUpperCase();
                    return plantMatch && modelMatch && activityMatch;
                  })
                  .map(([sn, data]: [string, any]) => ({ sn, model: data.model, plant: data.plant, isInProgress: data.isInProgress }));

                return (
                  <div key={act} className="flex-1 flex flex-col items-center">
                    <div className="relative flex flex-col items-center w-full">
                      {idx < pipelineActivities.length - 1 && <div className="absolute top-5 left-1/2 w-full h-[2px] bg-slate-100 z-0"></div>}
                      <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center z-10 transition-all ${activeUnits.length > 0 ? 'bg-blue-600 border-blue-100' : 'bg-white border-slate-50'}`}>
                        <span className={`text-[11px] font-bold ${activeUnits.length > 0 ? 'text-white' : 'text-slate-300'}`}>{idx + 1}</span>
                      </div>
                      <div className="mt-3 text-center px-2 h-10 text-[10px] font-bold text-slate-500 uppercase tracking-tight line-clamp-2 leading-tight">{act}</div>
                      <div className="mt-4 flex flex-col gap-1.5 w-full items-center min-h-[70px]">
                        {activeUnits.map(unit => (
                          <button 
                            key={unit.sn} 
                            onClick={() => setSelectedSerial(unit.sn)} 
                            className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex flex-col items-center shadow-sm relative ${
                              unit.isInProgress 
                                ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse ring-2 ring-amber-100 ring-offset-1' 
                                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            <span>{unit.sn}</span>
                            {unit.isInProgress && (
                              <span className="text-[7px] font-black uppercase absolute -top-2 -right-1 bg-amber-500 text-white px-1.5 rounded">LIVE</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50/30 px-8 py-6 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setPipelineView('active')}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    pipelineView === 'active'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  Active Pipeline
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineView('completed')}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    pipelineView === 'completed'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  ✓ Completed Units
                </button>
              </div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                {pipelineView === 'completed' ? 'Completed Units' : 'Active Pipeline'} • {filteredUnitsList.length} Records Found
              </p>
              <div className="relative w-full md:w-96">
                <select 
                  value={selectedSerial || ''} 
                  onChange={(e) => setSelectedSerial(e.target.value)}
                  className="w-full pl-6 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-black text-slate-900 appearance-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {pipelineView === 'completed' ? (() => {
                    const FINISHING_ACTS = ['Finishing', 'Finishing Activity', 'Testing'];
                    // Group units by finishing month
                    const grouped: Record<string, typeof filteredUnitsList> = {};
                    filteredUnitsList.forEach(u => {
                      const finishingEntry = u.allEntries
                        .filter(e => FINISHING_ACTS.includes(e.activity) && e.status === 'Completed')
                        .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())[0];
                      const monthKey = finishingEntry
                        ? finishingEntry.productionDate.substring(0, 7)
                        : 'Unknown';
                      if (!grouped[monthKey]) grouped[monthKey] = [];
                      grouped[monthKey].push(u);
                    });
                    // Sort months descending (most recent first)
                    return Object.entries(grouped)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([monthKey, units]) => {
                        const [y, m] = monthKey.split('-');
                        const label = monthKey === 'Unknown' ? 'Unknown' :
                          new Date(Number(y), Number(m) - 1, 1)
                            .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                        return (
                          <optgroup key={monthKey} label={`${label} — ${units.length} unit${units.length > 1 ? 's' : ''}`}>
                            {units.map(u => (
                              <option key={u.serialNo} value={u.serialNo}>
                                {u.plant} — {u.model} — {u.serialNo}
                              </option>
                            ))}
                          </optgroup>
                        );
                      });
                  })() : filteredUnitsList.map(u => (
                    <option key={u.serialNo} value={u.serialNo}>
                      {u.plant} — {u.model} — {u.serialNo} {u.activeActivity ? `(In Progress: ${u.activeActivity})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase ${overallProgress >= 100 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {overallProgress >= 100 ? 'Completed' : 'In Progress'}
              </span>
              <div className="w-48 space-y-1.5">
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${overallProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                    style={{ width: `${Math.min(100, overallProgress)}%` }}
                  />
                </div>
                <p className="text-[9px] font-black text-slate-400 text-right uppercase tracking-widest">
                  {overallProgress}% Standard Progress
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8 relative">
          <div className="absolute left-[39px] top-12 bottom-12 w-[1px] bg-slate-100 z-0" />

          {timelineNodes.map((node, idx) => {
            if (node.type === 'gap') {
              return (
                <div key={`gap-${node.startMs}-${idx}`} className="relative z-10 flex gap-6 group">
                  <div className="mt-1 flex-shrink-0">
                    <div className="w-5 h-5 rounded-full border-4 bg-indigo-600 border-indigo-100" />
                  </div>
                  <div className="flex-1 bg-white border border-blue-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">DATE: {formatDate(node.date)}</span>
                          <div className="flex flex-wrap items-center gap-4">
                            <h4 className="text-xl font-black text-indigo-900 tracking-tight leading-none">Inter-activity Idle Time</h4>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-black uppercase leading-none">
                              {node.isLogged ? 'LOGGED LOSS' : 'IDLE PHASE'}
                            </div>
                            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase leading-none shadow-sm">
                              TOTAL LOSS: {node.lossHours} HRS
                            </div>
                          </div>

                          {node.isLogged && (
                            <div className="p-4 bg-white/50 rounded-2xl border border-indigo-100 space-y-2 mt-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-amber-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Attribution: {node.shifts[0].lossReason}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-600 italic">"{node.shifts[0].issueDescription || node.shifts[0].notes}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="lg:pl-8 lg:border-l border-slate-100 flex flex-col justify-center lg:w-64">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock size={16} className="text-blue-400" />
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">TIMELINE OVERVIEW</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold text-blue-600">Idle Start</span>
                            <span className="bg-blue-50 px-3 py-1 rounded-lg text-xs font-black text-blue-900">{formatTimeDisplay(node.idleStart)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold text-blue-600">Idle End</span>
                            <span className="bg-blue-50 px-3 py-1 rounded-lg text-xs font-black text-blue-900">{formatTimeDisplay(node.idleEnd)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const group = node;
            const isCompleted = group.shifts.some((s: ProductionEntry) => s.status === 'Completed');
            const isInProgressOnly = !isCompleted && group.shifts.some((s: ProductionEntry) => s.status === 'In Progress');
            const lossReasons = [...new Set(group.shifts.map((s: ProductionEntry) => s.lossReason).filter((r: string) => r && r !== 'Standard Operation'))];
            const totalActualForGroup = group.shifts.reduce((sum: number, s: ProductionEntry) => sum + (s.actualCycleTime || 0), 0) || 1;

            return (
              <div key={`node-${group.activityName}-${group.startMs}-${idx}`} className="relative z-10 flex gap-6 group">
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-5 h-5 rounded-full border-4 transition-all duration-300 ${
                    isCompleted ? 'bg-green-500 border-green-100' : 'bg-blue-600 border-blue-100 scale-125'
                  }`} />
                </div>

                <div className={`flex-1 bg-white border rounded-[2rem] p-6 transition-all duration-300 ${
                  isCompleted ? 'border-slate-100 shadow-sm opacity-90' : 'border-blue-200 shadow-lg ring-4 ring-blue-50'
                } hover:border-blue-200 relative overflow-hidden`}>
                  
                  {isInProgressOnly && (
                    <div className="absolute top-0 right-0 p-4">
                       <div className="flex items-center gap-2 bg-amber-100/80 text-amber-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase animate-pulse shadow-sm border border-amber-200/50 backdrop-blur-[2px]">
                         <Timer size={12} /> SESSION ACTIVE
                       </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {/* Activity Header Row - Compact spacing applied */}
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">
                          {(() => {
                            const lastShift = group.shifts[group.shifts.length - 1];
                            const endDate = lastShift.endDate || lastShift.date;
                            return endDate !== group.date
                              ? `${formatDate(group.date)} → ${formatDate(endDate)}`
                              : formatDate(group.date);
                          })()}
                        </span>
                        <div className="flex items-center gap-3">
                          <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none">{toTitleCase(group.activityName)}</h4>
                          <span className="text-sm font-bold text-slate-400">Activity cycle: {Math.round(getStandardValue(group.activityName, group.shifts[0]?.standardCycleTime || 0))} min</span>
                        </div>
                        {lossReasons.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-black uppercase leading-none w-fit">
                            <AlertTriangle size={12} /> LOSS: {lossReasons.join(', ').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="lg:w-64 lg:pl-8 lg:border-l border-slate-100 flex items-center">
                        {/* Structural alignment partition */}
                      </div>
                    </div>

                    {/* Unified Shift Rows */}
                    <div className="space-y-4 mt-2">
                      {group.shifts
                        .filter(e => {
                          if (isCompleted && e.status === 'In Progress') return false;
                          if (e.status === 'Completed') return true;
                          return e.manpower > 0 || e.status === 'In Progress';
                        })
                        .map((entry: ProductionEntry, shiftIdx: number) => {
                          const masterStd = getStandardValue(entry.activity, entry.standardCycleTime || 0);
                          const isSplit = group.shifts.length > 1 && totalActualForGroup > 1;
                          const proportionateStd = isSplit ? (entry.actualCycleTime / totalActualForGroup) * masterStd : masterStd;

                          return (
                            <div key={entry.id} className={`flex flex-col gap-3 ${shiftIdx > 0 ? 'pt-6 border-t border-slate-100 border-dashed' : ''}`}>
                              {/* Shift Header Area (Green Box Alignment) */}
                              <div className="flex flex-col lg:flex-row gap-6 items-center">
                                {/* Left Partition: Shift Label */}
                                <div className="flex-1 flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                    entry.shift === 'Shift 2' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}>
                                    {entry.shift}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {formatDate(entry.productionDate)}
                                    {entry.endDate && entry.endDate !== entry.productionDate ? ` → ${formatDate(entry.endDate)}` : ''}
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-300">
                                    {entry.startTime} – {entry.endTime}
                                  </span>
                                </div>

                                {/* Right Partition: Timeline Header */}
                                <div className="lg:w-64 lg:pl-8 lg:border-l border-slate-100/0 lg:border-slate-100">
                                  {shiftIdx === 0 && (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        <Clock size={16} /> TIMELINE OVERVIEW
                                      </div>
                                      {entry.status === 'In Progress' && (
                                        <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 rounded animate-pulse">LIVE</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Shift Content Area (Pink Box Alignment) */}
                              <div className="flex flex-col lg:flex-row gap-6">
                                {/* Left Partition: Metric Boxes */}
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <MetricBox label="MANPOWER" value={entry.status === 'In Progress' && entry.manpower === 0 ? 'Awaiting' : (entry.manpower > 0 ? `${entry.manpower} Oper` : 'Awaiting')} />
                                  <MetricBox label="PLANNED MH" value={`${(proportionateStd / 60 * Math.max(1, entry.manpower)).toFixed(2)} hrs`} />
                                  <MetricBox label="CURR MH" value={entry.status === 'Completed' ? `${(entry.manhoursEngaged || 0).toFixed(2)} hrs` : 'Calculated at end'} />
                                  <MetricBox label="EFFICIENCY" value={entry.status === 'Completed' ? `${Math.round((proportionateStd / (entry.actualCycleTime || 1)) * 100)}%` : 'TBD'} />
                                </div>

                                {/* Right Partition: Timing Values */}
                                <div className="lg:w-64 lg:pl-8 lg:border-l border-slate-100 flex flex-col justify-center gap-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[11px] font-black text-slate-400 uppercase">Actual (Start)</span>
                                    <span className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-black mono text-slate-900 border border-slate-100">{formatTimeDisplay(entry.startTime)}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[11px] font-black text-slate-400 uppercase">Actual (End)</span>
                                    <span className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-black mono text-slate-900 border border-slate-100">{formatTimeDisplay(entry.status === 'Completed' ? entry.endTime : '-')}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="p-2 bg-slate-50 rounded-xl text-blue-600 shadow-sm">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Performance Benchmark</h3>
              <p className="text-sm text-slate-500">Analysis for {selectedPlantFilter === 'All' ? 'Consolidated Enterprise' : selectedPlantFilter}</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmarkData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                  angle={-35} 
                  textAnchor="end" 
                  height={60}
                  xAxisId={0}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                  yAxisId={0}
                />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                <Legend iconType="rect" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 700 }} />
                <Bar dataKey="Standard" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-8 flex items-center gap-4">
            <div className="p-2 bg-slate-50 rounded-xl text-rose-500 shadow-sm">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Bottleneck Analysis</h3>
              <p className="text-sm text-slate-500">Loss hours aggregation across processes</p>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={bottleneckData} margin={{ left: 100, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                  xAxisId={0}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} 
                  width={100} 
                  yAxisId={0}
                />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                <Bar dataKey="hours" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBox: React.FC<{ label: string; value: string; theme?: 'default' | 'purple' | 'indigo' }> = ({ label, value, theme = 'default' }) => {
  const getThemeClasses = () => {
    switch(theme) {
      case 'purple':
        return { label: 'text-purple-400', value: 'text-purple-900', bg: 'bg-purple-50/50', border: 'border-purple-100' };
      case 'indigo':
        return { label: 'text-indigo-400', value: 'text-indigo-900', bg: 'bg-indigo-50/50', border: 'border-indigo-100' };
      default:
        return { label: 'text-slate-400', value: 'text-slate-900', bg: 'bg-slate-50/50', border: 'border-slate-100' };
    }
  };
  const colors = getThemeClasses();
  return (
    <div className={`${colors.bg} p-4 rounded-2xl border ${colors.border} flex flex-col items-center justify-center text-center transition-all hover:bg-white hover:shadow-sm`}>
      <span className={`text-[10px] font-black ${colors.label} mb-1 uppercase tracking-widest`}>{label}</span>
      <span className={`text-sm font-black ${colors.value}`}>{value}</span>
    </div>
  );
};

const KPICard: React.FC<{ icon: React.ReactNode; label: string; value: string; subtext: string; unit?: string }> = ({ icon, label, value, subtext, unit }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:border-blue-200">
    <div className="p-3 bg-slate-50 rounded-2xl">{icon}</div>
    <div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <div className="flex items-baseline gap-1"><h4 className="text-2xl font-bold text-slate-900">{value}</h4>{unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}</div>
      <p className="text-xs text-slate-400 mt-1">{subtext}</p>
    </div>
  </div>
);

export default Dashboard;