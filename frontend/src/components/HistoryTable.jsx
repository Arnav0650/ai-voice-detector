import React from 'react';
import { History, ShieldCheck, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

/**
 * HistoryTable Component
 * Displays historic AI voice detections from SQLite backend database.
 */
export default function HistoryTable({ history = [], onRefresh, isLoading }) {
  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-slate-100">Detection History</h3>
          <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-mono">
            SQLite Log ({history.length})
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-slate-500 font-mono text-sm">
          No detections logged yet. Upload or record audio above to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4"># ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">File / Recording</th>
                <th className="py-3 px-4">Verdict</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Spoofing Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {history.map((item) => {
                const isReal = item.verdict === "REAL";
                const dateStr = item.timestamp 
                  ? new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
                  : 'N/A';
                
                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 text-xs">#{item.id}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs font-mono flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {dateStr}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200 max-w-[180px] truncate" title={item.filename}>
                      {item.filename || 'Mic Recording'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        isReal 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' 
                          : 'bg-red-950/80 text-red-400 border border-red-800/80'
                      }`}>
                        {isReal ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {item.verdict}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      <span className={isReal ? 'text-emerald-400' : 'text-red-400'}>
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded">
                        {item.spoofing_type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
