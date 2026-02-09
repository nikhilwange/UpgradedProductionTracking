import React, { useState, useMemo } from 'react';
import { Trash2, Download, Search as SearchIcon, Table as TableIcon, UserCheck, Calendar as CalendarIcon, ArrowRight, Activity as ActivityIcon, Clock, Filter, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ProductionEntry } from '../types';

interface DataTableProps {
  entries: ProductionEntry[];
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

interface ColumnFilters {
  plant: string;
  stage: string;
  model: string;
  serialNo: string;
  activity: string;
  status: string;
  parameter: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

const DataTable: React.FC<DataTableProps> = ({ entries, onDelete, isAdmin }) => {
  const today = new Date().toISOString().split('T')[0];
  const [viewMode, setViewMode] = useState<'records' | 'manpower'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    plant: '',
    stage: '',
    model: '',
    serialNo: '',
    activity: '',
    status: '',
    parameter: ''
  });

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

  const filterOptions = useMemo(() => {
    const options = {
      plant: new Set<string>(),
      stage: new Set<string>(),
      status: new Set<string>(),
      parameter: new Set<string>(),
    };
    flattenedRecords.forEach(r => {
      if (r.plant) options.plant.add(r.plant);
      if (r.stage) options.stage.add(r.stage);
      if (r.rowStatus) options.status.add(r.rowStatus);
      if (r.rowAffectedParameter) options.parameter.add(r.rowAffectedParameter);
    });
    return {
      plant: Array.from(options.plant).sort(),
      stage: Array.from(options.stage).sort(),
      status: Array.from(options.status).sort(),
      parameter: Array.from(options.parameter).sort(),
    };
  }, [flattenedRecords]);

