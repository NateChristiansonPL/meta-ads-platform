import { readFileSync, writeFileSync } from "fs";

const filePath = "/home/ubuntu/meta-ads-platform/client/src/pages/admin/AdminCreativeDecay.tsx";
let src = readFileSync(filePath, "utf8");

// 1. Add optimizationGoal to ResultRow type
src = src.replace(
  `  trendData?: TrendPoint[];\n};`,
  `  trendData?: TrendPoint[];\n  optimizationGoal?: string | null;\n};`
);

// 2. Add Play icon import
src = src.replace(
  `  AlertTriangle, Bell, BellOff, CheckCircle2, ChevronDown,\n  Eye, Filter, LineChart, Loader2, RefreshCw, Search, Settings2, Shield, X, Zap,`,
  `  AlertTriangle, Bell, BellOff, CheckCircle2, ChevronDown,\n  Eye, Filter, LineChart, Loader2, Play, RefreshCw, Search, Settings2, Shield, X, Zap,`
);

// 3. Add skipSync state and triggerDecayAnalysis mutation after analysisMutation block
const afterAnalysisMutation = `  // Filtered data
  const filteredAccounts`;
src = src.replace(
  afterAnalysisMutation,
  `  // Run Now (triggerDecayAnalysis) — uses scheduler config account/campaigns
  const [skipSync, setSkipSync] = useState(false);
  const [runNowOpen, setRunNowOpen] = useState(false);
  const triggerMutation = trpc.adminCreativeDecay.triggerDecayAnalysis.useMutation({
    onSuccess: (data) => {
      utils.adminCreativeDecay.getLatestResults.invalidate();
      refetchNotifs();
      setRunNowOpen(false);
      toast.success(\`Chain complete: \${data.recordCount} creative group\${data.recordCount === 1 ? "" : "s"} analyzed.\${data.syncWarnings?.length ? \` (\${data.syncWarnings.length} sync warning\${data.syncWarnings.length === 1 ? "" : "s"})\` : ""}\`);
    },
    onError: (e: { message: string }) => toast.error(e.message || "Trigger failed."),
  });
  const canTrigger = !!schedulerConfig?.accountId && !triggerMutation.isPending;
  // Filtered data
  const filteredAccounts`
);

// 4. Add Run Now button in header, before the Run Decay Analysis button
src = src.replace(
  `          <button
            onClick={handleAnalysis}
            disabled={!canAnalyze}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#ED135F", color: "#fff" }}
          >
            {analysisMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Run Decay Analysis
          </button>`,
  `          <button
            onClick={() => setRunNowOpen(true)}
            disabled={!canTrigger}
            title={!schedulerConfig?.accountId ? "Configure an account in the Scheduler first" : "Run full sync → analysis chain using scheduler config"}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(26,108,246,0.18)", color: "#1A6CF6", border: "1px solid rgba(26,108,246,0.3)" }}
          >
            {triggerMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Run Now
          </button>
          <button
            onClick={handleAnalysis}
            disabled={!canAnalyze}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#ED135F", color: "#fff" }}
          >
            {analysisMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Run Decay Analysis
          </button>`
);

// 5. Add Run Now modal after the View Config Modal closing tag
const viewConfigModalEnd = `      {/* ── View Config Modal ─────────────────────────────────────────────── */}`;
src = src.replace(
  viewConfigModalEnd,
  `      {/* ── Run Now Modal ────────────────────────────────────────────────── */}
      {runNowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setRunNowOpen(false)}>
          <div className="rounded-2xl p-5 w-full max-w-sm space-y-4" style={{ background: "#1A1A3A", border: "1px solid rgba(26,108,246,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Run Now</h3>
              <button onClick={() => setRunNowOpen(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={15} /></button>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              Runs the full chain using your scheduler config account and campaigns.
              {schedulerConfig?.accountId ? (
                <span className="block mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>Account: {schedulerConfig.accountId}</span>
              ) : (
                <span className="block mt-1 font-bold" style={{ color: "#F7901E" }}>No account configured — set one in the Scheduler panel first.</span>
              )}
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setSkipSync(!skipSync)}
                className="relative w-9 h-5 rounded-full transition-colors"
                style={{ background: skipSync ? "rgba(255,255,255,0.15)" : "rgba(26,108,246,0.6)" }}
              >
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: skipSync ? "translateX(0)" : "translateX(16px)" }} />
              </div>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                {skipSync ? "Analysis only (skip sync)" : "Sync then analyze"}
              </span>
            </label>
            <button
              onClick={() => triggerMutation.mutate({ skipSync })}
              disabled={!canTrigger}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#1A6CF6", color: "#fff" }}
            >
              {triggerMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {triggerMutation.isPending ? (skipSync ? "Analyzing…" : "Syncing then analyzing…") : "Run"}
            </button>
          </div>
        </div>
      )}
      {/* ── View Config Modal ─────────────────────────────────────────────── */}`
);

// 6. Add Opt. Metric column header in the results table
src = src.replace(
  `                      <Th>Creative</Th>
                      <Th>Assessment</Th>`,
  `                      <Th>Creative</Th>
                      <Th>Assessment</Th>
                      <Th>Opt. Metric</Th>`
);

// 7. Update colSpan from 11 to 12
src = src.replace(
  `<td colSpan={11}`,
  `<td colSpan={12}`
);

// 8. Add Opt. Metric cell in the ResultRows row renderer, after the Assessment cell
src = src.replace(
  `              <Td><StatusBadge row={row} /></Td>
              <Td>{row.fatigueScore.toFixed(1)}</Td>`,
  `              <Td><StatusBadge row={row} /></Td>
              <Td>
                {row.optimizationGoal ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                    {row.optimizationGoal.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                ) : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
              </Td>
              <Td>{row.fatigueScore.toFixed(1)}</Td>`
);

writeFileSync(filePath, src, "utf8");
console.log("Done — AdminCreativeDecay.tsx patched");
