import React from 'react';
import { ShieldCheck, AlertTriangle, Cpu, Activity, Fingerprint } from 'lucide-react';

/**
 * VerdictDisplay Component
 * Displays the AI Voice detection verdict badge, confidence progress bar, and spoofing type label.
 */
export default function VerdictDisplay({ result, isLoading }) {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-4 animate-pulse">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <Cpu className="w-8 h-8 text-cyan-400 absolute inset-0 m-auto" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Analyzing Spectrogram & Embeddings</h3>
          <p className="text-sm text-slate-400 mt-1 font-mono">Running AASIST & Resemblyzer inference model...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
          <Fingerprint className="w-6 h-6" />
        </div>
        <h3 className="text-base font-medium text-slate-300">Ready for Detection</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Upload an audio file or record directly from your microphone to determine if the voice is authentic or AI-cloned.
        </p>
      </div>
    );
  }

  const { verdict, confidence, spoofing_type, filename, duration } = result;
  const isReal = verdict === "REAL";
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className={`glass-panel rounded-2xl p-6 relative overflow-hidden transition-all duration-500 ${
      isReal ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.12)]' : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.12)]'
    }`}>
      {/* Background radial accent glow */}
      <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
        isReal ? 'bg-emerald-500/15' : 'bg-red-500/15'
      }`}></div>

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> AASIST Inference Output
            </span>
            <h2 className="text-xl font-bold text-slate-100 mt-1 truncate max-w-xs sm:max-w-md">
              {filename || "Audio Sample"}
            </h2>
            {duration ? (
              <span className="text-xs text-slate-400 font-mono">Length: {duration}s</span>
            ) : null}
          </div>

          {/* Large Verdict Badge */}
          <div className="flex items-center">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-black tracking-wide text-2xl shadow-xl transition-transform transform hover:scale-105 ${
              isReal 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-900/40 ring-4 ring-emerald-500/20 animate-pulse-subtle' 
                : 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-900/40 ring-4 ring-red-500/20 animate-pulse-subtle'
            }`}>
              {isReal ? <ShieldCheck className="w-8 h-8 stroke-[2.5]" /> : <AlertTriangle className="w-8 h-8 stroke-[2.5]" />}
              <span>{verdict} VOICE</span>
            </div>
          </div>
        </div>

        {/* Confidence Percentage Bar */}
        <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-slate-300 font-mono">Detection Confidence</span>
            <span className={`font-mono text-base font-bold ${isReal ? 'text-emerald-400' : 'text-red-400'}`}>
              {confidencePercent}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                isReal 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_#10B981]' 
                  : 'bg-gradient-to-r from-red-500 to-rose-400 shadow-[0_0_10px_#EF4444]'
              }`}
              style={{ width: `${confidencePercent}%` }}
            ></div>
          </div>
        </div>

        {/* Spoofing Type & Metadata Label */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono uppercase">Spoofing Signature:</span>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono border ${
              isReal
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-red-950/60 text-red-300 border-red-800/60'
            }`}>
              {spoofing_type}
            </span>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Model: AASIST + Resemblyzer
          </span>
        </div>
      </div>
    </div>
  );
}
