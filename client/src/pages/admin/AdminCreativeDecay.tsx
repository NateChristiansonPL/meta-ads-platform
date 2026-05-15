/**
 * AdminCreativeDecay — redesigned
 * Four sections:
 *   1. Manual Analysis — run + optional save
 *   2. Automated Schedule — per-account, per-user
 *   3. Reports Library — all saved reports (manual + auto) across accounts
 *   4. Notifications — fatigue alerts across accounts
 */
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, Bell, BookOpen, Calendar, CheckCircle2,
  ChevronDown, ChevronRight, ChevronUp, Clock, Download,
  ExternalLink, Loader2, Play, RefreshCw, Save, Settings2,
  Slack, X, Zap,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  DateRangePicker, dateRangeToStrings, stringsToDateRange,
} from "@/components/ui/DateRangePicker";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { format, subDays } from "date-fns";
import AppShell from "@/components/AppShell";

type Tab = "analysis" | "schedule" | "reports" | "notifications";

const today = new Date();
const prior = subDays(today, 13);

export default function AdminCreativeDecay() {
  const [tab, setTab] = useState<Tab>("analysis");

  return (
    <AppShell
      title="Creative Decay Analysis"
      subtitle="Detect goal-aware creative fatigue on-demand or on an automated schedule to detect creative fatigue right as it's beginning with slack notification functionality."
      badge="EARLY DETECTION"
      headerActions={<TabBar tab={tab} setTab={setTab} />}
    >
      <div className="h-full overflow-auto">
        {tab === "analysis" && <AnalysisTab />}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "notifications" && <NotificationsTab />}
      </div>
    </AppShell>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "analysis", label: "Analysis", icon: <Zap size={13} /> },
    { id: "schedule", label: "Schedules", icon: <Calendar size={13} /> },
    { id: "reports", label: "Reports Library", icon: <BookOpen size={13} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={13} /> },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.07)" }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{
            background: tab === t.id ? "#1A6CF6" : "transparent",
            color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
          }}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

