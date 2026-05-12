/**
 * AdminCreativePerformanceSync
 *
 * Admin-only tool for syncing Meta ad performance data into the database.
 * Handles: BM token selection, ad account selection, campaign scope,
 * date range, manual sync trigger, sync history, and automated sync scheduler.
 *
 * No creative decay / fatigue analysis logic lives here.
 */

import { trpc } from "@/lib/trpc";
import {
  BarChart2,
  Bell,
  BellOff,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Upload,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  DateRangePicker,
  dateRangeToStrings,
  stringsToDateRange,
} from "@/components/ui/DateRangePicker";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { format, subDays } from "date-fns";
import AppShell from "@/components/AppShell";

// ── Types ─────────────────────────────────────────────────────────────────────

type CampaignStatusFilter = "active" | "active_30d" | "inactive" | "all";

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = new Date();
const prior = subDays(today, 13);

const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatusFilter; label: string }[] = [
  { value: "active", label: "Active campaigns" },
  { value: "active_30d", label: "Active in last 30 days" },
  { value: "inactive", label: "Inactive / Paused" },
  { value: "all", label: "All campaigns" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminCreativePerformanceSync() {
  // BM / Account / Campaign selectors
  const { data: tokens = [] } = trpc.tokens.listAll.useQuery();
  const uniqueTokens = useMemo(() => {
    const seen = new Map<string, (typeof tokens)[0]>();
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
  const [campaignStatusFilter, setCampaignStatusFilter] =
    useState<CampaignStatusFilter>("active");

  // Date range
  const [syncRange, setSyncRange] = useState<DateRange | undefined>(
    stringsToDateRange(format(prior, "yyyy-MM-dd"), format(today, "yyyy-MM-dd")),
  );

  // Sync result
  const [syncResult, setSyncResult] = useState<{
    rowsUpserted: number;
    adsProcessed: number;
    warnings: string[];
    durationMs: number;
  } | null>(null);

  // Scheduler panel
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const { data: schedulerConfig, refetch: refetchScheduler } =
    trpc.adminCreativePerformanceSync.getSchedulerConfig.useQuery();
  const [sched, setSched] = useState({
    syncEnabled: false,
    syncUtcHour: 6,
    syncRollingDays: 14,
    syncPreset: "rolling" as "rolling" | "yesterday",
    campaignStatusFilter: "active" as CampaignStatusFilter,
  });

  useEffect(() => {
    if (schedulerConfig) {
      setSched({
        syncEnabled: schedulerConfig.syncEnabled,
        syncUtcHour: schedulerConfig.syncUtcHour,
        syncRollingDays: schedulerConfig.syncRollingDays,
        syncPreset: (schedulerConfig.syncPreset as "rolling" | "yesterday") ?? "rolling",
        campaignStatusFilter: (schedulerConfig.campaignStatusFilter ??
          "active") as CampaignStatusFilter,
      });
    }
  }, [schedulerConfig]);

  const saveScheduler =
    trpc.adminCreativePerformanceSync.saveSyncSchedulerConfig.useMutation({
      onSuccess: () => {
        toast.success("Scheduler config saved.");
        refetchScheduler();
      },
      onError: (e) => toast.error(e.message),
    });

  // Queries
  const selectedToken = uniqueTokens.find((t) => t.id === tokenId);
  const { data: accountData, isLoading: accountsLoading } =
    trpc.meta.getAdAccountsByTokenId.useQuery(
      { tokenId: tokenId! },
      { enabled: !!tokenId, staleTime: 5 * 60 * 1000 },
    );
  const accounts: Array<{ id: string; name: string }> =
    accountData?.accounts ?? [];

  const { data: campaignData, isLoading: campaignsLoading } =
    trpc.adminMeta.getCampaignsByTokenId.useQuery(
      { tokenId: tokenId!, adAccountId: accountId, statusFilter: campaignStatusFilter },
      { enabled: !!tokenId && !!accountId, staleTime: 2 * 60 * 1000 },
    );
  const campaigns: Array<{ id: string; name: string; status?: string; objective?: string }> =
    campaignData?.campaigns ?? [];

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } =
    trpc.adminCreativePerformanceSync.getHistory.useQuery(
      { limit: 20 },
      { staleTime: 30_000 },
    );

  // Adset goal resolution stats
  const { data: goalStats, refetch: refetchGoalStats } =
    trpc.adminCreativePerformanceSync.getAdsetGoalStats.useQuery(
      accountId ? { accountId } : undefined,
      { enabled: true, staleTime: 60_000 },
    );
  // Mutations
  const syncMutation = trpc.adminCreativePerformanceSync.syncPerformance.useMutation({
    onSuccess: (data) => {
      setSyncResult(data);
      refetchHistory();
      refetchGoalStats();
      toast.success(
        `Sync complete: ${data.rowsUpserted} rows upserted, ${data.adsProcessed} ads processed.`,
      );
    },
    onError: (e) => toast.error(e.message || "Sync failed."),
  });

  // Filtered data
  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    return accounts.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  }, [accounts, accountSearch]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.toLowerCase();
    return campaigns.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [campaigns, campaignSearch]);

  const syncDates = dateRangeToStrings(syncRange);
  const canSync = !!tokenId && !!accountId && !!syncDates && !syncMutation.isPending;

  const handleSync = () => {
    if (!tokenId || !accountId || !syncDates) return;
    syncMutation.mutate({
      tokenId,
      adAccountId: accountId,
      campaignIds,
      campaignStatusFilter,
      dateFrom: syncDates.from,
      dateTo: syncDates.to,
    });
  };

  return (
    <AppShell
      title="Creative Performance Sync"
      subtitle="Admin-only tool for pulling Meta ad performance data into the database."
      badge="ADMIN ONLY"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSchedulerOpen(!schedulerOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Settings2 size={13} />
            Scheduler
            {schedulerConfig?.syncEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" />
            )}
          </button>
          <button
            onClick={handleSync}
            disabled={!canSync}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#1A6CF6",
              color: "#fff",
              boxShadow: "0 8px 24px rgba(26,108,246,0.22)",
            }}
          >
            {syncMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Sync Ad Performance
          </button>
        </div>
      }
    >
      <div className="h-full overflow-auto p-6 space-y-6">
        {/* ── Scheduler Panel ─────────────────────────────────────────────── */}
        {schedulerOpen && (
          <section
            className="rounded-2xl p-5 space-y-5"
            style={{
              background: "rgba(26,108,246,0.07)",
              border: "1px solid rgba(26,108,246,0.22)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
                  Automated Sync Scheduler
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Configure a daily sync run. Runs server-side &mdash; no browser required.
                </p>
              </div>
              <button
                onClick={() => setSchedulerOpen(false)}
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="xl:col-span-3 flex items-center gap-3">
                <Toggle
                  value={sched.syncEnabled}
                  onChange={(v) => setSched((s) => ({ ...s, syncEnabled: v }))}
                />
                <span className="text-xs font-bold" style={{ color: "#FAFAFA" }}>
                  Enable Daily Sync
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Pulls ad performance from Meta into the database automatically
                </span>
              </div>

              <SchedField label="UTC Hour (0–23)">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={sched.syncUtcHour}
                  onChange={(e) =>
                    setSched((s) => ({ ...s, syncUtcHour: +e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </SchedField>

              <SchedField label="Date Preset">
                <select
                  value={sched.syncPreset}
                  onChange={(e) =>
                    setSched((s) => ({
                      ...s,
                      syncPreset: e.target.value as "rolling" | "yesterday",
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="yesterday">Yesterday (single day)</option>
                  <option value="rolling">Rolling window</option>
                </select>
              </SchedField>

              {sched.syncPreset === "rolling" && (
                <SchedField label="Rolling Days">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={sched.syncRollingDays}
                    onChange={(e) =>
                      setSched((s) => ({ ...s, syncRollingDays: +e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </SchedField>
              )}

              <SchedField label="Campaign Status Filter">
                <select
                  value={sched.campaignStatusFilter}
                  onChange={(e) =>
                    setSched((s) => ({
                      ...s,
                      campaignStatusFilter: e.target.value as CampaignStatusFilter,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </SchedField>

              {/* BM token and ad account are inherited from the main page config */}
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{ background: "rgba(26,108,246,0.1)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(26,108,246,0.2)" }}
              >
                BM token and ad account are taken from the current page selection when you save.
                {tokenId && accountId ? (
                  <span className="block mt-1" style={{ color: "#7CB9FF" }}>
                    Will use: {selectedToken?.label || selectedToken?.businessManagerName || `Token #${tokenId}`} / {accountId}
                  </span>
                ) : (
                  <span className="block mt-1" style={{ color: "#F7901E" }}>
                    Select a BM token and ad account above before saving.
                  </span>
                )}
              </div>
            </div>

            {schedulerConfig?.lastRunAt && (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Last sync:{" "}
                {new Date(schedulerConfig.lastRunAt).toLocaleString()} -{" "}
                {schedulerConfig.lastRunStatus ?? "unknown"}
              </p>
            )}

            <div className="flex justify-end">
              <button
                onClick={() =>
                  saveScheduler.mutate({
                    ...sched,
                    vaultTokenId: tokenId,
                    accountId: accountId,
                    campaignIds: campaignIds.length ? campaignIds.join(",") : null,
                  })
                }
                disabled={saveScheduler.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                style={{ background: "#1A6CF6", color: "#fff" }}
              >
                {saveScheduler.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Save Scheduler Config
              </button>
            </div>
          </section>
        )}

        {/* ── Row 1: Token / Account / Date Range ─────────────────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel
            title="Business Manager Token"
            description="Uses the same token vault used elsewhere in the app."
          >
            <select
              value={tokenId ?? ""}
              onChange={(e) => {
                setTokenId(e.target.value ? Number(e.target.value) : null);
                setAccountId("");
                setCampaignIds([]);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              <option value="">Select BM token…</option>
              {uniqueTokens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label || t.businessManagerName || `BM ${t.businessManagerId}`}
                </option>
              ))}
            </select>
            {selectedToken && (
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                BM: {selectedToken.businessManagerId}
                {selectedToken.businessManagerName
                  ? ` · ${selectedToken.businessManagerName}`
                  : ""}
              </p>
            )}
          </Panel>

          <Panel
            title="Ad Account"
            description="Loaded from Meta with the selected BM token."
          >
            <div className="relative mb-2">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "rgba(255,255,255,0.35)" }}
              />
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
              onChange={(e) => {
                setAccountId(e.target.value);
                setCampaignIds([]);
              }}
              disabled={!tokenId || accountsLoading}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
              style={inputStyle}
            >
              <option value="">
                {accountsLoading ? "Loading accounts…" : "Select ad account…"}
              </option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          </Panel>

          <Panel title="Sync Date Range" description="Select the date window to pull from Meta.">
            <DateRangePicker
              value={syncRange}
              onChange={setSyncRange}
              showYesterday
              className="w-full"
            />
          </Panel>
        </section>

        {/* ── Row 2: Campaign Scope / DB Flow ─────────────────────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel
            title="Campaign Scope"
            description="Optional. Leave empty to pull all campaigns matching the status filter."
          >
            <div className="mb-3">
              <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Campaign status filter
              </p>
              <select
                value={campaignStatusFilter}
                onChange={(e) => {
                  setCampaignStatusFilter(e.target.value as CampaignStatusFilter);
                  setCampaignIds([]);
                }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              >
                {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
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
              <button
                onClick={() => setCampaignIds([])}
                className="px-3 py-2 rounded-lg text-xs font-bold"
                style={secondaryButton}
              >
                Clear
              </button>
            </div>
            {!accountId ? (
              <EmptyText>Select an ad account to load campaigns.</EmptyText>
            ) : campaignsLoading ? (
              <EmptyText>
                <Loader2 size={12} className="animate-spin inline mr-2" />
                Loading campaigns…
              </EmptyText>
            ) : (
              <div
                className="max-h-48 overflow-auto rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {filteredCampaigns.map((c) => {
                  const checked = campaignIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.74)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setCampaignIds((ids) =>
                            checked ? ids.filter((id) => id !== c.id) : [...ids, c.id],
                          )
                        }
                      />
                      <span className="text-xs flex-1 truncate">{c.name}</span>
                      <span
                        className="text-[10px] uppercase"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {c.status ?? ""}
                      </span>
                    </label>
                  );
                })}
                {filteredCampaigns.length === 0 && (
                  <EmptyText>No campaigns match.</EmptyText>
                )}
              </div>
            )}
            <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.42)" }}>
              {campaignIds.length
                ? `${campaignIds.length} campaign${campaignIds.length === 1 ? "" : "s"} selected.`
                : "No campaign filter; all campaigns matching the status filter will be included."}
            </p>
          </Panel>

          <Panel
            title="Database Flow"
            description="Where this tool stores the synced data."
          >
            <div
              className="space-y-3 text-xs leading-relaxed"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              <p>
                <strong style={{ color: "#FAFAFA" }}>Raw daily ad metrics</strong> are
                upserted into <code>ad_performance</code>.
              </p>
              <p>
                <strong style={{ color: "#FAFAFA" }}>Creative metadata</strong> is
                upserted into <code>ad_source_details</code>.
              </p>
              <p>
                <strong style={{ color: "#FAFAFA" }}>Run status</strong> is recorded in{" "}
                <code>meta_sync_history</code>.
              </p>
              <p>
                <strong style={{ color: "#FAFAFA" }}>Sync scheduler config</strong> is
                stored in <code>meta_sync_schedule</code>.
              </p>
              <p className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                The Creative Decay admin tool reads from <code>ad_performance</code> to run
                fatigue analysis. Sync this data first before running decay analysis.
              </p>
            </div>
          </Panel>
        </section>

        {/* ── Sync result metrics ──────────────────────────────────────────── */}
        {syncResult && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Metric
              label="Rows upserted"
              value={syncResult.rowsUpserted.toLocaleString()}
            />
            <Metric
              label="Ads processed"
              value={syncResult.adsProcessed.toLocaleString()}
            />
            <Metric
              label="Duration"
              value={`${Math.round(syncResult.durationMs / 1000)}s`}
            />
            <Metric
              label="Warnings"
              value={syncResult.warnings.length.toString()}
              warn={syncResult.warnings.length > 0}
            />
          </div>
        )}

        {/* ── Adset Goal Resolution Stats */}
        {goalStats && goalStats.total > 0 && (
          <section
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <BarChart2 size={14} style={{ color: "#1A6CF6" }} />
                <div>
                  <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Adset Goal Resolution</h2>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                    How optimization goals and conversion events were resolved for this account.
                  </p>
                </div>
              </div>
              <button onClick={() => refetchGoalStats()}>
                <RefreshCw size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <GoalStatCard label="Total Ad Sets" value={goalStats.total} color="#1A6CF6" />
                <GoalStatCard
                  label="Custom Conv. Resolved"
                  value={goalStats.customConvResolved}
                  color="#00B37A"
                  subtitle={goalStats.total > 0 ? String(Math.round((goalStats.customConvResolved / goalStats.total) * 100)) + "%" : undefined}
                />
                <GoalStatCard
                  label="Standard Event"
                  value={goalStats.standardEvent}
                  color="#F7901E"
                  subtitle={goalStats.total > 0 ? String(Math.round((goalStats.standardEvent / goalStats.total) * 100)) + "%" : undefined}
                />
                <GoalStatCard
                  label="No Goal Detected"
                  value={goalStats.noGoal}
                  color={goalStats.noGoal > 0 ? "#ED135F" : "rgba(255,255,255,0.35)"}
                  subtitle={goalStats.noGoal > 0 ? "needs attention" : "all resolved"}
                />
              </div>
              {goalStats.byGoal.length > 0 && (
                <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>By Optimization Goal</p>
                  <div className="flex flex-wrap gap-2">
                    {goalStats.byGoal.map((g) => (
                      <span key={g.goal} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ color: "#FAFAFA" }}>{g.count}</span>
                        {g.goal.replace(/_/g, " ").toLowerCase().replace(/w/g, (c: string) => c.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {goalStats.stalestFetchedAt && (
                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>Stalest Record</p>
                      <p className="text-xs mt-0.5" style={{ color: goalStats.stalestFetchedAt && (Date.now() - new Date(goalStats.stalestFetchedAt).getTime()) > 3 * 24 * 60 * 60 * 1000 ? "#F7901E" : "rgba(255,255,255,0.55)" }}>
                        {new Date(goalStats.stalestFetchedAt).toLocaleString()}
                        {(Date.now() - new Date(goalStats.stalestFetchedAt).getTime()) > 3 * 24 * 60 * 60 * 1000 && (
                          <span className="ml-2 text-[10px] font-bold" style={{ color: "#F7901E" }}>stale &gt;3d</span>
                        )}
                      </p>
                    </div>
                    {goalStats.freshestFetchedAt && (
                      <div>
                        <p className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>Most Recent</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {new Date(goalStats.freshestFetchedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
                {/* ── Sync History ─────────────────────────────────────────────────── */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
                Sync History
              </h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
                Most recent sync runs for this account.
              </p>
            </div>
            {historyLoading ? (
              <Loader2 size={16} className="animate-spin" style={{ color: "#1A6CF6" }} />
            ) : (
              <button onClick={() => refetchHistory()}>
                <RefreshCw size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
              </button>
            )}
          </div>
          {!historyData?.history?.length ? (
            <div
              className="p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              No sync history yet. Run a sync to see results here.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    style={{
                      background: "rgba(255,255,255,0.035)",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <Th>Date</Th>
                    <Th>Mode</Th>
                    <Th>Account</Th>
                    <Th>Date Range</Th>
                    <Th>Rows</Th>
                    <Th>Ads</Th>
                    <Th>Duration</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.history.map((h) => (
                    <tr
                      key={h.id}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.72)",
                      }}
                    >
                      <Td>{new Date(h.createdAt).toLocaleString()}</Td>
                      <Td>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{
                            background:
                              h.mode === "scheduled"
                                ? "rgba(26,108,246,0.18)"
                                : "rgba(255,255,255,0.08)",
                            color:
                              h.mode === "scheduled"
                                ? "#1A6CF6"
                                : "rgba(255,255,255,0.6)",
                          }}
                        >
                          {h.mode}
                        </span>
                      </Td>
                      <Td>{h.accountId}</Td>
                      <Td>
                        {h.dateFrom} → {h.dateTo}
                      </Td>
                      <Td>{h.rowsUpserted?.toLocaleString() ?? "-"}</Td>
                      <Td>{h.adsProcessed?.toLocaleString() ?? "-"}</Td>
                      <Td>
                        {h.durationMs != null
                          ? `${Math.round(h.durationMs / 1000)}s`
                          : "-"}
                      </Td>
                      <Td>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{
                            background:
                              h.status === "success"
                                ? "rgba(0,179,122,0.16)"
                                : h.status === "partial"
                                  ? "rgba(247,144,30,0.18)"
                                  : "rgba(237,19,95,0.18)",
                            color:
                              h.status === "success"
                                ? "#00B37A"
                                : h.status === "partial"
                                  ? "#F7901E"
                                  : "#ED135F",
                          }}
                        >
                          {h.status}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
        {title}
      </h2>
      {description && (
        <p className="text-xs mt-1 mb-4" style={{ color: "rgba(255,255,255,0.42)" }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

function SchedField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.42)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? "#1A6CF6" : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p
        className="text-xl font-bold mt-1"
        style={{ color: warn ? "#F7901E" : "#FAFAFA" }}
      >
        {value}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-bold px-4 py-3 whitespace-nowrap">{children}</th>
  );
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

function GoalStatCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: number;
  color: string;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p className="text-xl font-bold mt-1" style={{ color }}>
        {value.toLocaleString()}
      </p>
      {subtitle && (
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
