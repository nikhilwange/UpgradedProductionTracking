import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, ClipboardList, Database, Factory, Sparkles, Users, Maximize, Minimize, LogOut, ShieldCheck, ShieldAlert, Settings, Loader2, LineChart, Briefcase, User, Shield, RefreshCcw, WifiOff } from 'lucide-react';
import { ProductionEntry } from './types';
import OperatorEntry from './components/OperatorEntry';
import Dashboard from './components/Dashboard';
import DataTable from './components/DataTable';
import GeminiInsights from './components/GeminiInsights';
import ManpowerSummary from './components/ManpowerSummary';
import AdminManager from './components/AdminManager';
import Auth from './components/Auth';
import { supabase } from './supabase';

const ROLE_IDENTITY_MAP = {
  admin: {
    label: "ADMINISTRATOR MODE",
    icon: Shield,
    textColor: "text-slate-500",
    iconColor: "text-green-500",
  },
  management: {
    label: "MANAGEMENT VIEW (GLOBAL)",
    icon: Briefcase,
    textColor: "text-blue-500",
    iconColor: "text-blue-500",
  },
  operator: {
    label: "OPERATOR MODE",
    icon: User,
    textColor: "text-orange-500",
    iconColor: "text-orange-500",
  }
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'operator' | 'management' | null>(null);
  const [homePlant, setHomePlant] = useState<string>('CHAKAN');
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry' | 'data' | 'insights' | 'manpower' | 'admin-manager'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  const forceInitialize = () => {
    setIsInitializing(false);
  };

  const clearLocalCaches = () => {
    localStorage.removeItem('protrack_cached_role');
    localStorage.removeItem('protrack_cached_plant');
    
    // Comprehensive cleanup for Supabase and ProTrack keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('protrack') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  const fetchUserRole = async (userId: string, email?: string): Promise<{role: 'admin' | 'operator' | 'management', plant: string}> => {
    const normalizedEmail = email?.toLowerCase();
    
    if (normalizedEmail === 'nikhil.wange@vertiv.com' || normalizedEmail === 'admin@vertiv.com') {
      localStorage.setItem('protrack_cached_role', 'admin');
      return { role: 'admin', plant: 'CHAKAN' };
    }

    const cachedRole = localStorage.getItem('protrack_cached_role');
    const cachedPlant = localStorage.getItem('protrack_cached_plant') || 'CHAKAN';
    
    try {
      const rolePromise = supabase
        .from('user_roles')
        .select('role, home_plant')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Role fetch timeout")), 8000)
      );
      
      const result: any = await Promise.race([rolePromise, timeoutPromise]);
      const { data, error } = result;

      if (error || !data) {
        if (error && error.code !== "PGRST116") {
          const msg = error.message?.toLowerCase() || '';
          if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
            throw error;
          }
          return { role: (cachedRole as any) || 'operator', plant: cachedPlant };
        }
        
        await supabase
          .from('user_roles')
          .insert([{ id: userId, role: 'operator', home_plant: 'CHAKAN' }]);
        
        localStorage.setItem('protrack_cached_role', 'operator');
        localStorage.setItem('protrack_cached_plant', 'CHAKAN');
        return { role: 'operator', plant: 'CHAKAN' };
      }
      
      const fetchedRole = data.role?.trim().toLowerCase();
      const fetchedPlant = data.home_plant || 'CHAKAN';
      const validRoles = ['admin', 'management', 'operator'];
      const finalRole = validRoles.includes(fetchedRole) ? fetchedRole : 'operator';
      
      localStorage.setItem('protrack_cached_role', finalRole);
      localStorage.setItem('protrack_cached_plant', fetchedPlant);
      return { role: finalRole as any, plant: fetchedPlant };

    } catch (e: any) {
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
        throw e;
      }
      console.warn("Role fetch failover engaged:", e.message);
      return { role: (cachedRole as any) || 'operator', plant: cachedPlant };
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 4000);

    const initializeTerminal = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Auth check timeout")), 12000)
        );
        
        const result: any = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (result.error) {
          const errorMsg = result.error.message?.toLowerCase() || '';
          // Catch and handle JWT/Refresh errors specifically
          if (
            errorMsg.includes('refresh') || 
            errorMsg.includes('token') ||
            errorMsg.includes('not found') || 
            errorMsg.includes('jwt') ||
            errorMsg.includes('exp')
          ) {
            console.warn("Session expired or invalid token detected. Clearing session.");
            supabase.auth.signOut().catch(() => {});
            clearLocalCaches();
            setSession(null);
          } else {
            console.error("Session Error detected:", errorMsg);
          }
        } else {
          const currentSession = result.data.session;
          setSession(currentSession);
          if (currentSession) {
            const { role, plant } = await fetchUserRole(currentSession.user.id, currentSession.user.email);
            setUserRole(role);
            setHomePlant(plant);
          }
        }
      } catch (err: any) {
        const msg = err.message?.toLowerCase() || '';
        if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
          console.warn("Initialization check failed due to invalid token. Clearing session.");
          supabase.auth.signOut().catch(() => {});
          clearLocalCaches();
          setSession(null);
        } else {
          console.error("Initialization check failed critically:", err.message);
          setInitError(true);
        }
      } finally {
        setIsInitializing(false);
        clearTimeout(timer);
      }
    };

    initializeTerminal();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, newSession) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null);
        setUserRole(null);
        clearLocalCaches();
        setActiveTab('dashboard');
        return;
      }

      // Proactive check for JWT validity on state change
      try {
        setSession(newSession);
        if (newSession) {
          const { role, plant } = await fetchUserRole(newSession.user.id, newSession.user.email);
          setUserRole(role);
          setHomePlant(plant);
        }
      } catch (e: any) {
        const msg = e.message?.toLowerCase() || '';
        if (msg.includes('jwt') || msg.includes('exp') || msg.includes('refresh') || msg.includes('token') || msg.includes('not found')) {
          supabase.auth.signOut().catch(() => {});
          clearLocalCaches();
          setSession(null);
          setUserRole(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signout call failed, forcing local cleanup:", err);
    } finally {
      clearLocalCaches();
      setSession(null);
      setUserRole(null);
      setActiveTab('dashboard');
    }
  };

  const fetchCloudData = async (retryCount = 0) => {
    if (!session || !userRole) return;
    
    if (!navigator.onLine) {
      setIsSyncing(false);
      return;
    }
    
    setIsSyncing(true);
    try {
      // Supabase/PostgREST caps responses at 1000 rows by default.
      // With 2400+ production entries, we must paginate to get ALL records.
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('production_entries')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (userRole !== 'admin' && userRole !== 'management') {
          query = query.eq('plant', homePlant);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += PAGE_SIZE;
          if (data.length < PAGE_SIZE) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      if (allData.length > 0) {
        setEntries(allData.map(item => ({
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
        })));
      }
    } catch (e: any) {
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
        supabase.auth.signOut().catch(() => {});
        clearLocalCaches();
        setSession(null);
        return;
      }
      const isNetworkError = e.message === 'Failed to fetch' || e.name === 'TypeError' || e.message?.includes('NetworkError');
      if (isNetworkError && retryCount < 3) {
        console.log(`Retrying sync (${retryCount + 1}/3)...`);
        setTimeout(() => fetchCloudData(retryCount + 1), 1500 * (retryCount + 1));
      } else {
        console.warn("Sync Error:", e.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (session && userRole) {
      fetchCloudData();
      
      // Sync when coming back online
      const handleOnline = () => {
        console.log("Network restored, re-syncing...");
        fetchCloudData();
      };
      window.addEventListener('online', handleOnline);

      const channel = supabase.channel('realtime_production')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'production_entries' 
        }, () => fetchCloudData())
        .subscribe();
      return () => { 
        window.removeEventListener('online', handleOnline);
        supabase.removeChannel(channel); 
      };
    }
  }, [session, userRole, homePlant]);

  const handleAddEntry = async (entryOrEntries: ProductionEntry | ProductionEntry[], retryCount = 0) => {
    const newEntries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];
    setIsSyncing(true);
    try {
      const upserts = newEntries.map(newEntry => {
        const entryData: any = {
          plant: newEntry.plant,
          station: newEntry.stage,         
          product_line: newEntry.productLine,
          model: newEntry.model,
          serial_no: newEntry.serialNo,
          unit_sr_no: newEntry.unitSrNo || '',
          so_sq_no: newEntry.soSqNo || '',
          production_date: newEntry.productionDate,
          end_date: newEntry.endDate,
          shift: newEntry.shift,
          stage: newEntry.activity,        
          manpower: Number(newEntry.manpower) || 0,
          manpower_names: newEntry.manpowerNames,
          shift_assignments: newEntry.assignments,
          start_time: newEntry.startTime,
          end_time: newEntry.endTime,
          standard_cycle_time: Number(newEntry.standardCycleTime) || 0,
          actual_cycle_time: Number(newEntry.actualCycleTime) || 0,
          shift1_actual_minutes: Number(newEntry.shift1ActualMinutes) || 0,
          shift2_actual_minutes: Number(newEntry.shift2ActualMinutes) || 0,
          variance: Number(newEntry.variance) || 0,
          manhours_engaged: Number(newEntry.manhoursEngaged) || 0,
          loss_hours: Number(newEntry.lossHours) || 0,
          loss_reason: newEntry.lossReason || '',
          affected_parameter: newEntry.affectedParameter,
          defect_category: newEntry.defectCategory,
          issue_description: newEntry.issueDescription,
          notes: newEntry.notes || '',
          status: newEntry.status,
          is_gap: newEntry.is_gap || false,
          user_email: session?.user?.email || 'unknown'
        };
        if (newEntry.id && !isNaN(Number(newEntry.id))) {
          entryData.id = Number(newEntry.id);
        }
        return entryData;
      });
      const { error } = await supabase.from('production_entries').upsert(upserts);
      if (error) throw error;
      if (newEntries.some(e => e.status === 'Completed')) setActiveTab('dashboard');
      fetchCloudData(); 
    } catch (e: any) {
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
        supabase.auth.signOut().catch(() => {});
        clearLocalCaches();
        setSession(null);
        alert('Session expired. Please sign in again.');
        return;
      }
      const isNetworkError = e.message === 'Failed to fetch' || e.name === 'TypeError' || e.message?.includes('NetworkError');
      if (isNetworkError && retryCount < 3) {
        console.log(`Retrying submission (${retryCount + 1}/3)...`);
        setTimeout(() => handleAddEntry(entryOrEntries, retryCount + 1), 1500 * (retryCount + 1));
      } else {
        alert(`Terminal Sync Failure: ${e.message}. Please check your network connection.`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateEntry = async (updatedEntry: ProductionEntry) => {
    if (userRole !== 'admin') return;
    setIsSyncing(true);
    try {
      // FIX: Changed updatedEntry.defect_category to updatedEntry.defectCategory and updatedEntry.issue_description to updatedEntry.issueDescription to match the ProductionEntry interface.
      const { error } = await supabase.from('production_entries').update({
        plant: updatedEntry.plant,
        station: updatedEntry.stage,     
        product_line: updatedEntry.productLine,
        model: updatedEntry.model,
        serial_no: updatedEntry.serialNo,
        unit_sr_no: updatedEntry.unitSrNo || '',
        so_sq_no: updatedEntry.soSqNo,
        production_date: updatedEntry.productionDate,
        end_date: updatedEntry.endDate,
        shift: updatedEntry.shift,
        stage: updatedEntry.activity,    
        manpower: Number(updatedEntry.manpower) || 0,
        manpower_names: updatedEntry.manpowerNames,
        shift_assignments: updatedEntry.assignments,
        start_time: updatedEntry.startTime,
        end_time: updatedEntry.endTime,
        standard_cycle_time: Number(updatedEntry.standardCycleTime) || 0,
        actual_cycle_time: Number(updatedEntry.actualCycleTime) || 0,
        shift1_actual_minutes: Number(updatedEntry.shift1ActualMinutes) || 0,
        shift2_actual_minutes: Number(updatedEntry.shift2ActualMinutes) || 0,
        variance: Number(updatedEntry.variance) || 0,
        manhours_engaged: Number(updatedEntry.manhoursEngaged) || 0,
        loss_hours: Number(updatedEntry.lossHours) || 0,
        loss_reason: updatedEntry.lossReason || '',
        affected_parameter: updatedEntry.affectedParameter,
        defect_category: updatedEntry.defectCategory,
        issue_description: updatedEntry.issueDescription,
        notes: updatedEntry.notes || '',
        status: updatedEntry.status,
        is_gap: updatedEntry.is_gap || false
      }).eq('id', Number(updatedEntry.id));
      if (error) throw error;
      fetchCloudData();
    } catch (e: any) {
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
        supabase.auth.signOut().catch(() => {});
        clearLocalCaches();
        setSession(null);
        alert('Session expired. Please sign in again.');
        return;
      }
      alert(`Update failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (userRole !== 'admin') return;
    if (!confirm('Permanently delete record?')) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('production_entries').delete().eq('id', Number(id));
      if (error) throw error;
      fetchCloudData();
    } catch (e: any) {
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('token') || msg.includes('refresh') || msg.includes('jwt') || msg.includes('not found') || msg.includes('exp')) {
        supabase.auth.signOut().catch(() => {});
        clearLocalCaches();
        setSession(null);
        alert('Session expired. Please sign in again.');
        return;
      }
      console.warn("Delete Error:", e.message);
    } finally { setIsSyncing(false); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  if (isInitializing) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-8 px-6">
      <div className="relative p-12 border-2 border-blue-500/30 rounded-3xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500 max-w-sm w-full bg-slate-900/50 backdrop-blur-xl">
        <Loader2 className="animate-spin text-blue-500" size={64} />
        <div className="text-center space-y-2">
          <p className="text-sm font-bold tracking-[0.2em] uppercase opacity-90">Synchronizing Universal Terminal...</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Verifying Identity & Keys</p>
        </div>
        
        {showRetry && (
          <div className="pt-4 flex flex-col items-center gap-4 w-full animate-in slide-in-from-bottom-4">
            <button 
              onClick={forceInitialize}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-50 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-2xl shadow-blue-500/20 active:scale-[0.98]"
            >
              <RefreshCcw size={14} /> Force Start Offline Mode
            </button>
            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
              <WifiOff size={12} className="text-rose-500" />
              Connection Latency Detected
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!session) return <Auth />;

  const isAdmin = userRole === 'admin';
  const isGlobalViewer = userRole === 'admin' || userRole === 'management';
  const currentRoleIdentity = userRole ? ROLE_IDENTITY_MAP[userRole] : ROLE_IDENTITY_MAP.operator;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <nav className="w-full lg:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col lg:fixed lg:top-0 lg:left-0 lg:h-screen lg:overflow-y-auto z-20">
        <div className="p-6 flex items-center gap-3">
          <Factory size={24} className="text-blue-500" />
          <div>
            <h1 className="font-bold text-md tracking-tight">Vertiv ProTrack</h1>
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">Enterprise MES</p>
          </div>
        </div>
        <div className="mt-4 px-3 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutGrid size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={<ClipboardList size={20} />} label="Operator Input" />
          <NavItem active={activeTab === 'manpower'} onClick={() => setActiveTab('manpower')} icon={<Users size={20} />} label="Manpower Registry" />
          <NavItem active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<Database size={20} />} label="Database View" />
          {isAdmin && (
            <>
              <div className="mx-4 my-4 h-px bg-slate-800" />
              <NavItem active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<Sparkles size={20} />} label="Ai Strategic Insights" />
              <NavItem active={activeTab === 'admin-manager'} onClick={() => setActiveTab('admin-manager')} icon={<Settings size={20} />} label="System Management" />
            </>
          )}
        </div>
        <div className="mt-auto p-4">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-800">
            <p className="text-[11px] font-bold truncate text-slate-300 mb-1">{session.user.email}</p>
            <div className="flex items-center gap-1.5">
              <currentRoleIdentity.icon size={10} className={currentRoleIdentity.iconColor} />
              <p className={`text-[9px] uppercase font-black tracking-widest ${currentRoleIdentity.textColor}`}>
                {currentRoleIdentity.label}
              </p>
            </div>
            <button onClick={handleLogout} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-rose-900 transition-all text-xs font-bold text-white shadow-sm">
              <LogOut size={14} /> Termination Log
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto relative lg:ml-64">
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-50 rounded-2xl text-blue-600 shadow-sm">
                {activeTab === 'dashboard' && <LayoutGrid size={22} />}
                {activeTab === 'entry' && <ClipboardList size={22} />}
                {activeTab === 'manpower' && <Users size={22} />}
                {activeTab === 'data' && <Database size={22} />}
                {activeTab === 'insights' && <Sparkles size={22} />}
                {activeTab === 'admin-manager' && <Settings size={22} />}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {activeTab === 'dashboard' && 'Analytics Dashboard'}
                  {activeTab === 'entry' && 'Operator Log Terminal'}
                  {activeTab === 'manpower' && 'Resource Allocation Registry'}
                  {activeTab === 'data' && 'Enterprise Production Database'}
                  {activeTab === 'insights' && 'Strategic AI Analytics'}
                  {activeTab === 'admin-manager' && 'Administration Console'}
                </h2>
                <p className="text-[11px] text-slate-500 font-bold tracking-tight">
                  Monitoring Plant: <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 uppercase">
                    {isGlobalViewer ? 'AMBERNATH AND CHAKAN' : homePlant}
                  </span> • Powered by Supabase
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchCloudData} className={`p-2 rounded-lg transition-all ${isSyncing ? 'animate-spin bg-blue-50 text-blue-500' : 'hover:bg-slate-100 text-slate-400'}`}>
              <RefreshCcw size={16} />
            </button>
            <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <Dashboard entries={entries} plant={homePlant} userRole={userRole} />}
          {activeTab === 'entry' && <OperatorEntry onAddEntry={handleAddEntry} entries={entries} plant={homePlant} userRole={userRole} />}
          {activeTab === 'manpower' && <ManpowerSummary entries={entries} />}
          {activeTab === 'data' && <DataTable entries={entries} onDelete={handleDeleteEntry} isAdmin={isAdmin} />}
          {isAdmin && activeTab === 'admin-manager' && <AdminManager entries={entries} onUpdate={handleUpdateEntry} onDelete={handleDeleteEntry} onClear={fetchCloudData} isAdmin={isAdmin} />}
          {isAdmin && activeTab === 'insights' && <GeminiInsights entries={entries} />}
        </div>
      </main>
      <button onClick={toggleFullscreen} className="fixed bottom-6 left-6 z-[100] p-3.5 bg-slate-900/90 text-white rounded-full shadow-2xl transition-all hover:scale-110">
        {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
      </button>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] translate-x-1' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'}`}>
    {icon}
    <span className="font-bold text-sm tracking-tight">{label}</span>
  </button>
);

export default App;