import { trpc } from "@/lib/trpc";
import HelpTip from "@/components/HelpTip";
import { AlertCircle, CheckCircle2, ChevronDown, Clock, ExternalLink, FileDown, Loader2, OctagonX, Play, RefreshCcw, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export interface SkillConfig {
  skillId: string;
  skillName: string;
  description: string;
  badge: string;
  color: string;
  hasDateRange?: boolean;
  hasCompare?: boolean;
  hasModules?: boolean;
  modules?: Array<{ id: string; label: string; sub: string }>;
  extraFields?: React.ReactNode;
  /**
   * When true, shows an "Enrich Analysis" section that lets the user select
   * recent Audience Overlap and Creative Lifecycle runs to inject their
   * sidecar JSON into the skill prompt.
   */
  hasEnrichment?: boolean;
  /** Optional note shown next to the skill header about recommended date ranges */
  dateNote?: string;
}

interface SkillRunnerProps {
  config: SkillConfig;
}

const DATE_PRESETS = [
  { value: "last_7d", label: "Last 7 Days" },
  { value: "last_14d", label: "Last 14 Days" },
  { value: "last_30d", label: "Last 30 Days" },
  { value: "last_90d", label: "Last 90 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
];

export default function SkillRunner({ config }: SkillRunnerProps) {
  const { data: activeTokens = [] } = trpc.tokens.listActive.useQuery();

  // Persist last-used account across sessions
  const STORAGE_KEY = `pl_last_account_${config.skillId}`;
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { tokenId: number; bmId: string; adAccountId: string; adAccountName: string } | null; } catch { return null; }
  }
  const saved = loadSaved();

  const [tokenId, setTokenId] = useState<number | null>(saved?.tokenId ?? null);
  const [bmId, setBmId] = useState(saved?.bmId ?? "");
  const [adAccountId, setAdAccountId] = useState(saved?.adAccountId ?? "");
  const [adAccountName, setAdAccountName] = useState(saved?.adAccountName ?? "");
  const [adAccountSearch, setAdAccountSearch] = useState("");
  const [datePreset, setDatePreset] = useState("last_7d");
  const [campaignFilter, setCampaignFilter] = useState<"active" | "last_30d" | "inactive">("active");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [enabledModules, setEnabledModules] = useState<string[]>(config.modules?.map((m) => m.id) ?? []);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [compare, setCompare] = useState(false);
  const [agentProfile, setAgentProfile] = useState<"manus-1.6" | "manus-1.6-lite">("manus-1.6-lite");

  // Enrichment: selected run IDs from prior Audience Overlap / Creative Lifecycle runs
  const [enrichOverlapRunId, setEnrichOverlapRunId] = useState<number | null>(null);
  const [enrichLifecycleRunId, setEnrichLifecycleRunId] = useState<number | null>(null);

  // Query recent runs with sidecar JSON for enrichment (only when hasEnrichment is enabled)
  const { data: overlapRuns = [] } = trpc.runs.recentWithSidecar.useQuery(
    { skillId: "audience-overlap", adAccountId: adAccountId || undefined, limit: 10 },
    { enabled: !!config.hasEnrichment && !!adAccountId }
  );
  const { data: lifecycleRuns = [] } = trpc.runs.recentWithSidecar.useQuery(
    { skillId: "creative-lifecycle", adAccountId: adAccountId || undefined, limit: 10 },
    { enabled: !!config.hasEnrichment && !!adAccountId }
  );

  const [runId, setRunId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [report, setReport] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [taskUrl, setTaskUrl] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ filename: string; url: string; contentType: string }>>([]);
  const [statusLog, setStatusLog] = useState<Array<{ ts: number; msg: string }>>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [creditUsage, setCreditUsage] = useState<number | null>(null);
  const [isAborting, setIsAborting] = useState(false);
  const [isRedelivering, setIsRedelivering] = useState(false);
  const [noReportOnSuccess, setNoReportOnSuccess] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const abortRunMutation = trpc.runs.abortRun.useMutation();
  const redeliverMutation = trpc.runs.redeliverReport.useMutation();
  const requestUpdateMutation = trpc.runs.requestUpdate.useMutation();
  const [isRequestingUpdate, setIsRequestingUpdate] = useState(false);
  const [updateRequestMsg, setUpdateRequestMsg] = useState<string | null>(null);

  // Load the most recent successful run output for this user + skill.
  // This persists across navigation so the user sees their last result when returning.
  // Always enabled (no condition) so it fetches on every mount.
  // staleTime: 0 ensures it refetches when the user navigates back.
  const utils = trpc.useUtils();
  const { data: lastOutputData } = trpc.runs.lastOutput.useQuery(
    { skillId: config.skillId },
    { staleTime: 0, refetchOnMount: true }
  );

  const selectedToken = activeTokens.find((t) => t.id === tokenId);
  // Fetch ad accounts from Meta API using the selected BM token
  const { data: adAccountsData, isLoading: loadingAccounts } = trpc.meta.getAdAccountsByTokenId.useQuery(
    { tokenId: tokenId! },
    { enabled: !!tokenId, staleTime: 5 * 60 * 1000 }
  );
  const adAccounts: Array<{ id: string; name: string }> = adAccountsData?.accounts ?? [];

  const { data: campaignsData, isLoading: loadingCampaigns } = trpc.meta.getCampaignsByTokenId.useQuery(
    { adAccountId, tokenId: tokenId! },
    { enabled: !!adAccountId && !!tokenId }
  );
  const campaigns: Array<{ id: string; name: string; status: string; objective: string }> =
    campaignsData?.campaigns ?? [];

  const executeRun = trpc.runs.execute.useMutation();
  const canRun = !!tokenId && !!adAccountId && status !== "running";

  async function handleAbort() {
    if (!runId || isAborting) return;
    setIsAborting(true);
    try {
      await abortRunMutation.mutateAsync({ runId });
      stopPolling();
      setStatus("error");
      setErrorMsg("Run was aborted by user.");
    } catch (err) {
      console.error("Abort failed:", err);
    } finally {
      setIsAborting(false);
    }
  }

  async function handleRedeliver() {
    if (!runId || isRedelivering) return;
    setIsRedelivering(true);
    try {
      const result = await redeliverMutation.mutateAsync({ runId });
      if (result.reportMarkdown) {
        setReport(result.reportMarkdown);
        setAttachments(result.attachments ?? []);
        setStatus("success");
        setErrorMsg(null);
      } else {
        setErrorMsg("No report files found on the Manus task. The agent may not have produced output files for this run.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Redeliver failed";
      setErrorMsg(msg);
    } finally {
      setIsRedelivering(false);
    }
  }

  // Poll getRunStatus while a run is in progress
  function startPolling(id: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await utils.runs.getRunStatus.fetch({ runId: id });
        if (data.statusLog && data.statusLog.length > 0) {
          setStatusLog([...data.statusLog]);
          // Detect rate limit
          const hasRateLimit = data.statusLog.some((e) =>
            /rate.?limit|too many requests|429|throttl/i.test(e.msg)
          );
          setRateLimitWarning(hasRateLimit);
        }
        if (data.status !== "running") {
          stopPolling();
          setTaskUrl(data.taskUrl ?? null);
          if (data.status === "success") {
            // Only mark success if there's actual report content or attachments
            const hasContent = !!(data.reportMarkdown?.trim()) || (data.attachments ?? []).length > 0;
            if (hasContent) {
              setReport(data.reportMarkdown ?? "");
              setAttachments(data.attachments ?? []);
              setCreditUsage(data.creditUsage ?? null);
              setStatus("success");
              utils.runs.lastOutput.invalidate({ skillId: config.skillId });
            } else {
              // Task completed but no output — treat as error with redeliver option
              setNoReportOnSuccess(true);
              setErrorMsg("The analysis completed but no report content was found. The agent may have encountered an issue generating the output files. Use 'Re-fetch Report' to try retrieving the output again, or view the full run on Manus.");
              setStatus("error");
            }
          } else {
            setErrorMsg(data.errorMessage ?? "Run failed.");
            setStatus("error");
          }
        }
      } catch { /* ignore transient poll errors */ }
    }, 8000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null; }
  }

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  async function handleRun() {
    if (!canRun) return;
    setStatus("running");
    setReport(null);
    setErrorMsg(null);
    setTaskUrl(null);
    setAttachments([]);
    setStatusLog([]);
    setRateLimitWarning(false);
    setTimeoutWarning(false);
    const t0 = Date.now();
    setStartTime(t0);
    setElapsedSec(0);

    // Elapsed-time clock
    if (clockRef.current) clearInterval(clockRef.current);
    clockRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      setElapsedSec(sec);
      // Warn at 12 minutes
      if (sec >= 720) setTimeoutWarning(true);
    }, 1000);

    try {
      // Fire the real execute mutation — this runs the Manus agent end-to-end
      const result = await executeRun.mutateAsync({
        skillId: config.skillId,
        skillName: config.skillName,
        adAccountId,
        adAccountName,
        businessManagerId: bmId,
        tokenId: tokenId ?? undefined,
        datePreset,
        campaignIds: selectedCampaigns,
        additionalInstructions,
        agentProfile,
        extraParams: {
          modules: enabledModules,
          compare,
          enrichOverlapRunId: enrichOverlapRunId ?? undefined,
          enrichLifecycleRunId: enrichLifecycleRunId ?? undefined,
        },
      });
      // execute now returns immediately with { runId, status: "running" }.
      // The Manus agent runs in the background; we poll getRunStatus for updates.
      setRunId(result.runId);
      startPolling(result.runId);
    } catch (err: unknown) {
      stopPolling();
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  function handleReset() {
    stopPolling();
    setStatus("idle");
    setReport(null);
    setErrorMsg(null);
    setRunId(null);
    setStartTime(null);
    setElapsedSec(0);
    setStatusLog([]);
    setRateLimitWarning(false);
    setTimeoutWarning(false);
    setTaskUrl(null);
    setAttachments([]);
    setCreditUsage(null);
  }

  function handleRetry() {
    handleReset();
    // Small delay so state clears before re-running
    setTimeout(() => handleRun(), 100);
  }

  function formatElapsed(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <div className="flex gap-6 h-full">
      {/* ── Config Panel ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-4 shrink-0 overflow-y-auto"
        style={{ width: 360 }}
      >
        {/* Account Selection */}
        <Section title="Account Selection" hint="Select the Business Manager token that has access to your ad account, then pick the specific ad account you want to analyze. The token is managed by your admin in the Token Vault.">
          {/* Token */}
          <FormField label="Business Manager Token">
            {activeTokens.length === 0 ? (
              <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(237,19,95,0.1)", color: "#ED135F", border: "1px solid rgba(237,19,95,0.2)" }}>
                No tokens configured. Ask your admin to add a token in the Token Vault.
              </div>
            ) : (
              <Select
                value={tokenId?.toString() ?? ""}
                onChange={(v) => {
                  const t = activeTokens.find((x) => x.id === parseInt(v));
                  setTokenId(t?.id ?? null);
                  setBmId(t?.businessManagerId ?? "");
                  setAdAccountId("");
                  setAdAccountName("");
                }}
                placeholder="Select a Business Manager…"
                options={activeTokens.map((t) => ({ value: t.id.toString(), label: t.label }))}
              />
            )}
          </FormField>

          {/* Ad Account */}
          <FormField label="Ad Account">
            {!tokenId ? (
              <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Select a Business Manager first
              </div>
            ) : loadingAccounts ? (
              <div className="flex items-center gap-2 text-xs py-2 px-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Loader2 size={12} className="animate-spin" /> Loading accounts…
              </div>
            ) : (
              <SearchableSelect
                value={adAccountId}
                selectedLabel={adAccountId ? `${adAccountName} (${adAccountId})` : ""}
                search={adAccountSearch}
                onSearchChange={(q) => { setAdAccountSearch(q); }}
                onChange={(v) => {
                  const acc = adAccounts.find((a) => a.id === v);
                  setAdAccountId(v);
                  setAdAccountName(acc?.name ?? v);
                  setAdAccountSearch("");
                  setSelectedCampaigns([]);
                  // Persist selection
                  if (v && tokenId && bmId) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tokenId, bmId, adAccountId: v, adAccountName: acc?.name ?? v }));
                  } else {
                    localStorage.removeItem(STORAGE_KEY);
                  }
                }}
                placeholder="Search ad accounts…"
                options={adAccounts
                  .filter((a) => {
                    const q = adAccountSearch.toLowerCase();
                    return !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
                  })
                  .map((a) => ({ value: a.id, label: `${a.name} (${a.id})` }))}
              />
            )}
          </FormField>

          {/* Campaigns */}
          <FormField label={
            <span className="flex items-center gap-2">
              Campaigns
              {adAccountId && !loadingCampaigns && campaigns.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                  {campaigns.length}
                </span>
              )}
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", fontWeight: 400 }}>(optional — leave empty for all active)</span>
            </span>
          }>
            <div className="flex gap-1.5 mb-2">
              {(["active", "last_30d", "inactive"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setCampaignFilter(f); setSelectedCampaigns([]); }}
                  className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all"
                  style={{
                    background: campaignFilter === f ? config.color + "25" : "rgba(255,255,255,0.06)",
                    color: campaignFilter === f ? config.color : "rgba(255,255,255,0.5)",
                    border: `1px solid ${campaignFilter === f ? config.color + "40" : "transparent"}`,
                  }}
                >
                  {f === "last_30d" ? "Last 30 Days" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {!adAccountId ? (
              <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Select an ad account first
              </div>
            ) : loadingCampaigns ? (
              <div className="flex items-center gap-2 text-xs py-2 px-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Loader2 size={12} className="animate-spin" /> Loading campaigns…
              </div>
            ) : (
              <MultiSelect
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                selected={selectedCampaigns}
                onChange={setSelectedCampaigns}
                color={config.color}
                placeholder="Select campaigns (or leave empty for all)…"
              />
            )}
          </FormField>
        </Section>

        {/* Analysis Period */}
        <Section title="Analysis Period" hint="Choose the date range for the analysis. 'Last 7 Days' is the most common for weekly reviews. The 'Compare to prior period' toggle adds a side-by-side comparison window of the same length immediately before the selected range.">
          <FormField label="Date Range">
            <Select
              value={datePreset}
              onChange={setDatePreset}
              options={DATE_PRESETS.map((d) => ({ value: d.value, label: d.label }))}
            />
          </FormField>
          {config.hasCompare && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setCompare((c) => !c)}
                className="w-9 h-5 rounded-full transition-all relative cursor-pointer"
                style={{ background: compare ? config.color : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                  style={{ background: "#fff", left: compare ? "calc(100% - 18px)" : "2px" }}
                />
              </div>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                Compare to prior period
                <span className="block" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>(prior window auto-matched to selected date range)</span>
              </span>
            </label>
          )}
        </Section>

        {/* Modules */}
        {config.hasModules && config.modules && (
          <Section title="Analysis Modules" hint="Each module is a separate analysis component that runs in parallel. Deselect modules you don't need to reduce run time and credit usage. All modules are enabled by default.">
            <div className="grid grid-cols-2 gap-2">
              {config.modules.map((m) => {
                const on = enabledModules.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setEnabledModules((prev) => on ? prev.filter((x) => x !== m.id) : [...prev, m.id])}
                    className="flex items-start gap-2 p-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: on ? `${config.color}15` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${on ? config.color + "35" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded mt-0.5 flex items-center justify-center shrink-0"
                      style={{ background: on ? config.color : "rgba(255,255,255,0.1)", border: on ? "none" : "1px solid rgba(255,255,255,0.2)" }}
                    >
                      {on && <CheckCircle2 size={9} color="#fff" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: on ? config.color : "rgba(255,255,255,0.6)" }}>{m.label}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>{m.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setEnabledModules([])}
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Deselect all
            </button>
          </Section>
        )}

        {/* Enrichment */}
        {config.hasEnrichment && (
          <Section title="Enrich Analysis" optional hint="Performance Insights can be enriched with data from recent Audience Overlap and Creative Lifecycle runs for the same campaign within an ad account, off the same date range. When you select prior runs, the agent will cross-reference those findings — for example, flagging creatives that are both fatigued (from Creative Lifecycle) and running in overlapping audiences (from Audience Overlap), enabling deeper insight.">
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
              Performance Insights can be enriched with data from recent Audience Overlap and Creative Lifecycle runs for the same campaign within an ad account, off the same date range. When you select prior runs in the Enrich Analysis section, the agent will cross-reference those findings — for example, flagging creatives that are both fatigued (from Creative Lifecycle) and running in overlapping audiences (from Audience Overlap), enabling deeper insight.
            </p>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
              To use this feature, you first must run the Audience Overlap and/or Creative Lifecycle skills. The enrichment data (via JSON files from the skill output) is injected into the agent&apos;s prompt.
            </p>
            <FormField label="Audience Overlap Run">
              {!adAccountId ? (
                <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Select an ad account first
                </div>
              ) : overlapRuns.length === 0 ? (
                <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  No Audience Overlap runs with JSON data found for this account
                </div>
              ) : (
                <Select
                  value={enrichOverlapRunId?.toString() ?? ""}
                  onChange={(v) => setEnrichOverlapRunId(v ? parseInt(v) : null)}
                  placeholder="None (skip enrichment)"
                  options={[
                    { value: "", label: "None" },
                    ...overlapRuns.map((r) => ({
                      value: r.id.toString(),
                      label: `${r.datePreset ?? "unknown range"} · ${r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "?"}${
                        r.adAccountName ? ` · ${r.adAccountName}` : ""
                      }`,
                    })),
                  ]}
                />
              )}
            </FormField>
            <FormField label="Creative Lifecycle Run">
              {!adAccountId ? (
                <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Select an ad account first
                </div>
              ) : lifecycleRuns.length === 0 ? (
                <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  No Creative Lifecycle runs with JSON data found for this account
                </div>
              ) : (
                <Select
                  value={enrichLifecycleRunId?.toString() ?? ""}
                  onChange={(v) => setEnrichLifecycleRunId(v ? parseInt(v) : null)}
                  placeholder="None (skip enrichment)"
                  options={[
                    { value: "", label: "None" },
                    ...lifecycleRuns.map((r) => ({
                      value: r.id.toString(),
                      label: `${r.datePreset ?? "unknown range"} · ${r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "?"}${
                        r.adAccountName ? ` · ${r.adAccountName}` : ""
                      }`,
                    })),
                  ]}
                />
              )}
            </FormField>
          </Section>
        )}

        {/* Additional Instructions */}
        <Section title="Additional Instructions" optional hint="Add any free-text context for the agent — e.g. 'Focus on prospecting campaigns only' or 'We launched a new creative on April 15'. This is injected directly into the agent's prompt.">
          <textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            placeholder="Any extra context or focus areas for this analysis run…"
            rows={3}
            className="w-full text-xs rounded-lg px-3 py-2.5 resize-none outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#FAFAFA",
              fontFamily: "'Montserrat', sans-serif",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = config.color + "60")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </Section>

        {/* Model Selector */}
        <Section title="Manus Model" hint="The Manus model controls the AI agent used for this run. 1.6 Lite is recommended for most runs for credit efficiency. Use 1.6 for more complex analyses that benefit from deeper reasoning.">
          <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
            Recommend using <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>1.6 Lite</span> model for credit efficiency.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["manus-1.6-lite", "manus-1.6"] as const).map((m) => {
              const labels: Record<string, { short: string; sub: string }> = {
                "manus-1.6-lite": { short: "1.6 Lite", sub: "Faster · fewer credits" },
                "manus-1.6": { short: "1.6", sub: "Balanced" },
              };
              const active = agentProfile === m;
              return (
                <button
                  key={m}
                  onClick={() => setAgentProfile(m)}
                  className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all"
                  style={{
                    background: active ? `${config.color}20` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? config.color + "50" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <span className="text-xs font-bold" style={{ color: active ? config.color : "rgba(255,255,255,0.6)" }}>{labels[m].short}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>{labels[m].sub}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Run Button */}
        <div className="flex flex-col gap-1.5 mt-2">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{
              background: canRun ? config.color : "rgba(255,255,255,0.08)",
              color: canRun ? "#141349" : "rgba(255,255,255,0.25)",
              cursor: canRun ? "pointer" : "not-allowed",
            }}
          >
            {status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {status === "running" ? "Running…" : `Run ${config.skillName}`}
          </button>
          <div className="flex items-center justify-between">
            {!adAccountId ? (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Select an ad account to enable
              </span>
            ) : null}
            {status !== "idle" && (
              <button onClick={handleReset} className="p-2 rounded-lg transition-colors ml-auto" style={{ color: "rgba(255,255,255,0.4)" }} title="Reset">
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Report Panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {status === "idle" && (
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Play size={24} style={{ color: config.color, opacity: 0.5 }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>Configure and run {config.skillName}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>{config.description}</p>
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="flex flex-col gap-4 p-2">
            {/* Header with kill-switch */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${config.color}15`, border: `1px solid ${config.color}30` }}>
                <Loader2 size={20} className="animate-spin" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>Analysis in progress</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Elapsed: {formatElapsed(elapsedSec)}</p>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Request Update button */}
                <button
                  onClick={async () => {
                    if (!runId || isRequestingUpdate) return;
                    setIsRequestingUpdate(true);
                    setUpdateRequestMsg(null);
                    try {
                      const res = await requestUpdateMutation.mutateAsync({ runId });
                      setUpdateRequestMsg(res.message ?? null);
                      if (res.success) {
                        setStatusLog((prev) => [...prev, { ts: Date.now(), msg: "Update requested — awaiting agent response…" }]);
                      }
                    } catch (e) {
                      setUpdateRequestMsg(e instanceof Error ? e.message : "Failed to request update");
                    } finally {
                      setIsRequestingUpdate(false);
                      setTimeout(() => setUpdateRequestMsg(null), 6000);
                    }
                  }}
                  disabled={isRequestingUpdate}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(0,179,122,0.1)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.25)" }}
                  title="Ask the agent for a plain-language status update"
                >
                  {isRequestingUpdate ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
                  {isRequestingUpdate ? "Requesting…" : "Request Update"}
                </button>
                {/* Kill-switch */}
                <button
                  onClick={handleAbort}
                  disabled={isAborting}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(237,19,95,0.12)", color: "#ED135F", border: "1px solid rgba(237,19,95,0.3)" }}
                  title="Abort this run"
                >
                  {isAborting ? <Loader2 size={11} className="animate-spin" /> : <OctagonX size={11} />}
                  {isAborting ? "Aborting…" : "Abort Run"}
                </button>
              </div>
            </div>

            {/* Rate limit alert */}
            {rateLimitWarning && (
              <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(255,180,0,0.1)", border: "1px solid rgba(255,180,0,0.3)" }}>
                <AlertCircle size={14} style={{ color: "#FFB400", marginTop: 1, flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#FFB400" }}>Meta API rate limit detected</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>The agent is waiting for the rate limit window to reset. This is normal and will resolve automatically — no action needed.</p>
                </div>
              </div>
            )}

            {/* Timeout warning */}
            {timeoutWarning && !rateLimitWarning && (
              <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(255,120,0,0.1)", border: "1px solid rgba(255,120,0,0.25)" }}>
                <AlertCircle size={14} style={{ color: "#FF7800", marginTop: 1, flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#FF7800" }}>Taking longer than expected</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>The analysis is still running ({formatElapsed(elapsedSec)}). Large accounts with many campaigns can take 15–20 minutes. You can leave this page — the run will complete in the background and appear in Run Logs.</p>
                </div>
              </div>
            )}

            {/* Update request feedback */}
            {updateRequestMsg && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(0,179,122,0.08)", border: "1px solid rgba(0,179,122,0.2)", color: "rgba(0,179,122,0.9)" }}>
                <CheckCircle2 size={12} />
                {updateRequestMsg}
              </div>
            )}

            {/* Live status log */}
            <div className="rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Live Status</p>
              </div>
              <div className="px-3 py-2 flex flex-col gap-1.5" style={{ maxHeight: 260, overflowY: "auto" }}>
                {statusLog.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <Loader2 size={10} className="animate-spin" style={{ color: config.color }} />
                    Waiting for agent to start…
                  </div>
                ) : (
                  statusLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" style={{ color: i === statusLog.length - 1 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)" }}>
                      {i === statusLog.length - 1
                        ? <Loader2 size={9} className="animate-spin shrink-0 mt-0.5" style={{ color: config.color }} />
                        : <CheckCircle2 size={9} className="shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }} />}
                      <span>{entry.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-5" style={{ background: "rgba(237,19,95,0.08)", border: "1px solid rgba(237,19,95,0.2)" }}>
              <div className="flex items-start gap-3">
                <AlertCircle size={18} style={{ color: "#ED135F" }} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: "#ED135F" }}>Run failed</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{errorMsg}</p>
                </div>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all"
                style={{ background: config.color, color: "#141349" }}
              >
                <RotateCcw size={12} /> Retry
              </button>
              {/* Re-fetch report — only show when the task completed but returned no report/attachments */}
              {runId && noReportOnSuccess && (
                <button
                  onClick={handleRedeliver}
                  disabled={isRedelivering}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(0,179,122,0.12)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.3)" }}
                  title="Try to re-fetch the report files from the completed Manus task"
                >
                  {isRedelivering ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                  {isRedelivering ? "Fetching…" : "Re-fetch Report"}
                </button>
              )}
              {taskUrl && (
                <a
                  href={taskUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <ExternalLink size={12} /> View on Manus
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Persisted last-run output (shown only when idle and no active run) ── */}
        {status === "idle" && lastOutputData?.reportMarkdown && (
          <div className="flex flex-col gap-4">
            {/* Banner */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <Clock size={13} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                Last run:{" "}
                <span style={{ color: "rgba(255,255,255,0.65)" }}>
                  {lastOutputData.completedAt
                    ? new Date(lastOutputData.completedAt).toLocaleString()
                    : "unknown"}
                </span>
                {lastOutputData.adAccountName && (
                  <> · {lastOutputData.adAccountName}</>
                )}
                {lastOutputData.datePreset && (
                  <> · {DATE_PRESETS.find((d) => d.value === lastOutputData.datePreset)?.label ?? lastOutputData.datePreset}</>
                )}
              </span>
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Previous result
              </span>
            </div>
            {/* Persisted attachments */}
            {lastOutputData.attachments && (lastOutputData.attachments as Array<{ filename: string; url: string; contentType: string }>).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(lastOutputData.attachments as Array<{ filename: string; url: string; contentType: string }>).map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={att.filename}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <FileDown size={10} /> {att.filename}
                  </a>
                ))}
              </div>
            )}
            {/* Persisted report */}
            <div
              className="rounded-xl p-5 prose-report"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Streamdown>{lastOutputData.reportMarkdown}</Streamdown>
            </div>
          </div>
        )}

        {status === "success" && report && (
          <div className="flex flex-col gap-4">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 size={16} style={{ color: "#00B37A" }} />
              <span className="text-sm font-semibold" style={{ color: "#00B37A" }}>Analysis complete</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {adAccountName || adAccountId} · {DATE_PRESETS.find((d) => d.value === datePreset)?.label}
              </span>
              {creditUsage !== null && (
                <span
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(0,179,122,0.12)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.25)" }}
                  title="Manus credits consumed by this run"
                >
                  ⚡ {creditUsage} credits
                </span>
              )}
              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {taskUrl && (
                  <a
                    href={taskUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <ExternalLink size={11} /> View on Manus
                  </a>
                )}
                {attachments.filter((a) => a.contentType === "application/pdf" || a.filename.endsWith(".pdf")).map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={att.filename}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{ background: `${config.color}20`, color: config.color, border: `1px solid ${config.color}40` }}
                  >
                    <FileDown size={11} /> Export PDF
                  </a>
                ))}
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <RotateCcw size={11} /> Re-run
                </button>
              </div>
            </div>
            {/* Attachments (non-PDF) */}
            {attachments.filter((a) => a.contentType !== "application/pdf" && !a.filename.endsWith(".pdf")).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.filter((a) => a.contentType !== "application/pdf" && !a.filename.endsWith(".pdf")).map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={att.filename}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <FileDown size={10} /> {att.filename}
                  </a>
                ))}
              </div>
            )}
            {/* Report */}
            <div
              className="rounded-xl p-5 prose-report"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Streamdown>{report}</Streamdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children, optional, hint }: { title: string; children: React.ReactNode; optional?: boolean; hint?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </p>
        {optional && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span>}
        {hint && <HelpTip content={hint} side="right" size={11} />}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
      {children}
    </div>
  );
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs rounded-lg px-3 py-2.5 appearance-none outline-none pr-8"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: value ? "#FAFAFA" : "rgba(255,255,255,0.35)",
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#141349" }}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
    </div>
  );
}

function SearchableSelect({
  value, selectedLabel, search, onSearchChange, onChange, options, placeholder,
}: {
  value: string;
  selectedLabel: string;
  search: string;
  onSearchChange: (q: string) => void;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center rounded-lg px-3 py-2 gap-2"
        style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${open ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)"}` }}
      >
        <Search size={11} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
        <input
          type="text"
          value={open ? search : (value ? selectedLabel : "")}
          onChange={(e) => { onSearchChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); onSearchChange(""); }}
          placeholder={value ? selectedLabel : (placeholder ?? "Search…")}
          className="flex-1 text-xs bg-transparent outline-none min-w-0"
          style={{ color: value && !open ? "#FAFAFA" : "rgba(255,255,255,0.7)", fontFamily: "'Montserrat', sans-serif" }}
        />
        {value && (
          <button onClick={(e) => { e.stopPropagation(); onChange(""); onSearchChange(""); setOpen(false); }} style={{ color: "rgba(255,255,255,0.3)" }}>
            <X size={11} />
          </button>
        )}
        <ChevronDown size={11} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
      </div>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg z-30 overflow-hidden"
          style={{ background: "#1c1a5e", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", maxHeight: 220, overflowY: "auto" }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>No results found</div>
          ) : (
            options.map((o) => (
              <button
                key={o.value}
                onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); onSearchChange(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                style={{ color: o.value === value ? "#00BEEF" : "rgba(255,255,255,0.75)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {o.value === value && <CheckCircle2 size={10} style={{ color: "#00BEEF", flexShrink: 0 }} />}
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  options, selected, onChange, color, placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (v: string[]) => void;
  color: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const filtered = options.filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase()));
  const label = selected.length === 0
    ? (placeholder ?? "All campaigns")
    : `${selected.length} campaign${selected.length > 1 ? "s" : ""} selected`;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs rounded-lg px-3 py-2.5"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)"}`,
          color: selected.length ? "#FAFAFA" : "rgba(255,255,255,0.35)",
        }}
      >
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {selected.length > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="flex items-center justify-center w-4 h-4 rounded-full"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
            >
              <X size={9} />
            </span>
          )}
          <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
        </div>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg z-30"
          style={{ background: "#1c1a5e", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Search size={11} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              autoFocus
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Montserrat', sans-serif" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ color: "rgba(255,255,255,0.3)" }}><X size={10} /></button>
            )}
          </div>
          {/* Select all / deselect all */}
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => onChange(filtered.map((o) => o.value))}
              className="text-xs font-semibold"
              style={{ color: color }}
            >
              Select all{search ? " filtered" : ""} ({filtered.length})
            </button>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Clear ({selected.length})
              </button>
            )}
          </div>
          {/* Campaign list */}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>No campaigns match</div>
            ) : (
              filtered.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors"
                    style={{ color: on ? color : "rgba(255,255,255,0.7)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center"
                      style={{ background: on ? color : "transparent", border: `1px solid ${on ? color : "rgba(255,255,255,0.25)"}` }}
                    >
                      {on && <CheckCircle2 size={9} color="#141349" />}
                    </div>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mock report generator ─────────────────────────────────────────────────────

function generateMockReport(config: SkillConfig, account: string, datePreset: string): string {
  const dateLabel = DATE_PRESETS.find((d) => d.value === datePreset)?.label ?? datePreset;

  const reports: Record<string, string> = {
    "weekly-optimization": `# Weekly Optimization Report
**Account:** ${account} · **Period:** ${dateLabel}

## Executive Summary
Performance this week shows a **12% improvement in CPC** across active campaigns, driven primarily by the Prospecting — Broad audience segment. However, frequency is rising in the Retargeting — 30-Day pool, warranting creative rotation.

## Top Recommendations

### 1. Increase Budget on Prospecting — Lookalike 3% (+$500/day)
- **Impact:** High | **Confidence:** 87%
- CPM is $4.20 below account average; CPC is $0.38 vs $0.61 baseline
- Auction density is favorable — no saturation signals detected

### 2. Rotate Creative in Retargeting — 30-Day
- **Impact:** Medium | **Confidence:** 79%
- Frequency: 6.2 (threshold: 5.0) — creative fatigue likely
- CTR has declined 18% week-over-week

### 3. Pause Bottom 2 Ad Sets in Brand Awareness Campaign
- **Impact:** Medium | **Confidence:** 82%
- CPM $28.40 vs $14.20 campaign average — 2× inefficiency
- Zero conversions in 14 days despite $1,240 spend

## Performance Breakdown

| Ad Set | Spend | CPM | CPC | CTR | Conversions | CPA |
|--------|-------|-----|-----|-----|-------------|-----|
| Prospecting — Broad | $3,240 | $8.20 | $0.38 | 2.16% | 48 | $67.50 |
| Prospecting — LAL 3% | $1,890 | $9.80 | $0.42 | 2.33% | 31 | $60.97 |
| Retargeting — 30-Day | $2,100 | $14.60 | $0.89 | 1.64% | 22 | $95.45 |
| Brand Awareness | $1,400 | $21.30 | $1.24 | 1.72% | 3 | $466.67 |

## Placement Analysis
- **Facebook Feed** is delivering 68% of conversions at 42% of spend — over-index here
- **Instagram Stories** has a 0.8% CTR vs 2.1% Feed — consider reducing allocation
- **Audience Network** shows high CTR (3.2%) but zero conversions — likely click fraud; recommend exclusion`,

    "performance-insights": `# Performance Insights Report
**Account:** ${account} · **Period:** ${dateLabel}

## KPI Summary
| Metric | This Period | Prior Period | Change |
|--------|-------------|--------------|--------|
| Total Spend | $8,630 | $7,940 | +8.7% |
| CPM | $12.40 | $14.20 | **-12.7%** ↓ |
| CPC | $0.61 | $0.78 | **-21.8%** ↓ |
| CTR | 2.03% | 1.82% | **+11.5%** ↑ |
| Conversions | 104 | 87 | **+19.5%** ↑ |
| CPA | $82.98 | $91.26 | **-9.1%** ↓ |

## Budget Pacing
Current spend rate is **on track** — 94% of monthly budget consumed with 6 days remaining.

## Placement Conversion Analysis
| Placement | Spend | Conversions | CPA | Conv Rate |
|-----------|-------|-------------|-----|-----------|
| Facebook Feed | $4,200 | 61 | $68.85 | 3.2% |
| Instagram Feed | $2,100 | 28 | $75.00 | 2.8% |
| Instagram Stories | $1,430 | 11 | $130.00 | 1.4% |
| Audience Network | $900 | 4 | $225.00 | 0.6% |

## Creative Performance
**Top Performer:** Video — "Summer Collection 30s" — CPA $54.20, CTR 3.8%
**Underperformer:** Static — "Generic Brand Banner" — CPA $142.00, CTR 0.9%

## Signals
- **Auction pressure** is elevated in the 25–34 female demographic — CPM up 22% vs prior period
- **Learning phase** detected on 2 ad sets — avoid edits for next 72 hours
- **Delivery saturation** approaching on Retargeting — 7-Day (reach 89% of audience)`,

    "creative-lifecycle": `# Creative Lifecycle Analysis
**Account:** ${account} · **Period:** ${dateLabel}

## Fatigue Summary
| Creative | Method | Signal | Status |
|----------|--------|--------|--------|
| Video — Summer 30s | CDR | CDR 0.82 (baseline 1.0) | 🟡 Early Decay |
| Static — Lifestyle A | BOCPD | Change point detected Day 12 | 🔴 Fatigued |
| Video — Product Demo | CUSUM | Below threshold | 🟢 Healthy |
| Carousel — Features | EWMA | Declining trend | 🟡 Early Decay |
| Static — Generic Banner | Freq-CPM | R²=0.87, elasticity 1.4 | 🔴 Fatigued |

## CDR Analysis (Beta-Binomial Significance)
**Static — Lifestyle A:** CDR = 0.61 vs baseline 1.00 — statistically significant decay (p < 0.01)
Impressions: 48,200 | Clicks: 312 → 198 (week-over-week decline: 36.5%)

## BOCPD Change Points
Change point detected at Day 12 for Static — Lifestyle A with 94% posterior probability.
Recommend immediate creative swap.

## Frequency-CPM Elasticity
Static — Generic Banner shows CPM increasing $2.40 per unit of frequency above 4.0.
Current frequency: 7.2 — estimated wasted CPM premium: $7.68/1000 impressions.

## Recommendations
1. **Retire** Static — Lifestyle A and Static — Generic Banner immediately
2. **Monitor** Video — Summer 30s — refresh within 7 days if CDR continues declining
3. **Scale** Video — Product Demo — healthy creative with room to grow
4. **Introduce** 2 new creatives to Retargeting pool to reduce frequency pressure`,

    "structural-audit": `# Structural Audit Report
**Account:** ${account} · **Period:** ${dateLabel}

## Audit Score: 71 / 100

| Check | Score | Status |
|-------|-------|--------|
| Data Infrastructure & EMQ | 8/10 | 🟡 Needs Attention |
| Signal Density | 6/10 | 🔴 Critical |
| Creative Velocity & Format Diversity | 7/10 | 🟡 Needs Attention |
| Liquidity Consolidation Index | 9/10 | 🟢 Good |
| Budget Liquidity Ratio | 8/10 | 🟢 Good |
| Late-Stage Funnel Signal Velocity | 5/10 | 🔴 Critical |
| Creative Fatigue Index | 7/10 | 🟡 Needs Attention |
| ASC Adoption Rate | 6/10 | 🟡 Needs Attention |
| Learning Phase & Reset Risk | 8/10 | 🟢 Good |
| Auction Mechanics Context | 7/10 | 🟡 Needs Attention |

## Critical Issues

### Signal Density (6/10)
- Pixel is firing but **purchase event EMQ is 3.2** — below the 6.0 threshold for reliable optimization
- Only 18 purchase events in the last 7 days — Meta requires 50+ for stable delivery
- **Recommendation:** Broaden optimization to Add to Cart or Landing Page View as proxy events

### Late-Stage Funnel Signal Velocity (5/10)
- No CAPI (Conversions API) integration detected — relying solely on pixel
- Estimated signal loss: 28–35% due to iOS 14+ and browser privacy changes
- **Recommendation:** Implement CAPI immediately — this is the highest-leverage structural fix

## Opportunities
- **ASC Adoption:** Only 1 of 6 active campaigns uses Advantage+ Shopping — consider testing
- **Creative Velocity:** 3 creatives added in last 30 days — target is 5+ for healthy rotation`,

    "audience-overlap": `# Audience Overlap & Wasted Spend Report
**Account:** ${account} · **Period:** ${dateLabel}

## Overlap Summary
**Total estimated wasted spend from audience overlap: $1,240 (14.4% of total spend)**

## Pairwise Overlap Analysis

| Ad Set A | Ad Set B | Overlap % | Wasted Spend |
|----------|----------|-----------|--------------|
| Prospecting — Broad | Prospecting — LAL 3% | 34% | $420 |
| Prospecting — Broad | Retargeting — 30-Day | 18% | $280 |
| Prospecting — LAL 3% | Prospecting — LAL 5% | 67% | $390 |
| Retargeting — 7-Day | Retargeting — 30-Day | 82% | $150 |

## Highest Risk Pairs

### Prospecting — LAL 3% × Prospecting — LAL 5% (67% overlap)
These two lookalike audiences share the majority of their addressable reach. Running both simultaneously causes significant self-competition in the auction, inflating CPMs for both.
**Recommendation:** Consolidate into a single LAL 1–5% broad audience or use audience subtraction.

### Retargeting — 7-Day × Retargeting — 30-Day (82% overlap)
The 7-day window is almost entirely contained within the 30-day window. Users in the 7-day pool are being targeted by both ad sets simultaneously.
**Recommendation:** Add the 7-day audience as an exclusion on the 30-day ad set.

## CPM Impact Model
Estimated CPM inflation from self-competition: **+$2.80/CPM** on overlapping ad sets.
At current impression volume, this represents $1,240 in recoverable spend over the analysis period.`,
  };

  return reports[config.skillId] ?? `# ${config.skillName} Report\n\nAnalysis complete for **${account}** over **${dateLabel}**.\n\nNo data available in mock mode.`;
}
