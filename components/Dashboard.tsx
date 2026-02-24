import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Clock, AlertTriangle, Package, ChevronDown, Activity as ActivityIcon, FileText, Timer, Filter, Globe, Loader2 } from 'lucide-react';
import { ProductionEntry } from '../types';
import { ACTIVITIES_LIST, ACTIVITY_STANDARDS, PLANT_REGISTRY, calculateAvailableMinutes, AMBERNATH_BREAK_TIMES, MODELS_LIST } from '../constants';

interface DashboardProps {
  entries: ProductionEntry[];
  plant: string;
  userRole?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ entries, plant, userRole }) => {
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('All');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('All');
  const hasSetDefaultModel = useRef(false);

  const isGlobal = userRole === 'admin' || userRole === 'management';

  const normalizedEntries = useMemo(() => {
    return entries.map(e => {
      const m = e.model.toUpperCase();
      if (m === 'NH') return { ...e, model: 'CHILLER' };
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
      const modelMatch = selectedModelFilter === 'All' || e.model === selectedModelFilter;
      return plantMatch && modelMatch;
    });
  }, [normalizedEntries, selectedPlantFilter, selectedModelFilter]);

  const stats = useMemo(() => {
    if (!filteredEntries.length) return null;
    const uniqueUnits = new Set(filteredEntries.map(e => e.serialNo)).size;
    const totalManhours = filteredEntries.reduce((acc, e) => acc + e.manhoursEngaged, 0);
    const avgVariance = filteredEntries.reduce((acc, e) => acc + e.variance, 0) / (filteredEntries.length || 1);
    const totalLoss = filteredEntries.reduce((acc, e) => acc + e.lossHours, 0);
    return { uniqueUnits, totalManhours, avgVariance, totalLoss };
  }, [filteredEntries]);

  // Helper to determine active activity for a set of entries
  const getActiveActivityName = (unitEntries: ProductionEntry[]) => {
    const activityStatus: Record<string, { hasStart: boolean; hasEnd: boolean }> = {};
    unitEntries.forEach(e => {
      if (e.isGap || e.activity === "Inter-Activity Idle Time") return;
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
      if (e.status === 'Completed' && !e.isGap) units[e.serialNo].completedActivities += 1;
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
  }, [entries]);

  // Filtered unit dropdown list
  const filteredUnitsList = useMemo(() => {
    return unitsList.filter(u => {
      const plantMatch = selectedPlantFilter === 'All' || u.plant === selectedPlantFilter;
      const modelMatch = selectedModelFilter === 'All' || u.model === selectedModelFilter;
      return plantMatch && modelMatch;
    });
  }, [unitsList, selectedPlantFilter, selectedModelFilter]);

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
      else models.add(e.model);
    });

    // 2. If a specific plant is selected, ensure all its registry models are available
    const p = selectedPlantFilter?.toUpperCase();
    if (p !== 'ALL' && PLANT_REGISTRY[p]) {
      Object.keys(PLANT_REGISTRY[p].models).forEach(m => models.add(m));
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

  // Auto-select first model besides 'All' on initial data load
  useEffect(() => {
    if (!hasSetDefaultModel.current && availableModels.length > 1) {
      // Skip index 0 ('All') and select the first actual model
      setSelectedModelFilter(availableModels[1]);
      hasSetDefaultModel.current = true;
    }
  }, [availableModels]);

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
    if (m === 'ALL') return ACTIVITIES_LIST;

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

    // For general/mixed pipeline, use the Chakan NH baseline
    return ACTIVITIES_LIST;
  }, [selectedModelFilter]);

  const selectedUnitDetail = useMemo(() => {
    if (!selectedSerial) return null;
    return unitsList.find(u => u.serialNo === selectedSerial);
  }, [selectedSerial, unitsList]);

  const timelineNodes = useMemo(() => {
    if (!selectedUnitDetail) return [];

    const prodEntries = [...selectedUnitDetail.allEntries]
      .filter(e => {
        const isIdle = e.activity === "Inter-Activity Idle Time";
        // Show all activity entries, including 'In Progress' placeholders to see them in timeline
        return !isIdle;
      })
      .sort((a, b) => {
        // Use production date and start time for robust chronological sorting
        const timeA = new Date(`${a.productionDate}T${a.startTime}`).getTime();
        const timeB = new Date(`${b.productionDate}T${b.startTime}`).getTime();
        return timeA - timeB;
      });

    // Group all entries of the same activity into "sessions" (clubbing shifts)
    const consolidatedMap: Record<string, any> = {};
    prodEntries.forEach(e => {
      const startMs = new Date(`${e.productionDate}T${e.startTime}`).getTime();
      const endMs = e.status === 'Completed' 
        ? new Date(`${e.endDate || e.productionDate}T${e.endTime}`).getTime()
        : Date.now();

      if (consolidatedMap[e.activity]) {
        const group = consolidatedMap[e.activity];
        group.shifts.push(e);
        if (startMs < group.startMs) {
          group.startMs = startMs;
          group.startTime = e.startTime;
          group.date = e.productionDate;
        }
        if (endMs > group.endMs) {
          group.endMs = endMs;
          group.endTime = e.status === 'Completed' ? e.endTime : '-';
        }
      } else {
        consolidatedMap[e.activity] = {
          activityName: e.activity,
          shifts: [e],
          startMs,
          endMs,
          startTime: e.startTime,
          endTime: e.status === 'Completed' ? e.endTime : '-',
          date: e.productionDate,
          isParallel: false
        };
      }
    });
    const consolidated = Object.values(consolidatedMap).sort((a, b) => a.startMs - b.startMs);

    const nodes: any[] = [];
    let absoluteLatestEndMs = -Infinity;
    let lastTimeStr = '';

    consolidated.forEach((group, idx) => {
      // Check for gaps (Inter-Activity Idle Time)
      if (idx > 0 && group.startMs > absoluteLatestEndMs && absoluteLatestEndMs !== -Infinity) {
        // EXCLUSION LOGIC: Use the shared helper to calculate available working minutes only
        const m = selectedModelFilter.toUpperCase();
        const customBreaks = (m === 'LI7' || m === 'LI7 PCA' || m === '2X' || m === '3X' || m === 'STS') ? AMBERNATH_BREAK_TIMES : undefined;
        const workingGapMins = calculateAvailableMinutes(absoluteLatestEndMs, group.startMs, customBreaks);
        
        if (workingGapMins >= 1) {
          nodes.push({
            type: 'gap',
            idleStart: lastTimeStr,
            idleEnd: group.startTime,
            lossHours: (workingGapMins / 60).toFixed(2),
            date: group.date
          });
        }
      }

      for (let j = 0; j < idx; j++) {
        const prev = consolidated[j];
        // Parallel logic: Overlap in time + different activity names
        if (group.startMs < prev.endMs && group.activityName !== prev.activityName) {
          // STALE IN-PROGRESS CHECK:
          // If the previous activity is stuck 'In Progress' (endMs is 'Now'), 
          // but the current activity has already started much later (e.g., different day),
          // we should not mark it as parallel unless they truly overlap.
          const prevIsInProgress = prev.shifts.some((s: any) => s.status === 'In Progress');
          const groupIsNewer = group.startMs > prev.startMs;
          
          if (prevIsInProgress && groupIsNewer) {
            // If group started on a different day than prev started, and prev is still In Progress,
            // we assume it's a stale entry and not a parallel activity.
            if (group.date !== prev.date) continue;
          }

          group.isParallel = true;
          break;
        }
      }

      nodes.push({
        type: 'activity',
        ...group
      });

      if (group.endMs > absoluteLatestEndMs) {
        absoluteLatestEndMs = group.endMs;
        lastTimeStr = group.endTime;
      }
    });

    return nodes.filter(node => {
      if (node.type === 'gap') return Number(node.lossHours) > 0;
      if (node.type === 'activity') {
        const hasLoss = node.shifts.some((s: ProductionEntry) => (s.lossHours || 0) > 0);
        const isInProgress = node.shifts.some((s: ProductionEntry) => s.status === 'In Progress');
        return hasLoss || isInProgress;
      }
      return true;
    });
  }, [selectedUnitDetail]);

  const currentStandards = useMemo(() => {
    // Priority: Selected Unit's Model > Selected Model Filter > Default (NH)
    const modelToUse = (selectedUnitDetail?.model || selectedModelFilter).toUpperCase();
    
    if (modelToUse === 'LI7') return PLANT_REGISTRY.AMBERNATH.models.Li7.standards;
    if (modelToUse === 'LI7 PCA') return PLANT_REGISTRY.AMBERNATH.models["Li7 PCA"].standards;
    if (modelToUse === '2X') return PLANT_REGISTRY.AMBERNATH.models["2X"].standards;
    if (modelToUse === '3X') return PLANT_REGISTRY.AMBERNATH.models["3X"].standards;
    if (modelToUse === 'STS') return PLANT_REGISTRY.AMBERNATH.models["STS"].standards;
    if (modelToUse === 'CHILLER') return PLANT_REGISTRY.CHAKAN.models.CHILLER.standards;
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
      if (e.status === 'In Progress' || e.isGap || e.activity === "Inter-Activity Idle Time") return;
      
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
      if (e.isGap || e.activity === "Inter-Activity Idle Time") return;
      losses[e.activity] = (losses[e.activity] || 0) + e.lossHours;
    });
    return Object.entries(losses)
      .map(([name, hours]) => ({ name, hours }))
      .filter(item => item.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [filteredEntries]);

  const activePipelines = useMemo(() => {
    const results: Record<string, { activity: string; model: string; plant: string; isInProgress: boolean }> = {};
    
    // Group entries by unit
    const unitEntriesMap: Record<string, ProductionEntry[]> = {};
    (entries || []).forEach(e => {
      if (e.isGap || e.activity === "Inter-Activity Idle Time") return;
      if (!unitEntriesMap[e.serialNo]) unitEntriesMap[e.serialNo] = [];
      unitEntriesMap[e.serialNo].push(e);
    });

    Object.entries(unitEntriesMap).forEach(([sn, unitEntries]) => {
      const activeAct = getActiveActivityName(unitEntries);
      const sorted = [...unitEntries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const last = sorted[sorted.length - 1];

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    const modelMatch = selectedModelFilter === 'All' || data.model.toUpperCase() === selectedModelFilter.toUpperCase();
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
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                Unit Selection • {filteredUnitsList.length} Records Found
              </p>
              <div className="relative w-full md:w-96">
                <select 
                  value={selectedSerial || ''} 
                  onChange={(e) => setSelectedSerial(e.target.value)}
                  className="w-full pl-6 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-black text-slate-900 appearance-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {filteredUnitsList.map(u => (
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
                <div key={`gap-${idx}`} className="relative z-10 flex gap-6 group">
                  <div className="mt-1 flex-shrink-0">
                    <div className="w-5 h-5 rounded-full border-4 bg-indigo-600 border-indigo-100" />
                  </div>
                  <div className="flex-1 bg-indigo-50/20 border border-indigo-200 rounded-[2rem] p-6 hover:border-indigo-300 transition-all relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">DATE: {formatDate(node.date)}</span>
                          <div className="flex flex-wrap items-baseline gap-4">
                            <h4 className="text-xl font-black text-indigo-900 tracking-tight leading-none">Inter-Activity Idle Time</h4>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-black uppercase leading-none">
                              IDLE PHASE
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#4F46E5] text-white rounded-full text-[10px] font-black uppercase leading-none">
                              TOTAL LOSS: {node.lossHours} hrs
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <MetricBox label="Idle Start" value={formatTimeDisplay(node.idleStart)} theme="indigo" />
                          <MetricBox label="Idle End" value={formatTimeDisplay(node.idleEnd)} theme="indigo" />
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
              <div key={`${group.activityName}-${idx}`} className="relative z-10 flex gap-6 group">
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-5 h-5 rounded-full border-4 transition-all duration-300 ${
                    isCompleted ? 'bg-green-500 border-green-100' : 'bg-blue-600 border-blue-100 scale-125'
                  }`} />
                </div>

                <div className={`flex-1 bg-white border rounded-[2rem] p-6 transition-all duration-300 ${
                  isCompleted ? 'border-slate-100 shadow-sm opacity-90' : 'border-blue-200 shadow-lg ring-4 ring-blue-50'
                } hover:border-blue-200 relative overflow-hidden`}>
                  
                  {group.isParallel && (
                    <div className="absolute top-0 right-0 bg-blue-600 text-white px-6 py-2 rounded-bl-3xl text-[11px] font-black uppercase tracking-widest shadow-lg z-20">
                      PARALLEL ACTIVITY
                    </div>
                  )}

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
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">DATE: {formatDate(group.date)}</span>
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
                                <div className="flex-1">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                    entry.shift === 'Shift 2' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}>
                                    {entry.shift}
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