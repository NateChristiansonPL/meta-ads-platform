/**
 * AdminCreativeDecay.tsx
 *
 * Admin-only page for running creative fatigue / decay analysis.
 * Requires ad performance data to already be in the database
 * (populated by the separate "Creative Performance Sync" admin tool).
 */

import AppShell from "@/components/AppShell";
import FatigueTrendChart from "@/components/FatigueTrendChart";
import type { TrendPoint } from "@/components/FatigueTrendChart";
import { DateRangePicker, dateRangeToStrings, stringsToDateRange } from "@/components/ui/DateRangePicker";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { trpc } from "@/lib/trpc";
import { format, subDays } from "date-fns";
import {
  AlertTriangle, Bell, BellOff, CheckCircle2, ChevronDown,
  Eye, Filter, LineChart, Loader2, Play, RefreshCw, Search, Settings2, Shield, X, Zap,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultRow = {
  id: number;
  creativeId: string;
  creativeName: string;
  adFormat: string;
  campaignName: string;
  compositeAssessment: string;
  cdrPct: number | null;
  relCdr: number | null;
  ewmaFired?: boolean;
  elasticityFired?: boolean;
  totalSpend: number;
  totalImpressions: number;
  daysActive: number;
  marginalCpa: number | null;
  baselineCpa: number | null;
  fatigueStatus: string;
  fatigueScore: number;
  evidence?: { avgCtr?: number; avgFrequency?: number; reliability?: number; totalEvents?: number };
  firstDetectedAt?: { emerging: string | null; possible: string | null; probable: string | null };
  trendData?: TrendPoint[];
  optimizationGoal?: string | null;
};

type CampaignStatusFilter = "active" | "active_30d" | "inactive" | "all";

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = new Date();
const prior = subDays(today, 13);
const money = (v: number | null | undefined) =>
  v == null ? "-" : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (v: number | null | undefined) => (v == null ? "-" : `${v.toFixed(1)}%`);

const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatusFilter; label: string }[] = [
  { value: "active", label: "Active campaigns" },
  { value: "active_30d", label: "Active in last 30 days" },
  { value: "inactive", label: "Inactive / Paused" },
  { value: "all", label: "All campaigns" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminCreativeDecay() {
  const utils = trpc.useUtils();

  // BM / Account / Campaign selectors
  const { data: tokens = [] } = trpc.tokens.listAll.useQuery();
  const uniqueTokens = useMemo(() => {
    const seen = new Map<string, typeof tokens[0]>();
    for (const t of tokens) {
      if (!seen.has(t.businessManagerId)) seen.set(t.businessManagerId, t);
    }
    return Array.from(seen.values());
  }, [tokens]);

  const [tokenId, setTokenId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<CampaignStatusFilter>("active");

  // Analysis date range
  const [analysisRange, setAnalysisRange] = useState<DateRange | undefined>(
    stringsToDateRange(format(prior, "yyyy-MM-dd"), format(today, "yyyy-MM-dd"))
  );

  // Analysis options
  const [onlyLiveAds, setOnlyLiveAds] = useState(false);
  const [notifyEmerging, setNotifyEmerging] = useState(false);
  const [notifyPossible, setNotifyPossible] = useState(true);
  const [notifyProbable, setNotifyProbable] = useState(true);

  // Output tab: results vs notifications
  const [outputTab, setOutputTab] = useState<"results" | "notifications">("results");

  // Results
  const [analysisRows, setAnalysisRows] = useState<ResultRow[] | null>(null);
  const [resultsFilter, setResultsFilter] = useState<"all" | "signals">("all");

  // Notifications log
  const { data: notifData, refetch: refetchNotifs } = trpc.adminCreativeDecay.getDecayNotifications.useQuery({ limit: 100 });
  const notifications = notifData?.notifications ?? [];

  // Scheduler panel
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [viewConfigOpen, setViewConfigOpen] = useState(false);
  const { data: schedulerConfig, refetch: refetchScheduler } = trpc.adminCreativeDecay.getAnalysisSchedulerConfig.useQuery();
  const [sched, setSched] = useState({
    analysisEnabled: false,
    analysisUtcHour: 7,
    analysisRollingDays: 14,
    notifyEmerging: false,
    notifyPossible: true,
    notifyProbable: true,
    onlyLiveAds: false,
  });

  useEffect(() => {
    if (schedulerConfig) {
      setSched({
        analysisEnabled: schedulerConfig.analysisEnabled ?? false,
        analysisUtcHour: schedulerConfig.analysisUtcHour ?? 7,
        analysisRollingDays: schedulerConfig.analysisRollingDays ?? 14,
        notifyEmerging: schedulerConfig.notifyEmerging ?? false,
        notifyPossible: schedulerConfig.notifyPossible ?? true,
        notifyProbable: schedulerConfig.notifyProbable ?? true,
        onlyLiveAds: schedulerConfig.onlyLiveAds ?? false,
      });
    }
  }, [schedulerConfig]);

  const saveScheduler = trpc.adminCreativeDecay.saveAnalysisSchedulerConfig.useMutation({
    onSuccess: () => { toast.success("Scheduler config saved."); refetchScheduler(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Auto-save helper — called when toggling enable
  const autoSave = (patch: Partial<typeof sched>) => {
    const next = { ...sched, ...patch };
    setSched(next);
    saveScheduler.mutate({
      ...next,
      accountId: accountId || schedulerConfig?.accountId || "",
      campaignIds: campaignIds.length > 0 ? campaignIds.join(",") : schedulerConfig?.campaignIds ?? null,
    });
  };

  // Queries
  const selectedToken = uniqueTokens.find((t) => t.id === tokenId);
  const { data: accountData, isLoading: accountsLoading } = trpc.meta.getAdAccountsByTokenId.useQuery(
    { tokenId: tokenId! }, { enabled: !!tokenId, staleTime: 5 * 60 * 1000 }
  );
  const accounts: Array<{ id: string; name: string }> = accountData?.accounts ?? [];

  const { data: campaignData, isLoading: campaignsLoading } = trpc.adminMeta.getCampaignsByTokenId.useQuery(
    { tokenId: tokenId!, adAccountId: accountId, statusFilter: campaignStatusFilter },
    { enabled: !!tokenId && !!accountId, staleTime: 2 * 60 * 1000 }
  );
  const campaigns: Array<{ id: string; name: string; status?: string; objective?: string }> = campaignData?.campaigns ?? [];

  const { data: latest } = trpc.adminCreativeDecay.getLatestResults.useQuery(
    accountId ? { accountId } : undefined,
    { enabled: true, staleTime: 30_000 }
  );

  // Analysis mutation
  const analysisMutation = trpc.adminCreativeDecay.runDecayAnalysis.useMutation({
    onSuccess: (data) => {
      setAnalysisRows(data.records as unknown as ResultRow[]);
      utils.adminCreativeDecay.getLatestResults.invalidate();
      refetchNotifs();
      toast.success(`Analysis complete: ${data.records.length} creative group${data.records.length === 1 ? "" : "s"} analyzed.`);
    },
    onError: (e: { message: string }) => toast.error(e.message || "Analysis failed."),
  });

  // Run Now (triggerDecayAnalysis) — uses scheduler config account/campaigns
  const [skipSync, setSkipSync] = useState(false);
  const [runNowOpen, setRunNowOpen] = useState(false);
  const triggerMutation = trpc.adminCreativeDecay.triggerDecayAnalysis.useMutation({
    onSuccess: (data) => {
      utils.adminCreativeDecay.getLatestResults.invalidate();
      refetchNotifs();
      setRunNowOpen(false);
      toast.success(`Chain complete: ${data.recordCount} creative group${data.recordCount === 1 ? "" : "s"} analyzed.${data.syncWarnings?.length ? ` (${data.syncWarnings.length} sync warning${data.syncWarnings.length === 1 ? "" : "s"})` : ""}`);
    },
    onError: (e: { message: string }) => toast.error(e.message || "Trigger failed."),
  });
  const canTrigger = !!schedulerConfig?.accountId && !triggerMutation.isPending;
  // Filtered data
  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    return accounts.filter((a) => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.toLowerCase();
    return campaigns.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [campaigns, campaignSearch]);

  const analysisDates = dateRangeToStrings(analysisRange);
  const canAnalyze = !!accountId && !!analysisDates && !analysisMutation.isPending;

  const handleAnalysis = () => {
    if (!accountId || !analysisDates) return;
    analysisMutation.mutate({
      adAccountId: accountId, campaignIds,
      dateFrom: analysisDates.from, dateTo: analysisDates.to,
      onlyLiveAds, notifyEmerging, notifyPossible, notifyProbable,
    });
  };

  const displayRows = (analysisRows ?? (latest?.records as ResultRow[] | undefined) ?? []);
  const filteredRows = resultsFilter === "signals"
    ? displayRows.filter(r => r.fatigueStatus !== "HEALTHY" && r.fatigueStatus !== "BLOCKED")
    : displayRows;

  return (
    <AppShell
      title="Admin Creative Decay"
      subtitle="Run creative fatigue analysis on synced Meta ad performance data."
      badge="ADMIN ONLY"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSchedulerOpen(!schedulerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Settings2 size={12} />
            Scheduler
            {schedulerConfig?.analysisEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" />
            )}
          </button>
          <button
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
          </button>
        </div>
      }
    >
      {/* ── Run Now Modal ────────────────────────────────────────────────── */}
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
      {/* ── View Config Modal ─────────────────────────────────────────────── */}
      {viewConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setViewConfigOpen(false)}>
          <div className="rounded-2xl p-5 w-full max-w-sm space-y-3" style={{ background: "#1A1A3A", border: "1px solid rgba(237,19,95,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Analysis Scheduler Config</h3>
              <button onClick={() => setViewConfigOpen(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={15} /></button>
            </div>
            {schedulerConfig ? (
              <div className="space-y-1.5 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                <ConfigRow label="Enabled" value={schedulerConfig.analysisEnabled ? "Yes" : "No"} />
                <ConfigRow label="UTC Hour" value={String(schedulerConfig.analysisUtcHour ?? 7)} />
                <ConfigRow label="Rolling Days" value={String(schedulerConfig.analysisRollingDays ?? 14)} />
                <ConfigRow label="Ad Account" value={schedulerConfig.accountId || "(not set)"} />
                <ConfigRow label="Campaign IDs" value={schedulerConfig.campaignIds || "All campaigns"} />
                <ConfigRow label="Only Live Ads" value={schedulerConfig.onlyLiveAds ? "Yes" : "No"} />
                <ConfigRow label="Notify Emerging" value={schedulerConfig.notifyEmerging ? "Yes" : "No"} />
                <ConfigRow label="Notify Possible" value={schedulerConfig.notifyPossible ? "Yes" : "No"} />
                <ConfigRow label="Notify Probable" value={schedulerConfig.notifyProbable ? "Yes" : "No"} />
                {schedulerConfig.lastAnalysisAt && <ConfigRow label="Last Run" value={new Date(schedulerConfig.lastAnalysisAt).toLocaleString()} />}
                {schedulerConfig.lastAnalysisStatus && <ConfigRow label="Last Status" value={schedulerConfig.lastAnalysisStatus} />}
              </div>
            ) : <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No scheduler config saved yet.</p>}
          </div>
        </div>
      )}

      <div className="h-full overflow-auto p-4 space-y-3">

        {/* ── Analysis Scheduler Panel ─────────────────────────────────────── */}
        {schedulerOpen && (
          <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(237,19,95,0.07)", border: "1px solid rgba(237,19,95,0.22)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold" style={{ color: "#FAFAFA" }}>Automated Analysis Scheduler</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Run decay analysis daily. Requires synced ad performance data.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewConfigOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                >
                  <Eye size={11} /> View Config
                </button>
                <button onClick={() => setSchedulerOpen(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={14} /></button>
              </div>
            </div>

            {/* Account/campaign info banner */}
            <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
              {accountId
                ? <>Scheduler will use account <strong style={{ color: "#FAFAFA" }}>{accountId}</strong>{campaignIds.length > 0 ? ` with ${campaignIds.length} selected campaign${campaignIds.length > 1 ? "s" : ""}` : " (all campaigns)"}. Captured from current page selection when saved.</>
                : <>No ad account selected on this page. Select one above before saving the scheduler config.</>}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Toggle value={sched.analysisEnabled} onChange={(v) => autoSave({ analysisEnabled: v })} />
                <span className="text-xs font-bold" style={{ color: "#FAFAFA" }}>Enable Daily Analysis</span>
                {saveScheduler.isPending && <Loader2 size={11} className="animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <SchedField label="UTC Hour (0-23)">
                  <input type="number" min={0} max={23} value={sched.analysisUtcHour}
                    onChange={e => setSched(s => ({ ...s, analysisUtcHour: +e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={inputStyle} />
                </SchedField>
                <SchedField label="Rolling Days">
                  <input type="number" min={1} max={90} value={sched.analysisRollingDays}
                    onChange={e => setSched(s => ({ ...s, analysisRollingDays: +e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={inputStyle} />
                </SchedField>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Notify on fatigue signals:</p>
                <div className="flex flex-wrap gap-3">
                  <NotifyToggle label="Emerging" value={sched.notifyEmerging} onChange={v => setSched(s => ({ ...s, notifyEmerging: v }))} color="#F7901E" />
                  <NotifyToggle label="Possible" value={sched.notifyPossible} onChange={v => setSched(s => ({ ...s, notifyPossible: v }))} color="#ED135F" />
                  <NotifyToggle label="Probable" value={sched.notifyProbable} onChange={v => setSched(s => ({ ...s, notifyProbable: v }))} color="#C0001A" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Toggle value={sched.onlyLiveAds} onChange={(v) => setSched(s => ({ ...s, onlyLiveAds: v }))} />
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>Only analyze currently live ads</span>
              </div>

              {schedulerConfig?.lastAnalysisAt && (
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Last run: {new Date(schedulerConfig.lastAnalysisAt).toLocaleString()} ({schedulerConfig.lastAnalysisStatus ?? "unknown"})
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => saveScheduler.mutate({
                  ...sched,
                  accountId: accountId || schedulerConfig?.accountId || "",
                  campaignIds: campaignIds.length > 0 ? campaignIds.join(",") : schedulerConfig?.campaignIds ?? null,
                })}
                disabled={saveScheduler.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                style={{ background: "#ED135F", color: "#fff" }}
              >
                {saveScheduler.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Save Scheduler Config
              </button>
            </div>
          </section>
        )}

        {/* ── Row 1: Account + Date Range + Analysis Options ───────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* BM Token */}
          <Panel title="Business Manager Token" description="Used to load ad accounts and campaigns for scope selection.">
            <select
              value={tokenId ?? ""}
              onChange={(e) => { setTokenId(e.target.value ? Number(e.target.value) : null); setAccountId(""); setCampaignIds([]); }}
              className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
              style={inputStyle}
            >
              <option value="">Select BM token...</option>
              {uniqueTokens.map((t) => (
                <option key={t.id} value={t.id}>{t.label || t.businessManagerName || `BM ${t.businessManagerId}`}</option>
              ))}
            </select>
            {selectedToken && (
              <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                BM: {selectedToken.businessManagerId}{selectedToken.businessManagerName ? ` · ${selectedToken.businessManagerName}` : ""}
              </p>
            )}
          </Panel>

          {/* Ad Account */}
          <Panel title="Ad Account" description="Select the account whose synced data you want to analyze.">
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
              <input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search ad accounts..."
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none"
                style={inputStyle}
              />
            </div>
            <select
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setCampaignIds([]); }}
              disabled={!tokenId || accountsLoading}
              className="w-full px-2 py-1.5 rounded-lg text-xs outline-none disabled:opacity-50"
              style={inputStyle}
            >
              <option value="">{accountsLoading ? "Loading accounts..." : "Select ad account..."}</option>
              {filteredAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
            </select>
          </Panel>

          {/* Analysis Date Range + Options */}
          <Panel title="Analysis Window & Options" description="Date range and filters for the decay analysis run.">
            <div className="space-y-2">
              <div>
                <p className="text-[11px] mb-1 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Zap size={10} /> Analysis date range
                </p>
                <DateRangePicker value={analysisRange} onChange={setAnalysisRange} showYesterday className="w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Toggle value={onlyLiveAds} onChange={setOnlyLiveAds} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Only live ads</span>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>Notify on signals:</p>
                <div className="flex flex-wrap gap-3">
                  <NotifyToggle label="Emerging" value={notifyEmerging} onChange={setNotifyEmerging} color="#F7901E" />
                  <NotifyToggle label="Possible" value={notifyPossible} onChange={setNotifyPossible} color="#ED135F" />
                  <NotifyToggle label="Probable" value={notifyProbable} onChange={setNotifyProbable} color="#C0001A" />
                </div>
              </div>
            </div>
          </Panel>
        </section>

        {/* ── Row 2: Campaign Scope + DB Info ─────────────────────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="xl:col-span-2">
            <Panel title="Campaign Scope" description="Optional. Leave empty to analyze all campaigns in the stored data.">
              <div className="mb-2">
                <p className="text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Campaign status filter</p>
                <select
                  value={campaignStatusFilter}
                  onChange={(e) => { setCampaignStatusFilter(e.target.value as CampaignStatusFilter); setCampaignIds([]); }}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={inputStyle}
                >
                  {CAMPAIGN_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  placeholder="Search campaigns..."
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={inputStyle}
                />
                <button onClick={() => setCampaignIds([])} className="px-2 py-1.5 rounded-lg text-xs font-bold" style={secondaryButton}>Clear</button>
              </div>
              {!accountId ? (
                <EmptyText>Select an ad account to load campaigns.</EmptyText>
              ) : campaignsLoading ? (
                <EmptyText><Loader2 size={11} className="animate-spin inline mr-1.5" />Loading campaigns...</EmptyText>
              ) : (
                <div className="max-h-36 overflow-auto rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {filteredCampaigns.map((c) => {
                    const checked = campaignIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setCampaignIds(prev => checked ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                          className="accent-[#ED135F]"
                        />
                        <span className="text-xs truncate" style={{ color: "#FAFAFA" }}>{c.name}</span>
                        {c.status && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{
                            background: c.status === "ACTIVE" ? "rgba(0,179,122,0.18)" : "rgba(255,255,255,0.07)",
                            color: c.status === "ACTIVE" ? "#00B37A" : "rgba(255,255,255,0.45)",
                          }}>{c.status}</span>
                        )}
                      </label>
                    );
                  })}
                  {filteredCampaigns.length === 0 && <EmptyText>No campaigns match the filter.</EmptyText>}
                </div>
              )}
              {campaignIds.length > 0 && (
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {campaignIds.length} campaign{campaignIds.length > 1 ? "s" : ""} selected
                </p>
              )}
              {campaignIds.length === 0 && accountId && (
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  No campaign filter selected; analysis will include all matching campaign data in the database.
                </p>
              )}
            </Panel>
          </div>

          <Panel title="Database Flow" description="Where this admin feature reads and writes data.">
            <div className="space-y-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              <div>
                <span className="font-bold" style={{ color: "#FAFAFA" }}>Input:</span> reads from <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>ad_performance</code>
              </div>
              <div>
                <span className="font-bold" style={{ color: "#FAFAFA" }}>Output:</span> writes to <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>creative_fatigue_results</code>
              </div>
              <div>
                <span className="font-bold" style={{ color: "#FAFAFA" }}>Signal tracking:</span> <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>first_fatigue_detected</code>
              </div>
              <div className="pt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ad performance data must be synced first using the <strong style={{ color: "rgba(255,255,255,0.55)" }}>Creative Performance Sync</strong> admin tool.
              </div>
            </div>
          </Panel>
        </section>

        {/* ── Output Tabs: Results + Notifications ─────────────────────────── */}
        <section className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Tab header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {(["results", "notifications"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setOutputTab(tab)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors capitalize"
                  style={{
                    background: outputTab === tab ? "rgba(255,255,255,0.12)" : "transparent",
                    color: outputTab === tab ? "#FAFAFA" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {tab === "results" ? "Decay Results" : "Notifications"}
                  {tab === "notifications" && notifications.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(237,19,95,0.25)", color: "#ED135F" }}>
                      {notifications.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {outputTab === "results" && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                  {(["all", "signals"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setResultsFilter(f)}
                      className="px-2.5 py-1 text-[11px] font-semibold transition-colors"
                      style={{
                        background: resultsFilter === f ? "rgba(255,255,255,0.12)" : "transparent",
                        color: resultsFilter === f ? "#FAFAFA" : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {f === "all" ? "All" : "Signals Only"}
                    </button>
                  ))}
                </div>
                {analysisMutation.isPending
                  ? <Loader2 size={14} className="animate-spin" style={{ color: "#ED135F" }} />
                  : <RefreshCw size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
                }
              </div>
            )}
            {outputTab === "notifications" && (
              <button onClick={() => refetchNotifs()} className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                <RefreshCw size={12} /> Refresh
              </button>
            )}
          </div>

          {/* Results tab */}
          {outputTab === "results" && (
            filteredRows.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                {analysisMutation.isPending
                  ? "Running analysis..."
                  : "No results yet. Sync ad performance data using the Creative Performance Sync tool, then run the decay analysis."}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}>
                      <Th> </Th>
                      <Th>Creative</Th>
                      <Th>Assessment</Th>
                      <Th>Opt. Metric</Th>
                      <Th>Score</Th>
                      <Th>First Detected</Th>
                      <Th>Spend</Th>
                      <Th>Impressions</Th>
                      <Th>CTR Drop</Th>
                      <Th>CPE Change</Th>
                      <Th>Frequency</Th>
                      <Th>Days</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <ResultRows rows={filteredRows} />
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Notifications tab */}
          {outputTab === "notifications" && (
            notifications.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                No notifications sent yet. Notifications are triggered when the scheduled analysis detects fatigue signals above your configured thresholds.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}>
                      <Th>Sent At</Th>
                      <Th>Ad Name</Th>
                      <Th>Account</Th>
                      <Th>Signal Level</Th>
                      <Th>Fatigue Score</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(notifications as unknown as Array<{
                      id: number;
                      notifiedAt: Date | string;
                      adName: string | null;
                      accountId: string;
                      signalLevel: string;
                      fatigueScore: number | null;
                    }>).map((n) => (
                      <tr key={n.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}>
                        <Td>{new Date(n.notifiedAt).toLocaleString()}</Td>
                        <Td><span style={{ color: "#FAFAFA" }}>{n.adName ?? "-"}</span></Td>
                        <Td>{n.accountId}</Td>
                        <Td>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                            background: n.signalLevel === "probable" ? "rgba(192,0,26,0.2)" : n.signalLevel === "possible" ? "rgba(237,19,95,0.2)" : "rgba(247,144,30,0.2)",
                            color: n.signalLevel === "probable" ? "#C0001A" : n.signalLevel === "possible" ? "#ED135F" : "#F7901E",
                          }}>
                            {n.signalLevel}
                          </span>
                        </Td>
                        <Td>{n.fatigueScore?.toFixed(1) ?? "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultRows({ rows }: { rows: ResultRow[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  return (
    <>
      {rows.map((row) => {
        const isExpanded = expandedId === row.id;
        const hasTrend = row.trendData && row.trendData.length > 1;
        return (
          <>
            <tr
              key={row.id}
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
            >
              <Td>
                <button
                  onClick={() => hasTrend ? setExpandedId(isExpanded ? null : row.id) : undefined}
                  disabled={!hasTrend}
                  title={hasTrend ? (isExpanded ? "Hide trend chart" : "Show trend chart") : "Not enough data points for trend"}
                  className="flex items-center justify-center w-5 h-5 rounded transition-colors"
                  style={{
                    background: isExpanded ? "rgba(237,19,95,0.18)" : hasTrend ? "rgba(255,255,255,0.06)" : "transparent",
                    color: isExpanded ? "#ED135F" : hasTrend ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
                    cursor: hasTrend ? "pointer" : "default",
                  }}
                >
                  {isExpanded ? <ChevronDown size={11} /> : <LineChart size={11} />}
                </button>
              </Td>
              <Td>
                <div className="font-semibold" style={{ color: "#FAFAFA" }}>{row.creativeName}</div>
                <div style={{ color: "rgba(255,255,255,0.34)" }}>{row.campaignName} · {row.adFormat}</div>
              </Td>
              <Td><StatusBadge row={row} /></Td>
              <Td>
                {row.optimizationGoal ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                    {row.optimizationGoal.replace(/_/g, " ").toLowerCase().replace(/w/g, (c) => c.toUpperCase())}
                  </span>
                ) : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
              </Td>
              <Td>{row.fatigueScore.toFixed(1)}</Td>
              <Td><FirstDetectedCell row={row} /></Td>
              <Td>{money(row.totalSpend)}</Td>
              <Td>{row.totalImpressions.toLocaleString()}</Td>
              <Td>{pct(row.cdrPct)}</Td>
              <Td>{pct(row.relCdr)}</Td>
              <Td>{row.evidence?.avgFrequency?.toFixed(2) ?? "-"}</Td>
              <Td>{row.daysActive}</Td>
            </tr>
            {isExpanded && hasTrend && (
              <tr key={`trend-${row.id}`} style={{ borderTop: "none" }}>
                <td colSpan={12} style={{ background: "rgba(0,0,0,0.25)", padding: "0 16px 12px 16px" }}>
                  <FatigueTrendChart data={row.trendData!} adName={row.creativeName} />
                </td>
              </tr>
            )}
          </>
        );
      })}
    </>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h2 className="text-xs font-bold" style={{ color: "#FAFAFA" }}>{title}</h2>
      {description && <p className="text-[11px] mt-0.5 mb-3" style={{ color: "rgba(255,255,255,0.42)" }}>{description}</p>}
      {children}
    </div>
  );
}

function SchedField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</span>
      {children}
    </label>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span style={{ color: "#FAFAFA" }}>{value}</span>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? "#ED135F" : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="inline-block h-3 w-3 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(17px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function NotifyToggle({ label, value, onChange, color }: { label: string; value: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onChange(!value)}>
      {value ? <Bell size={12} style={{ color }} /> : <BellOff size={12} style={{ color: "rgba(255,255,255,0.3)" }} />}
      <span className="text-xs" style={{ color: value ? color : "rgba(255,255,255,0.45)" }}>{label}</span>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{children}</div>;
}

function FirstDetectedCell({ row }: { row: ResultRow }) {
  const fd = row.firstDetectedAt;
  if (!fd) return <span style={{ color: "rgba(255,255,255,0.3)" }}>-</span>;
  const level = row.fatigueStatus === "URGENT" ? "probable" : row.fatigueStatus === "REFRESH" ? "possible" : row.fatigueStatus === "MONITOR" ? "emerging" : null;
  if (!level) return <span style={{ color: "rgba(255,255,255,0.3)" }}>-</span>;
  const dateStr = fd[level];
  if (!dateStr) return <span style={{ color: "rgba(255,255,255,0.3)" }}>-</span>;
  const color = level === "probable" ? "#C0001A" : level === "possible" ? "#ED135F" : "#F7901E";
  return (
    <span className="text-[10px]" style={{ color }}>
      {new Date(dateStr).toLocaleDateString()}
    </span>
  );
}

function StatusBadge({ row }: { row: ResultRow }) {
  const urgent = ["URGENT", "REFRESH"].includes(row.fatigueStatus);
  const monitor = row.fatigueStatus === "MONITOR";
  const improving = row.fatigueStatus === "IMPROVING";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold text-[10px]"
      style={{
        background: urgent ? "rgba(237,19,95,0.18)" : monitor ? "rgba(247,144,30,0.18)" : improving ? "rgba(0,179,122,0.16)" : "rgba(255,255,255,0.07)",
        color: urgent ? "#ED135F" : monitor ? "#F7901E" : improving ? "#00B37A" : "rgba(255,255,255,0.68)",
      }}
    >
      {urgent ? <AlertTriangle size={10} /> : improving ? <CheckCircle2 size={10} /> : <Shield size={10} />}
      {row.compositeAssessment}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-bold px-3 py-2.5 whitespace-nowrap text-[11px]">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-top whitespace-nowrap text-[11px]">{children}</td>;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(10,10,40,0.72)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#FAFAFA",
};
const secondaryButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.1)",
};
