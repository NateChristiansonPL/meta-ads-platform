/**
 * AudienceOverlapPanel
 * Runs audience overlap analysis against live active ad sets in the account.
 * Shown in the Export & Launch tab.
 * Per skill guidance: only runs on ACTIVE ad sets, deduplicates pairs, no 100% overlap from identical audiences.
 */

import { useState } from 'react';
import { Users, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BuildSettings } from '@/lib/campaignStore';
import { cn } from '@/lib/utils';

interface Props {
  settings: BuildSettings;
}

function overlapColor(pct: number): string {
  if (pct >= 60) return 'text-red-400';
  if (pct >= 30) return 'text-amber-400';
  return 'text-emerald-400';
}

function overlapBg(pct: number): string {
  if (pct >= 60) return 'bg-red-500/10 border-red-500/20';
  if (pct >= 30) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-emerald-500/10 border-emerald-500/20';
}

function formatReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function AudienceOverlapPanel({ settings }: Props) {
  const [campaignId, setCampaignId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const hasCredentials = !!(settings.accessToken && settings.adAccountId);

  const { data, isLoading, error, refetch } = trpc.meta.getAudienceOverlap.useQuery(
    {
      accessToken: settings.accessToken,
      adAccountId: settings.adAccountId,
      campaignId: campaignId || undefined,
    },
    {
      enabled: enabled && hasCredentials,
      staleTime: 5 * 60 * 1000,
    }
  );

  const pairs = data?.pairs ?? [];
  const adSets = data?.adSets ?? [];
  const message = data?.message;
  const displayPairs = showAll ? pairs : pairs.slice(0, 10);
  const highOverlap = pairs.filter(p => p.overlapPct >= 60).length;
  const medOverlap = pairs.filter(p => p.overlapPct >= 30 && p.overlapPct < 60).length;

  return (
    <div className="border border-border rounded-xl bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/30">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          <span className="text-sm font-700 text-foreground">Audience Overlap Analysis</span>
          <span className="text-[10px] text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded-full border border-border">
            Active ad sets only
          </span>
        </div>
        {enabled && (
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {!hasCredentials && (
          <p className="text-[12px] text-amber-400 flex items-center gap-2">
            <AlertTriangle size={13} />
            Add credentials in Settings to run overlap analysis.
          </p>
        )}

        {hasCredentials && (
          <>
            {/* Controls */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">
                  Filter by Campaign ID (optional)
                </label>
                <input
                  value={campaignId}
                  onChange={e => setCampaignId(e.target.value)}
                  placeholder="Leave blank to analyze all active ad sets"
                  className="w-full px-3 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                />
              </div>
              <button
                onClick={() => { setEnabled(true); if (enabled) refetch(); }}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-700 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 whitespace-nowrap">
                {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Users size={12} />}
                {isLoading ? 'Analyzing…' : 'Run Analysis'}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[12px] text-red-400">
                <AlertTriangle size={13} />
                {error.message}
              </div>
            )}

            {/* Message (e.g. not enough ad sets) */}
            {message && !error && (
              <p className="text-[12px] text-muted-foreground">{message}</p>
            )}

            {/* Summary stats */}
            {pairs.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-2/50 rounded-lg px-3 py-2 border border-border">
                  <div className="text-lg font-800 text-foreground leading-none">{adSets.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Active Ad Sets</div>
                </div>
                <div className={cn('rounded-lg px-3 py-2 border', highOverlap > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-surface-2/50 border-border')}>
                  <div className={cn('text-lg font-800 leading-none', highOverlap > 0 ? 'text-red-400' : 'text-foreground')}>{highOverlap}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">High Overlap Pairs (≥60%)</div>
                </div>
                <div className={cn('rounded-lg px-3 py-2 border', medOverlap > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-surface-2/50 border-border')}>
                  <div className={cn('text-lg font-800 leading-none', medOverlap > 0 ? 'text-amber-400' : 'text-foreground')}>{medOverlap}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Medium Overlap Pairs (30–59%)</div>
                </div>
              </div>
            )}

            {/* Pairs table */}
            {pairs.length > 0 && (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_80px_80px_80px] gap-2 px-2 py-1">
                  <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider">Ad Set A</span>
                  <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider">Ad Set B</span>
                  <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider text-right">Reach A</span>
                  <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider text-right">Reach B</span>
                  <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider text-right">Overlap</span>
                </div>
                {displayPairs.map((pair, i) => (
                  <div key={i} className={cn('grid grid-cols-[1fr_1fr_80px_80px_80px] gap-2 px-2 py-1.5 rounded-lg border text-[11px]', overlapBg(pair.overlapPct))}>
                    <span className="text-foreground truncate" title={pair.adSetA.name}>{pair.adSetA.name}</span>
                    <span className="text-foreground truncate" title={pair.adSetB.name}>{pair.adSetB.name}</span>
                    <span className="text-right text-muted-foreground font-mono">{formatReach(pair.reachA)}</span>
                    <span className="text-right text-muted-foreground font-mono">{formatReach(pair.reachB)}</span>
                    <span className={cn('text-right font-800 font-mono', overlapColor(pair.overlapPct))}>
                      {pair.overlapPct}%
                    </span>
                  </div>
                ))}
                {pairs.length > 10 && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1">
                    {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showAll ? 'Show less' : `Show all ${pairs.length} pairs`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