// ── Analysis Tab ──────────────────────────────────────────────────────────────
function AnalysisTab() {
  const { data: tokens = [] } = trpc.tokens.listAll.useQuery();
  const uniqueTokens = useMemo(() => {
    const seen = new Map<string, (typeof tokens)[0]>();
    for (const t of tokens) if (!seen.has(t.businessManagerId)) seen.set(t.businessManagerId, t);
    return Array.from(seen.values());
  }, [tokens]);

  const [tokenId, setTokenId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "active_30d" | "all">("active");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    stringsToDateRange(format(prior, "yyyy-MM-dd"), format(today, "yyyy-MM-dd")),
  );
  const [onlyLiveAds, setOnlyLiveAds] = useState(false);
  const [notifyEmerging, setNotifyEmerging] = useState(false);
  const [notifyPossible, setNotifyPossible] = useState(true);
  const [notifyProbable, setNotifyProbable] = useState(true);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [analysisRunId, setAnalysisRunId] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: accountData } = trpc.meta.getAdAccountsByTokenId.useQuery({ tokenId: tokenId! }, { enabled: !!tokenId, staleTime: 300_000 });
  const accounts = accountData?.accounts ?? [];
  const selectedAccount = accounts.find((a: { id: string; name: string }) => a.id === accountId);

  const { data: campaignData, isLoading: campaignsLoading } = trpc.adminMeta.getCampaignsByTokenId.useQuery(
    { tokenId: tokenId!, adAccountId: accountId, statusFilter },
    { enabled: !!tokenId && !!accountId, staleTime: 120_000 },
  );
  const campaigns: Array<{ id: string; name: string; status?: string }> = campaignData?.campaigns ?? [];
  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.toLowerCase();
    return campaigns.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [campaigns, campaignSearch]);

  const runMutation = trpc.creativeDecay.runDecayAnalysis.useMutation({
    onSuccess: (data) => {
      setResults(data.records as unknown as ResultRow[]);
      setAnalysisRunId(data.analysisRunId ?? null);
      toast.success(`Analysis complete: ${data.records.length} creatives evaluated.`);
    },
    onError: (e) => toast.error(e.message || "Analysis failed."),
  });

  const saveReportMutation = trpc.creativeDecay.saveDecayReport.useMutation({
    onSuccess: () => { toast.success("Report saved to Reports Library."); setShowSaveDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const dates = dateRangeToStrings(dateRange);
  const canRun = !!accountId && !!dates && !runMutation.isPending;

  // fatigueStatus from server is URGENT | REFRESH | MONITOR | HEALTHY | IMPROVING | BLOCKED
  const signalRows = results?.filter((r) => ["URGENT", "REFRESH", "MONITOR"].includes(r.fatigueStatus)) ?? [];
  const healthyRows = results?.filter((r) => ["HEALTHY", "IMPROVING"].includes(r.fatigueStatus)) ?? [];

  function handleSaveReport() {
    if (!results || !accountId || !dates) return;
    saveReportMutation.mutate({
      accountId,
      accountName: selectedAccount?.name,
      campaignIds: campaignIds.length ? campaignIds.join(",") : undefined,
      dateFrom: dates.from,
      dateTo: dates.to,
      reportType: "manual",
      signalCount: signalRows.length,
      probableCount: results.filter((r) => r.fatigueStatus === "URGENT").length,
      possibleCount: results.filter((r) => r.fatigueStatus === "REFRESH").length,
      emergingCount: results.filter((r) => r.fatigueStatus === "MONITOR").length,
      reportJson: JSON.stringify(results),
      label: saveLabel || undefined,
    });
  }

  const { data: me } = trpc.auth.me.useQuery();
  const [slackBannerDismissed, setSlackBannerDismissed] = useState(() => {
    try { return localStorage.getItem("slackBannerDismissed") === "1"; } catch { return false; }
  });
  const showSlackBanner = !slackBannerDismissed && me && !(me as { slackWebhookUrl?: string | null }).slackWebhookUrl;

  function dismissSlackBanner() {
    setSlackBannerDismissed(true);
    try { localStorage.setItem("slackBannerDismissed", "1"); } catch { /* ignore */ }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Slack onboarding banner */}
      {showSlackBanner && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(255,190,0,0.10)", border: "1px solid rgba(255,190,0,0.25)" }}>
          <Slack size={16} className="mt-0.5 shrink-0" style={{ color: "#FFBE00" }} />
          <div className="flex-1">
            <span style={{ color: "rgba(255,255,255,0.9)" }}>
              <strong style={{ color: "#FFBE00" }}>Set up Slack notifications</strong> — get alerted when creative fatigue signals are detected.{" "}
            </span>
            <Link href="/profile" className="underline" style={{ color: "#FFBE00" }}>Add your Slack webhook URL in your profile →</Link>
          </div>
          <button onClick={dismissSlackBanner} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity" style={{ color: "rgba(255,255,255,0.7)" }}>
            <X size={14} />
          </button>
        </div>
      )}
      {/* Config row */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Business Manager Token">
          <select value={tokenId ?? ""} onChange={(e) => { setTokenId(e.target.value ? Number(e.target.value) : null); setAccountId(""); setCampaignIds([]); }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            <option value="">Select BM token&hellip;</option>
            {uniqueTokens.map((t) => <option key={t.id} value={t.id}>{t.label || t.businessManagerName || `BM ${t.businessManagerId}`}</option>)}
          </select>
        </Panel>
        <Panel title="Ad Account">
          <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCampaignIds([]); }}
            disabled={!tokenId} className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50" style={inputStyle}>
            <option value="">Select ad account&hellip;</option>
            {accounts.map((a: { id: string; name: string }) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
          </select>
        </Panel>
        <Panel title="Analysis Date Range">
          <DateRangePicker value={dateRange} onChange={setDateRange} className="w-full" />
        </Panel>
      </section>

      {/* Campaign Scope */}
      <Panel title="Campaign Scope" description="Optional. Leave empty to include all campaigns.">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "active" | "active_30d" | "all")}
              className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              <option value="active">Active campaigns</option>
              <option value="active_30d">Active in last 30 days</option>
              <option value="all">All campaigns</option>
            </select>
            <input value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} placeholder="Search campaigns\u2026"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <button onClick={() => setCampaignIds([])} className="px-3 py-2 rounded-lg text-xs font-bold" style={secondaryBtn}>Clear</button>
          </div>
          {accountId && (
            <div className="max-h-40 overflow-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {campaignsLoading ? <EmptyTxt><Loader2 size={12} className="animate-spin inline mr-1" />Loading\u2026</EmptyTxt>
                : filteredCampaigns.map((c) => {
                  const checked = campaignIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.74)" }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setCampaignIds((ids) => checked ? ids.filter((id) => id !== c.id) : [...ids, c.id])} />
                      <span className="text-xs flex-1 truncate">{c.name}</span>
                      <span className="text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>{c.status ?? ""}</span>
                    </label>
                  );
                })}
            </div>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>
            {campaignIds.length ? `${campaignIds.length} campaign${campaignIds.length === 1 ? "" : "s"} selected.` : "No filter \u2014 all matching campaigns included."}
          </p>
        </div>
      </Panel>

      {/* Options + Run */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <Toggle value={onlyLiveAds} onChange={setOnlyLiveAds} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Only live ads</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Toggle value={notifyProbable} onChange={setNotifyProbable} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Notify: Probable</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Toggle value={notifyPossible} onChange={setNotifyPossible} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Notify: Possible</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Toggle value={notifyEmerging} onChange={setNotifyEmerging} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Notify: Emerging</span>
        </label>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!accountId || !dates) return;
            runMutation.mutate({ adAccountId: accountId, accountName: selectedAccount?.name, campaignIds, dateFrom: dates.from, dateTo: dates.to, onlyLiveAds, notifyEmerging, notifyPossible, notifyProbable });
          }}
          disabled={!canRun}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#1A6CF6", color: "#fff", boxShadow: "0 8px 24px rgba(26,108,246,0.22)" }}>
          {runMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run Analysis
        </button>
      </div>

      {/* Results */}
      {results && (
        <section className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SummaryPill label="Signals" value={signalRows.length} color="#ED135F" />
              <SummaryPill label="Probable" value={results.filter((r) => r.fatigueStatus === "URGENT").length} color="#ED135F" />
              <SummaryPill label="Possible" value={results.filter((r) => r.fatigueStatus === "REFRESH").length} color="#F7901E" />
              <SummaryPill label="Emerging" value={results.filter((r) => r.fatigueStatus === "MONITOR").length} color="#F7C948" />
              <SummaryPill label="Healthy" value={healthyRows.length} color="#00B37A" />
            </div>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Save size={13} />Save Report
            </button>
          </div>

          {/* Results table */}
          <ResultsTable rows={results} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
        </section>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ background: "#1A1A3E", border: "1px solid rgba(255,255,255,0.12)" }}>
            <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Save Report</h3>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              This will save the current analysis to your Reports Library. You can retrieve it at any time.
            </p>
            <input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} placeholder="Optional label (e.g. May 2026 Review)\u2026"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSaveDialog(false)} className="px-4 py-2 rounded-lg text-xs font-bold" style={secondaryBtn}>Cancel</button>
              <button onClick={handleSaveReport} disabled={saveReportMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                style={{ background: "#1A6CF6", color: "#fff" }}>
                {saveReportMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
function ScheduleTab() {
  const { data: schedulesData, refetch: refetchSchedules } = trpc.creativeDecay.getUserDecaySchedules.useQuery();
  const schedules = schedulesData?.schedules ?? [];

  const { data: tokens = [] } = trpc.tokens.listAll.useQuery();
  const uniqueTokens = useMemo(() => {
    const seen = new Map<string, (typeof tokens)[0]>();
    for (const t of tokens) if (!seen.has(t.businessManagerId)) seen.set(t.businessManagerId, t);
    return Array.from(seen.values());
  }, [tokens]);

  const [tokenId, setTokenId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [sched, setSched] = useState({
    analysisEnabled: false, analysisUtcHour: 7, analysisRollingDays: 14,
    notifyEmerging: false, notifyPossible: true, notifyProbable: true,
    onlyLiveAds: false, alwaysSendReport: false,
    campaignIds: null as string | null,
  });

  const { data: accountData } = trpc.meta.getAdAccountsByTokenId.useQuery({ tokenId: tokenId! }, { enabled: !!tokenId, staleTime: 300_000 });
  const accounts = accountData?.accounts ?? [];

  const { data: existingConfig } = trpc.creativeDecay.getAnalysisSchedulerConfigForAccount.useQuery(
    { accountId },
    { enabled: !!accountId },
  );
  useEffect(() => {
    if (existingConfig) setSched({
      analysisEnabled: existingConfig.analysisEnabled,
      analysisUtcHour: existingConfig.analysisUtcHour,
      analysisRollingDays: existingConfig.analysisRollingDays ?? 14,
      notifyEmerging: existingConfig.notifyEmerging ?? false,
      notifyPossible: existingConfig.notifyPossible ?? true,
      notifyProbable: existingConfig.notifyProbable ?? true,
      onlyLiveAds: existingConfig.onlyLiveAds ?? false,
      alwaysSendReport: existingConfig.alwaysSendReport ?? false,
      campaignIds: existingConfig.campaignIds ?? null,
    });
  }, [existingConfig]);

  const { data: slackData, refetch: refetchSlack } = trpc.creativeDecay.getSlackWebhook.useQuery();
  const [slackUrl, setSlackUrl] = useState("");
  useEffect(() => { if (slackData?.webhookUrl) setSlackUrl(slackData.webhookUrl); }, [slackData]);

  const saveSchedule = trpc.creativeDecay.saveAnalysisSchedulerConfig.useMutation({
    onSuccess: () => { toast.success("Schedule saved."); refetchSchedules(); },
    onError: (e) => toast.error(e.message),
  });
  const saveSlack = trpc.creativeDecay.saveSlackWebhook.useMutation({
    onSuccess: () => { toast.success("Slack webhook saved."); refetchSlack(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-5">
      {/* Existing schedules */}
      {schedules.length > 0 && (
        <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>My Active Schedules</h2>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>Automated decay analyses across all your ad accounts.</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}>
                  <Th>Account</Th><Th>UTC Hour</Th><Th>Rolling Days</Th><Th>Notify</Th><Th>Always Report</Th><Th>Status</Th><Th>Last Run</Th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}>
                    <Td>{s.accountId}</Td>
                    <Td>{s.analysisUtcHour}:00 UTC</Td>
                    <Td>{s.analysisRollingDays ?? 14}d</Td>
                    <Td>
                      {[s.notifyProbable && "Probable", s.notifyPossible && "Possible", s.notifyEmerging && "Emerging"].filter(Boolean).join(", ") || "Off"}
                    </Td>
                    <Td>{s.alwaysSendReport ? "Yes" : "Signals only"}</Td>
                    <Td>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{ background: s.analysisEnabled ? "rgba(0,179,122,0.16)" : "rgba(255,255,255,0.07)", color: s.analysisEnabled ? "#00B37A" : "rgba(255,255,255,0.4)" }}>
                        {s.analysisEnabled ? "Active" : "Paused"}
                      </span>
                    </Td>
                    <Td>{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "Never"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add / Edit schedule */}
      <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <button className="w-full flex items-center justify-between p-4 text-left"
          style={{ borderBottom: configOpen ? "1px solid rgba(255,255,255,0.07)" : "none" }}
          onClick={() => setConfigOpen(!configOpen)}>
          <div className="flex items-center gap-2">
            <Settings2 size={14} style={{ color: "#1A6CF6" }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Add / Edit Schedule</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>Select an account to configure its automated decay schedule.</p>
            </div>
          </div>
          {configOpen ? <ChevronUp size={16} style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.4)" }} />}
        </button>
        {configOpen && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SchedField label="BM Token">
                <select value={tokenId ?? ""} onChange={(e) => { setTokenId(e.target.value ? Number(e.target.value) : null); setAccountId(""); }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                  <option value="">Select BM token\u2026</option>
                  {uniqueTokens.map((t) => <option key={t.id} value={t.id}>{t.label || t.businessManagerName || `BM ${t.businessManagerId}`}</option>)}
                </select>
              </SchedField>
              <SchedField label="Ad Account">
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                  disabled={!tokenId} className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50" style={inputStyle}>
                  <option value="">Select ad account\u2026</option>
                  {accounts.map((a: { id: string; name: string }) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                </select>
              </SchedField>
            </div>
            <div className="flex items-center gap-3">
              <Toggle value={sched.analysisEnabled} onChange={(v) => setSched((s) => ({ ...s, analysisEnabled: v }))} />
              <span className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Enable Daily Analysis</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SchedField label="UTC Hour (0\u201323)">
                <input type="number" min={0} max={23} value={sched.analysisUtcHour}
                  onChange={(e) => setSched((s) => ({ ...s, analysisUtcHour: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </SchedField>
              <SchedField label="Rolling Days">
                <input type="number" min={1} max={90} value={sched.analysisRollingDays}
                  onChange={(e) => setSched((s) => ({ ...s, analysisRollingDays: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </SchedField>
            </div>
            {/* Schedule conflict warning */}
            {(() => {
              const conflicting = schedules.filter(
                (s) => s.accountId !== accountId && s.analysisEnabled && s.analysisUtcHour === sched.analysisUtcHour
              );
              if (conflicting.length === 0) return null;
              const names = conflicting.map((s) => s.accountId).join(", ");
              return (
                <div className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.35)" }}>
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: "#EAB308" }} />
                  <p className="text-xs leading-relaxed" style={{ color: "#FDE68A" }}>
                    UTC hour <strong>{sched.analysisUtcHour}:00</strong> is already used by{" "}
                    <strong>{conflicting.length}</strong> other schedule{conflicting.length > 1 ? "s" : ""} —{" "}
                    {names}. Overlapping schedules may cause resource contention during the cron run.
                  </p>
                </div>
              );
            })()}
            <div className="flex flex-wrap gap-4">
              {([["notifyProbable", "Notify: Probable"], ["notifyPossible", "Notify: Possible"], ["notifyEmerging", "Notify: Emerging"], ["onlyLiveAds", "Only live ads"], ["alwaysSendReport", "Always save report"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Toggle value={sched[key]} onChange={(v) => setSched((s) => ({ ...s, [key]: v }))} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => saveSchedule.mutate({ ...sched, accountId, campaignIds: sched.campaignIds })}
                disabled={!accountId || saveSchedule.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                style={{ background: "#1A6CF6", color: "#fff" }}>
                {saveSchedule.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Save Schedule
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Slack webhook */}
      <Panel title="Slack Notifications" description="Receive fatigue alerts in Slack when signals are detected. One webhook covers all your accounts.">
        <div className="flex items-center gap-2">
          <Slack size={14} style={{ color: "#4A154B" }} />
          <input value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/services/\u2026"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          <button onClick={() => saveSlack.mutate({ webhookUrl: slackUrl })} disabled={saveSlack.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
            style={{ background: "#1A6CF6", color: "#fff" }}>
            {saveSlack.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Save
          </button>
        </div>
        {slackData?.webhookUrl && <p className="text-xs mt-2" style={{ color: "#00B37A" }}>\u2713 Webhook configured</p>}
      </Panel>
    </div>
  );
}

// ── Reports Library Tab ───────────────────────────────────────────────────────
function ReportsTab() {
  const { data, isLoading, refetch } = trpc.creativeDecay.getDecayReports.useQuery({ limit: 100 });
  const reports = data?.reports ?? [];
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const { data: reportDetail } = trpc.creativeDecay.getDecayReportById.useQuery(
    { id: selectedReport! }, { enabled: selectedReport !== null },
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const detailRows: ResultRow[] = useMemo(() => {
    if (!reportDetail?.reportJson) return [];
    try {
      // Normalize old saved reports that used adId/adName field names
      const raw = JSON.parse(reportDetail.reportJson) as Record<string, unknown>[];
      return raw.map((r) => ({
        ...r,
        creativeId: (r.creativeId ?? r.adId ?? "") as string,
        creativeName: (r.creativeName ?? r.adName ?? "") as string,
      })) as ResultRow[];
    } catch { return []; }
  }, [reportDetail]);

  return (
    <div className="p-6 space-y-5">
      <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Reports Library</h2>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>All saved analyses across your ad accounts. Manual saves and automated reports in one place.</p>
          </div>
          {isLoading ? <Loader2 size={16} className="animate-spin" style={{ color: "#1A6CF6" }} />
            : <button onClick={() => refetch()}><RefreshCw size={16} style={{ color: "rgba(255,255,255,0.35)" }} /></button>}
        </div>
        {!reports.length
          ? <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>No reports saved yet. Run an analysis and click Save Report, or enable automated schedules.</div>
          : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}>
                    <Th>Type</Th><Th>Account</Th><Th>Date Range</Th><Th>Signals</Th><Th>Probable</Th><Th>Possible</Th><Th>Emerging</Th><Th>Run Date</Th><Th>Label</Th><Th>View</Th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)", background: selectedReport === r.id ? "rgba(26,108,246,0.07)" : "transparent" }}>
                      <Td><TypePill type={r.reportType} /></Td>
                      <Td><span className="font-mono text-[10px]">{r.accountName || r.accountId}</span></Td>
                      <Td>{r.dateFrom} \u2192 {r.dateTo}</Td>
                      <Td><span style={{ color: r.signalCount > 0 ? "#ED135F" : "rgba(255,255,255,0.4)" }}>{r.signalCount}</span></Td>
                      <Td>{r.probableCount}</Td>
                      <Td>{r.possibleCount}</Td>
                      <Td>{r.emergingCount}</Td>
                      <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                      <Td><span style={{ color: "rgba(255,255,255,0.45)" }}>{r.label || "\u2014"}</span></Td>
                      <Td>
                        <button onClick={() => setSelectedReport(selectedReport === r.id ? null : r.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{ background: "rgba(26,108,246,0.15)", color: "#1A6CF6" }}>
                          {selectedReport === r.id ? <ChevronUp size={11} /> : <ChevronRight size={11} />}
                          View
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {/* Inline report viewer */}
      {selectedReport !== null && detailRows.length > 0 && (
        <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
              Report Detail \u2014 {reportDetail?.accountName || reportDetail?.accountId}
              <span className="ml-2 text-xs font-normal" style={{ color: "rgba(255,255,255,0.42)" }}>
                {reportDetail?.dateFrom} \u2192 {reportDetail?.dateTo}
              </span>
            </h2>
          </div>
          <div className="p-4">
            <ResultsTable rows={detailRows} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
          </div>
        </section>
      )}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab() {
  const { data, isLoading, refetch } = trpc.creativeDecay.getDecayNotifications.useQuery({ limit: 100 });
  const notifications = data?.notifications ?? [];

  return (
    <div className="p-6 space-y-5">
      <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Fatigue Notifications</h2>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>In-app and Slack alerts triggered by automated decay analyses across all your accounts.</p>
          </div>
          {isLoading ? <Loader2 size={16} className="animate-spin" style={{ color: "#1A6CF6" }} />
            : <button onClick={() => refetch()}><RefreshCw size={16} style={{ color: "rgba(255,255,255,0.35)" }} /></button>}
        </div>
        {!notifications.length
          ? <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>No notifications yet. Enable automated schedules with notify thresholds to receive alerts.</div>
          : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}>
                    <Th>Date</Th><Th>Account</Th><Th>Creative</Th><Th>Campaign</Th><Th>Ad Set</Th><Th>Level</Th><Th>Score</Th><Th>Channels</Th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}>
                      <Td>{new Date(n.notifiedAt).toLocaleString()}</Td>
                      <Td><span className="font-mono text-[10px]">{n.accountId}</span></Td>
                      <Td className="max-w-xs truncate">{n.adName}</Td>
                      <Td className="max-w-xs truncate">{n.campaignName ?? "\u2014"}</Td>
                      <Td className="max-w-xs truncate">{n.adsetName ?? "\u2014"}</Td>
                      <Td><FatiguePill level={n.signalLevel} /></Td>
                      <Td>{n.fatigueScore != null ? n.fatigueScore.toFixed(2) : "\u2014"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          {n.notifiedViaApp && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(26,108,246,0.18)", color: "#1A6CF6" }}>App</span>}
                          {n.notifiedViaSlack && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(74,21,75,0.3)", color: "#C97BC9" }}>Slack</span>}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}

// ── Results Table (shared) ────────────────────────────────────────────────────
type ResultRow = {
  // Server returns creativeId/creativeName (not adId/adName)
  creativeId: string; creativeName: string;
  campaignName?: string; adsetName?: string | null; imageUrl?: string | null;
  // fatigueStatus is the DB enum: URGENT | REFRESH | MONITOR | HEALTHY | IMPROVING | BLOCKED
  fatigueStatus: string; fatigueScore: number;
  compositeAssessment?: string;
  cdrPct?: number | null; ewmaDrop?: number; frequency?: number; impressions?: number;
  spend?: number; optimizationGoal?: string | null; convEventLabel?: string | null;
  ctrDrop?: number; reliability?: string; totalEvents?: number;
  // firstDetectedAt is an object with level keys, not a flat string
  firstDetectedAt?: { emerging?: string | null; possible?: string | null; probable?: string | null } | null;
  trendData?: { date: string; ctr: number; cpm: number }[];
};

function ResultsTable({ rows, expandedRow, setExpandedRow }: {
  rows: ResultRow[]; expandedRow: string | null; setExpandedRow: (id: string | null) => void;
}) {
  // Sort by fatigue severity: URGENT > REFRESH > MONITOR > others
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const order: Record<string, number> = { URGENT: 0, REFRESH: 1, MONITOR: 2, IMPROVING: 3, HEALTHY: 4, BLOCKED: 5 };
    return (order[a.fatigueStatus] ?? 6) - (order[b.fatigueStatus] ?? 6);
  }), [rows]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}>
              <Th></Th><Th>Creative</Th><Th>Campaign</Th><Th>Ad Set</Th><Th>Status</Th><Th>Score</Th><Th>Opt. Metric</Th><Th>Spend</Th><Th>Freq</Th><Th>Impressions</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isExpanded = expandedRow === r.creativeId;
              // Build escalation timeline from firstDetectedAt
              const fda = r.firstDetectedAt ?? {};
              const LEVELS: Array<"emerging" | "possible" | "probable"> = ["emerging", "possible", "probable"];
              const timelineSteps = LEVELS.filter((l) => fda[l]).map((l) => ({ level: l, date: new Date(fda[l]!) }));
              const currentLevel = r.fatigueStatus === "URGENT" ? "probable" : r.fatigueStatus === "REFRESH" ? "possible" : r.fatigueStatus === "MONITOR" ? "emerging" : null;
              const nextLvl = currentLevel === "emerging" ? "possible" : currentLevel === "possible" ? "probable" : null;
              // Projection: only if next level not yet detected
              let projectedDate: Date | null = null;
              let projectedLabel: string | null = null;
              let projectedFromPeers = false;
              if (nextLvl && !fda[nextLvl] && timelineSteps.length >= 1) {
                let velocityDays: number | null = null;
                if (timelineSteps.length >= 2) {
                  const gaps: number[] = [];
                  for (let i = 1; i < timelineSteps.length; i++) {
                    const g = Math.round((timelineSteps[i].date.getTime() - timelineSteps[i-1].date.getTime()) / 86400000);
                    if (g > 0) gaps.push(g);
                  }
                  if (gaps.length) velocityDays = gaps[gaps.length - 1];
                }
                if (velocityDays === null) { velocityDays = 7; projectedFromPeers = true; }
                velocityDays = Math.min(velocityDays, 60);
                const anchor = timelineSteps[timelineSteps.length - 1].date;
                projectedDate = new Date(anchor.getTime() + velocityDays * 86400000);
                projectedLabel = nextLvl === "possible" ? "Possible" : "Probable";
              }
              const fmtD = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <>
                  <tr key={r.creativeId}
                    onClick={() => setExpandedRow(isExpanded ? null : r.creativeId)}
                    className="cursor-pointer"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)", background: isExpanded ? "rgba(26,108,246,0.05)" : "transparent" }}>
                    <Td>{isExpanded ? <ChevronUp size={12} /> : <ChevronRight size={12} />}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {r.imageUrl && (
                          <img src={r.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0"
                            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        )}
                        <span className="font-medium" style={{ color: "#FAFAFA" }}>{r.creativeName}</span>
                      </div>
                    </Td>
                    <Td wrap>
                      <div className="max-w-[220px]" style={{ wordBreak: "break-word", lineHeight: 1.4 }}>
                        {r.campaignName ?? "\u2014"}
                      </div>
                    </Td>
                    <Td wrap>
                      <div className="max-w-[220px]" style={{ wordBreak: "break-word", lineHeight: 1.4 }}>
                        {r.adsetName ?? "\u2014"}
                      </div>
                    </Td>
                    <Td><FatiguePill level={r.fatigueStatus} /></Td>
                    <Td><span style={{ color: r.fatigueScore >= 70 ? "#ED135F" : r.fatigueScore >= 50 ? "#F7901E" : r.fatigueScore >= 30 ? "#F7C948" : "#00B37A" }}>{r.fatigueScore.toFixed(1)}</span></Td>
                    <Td><span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>{r.convEventLabel || r.optimizationGoal?.replace(/_/g, " ").toLowerCase() || "\u2014"}</span></Td>
                    <Td>{r.spend != null ? `$${Number(r.spend).toFixed(2)}` : "\u2014"}</Td>
                    <Td>{r.frequency != null ? Number(r.frequency).toFixed(2) : "\u2014"}</Td>
                    <Td>{r.impressions != null ? Number(r.impressions).toLocaleString() : "\u2014"}</Td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.creativeId}-exp`} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td colSpan={10} className="px-6 py-4" style={{ background: "rgba(26,108,246,0.04)" }}>
                        {/* Escalation timeline + projection */}
                        {timelineSteps.length > 0 && (
                          <div className="mb-4">
                            <div className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Escalation Timeline</div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {timelineSteps.map((s, i) => (
                                <span key={s.level} className="flex items-center gap-1">
                                  {i > 0 && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>→</span>}
                                  <span className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{
                                    background: s.level === "probable" ? "rgba(237,19,95,0.15)" : s.level === "possible" ? "rgba(247,144,30,0.15)" : "rgba(247,201,72,0.15)",
                                    color: s.level === "probable" ? "#ED135F" : s.level === "possible" ? "#F7901E" : "#F7C948",
                                    border: `1px solid ${s.level === "probable" ? "rgba(237,19,95,0.3)" : s.level === "possible" ? "rgba(247,144,30,0.3)" : "rgba(247,201,72,0.3)"}`
                                  }}>
                                    {s.level.charAt(0).toUpperCase() + s.level.slice(1)}: {fmtD(s.date)}
                                  </span>
                                </span>
                              ))}
                              {projectedDate && projectedLabel && (
                                <span className="flex items-center gap-1">
                                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>→</span>
                                  <span className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{
                                    background: "rgba(255,255,255,0.06)",
                                    color: "rgba(255,255,255,0.45)",
                                    border: "1px dashed rgba(255,255,255,0.2)"
                                  }}>
                                    ⏱ Est. {projectedLabel}: ~{fmtD(projectedDate)}{projectedFromPeers ? " (est.)" : ""}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Evidence pills */}
                        <div className="flex flex-wrap gap-3">
                          <EvidencePill label="CDR Drop" value={r.cdrPct != null ? `${Number(r.cdrPct).toFixed(1)}%` : "\u2014"} />
                          <EvidencePill label="EWMA Drop" value={r.ewmaDrop != null ? `${(Number(r.ewmaDrop) * 100).toFixed(1)}%` : "\u2014"} />
                          <EvidencePill label="CTR Drop" value={r.ctrDrop != null ? `${(Number(r.ctrDrop) * 100).toFixed(1)}%` : "\u2014"} />
                          <EvidencePill label="Frequency" value={r.frequency != null ? Number(r.frequency).toFixed(2) : "\u2014"} />
                          <EvidencePill label="Total Events" value={r.totalEvents != null ? Number(r.totalEvents).toLocaleString() : "\u2014"} />
                          <EvidencePill label="Reliability" value={r.reliability != null ? `${(Number(r.reliability) * 100).toFixed(0)}%` : "\u2014"} />
                          <EvidencePill label="Scored Metric" value={r.convEventLabel || r.optimizationGoal?.replace(/_/g, " ").toLowerCase() || "\u2014"} highlight />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
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
  return <label className="block"><span className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</span>{children}</label>;
}
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative inline-flex h-5 w-9 items-center rounded-full flex-shrink-0 transition-colors"
      style={{ background: value ? "#1A6CF6" : "rgba(255,255,255,0.15)" }}>
      <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }} />
    </button>
  );
}
function EmptyTxt({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{children}</div>;
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-bold px-4 py-3 whitespace-nowrap">{children}</th>;
}
function Td({ children, className, wrap }: { children: React.ReactNode; className?: string; wrap?: boolean }) {
  return <td className={`px-4 py-3 align-top ${wrap ? "" : "whitespace-nowrap"} ${className ?? ""}`}>{children}</td>;
}
function FatiguePill({ level }: { level: string }) {
  const map: Record<string, { bg: string; col: string; label: string }> = {
    // Server-side enum values
    "URGENT":   { bg: "rgba(237,19,95,0.18)",   col: "#ED135F", label: "Probable Fatigue" },
    "REFRESH":  { bg: "rgba(247,144,30,0.18)",  col: "#F7901E", label: "Possible Fatigue" },
    "MONITOR":  { bg: "rgba(247,201,72,0.18)",  col: "#F7C948", label: "Emerging Fatigue" },
    "HEALTHY":  { bg: "rgba(0,179,122,0.16)",   col: "#00B37A", label: "Healthy" },
    "IMPROVING":{ bg: "rgba(0,179,122,0.12)",   col: "#00B37A", label: "Improving" },
    "BLOCKED":  { bg: "rgba(255,255,255,0.07)", col: "rgba(255,255,255,0.5)", label: "Weak Signal" },
    // Legacy lowercase values (for saved reports)
    "probable fatigue": { bg: "rgba(237,19,95,0.18)",   col: "#ED135F", label: "Probable Fatigue" },
    "possible fatigue": { bg: "rgba(247,144,30,0.18)",  col: "#F7901E", label: "Possible Fatigue" },
    "emerging fatigue": { bg: "rgba(247,201,72,0.18)",  col: "#F7C948", label: "Emerging Fatigue" },
    "healthy":          { bg: "rgba(0,179,122,0.16)",   col: "#00B37A", label: "Healthy" },
  };
  const s = map[level] ?? { bg: "rgba(255,255,255,0.07)", col: "rgba(255,255,255,0.5)", label: level };
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: s.bg, color: s.col }}>{s.label}</span>;
}
function TypePill({ type }: { type: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ background: type === "auto" ? "rgba(26,108,246,0.18)" : "rgba(255,255,255,0.08)", color: type === "auto" ? "#1A6CF6" : "rgba(255,255,255,0.6)" }}>
      {type}
    </span>
  );
}
function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
function EvidencePill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-xl" style={{ background: highlight ? "rgba(26,108,246,0.12)" : "rgba(255,255,255,0.045)", border: `1px solid ${highlight ? "rgba(26,108,246,0.25)" : "rgba(255,255,255,0.08)"}` }}>
      <span className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em" }}>{label}</span>
      <span className="text-xs font-bold" style={{ color: highlight ? "#7CB9FF" : "#FAFAFA" }}>{value}</span>
    </div>
  );
}
const inputStyle: React.CSSProperties = { background: "rgba(10,10,40,0.72)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFAFA" };
const secondaryBtn: React.CSSProperties = { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" };
