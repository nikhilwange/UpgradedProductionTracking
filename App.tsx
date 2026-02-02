
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, ClipboardList, Database, Factory, Sparkles, Users, Maximize, Minimize, LogOut, ShieldCheck, ShieldAlert, Settings, Loader2, LineChart, Briefcase, User, Shield, RefreshCcw, WifiOff } from 'lucide-react';
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
    label: "MANAGEMENT VIEW",
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
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry' | 'data' | 'insights' | 'manpower' | 'admin-manager'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  // Improved Role Fetching with Caching and longer timeout
  const fetchUserRole = async (userId: string, email?: string): Promise<'admin' | 'operator' | 'management'> => {
    const normalizedEmail = email?.toLowerCase();
    
    // Hardcoded Admin Override
    if (normalizedEmail === 'nikhil.wange@vertiv.com' || normalizedEmail === 'admin@vertiv.com') {
      localStorage.setItem('protrack_cached_role', 'admin');
      return 'admin';
    }

    // 1. Check Local Cache First (Fixes immediate downgrade on network blips)
    const cachedRole = localStorage.getItem('protrack_cached_role');
    
    try {
      const rolePromise = supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .single();

      // Increased timeout to 15 seconds for industrial environments
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Network Timeout")), 15000)
      );
      
      const result: any = await Promise.race([rolePromise, timeoutPromise]);
      const { data, error } = result;

      if (error || !data) {
        if (error && error.code !== "PGRST116") { // Not Found code
          console.warn("Supabase fetch failed, using cache if available:", error.message);
          return (cachedRole as any) || 'operator';
        }
        
        // Auto-register if no role exists
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert([{ id: userId, role: 'operator' }]);
        
        localStorage.setItem('protrack_cached_role', 'operator');
        return 'operator';
      }
      
      const fetchedRole = data.role?.trim().toLowerCase();
      const validRoles = ['admin', 'management', 'operator'];
      const finalRole = validRoles.includes(fetchedRole) ? fetchedRole : 'operator';
      
      localStorage.setItem('protrack_cached_role', finalRole);
      return finalRole as any;

    } catch (e: any) {
      console.warn("Role fetch system engaged failover:", e.message);
      // If we have a cached role, keep it. Don't force downgrade to operator on a simple timeout.
      if (cachedRole && ['admin', 'management', 'operator'].includes(cachedRole)) {
        return cachedRole as any;
      }
      return 'operator'; 
    }
  };

  const forceInitialize = () => {
    setIsInitializing(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRetry(true);
    }, 8000); // Wait longer before showing retry

    const initializeTerminal = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        setSession(currentSession);
        
        if (currentSession) {
          const role = await fetchUserRole(currentSession.user.id, currentSession.user.email);
          setUserRole(role);
        } else {
          setUserRole(null);
          localStorage.removeItem('protrack_cached_role');
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setInitError(true);
        // Look at cache even in total auth failure
        const cached = localStorage.getItem('protrack_cached_role');
        if (cached) setUserRole(cached as any);
      } finally {
        setIsInitializing(false);
        clearTimeout(timer);
      }
    };

    initializeTerminal();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (newSession) {
        const role = await fetchUserRole(newSession.user.id, newSession.user.email);
        setUserRole(role);
      } else {
        setUserRole(null);
        localStorage.removeItem('protrack_cached_role');
        if (event === 'SIGNED_OUT') setActiveTab('dashboard');
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const fetchCloudData = async () => {
    if (!session) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedData: ProductionEntry[] = data.map(item => ({
          id: String(item.id),
          stage: item.station || '',     
          productLine: item.product_line || '',
          model: item.model || '',
          serialNo: item.serial_no || '',
          unitSrNo: item.unit_sr_no || '',
          soSqNo: item.so_sq_no || '',
          productionDate: item.production_date || '',
          endDate: item.end_date,
          shift: item.shift || 'Shift 1',
          activity: item.stage || '',    
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
          createdAt: item.created_at || new Date().toISOString(),
          userEmail: item.user_email
        }));
        setEntries(mappedData);
      }
    } catch (e: any) {
      console.warn("Sync Issue: Network interrupted. Retrying in background.", e.message);
      // Exponential backoff or simple retry could go here
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchCloudData();
      const channel = supabase.channel('realtime_production')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'production_entries' }, () => fetchCloudData())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  const handleAddEntry = async (entryOrEntries: ProductionEntry | ProductionEntry[]) => {
    const newEntries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];

    setIsSyncing(true);
    try {
      const upserts = newEntries.map(newEntry => {
        const entryData: any = {
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
          user_email: session?.user?.email || 'unknown'
        };

        if (newEntry.id && !isNaN(Number(newEntry.id)) && String(newEntry.id).length < 10) {
          entryData.id = Number(newEntry.id);
        }
        
        return entryData;
      });

      const { error } = await supabase.from('production_entries').upsert(upserts);
      if (error) throw error;
      
      if (newEntries.some(e => e.status === 'Completed')) {
        setActiveTab('dashboard');
      }
      fetchCloudData(); 
    } catch (e: any) {
      console.error("Database connection lost:", e.message);
      alert(`Terminal Sync Failure: Check network connection. Data remains in session cache. Error: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateEntry = async (updatedEntry: ProductionEntry) => {
    if (userRole !== 'admin') return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('production_entries').update({
        station: updatedEntry.stage,     
        product_line: updatedEntry.productLine,
        model: updatedEntry.model,
        serial_no: updatedEntry.serialNo,
        unit_sr_no: updatedEntry.unitSrNo || '',
        so_sq_no: updatedEntry.soSqNo || '',
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
        status: updatedEntry.status
      }).eq('id', Number(updatedEntry.id));
      if (error) throw error;
      fetchCloudData();
    } catch (e: any) {
      console.error("Update failed:", e.message);
      alert(`System Error: Could not synchronize updates with cloud. ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (userRole !== 'admin') {
      alert("Unauthorized: Administrator permissions required.");
      return;
    }
    if (!confirm('Permanently delete record?')) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('production_entries').delete().eq('id', Number(id));
      if (error) throw error;
      fetchCloudData();
    } catch (e: any) { 
      console.error("Delete failed:", e.message); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-6 px-6">
        <div className="relative">
          <Loader2 className="animate-spin text-blue-500" size={64} />
          {showRetry && <WifiOff className="absolute -top-1 -right-1 text-rose-500 animate-pulse" size={20} />}
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-sm font-bold tracking-[0.2em] uppercase opacity-70">Synchronizing Universal Terminal Identity...</p>
          <p className="text-xs text-slate-500 font-medium">Establishing secure connection to Supabase Cloud</p>
          {showRetry && (
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest animate-in fade-in duration-500">
              Connection taking longer than expected due to network latency
            </p>
          )}
        </div>

        {showRetry && (
          <button 
            onClick={forceInitialize}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-full transition-all shadow-xl shadow-blue-500/20 animate-in slide-in-from-bottom-2"
          >
            <RefreshCcw size={14} /> Force Start Offline Mode
          </button>
        )}
      </div>
    );
  }

  if (!session) return <Auth />;

  const isAdmin = userRole === 'admin';
  const currentRoleIdentity = userRole ? ROLE_IDENTITY_MAP[userRole] : ROLE_IDENTITY_MAP.operator;
  const canAccessDatabase = userRole === 'admin' || userRole === 'operator' || userRole === 'management';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <nav className="w-full lg:w-64 bg-slate-900 text-white lg:min-h-screen flex-shrink-0 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Factory size={24} className="text-blue-500" />
          <div>
            <h1 className="font-bold text-md leading-tight tracking-tight">Vertiv ProTrack</h1>
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-[0.15em]">Enterprise MES</p>
          </div>
        </div>
        <div className="mt-4 px-3 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'entry'} onClick={() => setActiveTab('entry'} icon={<ClipboardList size={20} />} label="Operator Input" />
          <NavItem active={activeTab === 'manpower'} onClick={() => setActiveTab('manpower'} icon={<Users size={20} />} label="Manpower Registry" />
          
          {canAccessDatabase && (
            <NavItem active={activeTab === 'data'} onClick={() => setActiveTab('data'} icon={<Database size={20} />} label="Database View" />
          )}
          
          {isAdmin && (
            <>
              <div className="mx-4 my-4 h-px bg-slate-800" />
              <NavItem active={activeTab === 'insights'} onClick={() => setActiveTab('insights'} icon={<Sparkles size={20} />} label="Ai Strategic Insights" />
              <NavItem active={activeTab === 'admin-manager'} onClick={() => setActiveTab('admin-manager'} icon={<Settings size={20} />} label="System Management" />
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
            <button onClick={() => {
              localStorage.removeItem('protrack_cached_role');
              supabase.auth.signOut();
            }} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-rose-900 transition-all text-xs font-bold text-white shadow-sm">
              <LogOut size={14} /> Termination Log
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto relative">
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-4">
            <span className="text-2xl" role="img">
              {activeTab === 'dashboard' && "📊"}
              {activeTab === 'entry' && "📝"}
              {activeTab === 'manpower' && "👥"}
              {activeTab === 'data' && "💾"}
              {activeTab === 'insights' && "🤖"}
              {activeTab === 'admin-manager' && "⚙️"}
            </span>
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
                Live monitoring powered by Supabase Cloud Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supabase Cloud Sync</span>
              <span className="text-xs font-bold text-slate-900">{entries.length} Records</span>
            </div>
            <button 
              onClick={fetchCloudData}
              title="Refresh Data"
              className={`p-2 rounded-lg transition-all ${isSyncing ? 'animate-spin bg-blue-50 text-blue-500' : 'hover:bg-slate-100 text-slate-400'}`}
            >
              <RefreshCcw size={16} />
            </button>
            <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <Dashboard entries={entries} />}
          {activeTab === 'entry' && <OperatorEntry onAddEntry={handleAddEntry} entries={entries} />}
          {activeTab === 'manpower' && <ManpowerSummary entries={entries} />}
          {activeTab === 'data' && <DataTable entries={entries} onDelete={handleDeleteEntry} isAdmin={isAdmin} />}
          
          {isAdmin && (
            <>
              {activeTab === 'admin-manager' && <AdminManager entries={entries} onUpdate={handleUpdateEntry} onDelete={handleDeleteEntry} onClear={fetchCloudData} isAdmin={isAdmin} />}
              {activeTab === 'insights' && <GeminiInsights entries={entries} />}
            </>
          )}

          {!isAdmin && ['insights', 'admin-manager'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="p-8 bg-amber-50 rounded-[3rem] border border-amber-100 shadow-sm animate-shake">
                <ShieldAlert size={80} className="text-amber-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Access Restricted</h3>
                <p className="text-slate-500 text-sm max-w-sm font-medium">This terminal section is reserved for authenticated administrators only. Please return to the Operator Terminal.</p>
              </div>
              <button onClick={() => setActiveTab('entry')} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl">Return to Terminal</button>
            </div>
          )}
        </div>
      </main>
      <button onClick={toggleFullscreen} className="fixed bottom-6 left-6 z-[100] p-3.5 bg-slate-900/90 backdrop-blur-md text-white rounded-full shadow-2xl transition-all border border-slate-700 hover:scale-110 active:scale-95">
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
