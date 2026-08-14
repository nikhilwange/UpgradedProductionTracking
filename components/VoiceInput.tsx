import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, RotateCcw, AlertTriangle, Check, Languages, Undo2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = 'AIzaSyAqdQ6F2dgmFJJxwbzITA0I9GvOFZihOzM';
const MAX_RECORD_SECONDS = 60;
const SILENCE_STOP_MS = 1600;   // auto-stop after this much continuous silence
const MIN_SPEECH_MS = 1200;     // never auto-stop before this much has been recorded
const VOICE_DEBUG = true;       // set false once latency is tuned

// Probed once per session, not per recording
let thinkingConfigSupported = true;

// Instantiated once at module load instead of on every recording
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const SHOP_FLOOR_GLOSSARY = `Chiller, PDX, PCW, CRV, FWU, Li7, Trinergy, brazing, leak test, gas charging,
vacuum pulling, evaporator, condenser, compressor, header, frame movement, fixture, torque gun, Desoutter,
harness, busbar, crane, hydra, powder coating, cladding, hipot test, run test, packing, dispatch, rework,
quality hold, NCR, material shortage, manpower shortage, drawing issue, breakdown, SO number`;

const TRANSCRIBE_PROMPT = `You are a multilingual transcription engine for a manufacturing shop floor at Vertiv India (Chakan and Ambernath plants, Maharashtra).
The speaker is a production operator or supervisor explaining why a production activity was delayed or lost time.

LANGUAGE: The speech may be in Marathi, Hindi, English, Hinglish, or any mix of these, and may also be in Gujarati, Bhojpuri, Bengali, Odia, Telugu, Tamil, Kannada or Punjabi. Auto-detect it. Speakers frequently switch language mid-sentence - handle this naturally.

Return ONLY a raw JSON object, no markdown fences, no commentary, in exactly this key order:
{"english":"<English translation>","native":"<verbatim transcript>","language":"<detected language name in English>"}

RULES FOR "native":
- Transcribe exactly what was spoken, in the correct native script (Devanagari for Marathi/Hindi, Gujarati script for Gujarati, etc).
- If the speaker used English words inside a native sentence, keep those words in Latin script exactly as spoken.
- Do not clean up, translate, or summarise this field.

RULES FOR "english":
- A clear, professional English rendering of the same statement. One to three sentences.
- Be factual and concise. Do NOT invent or add any information that was not spoken.
- Use correct manufacturing terminology. Expected vocabulary: ${SHOP_FLOOR_GLOSSARY}
- Do NOT translate proper nouns: operator names, supplier names, model names and serial numbers stay as spoken.
- Convert spoken durations and quantities into numerals with units (e.g. "dedh tass" becomes "1.5 hours", "pandhra minute" becomes "15 minutes", "do log" becomes "2 people").
- No greetings, headings, bullets, quotes or labels.

If the audio contains no intelligible speech, return exactly:
{"language":"none","native":"","english":"NO_SPEECH_DETECTED"}`;

type VoiceStatus = 'idle' | 'recording' | 'processing' | 'error' | 'done';

interface TranscriptResult { language: string; native: string; english: string; }

interface VoiceInputProps {
  onTranscript: (mergedText: string) => void;
  currentText: string;
  tone?: 'rose' | 'indigo';
}

const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([view], { type: 'audio/wav' });
};

const blobToWavBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuf = await blob.arrayBuffer();
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  const decoded = await ctx.decodeAudioData(arrayBuf);
  await ctx.close();
  const target = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * target)), target);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const wav = encodeWav(rendered.getChannelData(0), target);
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = () => rej(new Error('Audio encoding failed'));
    r.readAsDataURL(wav);
  });
};

// Ogg/Opus is preferred: Gemini accepts it directly, so no decode/resample/WAV step is needed
// and the upload is roughly 20x smaller than 16 kHz PCM.
const pickMimeType = (): string => {
  const candidates = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
};

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res((r.result as string).split(',')[1]);
  r.onerror = () => rej(new Error('Audio encoding failed'));
  r.readAsDataURL(blob);
});

// Fast path for Ogg, WAV conversion fallback for everything else
const prepareAudio = async (blob: Blob): Promise<{ mimeType: string; data: string; fast: boolean }> => {
  if ((blob.type || '').startsWith('audio/ogg')) {
    return { mimeType: 'audio/ogg', data: await blobToBase64(blob), fast: true };
  }
  return { mimeType: 'audio/wav', data: await blobToWavBase64(blob), fast: false };
};

