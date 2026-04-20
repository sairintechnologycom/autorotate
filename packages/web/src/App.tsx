import React, { useState } from 'react';
import { 
  Shield, AlertTriangle, ExternalLink, ArrowRight, RefreshCw,
  Lock, ChevronDown, ChevronUp, Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { enumerateVercel } from '@envscan/adapter-vercel';
import { classifyVar } from '@envscan/scanner-core';
import type { RiskReport } from '@envscan/scanner-core';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [token, setToken] = useState('');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState({ msg: '', pct: 0 });
  const [report, setReport] = useState<RiskReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setStatus('scanning');
    setError(null);
    try {
      const { records, integrations } = await enumerateVercel({
        token,
        teamId: teamId || undefined,
        onProgress: (msg, pct) => setProgress({ msg, pct })
      });

      const items = records.map(classifyVar);
      const stats = {
        totalProjects: new Set(records.map(r => r.projectId)).size,
        totalVars: records.length,
        varsReadableByAttacker: records.filter(r => r.readableByAttacker).length,
        criticalCount: items.filter(i => i.severity === 'critical').length,
        highCount: items.filter(i => i.severity === 'high').length,
        mediumCount: items.filter(i => i.severity === 'medium').length,
      };

      setReport({
        scannedAt: new Date().toISOString(),
        stats,
        items: items.sort((a, b) => {
          const order = ['critical', 'high', 'medium', 'low', 'info'];
          return order.indexOf(a.severity) - order.indexOf(b.severity);
        }),
        integrations
      });
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Scan failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen selection:bg-blue-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">EnvScan</h1>
              <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">Vercel Breach Utility</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Lock className="w-4 h-4" />
            <span>Local only. No data is stored or sent to us.</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="glass p-8 rounded-2xl shadow-2xl">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold mb-2">Initialize Security Scan</h2>
                  <p className="text-zinc-400">Scan your Vercel projects for exposed secrets identified in the April 2026 incident.</p>
                </div>

                <form onSubmit={handleScan} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Vercel Access Token</label>
                    <input 
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="At_xxxxxxxxxxxx..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                      required
                    />
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Create a read-only token in your 
                      <a href="https://vercel.com/account/tokens" target="_blank" className="text-blue-400 hover:underline">Vercel Settings</a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Team ID (Optional)</label>
                    <input 
                      type="text"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      placeholder="team_xxxxxxxxxxxx..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                    />
                  </div>

                  <button className="btn-primary w-full py-4 flex items-center justify-center gap-2 group">
                    Start Scanning
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {status === 'scanning' && (
            <motion.div 
              key="scanning"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-20 h-20 relative mb-8">
                <div className="absolute inset-0 bg-blue-600/20 rounded-full animate-ping" />
                <div className="relative w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Analyzing Environment...</h2>
              <p className="text-zinc-400 mb-8">{progress.msg}</p>
              
              <div className="w-64 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                />
              </div>
            </motion.div>
          )}

          {status === 'done' && report && (
            <motion.div 
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Summary Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-xl">
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Total Variables</p>
                  <p className="text-2xl font-mono">{report.stats.totalVars}</p>
                </div>
                <div className="glass p-5 rounded-xl border-l-4 border-l-red-500">
                  <p className="text-xs font-bold text-red-500 uppercase mb-1">Critical Risks</p>
                  <p className="text-2xl font-mono">{report.stats.criticalCount}</p>
                </div>
                <div className="glass p-5 rounded-xl border-l-4 border-l-orange-500">
                  <p className="text-xs font-bold text-orange-500 uppercase mb-1">High Risks</p>
                  <p className="text-2xl font-mono">{report.stats.highCount}</p>
                </div>
                <div className="glass p-5 rounded-xl">
                  <p className="text-xs font-bold text-blue-500 uppercase mb-1">Projects Scanned</p>
                  <p className="text-2xl font-mono">{report.stats.totalProjects}</p>
                </div>
              </div>

              {/* Action Integrations */}
              <div className="flex gap-4">
                <div className={cn("flex-1 glass p-4 rounded-xl flex items-center gap-3", report.integrations.github ? "border-green-500/20" : "opacity-50")}>
                  <Shield className={cn("w-5 h-5", report.integrations.github ? "text-green-500" : "text-zinc-500")} />
                  <div>
                    <p className="text-sm font-semibold">GitHub Integration</p>
                    <p className="text-xs text-zinc-500">{report.integrations.github ? "Connected - Rotate Tokens" : "Not Detected"}</p>
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Risk Analysis</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setStatus('idle')} className="text-xs font-medium text-zinc-500 hover:text-white transition-colors bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                      New Scan
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {report.items.filter(i => i.severity !== 'info').map((item, idx) => {
                    const isExpanded = expandedIdx === idx;
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "glass group overflow-hidden transition-all duration-300",
                          isExpanded ? "ring-1 ring-blue-500/50" : "glass-hover"
                        )}
                      >
                        <div 
                          className="p-5 cursor-pointer flex items-start justify-between"
                          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={cn(
                                "severity-badge",
                                item.severity === 'critical' ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
                                item.severity === 'high' ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
                                "text-amber-400 border-amber-500/30 bg-amber-500/10"
                              )}>
                                {item.severity}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono tracking-tight">{item.variable.projectName}</span>
                            </div>
                            <h4 className="font-mono text-zinc-100">{item.variable.key}</h4>
                            <p className="text-sm text-zinc-400 max-w-2xl">{item.rationale}</p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2">
                               {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                            </div>
                            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                              {item.matches[0]?.provider || 'Generic'}
                            </span>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/5 bg-black/20"
                            >
                              <div className="p-5 pt-0 space-y-6">
                                {item.matches[0]?.excerpt && (
                                   <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[11px] text-zinc-400 flex items-center gap-3">
                                     <Terminal className="w-3.5 h-3.5 text-zinc-600" />
                                     <div className="flex gap-2">
                                       <span className="opacity-50">Match:</span>
                                       <span className="text-zinc-300">{item.matches[0].excerpt}</span>
                                     </div>
                                   </div>
                                )}

                                {item.runbook && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Rotation Checklist</h5>
                                      {item.runbook.consoleUrl && (
                                        <a 
                                          href={item.runbook.consoleUrl} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 transition-all flex items-center gap-1.5"
                                        >
                                          Open Console <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="grid gap-2">
                                      {item.runbook.steps.map((step, sIdx) => (
                                        <div key={sIdx} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                          <div className="mt-0.5">
                                            <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-500">
                                              {sIdx + 1}
                                            </div>
                                          </div>
                                          <p className="text-xs text-zinc-300 leading-relaxed">{step}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {item.runbook.postRotationNote && (
                                      <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10 flex items-start gap-3">
                                        <AlertTriangle className="w-4 h-4 text-amber-500/50 mt-0.5" />
                                        <p className="text-[11px] text-amber-500/80 italic">{item.runbook.postRotationNote}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {status === 'error' && (
             <motion.div 
               key="error"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="max-w-xl mx-auto glass border-red-500/20 p-8 rounded-2xl text-center"
             >
               <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
               <h3 className="text-xl font-bold mb-2">Scan Failed</h3>
               <p className="text-zinc-400 mb-6">{error}</p>
               <button onClick={() => setStatus('idle')} className="btn-primary">Try Again</button>
             </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-20 pt-8 border-t border-zinc-900 flex items-center justify-between opacity-50 text-xs grayscale hover:grayscale-0 transition-all duration-700">
           <div className="flex items-center gap-4">
             <span>EnvScan © 2026</span>
             <a href="#" className="hover:text-white transition-colors">Privacy</a>
             <a href="#" className="hover:text-white transition-colors">Security</a>
           </div>
           <a href="https://burncap.com" target="_blank" className="flex items-center gap-1 hover:text-white transition-colors">
              Supported by BurnCap
              <ArrowRight className="w-3 h-3" />
           </a>
        </footer>
      </main>
    </div>
  );
}
