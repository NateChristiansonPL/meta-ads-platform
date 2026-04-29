// BuilderReachOverlapPanel.tsx
// Reach Estimate + Audience Overlap panels for the Campaign Builder Ad Sets tab.
// Results are persisted in session via the parent CampaignBuilderState.

import React, { useState, useCallback } from 'react';
import { BarChart2, Users, RefreshCw, ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AdSetRow, BuildSettings, GeoLocationObject, InterestObject, ReachEstimateRun, OverlapRun } from '@/lib/campaignStore';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
// ReachEstimateRun and OverlapRun are defined in campaignStore.ts and re-exported here
export type { ReachEstimateRun, OverlapRun };

interface Props {
  rows: AdSetRow[];
  settings?: BuildSettings;
  reachHistory: ReachEstimateRun[];
  overlapHistory: OverlapRun[];
  onReachHistoryChange: (h: ReachEstimateRun[]) => void;
  onOverlapHistoryChange: (h: OverlapRun[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function overlapColor(pct: number): string {
  if (pct >= 60) return 'text-red-400';
  if (pct >= 40) return 'text-amber-400';
  if (pct >= 20) return 'text-yellow-400';
  return 'text-emerald-400';
}

function overlapBg(pct: number): string {
  if (pct >= 60) return 'bg-red-500/10 border-red-500/20';
  if (pct >= 40) return 'bg-amber-500/10 border-amber-500/20';
  if (pct >= 20) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-emerald-500/10 border-emerald-500/20';
}

function confidenceBadge(conf: string) {
  if (conf === 'HIGH') return <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">HIGH</span>;
  if (conf === 'MEDIUM') return <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">MED</span>;
  return <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">LOW</span>;
}

function buildTargetingSpec(row: AdSetRow): Record<string, unknown> {
  const spec: Record<string, unknown> = {};

  // Age
  const ageMin = parseInt(row.ageMin || '18', 10);
  const ageMax = parseInt(row.ageMax || '65', 10);
  spec.age_min = isNaN(ageMin) ? 18 : ageMin;
  spec.age_max = isNaN(ageMax) ? 65 : ageMax;

  // Gender
  if (row.genders === 'male') spec.genders = [1];
  else if (row.genders === 'female') spec.genders = [2];

  // Geo locations — prefer structured objects
  const geoObjs: GeoLocationObject[] = row.geoLocationObjects || [];
  if (geoObjs.length > 0) {
    const cities: { key: string; radius?: number; distance_unit?: string }[] = [];
    const regions: { key: string }[] = [];
    const countries: string[] = [];
    const zips: { key: string }[] = [];

    for (const g of geoObjs) {
      const t = g.type?.toLowerCase() || '';
      if (t === 'city') cities.push({ key: g.key });
      else if (t === 'region') regions.push({ key: g.key });
      else if (t === 'country') countries.push(g.key);
      else if (t === 'zip') zips.push({ key: g.key });
      else countries.push(g.key); // fallback
    }
    const geo: Record<string, unknown> = {};
    if (cities.length) geo.cities = cities;
    if (regions.length) geo.regions = regions;
    if (countries.length) geo.countries = countries;
    if (zips.length) geo.zips = zips;
    spec.geo_locations = Object.keys(geo).length ? geo : { countries: ['US'] };
  } else if (row.geoLocations) {
    // Fallback: treat as country codes if they look like 2-letter codes
    const lines = row.geoLocations.split('\n').filter(Boolean);
    const countryLike = lines.filter(l => /^[A-Z]{2}$/.test(l.trim()));
    spec.geo_locations = countryLike.length ? { countries: countryLike } : { countries: ['US'] };
  } else {
    spec.geo_locations = { countries: ['US'] };
  }

  // Detailed interests — id must be a string for Meta API, skip empty arrays
  const interestObjs: InterestObject[] = row.detailedInterestObjects || [];
  const narrowObjs: InterestObject[] = row.narrowInterestObjects || [];

  if (interestObjs.length > 0 || narrowObjs.length > 0) {
    const flexSpec: Record<string, unknown>[] = [];
    if (interestObjs.length > 0) {
      flexSpec.push({
        interests: interestObjs.map(i => ({ id: String(i.id), name: i.name })),
      });
    }
    if (narrowObjs.length > 0) {
      flexSpec.push({
        interests: narrowObjs.map(i => ({ id: String(i.id), name: i.name })),
      });
    }
    if (flexSpec.length > 0) spec.flexible_spec = flexSpec;
  }

  // Placements — 'threads' is NOT a valid publisher_platform for targeting
  const VALID_PUBLISHER_PLATFORMS = new Set(['facebook', 'instagram', 'audience_network', 'messenger']);
  if (row.placementType === 'advantage_plus') {
    spec.publisher_platforms = ['facebook', 'instagram'];
  } else if (row.placements.length > 0) {
    const platforms = new Set<string>();
    const fbPositions: string[] = [];
    const igPositions: string[] = [];
    for (const p of row.placements) {
      if (p.startsWith('facebook_')) { platforms.add('facebook'); fbPositions.push(p.replace('facebook_', '')); }
      else if (p.startsWith('instagram_')) { platforms.add('instagram'); igPositions.push(p.replace('instagram_', '')); }
      else if (p.startsWith('audience_network_')) platforms.add('audience_network');
      else if (p.startsWith('messenger_')) platforms.add('messenger');
      // 'threads' and other non-standard platforms are intentionally skipped
    }
    // Only include valid platforms
    const validPlatforms = Array.from(platforms).filter(p => VALID_PUBLISHER_PLATFORMS.has(p));
    if (validPlatforms.length > 0) spec.publisher_platforms = validPlatforms;
    if (fbPositions.length) spec.facebook_positions = fbPositions;
    if (igPositions.length) spec.instagram_positions = igPositions;
  }

  return spec;
}

// ─── Reach Estimate Panel ─────────────────────────────────────────────────────

function ReachEstimatePanel({ rows, settings, history, onHistoryChange }: {
  rows: AdSetRow[];
  settings?: BuildSettings;
  history: ReachEstimateRun[];
  onHistoryChange: (h: ReachEstimateRun[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRun, setExpandedRun] = useState<number | null>(0);

  const batchReach = trpc.meta.batchReachEstimates.useMutation();

  const runEstimate = useCallback(async () => {
    if (!settings?.accessToken || !settings?.adAccountId) return;
    setRunning(true);
    try {
      const adSets = rows.map(row => ({
        id: row.id,
        name: row.name,
        targetingSpec: buildTargetingSpec(row),
        optimizationGoal: row.optimizationGoal,
      }));
      const result = await batchReach.mutateAsync({
        accessToken: settings.accessToken,
        adAccountId: settings.adAccountId,
        adSets,
      });
      const run: ReachEstimateRun = { runAt: Date.now(), results: result.results };
      onHistoryChange([run, ...history].slice(0, 10));
      setExpandedRun(0);
      setShowHistory(false);
    } catch (err) {
      console.error('Reach estimate failed:', err);
    } finally {
      setRunning(false);
    }
  }, [rows, settings, history, onHistoryChange, batchReach]);

  const latest = history[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-primary" />
          <span className="text-[12px] font-700 text-foreground">Reach Estimate</span>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Clock size={10} />
              {history.length} run{history.length !== 1 ? 's' : ''}
              {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
        <button
          onClick={runEstimate}
          disabled={running || !settings?.accessToken}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
            running || !settings?.accessToken
              ? 'bg-surface-2 border-border text-muted-foreground cursor-not-allowed'
              : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
          )}>
          <RefreshCw size={11} className={running ? 'animate-spin' : ''} />
          {running ? 'Running…' : 'Run Estimate'}
        </button>
      </div>

      {!settings?.accessToken && (
        <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={11} /> Add Meta credentials in Settings to run reach estimates.
        </p>
      )}

      {/* History list */}
      {showHistory && history.length > 1 && (
        <div className="space-y-1">
          {history.slice(1).map((run, i) => (
            <button
              key={run.runAt}
              onClick={() => { setExpandedRun(i + 1); setShowHistory(false); }}
              className="w-full text-left px-3 py-2 rounded-lg bg-surface-2/50 border border-border hover:border-primary/30 transition-colors flex items-center justify-between">
              <span className="text-[11px] text-foreground">{new Date(run.runAt).toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">{run.results.length} ad sets</span>
            </button>
          ))}
        </div>
      )}

      {/* Results table */}
      {history.length > 0 && (() => {
        const run = history[expandedRun ?? 0];
        if (!run) return null;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {expandedRun === 0 ? 'Latest run' : 'Historical run'} — {new Date(run.runAt).toLocaleString()}
              </span>
              {expandedRun !== 0 && (
                <button onClick={() => setExpandedRun(0)} className="text-[10px] text-primary hover:underline">← Back to latest</button>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-3 py-2 text-muted-foreground font-600">Ad Set</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Reach (Low)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Reach (Mid)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Reach (High)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Est. CPM</th>
                  </tr>
                </thead>
                <tbody>
                  {run.results.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-surface-2/20">
                      <td className="px-3 py-2 text-foreground font-500 max-w-[200px] truncate">{r.name}</td>
                      {r.error ? (
                        <td colSpan={4} className="px-3 py-2 text-red-400 text-[10px]">{r.error}</td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.reachLower)}</td>
                          <td className="px-3 py-2 text-right text-foreground font-600">{fmt(r.reachMid)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.reachUpper)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{r.cpm != null ? `$${r.cpm.toFixed(2)}` : '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Audience Overlap Panel ───────────────────────────────────────────────────

function AudienceOverlapPanel({ rows, settings, history, onHistoryChange }: {
  rows: AdSetRow[];
  settings?: BuildSettings;
  history: OverlapRun[];
  onHistoryChange: (h: OverlapRun[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRun, setExpandedRun] = useState<number | null>(0);
  const [view, setView] = useState<'summary' | 'pairs'>('summary');

  const builderOverlap = trpc.meta.builderAudienceOverlap.useMutation();

  const runOverlap = useCallback(async () => {
    if (!settings?.accessToken || !settings?.adAccountId) return;
    setRunning(true);
    try {
      const adSets = rows.map(row => ({
        id: row.id,
        name: row.name,
        campaignName: row.campaignName,
        targetingSpec: buildTargetingSpec(row),
        isNarrowed: !!(row.narrowInterests || row.narrowInterestObjects?.length),
      }));
      const result = await builderOverlap.mutateAsync({
        accessToken: settings.accessToken,
        adAccountId: settings.adAccountId,
        adSets,
      });
      const run: OverlapRun = {
        runAt: Date.now(),
        overlapResults: result.overlapResults,
        pairList: result.pairList,
      };
      onHistoryChange([run, ...history].slice(0, 10));
      setExpandedRun(0);
      setShowHistory(false);
    } catch (err) {
      console.error('Overlap analysis failed:', err);
    } finally {
      setRunning(false);
    }
  }, [rows, settings, history, onHistoryChange, builderOverlap]);

  const latest = history[expandedRun ?? 0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          <span className="text-[12px] font-700 text-foreground">Audience Overlap</span>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Clock size={10} />
              {history.length} run{history.length !== 1 ? 's' : ''}
              {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
        <button
          onClick={runOverlap}
          disabled={running || !settings?.accessToken || rows.length < 2}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
            running || !settings?.accessToken || rows.length < 2
              ? 'bg-surface-2 border-border text-muted-foreground cursor-not-allowed'
              : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
          )}>
          <RefreshCw size={11} className={running ? 'animate-spin' : ''} />
          {running ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </div>

      {!settings?.accessToken && (
        <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={11} /> Add Meta credentials in Settings to run overlap analysis.
        </p>
      )}
      {settings?.accessToken && rows.length < 2 && (
        <p className="text-[11px] text-muted-foreground">Need at least 2 ad sets to analyze overlap.</p>
      )}

      {/* History list */}
      {showHistory && history.length > 1 && (
        <div className="space-y-1">
          {history.slice(1).map((run, i) => (
            <button
              key={run.runAt}
              onClick={() => { setExpandedRun(i + 1); setShowHistory(false); }}
              className="w-full text-left px-3 py-2 rounded-lg bg-surface-2/50 border border-border hover:border-primary/30 transition-colors flex items-center justify-between">
              <span className="text-[11px] text-foreground">{new Date(run.runAt).toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">{run.pairList.length} pairs</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {latest && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {expandedRun === 0 ? 'Latest run' : 'Historical run'} — {new Date(latest.runAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              {expandedRun !== 0 && (
                <button onClick={() => setExpandedRun(0)} className="text-[10px] text-primary hover:underline">← Latest</button>
              )}
              <div className="flex gap-0.5">
                {(['summary', 'pairs'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] rounded transition-colors capitalize',
                      view === v ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                    )}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {view === 'summary' && (
            <div className="grid grid-cols-2 gap-2">
              {latest.overlapResults.map(r => {
                const maxOverlap = r.overlaps[0]?.pct ?? 0;
                return (
                  <div key={r.id} className={cn('rounded-lg border p-3 space-y-2', overlapBg(maxOverlap))}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-600 text-foreground truncate max-w-[140px]">{r.name}</span>
                      <span className="text-[10px] text-muted-foreground">{fmt(r.reach)}</span>
                    </div>
                    {r.overlaps.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No overlapping ad sets in same campaign.</p>
                    ) : (
                      <div className="space-y-1">
                        {r.overlaps.slice(0, 3).map((o, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{o.name}</span>
                            <div className="flex items-center gap-1">
                              <span className={cn('text-[11px] font-700', overlapColor(o.pct))}>{o.pct}%</span>
                              {confidenceBadge(o.confidence)}
                            </div>
                          </div>
                        ))}
                        {r.overlaps.length > 3 && (
                          <p className="text-[9px] text-muted-foreground">+{r.overlaps.length - 3} more</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view === 'pairs' && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-3 py-2 text-muted-foreground font-600">Ad Set A</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-600">Ad Set B</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Intersection</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">% of A</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">% of B</th>
                    <th className="text-center px-3 py-2 text-muted-foreground font-600">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.pairList.map((p, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface-2/20">
                      <td className="px-3 py-2 text-foreground max-w-[140px] truncate">{p.adSetA.name}</td>
                      <td className="px-3 py-2 text-foreground max-w-[140px] truncate">{p.adSetB.name}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmt(p.intersectionReach)}</td>
                      <td className={cn('px-3 py-2 text-right font-700', overlapColor(p.overlapPctA))}>{p.overlapPctA}%</td>
                      <td className={cn('px-3 py-2 text-right font-700', overlapColor(p.overlapPctB))}>{p.overlapPctB}%</td>
                      <td className="px-3 py-2 text-center">{confidenceBadge(p.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

type ActivePanel = 'reach' | 'overlap' | null;

export default function BuilderReachOverlapPanel({
  rows, settings,
  reachHistory, overlapHistory,
  onReachHistoryChange, onOverlapHistoryChange,
}: Props) {
  const [active, setActive] = useState<ActivePanel>(null);

  return (
    <div className="flex items-center gap-2">
      {/* Trigger buttons */}
      <button
        onClick={() => setActive(a => a === 'reach' ? null : 'reach')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
          active === 'reach'
            ? 'bg-primary/20 border-primary/50 text-primary'
            : 'bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
        )}>
        <BarChart2 size={12} />
        Reach Estimate
        {reachHistory.length > 0 && (
          <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">{reachHistory.length}</span>
        )}
      </button>
      <button
        onClick={() => setActive(a => a === 'overlap' ? null : 'overlap')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
          active === 'overlap'
            ? 'bg-primary/20 border-primary/50 text-primary'
            : 'bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
        )}>
        <Users size={12} />
        Audience Overlap
        {overlapHistory.length > 0 && (
          <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">{overlapHistory.length}</span>
        )}
      </button>

      {/* Inline panel (rendered below toolbar via portal-like approach in parent) */}
      {active && (
        <div className="fixed inset-0 z-40 pointer-events-none" />
      )}
    </div>
  );
}

// Export sub-panels for use in AdSetsTable
export { ReachEstimatePanel, AudienceOverlapPanel };
