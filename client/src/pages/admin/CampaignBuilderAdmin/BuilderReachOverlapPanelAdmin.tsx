// BuilderReachOverlapPanel.tsx
// Reach Estimate + Audience Overlap panels for the Campaign Builder Ad Sets tab.
// Results are persisted in session via the parent CampaignBuilderState.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BarChart2, Users, RefreshCw, ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AdSetRow, BuildSettings, ReachEstimateRun, OverlapRun } from './campaignStoreAdmin';
import { cn } from '@/lib/utils';
import { buildBuilderTargetingSpec } from './builderMetaMappingAdmin';

// ─── Types ────────────────────────────────────────────────────────────────────
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

/** Overlap level label + color based on percentage */
function overlapLevel(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 40) return { label: 'Very High', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
  if (pct >= 31) return { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' };
  if (pct >= 21) return { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
  if (pct >= 11) return { label: 'Acceptable', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' };
  return { label: 'Minimal', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
}

function overlapColor(pct: number): string {
  return overlapLevel(pct).color;
}

function overlapBg(pct: number): string {
  if (pct >= 40) return 'bg-red-500/10 border-red-500/20';
  if (pct >= 31) return 'bg-orange-500/10 border-orange-500/20';
  if (pct >= 21) return 'bg-amber-500/10 border-amber-500/20';
  if (pct >= 11) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-emerald-500/10 border-emerald-500/20';
}

function OverlapLevelBadge({ pct }: { pct: number }) {
  const { label, color, bg } = overlapLevel(pct);
  return (
    <span className={cn('text-[9px] font-700 px-1.5 py-0.5 rounded border uppercase tracking-wide', color, bg)}>
      {label}
    </span>
  );
}

function confidenceBadge(conf: string) {
  if (conf === 'HIGH') return <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">HIGH</span>;
  if (conf === 'MEDIUM') return <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">MED</span>;
  return <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">LOW</span>;
}

function buildTargetingSpec(row: AdSetRow): Record<string, unknown> {
  return buildBuilderTargetingSpec(row);
}

// ─── Venn Diagram Component ───────────────────────────────────────────────────

interface VennPair {
  nameA: string;
  nameB: string;
  pct: number;
  confidence: string;
  intersectionReach: number;
}

function VennDiagram({ pair }: { pair: VennPair }) {
  const { nameA, nameB, pct, confidence, intersectionReach } = pair;
  const level = overlapLevel(pct);
  // Overlap drives how much the circles overlap: 0% = barely touching, 100% = fully overlapping
  // We map pct 0–100 → offset 120–0 (px, circles are r=60)
  const offset = Math.max(0, 120 - pct * 1.2);

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
      {/* SVG Venn */}
      <svg width="240" height="120" viewBox="0 0 240 120">
        {/* Circle A */}
        <circle cx={60 + offset / 2} cy={60} r={55} fill="rgba(0,190,239,0.18)" stroke="rgba(0,190,239,0.6)" strokeWidth={1.5} />
        {/* Circle B */}
        <circle cx={180 - offset / 2} cy={60} r={55} fill="rgba(237,19,95,0.18)" stroke="rgba(237,19,95,0.6)" strokeWidth={1.5} />
        {/* Intersection label */}
        <text x={120} y={56} textAnchor="middle" fontSize={13} fontWeight="700" fill="white">{pct}%</text>
        <text x={120} y={70} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)">{fmt(intersectionReach)}</text>
        {/* Name labels */}
        <text x={60 + offset / 2 - 28} y={115} textAnchor="middle" fontSize={8} fill="rgba(0,190,239,0.8)" className="truncate">
          {nameA.length > 14 ? nameA.slice(0, 13) + '…' : nameA}
        </text>
        <text x={180 - offset / 2 + 28} y={115} textAnchor="middle" fontSize={8} fill="rgba(237,19,95,0.8)">
          {nameB.length > 14 ? nameB.slice(0, 13) + '…' : nameB}
        </text>
      </svg>
      {/* Level + confidence */}
      <div className="flex items-center gap-2">
        <OverlapLevelBadge pct={pct} />
        {confidenceBadge(confidence)}
      </div>
      <p className={cn('text-[11px] font-700', level.color)}>{pct}% overlap</p>
    </div>
  );
}

// ─── Reach Estimate Panel ─────────────────────────────────────────────────────

function ReachEstimatePanel({ rows, settings, history, onHistoryChange, onRunOverlap, overlapRunning }: {
  rows: AdSetRow[];
  settings?: BuildSettings;
  history: ReachEstimateRun[];
  onHistoryChange: (h: ReachEstimateRun[]) => void;
  onRunOverlap: (selectedIds: string[]) => void;
  overlapRunning: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRun, setExpandedRun] = useState<number | null>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const batchReach = trpc.adminMeta.batchReachEstimates.useMutation();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  };

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

  const canRunOverlap = selectedIds.size >= 2;

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
        <div className="flex items-center gap-2">
          {/* Run Overlap button — enabled when 2+ rows selected */}
          <button
            onClick={() => canRunOverlap && onRunOverlap(Array.from(selectedIds))}
            disabled={!canRunOverlap || overlapRunning || !settings?.accessToken}
            title={!canRunOverlap ? 'Select 2 or more ad sets to run overlap' : 'Run audience overlap for selected ad sets'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
              canRunOverlap && settings?.accessToken && !overlapRunning
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                : 'bg-surface-2/30 border-border/30 text-muted-foreground/40 cursor-not-allowed'
            )}>
            <Users size={11} className={overlapRunning ? 'animate-spin' : ''} />
            {overlapRunning ? 'Analyzing…' : 'Run Overlap'}
          </button>
          {/* Run Estimate button */}
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
      </div>

      {!settings?.accessToken && (
        <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={11} /> Add Meta credentials in Settings to run reach estimates.
        </p>
      )}

      {selectedIds.size > 0 && selectedIds.size < 2 && (
        <p className="text-[10px] text-muted-foreground/60">Select one more ad set to enable Run Overlap.</p>
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

      {/* Results table with checkboxes */}
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
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === rows.length && rows.length > 0}
                        ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < rows.length; }}
                        onChange={toggleAll}
                        className="w-3 h-3 accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-600">Ad Set</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Reach (Low)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Reach (Mid)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Reach (High)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-600">Est. CPM</th>
                  </tr>
                </thead>
                <tbody>
                  {run.results.map(r => (
                    <tr key={r.id} className={cn('border-b border-border/50 hover:bg-surface-2/20 transition-colors', selectedIds.has(r.id) && 'bg-primary/5')}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="w-3 h-3 accent-primary cursor-pointer"
                        />
                      </td>
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
            {selectedIds.size >= 2 && (
              <p className="text-[10px] text-purple-300/70">
                {selectedIds.size} ad sets selected — click "Run Overlap" to analyze audience overlap.
              </p>
            )}
          </div>
        );
      })()}

      {/* Empty state — no history yet, show rows with checkboxes for selection */}
      {history.length === 0 && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === rows.length}
                    ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < rows.length; }}
                    onChange={toggleAll}
                    className="w-3 h-3 accent-primary cursor-pointer"
                  />
                </th>
                <th className="text-left px-3 py-2 text-muted-foreground font-600">Ad Set</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-600">Campaign</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-600">Budget</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={cn('border-b border-border/50 hover:bg-surface-2/20 transition-colors', selectedIds.has(r.id) && 'bg-primary/5')}>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="w-3 h-3 accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-foreground font-500 max-w-[200px] truncate">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{r.campaignName}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">${r.budget || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const [view, setView] = useState<'summary' | 'pairs' | 'venn'>('summary');

  const builderOverlap = trpc.adminMeta.builderAudienceOverlap.useMutation();

  const runOverlap = useCallback(async (targetRows?: AdSetRow[]) => {
    if (!settings?.accessToken || !settings?.adAccountId) return;
    setRunning(true);
    const analysisRows = targetRows ?? rows;
    try {
      const adSets = analysisRows.map(row => ({
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

  // Expose runOverlap for external calls (from reach panel)
  (AudienceOverlapPanel as unknown as { _runOverlap?: typeof runOverlap })._runOverlap = runOverlap;

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
          onClick={() => runOverlap()}
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
                {(['summary', 'pairs', 'venn'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] rounded transition-colors capitalize',
                      view === v ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                    )}>
                    {v === 'venn' ? '⬤ Venn' : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SUMMARY VIEW */}
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
                      <div className="space-y-1.5">
                        {r.overlaps.slice(0, 3).map((o, i) => (
                          <div key={i} className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{o.name}</span>
                              <div className="flex items-center gap-1">
                                <span className={cn('text-[11px] font-700', overlapColor(o.pct))}>{o.pct}%</span>
                                {confidenceBadge(o.confidence)}
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <OverlapLevelBadge pct={o.pct} />
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

          {/* PAIRS VIEW */}
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
                    <th className="text-center px-3 py-2 text-muted-foreground font-600">Level</th>
                    <th className="text-center px-3 py-2 text-muted-foreground font-600">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.pairList.map((p, i) => {
                    const maxPct = Math.max(p.overlapPctA, p.overlapPctB);
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/20">
                        <td className="px-3 py-2 text-foreground max-w-[140px] truncate">{p.adSetA.name}</td>
                        <td className="px-3 py-2 text-foreground max-w-[140px] truncate">{p.adSetB.name}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(p.intersectionReach)}</td>
                        <td className={cn('px-3 py-2 text-right font-700', overlapColor(p.overlapPctA))}>{p.overlapPctA}%</td>
                        <td className={cn('px-3 py-2 text-right font-700', overlapColor(p.overlapPctB))}>{p.overlapPctB}%</td>
                        <td className="px-3 py-2 text-center"><OverlapLevelBadge pct={maxPct} /></td>
                        <td className="px-3 py-2 text-center">{confidenceBadge(p.confidence)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VENN VIEW */}
          {view === 'venn' && (
            <div className="space-y-3">
              {latest.pairList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">No pairs to display.</p>
              ) : (
                <div className="space-y-4">
                  {latest.pairList.map((p, i) => (
                    <div key={i} className="space-y-1">
                      {/* Pair label */}
                      <p className="text-[10px] text-muted-foreground font-600 px-1">
                        {p.adSetA.name} &lt;→&gt; {p.adSetB.name}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Left: A's perspective — what % of A's audience overlaps with B */}
                        <div>
                          <p className="text-[9px] text-muted-foreground text-center mb-1">
                            <span className="text-[rgba(0,190,239,0.9)] font-600">{p.adSetA.name.length > 16 ? p.adSetA.name.slice(0, 15) + '…' : p.adSetA.name}</span>'s audience
                          </p>
                          <VennDiagram
                            pair={{
                              nameA: p.adSetA.name,
                              nameB: p.adSetB.name,
                              pct: p.overlapPctA,
                              confidence: p.confidence,
                              intersectionReach: p.intersectionReach,
                            }}
                          />
                        </div>
                        {/* Right: B's perspective — what % of B's audience overlaps with A */}
                        <div>
                          <p className="text-[9px] text-muted-foreground text-center mb-1">
                            <span className="text-[rgba(237,19,95,0.9)] font-600">{p.adSetB.name.length > 16 ? p.adSetB.name.slice(0, 15) + '…' : p.adSetB.name}</span>'s audience
                          </p>
                          <VennDiagram
                            pair={{
                              nameA: p.adSetB.name,
                              nameB: p.adSetA.name,
                              pct: p.overlapPctB,
                              confidence: p.confidence,
                              intersectionReach: p.intersectionReach,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
  const [overlapRunning, setOverlapRunning] = useState(false);
  const overlapPanelRef = useRef<{ runOverlap: (targetRows: AdSetRow[]) => Promise<void> } | null>(null);

  const builderOverlap = trpc.adminMeta.builderAudienceOverlap.useMutation();

  const handleRunOverlapFromReach = useCallback(async (selectedIds: string[]) => {
    if (!settings?.accessToken || !settings?.adAccountId) return;
    const targetRows = rows.filter(r => selectedIds.includes(r.id));
    if (targetRows.length < 2) return;
    setOverlapRunning(true);
    try {
      const adSets = targetRows.map(row => ({
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
      onOverlapHistoryChange([run, ...overlapHistory].slice(0, 10));
      // Switch to overlap tab
      setActive('overlap');
    } catch (err) {
      console.error('Overlap from reach failed:', err);
    } finally {
      setOverlapRunning(false);
    }
  }, [rows, settings, overlapHistory, onOverlapHistoryChange, builderOverlap]);

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

      {active && (
        <div className="fixed inset-0 z-40 pointer-events-none" />
      )}
    </div>
  );
}

// Export sub-panels for use in AdSetsTable
export { ReachEstimatePanel, AudienceOverlapPanel };
