
import React, { useMemo, useState } from 'react';
import { User, Clock, Activity, Calendar, Zap, Layers, ArrowRight } from 'lucide-react';
import { ProductionEntry } from '../types';

interface ManpowerSummaryProps {
  entries: ProductionEntry[];
}

interface PersonalStats {
  name: string;
  shift: string;
  totalActualMins: number;    
  totalActivities: number;
  currentStage: string;
  currentActivity: string;
  currentSN: string;
  lastUpdated: number;
  dates: Set<string>;
}

const ManpowerSummary: React.FC<ManpowerSummaryProps> = ({ entries }) => {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const manpowerStats = useMemo(() => {
    const statsMap: Record<string, PersonalStats> = {};
    const filteredEntries = (entries || []).filter(e => {
        const entryStart = e.productionDate;
        const entryEnd = e.endDate || e.productionDate;
        return entryStart <= endDate && entryEnd >= startDate;
    });
    
    filteredEntries.forEach(entry => {
      const assignments = entry.assignments || [];
      assignments.forEach(assign => {
        if (assign.date < startDate || assign.date > endDate) return;

        (assign.operators || []).forEach(name => {
          const key = `${name}-${assign.shift}`;
          if (!statsMap[key]) {
            statsMap[key] = { 
              name, 
              shift: assign.shift, 
              totalActualMins: 0, 
              totalActivities: 0, 
              currentStage: '', 
              currentActivity: '', 
              currentSN: '', 
              lastUpdated: 0, 
              dates: new Set<string>() 
            };
          }
          statsMap[key].totalActualMins += (assign.actualMinutes || 0);
          statsMap[key].totalActivities += 1;
          statsMap[key].dates.add(assign.date);
          
          // Fixed: Convert string createdAt to numeric ms for comparison and storage
          const entryTime = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
          if (entryTime >= statsMap[key].lastUpdated) {
            statsMap[key].currentStage = entry.stage;
            statsMap[key].currentActivity = entry.activity;
            statsMap[key].currentSN = entry.serialNo;
            statsMap[key].lastUpdated = entryTime;
          }
        });
      });

      if (assignments.length === 0) {
        (entry.manpowerNames || []).forEach(name => {
          if (entry.productionDate < startDate || entry.productionDate > endDate) return;
          const key = `${name}-${entry.shift}`;
          if (!statsMap[key]) {
            statsMap[key] = { 
              name, 
              shift: entry.shift, 
              totalActualMins: 0, 
              totalActivities: 0, 
              currentStage: '', 
              currentActivity: '', 
              currentSN: '', 
              lastUpdated: 0, 
              dates: new Set<string>() 
            };
          }
          statsMap[key].totalActualMins += (entry.actualCycleTime || 0);
          statsMap[key].totalActivities += 1;
          statsMap[key].dates.add(entry.productionDate);
          
          // Fixed: Convert string createdAt to numeric ms for comparison and storage
          const entryTime = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
          if (entryTime >= statsMap[key].lastUpdated) {
            statsMap[key].currentStage = entry.stage;
            statsMap[key].currentActivity = entry.activity;
            statsMap[key].currentSN = entry.serialNo;
            statsMap[key].lastUpdated = entryTime;
          }
        });
      }
    });
    return Object.values(statsMap).sort((a, b) => b.totalActualMins - a.totalActualMins);
  }, [entries, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div><h3 className="font-bold text-lg text-slate-900">Resource Monitoring</h3><p className="text-sm text-slate-500">Universal Splitter attribution</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold" />
          <ArrowRight size={16} className="text-slate-300 hidden sm:block" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold" />
        </div>
      </div>
      {manpowerStats.length === 0 ? (
        <div className="py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-center"><User size={48} className="text-slate-200 mx-auto mb-4" /><h3 className="text-xl font-bold text-slate-800">Awaiting Log Data</h3></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {manpowerStats.map((person) => (
            <div key={`${person.name}-${person.shift}`} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-400 transition-all">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white">{(person.name || 'U').charAt(0).toUpperCase()}</div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{person.name}</h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded uppercase">{person.shift}</span>
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase">{person.dates.size} Days Active</p>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <StatMini icon={<Clock size={14} />} label="Total Hours" value={`${(person.totalActualMins/60).toFixed(1)}h`} color="text-slate-900" />
                <StatMini icon={<Activity size={14} />} label="Logs" value={person.totalActivities} color="text-slate-900" />
                <StatMini icon={<Layers size={14} />} label="Current" value={person.currentActivity || 'N/A'} color="text-slate-500 truncate" />
                <StatMini icon={<Zap size={14} />} label="Unit" value={person.currentSN || 'N/A'} color="text-emerald-600" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatMini: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (<div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100"><div className="flex items-center gap-2 text-slate-400 mb-1">{icon}<span className="text-[10px] font-bold tracking-wider uppercase">{label}</span></div><div className={`text-xs font-bold ${color}`}>{value}</div></div>);

export default ManpowerSummary;
