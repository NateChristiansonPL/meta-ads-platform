/**
 * AdminCreativeDecay.tsx
 *
 * Admin-only page for running creative fatigue / decay analysis.
 * Requires ad performance data to already be in the database
 * (populated by the separate "Creative Performance Sync" admin tool).
 *
 * Responsibilities:
 *   - Select ad account + campaign scope for analysis
 *   - Pick analysis date range
 *   - Configure analysis options (live-ads filter, notification thresholds)
 *   - Run manual decay analysis
 *   - Configure automated daily analysis scheduler
 *   - View results table with fatigue scores, first-detected dates, and trend charts
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
  Filter, LineChart, Loader2, RefreshCw, Search, Settings2, Shield, Zap,
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
};

type CampaignStatusFilter = "active" | "active_30d" | "inactive" | "all";

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = new Date();
const prior = subDays(today, 13);
const money = (v: number | null | undefined) =>
  v == null ? "—" : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`);

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

  // Results
  const [analysisRows, setAnalysisRows] = useState<ResultRow[] | null>(null);
  const [resultsFilter, setResultsFilter] = useState<"all" | "live">("all");

  // Scheduler panel
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const { data: schedulerConfig, refetch: refetchScheduler } = trpc.adminCreativeDecay.getAnalysisSchedulerConfig.useQuery();
  const [sched, setSched] = useState({
    analysisEnabled: false,
    analysisUtcHour: 7,
    analysisRollingDays: 14,
    notifyEmerging: false,
    notifyPossible: true,
    notifyProbable: true,
    onlyLiveAds: false,
    accountId: "",
    campaignIds: null as string | null,
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
        accountId: schedulerConfig.accountId ?? "",
        campaignIds: schedulerConfig.campaignIds ?? null,
      });
    }
  }, [schedulerConfig]);

  const saveScheduler = trpc.adminCreativeDecay.saveAnalysisSchedulerConfig.useMutation({
    onSuccess: () => { toast.success("Analysis scheduler config saved."); refetchScheduler(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

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
      toast.success(`Analysis complete: ${data.records.length} creative group${data.records.length === 1 ? "" : "s"} analyzed.`);
    },
    onError: (e: { message: string }) => toast.error(e.message || "Analysis failed."),
  });

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
  const filteredRows = resultsFilter === "live"
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Settings2 size={13} />
            Scheduler
            {schedulerConfig?.analysisEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" />
            )}
          </button>
          <button
            onClick={handleAnalysis}
            disabled={!canAnalyze}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#ED135F", color: "#fff", boxShadow: "0 8px 24px rgba(237,19,95,0.22)" }}
          >
            {analysisMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Run Decay Analysis
          </button>
        </div>
      }
    >
      <div className="h-full overflow-auto p-6 space-y-6">

        {/* ── Analysis Scheduler Panel ─────────────────────────────────────── */}
        {schedulerOpen && (
          <section className="rounded-2xl p-5 space-y-5" style={{ background: "rgba(237,19,95,0.07)", border: "1px solid rgba(237,19,95,0.22)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Automated Analysis Scheduler</h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Run creative decay analysis automatically each day. Requires ad performance data to already be synced.
                </p>
              </div>
              <button onClick={() => setSchedulerOpen(false)} style={{ color: "rgba(255,255,255,0.4)" }}>
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Toggle value={sched.analysisEnabled} onChange={(v) => setSched(s => ({ ...s, analysisEnabled: v }))} />
                <span className="text-xs font-bold" style={{ color: "#FAFAFA" }}>Enable Daily Analysis</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SchedField label="UTC Hour (0–23)">
                  <input
                    type="number" min={0} max={23}
                    value={sched.analysisUtcHour}
                    onChange={e => setSched(s => ({ ...s, analysisUtcHour: +e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </SchedField>
                <SchedField label="Rolling Days">
                  <input
                    type="number" min={1} max={90}
                    value={sched.analysisRollingDays}
                    onChange={e => setSched(s => ({ ...s, analysisRollingDays: +e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </SchedField>
                <SchedField label="Ad Account ID">
                  <input
                    type="text" placeholder="act_123…"
                    value={sched.accountId}
                    onChange={e => setSched(s => ({ ...s, accountId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </SchedField>
                <SchedField label="Campaign IDs (comma-separated, optional)">
                  <input
                    type="text" placeholder="Leave blank for all campaigns"
                    value={sched.campaignIds ?? ""}
                    onChange={e => setSched(s => ({ ...s, campaignIds: e.target.value || null }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </SchedField>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Notify on fatigue signals:</p>
                <div className="flex flex-wrap gap-4">
                  <NotifyToggle label="Emerging" value={sched.notifyEmerging} onChange={v => setSched(s => ({ ...s, notifyEmerging: v }))} color="#F7901E" />
                  <NotifyToggle label="Possible" value={sched.notifyPossible} onChange={v => setSched(s => ({ ...s, notifyPossible: v }))} color="#ED135F" />
                  <NotifyToggle label="Probable" value={sched.notifyProbable} onChange={v => setSched(s => ({ ...s, notifyProbable: v }))} color="#C0001A" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Toggle value={sched.onlyLiveAds} onChange={(v) => setSched(s => ({ ...s, onlyLiveAds: v }))} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Only analyze currently live ads</span>
              </div>

              {schedulerConfig?.lastAnalysisAt && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Last analysis: {new Date(schedulerConfig.lastAnalysisAt).toLocaleString()} — {schedulerConfig.lastAnalysisStatus ?? "unknown"}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => saveScheduler.mutate(sched)}
                disabled={saveScheduler.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                style={{ background: "#ED135F", color: "#fff" }}
              >
                {saveScheduler.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Save Scheduler Config
              </button>
            </div>
          </section>
        )}

        {/* ── Row 1: Account + Date Range + Analysis Options ───────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* BM Token */}
          <Panel title="Business Manager Token" description="Used to load ad accounts and campaigns for scope selection.">
            <select
              value={tokenId ?? ""}
              onChange={(e) => { setTokenId(e.target.value ? Number(e.target.value) : null); setAccountId(""); setCampaignIds([]); }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              <option value="">Select BM token…</option>
              {uniqueTokens.map((t) => (
                <option key={t.id} value={t.id}>{t.label || t.businessManagerName || `BM ${t.businessManagerId}`}</option>
              ))}
            </select>
            {selectedToken && (
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                BM: {selectedToken.businessManagerId}{selectedToken.businessManagerName ? ` · ${selectedToken.businessManagerName}` : ""}
              </p>
            )}
          </Panel>

          {/* Ad Account */}
          <Panel title="Ad Account" description="Select the account whose synced data you want to analyze.">
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
              <input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search ad accounts…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <select
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setCampaignIds([]); }}
              disabled={!tokenId || accountsLoading}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
              style={inputStyle}
            >
              <option value="">{accountsLoading ? "Loading accounts…" : "Select ad account…"}</option>
              {filteredAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
            </select>
          </Panel>

          {/* Analysis Date Range + Options */}
          <Panel title="Analysis Window & Options" description="Date range and filters for the decay analysis run.">
            <div className="space-y-3">
              <div>
                <p className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Zap size={11} /> Analysis date range
                </p>
                <DateRangePicker value={analysisRange} onChange={setAnalysisRange} showYesterday className="w-full" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Toggle value={onlyLiveAds} onChange={setOnlyLiveAds} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Only live ads</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>Notify on signals:</p>
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
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <Panel title="Campaign Scope" description="Optional. Leave empty to analyze all campaigns in the stored data.">
              <div className="mb-3">
                <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>Campaign status filter</p>
                <select
                  value={campaignStatusFilter}
                  onChange={(e) => { setCampaignStatusFilter(e.target.value as CampaignStatusFilter); setCampaignIds([]); }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  {CAMPAIGN_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  placeholder="Search campaigns…"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <button onClick={() => setCampaignIds([])} className="px-3 py-2 rounded-lg text-xs font-bold" style={secondaryButton}>Clear</button>
              </div>
              {!accountId ? (
                <EmptyText>Select an ad account to load campaigns.</EmptyText>
              ) : campaignsLoading ? (
                <EmptyText><Loader2 size={12} className="animate-spin inline mr-2" />Loading campaigns…</EmptyText>
              ) : (
                <div className="max-h-48 overflow-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {filteredCampaigns.map((c) => {
                    const checked = campaignIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                      >
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
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {campaignIds.length} campaign{campaignIds.length > 1 ? "s" : ""} selected
                </p>
              )}
              {campaignIds.length === 0 && accountId && (
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                  No campaign filter selected; analysis will include all matching campaign data in the database.
                </p>
              )}
            </Panel>
          </div>

          <Panel title="Database Flow" description="Where this admin feature reads and writes data.">
            <div className="space-y-3 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              <div>
                <span className="font-bold" style={{ color: "#FAFAFA" }}>Input:</span> reads from <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>ad_performance</code>
              </div>
              <div>
                <span className="font-bold" style={{ color: "#FAFAFA" }}>Output:</span> writes to <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>creative_fatigue_results</code>
              </div>
              <div>
                <span className="font-bold" style={{ color: "#FAFAFA" }}>Signal tracking:</span> <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>first_fatigue_detected</code>
              </div>
              <div className="pt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ad performance data must be synced first using the <strong style={{ color: "rgba(255,255,255,0.55)" }}>Creative Performance Sync</strong> admin tool.
              </div>
            </div>
          </Panel>
        </section>

        {/* ── Results Table ─────────────────────────────────────────────────── */}
        <ResultsTable
          rows={filteredRows}
          loading={analysisMutation.isPending}
          resultsFilter={resultsFilter}
          onFilterChange={setResultsFilter}
        />
      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>{title}</h2>
      {description && <p className="text-xs mt-1 mb-4" style={{ color: "rgba(255,255,255,0.42)" }}>{description}</p>}
      {children}
    </div>
  );
}

function SchedField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? "#ED135F" : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function NotifyToggle({ label, value, onChange, color }: { label: string; value: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => onChange(!value)}>
      {value ? <Bell size={13} style={{ color }} /> : <BellOff size={13} style={{ color: "rgba(255,255,255,0.3)" }} />}
      <span className="text-xs" style={{ color: value ? color : "rgba(255,255,255,0.45)" }}>{label}</span>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{children}</div>;
}

function ResultsTable({
  rows, loading, resultsFilter, onFilterChange,
}: {
  rows: ResultRow[];
  loading: boolean;
  resultsFilter: "all" | "live";
  onFilterChange: (v: "all" | "live") => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Creative Decay Results</h2>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
            Composite fatigue scoring from synced Meta ad performance data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {(["all", "live"] as const).map(f => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: resultsFilter === f ? "rgba(255,255,255,0.12)" : "transparent",
                  color: resultsFilter === f ? "#FAFAFA" : "rgba(255,255,255,0.45)",
                }}
              >
                {f === "all" ? "All" : "Signals Only"}
              </button>
            ))}
          </div>
          {loading
            ? <Loader2 size={16} className="animate-spin" style={{ color: "#ED135F" }} />
            : <RefreshCw size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
          }
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          {loading
            ? "Running analysis…"
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
                          className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                          style={{
                            background: isExpanded ? "rgba(237,19,95,0.18)" : hasTrend ? "rgba(255,255,255,0.06)" : "transparent",
                            color: isExpanded ? "#ED135F" : hasTrend ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
                            cursor: hasTrend ? "pointer" : "default",
                          }}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <LineChart size={12} />}
                        </button>
                      </Td>
                      <Td>
                        <div className="font-semibold" style={{ color: "#FAFAFA" }}>{row.creativeName}</div>
                        <div style={{ color: "rgba(255,255,255,0.34)" }}>{row.campaignName} · {row.adFormat}</div>
                      </Td>
                      <Td><StatusBadge row={row} /></Td>
                      <Td>{row.fatigueScore.toFixed(1)}</Td>
                      <Td><FirstDetectedCell row={row} /></Td>
                      <Td>{money(row.totalSpend)}</Td>
                      <Td>{row.totalImpressions.toLocaleString()}</Td>
                      <Td>{pct(row.cdrPct)}</Td>
                      <Td>{pct(row.relCdr)}</Td>
                      <Td>{row.evidence?.avgFrequency?.toFixed(2) ?? "—"}</Td>
                      <Td>{row.daysActive}</Td>
                    </tr>
                    {isExpanded && hasTrend && (
                      <tr key={`trend-${row.id}`} style={{ borderTop: "none" }}>
                        <td colSpan={11} style={{ background: "rgba(0,0,0,0.25)", padding: "0 16px 12px 16px" }}>
                          <FatigueTrendChart data={row.trendData!} adName={row.creativeName} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FirstDetectedCell({ row }: { row: ResultRow }) {
  const fd = row.firstDetectedAt;
  if (!fd) return <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>;
  const level = row.fatigueStatus === "URGENT" ? "probable" : row.fatigueStatus === "REFRESH" ? "possible" : row.fatigueStatus === "MONITOR" ? "emerging" : null;
  if (!level) return <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>;
  const dateStr = fd[level];
  if (!dateStr) return <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>;
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
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-bold"
      style={{
        background: urgent ? "rgba(237,19,95,0.18)" : monitor ? "rgba(247,144,30,0.18)" : improving ? "rgba(0,179,122,0.16)" : "rgba(255,255,255,0.07)",
        color: urgent ? "#ED135F" : monitor ? "#F7901E" : improving ? "#00B37A" : "rgba(255,255,255,0.68)",
      }}
    >
      {urgent ? <AlertTriangle size={12} /> : improving ? <CheckCircle2 size={12} /> : <Shield size={12} />}
      {row.compositeAssessment}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-bold px-4 py-3 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top whitespace-nowrap">{children}</td>;
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