  const filteredFlattenedRecords = useMemo(() => {
    let result = flattenedRecords;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.plant || '').toLowerCase().includes(q) ||
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

    if (columnFilters.plant) result = result.filter(r => r.plant === columnFilters.plant);
    if (columnFilters.stage) result = result.filter(r => r.stage === columnFilters.stage);
    if (columnFilters.model) result = result.filter(r => (r.model || '').toLowerCase().includes(columnFilters.model.toLowerCase()));
    if (columnFilters.serialNo) result = result.filter(r => (r.serialNo || '').toLowerCase().includes(columnFilters.serialNo.toLowerCase()));
    if (columnFilters.activity) result = result.filter(r => (r.activity || '').toLowerCase().includes(columnFilters.activity.toLowerCase()));
    if (columnFilters.status) result = result.filter(r => r.rowStatus === columnFilters.status);
    if (columnFilters.parameter) result = result.filter(r => r.rowAffectedParameter === columnFilters.parameter);

    result = result.filter(r => r.displayDate >= startDate && r.displayDate <= endDate);

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // Handle string-based numbers and other types
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      result = [...result].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return result;
  }, [flattenedRecords, searchQuery, columnFilters, startDate, endDate, sortConfig]);

  const handleColumnFilterChange = (column: keyof ColumnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={10} className="text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-blue-600" /> : <ArrowDown size={10} className="text-blue-600" />;
  };

  const clearFilters = () => {
    setColumnFilters({
      plant: '',
      stage: '',
      model: '',
      serialNo: '',
      activity: '',
      status: '',
      parameter: ''
    });
    setSearchQuery('');
    setSortConfig(null);
  };

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
    let headers: string[] = ['Plant', 'Entry Date', 'Prod Date', 'Shift', 'Stage', 'Product Line', 'Model', 'Unit Sr No', 'Serial Number', 'Activity', 'Shift Start Time', 'Shift End Time', 'Status', 'Inter-Activity Loss (H)', 'Activity Loss (H)', 'Actual Mins', 'Parameter', 'Defect', 'Description'];
    let csvRows: string[] = [];
    if (viewMode === 'records') {
      csvRows = filteredFlattenedRecords.map(r => [
        r.plant || 'CHAKAN',
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

  const hasActiveFilters = Object.values(columnFilters).some(v => v !== '') || searchQuery !== '' || sortConfig !== null;

  const SelectFilter: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder: string;
  }> = ({ value, onChange, options, placeholder }) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[9px] font-black px-2 py-1 pr-6 border border-slate-200 rounded bg-white/50 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer uppercase tracking-tighter"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown size={8} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
          <button onClick={() => setViewMode('records')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'records' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon size={16} /> Production Records</button>
          <button onClick={() => setViewMode('manpower')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'manpower' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><UserCheck size={16} /> Manpower Registry</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-1 lg:max-w-4xl">
          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-100 hover:bg-rose-100 transition-all"
            >
              <X size={14} /> Reset View
            </button>
          )}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <CalendarIcon size={14} className="text-slate-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none text-[11px] font-bold cursor-pointer" />
            <ArrowRight size={14} className="text-slate-300" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none text-[11px] font-bold cursor-pointer" />
          </div>
          <div className="relative flex-1">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Global database search..." className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs font-medium" />
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] min-h-[450px] custom-scrollbar">
          {viewMode === 'records' ? (
            <table className="w-full text-sm table-fixed min-w-[1950px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="w-24 px-2 py-4 text-center bg-slate-50">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => requestSort('plant')} className="flex items-center justify-center gap-1 group">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Plant</span>
                        {getSortIcon('plant')}
                      </button>
                      <SelectFilter 
                        value={columnFilters.plant}
                        onChange={(val) => handleColumnFilterChange('plant', val)}
                        options={filterOptions.plant}
                        placeholder="ALL"
                      />
                    </div>
                  </th>
                  <th className="w-24 px-2 py-4 text-center bg-slate-50">
                    <button onClick={() => requestSort('createdAt')} className="flex items-center justify-center gap-1 group mx-auto">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Entry Date</span>
                      {getSortIcon('createdAt')}
                    </button>
                  </th>
                  <th className="w-24 px-2 py-4 text-center bg-slate-50">
                    <button onClick={() => requestSort('displayDate')} className="flex items-center justify-center gap-1 group mx-auto">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Prod Date</span>
                      {getSortIcon('displayDate')}
                    </button>
                  </th>
                  <th className="w-20 px-2 py-4 text-center bg-slate-50">
                    <button onClick={() => requestSort('displayShift')} className="flex items-center justify-center gap-1 group mx-auto">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Shift</span>
                      {getSortIcon('displayShift')}
                    </button>
                  </th>
                  <th className="w-24 px-2 py-4 text-center bg-slate-50">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => requestSort('stage')} className="flex items-center justify-center gap-1 group mx-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Stage</span>
                        {getSortIcon('stage')}
                      </button>
                      <SelectFilter 
                        value={columnFilters.stage}
                        onChange={(val) => handleColumnFilterChange('stage', val)}
                        options={filterOptions.stage}
                        placeholder="ALL"
                      />
                    </div>
                  </th>
                  <th className="w-40 px-2 py-4 text-center bg-slate-50">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => requestSort('model')} className="flex items-center justify-center gap-1 group mx-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Unit Details</span>
                        {getSortIcon('model')}
                      </button>
                      <div className="grid grid-cols-2 gap-1">
                        <input 
                          type="text" 
                          value={columnFilters.model}
                          onChange={(e) => handleColumnFilterChange('model', e.target.value)}
                          placeholder="Mdl"
                          className="w-full text-[9px] font-bold px-1 py-1 border border-slate-200 rounded bg-white/50 outline-none focus:border-blue-500"
                        />
                        <input 
                          type="text" 
                          value={columnFilters.serialNo}
                          onChange={(e) => handleColumnFilterChange('serialNo', e.target.value)}
                          placeholder="SN"
                          className="w-full text-[9px] font-bold px-1 py-1 border border-slate-200 rounded bg-white/50 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </th>
                  <th className="w-[180px] px-2 py-4 text-center bg-slate-50">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => requestSort('activity')} className="flex items-center justify-center gap-1 group mx-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Activity</span>
                        {getSortIcon('activity')}
                      </button>
                      <input 
                        type="text" 
                        value={columnFilters.activity}
                        onChange={(e) => handleColumnFilterChange('activity', e.target.value)}
                        placeholder="Filter activity..."
                        className="w-full text-[9px] font-bold px-2 py-1 border border-slate-200 rounded bg-white/50 outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </th>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Shift Start</th>
                  <th className="w-24 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Shift End</th>
                  <th className="w-28 px-2 py-4 text-center bg-slate-50">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => requestSort('rowStatus')} className="flex items-center justify-center gap-1 group mx-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Status</span>
                        {getSortIcon('rowStatus')}
                      </button>
                      <SelectFilter 
                        value={columnFilters.status}
                        onChange={(val) => handleColumnFilterChange('status', val)}
                        options={filterOptions.status}
                        placeholder="ALL"
                      />
                    </div>
                  </th>
                  <th className="w-36 px-2 py-4 text-right bg-slate-50">
                    <button onClick={() => requestSort('rowLossHours')} className="flex items-center justify-end gap-1 group ml-auto">
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Inter-Activity Loss</span>
                      {getSortIcon('rowLossHours')}
                    </button>
                  </th>
                  <th className="w-32 px-2 py-4 text-right bg-slate-50">
                    <button onClick={() => requestSort('rowLossHours')} className="flex items-center justify-end gap-1 group ml-auto">
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Activity Loss</span>
                      {getSortIcon('rowLossHours')}
                    </button>
                  </th>
                  <th className="w-20 px-2 py-4 text-center bg-slate-50">
                    <button onClick={() => requestSort('displayActual')} className="flex items-center justify-center gap-1 group mx-auto">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Actual</span>
                      {getSortIcon('displayActual')}
                    </button>
                  </th>
                  <th className="w-28 px-2 py-4 text-center bg-slate-50">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Parameter</span>
                      <SelectFilter 
                        value={columnFilters.parameter}
                        onChange={(val) => handleColumnFilterChange('parameter', val)}
                        options={filterOptions.parameter}
                        placeholder="ALL"
                      />
                    </div>
                  </th>
                  <th className="w-28 px-2 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Defect</th>
                  <th className="px-2 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px] bg-slate-50">Issue Description</th>
                  {isAdmin && <th className="w-12 px-2 py-4 text-right bg-slate-50"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFlattenedRecords.map(row => (
                  <tr key={row.rowId} className="hover:bg-slate-50/80 transition-colors group align-middle text-sm">
                    <td className="px-2 py-3 text-center"><span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest bg-slate-100 text-slate-500 border border-slate-200">{row.plant || 'CHAKAN'}</span></td>
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