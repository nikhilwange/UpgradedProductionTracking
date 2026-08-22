import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Send, Users, CalendarDays, Tag, Hash, Box, Layout, Layers, Info, Clock3, 
  ChevronDown, RefreshCw, Loader2, ArrowRight, ListChecks, X, AlertCircle, FileText, Scan, CheckCircle2, Activity,
  Filter, ShieldCheck, Copy, Factory
} from 'lucide-react';
import { PLANT_REGISTRY, getModelContext, MODELS_LIST, PRODUCT_LINES_LIST, SERIAL_NUMBERS_LIST, BREAK_TIMES, AMBERNATH_BREAK_TIMES, AMB_S1_START, AMB_S1_END, AMB_S2_START, AMB_S2_END, CHILLER_BREAK_TIMES, OPERATORS_BY_MODEL_LINE, LOSS_PARAMETER_MAPPING, HOLIDAYS_LIST, toMins, S3_START, S3_END, resolveIdentityFromSerial } from '../constants';
import { ProductionEntry } from '../types';
import { supabase } from '../supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import VoiceInput from './VoiceInput';

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

// Shift Boundaries
const S1_START = 420;  // 07:00
const S1_END = 930;    // 15:30
const S2_START = 900;  // 15:00
const S2_END = 1410;   // 23:30

interface AssignmentInput {
  operators: string[];
  count: number;
  affectedParameter: string;
  defectCategory: string;
  issueDescription: string;
}

interface OperatorEntryProps {
  onAddEntry: (entries: ProductionEntry | ProductionEntry[]) => void;
  entries: ProductionEntry[];
  plant: string;
  userRole?: string;
}

