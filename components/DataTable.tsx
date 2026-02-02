
import React, { useState, useMemo } from 'react';
import { Trash2, Download, Search as SearchIcon, Table as TableIcon, UserCheck, Calendar as CalendarIcon, ArrowRight, Activity as ActivityIcon, Clock } from 'lucide-react';
import { ProductionEntry } from '../types';

interface DataTableProps {
  entries: ProductionEntry[];
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

const DataTable: React.FC<DataTableProps> = ({ entries, onDelete, isAdmin }) => {
  const today = new Date().toISOString().split('T')[0];
  const [viewMode, setViewMode] = useState<'records' | 'manpower'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const SHIFT_CAPACITY_HOURS = 7.5; 

  const toTitleCase = (str: string) => {
    if (!str) return 'N/A';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTimeDisplay = (time: string | undefined | null) => {
    if (!time || time === 'N/A' || time === '—' || time.trim() === '' || time === '00:00') return '—';
    const parts = time.split(':');
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      return `${h}:${m}`;
    }
    return time;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '—') return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  };

  const getEntryDateOnly = (val: any): string => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return '—';
      return d.toISOString().split('T')[0];
    } catch {
      return '—';
    }
  };

  const flattenedRecords = useMemo(() => {
    const rows: any[] = [];
    (entries || []).forEach(entry => {
      const isGap = entry.activity === 'Inter-Activity Idle Time' || entry.isGap;
      const assignments = entry.assignments || [];
      
      if (assignments.length <= 1) {
        rows.push({
          ...entry,
          rowId: `${entry.id}-single`,
          displayDate: entry.productionDate,
          displayShift: entry.shift,
          displayManpower: entry.manpower,
          displayActual: entry.actualCycleTime,
          shiftStartTime: entry.startTime,
          shiftEndTime: entry.endTime,
          rowAffectedParameter: entry.affectedParameter,
          rowDefectCategory: entry.defectCategory,
          rowIssueDescription: entry.issueDescription,
          rowLossHours: entry.lossHours,
          rowStatus: entry.status,
          isGap
        });
      } else {
        assignments.forEach((assign, idx) => {
          rows.push({
            ...entry,
            rowId: `${entry.id}-${idx}`,
            displayDate: assign.date,
            displayShift: assign.shift,
            displayManpower: assign.operators.length,
            displayActual: assign.actualMinutes,
            shiftStartTime: assign.startTime || entry.startTime,
            shiftEndTime: assign.endTime || entry.endTime,
            rowAffectedParameter: assign.affectedParameter,
            rowDefectCategory: assign.defectCategory,
            rowIssueDescription: assign.issueDescription,
            rowLossHours: (assign.actualMinutes / (entry.actualCycleTime || 1)) * entry.lossHours,
            rowStatus: entry.status,
            isGap
          });
        });
      }
    });
    return rows;
  }, [entries]);

  const filteredFlattenedRecords = useMemo(() => {
    let result = flattenedRecords;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.stage || '').toLowerCase().includes(q) ||
        (r.productLine || '').toLowerCase().includes(q) ||
        (r.model || '').toLowerCase().includes(q) || 
        (r.serialNo || '').toLowerCase().includes(q) ||
        (r.unitSrNo || '').toLowerCase().includes(q) ||
        (r.activity || '').toLowerCase().includes(q) ||
        (r.rowAffectedParameter || '').toLowerCase().includes(q) ||
        (r.rowDefectCategory || '').toLowerCase().includes(q) ||
        (r.rowStatus || '').toLowerCase().includes(q)
      );
    }
    result = result.filter(r => r.displayDate >= startDate && r.displayDate <= endDate);
    return result.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [flattenedRecords, searchQuery, startDate, endDate]);

  const manpowerSummary = useMemo(() => {
    const registryRows: any[] = [];
    const q = searchQuery.toLowerCase();
    (entries || []).forEach(entry => {
      const assignments = entry.assignments || [];
      const effectiveAssignments = assignments.length > 0 ? assignments : [{
        date: entry.productionDate,
        shift: entry.shift === 'Multi-Shift' ? 'Shift 1' : (entry.shift as any),
        operators: entry.manpowerNames || [],
        actualMinutes: entry.actualCycleTime
      }];
      effectiveAssignments.forEach(assign => {
        if (assign.date < startDate || assign.date > endDate) return;
        (assign.operators || []).forEach(name => {
          if (q && !name.toLowerCase().includes(q)) return;
          const actualHrs = assign.actualMinutes / 60;
          const balanceHrs = Math.max(0, SHIFT_CAPACITY_HOURS - actualHrs);
          registryRows.push({
            date: assign.date,
            name: toTitleCase(name),
            shift: assign.shift,
            process: toTitleCase(entry.activity),
            completedHrs: actualHrs.toFixed(2),
            balanceHrs: balanceHrs.toFixed(2),
            lastUpdated: entry.createdAt ? new Date(entry.createdAt).getTime() : 0,
          });
        });
      });
    });
    return registryRows.sort((a, b) => b.lastUpdated - a.lastUpdated);
  }, [entries, searchQuery, startDate, endDate]);

  const handleExport = () => {
    let headers: string[] = ['Entry Date', 'Prod Date', 'Shift', 'Stage', 'Product Line', 'Model', 'Unit Sr No', 'Serial Number', 'Activity', 'Shift Start Time', 'Shift End Time', 'Status', 'Inter-Activity Loss (H)', 'Activity Loss (H)', 'Actual Mins', 'Parameter', 'Defect', 'Description'];
    let csvRows: string[] = [];
    if (viewMode === 'records') {
      csvRows = filteredFlattenedRecords.map(r => [
        formatDate(getEntryDateOnly(r.createdAt)),
        formatDate(r.displayDate),
        r.displayShift,
        toTitleCase(r.stage),
        r.productLine,
        r.model,
        r.unitSrNo,
        r.serialNo,
        toTitleCase(r.activity),
        formatTimeDisplay(r.shiftStartTime),
        formatTimeDisplay(r.shiftEndTime),
        r.rowStatus,
        r.isGap ? r.rowLossHours.toFixed(2) : '0.00',
        !r.isGap ? r.rowLossHours.toFixed(2) : '0.00',
        r.displayActual,
        r.rowAffectedParameter || 'N/A',
        r.rowDefectCategory || 'N/A',
        `"${(r.rowIssueDescription || '').replace(/"/g, '""')}"`
      ].join(','));
    } else {
      headers = ['Date', 'Operator Name', 'Shift', 'Current Process', 'Completed (H)', 'Balance (H)'];
      csvRows = manpowerSummary.map(m => [
        formatDate(m.date),
        `"${m.name}"`,
        m.shift,
        `"${m.process}"`,
        m.completedHrs,
        m.balanceHrs
      ].join(','));
    }
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `vertiv_protrack_${viewMode}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
          <button onClick={() => setViewMode('records')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'records' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon size={16} /> Production Records</button>
          <button onClick={() => setViewMode('manpower')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'manpower' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><UserCheck size={16} /> Manpower Registry</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-1 lg:max-w-4xl">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <CalendarIcon size={14} className="text-slate-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none text-[11px] font-bold cursor-pointer" />
            <ArrowRight size={14} className="text-slate-300" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none text-[11px] font-bold cursor-pointer" />
          </div>
          <div className="relative flex-1">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search database..." className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs font-medium" />
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] min-h-[450px] custom-scrollbar">
          {viewMode === 'records' ? (
            <table className="w-full text-sm table-fixed min-w-[1850px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Entry Date</th>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Prod Date</th>
                  <th className="w-20 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Shift</th>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Stage</th>
                  <th className="w-40 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Unit Details</th>
                  <th className="w-[180px] px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Activity</th>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Shift Start</th>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Shift End</th>
                  <th className="w-28 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Status</th>
                  <th className="w-36 px-2 py-4 text-right text-[10px] font-bold text-purple-600 uppercase tracking-wider bg-slate-50">Inter-Activity Loss</th>
                  <th className="w-32 px-2 py-4 text-right text-[10px] font-bold text-rose-600 uppercase tracking-wider bg-slate-50">Activity Loss</th>
                  <th className="w-20 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Actual</th>
                  <th className="w-28 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Parameter</th>
                  <th className="w-28 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Defect</th>
                  <th className="px-2 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px] bg-slate-50">Issue Description</th>
                  {isAdmin && <th className="w-12 px-2 py-4 text-right bg-slate-50"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFlattenedRecords.map(row => (
                  <tr key={row.rowId} className="hover:bg-slate-50/80 transition-colors group align-middle text-sm">
                    <td className="px-2 py-3 text-center font-mono text-[10px] text-slate-400 whitespace-nowrap">{formatDate(getEntryDateOnly(row.createdAt))}</td>
                    <td className="px-2 py-3 text-center font-mono text-[10px] text-slate-500 whitespace-nowrap">{formatDate(row.displayDate)}</td>
                    <td className="px-2 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${row.displayShift === 'Shift 2' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{row.displayShift || 'S1'}</span></td>
                    <td className="px-2 py-3 text-center"><span className="text-[10px] font-bold text-slate-600">{toTitleCase(row.stage)}</span></td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[10px] font-black text-slate-900">{row.model}</span>
                        <span className="text-[9px] text-blue-600 font-black tracking-tighter">Unit: {row.unitSrNo || '—'}</span>
                        <span className="text-[9px] text-slate-400 font-mono font-bold tracking-tighter">SN: {row.serialNo}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center"><p className={`text-[10px] font-bold leading-tight ${row.isGap ? 'text-purple-600' : 'text-slate-600'} truncate`}>{toTitleCase(row.activity)}</p></td>
                    <td className="px-2 py-3 text-center font-mono text-[10px] text-slate-900 font-bold">{formatTimeDisplay(row.shiftStartTime)}</td>
                    <td className="px-2 py-3 text-center font-mono text-[10px] text-slate-900 font-bold">{formatTimeDisplay(row.shiftEndTime)}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-black uppercase tracking-widest border ${
                        row.rowStatus === 'In Progress' 
                          ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {row.rowStatus || 'Completed'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-[11px] font-black text-purple-600">{row.isGap ? (row.rowLossHours || 0).toFixed(2) : '0.00'}</td>
                    <td className="px-2 py-3 text-right font-mono text-[11px] font-black text-rose-600">{!row.isGap ? (row.rowLossHours || 0).toFixed(2) : '0.00'}</td>
                    <td className="px-2 py-3 text-center font-mono text-[10px] font-black text-slate-900">{row.displayActual}m</td>
                    <td className="px-2 py-3 text-center"><span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${row.rowAffectedParameter ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'text-slate-300'}`}>{row.rowAffectedParameter || '—'}</span></td>
                    <td className="px-2 py-3 text-center"><span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${row.rowDefectCategory ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'text-slate-300'}`}>{row.rowDefectCategory || '—'}</span></td>
                    <td className="px-2 py-3 text-left"><p className="text-[9px] font-medium text-slate-500 line-clamp-2 italic leading-tight">{row.rowIssueDescription || '—'}</p></td>
                    {isAdmin && (
                      <td className="px-2 py-3 text-right">
                        <button onClick={() => onDelete(row.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete Record"><Trash2 size={12} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Operator Name</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Shift</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Current Process</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Completed (H)</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Balance (H)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manpowerSummary.map((m, idx) => (
                  <tr key={`${m.name}-${m.date}-${m.shift}-${idx}`} className="hover:bg-slate-50/80 transition-colors group align-middle text-[12px]">
                    <td className="px-6 py-3 font-mono text-[10px] text-slate-500">{formatDate(m.date)}</td>
                    <td className="px-6 py-3"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[9px] border border-slate-200 uppercase">{(m.name || 'U').charAt(0).toUpperCase()}</div><span className="font-bold text-slate-900">{m.name}</span></div></td>
                    <td className="px-6 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${m.shift === 'Shift 2' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{m.shift || 'S1'}</span></td>
                    <td className="px-6 py-3"><div className="flex items-center gap-2"><ActivityIcon size={12} className="text-blue-500" /><span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">{m.process}</span></div></td>
                    <td className="px-6 py-3 text-center font-mono font-bold text-slate-900 text-xs">{m.completedHrs}</td>
                    <td className="px-6 py-3 text-center"><span className={`font-mono font-bold text-xs ${Number(m.balanceHrs) === 0 ? 'text-slate-300' : 'text-emerald-600'}`}>{m.balanceHrs}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <footer className="text-center py-6 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          Live monitoring powered by Supabase Cloud Engine
        </p>
      </footer>
    </div>
  );
};

export default DataTable;
