
import React, { useState, useMemo } from 'react';
import { Sparkles, BrainCircuit, RefreshCw, MessageSquare, Target, Zap, AlertCircle, TrendingDown, ClipboardCheck, Copy, Download, CheckCircle2, Filter, X, ChevronDown } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { ProductionEntry } from '../types';

interface GeminiInsightsProps {
  entries: ProductionEntry[];
}

const GeminiInsights: React.FC<GeminiInsightsProps> = ({ entries }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedSerial, setSelectedSerial] = useState<string>('');

  const availablePlants = useMemo(() => 
    [...new Set(entries.map(e => e.plant).filter(Boolean))].sort()
  , [entries]);

  const availableModels = useMemo(() => {
    const base = selectedPlant 
      ? entries.filter(e => e.plant === selectedPlant) 
      : entries;
    return [...new Set(base.map(e => e.model).filter(Boolean))].sort();
  }, [entries, selectedPlant]);

  const availableSerials = useMemo(() => {
    let base = entries;
    if (selectedPlant) base = base.filter(e => e.plant === selectedPlant);
    if (selectedModel) base = base.filter(e => e.model === selectedModel);
    return [...new Set(base.map(e => e.serialNo).filter(Boolean))].sort();
  }, [entries, selectedPlant, selectedModel]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (dateFrom) result = result.filter(e => e.productionDate >= dateFrom);
    if (dateTo) result = result.filter(e => e.productionDate <= dateTo);
    if (selectedPlant) result = result.filter(e => e.plant === selectedPlant);
    if (selectedModel) result = result.filter(e => e.model === selectedModel);
    if (selectedSerial) result = result.filter(e => e.serialNo === selectedSerial);
    return result;
  }, [entries, dateFrom, dateTo, selectedPlant, selectedModel, selectedSerial]);

  const hasActiveFilters = dateFrom || dateTo || selectedPlant || selectedModel || selectedSerial;

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedPlant('');
    setSelectedModel('');
    setSelectedSerial('');
  };

  const generateInsights = async () => {
    if (filteredEntries.length === 0) return;
    setLoading(true);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || 'AIzaSyA4kE2b8trIX8Jx-gArLoUOu3AnaHbwP_c';
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a Senior Operations Director with 20 years of experience in industrial manufacturing. 
Analyze the following production data for Vertiv India (Industrial Cooling Units — Chillers, PDX, FWU product lines).

DATA: ${JSON.stringify(filteredEntries.slice(-100).map(e => ({ 
  date: e.productionDate, 
  serial: e.serialNo,
  model: e.model,
  stage: e.stage, 
  activity: e.activity, 
  shift: e.shift,
  varianceMins: e.variance, 
  lossHrs: e.lossHours, 
  reason: e.lossReason,
  description: e.issueDescription
})), null, 2)}

UNITS: variance is in MINUTES (positive = delay, negative = ahead of schedule). lossHrs is in HOURS. Always express variance in hours (divide by 60). Never use the word "units" for measurements.

TASK: Generate a sharp, data-driven executive operations report using EXACTLY these four sections:

1. PERFORMANCE SCORECARD
Present a quick-read scorecard. Include: total loss hours, total variance hours, top 3 worst activities by loss, top 3 worst activities by variance, any activities running ahead of standard (negative variance). Be specific with numbers.

2. CRITICAL BOTTLENECKS
Identify the top 3-4 bottlenecks only. For each: name the exact stage and activity, state the loss hours, state the likely operational impact on downstream stages. Reference specific serial numbers or models if the data supports it. Do not list more than 4 bottlenecks.

3. ROOT CAUSE ANALYSIS
Group losses by their recorded reason (Production Delay, Absenteeism, Material Shortage, etc.). State what percentage or share each cause represents. Identify if losses are concentrated in a particular shift, model, or date range. Call out any activities where loss is recorded as Standard Operation — these indicate inaccurate standard times.

4. STRATEGIC RECOMMENDATIONS
Give exactly 4 recommendations. Rank them by priority (1 = highest impact, act now). For each: state the specific problem it solves, the expected benefit, and one concrete first action. Avoid generic consulting advice — recommendations must be grounded in the actual data provided.

FORMATTING: Clean text only. No markdown bold (*). No hashtags (#). Use dashes (-) for bullets. Keep each section concise — executives read fast.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setInsight(response.text || "No insights available.");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || 'Unknown error';
      setInsight(`Error: ${msg}`);
      console.error('GeminiInsights error:', error);
    } finally { setLoading(false); }
  };

  const copyToClipboard = () => {
    if (!insight) return;
    navigator.clipboard.writeText(insight.replace(/[#*]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFormattedInsight = (text: string) => {
    const sanitizedText = text.replace(/[#*]/g, '');
    const sections = sanitizedText.split(/(?=^\d\.\s+[A-Z]{2,})/m);
    return sections.map((section, idx) => {
      const lines = section.trim().split('\n');
      if (lines.length === 0 || !lines[0]) return null;
      const title = lines[0].replace(/^[1-9]\.\s?/, '').trim();
      const content = lines.slice(1);
      if (!title && idx === 0 && lines.length > 0) {
        return <div key="intro" className="md:col-span-2 p-6 bg-slate-100 rounded-2xl border border-slate-200 mb-4">{lines.map((line, lidx) => <p key={lidx} className="text-sm font-semibold text-slate-700">{line.trim()}</p>)}</div>;
      }
      if (!title) return null;
      const getIcon = (t: string) => {
        const low = t.toLowerCase();
        if (low.includes('scorecard')) return <Target className="text-blue-500" />;
        if (low.includes('bottleneck')) return <AlertCircle className="text-rose-500" />;
        if (low.includes('cause')) return <Zap className="text-amber-500" />;
        if (low.includes('recommendation')) return <ClipboardCheck className="text-emerald-500" />;
        return <TrendingDown className="text-slate-500" />;
      };
      const getBg = (t: string) => {
        const low = t.toLowerCase();
        if (low.includes('scorecard')) return 'bg-blue-50/50 border-blue-100';
        if (low.includes('bottleneck')) return 'bg-rose-50/50 border-rose-100';
        if (low.includes('cause')) return 'bg-amber-50/50 border-amber-100';
        if (low.includes('recommendation')) return 'bg-emerald-50/50 border-emerald-100';
        return 'bg-slate-50 border-slate-100';
      };
      return (
        <div key={idx} className={`p-6 rounded-2xl border ${getBg(title)} transition-all hover:shadow-md animate-in slide-in-from-bottom-2 duration-300`} style={{ animationDelay: `${idx * 100}ms` }}>
          <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-white rounded-xl shadow-sm border border-inherit">{getIcon(title)}</div><h4 className="text-[15px] font-black text-slate-900 uppercase tracking-tight">{title}</h4></div>
          <div className="space-y-3">{content.map((line, lidx) => {
            const cleanLine = line.trim().replace(/^[-•]\s?/, '');
            if (!cleanLine) return null;
            const isListItem = line.trim().startsWith('-') || line.trim().startsWith('•');
            return (<div key={lidx} className="flex gap-3 items-start group">{isListItem && <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0 group-hover:bg-blue-400 transition-colors" />}<p className={`text-[13px] leading-relaxed ${isListItem ? 'text-slate-700 font-semibold' : 'text-slate-500 font-medium'}`}>{cleanLine}</p></div>);
          })}</div>
        </div>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Filter Panel */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Analysis Scope
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-wider transition-all"
            >
              <X size={12} />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Date From */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          {/* Plant */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Plant
            </label>
            <div className="relative">
              <select
                value={selectedPlant}
                onChange={e => { setSelectedPlant(e.target.value); setSelectedModel(''); setSelectedSerial(''); }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none"
              >
                <option value="">All Plants</option>
                {availablePlants.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Model
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={e => { setSelectedModel(e.target.value); setSelectedSerial(''); }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none"
              >
                <option value="">All Models</option>
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Serial No */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Unit Serial No
            </label>
            <div className="relative">
              <select
                value={selectedSerial}
                onChange={e => setSelectedSerial(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none"
              >
                <option value="">All Units</option>
                {availableSerials.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

        </div>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active:</span>
            {selectedPlant && <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-black border border-blue-100">{selectedPlant}</span>}
            {selectedModel && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-black border border-indigo-100">{selectedModel}</span>}
            {selectedSerial && <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-lg text-[11px] font-black border border-violet-100">{selectedSerial}</span>}
            {dateFrom && <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black">From: {dateFrom}</span>}
            {dateTo && <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black">To: {dateTo}</span>}
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl transition-transform group-hover:scale-125 duration-1000" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6"><div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20"><BrainCircuit size={32} /></div><div><h3 className="text-2xl font-black tracking-tight">AI Operations Analyst</h3><p className="text-slate-400 text-sm font-medium tracking-wide">Enterprise Intelligence Engine v2.0</p></div></div>
          <p className="text-slate-300 mb-8 max-w-2xl leading-relaxed font-medium">Deep analysis of <span className="text-white font-black underline decoration-blue-500 decoration-2 underline-offset-4">{filteredEntries.length} live records</span> across multiple Stages and Activities.</p>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={generateInsights} disabled={loading || filteredEntries.length === 0} className="flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group/btn">
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} className="group-hover/btn:rotate-12 transition-transform" />}{loading ? 'Synthesizing...' : 'Start Analytical Sync'}
            </button>
            {insight && <div className="flex items-center gap-2"><button onClick={copyToClipboard} className="p-4 bg-slate-800 text-slate-300 rounded-2xl hover:bg-slate-700 hover:text-white transition-all shadow-lg">{copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}</button></div>}
          </div>
        </div>
      </div>
      {insight && <div className="space-y-8"><div className="flex items-center justify-between px-2"><div className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]"><MessageSquare size={14} />Live Strategic Report</div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{renderFormattedInsight(insight)}</div></div>}
    </div>
  );
};

export default GeminiInsights;
