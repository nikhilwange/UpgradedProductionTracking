
import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Clock, AlertTriangle, Package, ChevronDown, Activity as ActivityIcon, FileText, Timer, Filter } from 'lucide-react';
import { ProductionEntry } from '../types';
import { ACTIVITIES_LIST, ACTIVITY_STANDARDS, PLANT_REGISTRY } from '../constants';

interface DashboardProps {
  entries: ProductionEntry[];
  plant: string;
}

const Dashboard: React.FC<DashboardProps> = ({ entries, plant }) => {
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('All');

  const toTitleCase = (str: string) => {
    if (!str) return 'N/A';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTimeDisplay = (time: string | undefined) => {
    if (!time || time === 'N/A' || time === '—' || time.trim() === '') return '—';
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

  // 1. Filtered entries for aggregate analytics (KPIs and Charts)
  const filteredEntriesByModel = useMemo(() => {
    if (selectedModelFilter === 'All') return entries;
    return entries.filter(e => e.model === selectedModelFilter);
  }, [entries, selectedModelFilter]);

  const stats = useMemo(() => {
    if (!filteredEntriesByModel.length) return null;
    const uniqueUnits = new Set(filteredEntriesByModel.map(e => e.serialNo)).size;
    const totalManhours = filteredEntriesByModel.reduce((acc, e) => acc + e.manhoursEngaged, 0);
    const avgVariance = filteredEntriesByModel.reduce((acc, e) => acc + e.variance, 0) / (filteredEntriesByModel.length || 1);
    const totalLoss = filteredEntriesByModel.reduce((acc, e) => acc + e.lossHours, 0);
    return { uniqueUnits, totalManhours, avgVariance, totalLoss };
  }, [filteredEntriesByModel]);

  // Original units list based on all entries for dropdown selection
  const unitsList = useMemo(() => {
    const units: Record<string, { 
      serialNo: string; 
      model: string; 
      completedActivities: number; 
      lastEntry: ProductionEntry;
      allEntries: ProductionEntry[];
    }> = {};

    [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).forEach(e => {
      if (!units[e.serialNo]) {
        units[e.serialNo] = { 
          serialNo: e.serialNo, 
          model: e.model, 
          completedActivities: 0, 
          lastEntry: e,
          allEntries: [] 
        };
      }
      units[e.serialNo].completedActivities += 1;
      units[e.serialNo].lastEntry = e;
      units[e.serialNo].allEntries.push(e);
    });

    return Object.values(units).sort((a, b) => new Date(b.lastEntry.createdAt).getTime() - new Date(a.lastEntry.createdAt).getTime());
  }, [entries]);

  // Derived filtered list for the unit selector dropdown
  const filteredUnitsList = useMemo(() => {
    if (selectedModelFilter === 'All') return unitsList;
    return unitsList.filter(u => u.model === selectedModelFilter);
  }, [unitsList, selectedModelFilter]);

  const availableModels = useMemo(() => {
    const models = new Set(unitsList.map(u => u.model));
    const list = Array.from(models).sort();
    if (plant === 'AMBERNATH') return list;
    return ['All', ...list];
  }, [unitsList, plant]);

  // Handle default filter for Ambernath when "All" is not permitted
  useEffect(() => {
    if (plant === 'AMBERNATH' && selectedModelFilter === 'All') {
      if (availableModels.length > 0) {
        setSelectedModelFilter(availableModels[0]);
      }
    }
  }, [plant, availableModels, selectedModelFilter]);

  // Dynamic activity list for the pipeline based on model filter
  const pipelineActivities = useMemo(() => {
    if (selectedModelFilter === 'LI7') {
      // Return Li7 flattened activity list (Normalizing to uppercase config for safety)
      return Object.values(PLANT_REGISTRY.AMBERNATH.models.LI7.mapping).flat() as string[];
    }
    // Default to the Chakan NH activity list defined in constants
    return ACTIVITIES_LIST;
  }, [selectedModelFilter]);

  // Reset selected serial when filter changes if current selection is no longer valid
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

  const selectedUnitDetail = useMemo(() => {
    if (!selectedSerial) return null;
    return unitsList.find(u => u.serialNo === selectedSerial);
  }, [selectedSerial, unitsList]);

  const timelineNodes = useMemo(() => {
    if (!selectedUnitDetail) return [];

    const prodEntries = [...selectedUnitDetail.allEntries]
      .filter(e => {
        const isIdle = e.activity === "Inter-Activity Idle Time";
        const isPlaceholder = e.status === 'In Progress' && e.manpower === 0;
        return !isIdle && !isPlaceholder;
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.productionDate}T${a.startTime}`).getTime();
        const timeB = new Date(`${b.productionDate}T${b.startTime}`).getTime();
        return timeA - timeB;
      });

    const groups: Record<string, ProductionEntry[]> = {};
    prodEntries.forEach(e => {
      if (!groups[e.activity]) groups[e.activity] = [];
      groups[e.activity].push(e);
    });

    const consolidated = Object.entries(groups).map(([activityName, shifts]) => {
      const sortedShifts = [...shifts].sort((a, b) => {
        const tA = new Date(`${a.productionDate}T${a.startTime}`).getTime();
        const tB = new Date(`${b.productionDate}T${b.startTime}`).getTime();
        return tA - tB;
      });
      
      const first = sortedShifts[0];
      const last = sortedShifts[sortedShifts.length - 1];
      
      const startMs = new Date(`${first.productionDate}T${first.startTime}`).getTime();
      const endMs = new Date(`${last.endDate || last.productionDate}T${last.endTime}`).getTime();

      return {
        activityName,
        shifts: sortedShifts,
        startMs,
        endMs,
        startTime: first.startTime,
        endTime: last.endTime,
        date: first.productionDate,
        isParallel: false
      };
    });

    consolidated.sort((a, b) => a.startMs - b.startMs);

    const nodes: any[] = [];
    let absoluteLatestEndMs = -Infinity;
    let lastTimeStr = '';

    consolidated.forEach((group, idx) => {
      if (idx > 0 && group.startMs > absoluteLatestEndMs) {
        const gapMins = (group.startMs - absoluteLatestEndMs) / 60000;
        if (gapMins >= 1) {
          nodes.push({
            type: 'gap',
            idleStart: lastTimeStr,
            idleEnd: group.startTime,
            lossHours: (gapMins / 60).toFixed(2),
            date: group.date
          });
        }
      }

      for (let j = 0; j < idx; j++) {
        const prev = consolidated[j];
        if (group.startMs < prev.endMs && group.activityName !== prev.activityName) {
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

    return nodes;
  }, [selectedUnitDetail]);

  const benchmarkData = useMemo(() => {
    const activityData: Record<string, { standard: number; actualTotal: number; count: number }> = {};
    filteredEntriesByModel.forEach(e => {
      if (e.status === 'In Progress' && e.manpower === 0) return;
      
      if (!activityData[e.activity]) {
        activityData[e.activity] = { standard: ACTIVITY_STANDARDS[e.activity] || 0, actualTotal: 0, count: 0 };
      }
      activityData[e.activity].actualTotal += e.actualCycleTime;
      activityData[e.activity].count += 1;
    });
    return Object.entries(activityData)
      .map(([name, data]) => ({ name, Standard: data.standard, Actual: Math.round(data.actualTotal / data.count) }))
      .slice(0, 5);
  }, [filteredEntriesByModel]);

  const bottleneckData = useMemo(() => {
    const losses: Record<string, number> = {};
    filteredEntriesByModel.forEach(e => {
      losses[e.activity] = (losses[e.activity] || 0) + e.lossHours;
    });
    return Object.entries(losses)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredEntriesByModel]);

  const activePipelines = useMemo(() => {
    const lastSeen: Record<string, { activity: string; model: string }> = {};
    const filteredEntries = (entries || []).filter(e => !e.isGap && e.activity !== "Inter-Activity Idle Time");
    const sorted = [...filteredEntries].sort((a: ProductionEntry, b: ProductionEntry) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    sorted.forEach((e: ProductionEntry) => {
      lastSeen[e.serialNo] = { activity: e.activity, model: e.model };
    });
    return lastSeen;
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
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard icon={<Package className="text-blue-500" />} label="Active Serial Units" value={stats?.uniqueUnits.toString() || '0'} subtext="Unique Serial numbers tracked" />
        <KPICard icon={<Clock className="text-amber-500" />} label="Engaged Manhours" value={stats?.totalManhours.toFixed(1) || '0'} unit="Hrs" subtext="Total labor input" />
        <KPICard icon={<TrendingUp className={stats?.avgVariance && stats.avgVariance > 0 ? 'text-red-500' : 'text-green-500'} />} label="Avg Time Variance" value={stats?.avgVariance.toFixed(1) || '0'} unit="Min" subtext="Per activity deviation" />
        <KPICard icon={<AlertTriangle className="text-rose-500" />} label="Loss Time" value={stats?.totalLoss.toFixed(1) || '0'} unit="Hrs" subtext="Aggregate downtime" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-2 overflow-x-auto custom-scrollbar pb-2">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Filter size={14} className="text-slate-400" />
            </div>
            <div className="flex gap-1">
              {availableModels.map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModelFilter(model)}
                  className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedModelFilter === model
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {model}
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
                <p className="text-sm text-slate-500">Real-time unit location across all activities</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-x-auto pb-4 custom-scrollbar">
            <div className="flex items-start min-w-[2500px] gap-0 px-4">
              {pipelineActivities.map((act, idx) => {
                const activeUnits = (Object.entries(activePipelines) as [string, { activity: string; model: string }][])
                  .filter(([_, data]) => {
                    const matchesModel = selectedModelFilter === 'All' || data.model.trim().toUpperCase() === selectedModelFilter.trim().toUpperCase();
                    // Robust Case-Insensitive activity matching
                    const matchesActivity = data.activity.trim().toUpperCase() === act.trim().toUpperCase();
                    return matchesActivity && matchesModel;
                  })
                  .map(([sn, data]) => ({ sn, model: data.model }));

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
                          <button key={unit.sn} onClick={() => setSelectedSerial(unit.sn)} className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-bold text-blue-700 whitespace-nowrap hover:bg-blue-100 transition-all flex flex-col items-center shadow-sm">
                            <span className="opacity-60 text-[8px] uppercase">{unit.model}</span>
                            <span>{unit.sn}</span>
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
                Production Schedule • {selectedUnitDetail?.allEntries.length || 0} Records Found
              </p>
              <div className="relative w-full md:w-80">
                <select 
                  value={selectedSerial || ''} 
                  onChange={(e) => setSelectedSerial(e.target.value)}
                  className="w-full pl-6 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-black text-slate-900 appearance-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {filteredUnitsList.map(u => (
                    <option key={u.serialNo} value={u.serialNo}>{u.model} — {u.serialNo}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black tracking-widest uppercase">
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
                            <h4 className="text-xl font-black text-indigo-900 tracking-tight leading-none">{toTitleCase("Inter-Activity Idle Time")}</h4>
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
                          <div className="hidden md:block" />
                          <div className="hidden md:block" />
                        </div>
                      </div>

                      <div className="lg:w-64 border-t lg:border-t-0 lg:border-l border-indigo-200 pt-6 lg:pt-0 lg:pl-8 flex flex-col gap-5">
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                          <Clock size={14} /> Timeline Overview
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-400">Idle Start</span>
                            <span className="bg-indigo-50 px-3 py-1 rounded-lg text-xs font-black mono text-indigo-900">{formatTimeDisplay(node.idleStart)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-400">Idle End</span>
                            <span className="bg-indigo-50 px-3 py-1 rounded-lg text-xs font-black mono text-indigo-900">{formatTimeDisplay(node.idleEnd)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const group = node;
            const firstShift = group.shifts[0];
            const isCompleted = group.shifts.every((s: ProductionEntry) => s.status === 'Completed');
            
            const lossReasons = [...new Set(group.shifts.map((s: ProductionEntry) => s.lossReason).filter((r: string) => r && r !== 'Standard Operation' && r !== 'Completed'))];
            const displayLossReason = lossReasons.length > 0 ? lossReasons.join(', ') : 'Standard Operation';

            return (
              <div key={group.activityName} className="relative z-10 flex gap-6 group">
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-5 h-5 rounded-full border-4 transition-all duration-300 ${
                    isCompleted ? 'bg-green-500 border-green-100' : 'bg-blue-600 border-blue-100 scale-125'
                  }`} />
                </div>

                <div className={`flex-1 bg-white border rounded-[2rem] p-6 transition-all duration-300 ${
                  isCompleted ? 'border-slate-100 shadow-sm opacity-90' : 'border-blue-200 shadow-lg ring-4 ring-blue-50'
                } hover:border-blue-200 relative overflow-hidden`}>
                  
                  {group.isParallel && (
                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black tracking-widest uppercase rounded-bl-2xl shadow-lg z-20">
                      Parallel Activity
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">DATE: {formatDate(group.date)}</span>
                        <div className="flex flex-wrap items-baseline gap-4">
                          <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none">{toTitleCase(group.activityName)}</h4>
                          <span className="text-[11px] font-bold text-slate-400 leading-none">Activity cycle: {ACTIVITY_STANDARDS[group.activityName] || firstShift.standardCycleTime} min</span>
                          {lossReasons.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-black uppercase leading-none">
                              <AlertTriangle size={12} /> LOSS REASON: {displayLossReason.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {group.shifts.map((entry: ProductionEntry, shiftIdx: number) => {
                          const shiftLabel = entry.shift === 'Shift 1' ? 'S1' : entry.shift === 'Shift 2' ? 'S2' : entry.shift === 'Shift 3' ? 'S3' : `S${shiftIdx + 1}`;
                          const showSLabel = group.shifts.length > 1;

                          return (
                            <div key={entry.id} className={`flex items-center gap-4 ${shiftIdx > 0 ? 'pt-4 border-t border-slate-50' : ''}`}>
                              {showSLabel && (
                                <div className="w-8 flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center" title={entry.shift}>
                                  {shiftLabel}
                                </div>
                              )}
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <MetricBox label="Manpower" value={`${entry.manpower} Oper`} />
                                <MetricBox label="Planned MH" value={`${((entry.standardCycleTime / 60) * entry.manpower).toFixed(1)} hrs`} />
                                <MetricBox label="Curr MH" value={`${(entry.manhoursEngaged || 0).toFixed(1)} hrs`} />
                                <MetricBox label="Efficiency" value={`${Math.round((entry.standardCycleTime / (entry.actualCycleTime || 1)) * 100)}%`} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {group.shifts.some((s: ProductionEntry) => s.notes) && (
                        <div className="bg-slate-50/80 p-4 rounded-2xl flex gap-3 border border-slate-100">
                          <FileText size={16} className="text-slate-400 mt-0.5" />
                          <div className="space-y-1">
                             {group.shifts.map((s: ProductionEntry, nIdx: number) => s.notes && (
                               <p key={nIdx} className="text-xs italic text-slate-500 leading-relaxed font-medium">
                                 {group.shifts.length > 1 && <span className="text-[9px] font-black text-slate-400 uppercase mr-2">{s.shift === 'Shift 1' ? 'S1' : s.shift === 'Shift 2' ? 'S2' : s.shift}:</span>}
                                 {s.notes}
                               </p>
                             ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="lg:w-64 border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8 flex flex-col gap-5">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <Clock size={14} /> Timeline Overview
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">Actual (Start)</span>
                          <span className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-black mono text-slate-900">{formatTimeDisplay(group.startTime)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">Actual (End)</span>
                          <span className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-black mono text-slate-900">{formatTimeDisplay(group.endTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {timelineNodes.length === 0 && (
            <div className="py-20 text-center space-y-4">
               <div className="p-6 bg-slate-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                  <Timer className="text-slate-300" size={32} />
               </div>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Awaiting Shop Floor Progression Data</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="p-2 bg-slate-50 rounded-xl text-blue-600 shadow-sm">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Activity Performance Benchmark</h3>
              <p className="text-sm text-slate-500">Standard vs. Actual cycle time (mins)</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmarkData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} angle={-35} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
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
              <p className="text-sm text-slate-500">Aggregated loss hours by production activity</p>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={bottleneckData} margin={{ left: 100, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} width={100} />
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
        return {
          label: 'text-purple-400',
          value: 'text-purple-900',
          bg: 'bg-purple-50/50',
          border: 'border-purple-100'
        };
      case 'indigo':
        return {
          label: 'text-indigo-400',
          value: 'text-indigo-900',
          bg: 'bg-indigo-50/50',
          border: 'border-indigo-100'
        };
      default:
        return {
          label: 'text-slate-400',
          value: 'text-slate-900',
          bg: 'bg-slate-50/50',
          border: 'border-slate-100'
        };
    }
  };

  const colors = getThemeClasses();

  return (
    <div className={`${colors.bg} p-4 rounded-2xl border ${colors.border} flex flex-col items-center justify-center text-center`}>
      <span className={`text-[10px] font-bold ${colors.label} mb-1 uppercase tracking-widest`}>{label}</span>
      <span className={`text-sm font-black ${colors.value}`}>{value}</span>
    </div>
  );
};

const KPICard: React.FC<{ icon: React.ReactNode; label: string; value: string; subtext: string; unit?: string }> = ({ icon, label, value, subtext, unit }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
    <div className="p-3 bg-slate-50 rounded-2xl">{icon}</div>
    <div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <div className="flex items-baseline gap-1"><h4 className="text-2xl font-bold text-slate-900">{value}</h4>{unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}</div>
      <p className="text-xs text-slate-400 mt-1">{subtext}</p>
    </div>
  </div>
);

export default Dashboard;
