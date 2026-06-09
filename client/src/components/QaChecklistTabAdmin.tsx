/**
 * QA Checklist Tab — Dedicated tab for running Ad QA analysis
 * Features:
 * - Cascading Campaign → Ad Set → Ads dropdowns
 * - Status filters (Active/Inactive, Last 7 Days)
 * - Multi-select at each level
 * - Run QA button triggers the launchQaChecklist skill
 * - Download XLSX when complete
 */

import { useState, useMemo, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Search, ShieldCheck, Loader2, ExternalLink,
  CheckSquare, Square, Filter, RefreshCw, Download, Wrench, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface BuildSettings {
  [key: string]: any;
}

interface QaViolation {
  adId: string;
  adName: string;
  creativeId: string;
  specKey: string;
  settings: Array<{ name: string; currentValue: string; expectedValue: string }>;
  adsManagerUrl: string;
}

interface Props {
  settings: BuildSettings;
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

export default function QaChecklistTab({ settings }: Props) {
  const hasCredentials = !!(settings.accessToken && settings.adAccountId);

  // ── State ──
  const [campaignFilter, setCampaignFilter] = useState<StatusFilter>('ACTIVE');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignOpen, setCampaignOpen] = useState(true);

  const [adSetFilter, setAdSetFilter] = useState<StatusFilter>('ALL');
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<Set<string>>(new Set());
  const [adSetSearch, setAdSetSearch] = useState('');
  const [adSetOpen, setAdSetOpen] = useState(false);

  const [adsFilter, setAdsFilter] = useState<AdsFilter>('ACTIVE');
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

  // Track which violations have been fixed
  const [fixedCreativeIds, setFixedCreativeIds] = useState<Set<string>>(new Set());
  const [fixingCreativeIds, setFixingCreativeIds] = useState<Set<string>>(new Set());
  const [fixedMultiAdvIds, setFixedMultiAdvIds] = useState<Set<string>>(new Set());
  const [fixingMultiAdvIds, setFixingMultiAdvIds] = useState<Set<string>>(new Set());

  const MULTI_ADV_NAMES = new Set(['contextual_multi_ads', 'Multi-Advertiser Eligibility']);
  const hasDofSettings = (v: QaViolation) => v.settings.some(s => !MULTI_ADV_NAMES.has(s.name));
  const hasMultiAdvSettings = (v: QaViolation) => v.settings.some(s => MULTI_ADV_NAMES.has(s.name));

  // ── Data fetching ──
  const { data: campaignData, isLoading: campaignsLoading, refetch: refetchCampaigns } =
    trpc.adminMeta.getCampaigns.useQuery(
      { accessToken: settings.accessToken, adAccountId: settings.adAccountId },
      { enabled: hasCredentials, staleTime: 2 * 60 * 1000 }
    );

  const campaigns: CampaignItem[] = (campaignData?.campaigns ?? []) as CampaignItem[];

  // Fetch ad sets for selected campaigns
  const selectedCampaignArray = useMemo(() => Array.from(selectedCampaignIds), [selectedCampaignIds]);
  const adSetQueries = trpc.useQueries((t) =>
    selectedCampaignArray.map(cId =>
      t.adminMeta.getAdSets({ accessToken: settings.accessToken, campaignId: cId }, { enabled: hasCredentials && selectedCampaignIds.size > 0, staleTime: 2 * 60 * 1000 })
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

  // Fetch ads for selected ad sets
  const selectedAdSetArray = useMemo(() => Array.from(selectedAdSetIds), [selectedAdSetIds]);
  const { data: adsData, isLoading: adsLoading, refetch: refetchAds } =
    trpc.adminMeta.getAds.useQuery(
      { accessToken: settings.accessToken, adSetIds: selectedAdSetArray },
      { enabled: hasCredentials && selectedAdSetArray.length > 0, staleTime: 2 * 60 * 1000 }
    );

  const allAds: AdItem[] = (adsData?.ads ?? []) as AdItem[];

  // ── Filtering ──
  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    if (campaignFilter !== 'ALL') {
      list = list.filter(c => c.status === campaignFilter);
    }
    if (campaignSearch.trim()) {
      const q = campaignSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q));
    }
    return list;
  }, [campaigns, campaignFilter, campaignSearch]);

  const filteredAdSets = useMemo(() => {
    let list = allAdSets;
    if (adSetFilter !== 'ALL') {
      list = list.filter(a => a.status === adSetFilter);
    }
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
    // Clear ad set selections that are no longer valid
    setSelectedAdSetIds(prev => {
      const validIds = new Set(allAdSets.map(a => a.id));
      const next = new Set(Array.from(prev).filter(id => validIds.has(id)));
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [allAdSets]);

  useEffect(() => {
    // Clear ad selections that are no longer valid
    setSelectedAdIds(prev => {
      const validIds = new Set(allAds.map(a => a.id));
      const next = new Set(Array.from(prev).filter(id => validIds.has(id)));
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [allAds]);

  // ── QA Launch (direct backend, no Manus) ──
  const runQaDirect = trpc.runs.runQaChecklistDirect.useMutation();

  const handleRunQa = async () => {
    if (!hasCredentials) {
      toast.error('Configure Meta credentials in Settings first.');
      return;
    }
    if (selectedAdIds.size === 0) {
      toast.error('Select at least one ad to run QA on.');
      return;
    }

    const adIds = Array.from(selectedAdIds);
    setQaState({ phase: 'launching' });
    try {
      const result = await runQaDirect.mutateAsync({
        adAccountId: settings.adAccountId,
        tokenId: settings.tokenId ?? undefined,
        facebookPageId: settings.facebookPageId,
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
      setFixedCreativeIds(new Set());
      setFixingCreativeIds(new Set());
      setFixedMultiAdvIds(new Set());
      setFixingMultiAdvIds(new Set());
      toast.success(`QA complete — ${result.totalAds} ads, ${result.totalAdSets} ad sets checked`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setQaState({ phase: 'error', errorMessage: msg });
      toast.error(`QA failed: ${msg}`);
    }
  };

  // ── Fix violation handlers ──
  const fixViolation = trpc.runs.fixAdDofViolation.useMutation();
  const fixMultiAdv = trpc.runs.fixMultiAdvertiserViolation.useMutation();

  const handleFixDof = async (violation: QaViolation) => {
    setFixingCreativeIds(prev => { const next = new Set(prev); next.add(violation.creativeId); return next; });
    try {
      await fixViolation.mutateAsync({
        adId: violation.adId,
        creativeId: violation.creativeId,
        specKey: violation.specKey,
        tokenId: settings.tokenId ?? undefined,
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
      await fixMultiAdv.mutateAsync({
        adId: violation.adId,
        creativeId: violation.creativeId,
        tokenId: settings.tokenId ?? undefined,
      });
      setFixedMultiAdvIds(prev => { const next = new Set(prev); next.add(violation.creativeId); return next; });
      // Remove the fixed violation from qaState so it doesn't reappear
      setQaState(prev => ({
        ...prev,
        violations: (prev.violations ?? []).filter(v => v.creativeId !== violation.creativeId),
        violationCount: (prev.violationCount ?? 0) - 1,
      }))
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
  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAdSet = (id: string) => {
    setSelectedAdSetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAd = (id: string) => {
    setSelectedAdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllCampaigns = () => setSelectedCampaignIds(new Set(filteredCampaigns.map(c => c.id)));
  const deselectAllCampaigns = () => setSelectedCampaignIds(new Set());
  const selectAllAdSets = () => setSelectedAdSetIds(new Set(filteredAdSets.map(a => a.id)));
  const deselectAllAdSets = () => setSelectedAdSetIds(new Set());
  const selectAllAds = () => setSelectedAdIds(new Set(filteredAds.map(a => a.id)));
  const deselectAllAds = () => setSelectedAdIds(new Set());

  // ── Render ──
  if (!hasCredentials) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-700 text-foreground mb-1">Configure Meta Credentials</h3>
          <p className="text-[11px] text-muted-foreground">
            Add your Meta access token and ad account in Settings before running QA.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-5 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-700 text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Ad QA Checklist
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Select campaigns, ad sets, and ads to verify Advantage+ Creative settings, partnership ads, multi-advertiser status, and copy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {qaState.phase === 'done' && qaState.downloadUrl && (
            <a
              href={qaState.downloadUrl}
              download="ad_qa_checklist.xlsx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-700 border bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download Report
              {qaState.violationCount !== undefined && qaState.violationCount > 0 && (
                <span className="ml-1 text-[10px] text-amber-400">({qaState.violationCount} violations)</span>
              )}
            </a>
          )}
          <button
            onClick={handleRunQa}
            disabled={qaState.phase === 'launching' || selectedAdIds.size === 0}
            title={selectedAdIds.size === 0 ? 'Select ads to QA' : `Run QA on ${selectedAdIds.size} ad${selectedAdIds.size !== 1 ? 's' : ''}`}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-700 border transition-all ${
              qaState.phase === 'launching'
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 cursor-wait'
                : selectedAdIds.size === 0
                ? 'bg-surface-2 text-muted-foreground cursor-not-allowed border-border opacity-50'
                : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/25 cursor-pointer'
            }`}
          >
            {qaState.phase === 'launching'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ShieldCheck className="w-3.5 h-3.5" />
            }
            {qaState.phase === 'launching' ? 'Running QA…'
              : `Run QA (${selectedAdIds.size})`
            }
          </button>
        </div>
      </div>

      {qaState.phase === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-[11px] text-red-400">
          {qaState.errorMessage || 'QA failed'}
        </div>
      )}
      {qaState.phase === 'done' && qaState.totalAds !== undefined && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-[11px] text-emerald-400 flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          QA complete — {qaState.totalAds} ads, {qaState.totalAdSets} ad sets checked.
          {qaState.violationCount !== undefined && qaState.violationCount > 0 && (
            <span className="text-amber-400 ml-1">{qaState.violationCount} violation{qaState.violationCount !== 1 ? 's' : ''} found.</span>
          )}
        </div>
      )}

      {/* ── Violations Panel ── */}
      {qaState.phase === 'done' && qaState.violations && qaState.violations.length > 0 && (
        <div className="bg-surface-1 border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-[12px] font-700 text-amber-400">
                Violations
              </span>
              <span className="text-[10px] text-muted-foreground">
                {qaState.violations.length} ad{qaState.violations.length !== 1 ? 's' : ''} with settings that should be OFF
              </span>
            </div>
            {qaState.violations.length > 1 && (
              <button
                onClick={handleFixAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-700 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
              >
                <Wrench size={11} />
                Fix All
              </button>
            )}
          </div>

          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
            {qaState.violations.map(v => {
              const dofSettings = v.settings.filter(s => !MULTI_ADV_NAMES.has(s.name));
              const multiAdvSettings = v.settings.filter(s => MULTI_ADV_NAMES.has(s.name));
              const dofFixed = fixedCreativeIds.has(v.creativeId);
              const dofFixing = fixingCreativeIds.has(v.creativeId);
              const multiAdvFixed = fixedMultiAdvIds.has(v.creativeId);
              const multiAdvFixing = fixingMultiAdvIds.has(v.creativeId);
              const allFixed = (dofSettings.length === 0 || dofFixed) && (multiAdvSettings.length === 0 || multiAdvFixed);

              return (
                <div key={v.adId} className={`px-4 py-3 ${allFixed ? 'bg-emerald-500/5' : 'hover:bg-surface-2/20'} transition-colors`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {allFixed
                          ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                          : <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                        }
                        <span className="text-[11px] font-600 text-foreground truncate">{v.adName}</span>
                        <a
                          href={v.adsManagerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-[9px] text-cyan-400 hover:text-cyan-300 flex-shrink-0"
                          title="Open in Ads Manager"
                        >
                          <ExternalLink size={9} />
                          Ads Manager
                        </a>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {dofSettings.map((s, i) => (
                          <span key={`dof-${i}`} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-500 ${dofFixed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {s.name}: {dofFixed ? 'fixed' : s.currentValue}
                          </span>
                        ))}
                        {multiAdvSettings.map((s, i) => (
                          <span key={`ma-${i}`} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-500 ${multiAdvFixed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'}`}>
                            {s.name}: {multiAdvFixed ? 'fixed' : s.currentValue}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 text-[9px] text-muted-foreground/60">
                        Creative ID: {v.creativeId} · Format: {v.specKey}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                      {dofSettings.length > 0 && (
                        dofFixed ? (
                          <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-600">
                            <CheckCircle2 size={11} /> Creative Fixed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleFixDof(v)}
                            disabled={dofFixing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-700 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
                          >
                            {dofFixing ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
                            {dofFixing ? 'Fixing…' : 'Fix Creative'}
                          </button>
                        )
                      )}
                      {multiAdvSettings.length > 0 && (
                        multiAdvFixed ? (
                          <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-600">
                            <CheckCircle2 size={11} /> Multi-Adv Fixed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleFixMultiAdv(v)}
                            disabled={multiAdvFixing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-700 bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 transition-all disabled:opacity-50"
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

      {/* ── Campaigns Section ── */}
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
            <button onClick={selectAllCampaigns} className="text-[10px] text-cyan-400 hover:text-cyan-300">Select All</button>
            <button onClick={deselectAllCampaigns} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
            <button onClick={() => refetchCampaigns()} className="p-1 hover:bg-surface-2 rounded" title="Refresh">
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
          <div className="text-[11px] text-muted-foreground/50 py-4 text-center">
            No campaigns found.
          </div>
        )}
      </SelectorSection>

      {/* ── Ad Sets Section ── */}
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
            <button onClick={selectAllAdSets} className="text-[10px] text-cyan-400 hover:text-cyan-300">Select All</button>
            <button onClick={deselectAllAdSets} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
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
          <div className="text-[11px] text-muted-foreground/50 py-4 text-center">
            No ad sets found.
          </div>
        )}
      </SelectorSection>

      {/* ── Ads Section ── */}
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
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PAUSED', label: 'Inactive' },
              { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
              { value: 'ALL', label: 'All' },
            ]}
            value={adsFilter}
            onChange={v => setAdsFilter(v as AdsFilter)}
          />
        }
        actions={
          <>
            <button onClick={selectAllAds} className="text-[10px] text-cyan-400 hover:text-cyan-300">Select All</button>
            <button onClick={deselectAllAds} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
            {selectedAdSetArray.length > 0 && (
              <button onClick={() => refetchAds()} className="p-1 hover:bg-surface-2 rounded" title="Refresh">
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
          <div className="text-[11px] text-muted-foreground/50 py-4 text-center">
            No ads found.
          </div>
        )}
      </SelectorSection>
    </div>
  );
}

// ── Reusable sub-components ──────────────────────────────────────────────────

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
    <div className={`bg-surface-1 border border-border rounded-xl overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span className="text-[12px] font-700 text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground">
            {loading ? '…' : `${count} available`}
          </span>
          {selectedCount > 0 && (
            <span className="text-[10px] font-600 text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              {selectedCount} selected
            </span>
          )}
        </div>
        {disabled && disabledMessage && (
          <span className="text-[10px] text-muted-foreground/50 italic">{disabledMessage}</span>
        )}
      </button>

      {open && !disabled && (
        <div className="border-t border-border">
          {/* Filter + Actions bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-surface-2/20 border-b border-border">
            <div className="flex items-center gap-2">
              <Filter size={10} className="text-muted-foreground/50" />
              {filter}
            </div>
            <div className="flex items-center gap-3">
              {actions}
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <input
                value={search}
                onChange={e => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-surface-2/40 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[240px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
          className={`px-2 py-0.5 rounded text-[10px] font-600 transition-all ${
            value === opt.value
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              : 'text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
      className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-2/30 transition-colors border-b border-border/50 last:border-b-0 ${
        selected ? 'bg-cyan-500/5' : ''
      }`}
    >
      {selected
        ? <CheckSquare size={14} className="text-cyan-400 flex-shrink-0" />
        : <Square size={14} className="text-muted-foreground/30 flex-shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-600 text-foreground truncate">{label}</div>
        <div className="text-[9px] text-muted-foreground/60 truncate">{meta} · {id}</div>
      </div>
    </button>
  );
}
