import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search, Shield, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
};

const today = new Date();
const prior = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
const fmt = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: number | null | undefined) => value == null ? "—" : `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(1)}%`;

export default function AdminCreativeDecay() {
  const utils = trpc.useUtils();
  const { data: tokens = [] } = trpc.tokens.listAll.useQuery();
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [syncDateFrom, setSyncDateFrom] = useState(fmt(prior));
  const [syncDateTo, setSyncDateTo] = useState(fmt(today));
  const [analysisDateFrom, setAnalysisDateFrom] = useState(fmt(prior));
  const [analysisDateTo, setAnalysisDateTo] = useState(fmt(today));
  const [lastRun, setLastRun] = useState<{ sync?: { rowsUpserted: number; adsProcessed: number; warnings: string[]; durationMs: number }; records?: ResultRow[] } | null>(null);

  const selectedToken = tokens.find((token) => token.id === tokenId);
  const { data: accountData, isLoading: accountsLoading } = trpc.meta.getAdAccountsByTokenId.useQuery(
    { tokenId: tokenId! },
    { enabled: !!tokenId, staleTime: 5 * 60 * 1000 }
  );
  const accounts: Array<{ id: string; name: string }> = accountData?.accounts ?? [];
  const { data: campaignData, isLoading: campaignsLoading } = trpc.meta.getCampaignsByTokenId.useQuery(
    { tokenId: tokenId!, adAccountId: accountId },
    { enabled: !!tokenId && !!accountId, staleTime: 2 * 60 * 1000 }
  );
  const campaigns: Array<{ id: string; name: string; status?: string; objective?: string }> = campaignData?.campaigns ?? [];
  const { data: latest } = trpc.adminCreativeDecay.getLatestResults.useQuery(
    accountId ? { accountId } : undefined,
    { enabled: true, staleTime: 30_000 }
  );
  const runMutation = trpc.adminCreativeDecay.runAnalysis.useMutation({
    onSuccess: (data) => {
      setLastRun(data);
      utils.adminCreativeDecay.getLatestResults.invalidate();
      toast.success(`Creative Decay complete: ${data.records.length} creative group${data.records.length === 1 ? "" : "s"} analyzed.`);
    },
    onError: (error) => toast.error(error.message || "Creative Decay analysis failed."),
  });

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    return accounts.filter((account) => !q || account.name.toLowerCase().includes(q) || account.id.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.toLowerCase();
    return campaigns.filter((campaign) => !q || campaign.name.toLowerCase().includes(q) || campaign.id.toLowerCase().includes(q));
  }, [campaigns, campaignSearch]);

  const results = (lastRun?.records ?? latest?.records ?? []) as ResultRow[];
  const canRun = !!tokenId && !!accountId && syncDateFrom <= syncDateTo && analysisDateFrom <= analysisDateTo && !runMutation.isPending;

  const run = () => {
    if (!tokenId || !accountId) return;
    runMutation.mutate({ tokenId, adAccountId: accountId, campaignIds, syncDateFrom, syncDateTo, analysisDateFrom, analysisDateTo });
  };

  return (
    <AppShell
      title="Admin Creative Decay"
      subtitle="Private admin-only workspace for syncing Meta ad data and testing creative fatigue analysis."
      badge="ADMIN ONLY"
      headerActions={
        <button
          onClick={run}
          disabled={!canRun}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#ED135F", color: "#fff", boxShadow: "0 8px 24px rgba(237,19,95,0.22)" }}
        >
          {runMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Run Creative Decay
        </button>
      }
    >
      <div className="h-full overflow-auto p-6 space-y-6">
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title="Business Manager Token" description="Uses the same token vault used elsewhere in the app.">
            <select
              value={tokenId ?? ""}
              onChange={(event) => { setTokenId(event.target.value ? Number(event.target.value) : null); setAccountId(""); setCampaignIds([]); }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              <option value="">Select BM token…</option>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>{token.label || token.businessManagerName || `BM ${token.businessManagerId}`}</option>
              ))}
            </select>
            {selectedToken && <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>BM: {selectedToken.businessManagerId}{selectedToken.businessManagerName ? ` · ${selectedToken.businessManagerName}` : ""}</p>}
          </Panel>

          <Panel title="Ad Account" description="Loaded from Meta with the selected BM token.">
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
              <input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Search ad accounts…" className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <select
              value={accountId}
              onChange={(event) => { setAccountId(event.target.value); setCampaignIds([]); }}
              disabled={!tokenId || accountsLoading}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
              style={inputStyle}
            >
              <option value="">{accountsLoading ? "Loading accounts…" : "Select ad account…"}</option>
              {filteredAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.id})</option>)}
            </select>
          </Panel>

          <Panel title="Date Ranges" description="Sync and analysis windows can be tested independently.">
            <div className="grid grid-cols-2 gap-3">
              <DateField label="Sync from" value={syncDateFrom} onChange={setSyncDateFrom} />
              <DateField label="Sync to" value={syncDateTo} onChange={setSyncDateTo} />
              <DateField label="Analyze from" value={analysisDateFrom} onChange={setAnalysisDateFrom} />
              <DateField label="Analyze to" value={analysisDateTo} onChange={setAnalysisDateTo} />
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <Panel title="Campaign Scope" description="Optional. Leave empty to pull all active campaigns with spend in the selected period.">
              <div className="flex items-center gap-2 mb-3">
                <input value={campaignSearch} onChange={(event) => setCampaignSearch(event.target.value)} placeholder="Search campaigns…" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                <button onClick={() => setCampaignIds([])} className="px-3 py-2 rounded-lg text-xs font-bold" style={secondaryButton}>Clear</button>
              </div>
              {!accountId ? (
                <EmptyText>Select an ad account to load campaigns.</EmptyText>
              ) : campaignsLoading ? (
                <EmptyText><Loader2 size={12} className="animate-spin inline mr-2" />Loading campaigns…</EmptyText>
              ) : (
                <div className="max-h-56 overflow-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {filteredCampaigns.map((campaign) => {
                    const checked = campaignIds.includes(campaign.id);
                    return (
                      <label key={campaign.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.74)" }}>
                        <input type="checkbox" checked={checked} onChange={() => setCampaignIds((ids) => checked ? ids.filter((id) => id !== campaign.id) : [...ids, campaign.id])} />
                        <span className="text-xs flex-1 truncate">{campaign.name}</span>
                        <span className="text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>{campaign.status ?? ""}</span>
                      </label>
                    );
                  })}
                  {filteredCampaigns.length === 0 && <EmptyText>No campaigns match.</EmptyText>}
                </div>
              )}
              <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.42)" }}>{campaignIds.length ? `${campaignIds.length} campaign${campaignIds.length === 1 ? "" : "s"} selected.` : "No campaign filter selected; analysis will include all matching campaign data pulled from Meta."}</p>
            </Panel>
          </div>

          <Panel title="Database Flow" description="Where this admin feature stores data.">
            <div className="space-y-3 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              <p><strong style={{ color: "#FAFAFA" }}>Raw daily ad metrics</strong> are upserted into <code>ad_performance</code>.</p>
              <p><strong style={{ color: "#FAFAFA" }}>Creative metadata</strong> is upserted into <code>ad_source_details</code>.</p>
              <p><strong style={{ color: "#FAFAFA" }}>Run status</strong> is recorded in <code>meta_sync_history</code>.</p>
              <p><strong style={{ color: "#FAFAFA" }}>Fatigue outputs</strong> are stored in <code>creative_fatigue_results</code>.</p>
            </div>
          </Panel>
        </section>

        {lastRun?.sync && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Metric label="Rows upserted" value={lastRun.sync.rowsUpserted.toLocaleString()} />
            <Metric label="Ads processed" value={lastRun.sync.adsProcessed.toLocaleString()} />
            <Metric label="Duration" value={`${Math.round(lastRun.sync.durationMs / 1000)}s`} />
            <Metric label="Warnings" value={lastRun.sync.warnings.length.toString()} warn={lastRun.sync.warnings.length > 0} />
          </div>
        )}

        <ResultsTable rows={results} loading={runMutation.isPending} />
      </div>
    </AppShell>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}><h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>{title}</h2>{description && <p className="text-xs mt-1 mb-4" style={{ color: "rgba(255,255,255,0.42)" }}>{description}</p>}{children}</div>;
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</span><input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></label>; }
function EmptyText({ children }: { children: React.ReactNode }) { return <div className="px-3 py-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{children}</div>; }
function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) { return <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}><p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p><p className="text-xl font-bold mt-1" style={{ color: warn ? "#F7901E" : "#FAFAFA" }}>{value}</p></div>; }

