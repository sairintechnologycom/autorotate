import { enumerateVercel, scanSingleVar } from "@envscan/adapter-vercel";
import { buildRiskReport, classifyVar } from "@envscan/scanner-core";
import type { RiskItem, RiskReport } from "@envscan/scanner-core";
import { type ClassValue, clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  Lock,
  RefreshCw,
  Shield,
  Terminal,
  Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">(
    "idle",
  );
  const [progress, setProgress] = useState({ msg: "", pct: 0 });
  const [report, setReport] = useState<RiskReport | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(
    () => {
      try {
        const saved = localStorage.getItem("envscan_completed_steps");
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    },
  );
  const [verifyingIdx, setVerifyingIdx] = useState<number | null>(null);
  const [verifiedItems, setVerifiedItems] = useState<
    Record<number, "clean" | "still_risky">
  >({});
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const tokenInputId = "vercel-access-token";
  const teamInputId = "vercel-team-id";

  const toggleStep = (itemId: string, stepIdx: number) => {
    const key = `${itemId}-${stepIdx}`;
    const next = { ...completedSteps, [key]: !completedSteps[key] };
    setCompletedSteps(next);
    localStorage.setItem("envscan_completed_steps", JSON.stringify(next));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const verifyFix = async (item: RiskItem, idx: number) => {
    setVerifyingIdx(idx);
    try {
      const fresh = await scanSingleVar({
        token,
        teamId: item.variable.teamId,
        projectId: item.variable.projectId,
        envId: item.variable.id,
      });
      const risk = classifyVar(fresh);
      const isClean = risk.severity === "info";
      setVerifiedItems((prev) => ({
        ...prev,
        [idx]: isClean ? "clean" : "still_risky",
      }));
    } catch (err) {
      console.error("Verification failed", err);
    } finally {
      setVerifyingIdx(null);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setStatus("scanning");
    setError(null);
    try {
      const { records, integrations, failures } = await enumerateVercel({
        token,
        teamId: teamId || undefined,
        onProgress: (msg, pct) => setProgress({ msg, pct }),
      });

      setReport(buildRiskReport({ records, integrations, failures }));
      setStatus("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setStatus("error");
    }
  };

  return (
    <div className="app-shell min-h-screen selection:bg-blue-500/30">
      {/* Background Decor */}
      <div className="app-backdrop fixed inset-0 overflow-hidden pointer-events-none">
        <div className="app-orb app-orb-primary absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="app-orb app-orb-secondary absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <main className="app-main relative max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="app-header flex items-center justify-between mb-12">
          <div className="brand flex items-center gap-3">
            <div className="brand-mark w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="brand-title text-xl font-bold tracking-tight">
                EnvScan
              </h1>
              <p className="brand-subtitle text-xs text-zinc-400 font-medium tracking-wide uppercase">
                Vercel Breach Utility
              </p>
            </div>
          </div>
          <div className="trust-pill flex items-center gap-2 text-sm text-zinc-500">
            <Lock className="w-4 h-4" />
            <span>Local only. No data is stored or sent to us.</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="scan-view max-w-xl mx-auto"
            >
              <div className="scan-card glass p-8 rounded-2xl shadow-2xl">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold mb-2">
                    Initialize Security Scan
                  </h2>
                  <p className="text-zinc-400">
                    Scan your Vercel projects for exposed secrets identified in
                    the April 2026 incident.
                  </p>
                </div>

                <form onSubmit={handleScan} className="scan-form space-y-6">
                  <div className="space-y-2">
                    <label
                      htmlFor={tokenInputId}
                      className="text-sm font-medium text-zinc-300"
                    >
                      Vercel Access Token
                    </label>
                    <input
                      id={tokenInputId}
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="At_xxxxxxxxxxxx..."
                      className="text-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                      required
                    />
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Create a read-only token in your
                      <a
                        href="https://vercel.com/account/tokens"
                        target="_blank"
                        className="helper-link text-blue-400 hover:underline"
                        rel="noreferrer"
                      >
                        Vercel Settings
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor={teamInputId}
                      className="text-sm font-medium text-zinc-300"
                    >
                      Team ID (Optional)
                    </label>
                    <input
                      id={teamInputId}
                      type="text"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      placeholder="team_xxxxxxxxxxxx..."
                      className="text-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Leave blank to scan all accessible teams.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary scan-submit w-full py-4 flex items-center justify-center gap-2 group"
                  >
                    Start Scanning
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {status === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="scan-stage flex flex-col items-center justify-center py-20"
            >
              <div className="w-20 h-20 relative mb-8">
                <div className="absolute inset-0 bg-blue-600/20 rounded-full animate-ping" />
                <div className="relative w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                Analyzing Environment...
              </h2>
              <p className="text-zinc-400 mb-8">{progress.msg}</p>

              <div className="progress-shell w-64 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  className="progress-fill h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                />
              </div>
            </motion.div>
          )}

          {status === "done" && report && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Summary Dashboard */}
              <div className="stats-grid grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="stat-card stat-card-neutral glass p-5 rounded-xl">
                  <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                    Total Variables
                  </p>
                  <p className="text-3xl font-mono text-white">
                    {report.stats.totalVars}
                  </p>
                </div>
                <div className="stat-card stat-card-critical glass p-5 rounded-xl border-l-4 border-l-red-500">
                  <p className="text-[11px] font-bold text-red-300 uppercase tracking-wider mb-2">
                    Critical Risks
                  </p>
                  <p className="text-3xl font-mono text-white">
                    {report.stats.criticalCount}
                  </p>
                </div>
                <div className="stat-card stat-card-high glass p-5 rounded-xl border-l-4 border-l-orange-500">
                  <p className="text-[11px] font-bold text-orange-300 uppercase tracking-wider mb-2">
                    High Risks
                  </p>
                  <p className="text-3xl font-mono text-white">
                    {report.stats.highCount}
                  </p>
                </div>
                <div className="stat-card stat-card-projects glass p-5 rounded-xl">
                  <p className="text-[11px] font-bold text-blue-300 uppercase tracking-wider mb-2">
                    Projects Scanned
                  </p>
                  <p className="text-3xl font-mono text-white">
                    {report.stats.totalProjects}
                  </p>
                </div>
              </div>

              {report.isPartial && (
                <div className="warning-card glass rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-red-300">
                        Partial scan
                      </p>
                      <p className="text-sm text-zinc-300">
                        {report.failures.length} scan scope
                        {report.failures.length === 1 ? "" : "s"} failed. Review
                        these gaps before treating the report as complete.
                      </p>
                      <div className="space-y-1 text-xs text-zinc-400">
                        {report.failures.slice(0, 5).map((failure, idx) => (
                          <p key={`${failure.scope}-${failure.context}-${idx}`}>
                            [{failure.scope}] {failure.context}:{" "}
                            {failure.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Integrations */}
              <div className="integration-row flex gap-4">
                <div
                  className={cn(
                    "integration-card flex-1 glass p-4 rounded-xl flex items-center gap-3",
                    report.integrations.github
                      ? "border-green-500/20"
                      : "opacity-50",
                  )}
                >
                  <Shield
                    className={cn(
                      "w-5 h-5",
                      report.integrations.github
                        ? "text-green-500"
                        : "text-zinc-500",
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      GitHub Integration
                    </p>
                    <p className="text-xs text-zinc-300">
                      {report.integrations.github
                        ? "Connected — Rotate Tokens"
                        : "Not Detected"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div className="analysis-section space-y-4">
                <div className="analysis-header flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Risk Analysis</h3>
                  <div className="flex gap-2">
                    {report.items.some(
                      (i) =>
                        i.runbook?.consoleUrl &&
                        (i.severity === "critical" || i.severity === "high"),
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          const urls = report.items
                            .filter(
                              (i) =>
                                i.runbook?.consoleUrl &&
                                (i.severity === "critical" ||
                                  i.severity === "high"),
                            )
                            .map((i) => i.runbook?.consoleUrl)
                            .filter((url): url is string => Boolean(url));
                          const uniqueUrls = Array.from(new Set(urls));
                          if (
                            confirm(
                              `This will open ${uniqueUrls.length} rotation pages in new tabs. Allow popups if prompted.`,
                            )
                          ) {
                            for (const url of uniqueUrls) {
                              window.open(url, "_blank");
                            }
                          }
                        }}
                        className="action-button action-button-primary text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20"
                      >
                        Open All Rotation Pages
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStatus("idle")}
                      className="action-button action-button-muted text-xs font-medium text-zinc-500 hover:text-white transition-colors bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800"
                    >
                      New Scan
                    </button>
                  </div>
                </div>

                <div className="findings-list space-y-3">
                  {report.items
                    .filter((i) => i.severity !== "info")
                    .map((item, idx) => {
                      const isExpanded = expandedIdx === idx;
                      return (
                        <motion.div
                          key={item.variable.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={cn(
                            "finding-card glass group overflow-hidden transition-all duration-300",
                            isExpanded
                              ? "ring-1 ring-blue-500/50"
                              : "glass-hover",
                          )}
                        >
                          <button
                            type="button"
                            className="finding-toggle p-5 cursor-pointer flex w-full items-start justify-between text-left"
                            onClick={() =>
                              setExpandedIdx(isExpanded ? null : idx)
                            }
                          >
                            <div className="finding-main space-y-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={cn(
                                    "severity-badge",
                                    item.severity === "critical"
                                      ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                                      : item.severity === "high"
                                        ? "text-orange-400 border-orange-500/30 bg-orange-500/10"
                                        : "text-amber-400 border-amber-500/30 bg-amber-500/10",
                                  )}
                                >
                                  {item.severity}
                                </span>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono tracking-tight">
                                  {item.variable.teamName && (
                                    <>
                                      <Users className="w-3.5 h-3.5" />
                                      <span>{item.variable.teamName}</span>
                                      <span className="text-zinc-500">/</span>
                                    </>
                                  )}
                                  <span>{item.variable.projectName}</span>
                                </div>
                              </div>
                              <h4 className="font-mono text-lg font-semibold text-white break-all">
                                {item.variable.key}
                              </h4>
                              <p className="text-sm text-zinc-200 max-w-2xl leading-relaxed">
                                {item.rationale}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-3">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                                )}
                              </div>
                              <span className="provider-pill text-[11px] text-zinc-200 uppercase tracking-widest font-bold">
                                {item.matches[0]?.provider || "Generic"}
                              </span>
                            </div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="finding-details border-t border-white/5 bg-black/20"
                              >
                                <div className="p-5 pt-0 space-y-6">
                                  <div className="flex items-center justify-between gap-4">
                                    {item.matches[0]?.excerpt && (
                                      <div className="match-box flex-1 p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-xs text-zinc-200 flex items-center gap-3 overflow-hidden">
                                        <Terminal className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                        <div className="flex gap-2 overflow-hidden">
                                          <span className="text-zinc-400 flex-shrink-0">
                                            Match:
                                          </span>
                                          <span className="text-zinc-100 truncate">
                                            {item.matches[0].excerpt}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => verifyFix(item, idx)}
                                      disabled={verifyingIdx === idx}
                                      className={cn(
                                        "verify-button flex-shrink-0 text-[10px] px-3 py-2.5 rounded-lg border transition-all flex items-center gap-2 font-bold uppercase tracking-wider",
                                        verifiedItems[idx] === "clean"
                                          ? "bg-green-500/20 border-green-500/50 text-green-400"
                                          : verifiedItems[idx] === "still_risky"
                                            ? "bg-red-500/20 border-red-500/50 text-red-400"
                                            : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 disabled:opacity-50",
                                      )}
                                    >
                                      {verifyingIdx === idx ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Eye className="w-3 h-3" />
                                      )}
                                      {verifiedItems[idx] === "clean"
                                        ? "Verified Clean"
                                        : verifiedItems[idx] === "still_risky"
                                          ? "Still Exposed"
                                          : "Verify Rotation"}
                                    </button>
                                  </div>

                                  {item.runbook && (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">
                                          Rotation Checklist
                                        </h5>
                                        <div className="flex gap-2">
                                          {item.runbook.copyCommand && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (item.runbook?.copyCommand) {
                                                  copyToClipboard(
                                                    item.runbook.copyCommand,
                                                  );
                                                }
                                              }}
                                              className="chip-button chip-button-neutral text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700 transition-all flex items-center gap-1.5"
                                            >
                                              {copiedCmd ===
                                              item.runbook.copyCommand ? (
                                                <Check className="w-3 h-3 text-green-500" />
                                              ) : (
                                                <Copy className="w-3 h-3" />
                                              )}
                                              {copiedCmd ===
                                              item.runbook.copyCommand
                                                ? "Copied!"
                                                : "Copy Command"}
                                            </button>
                                          )}
                                          {item.runbook.consoleUrl && (
                                            <a
                                              href={item.runbook.consoleUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="chip-button chip-button-primary text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 transition-all flex items-center gap-1.5"
                                            >
                                              Open Console{" "}
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                      <div className="grid gap-2">
                                        {item.runbook.steps.map(
                                          (step, sIdx) => {
                                            const isDone =
                                              completedSteps[
                                                `${item.variable.id}-${sIdx}`
                                              ];
                                            return (
                                              <button
                                                type="button"
                                                key={`${item.variable.id}-${step}`}
                                                onClick={() =>
                                                  toggleStep(
                                                    item.variable.id,
                                                    sIdx,
                                                  )
                                                }
                                                className={cn(
                                                  "flex items-start gap-3 p-3 rounded-lg border transition-all text-left group/step",
                                                  isDone
                                                    ? "bg-green-500/10 border-green-500/20 opacity-60"
                                                    : "bg-white/5 border-white/5 hover:border-white/10",
                                                )}
                                              >
                                                <div className="mt-0.5">
                                                  <div
                                                    className={cn(
                                                      "w-4 h-4 rounded-md border flex items-center justify-center text-[9px] font-bold transition-colors",
                                                      isDone
                                                        ? "bg-green-500 border-green-500 text-white"
                                                        : "border-zinc-700 text-zinc-500 group-hover/step:border-zinc-500",
                                                    )}
                                                  >
                                                    {isDone ? "✓" : sIdx + 1}
                                                  </div>
                                                </div>
                                                <p
                                                  className={cn(
                                                    "text-sm leading-relaxed transition-colors",
                                                    isDone
                                                      ? "text-green-200/60 line-through"
                                                      : "text-zinc-100",
                                                  )}
                                                >
                                                  {step}
                                                </p>
                                              </button>
                                            );
                                          },
                                        )}
                                      </div>
                                      {item.runbook.postRotationNote && (
                                        <div className="note-card p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-start gap-3">
                                          <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-amber-100 leading-relaxed">
                                            {item.runbook.postRotationNote}
                                          </p>
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

          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="error-card max-w-xl mx-auto glass border-red-500/20 p-8 rounded-2xl text-center"
            >
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Scan Failed</h3>
              <p className="text-zinc-400 mb-6">{error}</p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="btn-primary"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="app-footer mt-20 pt-8 border-t border-zinc-900 flex items-center justify-between opacity-50 text-xs grayscale hover:grayscale-0 transition-all duration-700">
          <div className="flex items-center gap-4">
            <span>EnvScan © 2026</span>
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/security" className="hover:text-white transition-colors">
              Security
            </a>
          </div>
          <a
            href="https://burncap.com"
            target="_blank"
            className="flex items-center gap-1 hover:text-white transition-colors"
            rel="noreferrer"
          >
            Supported by BurnCap
            <ArrowRight className="w-3 h-3" />
          </a>
        </footer>
      </main>
    </div>
  );
}