const parseResult = (raw: string): TranscriptResult => {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const obj = JSON.parse(cleaned.slice(start, end + 1));
      return {
        language: String(obj.language || '').trim(),
        native: String(obj.native || '').trim(),
        english: String(obj.english || '').trim()
      };
    }
  } catch { /* fall through to plain-text fallback */ }
  return { language: '', native: '', english: cleaned.replace(/^["']|["']$/g, '') };
};

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, currentText, tone = 'rose' }) => {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<TranscriptResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);
  const preInsertTextRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserCtxRef = useRef<AudioContext | null>(null);

  const accent = tone === 'indigo'
    ? { btn: 'bg-indigo-600 hover:bg-indigo-700', panel: 'bg-indigo-50/60 border-indigo-200', label: 'text-indigo-700' }
    : { btn: 'bg-rose-600 hover:bg-rose-700', panel: 'bg-slate-50 border-slate-200', label: 'text-slate-600' };

  const cleanupAudio = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { window.cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (analyserCtxRef.current) { analyserCtxRef.current.close().catch(() => {}); analyserCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setLevel(0);
  };

  useEffect(() => () => cleanupAudio(), []);

  const transcribe = async (blob: Blob) => {
    setStatus('processing');
    setErrorMsg('');
    setResult(null);
    try {
      const tPrep = performance.now();
      const audio = await prepareAudio(blob);
      const tSent = performance.now();

      const contents = [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: audio.mimeType, data: audio.data } },
          { text: TRANSCRIBE_PROMPT }
        ]
      }];

      const baseConfig: any = {
        temperature: 0,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json'
      };

      let response;
      if (thinkingConfigSupported) {
        try {
          // Transcription needs no reasoning - disabling the thinking pass is the largest latency saving
          response = await genAI.models.generateContent({
            model: 'gemini-flash-latest',
            contents,
            config: { ...baseConfig, thinkingConfig: { thinkingBudget: 0 } }
          });
        } catch (cfgErr) {
          console.warn('Voice: thinkingBudget rejected, disabling for this session.', cfgErr);
          thinkingConfigSupported = false;
        }
      }
      if (!response) {
        response = await genAI.models.generateContent({
          model: 'gemini-flash-latest',
          contents,
          config: baseConfig
        });
      }

      const tDone = performance.now();
      if (VOICE_DEBUG) {
        console.log(
          `[Voice] path=${audio.fast ? 'ogg-direct' : 'wav-fallback'} ` +
          `payload=${Math.round(audio.data.length / 1024)}KB ` +
          `encode=${Math.round(tSent - tPrep)}ms ` +
          `gemini=${Math.round(tDone - tSent)}ms`
        );
      }

      const parsed = parseResult(response.text || '');
      if (!parsed.english || parsed.english === 'NO_SPEECH_DETECTED') {
        setStatus('error');
        setErrorMsg('Kahi aikayla aale nahi / Kuch sunai nahi diya — speak closer to the tab.');
        return;
      }
      const base = (currentText || '').trim();
      preInsertTextRef.current = currentText || '';
      onTranscript(base ? `${base} ${parsed.english}` : parsed.english);
      setResult(parsed);
      setStatus('done');
    } catch (err: any) {
      console.error('Voice transcription failed:', err);
      setStatus('error');
      setErrorMsg('Transcription failed — check network and retry.');
    }
  };

  const startRecording = async () => {
    setErrorMsg('');
    setResult(null);
    lastBlobRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      streamRef.current = stream;

      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const actx = new AC();
      analyserCtxRef.current = actx;
      const analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      actx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        rafRef.current = window.requestAnimationFrame(tick);
      };
      tick();

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        // recorder.mimeType is what was ACTUALLY produced, which can differ from what we requested
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        cleanupAudio();
        if (blob.size < 1200) {
          setStatus('error');
          setErrorMsg('Recording too short — press Speak and talk for at least 2 seconds.');
          return;
        }
        lastBlobRef.current = blob;
        transcribe(blob);
      };
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      timerRef.current = window.setInterval(() => {
        setSeconds(prev => {
          if (prev + 1 >= MAX_RECORD_SECONDS) { stopRecording(); return MAX_RECORD_SECONDS; }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      cleanupAudio();
      setStatus('error');
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setErrorMsg('Microphone blocked. Allow mic access for this site in browser settings.');
      } else if (err && err.name === 'NotFoundError') {
        setErrorMsg('No microphone detected on this device.');
      } else {
        setErrorMsg('Could not start the microphone. Retry.');
      }
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  };

  const retryLast = () => {
    if (lastBlobRef.current) transcribe(lastBlobRef.current);
    else startRecording();
  };

  const undoInsert = () => {
    onTranscript(preInsertTextRef.current);
    setResult(null);
    setStatus('idle');
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-stretch gap-1.5 w-full">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {status === 'recording' && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
            </span>
            <span className="text-[10px] font-black text-slate-600 tabular-nums">{mmss}</span>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
        )}
        {status === 'processing' && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transcribing…</span>
        )}

        {status === 'error' && lastBlobRef.current && (
          <button type="button" onClick={retryLast}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800 text-white text-[10px] font-black uppercase">
            <RotateCcw size={12} /> Retry
          </button>
        )}

        <button
          type="button"
          onClick={status === 'recording' ? stopRecording : startRecording}
          disabled={status === 'processing'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${status === 'recording' ? 'bg-slate-900 ring-4 ring-rose-200' : accent.btn}`}
        >
          {status === 'processing'
            ? <Loader2 size={13} className="animate-spin" />
            : status === 'recording'
              ? <Square size={12} />
              : status === 'done'
                ? <Check size={13} />
                : <Mic size={13} />}
          {status === 'recording' ? 'Stop' : status === 'processing' ? 'Wait' : 'Speak'}
        </button>
      </div>

      {status === 'done' && result && (
        <div className={`px-4 py-3 border rounded-2xl ${accent.panel} space-y-2`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${accent.label}`}>
              <Languages size={12} /> Heard in {result.language || 'Mixed'}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={undoInsert}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-300 text-[10px] font-black uppercase text-slate-600">
                <Undo2 size={11} /> Undo
              </button>
              <button type="button" onClick={startRecording}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-white text-[10px] font-black uppercase">
                <Mic size={11} /> Again
              </button>
            </div>
          </div>
          {result.native && (
            <p className="text-sm leading-relaxed text-slate-800" style={{ fontFamily: "'Noto Sans Devanagari', 'Noto Sans', system-ui, sans-serif", fontWeight: 500 }}>
              {result.native}
            </p>
          )}
          <p className="text-[10px] font-bold text-slate-500 leading-snug">
            Check the line above matches what you said. The English version has been added to the box below.
          </p>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-rose-600 text-right">
          <AlertTriangle size={11} className="shrink-0" /> {errorMsg}
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