function ResultsTable({ rows, loading }: { rows: ResultRow[]; loading: boolean }) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div><h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Creative Decay Results</h2><p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>Composite fatigue scoring from synced Meta ad performance data.</p></div>
        {loading ? <Loader2 size={16} className="animate-spin" style={{ color: "#ED135F" }} /> : <RefreshCw size={16} style={{ color: "rgba(255,255,255,0.35)" }} />}
      </div>
      {rows.length === 0 ? <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>No Creative Decay results yet. Select a token, account, campaign scope, and date range, then run the analysis.</div> : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.45)" }}><Th>Creative</Th><Th>Assessment</Th><Th>Score</Th><Th>Spend</Th><Th>Impressions</Th><Th>CTR Drop</Th><Th>CPE Change</Th><Th>Frequency</Th><Th>Days</Th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}><Td><div className="font-semibold" style={{ color: "#FAFAFA" }}>{row.creativeName}</div><div style={{ color: "rgba(255,255,255,0.34)" }}>{row.campaignName} · {row.adFormat}</div></Td><Td><Status row={row} /></Td><Td>{row.fatigueScore.toFixed(1)}</Td><Td>{money(row.totalSpend)}</Td><Td>{row.totalImpressions.toLocaleString()}</Td><Td>{pct(row.cdrPct)}</Td><Td>{pct(row.relCdr)}</Td><Td>{row.evidence?.avgFrequency?.toFixed(2) ?? "—"}</Td><Td>{row.daysActive}</Td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Status({ row }: { row: ResultRow }) { const urgent = ["URGENT", "REFRESH"].includes(row.fatigueStatus); const improving = row.fatigueStatus === "IMPROVING"; return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-bold" style={{ background: urgent ? "rgba(237,19,95,0.18)" : improving ? "rgba(0,179,122,0.16)" : "rgba(255,255,255,0.07)", color: urgent ? "#ED135F" : improving ? "#00B37A" : "rgba(255,255,255,0.68)" }}>{urgent ? <AlertTriangle size={12} /> : improving ? <CheckCircle2 size={12} /> : <Shield size={12} />}{row.compositeAssessment}</span>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="text-left font-bold px-4 py-3 whitespace-nowrap">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3 align-top whitespace-nowrap">{children}</td>; }

const inputStyle: React.CSSProperties = { background: "rgba(10,10,40,0.72)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFAFA" };
const secondaryButton: React.CSSProperties = { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" };
