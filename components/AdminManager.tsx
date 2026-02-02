
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Edit2, Trash2, Search, Filter, Calendar, User, Save, X, AlertTriangle, Clock, MapPin, Hash, Package, Users, DatabaseZap, Loader2, Plus, Minus, Layout, Layers, Tag, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ProductionEntry, ShiftAssignment } from '../types';
import { PLANT_REGISTRY, getModelContext, MODELS_LIST, PRODUCT_LINES_LIST, OPERATORS_BY_MODEL_LINE, ACTIVITY_STANDARDS } from '../constants';
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
    return parts.length >= 2 ? `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}` : '00:00';
  };

  const filteredEntries = useMemo(() => {
    let result = [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        (e.serialNo || '').toLowerCase().includes(q) || 
        (e.unitSrNo || '').toLowerCase().includes(q) || 
        (e.model || '').toLowerCase().includes(q) || 
        (e.activity || '').toLowerCase().includes(q) ||
        (e.plant || '').toLowerCase().includes(q)
      );
    }
    if (filterUser !== 'all') result = result.filter(e => e.userEmail === filterUser);
    return result;
  }, [entries, searchQuery, filterUser]);

  const uniqueUsers = useMemo(() => Array.from(new Set(entries.map(e => e.userEmail).filter(Boolean))), [entries]);

  // Derive contextual options for the edit modal based on current selection
  const editingContext = useMemo(() => {
    if (!editingEntry) return null;
    return getModelContext(editingEntry.serialNo, editingEntry.model);
  }, [editingEntry?.serialNo, editingEntry?.model]);

  const handleEditClick = (entry: ProductionEntry) => {
    setEditingEntry({ 
      ...entry,
      startTime: formatTimeInput(entry.startTime),
      endTime: formatTimeInput(entry.endTime),
      assignments: entry.assignments ? JSON.parse(JSON.stringify(entry.assignments)) : []
    });
  };

  const handleSave = () => {
    if (!editingEntry) return;
    const allOps = [...new Set(editingEntry.assignments.flatMap(a => a.operators))];
    const maxManpower = Math.max(...editingEntry.assignments.map(a => a.operators.length), 0);
    onUpdate({ ...editingEntry, manpowerNames: allOps, manpower: maxManpower });
    setEditingEntry(null);
  };

  const handleTimeFieldChange = (field: 'startTime' | 'endTime', value: string) => {
    if (!editingEntry) return;
    const val = formatTimeInput(value);
    const updated = { ...editingEntry, [field]: val };
    
    // Recalculate if single assignment
    if (updated.assignments.length === 1) {
      let mins = toMins(updated.endTime) - toMins(updated.startTime);
      if (mins < 0) mins += 1440;
      updated.assignments[0].actualMinutes = mins;
    }
    
    const totalActual = updated.assignments.reduce((s, a) => s + (a.actualMinutes || 0), 0);
    const std = (editingContext?.standards[updated.activity] || updated.standardCycleTime || 0);
    
    setEditingEntry({
      ...updated,
      actualCycleTime: totalActual,
      variance: totalActual - std
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search Plant / SN / Model..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
        </div>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium">
          <option value="all">All Operators</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button onClick={() => { if(confirm("Clear database?")) onClear(); }} className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
          <DatabaseZap size={14} /> Clear System
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] uppercase">Facility</th>
                <th className="px-6 py-4 text-left text-[10px] uppercase">Unit ID</th>
                <th className="px-6 py-4 text-left text-[10px] uppercase">Activity</th>
                <th className="px-6 py-4 text-center text-[10px] uppercase">Duration</th>
                <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black tracking-widest border border-slate-200">{entry.plant || 'CHAKAN'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col"><span className="font-bold text-slate-900">{entry.serialNo}</span><span className="text-[10px] text-blue-500 font-black">{entry.model}</span></div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{entry.activity}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs font-bold">{entry.actualCycleTime}m</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEditClick(entry)} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => onDelete(entry.id)} className="p-2 text-slate-300 hover:text-red-600 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingEntry && editingContext && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh]">
            <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl"><Edit2 size={24} /></div>
                <h3 className="font-black text-xl tracking-tight">Audit Production Record</h3>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Plant</label>
                  <select value={editingEntry.plant} onChange={(e) => setEditingEntry({...editingEntry, plant: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                    <option value="CHAKAN">CHAKAN</option><option value="AMBERNATH">AMBERNATH</option>
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial Number</label>
                  <input type="text" value={editingEntry.serialNo} onChange={(e) => setEditingEntry({...editingEntry, serialNo: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                </div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Model</label>
                  <select value={editingEntry.model} onChange={(e) => setEditingEntry({...editingEntry, model: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                    {MODELS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Stage</label>
                  <select value={editingEntry.stage} onChange={(e) => {
                    const next = e.target.value;
                    setEditingEntry({...editingEntry, stage: next, activity: editingContext.mapping[next][0]});
                  }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                    {Object.keys(editingContext.mapping).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active Activity ({editingEntry.plant})</label>
                  <select value={editingEntry.activity} onChange={(e) => setEditingEntry({...editingEntry, activity: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm">
                    {(editingContext.mapping[editingEntry.stage] || []).map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                    <input type="time" value={editingEntry.startTime} onChange={(e) => handleTimeFieldChange('startTime', e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold" />
                  </div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                    <input type="time" value={editingEntry.endTime} onChange={(e) => handleTimeFieldChange('endTime', e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold" />
                  </div>
                </div>
              </section>

              <div className="bg-slate-900 rounded-3xl p-6 text-white grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Total Minutes</p><p className="text-xl font-black">{editingEntry.actualCycleTime}</p></div>
                <div className="border-l border-slate-800"><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Variance</p><p className={`text-xl font-black ${editingEntry.variance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{editingEntry.variance}m</p></div>
                <div className="border-l border-slate-800"><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Loss hours</p><p className="text-xl font-black text-rose-400">{editingEntry.lossHours.toFixed(2)}</p></div>
                <div className="border-l border-slate-800"><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Standard</p><p className="text-xl font-black text-blue-400">{editingContext.standards[editingEntry.activity] || 0}m</p></div>
              </div>
            </div>

            <div className="p-8 border-t bg-slate-50 flex justify-end gap-4">
              <button onClick={() => setEditingEntry(null)} className="px-8 py-3 text-sm font-bold text-slate-500 uppercase tracking-widest">Cancel</button>
              <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white text-sm font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest">Commit Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManager;
