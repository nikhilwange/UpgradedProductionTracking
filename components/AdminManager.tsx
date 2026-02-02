
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Edit2, Trash2, Search, Filter, Calendar, User, Save, X, AlertTriangle, Clock, MapPin, Hash, Package, Users, DatabaseZap, Loader2, Plus, Minus, Layout, Layers, Tag, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ProductionEntry, ShiftAssignment } from '../types';
import { STAGES_LIST, STAGE_MAPPING, ACTIVITY_STANDARDS, MODELS_LIST, PRODUCT_LINES_LIST, BREAK_TIMES, OPERATORS_BY_MODEL_LINE } from '../constants';
import { supabase } from '../supabase';

interface AdminManagerProps {
  entries: ProductionEntry[];
  onUpdate: (entry: ProductionEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  isAdmin: boolean;
}

const AdminManager: React.FC<AdminManagerProps> = ({ entries, onUpdate, onDelete, onClear, isAdmin }) => {
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [isClearing, setIsClearing] = useState(false);

  const toMins = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const formatTimeInput = (time: string | undefined) => {
    if (!time) return '00:00';
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return '00:00';
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
        <ShieldAlert size={48} className="text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Unauthorized Access</h3>
        <p className="text-slate-500 text-center max-w-sm mt-2">Administrative credentials are required to view the management console.</p>
      </div>
    );
  }

