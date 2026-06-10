/**
 * QA Verification — Standalone tool page for running Ad QA analysis
 * Layout: Left panel (inputs/selectors) + Right panel (results) — matches Skills layout
 * Features:
 * - Business Manager token selector
 * - Ad Account selector (cascading from BM)
 * - Cascading Campaign → Ad Set → Ads dropdowns
 * - Status filters (Active/Inactive, Last 7 Days — default)
 * - Multi-select at each level
 * - Run QA button triggers the direct QA backend
 * - Right panel: inline results (summary + violations + ad rows) with Download XLSX button
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronUp, Search, ShieldCheck, Loader2, ExternalLink,
  CheckSquare, Square, Filter, RefreshCw, Download, Wrench, CheckCircle2,
  AlertTriangle, Building2, Play, RotateCcw, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import AppShell from '@/components/AppShell';

interface QaViolation {
  adId: string;
  adName: string;
  creativeId: string;
  specKey: string;
  settings: Array<{ name: string; currentValue: string; expectedValue: string }>;
  adsManagerUrl: string;
}

type StatusFilter = 'ACTIVE' | 'PAUSED' | 'ALL';
type AdsFilter = 'ACTIVE' | 'PAUSED' | 'LAST_7_DAYS' | 'ALL';

interface CampaignItem {
  id: string;
  name: string;
  status: string;
  objective: string;
}

interface AdSetItem {
  id: string;
  name: string;
  status: string;
  campaignId: string;
}

interface AdItem {
  id: string;
  name: string;
  status: string;
  createdTime: string;
  adSetId: string;
}

const STORAGE_KEY = 'pl_qa_verification_account';

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      tokenId: number; bmId: string; adAccountId: string; adAccountName: string;
    } | null;
  } catch { return null; }
}

export default function QaVerification() {
  return (
    <AppShell title="QA Verification" subtitle="Advantage+ Creative & ad settings verification">
      <QaVerificationContent />
    </AppShell>
  );
}

function QaVerificationContent() {
  const saved = loadSaved();

  // ── Account Selection State ──
  const { data: activeTokens = [] } = trpc.tokens.listActive.useQuery();
  const [tokenId, setTokenId] = useState<number | null>(saved?.tokenId ?? null);
  const [bmId, setBmId] = useState(saved?.bmId ?? '');
  const [adAccountId, setAdAccountId] = useState(saved?.adAccountId ?? '');
  const [adAccountName, setAdAccountName] = useState(saved?.adAccountName ?? '');
  const [adAccountSearch, setAdAccountSearch] = useState('');
  const adAccountSearchRef = useRef<HTMLDivElement>(null);
  const [adAccountDropdownOpen, setAdAccountDropdownOpen] = useState(false);

  // Resolve access token
  const { data: tokenData } = trpc.meta.getBuilderToken.useQuery(
    { tokenId: tokenId! },
    { enabled: !!tokenId, staleTime: 300_000 }
  );
  const accessToken = tokenData?.accessToken ?? '';

  // Fetch ad accounts
  const { data: adAccountsData, isLoading: loadingAccounts } = trpc.meta.getAdAccountsByTokenId.useQuery(
    { tokenId: tokenId! },
    { enabled: !!tokenId, staleTime: 5 * 60 * 1000 }
  );
  const adAccounts: Array<{ id: string; name: string }> = adAccountsData?.accounts ?? [];

  const handleTokenChange = (id: number | null) => {
    const t = activeTokens.find(x => x.id === id);
    setTokenId(id);
    setBmId(t?.businessManagerId ?? '');
    setAdAccountId('');
    setAdAccountName('');
    setAdAccountSearch('');
    setSelectedCampaignIds(new Set());
    setSelectedAdSetIds(new Set());
    setSelectedAdIds(new Set());
    setQaState({ phase: 'idle' });
  };

  const handleAdAccountChange = (id: string) => {
    const acc = adAccounts.find(a => a.id === id);
    setAdAccountId(id);
    setAdAccountName(acc?.name ?? id);
    setAdAccountSearch('');
    setAdAccountDropdownOpen(false);
    setSelectedCampaignIds(new Set());
    setSelectedAdSetIds(new Set());
    setSelectedAdIds(new Set());
    setQaState({ phase: 'idle' });
    if (id && tokenId && bmId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tokenId, bmId, adAccountId: id, adAccountName: acc?.name ?? id }));
    }
  };

  // Close ad account dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (adAccountSearchRef.current && !adAccountSearchRef.current.contains(e.target as Node)) {
        setAdAccountDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasCredentials = !!(accessToken && adAccountId);

  // ── Campaign/AdSet/Ads State ──
  const [campaignFilter, setCampaignFilter] = useState<StatusFilter>('ACTIVE');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignOpen, setCampaignOpen] = useState(true);

  const [adSetFilter, setAdSetFilter] = useState<StatusFilter>('ALL');
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<Set<string>>(new Set());
  const [adSetSearch, setAdSetSearch] = useState('');
  const [adSetOpen, setAdSetOpen] = useState(false);

  // Default to LAST_7_DAYS when ads are loaded
  const [adsFilter, setAdsFilter] = useState<AdsFilter>('LAST_7_DAYS');
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [adSearch, setAdSearch] = useState('');
  const [adsOpen, setAdsOpen] = useState(false);

  const [qaState, setQaState] = useState<{
    phase: 'idle' | 'launching' | 'done' | 'error';
    errorMessage?: string;
    downloadUrl?: string;
    totalAds?: number;
    totalAdSets?: number;
    violationCount?: number;
    violations?: QaViolation[];
  }>({ phase: 'idle' });

  const [fixedCreativeIds, setFixedCreativeIds] = useState<Set<string>>(new Set());
  const [fixingCreativeIds, setFixingCreativeIds] = useState<Set<string>>(new Set());
  const [fixedMultiAdvIds, setFixedMultiAdvIds] = useState<Set<string>>(new Set());
  const [fixingMultiAdvIds, setFixingMultiAdvIds] = useState<Set<string>>(new Set());

  // ── Data fetching ──
  const { data: campaignData, isLoading: campaignsLoading, refetch: refetchCampaigns } =
    trpc.adminMeta.getCampaigns.useQuery(
      { accessToken, adAccountId },
      { enabled: hasCredentials, staleTime: 2 * 60 * 1000 }
    );

  const campaigns: CampaignItem[] = (campaignData?.campaigns ?? []) as CampaignItem[];

  const selectedCampaignArray = useMemo(() => Array.from(selectedCampaignIds), [selectedCampaignIds]);
  const adSetQueries = trpc.useQueries((t) =>
    selectedCampaignArray.map(cId =>
      t.adminMeta.getAdSets({ accessToken, campaignId: cId }, { enabled: hasCredentials && selectedCampaignIds.size > 0, staleTime: 2 * 60 * 1000 })
    )
  );

  const allAdSets: AdSetItem[] = useMemo(() => {
    const sets: AdSetItem[] = [];
    adSetQueries.forEach((q, idx) => {
      if (q.data?.adSets) {
        for (const as of q.data.adSets) {
          sets.push({ ...as, campaignId: selectedCampaignArray[idx] } as AdSetItem);
        }
      }
    });
    return sets;
  }, [adSetQueries, selectedCampaignArray]);

  const adSetsLoading = adSetQueries.some(q => q.isLoading);

  const selectedAdSetArray = useMemo(() => Array.from(selectedAdSetIds), [selectedAdSetIds]);
  const { data: adsData, isLoading: adsLoading, refetch: refetchAds } =
    trpc.adminMeta.getAds.useQuery(
      { accessToken, adSetIds: selectedAdSetArray },
      { enabled: hasCredentials && selectedAdSetArray.length > 0, staleTime: 2 * 60 * 1000 }
    );

  const allAds: AdItem[] = (adsData?.ads ?? []) as AdItem[];

  // ── Filtering ──
  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    if (campaignFilter !== 'ALL') list = list.filter(c => c.status === campaignFilter);
    if (campaignSearch.trim()) {
      const q = campaignSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q));
    }
    return list;
  }, [campaigns, campaignFilter, campaignSearch]);

  const filteredAdSets = useMemo(() => {
    let list = allAdSets;
    if (adSetFilter !== 'ALL') list = list.filter(a => a.status === adSetFilter);
    if (adSetSearch.trim()) {
      const q = adSetSearch.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q));
    }
    return list;
  }, [allAdSets, adSetFilter, adSetSearch]);

  const filteredAds = useMemo(() => {
    let list = allAds;
    if (adsFilter === 'ACTIVE') {
      list = list.filter(a => a.status === 'ACTIVE');
    } else if (adsFilter === 'PAUSED') {
      list = list.filter(a => a.status === 'PAUSED');
    } else if (adsFilter === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      list = list.filter(a => new Date(a.createdTime) >= sevenDaysAgo);
    }
    if (adSearch.trim()) {
      const q = adSearch.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q));
    }
    return list;
  }, [allAds, adsFilter, adSearch]);

  // ── Auto-open next section when selections change ──
  useEffect(() => {
    if (selectedCampaignIds.size > 0 && !adSetOpen) setAdSetOpen(true);
  }, [selectedCampaignIds.size]);

  useEffect(() => {
    if (selectedAdSetIds.size > 0 && !adsOpen) setAdsOpen(true);
  }, [selectedAdSetIds.size]);

  // ── Clear downstream selections when upstream changes ──
  useEffect(() => {
    setSelectedAdSetIds(prev => {
      const validIds = new Set(allAdSets.map(a => a.id));
      const next = new Set(Array.from(prev).filter(id => validIds.has(id)));
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [allAdSets]);

  useEffect(() => {
    setSelectedAdIds(prev => {
      const validIds = new Set(allAds.map(a => a.id));
      const next = new Set(Array.from(prev).filter(id => validIds.has(id)));
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [allAds]);

  // ── QA Launch ──
  const runQaDirect = trpc.runs.runQaChecklistDirect.useMutation();

  const handleRunQa = async () => {
    if (!hasCredentials) {
      toast.error('Select a Business Manager and Ad Account first.');
      return;
    }
    if (selectedAdIds.size === 0) {
      toast.error('Select at least one ad to run QA on.');
      return;
    }

    const adIds = Array.from(selectedAdIds);
    setQaState({ phase: 'launching' });
    setFixedCreativeIds(new Set());
    setFixingCreativeIds(new Set());
    setFixedMultiAdvIds(new Set());
    setFixingMultiAdvIds(new Set());
    try {
      const result = await runQaDirect.mutateAsync({
        adAccountId,
        tokenId: tokenId ?? undefined,
        facebookPageId: '',
        adIds,
      });
      setQaState({
        phase: 'done',
        downloadUrl: result.downloadUrl,
        totalAds: result.totalAds,
        totalAdSets: result.totalAdSets,
        violationCount: result.violationCount,
        violations: result.violations as QaViolation[] ?? [],
      });
      toast.success(`QA complete — ${result.totalAds} ads, ${result.totalAdSets} ad sets checked`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setQaState({ phase: 'error', errorMessage: msg });
      toast.error(`QA failed: ${msg}`);
    }
  };

  const handleReset = () => {
    setQaState({ phase: 'idle' });
    setFixedCreativeIds(new Set());
    setFixingCreativeIds(new Set());
    setFixedMultiAdvIds(new Set());
    setFixingMultiAdvIds(new Set());
  };

  // ── Fix violation handlers ──
  const MULTI_ADV_NAMES = new Set(['contextual_multi_ads', 'Multi-Advertiser Eligibility']);

  const hasDofSettings = (v: QaViolation) => v.settings.some(s => !MULTI_ADV_NAMES.has(s.name));
  const hasMultiAdvSettings = (v: QaViolation) => v.settings.some(s => MULTI_ADV_NAMES.has(s.name));

  const fixViolation = trpc.runs.fixAdDofViolation.useMutation();
  const fixMultiAdv = trpc.runs.fixMultiAdvertiserViolation.useMutation();

  const handleFixDof = async (violation: QaViolation) => {
    setFixingCreativeIds(prev => { const next = new Set(prev); next.add(violation.creativeId); return next; });
    try {
      await fixViolation.mutateAsync({
        adId: violation.adId,
        creativeId: violation.creativeId,
        specKey: violation.specKey,
        tokenId: tokenId ?? undefined,
      });
      setFixedCreativeIds(prev => { const next = new Set(prev); next.add(violation.creativeId); return next; });
      toast.success(`Creative settings fixed: ${violation.adName}`);
    } catch (err) {
      toast.error(`Fix failed for ${violation.adName}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFixingCreativeIds(prev => { const next = new Set(prev); next.delete(violation.creativeId); return next; });
    }
  };

  const handleFixMultiAdv = async (violation: QaViolation) => {
    setFixingMultiAdvIds(prev => { const next = new Set(prev); next.add(violation.creativeId); return next; });
    try {
      const result = await fixMultiAdv.mutateAsync({
        adId: violation.adId,
        creativeId: violation.creativeId,
        tokenId: tokenId ?? undefined,
      });
      console.log('[fixMultiAdv] Full debug:', JSON.stringify(result?.debug));
      setFixedMultiAdvIds(prev => { const next = new Set(prev); next.add(violation.creativeId); return next; });
      setQaState(prev => ({
        ...prev,
        violations: (prev.violations ?? []).filter(v => v.creativeId !== violation.creativeId),
        violationCount: (prev.violationCount ?? 0) - 1,
      }));
      toast.success(`Multi-advertiser fixed: ${violation.adName}`);
    } catch (err) {
      toast.error(`Multi-advertiser fix failed for ${violation.adName}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFixingMultiAdvIds(prev => { const next = new Set(prev); next.delete(violation.creativeId); return next; });
    }
  };

  const handleFixAll = async () => {
    const violations = qaState.violations ?? [];
    for (const v of violations) {
      if (hasDofSettings(v) && !fixedCreativeIds.has(v.creativeId)) await handleFixDof(v);
      if (hasMultiAdvSettings(v) && !fixedMultiAdvIds.has(v.creativeId)) await handleFixMultiAdv(v);
    }
  };

  // ── Toggle helpers ──
  const toggleCampaign = (id: string) => setSelectedCampaignIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAdSet = (id: string) => setSelectedAdSetIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAd = (id: string) => setSelectedAdIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllCampaigns = () => setSelectedCampaignIds(new Set(filteredCampaigns.map(c => c.id)));
  const deselectAllCampaigns = () => setSelectedCampaignIds(new Set());
  const selectAllAdSets = () => setSelectedAdSetIds(new Set(filteredAdSets.map(a => a.id)));
  const deselectAllAdSets = () => setSelectedAdSetIds(new Set());
  const selectAllAds = () => setSelectedAdIds(new Set(filteredAds.map(a => a.id)));
  const deselectAllAds = () => setSelectedAdIds(new Set());

  const canRun = hasCredentials && selectedAdIds.size > 0 && qaState.phase !== 'launching';

  // ── Render ──
  return (
    <div className="flex gap-6 h-full">

      {/* ── LEFT: Config Panel ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-4 shrink-0 overflow-y-auto pb-6"
        style={{ width: 360 }}
      >
        {/* Account Selection */}
        <ConfigSection title="Account Selection">
          {/* Business Manager */}
          <FormField label="Business Manager Token">
            {activeTokens.length === 0 ? (
              <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "rgba(237,19,95,0.1)", color: "#ED135F", border: "1px solid rgba(237,19,95,0.2)" }}>
                No tokens configured. Ask your admin to add one in the Token Vault.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={tokenId?.toString() ?? ''}
                  onChange={e => handleTokenChange(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-xs rounded-lg px-3 py-2.5 appearance-none outline-none pr-8"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: tokenId ? "#FAFAFA" : "rgba(255,255,255,0.35)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  <option value="">Select a Business Manager…</option>
                  {activeTokens.map(t => (
                    <option key={t.id} value={t.id.toString()} style={{ background: "#141349" }}>
                      {t.label || t.businessManagerName || `BM ${t.businessManagerId}`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
            )}
            {tokenId && bmId && (
              <p className="text-[9px] mt-1 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>BM ID: {bmId}</p>
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
              <div className="relative" ref={adAccountSearchRef}>
                <div
                  className="flex items-center rounded-lg px-3 py-2 gap-2"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${adAccountDropdownOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)"}` }}
                >
                  <Search size={11} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                  <input
                    value={adAccountId ? `${adAccountName} (${adAccountId})` : adAccountSearch}
                    onChange={e => {
                      if (adAccountId) { setAdAccountId(''); setAdAccountName(''); }
                      setAdAccountSearch(e.target.value);
                      setAdAccountDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (adAccountId) { setAdAccountId(''); setAdAccountName(''); setAdAccountSearch(''); }
                      setAdAccountDropdownOpen(true);
                    }}
                    placeholder="Search ad accounts…"
                    className="flex-1 min-w-0 bg-transparent outline-none text-xs"
                    style={{ color: adAccountId ? "#FAFAFA" : "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif" }}
                  />
                </div>
                {adAccountDropdownOpen && !adAccountId && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg shadow-xl max-h-[200px] overflow-y-auto" style={{ background: "#1a1960", border: "1px solid rgba(255,255,255,0.15)" }}>
                    {adAccounts
                      .filter(a => {
                        const q = adAccountSearch.toLowerCase();
                        return !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
                      })
                      .map(a => (
                        <button
                          key={a.id}
                          onClick={() => handleAdAccountChange(a.id)}
                          className="w-full px-3 py-2 text-left text-xs transition-colors"
                          style={{ color: "rgba(255,255,255,0.8)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {a.name} <span style={{ color: "rgba(255,255,255,0.35)" }}>({a.id})</span>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </FormField>
        </ConfigSection>

        {/* Ad Selection — only when account is selected */}
        {hasCredentials && (
          <>
            {/* Campaigns */}
            <ConfigSection title="Campaigns">
              <SelectorSection
                title="Campaigns"
                count={filteredCampaigns.length}
                selectedCount={selectedCampaignIds.size}
                open={campaignOpen}
                onToggle={() => setCampaignOpen(!campaignOpen)}
                loading={campaignsLoading}
                filter={
                  <FilterPills
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'PAUSED', label: 'Inactive' },
                      { value: 'ALL', label: 'All' },
                    ]}
                    value={campaignFilter}
                    onChange={v => setCampaignFilter(v as StatusFilter)}
                  />
                }
                actions={
                  <>
                    <button onClick={selectAllCampaigns} className="text-[10px]" style={{ color: "#00BEEF" }}>Select All</button>
                    <button onClick={deselectAllCampaigns} className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Clear</button>
                    <button onClick={() => refetchCampaigns()} className="p-1 rounded" title="Refresh" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <RefreshCw size={11} className={campaignsLoading ? 'animate-spin' : ''} />
                    </button>
                  </>
                }
                search={campaignSearch}
                onSearch={setCampaignSearch}
                searchPlaceholder="Search campaigns…"
              >
                {filteredCampaigns.map(c => (
                  <SelectableRow
                    key={c.id}
                    selected={selectedCampaignIds.has(c.id)}
                    onClick={() => toggleCampaign(c.id)}
                    label={c.name}
                    meta={`${c.status} · ${c.objective?.replace('OUTCOME_', '') || '—'}`}
                    id={c.id}
                  />
                ))}
                {filteredCampaigns.length === 0 && !campaignsLoading && (
                  <div className="text-xs py-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>No campaigns found.</div>
                )}
              </SelectorSection>
            </ConfigSection>

            {/* Ad Sets */}
            <ConfigSection title="Ad Sets">
              <SelectorSection
                title="Ad Sets"
                count={filteredAdSets.length}
                selectedCount={selectedAdSetIds.size}
                open={adSetOpen}
                onToggle={() => setAdSetOpen(!adSetOpen)}
                loading={adSetsLoading}
                disabled={selectedCampaignIds.size === 0}
                disabledMessage="Select campaigns first"
                filter={
                  <FilterPills
                    options={[
                      { value: 'ALL', label: 'All' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'PAUSED', label: 'Inactive' },
                    ]}
                    value={adSetFilter}
                    onChange={v => setAdSetFilter(v as StatusFilter)}
                  />
                }
                actions={
                  <>
                    <button onClick={selectAllAdSets} className="text-[10px]" style={{ color: "#00BEEF" }}>Select All</button>
                    <button onClick={deselectAllAdSets} className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Clear</button>
                  </>
                }
                search={adSetSearch}
                onSearch={setAdSetSearch}
                searchPlaceholder="Search ad sets…"
              >
                {filteredAdSets.map(a => (
                  <SelectableRow
                    key={a.id}
                    selected={selectedAdSetIds.has(a.id)}
                    onClick={() => toggleAdSet(a.id)}
                    label={a.name}
                    meta={a.status}
                    id={a.id}
                  />
                ))}
                {filteredAdSets.length === 0 && !adSetsLoading && selectedCampaignIds.size > 0 && (
                  <div className="text-xs py-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>No ad sets found.</div>
                )}
              </SelectorSection>
            </ConfigSection>

            {/* Ads */}
            <ConfigSection title="Ads">
              <SelectorSection
                title="Ads"
                count={filteredAds.length}
                selectedCount={selectedAdIds.size}
                open={adsOpen}
                onToggle={() => setAdsOpen(!adsOpen)}
                loading={adsLoading}
                disabled={selectedAdSetIds.size === 0}
                disabledMessage="Select ad sets first"
                filter={
                  <FilterPills
                    options={[
                      { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'PAUSED', label: 'Inactive' },
                      { value: 'ALL', label: 'All' },
                    ]}
                    value={adsFilter}
                    onChange={v => setAdsFilter(v as AdsFilter)}
                  />
                }
                actions={
                  <>
                    <button onClick={selectAllAds} className="text-[10px]" style={{ color: "#00BEEF" }}>Select All</button>
                    <button onClick={deselectAllAds} className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Clear</button>
                    {selectedAdSetArray.length > 0 && (
                      <button onClick={() => refetchAds()} className="p-1 rounded" title="Refresh" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <RefreshCw size={11} className={adsLoading ? 'animate-spin' : ''} />
                      </button>
                    )}
                  </>
                }
                search={adSearch}
                onSearch={setAdSearch}
                searchPlaceholder="Search ads…"
              >
                {filteredAds.map(a => (
                  <SelectableRow
                    key={a.id}
                    selected={selectedAdIds.has(a.id)}
                    onClick={() => toggleAd(a.id)}
                    label={a.name}
                    meta={`${a.status} · Created ${new Date(a.createdTime).toLocaleDateString()}`}
                    id={a.id}
                  />
                ))}
                {filteredAds.length === 0 && !adsLoading && selectedAdSetIds.size > 0 && (
                  <div className="text-xs py-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>No ads found.</div>
                )}
              </SelectorSection>
            </ConfigSection>
          </>
        )}

        {/* Run Button */}
        <div className="flex flex-col gap-1.5 mt-2">
          <button
            onClick={handleRunQa}
            disabled={!canRun}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{
              background: canRun ? "#00BEEF" : "rgba(255,255,255,0.08)",
              color: canRun ? "#141349" : "rgba(255,255,255,0.25)",
              cursor: canRun ? "pointer" : "not-allowed",
            }}
          >
            {qaState.phase === 'launching'
              ? <Loader2 size={14} className="animate-spin" />
              : <Play size={14} fill="currentColor" />
            }
            {qaState.phase === 'launching'
              ? 'Running QA…'
              : `Run QA${selectedAdIds.size > 0 ? ` (${selectedAdIds.size} ad${selectedAdIds.size !== 1 ? 's' : ''})` : ''}`
            }
          </button>
          {!hasCredentials && (
            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              Select a Business Manager and Ad Account to enable
            </p>
          )}
          {hasCredentials && selectedAdIds.size === 0 && (
            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              Select ads above to enable
            </p>
          )}
          {qaState.phase !== 'idle' && (
            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
                title="Reset results"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Results Panel ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Idle state */}
        {qaState.phase === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <ShieldCheck size={24} style={{ color: "#00BEEF", opacity: 0.5 }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>Configure and run QA Verification</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                Verify Advantage+ Creative settings, partnership ads, multi-advertiser status, and copy across your ads.
              </p>
            </div>
          </div>
        )}

        {/* Running state */}
        {qaState.phase === 'launching' && (
          <div className="flex flex-col gap-4 p-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,190,239,0.15)", border: "1px solid rgba(0,190,239,0.3)" }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "#00BEEF" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>QA analysis in progress</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Checking {selectedAdIds.size} ad{selectedAdIds.size !== 1 ? 's' : ''} against expected settings…
                </p>
              </div>
            </div>
            <div className="rounded-lg px-4 py-3" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                <Loader2 size={10} className="animate-spin" style={{ color: "#00BEEF" }} />
                Fetching ad creative data from Meta API…
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {qaState.phase === 'error' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-5" style={{ background: "rgba(237,19,95,0.08)", border: "1px solid rgba(237,19,95,0.2)" }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} style={{ color: "#ED135F" }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold" style={{ color: "#ED135F" }}>QA failed</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{qaState.errorMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Done state */}
        {qaState.phase === 'done' && (
          <div className="flex flex-col gap-5">

            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 size={16} style={{ color: "#00B37A" }} />
              <span className="text-sm font-semibold" style={{ color: "#00B37A" }}>QA complete</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {adAccountName || adAccountId}
              </span>
              {qaState.violationCount !== undefined && qaState.violationCount > 0 && (
                <span
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}
                >
                  <AlertTriangle size={10} /> {qaState.violationCount} violation{qaState.violationCount !== 1 ? 's' : ''}
                </span>
              )}
              {qaState.violationCount === 0 && (
                <span
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(0,179,122,0.12)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.25)" }}
                >
                  <CheckCircle2 size={10} /> All settings correct
                </span>
              )}
              {/* Download button */}
              {qaState.downloadUrl && (
                <a
                  href={qaState.downloadUrl}
                  download="ad_qa_checklist.xlsx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ml-auto"
                  style={{ background: "rgba(0,179,122,0.12)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.25)" }}
                >
                  <FileDown size={11} /> Download Excel
                </a>
              )}
            </div>

            {/* Summary card */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="Ads Checked" value={String(qaState.totalAds ?? 0)} color="#00BEEF" />
              <SummaryCard label="Ad Sets Checked" value={String(qaState.totalAdSets ?? 0)} color="#00BEEF" />
              <SummaryCard
                label="Violations Found"
                value={String(qaState.violationCount ?? 0)}
                color={(qaState.violationCount ?? 0) > 0 ? "#FBBF24" : "#00B37A"}
              />
            </div>

            {/* Violations panel */}
            {qaState.violations && qaState.violations.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(251,191,36,0.3)" }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(251,191,36,0.05)", borderBottom: "1px solid rgba(251,191,36,0.2)" }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} style={{ color: "#FBBF24" }} />
                    <span className="text-xs font-bold" style={{ color: "#FBBF24" }}>Violations</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {qaState.violations.length} ad{qaState.violations.length !== 1 ? 's' : ''} with settings that should be OFF
                    </span>
                  </div>
                  {qaState.violations.length > 1 && (
                    <button
                      onClick={handleFixAll}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                      style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}
                    >
                      <Wrench size={11} /> Fix All
                    </button>
                  )}
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {qaState.violations.map(v => {
                    const dofSettings = v.settings.filter(s => !MULTI_ADV_NAMES.has(s.name));
                    const multiAdvSettings = v.settings.filter(s => MULTI_ADV_NAMES.has(s.name));
                    const dofFixed = fixedCreativeIds.has(v.creativeId);
                    const dofFixing = fixingCreativeIds.has(v.creativeId);
                    const multiAdvFixed = fixedMultiAdvIds.has(v.creativeId);
                    const multiAdvFixing = fixingMultiAdvIds.has(v.creativeId);
                    const allFixed = (dofSettings.length === 0 || dofFixed) && (multiAdvSettings.length === 0 || multiAdvFixed);

                    return (
                      <div
                        key={v.adId}
                        className="px-4 py-3 transition-colors"
                        style={{ background: allFixed ? "rgba(0,179,122,0.05)" : "transparent" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {allFixed
                                ? <CheckCircle2 size={13} style={{ color: "#00B37A", flexShrink: 0 }} />
                                : <AlertTriangle size={13} style={{ color: "#FBBF24", flexShrink: 0 }} />
                              }
                              <span className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{v.adName}</span>
                              <a
                                href={v.adsManagerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 flex-shrink-0"
                                style={{ color: "#00BEEF", fontSize: "0.65rem" }}
                                title="Open in Ads Manager"
                              >
                                <ExternalLink size={9} /> Ads Manager
                              </a>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {dofSettings.map((s, i) => (
                                <span
                                  key={`dof-${i}`}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                                  style={dofFixed
                                    ? { background: "rgba(0,179,122,0.1)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.2)" }
                                    : { background: "rgba(251,191,36,0.1)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.2)" }
                                  }
                                >
                                  {s.name}: {dofFixed ? 'fixed' : s.currentValue}
                                </span>
                              ))}
                              {multiAdvSettings.map((s, i) => (
                                <span
                                  key={`ma-${i}`}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                                  style={multiAdvFixed
                                    ? { background: "rgba(0,179,122,0.1)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.2)" }
                                    : { background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }
                                  }
                                >
                                  {s.name}: {multiAdvFixed ? 'fixed' : s.currentValue}
                                </span>
                              ))}
                            </div>
                            <div className="mt-1 text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                              Creative ID: {v.creativeId} · Format: {v.specKey}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                            {dofSettings.length > 0 && (
                              dofFixed ? (
                                <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: "#00B37A" }}>
                                  <CheckCircle2 size={11} /> Creative Fixed
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleFixDof(v)}
                                  disabled={dofFixing}
                                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
                                  style={{ background: "rgba(0,190,239,0.15)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.3)" }}
                                >
                                  {dofFixing ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
                                  {dofFixing ? 'Fixing…' : 'Fix Creative'}
                                </button>
                              )
                            )}
                            {multiAdvSettings.length > 0 && (
                              multiAdvFixed ? (
                                <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: "#00B37A" }}>
                                  <CheckCircle2 size={11} /> Multi-Adv Fixed
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleFixMultiAdv(v)}
                                  disabled={multiAdvFixing}
                                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
                                  style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
                                >
                                  {multiAdvFixing ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
                                  {multiAdvFixing ? 'Fixing…' : 'Fix Multi-Adv'}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All clear panel */}
            {qaState.violations && qaState.violations.length === 0 && (
              <div className="rounded-xl p-5 flex items-center gap-3" style={{ background: "rgba(0,179,122,0.08)", border: "1px solid rgba(0,179,122,0.2)" }}>
                <CheckCircle2 size={20} style={{ color: "#00B37A" }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: "#00B37A" }}>All ads passed QA</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    No Advantage+ Creative or multi-advertiser violations found across {qaState.totalAds} ad{(qaState.totalAds ?? 0) !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            )}

            {/* Inline QA Results Table */}
            <QaResultsTable
              adAccountName={adAccountName}
              totalAds={qaState.totalAds ?? 0}
              totalAdSets={qaState.totalAdSets ?? 0}
              violations={qaState.violations ?? []}
            />

          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
    </div>
  );
}

// ── Inline QA Results Table ───────────────────────────────────────────────────

function QaResultsTable({
  adAccountName, totalAds, totalAdSets, violations,
}: {
  adAccountName: string;
  totalAds: number;
  totalAdSets: number;
  violations: QaViolation[];
}) {
  const passCount = totalAds - violations.length;
  const violationAdIds = new Set(violations.map(v => v.adId));

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          QA Results Summary
        </p>
      </div>

      {/* Markdown-style readable summary */}
      <div className="px-4 py-4 space-y-4">

        {/* Account & scope */}
        <div className="space-y-1">
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>Account</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>{adAccountName || '—'}</p>
        </div>

        {/* Scope stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Ads Checked</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "#00BEEF" }}>{totalAds}</p>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Ad Sets Checked</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "#00BEEF" }}>{totalAdSets}</p>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Passed</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "#00B37A" }}>{passCount}</p>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Violations</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: violations.length > 0 ? "#FBBF24" : "#00B37A" }}>{violations.length}</p>
          </div>
        </div>

        {/* Violation breakdown by type */}
        {violations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>Violation Breakdown</p>
            {(() => {
              const byType: Record<string, number> = {};
              for (const v of violations) {
                for (const s of v.settings) {
                  byType[s.name] = (byType[s.name] ?? 0) + 1;
                }
              }
              return Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{name}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}
                  >
                    {count} ad{count !== 1 ? 's' : ''}
                  </span>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Checked ads list */}
        {totalAds > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
              Ads Reviewed ({totalAds})
            </p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {violations.map(v => (
                <div
                  key={v.adId}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
                >
                  <AlertTriangle size={11} style={{ color: "#FBBF24", flexShrink: 0 }} />
                  <span className="text-xs flex-1 truncate" style={{ color: "rgba(255,255,255,0.75)" }}>{v.adName}</span>
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {v.settings.length} issue{v.settings.length !== 1 ? 's' : ''}
                  </span>
                  <a
                    href={v.adsManagerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#00BEEF", flexShrink: 0 }}
                    title="Open in Ads Manager"
                  >
                    <ExternalLink size={10} />
                  </a>
                </div>
              ))}
              {/* Passing ads placeholder note */}
              {passCount > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(0,179,122,0.05)", border: "1px solid rgba(0,179,122,0.12)" }}
                >
                  <CheckCircle2 size={11} style={{ color: "#00B37A", flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {passCount} ad{passCount !== 1 ? 's' : ''} passed all checks — see Excel report for full details
                  </span>
                </div>
              )}
              {passCount === totalAds && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(0,179,122,0.05)", border: "1px solid rgba(0,179,122,0.12)" }}
                >
                  <CheckCircle2 size={11} style={{ color: "#00B37A", flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    All {totalAds} ads passed — see Excel report for full settings detail
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Download hint */}
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          Download the Excel report above for the full ad-by-ad checklist including landing pages, headlines, CTAs, and ad set targeting details.
        </p>
      </div>
    </div>
  );
}

// ── Config Section ────────────────────────────────────────────────────────────

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Selector Section ──────────────────────────────────────────────────────────

function SelectorSection({
  title, count, selectedCount, open, onToggle, loading, disabled, disabledMessage,
  filter, actions, search, onSearch, searchPlaceholder, children,
}: {
  title: string;
  count: number;
  selectedCount: number;
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  filter: React.ReactNode;
  actions: React.ReactNode;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.09)",
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
        style={{ background: open ? "rgba(255,255,255,0.04)" : "transparent" }}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronUp size={13} style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronDown size={13} style={{ color: "rgba(255,255,255,0.4)" }} />}
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{title}</span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            {loading ? '…' : `${count} available`}
          </span>
          {selectedCount > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,190,239,0.15)", color: "#00BEEF" }}
            >
              {selectedCount} selected
            </span>
          )}
        </div>
        {disabled && disabledMessage && (
          <span className="text-[10px] italic" style={{ color: "rgba(255,255,255,0.3)" }}>{disabledMessage}</span>
        )}
      </button>

      {open && !disabled && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Filter + Actions */}
          <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5">
              <Filter size={9} style={{ color: "rgba(255,255,255,0.3)" }} />
              {filter}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>

          {/* Search */}
          <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search size={10} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 min-w-0 bg-transparent outline-none text-xs"
                style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {loading ? (
              <div className="flex items-center justify-center py-5">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
            ) : children}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Pills ──────────────────────────────────────────────────────────────

function FilterPills({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2 py-0.5 rounded text-[10px] font-semibold transition-all"
          style={value === opt.value
            ? { background: "rgba(0,190,239,0.15)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.3)" }
            : { color: "rgba(255,255,255,0.4)", border: "1px solid transparent" }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Selectable Row ────────────────────────────────────────────────────────────

function SelectableRow({ selected, onClick, label, meta, id }: {
  selected: boolean;
  onClick: () => void;
  label: string;
  meta: string;
  id: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
      style={{
        background: selected ? "rgba(0,190,239,0.06)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = selected ? "rgba(0,190,239,0.06)" : "transparent"; }}
    >
      {selected
        ? <CheckSquare size={13} style={{ color: "#00BEEF", flexShrink: 0 }} />
        : <Square size={13} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{label}</div>
        <div className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{meta} · {id}</div>
      </div>
    </button>
  );
}