const fromMins = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatDateISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const FormDateTimeInput: React.FC<{
  type: 'date' | 'time';
  value: string;
  onChange: (val: string) => void;
  className?: string;
  paddingY?: string;
  disabled?: boolean;
  readOnly?: boolean;
}> = ({ type, value, onChange, className, paddingY = 'py-2', disabled = false, readOnly = false }) => {
  const [isManual, setIsManual] = useState(false);
  const formatDisplay = (val: string) => {
    if (!val) return type === 'date' ? 'DD-MM-YYYY' : 'HH:MM';
    if (type === 'time') return val;
    const parts = val.split('-');
    if (parts.length !== 3) return val;
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    let val = e.target.value;
    if (type === 'time') {
      const digits = val.replace(/\D/g, '').slice(0, 4);
      if (digits.length > 2) val = `${digits.slice(0, 2)}:${digits.slice(2)}`;
      else val = digits;
    }
    onChange(val);
  };
  const setTimeToNow = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    onChange(timeStr);
    if (!readOnly) setIsManual(true);
  };
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className={`relative group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${readOnly ? 'cursor-default' : ''}`} onDoubleClick={() => !disabled && !readOnly && setIsManual(!isManual)}>
        {!isManual && (
          <div className={`w-full px-4 ${paddingY} pr-10 bg-white border border-slate-200 rounded-[1.5rem] flex items-center shadow-sm pointer-events-none z-0`}>
            <span className="text-sm font-bold text-[#002060]">{formatDisplay(value)}</span>
          </div>
        )}
        {!isManual && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-[5]">
            {type === 'date' ? <CalendarDays className="w-5 h-5 text-slate-400 group-hover:text-blue-600" /> : <Clock3 className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />}
          </div>
        )}
        <input
          type={isManual ? (type === 'time' ? 'tel' : 'text') : type}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          onChange={handleInputChange}
          inputMode={type === 'time' ? 'numeric' : undefined}
          className={`w-full outline-none text-sm font-bold text-[#002060] rounded-[1.5rem] border transition-all appearance-none ${
            isManual ? 'relative z-20 px-4 py-2 border-blue-400 bg-white shadow-md pr-10' : 'absolute inset-0 opacity-0 z-10 cursor-pointer h-full border-slate-200'
          } ${readOnly ? 'cursor-default' : ''}`}
        />
      </div>
      {type === 'time' && !disabled && (
        <div className="flex flex-col items-center gap-2 px-1">
          <button type="button" onClick={setTimeToNow} className="w-full py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full hover:bg-blue-700 shadow-sm active:scale-95">NOW</button>
          {!readOnly && (
            <p className="text-[10px] text-slate-400 font-medium italic text-center leading-tight mt-1">
              *Double-tap to enter / Double-tap to exit manual mode*
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const OperatorEntry: React.FC<OperatorEntryProps> = ({ onAddEntry, entries, plant, userRole }) => {
  const isAdmin = userRole === 'admin';
  const [serialNo, setSerialNo] = useState('');
  const debouncedSerialNo = useDebounce(serialNo, 600);
  const [unitSrNo, setUnitSrNo] = useState('');
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [model, setModel] = useState('');
  const [productLine, setProductLine] = useState('');

  // --- Plant scope ---------------------------------------------------------
  // Admin and Management have universal access and may log entries for either
  // plant. Operators remain locked to their assigned home plant.
  const canSwitchPlant = userRole === 'admin' || userRole === 'management';
  const [activePlant, setActivePlant] = useState<string>(plant || 'CHAKAN');

  useEffect(() => {
    if (!canSwitchPlant) setActivePlant(plant);
    else if (!activePlant) setActivePlant(plant || 'CHAKAN');
  }, [plant, canSwitchPlant]);
  // -------------------------------------------------------------------------

  const filteredModels = useMemo(() => {
    const p = activePlant?.toUpperCase();
    if (!p || !PLANT_REGISTRY[p]) return [];
    if (p === 'CHAKAN') return ['CHILLER', 'PDX', 'PCW', 'CRV'];
    return Object.keys(PLANT_REGISTRY[p].models);
  }, [activePlant]);

  const filteredProductLines = useMemo(() => {
    const p = activePlant?.toUpperCase();
    // For Ambernath, product lines are Li7, Li7 PCA, and Trinergy
    if (p === 'AMBERNATH') {
      return ['Li7', 'Li7 PCA', 'Trinergy'];
    }
    // For Chakan, scope product lines to the selected model where defined
    const mu = model?.toUpperCase();
    if (mu === 'PDX') return ['PDX 1 / 1.5 BAY', 'PDX 2 / 3 BAY'];
    if (mu === 'PCW') return ['PCW 3 / 4 BAY'];
    if (mu === 'CRV') return ['CRV/CRV+'];
    if (mu === 'CHILLER') return ['CHILLER', 'CHILLER 1', 'CHILLER 2'];
    return PRODUCT_LINES_LIST.filter(pl => 
      !['Li7', 'Li7 PCA', 'Trinergy'].includes(pl)
    );
  }, [activePlant, model]);

  // Ambernath: the model fully determines the product line.
  // Li7 -> Li7 | Li7 PCA -> Li7 PCA | 2X / 3X / STS -> Trinergy
  useEffect(() => {
    if (activePlant?.toUpperCase() !== 'AMBERNATH' || !model) return;
    const m = model.trim().toUpperCase();
    if (m === '2X' || m === '3X' || m === 'STS') setProductLine('Trinergy');
    else if (m === 'LI7 PCA') setProductLine('Li7 PCA');
    else if (m === 'LI7') setProductLine('Li7');
  }, [model, activePlant]);

  useEffect(() => {
    if (filteredModels.length > 0 && !filteredModels.includes(model)) {
      setModel(filteredModels[0]);
    }
  }, [filteredModels, model]);

  useEffect(() => {
    if (filteredProductLines.length > 0 && !filteredProductLines.includes(productLine)) {
      setProductLine(filteredProductLines[0]);
    }
  }, [filteredProductLines, productLine]);

  const [activeInProgressEntry, setActiveInProgressEntry] = useState<ProductionEntry | null>(null);
  const [isScanning, setIsScanning] = useState<'scan' | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const context = useMemo(() => getModelContext(serialNo, model, activePlant, productLine), [serialNo, model, activePlant, productLine]);
  const activeStageMapping = context.mapping;
  const activeActivityStandards = context.standards;
  const activeStagesList = useMemo(() => Object.keys(activeStageMapping), [activeStageMapping]);

  const [stage, setStage] = useState(activeStagesList[0]);
  const [activity, setActivity] = useState(activeStageMapping[activeStagesList[0]][0]);
  
  // Initial default values for Stage and Activity
  useEffect(() => {
    if (activeStagesList.length > 0) {
      if (!activeStagesList.includes(stage)) {
        const firstStage = activeStagesList[0];
        setStage(firstStage);
        setActivity(activeStageMapping[firstStage][0]);
      } else if (!activeStageMapping[stage]?.includes(activity)) {
        setActivity(activeStageMapping[stage][0]);
      }
    }
  }, [activeStagesList, activeStageMapping]);

  // isAlreadyLogged checks if a SN+Activity has a "Completed" status in the history
  const isAlreadyLogged = useMemo(() => {
    const cleanSerial = serialNo.trim().toLowerCase();
    const cleanActivity = activity.trim().toLowerCase();
    if (!cleanSerial || !cleanActivity) return false;
    return entries.some(existing => 
      existing.serialNo.toLowerCase() === cleanSerial && 
      existing.activity.toLowerCase() === cleanActivity &&
      existing.status === 'Completed' &&
      !existing.is_gap
    );
  }, [entries, serialNo, activity]);

  const [soSqNo, setSoSqNo] = useState('');
  const [scanTime, setScanTime] = useState<string | null>(null);
  const [scanDate, setScanDate] = useState<string | null>(null);
  const [scanTrigger, setScanTrigger] = useState(0);
  const [productionDate, setProductionDate] = useState(formatDateISO(new Date()));
  const [endDate, setEndDate] = useState(formatDateISO(new Date()));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  
  const [assignmentInputs, setAssignmentInputs] = useState<Record<string, AssignmentInput>>({});
  const [lossHours, setLossHours] = useState<number>(0);
  const [isAutoLoss, setIsAutoLoss] = useState(true);

  const [lastLog, setLastLog] = useState<{ endTime: string, endDate: string, stageName: string } | null>(null);
  const [hasOtherInProgress, setHasOtherInProgress] = useState(false);
  const [isFetchingLastLog, setIsFetchingLastLog] = useState(false);
  const [idleAttribution, setIdleAttribution] = useState({ affectedParameter: '', defectCategory: '', issueDescription: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userHasSelectedActivity, setUserHasSelectedActivity] = useState(false);

  const normalizeTime = (timeStr: string): string => {
    if (!timeStr) return '00:00:00';
    const trimmed = timeStr.trim();
    if (trimmed.includes('T')) {
      const timePart = trimmed.split('T')[1].split('.')[0];
      const parts = timePart.split(':');
      while (parts.length < 3) parts.push('00');
      return parts.map(p => p.padStart(2, '0')).join(':');
    }
    const parts = trimmed.split(':');
    while (parts.length < 3) parts.push('00');
    return parts.slice(0, 3).map(p => p.padStart(2, '0')).join(':');
  };

  const toStandardMs = (dateStr: string, timeStr: string): number => {
    if (!dateStr || !timeStr) return NaN;
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const [hh, mm] = timeStr.split(':').map(Number);
      const date = new Date(y, m - 1, d, hh, mm, 0);
      return date.getTime();
    } catch (e) { return NaN; }
  };

  const activeBreaks = useMemo(() => {
    const m = model.toUpperCase();
    if (m === 'LI7' || m === 'LI7 PCA' || m === '2X' || m === '3X' || m === 'STS') return AMBERNATH_BREAK_TIMES;
    if (m === 'CHILLER' || m === 'VANTAGE' || m === 'ADANI') return CHILLER_BREAK_TIMES;
    return BREAK_TIMES;
  }, [model]);

  const activeShiftBoundaries = useMemo(() => {
    const m = model.toUpperCase();
    if (m === 'LI7' || m === 'LI7 PCA' || m === '2X' || m === '3X' || m === 'STS') {
      return {
        s1Start: AMB_S1_START,
        s1End: AMB_S1_END,
        s2Start: AMB_S2_START,
        s2End: AMB_S2_END,
        s3Start: 0,
        s3End: 0
      };
    }
    if (m === 'CHILLER' || m === 'VANTAGE' || m === 'ADANI') {
      return {
        s1Start: S1_START,
        s1End: S1_END,
        s2Start: S2_START,
        s2End: S2_END,
        s3Start: S3_START,
        s3End: S3_END
      };
    }
    return {
      s1Start: S1_START,
      s1End: S1_END,
      s2Start: S2_START,
      s2End: S2_END,
      s3Start: 0,
      s3End: 0
    };
  }, [model]);

  const calculateAvailableGapMins = (startMs: number, endMs: number) => {
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;
    
    let totalAvailable = 0;
    const d = new Date(startMs);
    d.setHours(0, 0, 0, 0); // Start boundary of the first day
    
    const endBoundary = new Date(endMs);
    endBoundary.setHours(23, 59, 59, 999);
    
    while (d <= endBoundary) {
      const dateStr = formatDateISO(d);
      // FIX: An inter-activity gap is bracketed by two REAL logged activities.
      // If the previous activity ended on this date, or the next activity starts
      // on it, the plant was demonstrably running and the Sunday/holiday calendar
      // must not zero the window. Only fully intermediate days count as non-working.
      // Previously a gap that began and ended on a Sunday or listed holiday
      // returned 0 minutes, so no idle card appeared and no gap row was written,
      // while the Dashboard's calendar-blind implicit-gap logic still showed it.
      const isBoundaryDay =
        dateStr === formatDateISO(new Date(startMs)) ||
        dateStr === formatDateISO(new Date(endMs));
      const isNonWorkingDay =
        (d.getDay() === 0 || HOLIDAYS_LIST.includes(dateStr)) && !isBoundaryDay;

      if (!isNonWorkingDay) {
        const dayStartMs = new Date(`${dateStr}T00:00:00`).getTime();
        const relStart = Math.max(0, (startMs - dayStartMs) / 60000);
        const relEnd = Math.min(1440, (endMs - dayStartMs) / 60000);
        
        // INTER-ACTIVITY LOSS WINDOW
        // 3-shift plants (Chakan chiller lines) are manned 24h on a working day,
        // so the entire day counts as idle-capable time. Plants without a Shift 3
        // (Ambernath) remain clipped to their operating window.
        const is3Shift = activeShiftBoundaries.s3Start > 0;
        const s = is3Shift ? relStart : Math.max(relStart, activeShiftBoundaries.s1Start);
        const e = is3Shift ? relEnd : Math.min(relEnd, activeShiftBoundaries.s2End || activeShiftBoundaries.s1End);
        
        if (s < e) {
          let dailyWorkingMins = e - s;
          let dailyBreakMins = 0;
          
          activeBreaks.forEach(b => {
            if (b.name === 'Non Working Hours') return; 
            const bs = toMins(b.start);
            const be = toMins(b.end);
            const os = Math.max(s, bs);
            const oe = Math.min(e, be);
            if (os < oe) dailyBreakMins += (oe - os);
          });
          
          totalAvailable += (dailyWorkingMins - dailyBreakMins);
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return Math.max(0, totalAvailable);
  };

  const idleGapMinutes = useMemo(() => {
    if (!lastLog) return 0;
    if (activeInProgressEntry) return 0;
    if (hasOtherInProgress) return 0;

    const prevEndMs = toStandardMs(
      lastLog.endDate, 
      lastLog.endTime
    );
    const currStartMs = toStandardMs(
      productionDate, 
      startTime
    );

    if (isNaN(prevEndMs) || isNaN(currStartMs)) return 0;
    if (currStartMs <= prevEndMs) return 0;

    const available = calculateAvailableGapMins(
      prevEndMs, 
      currStartMs
    );
    return available >= 1 ? Math.round(available) : 0;
  }, [
    lastLog, 
    productionDate, 
    startTime, 
    activeInProgressEntry,
    hasOtherInProgress
  ]);

  // Builds the working-time segments of a single day: the operational window
  // (derived from 'Non Working Hours', or the full day when none is defined)
  // minus every break, sorted chronologically.
  const buildDaySegments = () => {
    const nw = activeBreaks.find(b => b.name === 'Non Working Hours');
    const OP_START = nw ? toMins(nw.end) : 0;
    const OP_END = nw ? toMins(nw.start) : 1440;
    const brs = activeBreaks
      .filter(b => b.name !== 'Non Working Hours')
      .map(b => ({ s: toMins(b.start), e: toMins(b.end) }))
      .filter(b => b.e > OP_START && b.s < OP_END)
      .sort((a, b) => a.s - b.s);
    const segs: { s: number; e: number }[] = [];
    let c = OP_START;
    brs.forEach(b => {
      if (b.s > c) segs.push({ s: c, e: Math.min(b.s, OP_END) });
      c = Math.max(c, b.e);
    });
    if (c < OP_END) segs.push({ s: c, e: OP_END });
    return segs;
  };

  // Consumes the standard cycle time across working segments, rolling forward
  // over nights, Sundays and holidays. Returns both date and time.
  const calculatePredictedFinishDated = (startDateStr: string, startStr: string, sctMins: number) => {
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const segs = buildDaySegments();
    if (!segs.length || sctMins <= 0) return { date: startDateStr, time: startStr };

    let remaining = sctMins;
    const d = new Date(`${startDateStr}T00:00:00`);
    let cursor = toMins(startStr);
    let guard = 0;

    while (remaining > 0 && guard < 400) {
      guard++;
      const dateStr = formatDateISO(d);
      const isNonWorkingDay = d.getDay() === 0 || HOLIDAYS_LIST.includes(dateStr);
      if (!isNonWorkingDay) {
        for (const sg of segs) {
          const s = Math.max(cursor, sg.s);
          if (s >= sg.e) continue;
          const avail = sg.e - s;
          if (remaining <= avail) return { date: dateStr, time: fmt(s + remaining) };
          remaining -= avail;
        }
      }
      d.setDate(d.getDate() + 1);
      cursor = 0;
    }
    return { date: formatDateISO(d), time: fmt(toMins(startStr)) };
  };

  const calculatePredictedFinish = (startStr: string, sctMins: number) => {
    const parseMins = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const formatMins = (m: number) => { const h = Math.floor(m / 60) % 24; const mm = m % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
    const plantBreaks = activeBreaks.map(b => ({ start: parseMins(b.start), end: parseMins(b.end), duration: b.duration, name: b.name }));
    let currentStart = parseMins(startStr);
    let currentEnd = currentStart + sctMins;
    let stable = false;
    let iterations = 0;
    const appliedBreaks = new Set<string>();
    while (!stable && iterations < 10) {
      let durationAddedThisRound = 0;
      let overlapDetected = false;
      for (const b of plantBreaks) {
        if (appliedBreaks.has(b.name)) continue;
        const overlaps = currentStart < b.end && currentEnd > b.start;
        if (overlaps) { durationAddedThisRound += b.duration; appliedBreaks.add(b.name); overlapDetected = true; }
      }
      if (overlapDetected) currentEnd += durationAddedThisRound; else stable = true;
      iterations++;
    }
    return formatMins(currentEnd);
  };

  useEffect(() => {
    if (!activeInProgressEntry) {
      const standard = activeActivityStandards[activity] || 0;
      if (standard > 0 && startTime && productionDate) {
        const prediction = calculatePredictedFinishDated(productionDate, startTime, standard);
        setEndDate(prediction.date);
        setEndTime(prediction.time);
      } else if (productionDate) {
        setEndDate(productionDate);
      }
    }
  }, [startTime, productionDate, activity, activeActivityStandards, activeInProgressEntry]);

  useEffect(() => {
    let isActive = true;

    const fetchLastLog = async () => {
      const cleanSerial = debouncedSerialNo.trim();

      if (cleanSerial.length < 2) {
        if (isActive) {
          setLastLog(null);
        }
        return;
      }

      try {
        // Fetch a recent window of completed activity rows and resolve the true
        // chronological last end client-side. Ordering by end_time in SQL is wrong:
        // it is a time-of-day value, so a Shift 2 boundary segment ending 23:30
        // outranks the same activity's real Shift 3 end at 03:37 the next morning.
        // The stored end_date is also unreliable on historical rows (all shift
        // splits carry the activity's overall end date), so it is ignored here.
        const { data: recentRows, error } = await supabase
          .from('production_entries')
          .select('start_time, end_time, end_date, production_date, shift, stage, is_gap')
          .ilike('serial_no', cleanSerial)
          .eq('status', 'Completed')
          .neq('is_gap', true)
          .order('production_date', { ascending: false })
          .limit(200);

        if (!isActive) return;

        const pad2 = (n: number) => String(n).padStart(2, '0');

        const resolveTrueEnd = (r: any) => {
          const [y, mo, dd] = String(r.production_date || '').split('-').map(Number);
          if (!y || !mo || !dd) return null;
          const startHHMM = String(r.start_time || '00:00').slice(0, 5);
          const endHHMM = String(r.end_time || '00:00').slice(0, 5);

          // Shift 3 spans 23:30 -> 07:00 and is stamped with the shift-day.
          // A Shift 3 segment starting before 07:00 belongs to the NEXT calendar day.
          const base = new Date(y, mo - 1, dd);
          if (r.shift === 'Shift 3' && startHHMM < '07:00') base.setDate(base.getDate() + 1);

          // A segment whose end is at or before its start has wrapped past midnight.
          const endDay = new Date(base);
          if (endHHMM <= startHHMM) endDay.setDate(endDay.getDate() + 1);

          const [eh, em] = endHHMM.split(':').map(Number);
          endDay.setHours(eh || 0, em || 0, 0, 0);

          return {
            ms: endDay.getTime(),
            endDateStr: `${endDay.getFullYear()}-${pad2(endDay.getMonth() + 1)}-${pad2(endDay.getDate())}`,
            endTimeRaw: r.end_time,
            stage: r.stage
          };
        };

        const resolved = (recentRows || [])
          .map(resolveTrueEnd)
          .filter((x): x is { ms: number; endDateStr: string; endTimeRaw: string; stage: string } => !!x && !isNaN(x.ms))
          .sort((a, b) => b.ms - a.ms);

        const latest = resolved[0];

        if (latest && !error) {
          // Suppress if a gap has already been logged for this exact window.
          const { data: existingGap } = await supabase
            .from('production_entries')
            .select('id')
            .ilike('serial_no', cleanSerial)
            .eq('is_gap', true)
            .eq('start_time', latest.endTimeRaw)
            .eq('production_date', latest.endDateStr)
            .maybeSingle();

          if (!isActive) return;

          if (existingGap) {
            setLastLog(null);
          } else {
            setLastLog({
              endTime: latest.endTimeRaw,
              endDate: latest.endDateStr,
              stageName: latest.stage
            });
          }
        } else {
          setLastLog(null);
        }
      } catch (err) {
        if (isActive) {
          setLastLog(null);
        }
      }
    };

    fetchLastLog();
    return () => { isActive = false; };

  }, [debouncedSerialNo]);

  useEffect(() => {
    let isActive = true;

    const checkInProgress = async () => {
      const cleanSerial = debouncedSerialNo.trim();
      const cleanActivity = activity.trim();

      if (cleanSerial.length < 2 || !cleanActivity) {
        if (isActive) {
          setActiveInProgressEntry(null);
          setHasOtherInProgress(false);
        }
        return;
      }

      if (isActive) setIsFetchingLastLog(true);

      try {
        // Check if THIS serial+activity is In Progress
        const { data: inProgress, error: ipError } = await supabase
          .from('production_entries')
          .select('*')
          .ilike('serial_no', cleanSerial)
          .eq('stage', cleanActivity)
          .eq('status', 'In Progress')
          .maybeSingle();

        if (!isActive) return;

        if (inProgress && !ipError) {
          setActiveInProgressEntry({
            id: String(inProgress.id),
            plant: inProgress.plant || 'CHAKAN',
            stage: inProgress.station,
            productLine: inProgress.product_line,
            model: inProgress.model,
            serialNo: inProgress.serial_no,
            unitSrNo: inProgress.unit_sr_no || '',
            soSqNo: inProgress.so_sq_no || '',
            productionDate: inProgress.production_date,
            shift: inProgress.shift || 'Shift 1',
            startTime: inProgress.start_time,
            endTime: inProgress.end_time || '00:00',
            activity: inProgress.stage,
            assignments: inProgress.shift_assignments || [],
            manpower: inProgress.manpower || 0,
            manpowerNames: inProgress.manpower_names || [],
            status: 'In Progress',
            createdAt: inProgress.created_at,
            standardCycleTime: inProgress.standard_cycle_time,
            actualCycleTime: 0,
            shift1ActualMinutes: 0,
            shift2ActualMinutes: 0,
            variance: 0,
            manhoursEngaged: 0,
            lossHours: 0,
            lossReason: '',
            notes: inProgress.notes || ''
          });

          if (inProgress.unit_sr_no?.trim()) setUnitSrNo(inProgress.unit_sr_no);
          if (inProgress.so_sq_no?.trim()) setSoSqNo(inProgress.so_sq_no);
          setProductionDate(inProgress.production_date);
          setStartTime(inProgress.start_time);

          const now = new Date();
          setEndDate(scanDate || formatDateISO(now));
          setEndTime(scanTime || now.toLocaleTimeString('en-GB', { 
            hour: '2-digit', minute: '2-digit' 
          }));
          setScanTime(null);
          setScanDate(null);

        } else {
          if (isActive) setActiveInProgressEntry(null);

          if (scanTime && scanDate) {
            setStartTime(scanTime);
            setProductionDate(scanDate);
            setScanTime(null);
            setScanDate(null);
          } else {
            const now = new Date();
            setStartTime(now.toLocaleTimeString('en-GB', { 
              hour: '2-digit', minute: '2-digit' 
            }));
            setProductionDate(formatDateISO(now));
          }
        }

        // Check for TRUE in-progress activities for this serial.
        // A "true" in-progress activity has an In Progress entry but NO Completed entry
        // for the same serial+activity. This filters out stale In Progress records that
        // remain in the database after the activity was completed.
        const { data: allOtherEntries } = await supabase
          .from('production_entries')
          .select('id, stage, status')
          .ilike('serial_no', cleanSerial)
          .neq('stage', cleanActivity)
          .in('status', ['In Progress', 'Completed']);

        if (!isActive) return;

        if (allOtherEntries && allOtherEntries.length > 0) {
          // Build set of activities that have at least one Completed entry
          const completedActivities = new Set(
            allOtherEntries.filter(e => e.status === 'Completed').map(e => e.stage)
          );
          // A true in-progress activity has In Progress status but is NOT in the completed set
          const trueInProgress = allOtherEntries.some(
            e => e.status === 'In Progress' && !completedActivities.has(e.stage)
          );
          setHasOtherInProgress(trueInProgress);
        } else {
          setHasOtherInProgress(false);
        }

      } catch (err) {
        if (isActive) {
          setHasOtherInProgress(false);
        }
      } finally {
        if (isActive) setIsFetchingLastLog(false);
      }
    };

    checkInProgress();
    return () => { isActive = false; };

  }, [debouncedSerialNo, activity, scanTrigger]);

  // endDate is now managed by the predicted-finish effect above (see Prompt 7).

  const calculateNetInWindow = (start: number, end: number, winStart: number, winEnd: number, dateStr?: string) => {
    const s = Math.max(start, winStart);
    const e = Math.min(end, winEnd);
    if (s >= e) return 0;
    let totalBreakMins = 0;
    activeBreaks.forEach(b => {
      const bs = toMins(b.start);
      const be = toMins(b.end);
      if (b.name === 'Non Working Hours') return;
      const os = Math.max(s, bs);
      const oe = Math.min(e, be);
      if (os < oe) {
        if (s <= bs && e >= be) {
          totalBreakMins += (be - bs);
        }
      }
    });
    return (e - s) - totalBreakMins;
  };

  const multiDaySplits = useMemo(() => {
    const startMs = toStandardMs(productionDate, startTime);
    const endMs = toStandardMs(endDate, endTime);
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return [];
    
    const assignments: { date: string; shift: 'Shift 1' | 'Shift 2' | 'Shift 3'; minutes: number; segStart: string; segEnd: string }[] = [];
    const d = new Date(productionDate);
    const endD = new Date(endDate);
    
    while (d <= endD) {
      const dateStr = formatDateISO(d);
      const isSunday = d.getDay() === 0;
      const isHoliday = HOLIDAYS_LIST.includes(dateStr);
      const isNonWorkingDay = isSunday || isHoliday;

      // Overtime detection on non-working days:
      // If operator commenced OR continued working at/after operational start (07:00)
      // on this day, it's genuine overtime — allow full shift processing.
      // If they only worked before 07:00, it's Saturday night's Shift 3 wrapping up.
      let isOvertimeDay = false;
      if (isNonWorkingDay) {
        const dayStartMs2 = new Date(`${dateStr}T00:00:00`).getTime();
        const opStart = activeShiftBoundaries.s3End || activeShiftBoundaries.s1Start;
        
        if (dateStr === productionDate) {
          // Start day: check if operator started at or after 07:00
          const relStartOnDay = Math.max(0, (startMs - dayStartMs2) / 60000);
          if (relStartOnDay >= opStart) isOvertimeDay = true;
        }
        if (dateStr === endDate) {
          // End day: check if operator continued past 07:00
          const relEndOnDay = Math.min(1440, (endMs - dayStartMs2) / 60000);
          if (relEndOnDay > opStart) isOvertimeDay = true;
        }
      }

      // Non-working day handling:
      // - Overtime day: allow through for full shift processing
      // - Has Shift 3 (Chakan): allow through for S3 continuation check below
      // - No Shift 3 (Ambernath) + no overtime: skip entirely
      if (isNonWorkingDay && !isOvertimeDay && !(activeShiftBoundaries.s3Start > 0)) {
        d.setDate(d.getDate() + 1);
        continue;
      }

      const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
      const relStart = Math.max(0, (startMs - dayStart) / 60000);
      const relEnd = Math.min(1440, (endMs - dayStart) / 60000);

      if (relStart < relEnd) {
        const hasShift2 = activeShiftBoundaries.s2Start > 0;
        const hasShift3 = activeShiftBoundaries.s3Start > 0;
        const splitPoint = hasShift2 ? (activeShiftBoundaries.s1End || 930) : (activeShiftBoundaries.s1End || 1440);

        // Shift 3 continuation: midnight (00:00) to s3End (07:00)
        // This is the overnight portion of Shift 3 from the previous day.
        // It must be checked BEFORE Shift 1 to avoid incorrectly absorbing
        // the 00:00-07:00 window into Shift 1.
        if (hasShift3 && relStart < activeShiftBoundaries.s3End) {
          const prevD = new Date(d);
          prevD.setDate(prevD.getDate() - 1);
          const prevDateStr = formatDateISO(prevD);
          const prevIsSunday = prevD.getDay() === 0;
          const prevIsNonWorking = prevIsSunday || HOLIDAYS_LIST.includes(prevDateStr);

          // Attribute overnight hours to previous day only if it was a working day.
          // If previous day was Sunday/holiday, no Shift 3 originated that night,
          // so these continuation hours are orphaned — skip them.
          if (!prevIsNonWorking) {
            const s3ContMins = calculateNetInWindow(relStart, relEnd, 0, activeShiftBoundaries.s3End, dateStr);
            if (s3ContMins > 0) {
              assignments.push({
                date: prevDateStr,
                shift: 'Shift 3',
                minutes: s3ContMins,
                segStart: fromMins(Math.max(relStart, 0)),
                segEnd: fromMins(Math.min(relEnd, activeShiftBoundaries.s3End))
              });
            }
          }
        }

        // Shift 1, 2, and Shift 3 end-of-day: only on working days or confirmed overtime days.
        // On regular non-working days, only the Shift 3 continuation (00:00-07:00) above applies.
        if (!isNonWorkingDay || isOvertimeDay) {
          // Shift 1: s1Start (07:00) to s1End (15:30)
          const s1ActualStart = hasShift3 ? activeShiftBoundaries.s3End : activeShiftBoundaries.s1Start;
          const s1Mins = calculateNetInWindow(relStart, relEnd, s1ActualStart, splitPoint, dateStr);
          if (s1Mins > 0) assignments.push({ 
            date: dateStr, 
            shift: 'Shift 1', 
            minutes: s1Mins, 
            segStart: fromMins(Math.max(relStart, activeShiftBoundaries.s1Start)), 
            segEnd: fromMins(Math.min(relEnd, splitPoint)) 
          });

          // Shift 2: s2Start (15:00) to s2End (23:30)
          if (hasShift2) {
            const s2End = hasShift3 ? activeShiftBoundaries.s3Start : (activeShiftBoundaries.s2End || 1440);
            const s2Mins = calculateNetInWindow(relStart, relEnd, splitPoint, s2End, dateStr);
            if (s2Mins > 0) assignments.push({ 
              date: dateStr, 
              shift: 'Shift 2', 
              minutes: s2Mins, 
              segStart: fromMins(Math.max(relStart, splitPoint)), 
              segEnd: fromMins(Math.min(relEnd, activeShiftBoundaries.s2End || S2_END)) 
            });

            // Shift 3 end-of-day: s3Start (23:30) to midnight
            if (hasShift3) {
              const s3Mins = calculateNetInWindow(relStart, relEnd, activeShiftBoundaries.s3Start, 1440, dateStr);
              if (s3Mins > 0) assignments.push({
                date: dateStr,
                shift: 'Shift 3',
                minutes: s3Mins,
                segStart: fromMins(Math.max(relStart, activeShiftBoundaries.s3Start)),
                segEnd: fromMins(1440)
              });
            }
          }
        }
      }
      d.setDate(d.getDate() + 1);
    }
    
    // Aggregate splits by date and shift
    const aggregated: Record<string, typeof assignments[0]> = {};
    assignments.forEach(a => {
      const key = `${a.date}-${a.shift}`;
      if (aggregated[key]) {
        aggregated[key].minutes += a.minutes;
        if (a.segStart >= '12:00') {
          aggregated[key].segStart = a.segStart;
        } else {
          aggregated[key].segEnd = a.segEnd;
        }
      } else {
        aggregated[key] = { ...a };
      }
    });

    return Object.values(aggregated).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.shift.localeCompare(b.shift);
    });
  }, [productionDate, endDate, startTime, endTime, activeBreaks, activeShiftBoundaries]);

  useEffect(() => {
    const nextInputs: Record<string, AssignmentInput> = {};
    multiDaySplits.forEach(split => {
      const key = `${split.date}-${split.shift}`;
      nextInputs[key] = assignmentInputs[key] || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
    });
    setAssignmentInputs(nextInputs);
  }, [multiDaySplits]);

  const standardTime = useMemo(() => activeActivityStandards[activity] || 0, [activity, activeActivityStandards]);
  const totalActual = useMemo(() => multiDaySplits.reduce((acc, s) => acc + s.minutes, 0), [multiDaySplits]);

  useEffect(() => {
    if (isAutoLoss) {
      const variance = totalActual - standardTime;
      let loss = 0;
      if (variance > 0) {
        const totalCreditedMins = multiDaySplits.reduce((acc, s) => acc + s.minutes, 0);
        multiDaySplits.forEach(split => {
          const key = `${split.date}-${split.shift}`;
          const input = (assignmentInputs[key] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
          const ratio = split.minutes / totalCreditedMins;
          loss += ((variance * ratio) / 60) * Math.max(1, input.count);
        });
      }
      setLossHours(Number(loss.toFixed(2)));
    }
  }, [totalActual, standardTime, assignmentInputs, isAutoLoss, multiDaySplits]);

  const startScanner = () => {
    setIsScanning('scan');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("barcode-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((decodedText) => { handleScanResult(decodedText); scanner.clear(); setIsScanning(null); }, (error) => {});
      scannerRef.current = scanner;
    }, 100);
  };

  const handleScanResult = (text: string) => {
    const parts = text.split('|').map(p => p.trim());
    
    // Capture real-time of the scan
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dateStr = formatDateISO(now);
    setScanTime(timeStr);
    setScanDate(dateStr);
    setStartTime(timeStr);
    setProductionDate(dateStr);
    setScanTrigger(prev => prev + 1);
    setUserHasSelectedActivity(true);

    const findMatchingValue = (list: string[], scannedValue: string) => {
      if (!scannedValue) return null;
      return list.find(item => item.trim().toUpperCase() === scannedValue.toUpperCase());
    };

    let scannedSerial = '';
    let qrModel: string | null | undefined = null;
    let qrLine: string | null | undefined = null;

    if (parts.length >= 5) {
      setUnitSrNo(parts[0]);
      scannedSerial = parts[1];
      setSerialNo(parts[1]);
      qrModel = findMatchingValue(MODELS_LIST, parts[2]);
      qrLine = findMatchingValue(PRODUCT_LINES_LIST, parts[3]);
      setSoSqNo(parts[4]);
    } else if (parts.length === 4) {
      scannedSerial = parts[0];
      setSerialNo(parts[0]);
      qrModel = findMatchingValue(MODELS_LIST, parts[1]);
      qrLine = findMatchingValue(PRODUCT_LINES_LIST, parts[2]);
      setSoSqNo(parts[3]);
    } else {
      scannedSerial = parts[0];
      setSerialNo(parts[0]);
    }

    // --- Identity resolution ------------------------------------------------
    // The SERIAL NUMBER is authoritative for plant / model / product line.
    // The model and line tokens inside the QR payload are only a fallback,
    // because label formats vary and rarely match the master lists exactly.
    const identity = resolveIdentityFromSerial(scannedSerial);

    if (identity) {
      // Admin / Management follow the scanned unit to its own plant.
      if (canSwitchPlant && identity.plant !== activePlant) {
        setActivePlant(identity.plant);
      }
      setModel(identity.model);
      if (identity.productLine) setProductLine(identity.productLine);
      else if (qrLine) setProductLine(qrLine);
    } else {
      if (qrModel) setModel(qrModel);
      if (qrLine) setProductLine(qrLine);
    }
    // ------------------------------------------------------------------------
  };

  const stopScanner = () => {
    if (scannerRef.current) { scannerRef.current.clear(); scannerRef.current = null; }
    setIsScanning(null);
  };

  // Copies reason fields only (not manpower) from one shift row to ALL other shift rows
  const applyReasonToAllShifts = (sourceKey: string) => {
    const source = assignmentInputs[sourceKey] as AssignmentInput;
    if (!source) return;
    const updates: Record<string, AssignmentInput> = {};
    multiDaySplits.forEach(split => {
      const k = `${split.date}-${split.shift}`;
      if (k !== sourceKey) {
        const existing = (assignmentInputs[k] as AssignmentInput) || { operators: [], count: 0 };
        updates[k] = {
          ...existing,
          affectedParameter: source.affectedParameter,
          defectCategory: source.defectCategory,
          issueDescription: source.issueDescription
        };
      }
    });
    setAssignmentInputs(prev => ({ ...prev, ...updates }));
  };

  // Single write path for Issue Description (used by both keyboard and voice input).
  // Preserves existing behaviour: editing the FIRST shift card overwrites all other shift rows.
  const setShiftIssueDescription = (key: string, val: string, isFirstShift: boolean) => {
    setAssignmentInputs(prev => {
      const updated = { ...prev, [key]: { ...prev[key], issueDescription: val } };
      if (isFirstShift) {
        multiDaySplits.forEach(s => {
          const k2 = `${s.date}-${s.shift}`;
          if (k2 !== key) {
            const existing = (prev[k2] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
            updated[k2] = { ...existing, issueDescription: val };
          }
        });
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isBlockingStart = !activeInProgressEntry && isAlreadyLogged;
    if (!serialNo) { alert("DIAG-A1: No serial number."); return; }
    if (isFetchingLastLog) { alert("DIAG-A2: isFetchingLastLog is stuck TRUE — the unit-history lookup never completed. This is the blocker."); return; }
    if (isBlockingStart) { alert("DIAG-A3: isAlreadyLogged blocked a commence."); return; }

    if (activeInProgressEntry) {
      // Check 1: All shifts have zero headcount
      const allZeroHeadcount = (Object.values(assignmentInputs) as AssignmentInput[]).every(inp => inp.count === 0);
      if (allZeroHeadcount) { alert("Resource Allocation required: Please select operators for the shifts worked."); return; }

      // Check 2: Each individual shift must have headcount > 0
      const missingManpower = multiDaySplits.find(split => {
        const key = `${split.date}-${split.shift}`;
        const inp = assignmentInputs[key] as AssignmentInput;
        return !inp || inp.count === 0;
      });
      if (missingManpower) {
        alert(`Manpower required: Please enter headcount for ${missingManpower.shift} on ${missingManpower.date}.`);
        return;
      }

      // Check 3: Each shift must have loss reason filled (if any loss exists)
      if (lossHours > 0) {
        const missingReason = multiDaySplits.find(split => {
          const key = `${split.date}-${split.shift}`;
          const inp = assignmentInputs[key] as AssignmentInput;
          return !inp || !inp.affectedParameter || !inp.defectCategory;
        });
        if (missingReason) {
          alert(`Loss Attribution required: Please fill the Affected Parameter and Defect Category for ${missingReason.shift} on ${missingReason.date}.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const entriesToSave: ProductionEntry[] = [];
    const getUUID = () => Math.random().toString(36).substring(2, 15);

    try {
      if (!activeInProgressEntry) {
        if (idleGapMinutes > 0 && lastLog) {
          if (idleGapMinutes >= 10 && (!idleAttribution.affectedParameter || !idleAttribution.defectCategory || !idleAttribution.issueDescription)) {
            alert("Gap Detected: Inter-Activity Loss attribution required for gaps of 10 minutes or more.");
            setIsSubmitting(false);
            return;
          }
          const idleHrs = Number((idleGapMinutes / 60).toFixed(4));
          entriesToSave.push({
            id: getUUID(),
            plant: context.plant,
            stage: "Idle / Transition",
            productLine, model, serialNo, unitSrNo, soSqNo,
            productionDate: lastLog.endDate, // Attribution now correctly follows production context
            endDate: productionDate,
            shift: 'Shift 1', activity: "Inter-Activity Idle Time",
            manpower: 1, manpowerNames: [], assignments: [],
            startTime: lastLog.endTime, endTime: startTime,
            standardCycleTime: 0, actualCycleTime: idleGapMinutes,
            shift1ActualMinutes: 0, shift2ActualMinutes: 0,
            variance: idleGapMinutes, manhoursEngaged: idleHrs,
            lossHours: idleHrs, lossReason: idleAttribution.defectCategory || 'Minor Transition',
            affectedParameter: idleAttribution.affectedParameter || 'Standard Operation',
            defectCategory: idleAttribution.defectCategory || 'Minor Transition',
            issueDescription: idleAttribution.issueDescription || `Auto-logged: ${idleGapMinutes} min transition gap (under 10 min threshold)`,
            notes: idleAttribution.issueDescription ? `Gap Audit: ${idleAttribution.issueDescription}` : `Auto-logged: ${idleGapMinutes} min minor transition gap`,
            status: 'Completed', createdAt: new Date().toISOString(), is_gap: true
          });
        }

        entriesToSave.push({
          id: getUUID(),
          plant: context.plant,
          stage, productLine, model, serialNo, unitSrNo, soSqNo,
          productionDate, endDate: productionDate,
          shift: multiDaySplits[0]?.shift || 'Shift 1',
          activity, manpower: 0, manpowerNames: [], assignments: [],
          startTime, endTime: '00:00',
          standardCycleTime: standardTime, actualCycleTime: 0,
          shift1ActualMinutes: 0, shift2ActualMinutes: 0,
          variance: 0, manhoursEngaged: 0, lossHours: 0,
          lossReason: '', status: 'In Progress',
          notes: '',
          createdAt: new Date().toISOString()
        });
      } else {
        // Each shift split ends on its own calendar date, not on the activity's
        // overall end date. A segment whose end time is at or before its start
        // time has wrapped past midnight and closes on the following day.
        const segmentEndDate = (segDate: string, segStart: string, segEnd: string) => {
          const [y, mo, dd] = String(segDate || '').split('-').map(Number);
          if (!y || !mo || !dd) return segDate;
          const d = new Date(y, mo - 1, dd);
          if (String(segEnd).slice(0, 5) <= String(segStart).slice(0, 5)) d.setDate(d.getDate() + 1);
          const p = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        };

        multiDaySplits.forEach((split, idx) => {
          const key = `${split.date}-${split.shift}`;
          const input = (assignmentInputs[key] as AssignmentInput);
          const allocatedLoss = (split.minutes / (totalActual || 1)) * lossHours;
          
          entriesToSave.push({
            id: idx === 0 ? activeInProgressEntry.id : getUUID(),
            plant: activeInProgressEntry.plant,
            stage, productLine, model, serialNo, unitSrNo, soSqNo,
            productionDate: split.date,
            endDate: segmentEndDate(split.date, split.segStart, split.segEnd),
            shift: split.shift, activity,
            manpower: input.count, manpowerNames: input.operators,
            assignments: [{
              date: split.date, shift: split.shift, operators: input.operators,
              actualMinutes: split.minutes, startTime: split.segStart, endTime: split.segEnd,
              affectedParameter: input.affectedParameter, defectCategory: input.defectCategory,
              issueDescription: input.issueDescription
            }],
            startTime: split.segStart, endTime: split.segEnd,
            standardCycleTime: Number(((split.minutes / (totalActual || 1)) * standardTime).toFixed(2)),
            actualCycleTime: split.minutes,
            shift1ActualMinutes: split.shift === 'Shift 1' ? split.minutes : 0,
            shift2ActualMinutes: split.shift === 'Shift 2' ? split.minutes : 0,
            variance: Number((split.minutes - ((split.minutes / (totalActual || 1)) * standardTime)).toFixed(2)),
            manhoursEngaged: (split.minutes / 60) * input.count,
            lossHours: allocatedLoss, lossReason: input.defectCategory || 'Standard Operation',
            affectedParameter: input.affectedParameter, defectCategory: input.defectCategory,
            issueDescription: input.issueDescription,
            notes: activeInProgressEntry.notes, 
            status: 'Completed',
            createdAt: idx === 0 ? activeInProgressEntry.createdAt : new Date().toISOString()
          });
        });
      }

      if (entriesToSave.length === 0) {
        alert(
          "Nothing to save.\n\nNo shift segments were generated for this time range. " +
          "Check that the completion date/time is after the commencement date/time and " +
          "falls inside a working shift window."
        );
        setIsSubmitting(false);
        return;
      }

      const saved = await onAddEntry(entriesToSave);
      if (saved === false) {
        // Save failed — keep the form populated so the operator can retry
        // without re-entering everything. Previously the success overlay showed
        // and the form cleared even when nothing was written.
        setIsSubmitting(false);
        return;
      }

      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 4000);

      if (!activeInProgressEntry || entriesToSave.some(e => e.status === 'Completed')) {
        const todayStr = formatDateISO(new Date());
        const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        setSerialNo(''); setUnitSrNo(''); setSoSqNo(''); setAssignmentInputs({});
        setIdleAttribution({ affectedParameter: '', defectCategory: '', issueDescription: '' });
        setUserHasSelectedActivity(false);
        setActiveInProgressEntry(null);
        setProductionDate(todayStr);
        setEndDate(todayStr);
        setStartTime(nowStr);
        setEndTime(nowStr);
      }
    } catch (err: any) {
      console.error('[PROTRACK COMMIT FAILURE]', err);
      alert(
        `DIAG-B: Commit threw an exception.\n\n${err?.name || 'Error'}: ${err?.message || String(err)}\n\n` +
        `Full stack is in the browser console (F12).`
      );
    } finally { setIsSubmitting(false); }
  };
  
  const availableOperators = useMemo(() => {
    if (!productLine || !model) return [];
    // For Ambernath, prefer model lookup to ensure correct operator list
    if (activePlant?.toUpperCase() === 'AMBERNATH') {
      return OPERATORS_BY_MODEL_LINE[model] || OPERATORS_BY_MODEL_LINE[productLine] || [];
    }
    return OPERATORS_BY_MODEL_LINE[productLine] || OPERATORS_BY_MODEL_LINE[model] || [];
  }, [model, productLine, activePlant]);

  return (
    <div className="max-w-6xl mx-auto py-4">
      {showSuccessOverlay && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Transmission Success</h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase tracking-wider">The production record has been securely committed to the Enterprise MES.</p>
            </div>
            <button 
              onClick={() => setShowSuccessOverlay(false)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} /> Acknowledge
            </button>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><Scan className="text-blue-600 animate-pulse" size={24} /><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Unit Identification</h3></div>
              <button onClick={stopScanner} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div id="barcode-reader" className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-slate-50"></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-3"><Users className="text-blue-500" size={20} /><h3 className="text-lg font-bold text-slate-800 tracking-tight">{activeInProgressEntry ? 'Complete Active Activity' : 'Commence Production Stage'}</h3></div>
          <div className="flex items-center gap-6">
             <div className="text-right"><p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Target Cycle Time</p><p className="text-sm font-black text-blue-600">{standardTime} Min</p></div>
             <div className="text-right"><p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Total Duration</p><p className="text-sm font-black text-slate-900">{totalActual} Min</p></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="flex flex-col items-center gap-4 pb-4">
            {canSwitchPlant && (
              <div className="flex items-center gap-2 bg-slate-900/5 p-1.5 rounded-2xl border border-slate-200">
                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                  <Factory size={14} className="text-blue-500" />
                </div>
                <div className="flex gap-1">
                  {Object.keys(PLANT_REGISTRY).map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={!!activeInProgressEntry}
                      onClick={() => setActivePlant(p)}
                      className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        activePlant?.toUpperCase() === p
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
            <button type="button" onClick={startScanner} className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"><Scan size={20} /> Barcode Scan Unit</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <CalendarDays size={14} className="text-blue-500" /> Commencement Date
               </label>
               <FormDateTimeInput type="date" value={productionDate} onChange={setProductionDate} disabled={!!activeInProgressEntry} readOnly={!isAdmin} />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Clock3 size={14} className="text-blue-500" /> Shift Indicator
               </label>
               <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-black text-blue-600 shadow-inner flex items-center justify-center">
                 {activeInProgressEntry ? activeInProgressEntry.shift : (multiDaySplits[0]?.shift || 'Shift 1')}
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Box size={14} className="text-blue-500" /> Unit Model
               </label>
               <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!!activeInProgressEntry} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold shadow-sm text-[#002060]">
                 {filteredModels.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Layers size={14} className="text-blue-500" /> Product Line
               </label>
               <select value={productLine} onChange={(e) => setProductLine(e.target.value)} disabled={!!activeInProgressEntry} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold shadow-sm text-[#002060]">
                 {filteredProductLines.map(pl => <option key={pl} value={pl}>{pl}</option>)}
               </select>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Hash size={14} className="text-blue-500" /> Unit Sr. No.
               </label>
               <input type="text" value={unitSrNo} onChange={(e) => setUnitSrNo(e.target.value)} placeholder="Unit SN..." className="w-full px-4 py-2 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold shadow-sm text-[#002060]" />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Tag size={14} className="text-blue-500" /> Serial Number
               </label>
               <div className="relative">
                 <input
                   type="text"
                   value={serialNo}
                   readOnly
                   placeholder="Scan barcode to populate..."
                   className="w-full pl-4 pr-10 py-2 bg-slate-100 border border-slate-200 rounded-[1.5rem] text-sm font-bold shadow-sm text-[#002060] cursor-not-allowed select-none"
                   required
                 />
                 {isFetchingLastLog
                   ? <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
                   : serialNo
                     ? <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                     : <Scan size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 }
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <FileText size={14} className="text-blue-500" /> SO / SQ Number
               </label>
               <input type="text" value={soSqNo} onChange={(e) => setSoSqNo(e.target.value)} placeholder="SO-0000" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold shadow-sm text-[#002060]" />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
             <div className="space-y-3">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Layout size={14} className="text-blue-500" /> Select Stage
               </label>
               <select value={stage} onChange={(e) => { const nextStage = e.target.value; setStage(nextStage); setActivity(activeStageMapping[nextStage][0]); setUserHasSelectedActivity(true); setScanTime(null); setScanDate(null); }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-[#002060]">
                 {activeStagesList.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>
             <div className="space-y-3">
               <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                 <Activity size={14} className="text-blue-500" /> Production Activity
               </label>
               <select value={activity} onChange={(e) => { setActivity(e.target.value); setUserHasSelectedActivity(true); setScanTime(null); setScanDate(null); }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-[#002060]">
                 {(activeStageMapping[stage] || []).map(a => <option key={a} value={a}>{a}</option>)}
               </select>
             </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4 animate-in fade-in duration-300">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-blue-100 shrink-0">
              <Info className="text-blue-600" size={24} />
            </div>
            <div>
              <h4 className="text-md font-bold text-blue-900 leading-tight mb-1">Standard for {activity}</h4>
              <p className="text-sm text-blue-700/80 font-medium">
                Expected Cycle Time: <span className="font-black text-blue-600">{standardTime} Minutes ({(standardTime / 60).toFixed(2)} Hrs)</span> (Excl. Breaks)
              </p>
            </div>
          </div>

          {isAlreadyLogged && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4 animate-in fade-in duration-300">
              <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={24} />
              <div><h4 className="text-sm font-black text-amber-900 leading-tight mb-1">Activity Already Logged</h4><p className="text-xs font-bold text-emerald-700/80 leading-relaxed">The activity "{activity}" is already marked as completed for unit {serialNo}.</p></div>
            </div>
          )}

          {activeInProgressEntry && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-start gap-4 animate-in fade-in duration-300">
              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={24} />
              <div><h4 className="text-sm font-black text-emerald-900 leading-tight mb-1">Unit In Progress</h4><p className="text-xs font-bold text-emerald-700/80 leading-relaxed">Active session found for {serialNo} at {activity}. Started at {activeInProgressEntry.startTime} on {activeInProgressEntry.productionDate}.</p></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                <ArrowRight size={14} className="text-blue-500" /> Commencement
              </label>
              <div className="grid grid-cols-2 gap-3">
                <FormDateTimeInput type="date" value={productionDate} onChange={setProductionDate} paddingY="py-3" disabled={!!activeInProgressEntry} readOnly={!isAdmin} /><FormDateTimeInput type="time" value={startTime} onChange={setStartTime} paddingY="py-3" disabled={!!activeInProgressEntry} readOnly={!isAdmin} />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                <CheckCircle2 size={14} className="text-emerald-500" /> Completion
              </label>
              <div className="grid grid-cols-2 gap-3">
                <FormDateTimeInput type="date" value={endDate} onChange={setEndDate} paddingY="py-3" disabled={!activeInProgressEntry} readOnly={!isAdmin} /><FormDateTimeInput type="time" value={endTime} onChange={setEndTime} paddingY="py-3" disabled={!activeInProgressEntry} readOnly={!isAdmin} />
              </div>
            </div>
          </div>

          {activeInProgressEntry && (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shadow-sm">
                  <ListChecks size={22} />
                </div>
                <h4 className="text-lg font-bold text-slate-800 tracking-tight">Shift Resource Allocation</h4>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {multiDaySplits.map((split) => {
                  const key = `${split.date}-${split.shift}`;
                  const input = (assignmentInputs[key] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
                  const allocatedLoss = (split.minutes / (totalActual || 1)) * lossHours;
                  return (
                    <div key={key} className="bg-white border-2 border-emerald-100 rounded-[2.5rem] p-6 shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <CalendarDays size={20} />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{split.date}</p>
                            <h5 className="text-lg font-black text-slate-900 tracking-tight">{split.shift}</h5>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 items-center">
                          <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center flex items-center gap-3">
                            <Clock3 size={14} className="text-blue-500" />
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                              <p className="text-sm font-black text-slate-900">{split.minutes} Mins</p>
                            </div>
                          </div>
                          {(() => {
                            const isFirstShift = multiDaySplits.indexOf(split) === 0;
                            const hasMultipleShifts = multiDaySplits.length > 1;
                            if (!isFirstShift || !hasMultipleShifts || allocatedLoss === 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => applyReasonToAllShifts(key)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                <Copy size={11} />
                                Apply reason to all shifts
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                            <Users size={14} className="text-blue-500" /> Personnel Deployment
                          </label>
                          <OperatorMultiSelect options={availableOperators} selected={input.operators} onChange={(selected) => {
                            setAssignmentInputs(prev => {
                              const updated = { ...prev, [key]: { ...prev[key], operators: selected, count: selected.length } };
                              // Only propagate if this is the FIRST occurrence of this shift type
                              const isFirstOfShiftType = multiDaySplits.findIndex(s => s.shift === split.shift) === multiDaySplits.indexOf(split);
                              if (isFirstOfShiftType) {
                                // Always overwrite same-shift-type rows so all selections (including incremental) propagate fully
                                multiDaySplits.forEach(s => {
                                  const k2 = `${s.date}-${s.shift}`;
                                  if (s.shift === split.shift && k2 !== key) {
                                    const existing = (prev[k2] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
                                    updated[k2] = { ...existing, operators: selected, count: selected.length };
                                  }
                                });
                              }
                              return updated;
                            });
                          }} />
                        </div>
                        <div className="space-y-1 flex flex-col justify-end">
                          <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                              <Activity size={14} className="text-blue-500" /> Total Headcount
                            </label>
                            <span className={`text-xs font-black ${input.count === 0 ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`}>{input.count} Manpower</span>
                          </div>
                          <div className="flex items-center gap-4 py-2">
                            <input type="range" min="0" max="15" value={input.count} onChange={(e) => {
                              const val = Number(e.target.value);
                              setAssignmentInputs(prev => {
                                const updated = { ...prev, [key]: { ...prev[key], count: val } };
                                // Sticky: pre-fill headcount into same-shift-type rows across other days if still empty
                                multiDaySplits.forEach(s => {
                                  const k2 = `${s.date}-${s.shift}`;
                                  if (s.shift === split.shift && k2 !== key) {
                                    const existing = (prev[k2] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
                                    if (!existing.count || existing.count === 0) {
                                      updated[k2] = { ...existing, count: val };
                                    }
                                  }
                                });
                                return updated;
                              });
                            }} className="flex-1 accent-blue-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" />
                          </div>
                        </div>
                      </div>
                      {allocatedLoss > 0 && (
                        <div className="pt-2 py-2 border-t border-slate-100 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                                <Filter size={14} className="text-rose-500" /> Affected Parameter
                              </label>
                              <select value={input.affectedParameter} onChange={(e) => {
                                const val = e.target.value;
                                setAssignmentInputs(prev => {
                                  const updated = { ...prev, [key]: { ...prev[key], affectedParameter: val, defectCategory: '' } };
                                  // Sticky: pre-fill into ALL subsequent shift rows if still empty
                                  multiDaySplits.forEach(s => {
                                    const k2 = `${s.date}-${s.shift}`;
                                    if (k2 !== key) {
                                      const existing = (prev[k2] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
                                      if (!existing.affectedParameter) {
                                        updated[k2] = { ...existing, affectedParameter: val, defectCategory: '' };
                                      }
                                    }
                                  });
                                  return updated;
                                });
                              }} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#002060]">
                                <option value="">Select Parameter</option>
                                {Object.keys(LOSS_PARAMETER_MAPPING).map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                                <AlertCircle size={14} className="text-rose-500" /> Defect Category
                              </label>
                              <select value={input.defectCategory} onChange={(e) => {
                                const val = e.target.value;
                                setAssignmentInputs(prev => {
                                  const updated = { ...prev, [key]: { ...prev[key], defectCategory: val } };
                                  // Sticky: pre-fill into ALL subsequent shift rows if still empty
                                  multiDaySplits.forEach(s => {
                                    const k2 = `${s.date}-${s.shift}`;
                                    if (k2 !== key) {
                                      const existing = (prev[k2] as AssignmentInput) || { operators: [], count: 0, affectedParameter: '', defectCategory: '', issueDescription: '' };
                                      if (!existing.defectCategory) {
                                        updated[k2] = { ...existing, defectCategory: val };
                                      }
                                    }
                                  });
                                  return updated;
                                });
                              }} disabled={!input.affectedParameter} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#002060]">
                                <option value="">Select Category</option>
                                {(LOSS_PARAMETER_MAPPING[input.affectedParameter] || []).map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                                <FileText size={14} className="text-rose-500" /> Issue Description
                              </label>
                              <VoiceInput
                                tone="rose"
                                currentText={input.issueDescription || ''}
                                onTranscript={(merged) => setShiftIssueDescription(key, merged, multiDaySplits.indexOf(split) === 0)}
                              />
                            </div>
                            <textarea value={input.issueDescription} onChange={(e) => {
                              setShiftIssueDescription(key, e.target.value, multiDaySplits.indexOf(split) === 0);
                            }} placeholder="Type, or tap Speak and describe the bottleneck in English / Hindi / Marathi…" className="w-full px-5 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold min-h-[60px] text-[#002060]" rows={2} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                    <Clock3 size={14} className="text-rose-500" /> Production Loss (H)
                  </label>
                  <button type="button" onClick={() => setIsAutoLoss(!isAutoLoss)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Auto Calc</button>
                </div>
                <input type="number" step="0.01" value={lossHours} readOnly={isAutoLoss} onChange={(e) => setLossHours(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-[#002060]" />
              </div>
            </div>
          )}

          {idleGapMinutes > 0 && !activeInProgressEntry && (
            <div className="py-8 px-8 bg-indigo-50/30 border border-indigo-200 rounded-[2.5rem] space-y-6">
              <div className="flex flex-wrap items-baseline gap-4 border-b border-indigo-100 pb-5">
                <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                  <Clock3 size={24} />
                </div>
                <h4 className="text-xl font-black text-indigo-900 tracking-tight leading-none">Inter-Activity Idle Time Audit</h4>
                <div className="flex items-center gap-2 px-3 py-1 bg-[#4F46E5] text-white rounded-full text-[10px] font-black uppercase">LOSS: {(idleGapMinutes/60).toFixed(2)} HRS</div>
              </div>
              {idleGapMinutes < 10 ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <Info size={16} className="text-indigo-400 shrink-0" />
                  <p className="text-xs font-bold text-indigo-500">
                    Minor gap under 10 minutes — reason not required. Will be auto-logged as transition time.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-indigo-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Filter size={14} /> Affected Parameter
                      </label>
                      <select value={idleAttribution.affectedParameter} onChange={(e) => setIdleAttribution(prev => ({ ...prev, affectedParameter: e.target.value }))} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-[#002060]" required>
                        <option value="">Select Affected Parameter</option>
                        {Object.keys(LOSS_PARAMETER_MAPPING).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-indigo-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <AlertCircle size={14} /> Defect Category
                      </label>
                      <select value={idleAttribution.defectCategory} onChange={(e) => setIdleAttribution(prev => ({ ...prev, defectCategory: e.target.value }))} disabled={!idleAttribution.affectedParameter} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-[#002060]" required>
                        <option value="">Select Defect Category...</option>
                        {(LOSS_PARAMETER_MAPPING[idleAttribution.affectedParameter] || []).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <label className="text-[11px] font-black text-indigo-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <FileText size={14} /> Issue Description
                      </label>
                      <VoiceInput
                        tone="indigo"
                        currentText={idleAttribution.issueDescription || ''}
                        onTranscript={(merged) => setIdleAttribution(prev => ({ ...prev, issueDescription: merged }))}
                      />
                    </div>
                    <textarea value={idleAttribution.issueDescription} onChange={(e) => setIdleAttribution(prev => ({ ...prev, issueDescription: e.target.value }))} placeholder="Type, or tap Speak to explain the idle phase bottleneck..." className="w-full px-5 py-4 bg-white border border-indigo-100 rounded-[1.5rem] text-sm font-bold min-h-[100px] text-[#002060]" required />
                  </div>
                </>
              )}
            </div>
          )}

          <button 
            type="submit" 
            disabled={
              isSubmitting || 
              isFetchingLastLog || 
              (!activeInProgressEntry && isAlreadyLogged) 
            } 
            className={`w-full py-5 rounded-[1.5rem] font-bold text-sm uppercase tracking-[0.1em] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.99] disabled:opacity-50 ${activeInProgressEntry ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-[#0f172a] hover:bg-slate-800 text-white'}`}
          >
            {isSubmitting || isFetchingLastLog ? <Loader2 size={18} className="animate-spin" /> : activeInProgressEntry ? <CheckCircle2 size={18} /> : <Send size={18} />} 
            {activeInProgressEntry ? 'Commit Stage Data (Complete)' : 'Commence Activity (Start)'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface OperatorMultiSelectProps { options: string[]; selected: string[]; onChange: (selected: string[]) => void; }
const OperatorMultiSelect: React.FC<OperatorMultiSelectProps> = ({ options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()) && !selected.includes(opt));
  const removeSelected = (name: string) => onChange(selected.filter(s => s !== name));
  const addSelected = (name: string) => { if (!name.trim()) return; onChange([...selected, name.trim()]); setSearch(''); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && search.trim()) { e.preventDefault(); if (!selected.includes(search.trim())) addSelected(search.trim()); else setSearch(''); } };
  return (
    <div className="relative" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="min-h-[46px] w-full px-4 py-2 bg-white border border-slate-300 rounded-xl cursor-pointer flex flex-wrap gap-1.5 items-center shadow-sm hover:border-blue-300 transition-all">{selected.length === 0 && !search && <span className="text-slate-400 text-xs ml-1 font-semibold uppercase tracking-widest">Select operators...</span>}{selected.map(s => (<span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-100">{s}<X size={12} className="cursor-pointer hover:text-blue-900" onClick={(e) => { e.stopPropagation(); removeSelected(s); }} /></span>))}<input type="text" value={search} onKeyDown={handleKeyDown} onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }} className="flex-1 min-w-[60px] bg-transparent outline-none text-xs font-bold py-0.5 text-[#002060]" onClick={(e) => e.stopPropagation()} /><ChevronDown size={14} className={`text-slate-400 mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 p-2">
          {search && !filteredOptions.some(o => o.toLowerCase() === search.toLowerCase()) && (<div onClick={() => addSelected(search)} className="px-4 py-3 text-[11px] font-black text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-none uppercase tracking-wide italic">Add "{search}"</div>)}
          {filteredOptions.length > 0 ? filteredOptions.map(opt => (<div key={opt} onClick={() => addSelected(opt)} className="px-4 py-3 text-[11px] font-black text-slate-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors border-b border-slate-50 last:border-none uppercase tracking-wide">{opt}</div>)) : !search && (<div className="px-4 py-3 text-xs text-slate-400 font-bold uppercase tracking-widest italic text-center">No matching resources</div>)}
        </div>
      )}
    </div>
  );
};

export default OperatorEntry;