  const filteredEntries = useMemo(() => {
    let result = [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        (e.serialNo || '').toLowerCase().includes(q) || 
        (e.unitSrNo || '').toLowerCase().includes(q) || 
        (e.model || '').toLowerCase().includes(q) || 
        (e.activity || '').toLowerCase().includes(q)
      );
    }
    if (filterUser !== 'all') result = result.filter(e => e.userEmail === filterUser);
    return result;
  }, [entries, searchQuery, filterUser]);

  const uniqueUsers = useMemo(() => Array.from(new Set(entries.map(e => e.userEmail).filter(Boolean))), [entries]);

  const handleEditClick = (entry: ProductionEntry) => {
    setEditingEntry({ 
      ...entry,
      startTime: formatTimeInput(entry.startTime),
      endTime: formatTimeInput(entry.endTime),
      assignments: entry.assignments ? JSON.parse(JSON.stringify(entry.assignments)) : []
    });
  };

  const getRecalculatedGap = (newStartTime: string) => {
    if (!editingEntry) return 0;
    const prev = entries
      .filter(e => e.serialNo === editingEntry.serialNo && Date.parse(e.createdAt) < Date.parse(editingEntry.createdAt) && e.activity !== "Inter-Activity Idle Time")
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    
    if (prev) {
      const prevDate = prev.endDate || prev.productionDate;
      const currDate = editingEntry.productionDate;
      const prevEndStr = `${prevDate}T${prev.endTime}`;
      const currStartStr = `${currDate}T${newStartTime}`;
      const diff = (new Date(currStartStr).getTime() - new Date(prevEndStr).getTime()) / 60000;
      return diff > 0 ? Number((diff / 60).toFixed(2)) : 0;
    }
    return 0;
  };

  const handleTimeFieldChange = (field: 'startTime' | 'endTime', value: string) => {
    if (!editingEntry) return;
    
    const formattedValue = formatTimeInput(value);
    const updatedEntry = { ...editingEntry, [field]: formattedValue };
    
    let newAssignments = [...updatedEntry.assignments];
    if (newAssignments.length === 1) {
      const startMins = toMins(updatedEntry.startTime);
      const endMins = toMins(updatedEntry.endTime);
      let totalMins = endMins - startMins;
      if (totalMins < 0) totalMins += 1440; 
      newAssignments[0] = { ...newAssignments[0], actualMinutes: totalMins };
    }

    const totalActual = newAssignments.reduce((sum, a) => sum + (Number(a.actualMinutes) || 0), 0);
    const totalMH = newAssignments.reduce((sum, a) => sum + ((Number(a.actualMinutes) || 0) / 60) * (a.operators.length || 0), 0);
    const standardTime = ACTIVITY_STANDARDS[updatedEntry.activity] || updatedEntry.standardCycleTime;
    const variance = totalActual - standardTime;
    
    let loss = 0;
    if (variance > 0) {
      newAssignments.forEach(a => {
        const ratio = totalActual > 0 ? (a.actualMinutes || 0) / totalActual : 0;
        loss += ((variance * ratio) / 60) * Math.max(1, a.operators.length);
      });
    }

    setEditingEntry({
      ...updatedEntry,
      assignments: newAssignments,
      actualCycleTime: totalActual,
      manhoursEngaged: totalMH,
      variance: variance,
      lossHours: Number(loss.toFixed(2))
    });
  };

  const handleUpdateAssignment = (index: number, field: keyof ShiftAssignment, value: any) => {
    if (!editingEntry) return;
    const newAssignments = [...editingEntry.assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    
    const totalActual = newAssignments.reduce((sum, a) => sum + (Number(a.actualMinutes) || 0), 0);
    const totalMH = newAssignments.reduce((sum, a) => sum + ((Number(a.actualMinutes) || 0) / 60) * (a.operators.length || 0), 0);
    const standardTime = ACTIVITY_STANDARDS[editingEntry.activity] || editingEntry.standardCycleTime;
    const variance = totalActual - standardTime;
    
    let loss = 0;
    if (variance > 0) {
      newAssignments.forEach(a => {
        const ratio = totalActual > 0 ? (a.actualMinutes || 0) / totalActual : 0;
        loss += ((variance * ratio) / 60) * Math.max(1, a.operators.length);
      });
    }

    setEditingEntry({
      ...editingEntry,
      assignments: newAssignments,
      actualCycleTime: totalActual,
      manhoursEngaged: totalMH,
      variance: variance,
      lossHours: Number(loss.toFixed(2))
    });
  };

  const addAssignment = () => {
    if (!editingEntry) return;
    const lastAssign = editingEntry.assignments[editingEntry.assignments.length - 1];
    const newAssign: ShiftAssignment = {
      date: lastAssign?.date || new Date().toISOString().split('T')[0],
      shift: 'Shift 1',
      operators: [],
      actualMinutes: 0
    };
    setEditingEntry({
      ...editingEntry,
      assignments: [...editingEntry.assignments, newAssign]
    });
  };

  const removeAssignment = (index: number) => {
    if (!editingEntry || editingEntry.assignments.length <= 1) return;
    const newAssignments = editingEntry.assignments.filter((_, i) => i !== index);
    
    const totalActual = newAssignments.reduce((sum, a) => sum + (Number(a.actualMinutes) || 0), 0);
    const totalMH = newAssignments.reduce((sum, a) => sum + ((Number(a.actualMinutes) || 0) / 60) * (a.operators.length || 0), 0);
    const standardTime = ACTIVITY_STANDARDS[editingEntry.activity] || editingEntry.standardCycleTime;
    const variance = totalActual - standardTime;
    
    let loss = 0;
    if (variance > 0) {
      newAssignments.forEach(a => {
        const ratio = totalActual > 0 ? (a.actualMinutes || 0) / totalActual : 0;
        loss += ((variance * ratio) / 60) * Math.max(1, a.operators.length);
      });
    }

    setEditingEntry({
      ...editingEntry,
      assignments: newAssignments,
      actualCycleTime: totalActual,
      manhoursEngaged: totalMH,
      variance: variance,
      lossHours: Number(loss.toFixed(2))
    });
  };

  const handleSave = () => {
    if (!editingEntry) return;
    const allOps = [...new Set(editingEntry.assignments.flatMap(a => a.operators))];
    const maxManpower = Math.max(...editingEntry.assignments.map(a => a.operators.length));
    
    onUpdate({ 
      ...editingEntry, 
      manpowerNames: allOps,
      manpower: maxManpower
    });
    setEditingEntry(null);
  };

  const handleClearDatabase = async () => {
    if (!confirm("Are you absolutely sure you want to CLEAR THE ENTIRE DATABASE? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      const { error } = await supabase.from('production_entries').delete().neq('id', '0');
      if (error) throw error;
      onClear();
      alert("Database cleared successfully.");
    } catch (err: any) {
      alert("Failed to clear database: " + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const availableOperators = useMemo(() => {
    if (!editingEntry) return [];
    return OPERATORS_BY_MODEL_LINE[editingEntry.productLine] || OPERATORS_BY_MODEL_LINE[editingEntry.model] || [];
  }, [editingEntry?.productLine, editingEntry?.model]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search Serial No / Unit Sr No / Model..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-medium transition-all" /></div>
        <div className="relative flex-1"><User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-medium transition-all appearance-none"><option value="all">All Operators</option>{uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
        <button onClick={handleClearDatabase} disabled={isClearing} className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-rose-100 transition-all shadow-sm disabled:opacity-50">
          {isClearing ? <Loader2 size={14} className="animate-spin" /> : <DatabaseZap size={14} />} Clear Database
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[0.1em]">Timestamp / User</th>
                <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[0.1em]">Unit Identification</th>
                <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[0.1em]">Process Activity</th>
                <th className="px-6 py-4 text-center text-[10px] uppercase tracking-[0.1em]">Total Time</th>
                <th className="px-6 py-4 text-center text-[10px] uppercase tracking-[0.1em]">Variance</th>
                <th className="px-6 py-4 text-right text-[10px] uppercase tracking-[0.1em]">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{new Date(entry.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[150px] font-medium">{entry.userEmail || 'System'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5"><span className="font-bold text-slate-900">{entry.serialNo}</span><span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold uppercase">{entry.model}</span></div>
                      <span className="text-[10px] text-blue-500 font-black">Unit: {entry.unitSrNo || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4"><p className="text-sm font-semibold text-slate-700">{entry.activity}</p><p className="text-[10px] text-slate-400 font-medium uppercase">{entry.stage}</p></td>
                  <td className="px-6 py-4 text-center font-mono text-xs"><span className="bg-slate-100 px-3 py-1.5 rounded-lg text-slate-900 font-bold">{entry.actualCycleTime} min</span></td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${entry.variance > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{entry.variance > 0 ? `+${entry.variance}` : entry.variance}m</span></td>
                  <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handleEditClick(entry)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Record"><Edit2 size={16} /></button><button onClick={() => onDelete(entry.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Record"><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingEntry && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col h-[90vh]">
            <div className="bg-slate-900 p-8 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20"><Edit2 size={24} /></div>
                <div>
                  <h3 className="font-black text-xl tracking-tight leading-tight">Modify Production Record</h3>
                  <p className="text-xs text-slate-400 font-medium tracking-wide">Enterprise Tracking Terminal v2.0</p>
                </div>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-widest"><Hash size={14} /> Production Context</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Serial Number</label>
                    <input type="text" value={editingEntry.serialNo} onChange={(e) => setEditingEntry({...editingEntry, serialNo: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Unit Sr. No.</label>
                    <input type="text" value={editingEntry.unitSrNo} onChange={(e) => setEditingEntry({...editingEntry, unitSrNo: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Unit Model</label>
                    <select value={editingEntry.model} onChange={(e) => setEditingEntry({...editingEntry, model: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-sm">
                      {MODELS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Line</label>
                    <select value={editingEntry.productLine} onChange={(e) => setEditingEntry({...editingEntry, productLine: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-sm">
                      {PRODUCT_LINES_LIST.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                   <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Modified Start Time</label>
                      <span className="text-[9px] font-black text-purple-500 uppercase">Gap: {getRecalculatedGap(editingEntry.startTime)}H</span>
                    </div>
                    <div className="relative">
                      <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="time" 
                        value={formatTimeInput(editingEntry.startTime)} 
                        onChange={(e) => handleTimeFieldChange('startTime', e.target.value)} 
                        className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold shadow-sm" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Modified End Time</label>
                    <div className="relative">
                      <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="time" 
                        value={formatTimeInput(editingEntry.endTime)} 
                        onChange={(e) => handleTimeFieldChange('endTime', e.target.value)} 
                        className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold shadow-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                   <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Production Stage</label>
                    <select value={editingEntry.stage} onChange={(e) => {
                      const nextStage = e.target.value;
                      setEditingEntry({...editingEntry, stage: nextStage, activity: STAGE_MAPPING[nextStage][0]});
                    }} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-sm">
                      {STAGES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Production Activity</label>
                    <select value={editingEntry.activity} onChange={(e) => setEditingEntry({...editingEntry, activity: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-sm">
                      {(STAGE_MAPPING[editingEntry.stage] || []).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 text-amber-600 font-black text-xs uppercase tracking-widest"><Clock size={14} /> Dynamic Shift Assignments</div>
                  <button onClick={addAssignment} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all border border-blue-100"><Plus size={14} /> Add Shift</button>
                </div>

                <div className="space-y-4">
                  {editingEntry.assignments.map((assign, idx) => (
                    <div key={idx} className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 shadow-sm group hover:border-blue-200 transition-all">
                      <div className="flex flex-col xl:flex-row gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:w-1/2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                            <input type="date" value={assign.date} onChange={(e) => handleUpdateAssignment(idx, 'date', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift</label>
                            <select value={assign.shift} onChange={(e) => handleUpdateAssignment(idx, 'shift', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm">
                              <option value="Shift 1">Shift 1</option>
                              <option value="Shift 2">Shift 2</option>
                              <option value="Shift 3">Shift 3</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Credited Mins</label>
                            <input type="number" value={assign.actualMinutes} onChange={(e) => handleUpdateAssignment(idx, 'actualMinutes', Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm" />
                          </div>
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operators Assigned</label>
                            <span className="text-[10px] font-black text-blue-600">Count: {assign.operators.length}</span>
                          </div>
                          <OperatorMultiSelect 
                            options={availableOperators}
                            selected={assign.operators}
                            onChange={(selected) => handleUpdateAssignment(idx, 'operators', selected)}
                          />
                        </div>

                        <div className="flex items-end pb-1 justify-center xl:justify-end">
                           <button onClick={() => removeAssignment(idx)} className="p-3 text-slate-300 hover:text-rose-600 bg-white border border-slate-100 rounded-xl hover:bg-rose-50 transition-all shadow-sm"><Minus size={18} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 rounded-3xl p-6 text-white">
                 <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Duration</p>
                    <p className="text-lg font-black text-white">{editingEntry.actualCycleTime} min</p>
                 </div>
                 <div className="text-center border-l border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Variance</p>
                    <p className={`text-lg font-black ${editingEntry.variance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{editingEntry.variance > 0 ? `+${editingEntry.variance}` : editingEntry.variance} min</p>
                 </div>
                 <div className="text-center border-l border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Manhours Engaged</p>
                    <p className="text-lg font-black text-blue-400">{editingEntry.manhoursEngaged.toFixed(2)} hrs</p>
                 </div>
                 <div className="text-center border-l border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Activity Loss (Shift)</p>
                    <p className={`text-lg font-black ${editingEntry.lossHours > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{editingEntry.lossHours} hrs</p>
                 </div>
              </section>

              <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                <AlertTriangle size={24} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-black text-blue-900 leading-tight mb-1">System Audit Notice</h5>
                  <p className="text-[11px] text-blue-700/80 font-bold leading-relaxed">
                    Modifying start/end times or shift assignments triggers an automatic re-evaluation of production metrics. 
                    Inter-Activity Loss is recalculated based on the previous logged activity for Serial No {editingEntry.serialNo}.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4 shrink-0">
              <button onClick={() => setEditingEntry(null)} className="px-8 py-3.5 text-sm font-black text-slate-500 hover:bg-slate-200 rounded-2xl transition-all uppercase tracking-widest">Discard Changes</button>
              <button onClick={handleSave} className="px-10 py-3.5 bg-blue-600 text-white text-sm font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center gap-3 uppercase tracking-widest active:scale-[0.98]"><Save size={20} /> Apply Cloud Updates</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OperatorMultiSelect: React.FC<{ options: string[]; selected: string[]; onChange: (selected: string[]) => void; }> = ({ options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()) && !selected.includes(opt));
  
  const addSelected = (name: string) => { 
    if (!name.trim()) return;
    onChange([...selected, name.trim()]); 
    setSearch(''); 
  };

  const removeSelected = (name: string) => onChange(selected.filter(s => s !== name));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      if (!selected.includes(search.trim())) {
        addSelected(search.trim());
      } else {
        setSearch('');
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="min-h-[40px] w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl cursor-pointer flex flex-wrap gap-1.5 items-center shadow-sm">
        {selected.length === 0 && !search && <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-2">Select or type operators...</span>}
        {selected.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg border border-blue-100">
            {s}
            <X size={12} className="cursor-pointer hover:text-blue-900" onClick={(e) => { e.stopPropagation(); removeSelected(s); }} />
          </span>
        ))}
        <input 
          type="text" 
          value={search} 
          onKeyDown={handleKeyDown}
          onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }} 
          className="flex-1 min-w-[60px] bg-transparent outline-none text-[11px] font-bold" 
          onClick={(e) => e.stopPropagation()} 
        />
      </div>
      {isOpen && (
        <div className="absolute z-[300] w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200 p-2">
          {search && !filteredOptions.some(o => o.toLowerCase() === search.toLowerCase()) && (
            <div 
              onClick={() => addSelected(search)} 
              className="px-4 py-3 text-[11px] font-black text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-none uppercase tracking-wide italic"
            >
              Add "{search}" manually (Press Enter)
            </div>
          )}
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <div key={opt} onClick={() => addSelected(opt)} className="px-4 py-3 text-[11px] font-black text-slate-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors border-b border-slate-50 last:border-none uppercase tracking-wide">
                {opt}
              </div>
            ))
          ) : !search && (
            <div className="px-4 py-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest italic text-center">No available matching resources</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminManager;
