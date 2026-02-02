
import React, { useState } from 'react';
import { Sparkles, BrainCircuit, RefreshCw, MessageSquare, Target, Zap, AlertCircle, TrendingDown, ClipboardCheck, Copy, Download, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { ProductionEntry } from '../types';

interface GeminiInsightsProps {
  entries: ProductionEntry[];
}

const GeminiInsights: React.FC<GeminiInsightsProps> = ({ entries }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInsights = async () => {
    if (entries.length === 0) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as an Executive Industrial Consultant. Analyze the following manufacturing data for Vertiv (Industrial Cooling Units). 
      DATA: ${JSON.stringify(entries.slice(-20).map(e => ({ stage: e.stage, activity: e.activity, variance: e.variance, loss: e.lossHours, reason: e.lossReason })), null, 2)}
      TASK: Generate a professional executive report. Use these EXACT headers: 1. PERFORMANCE SCORECARD, 2. CRITICAL BOTTLENECKS, 3. ROOT CAUSE ANALYSIS, 4. STRATEGIC RECOMMENDATIONS.
      TERMINOLOGY: 'Stage' refers to a production group/section. 'Activity' refers to a specific task within that stage.
      FORMATTING: Clean text only. No markdown bolding (*). No hashtags (#). Use simple dashes (-) for bullets.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setInsight(response.text || "No insights available.");
    } catch (error) {
      setInsight("Error generating Ai insights. Please check configuration.");
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
    const sections = sanitizedText.split(/(?=^[1-9]\.\s)/m);
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
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl transition-transform group-hover:scale-125 duration-1000" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6"><div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20"><BrainCircuit size={32} /></div><div><h3 className="text-2xl font-black tracking-tight">AI Operations Analyst</h3><p className="text-slate-400 text-sm font-medium tracking-wide">Enterprise Intelligence Engine v2.0</p></div></div>
          <p className="text-slate-300 mb-8 max-w-2xl leading-relaxed font-medium">Deep analysis of <span className="text-white font-black underline decoration-blue-500 decoration-2 underline-offset-4">{entries.length} live records</span> across multiple Stages and Activities.</p>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={generateInsights} disabled={loading || entries.length === 0} className="flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group/btn">
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
