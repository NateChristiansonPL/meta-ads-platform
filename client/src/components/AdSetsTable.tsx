// AdSetsTable.tsx — Precision Tool Dark
// Bulk-entry spreadsheet for ad sets with:
//  - Status at front (button group)
//  - Single-expansion accordion panels (Location, Audience, Optional Fields, Day Parting)
//  - Outside-click to close panels
//  - Frequency Control: mandatory for Reach/Ad Recall, optional for ThruPlay/2-sec, billing choice for ThruPlay/2-sec
//  - Updated placements: Threads, updated FB/IG, no defaults
//  - Engagement objective: On Ad / IG+FB Combined conversion locations, Page Visits/Page Likes opt goals
//  - Audience restructure: Detailed Interests, Narrow Interests, Targeted Custom/LAL, Excluded Custom/LAL
//  - Day Parting: 3-hour increments, bolder grid lines, 50% larger cells

import React, { useRef, KeyboardEvent, useState, useCallback, useEffect } from 'react';
import {
  Plus, Copy, Trash2, ChevronDown, ChevronUp, SlidersHorizontal,
  MapPin, Users, Clock, X, Check, Info,
} from 'lucide-react';
import {
  AdSetRow, CampaignRow, FrequencyControl,
  newAdSet, genId,
  OBJECTIVE_OPT_GOALS, OPTIMIZATION_GOAL_LABELS, OBJECTIVES,
  CONVERSION_LOCATIONS, PLATFORM_PLACEMENTS, TREE_FIELDS, LANGUAGE_OPTIONS,
  SCHEDULE_DAYS, SCHEDULE_HOURS, SCHEDULE_HOUR_LABELS,
  defaultOptGoal, attributionApplicable, frequencyControlApplicable,
  frequencyControlMandatory, frequencyControlMaxTimes,
  billingChoiceApplicable, billingChoiceOptions,
  conversionEventApplicable, leadGenApplicable, sacRestrictsTargeting,
  engagementGoalApplicable, fbPageRequiredAtAdSet,
  ReachEstimateRun, OverlapRun,
} from '@/lib/campaignStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { trpc } from '@/lib/trpc';
import { BuildSettings } from '@/lib/campaignStore';
import { ReachEstimatePanel, AudienceOverlapPanel } from '@/components/BuilderReachOverlapPanel';

interface Props {
  rows: AdSetRow[];
  campaigns: CampaignRow[];
  onChange: (rows: AdSetRow[]) => void;
  settings?: BuildSettings;
  reachHistory: ReachEstimateRun[];
  overlapHistory: OverlapRun[];
  onReachHistoryChange: (h: ReachEstimateRun[]) => void;
  onOverlapHistoryChange: (h: OverlapRun[]) => void;
}

type PanelType = 'targeting' | 'optional' | 'dayparting';
type AudienceFocus = 'location' | 'interests' | 'custom';

// ── Small helpers ─────────────────────────────────────────────────────────────
function Th({ children, required, muted, className }: {
  children?: React.ReactNode; required?: boolean; muted?: boolean; className?: string;
}) {
  return (
    <th className={cn(
      'px-2 py-2 text-left text-[10px] font-700 tracking-wider border-r border-border whitespace-nowrap sticky top-0 bg-surface-1 z-10',
      muted ? 'text-muted-foreground/50' : 'text-muted-foreground',
      className
    )}>
      {children}{required && <span className="text-primary ml-0.5">*</span>}
    </th>
  );
}

function BtnGroup<T extends string>({
  options, value, onChange, small,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2 rounded transition-all border font-600 whitespace-nowrap',
            small ? 'py-0.5 text-[10px]' : 'py-1 text-[11px]',
            value === opt.value
              ? opt.color === 'green'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : opt.color === 'red'
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : opt.color === 'amber'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CellInput({
  value, onChange, placeholder, className, onKeyDown, type = 'text', readOnly,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  className?: string; onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  type?: string; readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={cn(
        'cell-input w-full h-full px-2 py-1.5 text-[12px] bg-transparent border-0 outline-none',
        'placeholder:text-muted-foreground/30 focus:bg-surface-2/40',
        readOnly && 'opacity-50 cursor-not-allowed',
        className
      )}
    />
  );
}

function PlacementSummary({ row, onClick }: { row: AdSetRow; onClick: () => void }) {
  const fbCount = row.placements.filter(p => p.startsWith('facebook')).length;
  const igCount = row.placements.filter(p => p.startsWith('instagram')).length;
  const threadsCount = row.placements.filter(p => p.startsWith('threads')).length;
  const otherCount = row.placements.filter(p =>
    !p.startsWith('facebook') && !p.startsWith('instagram') && !p.startsWith('threads')
  ).length;

  if (row.placementType === 'advantage_plus') {
    return (
      <button onClick={onClick}
        className="flex items-center gap-1 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors">
        <span className="text-[10px] font-600 text-emerald-400">Advantage+</span>
      </button>
    );
  }

  if (row.placements.length === 0) {
    return (
      <button onClick={onClick}
        className="flex items-center gap-1 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors">
        <span className="text-[10px] text-muted-foreground/40">Select placements…</span>
      </button>
    );
  }

  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors flex-wrap">
      {fbCount > 0 && <span className="text-[10px] font-600 text-blue-400">FB:{fbCount}</span>}
      {igCount > 0 && <span className="text-[10px] font-600 text-pink-400">IG:{igCount}</span>}
      {threadsCount > 0 && <span className="text-[10px] font-600 text-purple-400">TH:{threadsCount}</span>}
      {otherCount > 0 && <span className="text-[10px] font-600 text-muted-foreground">+{otherCount}</span>}
    </button>
  );
}

// ── Placement Picker Popover ──────────────────────────────────────────────────
function PlacementPicker({ row, onChange, onClose }: {
  row: AdSetRow;
  onChange: (updates: Partial<AdSetRow>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const togglePlatform = (p: string) => {
    const next = row.platforms.includes(p)
      ? row.platforms.filter(x => x !== p)
      : [...row.platforms, p];
    // Remove placements for deselected platform
    const nextPlacements = row.placements.filter(pl => next.some(np => pl.startsWith(np)));
    onChange({ platforms: next, placements: nextPlacements });
  };

  const togglePlacement = (key: string) => {
    const next = row.placements.includes(key)
      ? row.placements.filter(x => x !== key)
      : [...row.placements, key];
    onChange({ placements: next });
  };

  const allPlatforms = Object.keys(PLATFORM_PLACEMENTS);

  return (
    <div ref={ref}
      className="absolute z-50 top-full left-0 mt-1 w-72 bg-surface-1 border border-border rounded-lg shadow-2xl p-3 space-y-3">
      {/* Advantage+ toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-600 text-muted-foreground">Placement Type</span>
        <div className="flex gap-1">
          {(['advantage_plus', 'manual'] as const).map(t => (
            <button key={t} onClick={() => onChange({ placementType: t, placements: t === 'advantage_plus' ? [] : row.placements })}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-600 border transition-all',
                row.placementType === t
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
              )}>
              {t === 'advantage_plus' ? 'Advantage+' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {row.placementType === 'manual' && (
        <>
          {/* Platform selector */}
          <div>
            <p className="text-[10px] font-700 text-muted-foreground mb-1.5 tracking-wider uppercase">Platforms</p>
            <div className="flex flex-wrap gap-1">
              {allPlatforms.map(p => (
                <button key={p} onClick={() => togglePlatform(p)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-600 border transition-all capitalize',
                    row.platforms.includes(p)
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                  )}>
                  {p === 'audience_network' ? 'Audience Network' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Placement checkboxes per selected platform */}
          {row.platforms.map(platform => (
            <div key={platform}>
              <p className="text-[10px] font-700 text-muted-foreground mb-1.5 tracking-wider uppercase">
                {platform === 'audience_network' ? 'Audience Network' : platform.charAt(0).toUpperCase() + platform.slice(1)}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {(PLATFORM_PLACEMENTS[platform] || []).map(pl => (
                  <button key={pl.key} onClick={() => togglePlacement(pl.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-all text-left',
                      row.placements.includes(pl.key)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                    )}>
                    <div className={cn(
                      'w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0',
                      row.placements.includes(pl.key) ? 'bg-primary border-primary' : 'border-border'
                    )}>
                      {row.placements.includes(pl.key) && <Check size={8} className="text-white" />}
                    </div>
                    {pl.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <button onClick={onClose}
        className="w-full py-1.5 rounded bg-primary/10 border border-primary/30 text-primary text-[11px] font-600 hover:bg-primary/20 transition-colors">
        Done
      </button>
    </div>
  );
}

// ── Frequency Control Panel ───────────────────────────────────────────────────
function FrequencyControlPanel({ row, goal, onChange }: {
  row: AdSetRow;
  goal: string;
  onChange: (fc: FrequencyControl | undefined) => void;
}) {
  const optGoal = goal as import('@/lib/campaignStore').OptimizationGoal;
  const mandatory = frequencyControlMandatory(optGoal);
  const maxTimes = frequencyControlMaxTimes(optGoal);
  const fc = row.frequencyControl;

  const defaultFc = (): FrequencyControl => ({
    mode: optGoal === 'REACH' ? 'target' : 'default',
    times: optGoal === 'REACH' ? 1 : 3,
    days: 7,
    enabled: true,
  });

  const enabled = fc?.enabled ?? mandatory;

  if (!mandatory && !enabled) {
    return (
      <div className="flex items-center gap-2 p-2">
        <span className="text-[11px] text-muted-foreground">Frequency Control</span>
        <button onClick={() => onChange({ ...defaultFc(), enabled: true })}
          className="px-2 py-0.5 rounded text-[10px] font-600 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
          Enable
        </button>
      </div>
    );
  }

  const update = (updates: Partial<FrequencyControl>) => {
    onChange({ ...(fc ?? defaultFc()), ...updates });
  };

  return (
    <div className="p-3 space-y-2 bg-surface-2/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-600 text-foreground">
          Frequency Control {mandatory && <span className="text-amber-400 text-[10px]">(Required)</span>}
        </span>
        {!mandatory && (
          <button onClick={() => onChange(undefined)}
            className="text-muted-foreground hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Mode selector for Reach */}
      {optGoal === 'REACH' && (
        <div className="flex gap-1">
          {(['target', 'cap'] as const).map(m => (
            <button key={m} onClick={() => update({ mode: m })}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-600 border transition-all capitalize',
                (fc?.mode ?? 'target') === m
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
              )}>
              {m === 'target' ? 'Target Frequency' : 'Frequency Cap'}
            </button>
          ))}
        </div>
      )}

      {/* Mode selector for Ad Recall */}
      {optGoal === 'AD_RECALL_LIFT' && (
        <div className="flex gap-1">
          {(['default', 'custom'] as const).map(m => (
            <button key={m} onClick={() => update({ mode: m })}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-600 border transition-all capitalize',
                (fc?.mode ?? 'default') === m
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
              )}>
              {m === 'default' ? 'Default' : 'Custom'}
            </button>
          ))}
        </div>
      )}

      {/* Times + Days inputs */}
      {(optGoal !== 'AD_RECALL_LIFT' || (fc?.mode ?? 'default') === 'custom') && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Max</span>
            <input
              type="number" min={1} max={maxTimes}
              value={fc?.times ?? (optGoal === 'REACH' ? 1 : 3)}
              onChange={e => update({ times: parseInt(e.target.value) || 1 })}
              className="w-12 px-1.5 py-0.5 text-[11px] bg-surface-2 border border-border rounded text-center"
            />
            <span className="text-[10px] text-muted-foreground">times per</span>
            <input
              type="number" min={2} max={7}
              value={fc?.days ?? 7}
              onChange={e => update({ days: parseInt(e.target.value) || 7 })}
              className="w-10 px-1.5 py-0.5 text-[11px] bg-surface-2 border border-border rounded text-center"
            />
            <span className="text-[10px] text-muted-foreground">days</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Day Parting Grid — 3-hour increments ─────────────────────────────────────
function DayPartingGrid({ value, onChange }: {
  value: string; // JSON: { Mon: [0,3,6,...], Tue: [...], ... }
  onChange: (v: string) => void;
}) {
  const parseSchedule = (): Record<string, number[]> => {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  };

  const schedule = parseSchedule();
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');

  const isActive = (day: string, hour: number) => (schedule[day] || []).includes(hour);

  const toggle = (day: string, hour: number, mode?: 'add' | 'remove') => {
    const current = schedule[day] || [];
    const m = mode ?? (current.includes(hour) ? 'remove' : 'add');
    const next = m === 'add'
      ? Array.from(new Set([...current, hour])).sort((a, b) => a - b)
      : current.filter(h => h !== hour);
    const newSchedule = { ...schedule, [day]: next };
    onChange(JSON.stringify(newSchedule));
  };

  const toggleDay = (day: string) => {
    const allHours = SCHEDULE_HOURS;
    const current = schedule[day] || [];
    const allActive = allHours.every(h => current.includes(h));
    const next = allActive ? [] : [...allHours];
    onChange(JSON.stringify({ ...schedule, [day]: next }));
  };

  const toggleHour = (hour: number) => {
    const allActive = SCHEDULE_DAYS.every(d => (schedule[d] || []).includes(hour));
    const newSchedule = { ...schedule };
    SCHEDULE_DAYS.forEach(d => {
      const current = newSchedule[d] || [];
      newSchedule[d] = allActive ? current.filter(h => h !== hour) : Array.from(new Set([...current, hour])).sort((a, b) => a - b);
    });
    onChange(JSON.stringify(newSchedule));
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-600 text-foreground">Day Parting</span>
        <button onClick={() => onChange('')}
          className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
          Clear All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="w-8 h-8" />
              {SCHEDULE_HOURS.map(hour => (
                <th key={hour}
                  className="w-6 h-7 text-center text-muted-foreground font-600 cursor-pointer hover:text-foreground border border-border/20 transition-colors"
                  style={{ minWidth: 22 }}
                  onClick={() => toggleHour(hour)}>
                  {SCHEDULE_HOUR_LABELS[hour] || ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_DAYS.map(day => (
              <tr key={day}>
                <td
                  className="w-8 h-9 text-center text-muted-foreground font-600 cursor-pointer hover:text-foreground border border-border/30 transition-colors pr-1"
                  onClick={() => toggleDay(day)}>
                  {day}
                </td>
                {SCHEDULE_HOURS.map(hour => (
                  <td
                    key={hour}
                    className={cn(
                      'w-10 h-9 border border-border/40 cursor-pointer transition-colors',
                      isActive(day, hour)
                        ? 'bg-primary/40 hover:bg-primary/60 border-primary/40'
                        : 'bg-surface-2/20 hover:bg-surface-2/60'
                    )}
                    onMouseDown={() => {
                      setDragging(true);
                      const mode = isActive(day, hour) ? 'remove' : 'add';
                      setDragMode(mode);
                      toggle(day, hour, mode);
                    }}
                    onMouseEnter={() => {
                      if (dragging) toggle(day, hour, dragMode);
                    }}
                    onMouseUp={() => setDragging(false)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdSetsTable({ rows, campaigns, onChange, settings, reachHistory, overlapHistory, onReachHistoryChange, onOverlapHistoryChange }: Props) {
  const utils = trpc.useUtils();
  const [activeAnalysisPanel, setActiveAnalysisPanel] = useState<'reach' | 'overlap' | null>(null);
  const hasCredentials = !!(settings?.accessToken && settings?.adAccountId);
  const hasPixel = !!(settings?.pixelId && hasCredentials);

  // ── Live API: pixel events ─────────────────────────────────────────────────
  const { data: pixelEventsData } = trpc.meta.getPixelEvents.useQuery(
    { accessToken: settings?.accessToken ?? '', pixelId: settings?.pixelId ?? '', adAccountId: settings?.adAccountId ?? '' },
    { enabled: hasPixel, staleTime: 5 * 60 * 1000 }
  );
  const rawPixelEvents = pixelEventsData?.events ?? [];
  const customConversions: { id: string; name: string }[] = (pixelEventsData as { customConversions?: { id: string; name: string }[] })?.customConversions ?? [];
  const conversionsApiEvents = new Set((pixelEventsData as { conversionsApiEvents?: string[] })?.conversionsApiEvents ?? []);
  // Filter out standard events that duplicate a custom conversion (by name) to avoid showing them twice
  const customConversionNames = new Set(customConversions.map(cc => cc.name));
  const pixelEvents = rawPixelEvents.filter((ev: string) => !customConversionNames.has(ev));

  // ── Live API: custom audiences ─────────────────────────────────────────────
  const [audienceSearch, setAudienceSearch] = useState('');
  const { data: customAudiencesData, isLoading: loadingAudiences } = trpc.meta.getCustomAudiences.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', search: audienceSearch || undefined },
    { enabled: hasCredentials && audienceSearch.trim().length > 0, staleTime: 2 * 60 * 1000 }
  );
  const { data: savedAudiencesData } = trpc.meta.getSavedAudiences.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '' },
    { enabled: hasCredentials, staleTime: 2 * 60 * 1000 }
  );
  const customAudiences = customAudiencesData?.audiences ?? [];
  const savedAudiences = savedAudiencesData?.audiences ?? [];

  // ── Live API: location search ──────────────────────────────────────────────
  const [locationQuery, setLocationQuery] = useState('');
  const [locationRowId, setLocationRowId] = useState<string | null>(null);
  const { data: locationResults, isFetching: searchingLocations } = trpc.meta.searchGeoLocations.useQuery(
    {
      accessToken: settings?.accessToken ?? '',
      query: locationQuery,
      location_types: ['city', 'region', 'country', 'zip'],
    },
    { enabled: hasCredentials && locationQuery.length >= 2, staleTime: 60 * 1000 }
  );
  // ── Live API: detailed targeting search ─────────────────────────────────
  const [detailedQuery, setDetailedQuery] = useState('');
  const [detailedRowId, setDetailedRowId] = useState<string | null>(null);
  const [detailedType, setDetailedType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const [narrowQuery, setNarrowQuery] = useState('');
  const [narrowRowId, setNarrowRowId] = useState<string | null>(null);
  const [narrowType, setNarrowType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const { data: detailedResults, isFetching: searchingDetailed } = trpc.meta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: detailedQuery, type: detailedType },
    { enabled: hasCredentials && detailedQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const { data: narrowResults, isFetching: searchingNarrow } = trpc.meta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: narrowQuery, type: narrowType },
    { enabled: hasCredentials && narrowQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const [expandedPanel, setExpandedPanel] = useState<{ rowId: string; panel: PanelType } | null>(null);
  const [audienceFocus, setAudienceFocus] = useState<AudienceFocus>('interests');
  const [openPlacement, setOpenPlacement] = useState<string | null>(null);
  const [activeOptFields, setActiveOptFields] = useState<Record<string, Set<string>>>({});
  const [bulkLocModal, setBulkLocModal] = useState<{ rowId: string } | null>(null);
  const [bulkLocText, setBulkLocText] = useState('');
  const [bulkLocType, setBulkLocType] = useState<'city' | 'region' | 'country' | 'zip'>('city');
  const [bulkLocMatching, setBulkLocMatching] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Close panels on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setExpandedPanel(null);
        setOpenPlacement(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const update = useCallback((id: string, updates: Partial<AdSetRow>) => {
    onChange(rows.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [rows, onChange]);

  const addRow = () => {
    const lastCampaign = rows.length > 0 ? rows[rows.length - 1].campaignName : '';
    const campaignRows = rows.filter(r => r.campaignName === lastCampaign);
    const nextNum = campaignRows.length + 1;
    onChange([...rows, newAdSet({
      campaignName: lastCampaign,
      name: `Ad Set #${nextNum}`,
    })]);
  };

  const duplicateRow = (row: AdSetRow) => {
    const campaignRows = rows.filter(r => r.campaignName === row.campaignName);
    const nextNum = campaignRows.length + 1;
    onChange([...rows, {
      ...row,
      id: genId(),
      name: `Ad Set #${nextNum}`,
      adSetId: '',
    }]);
  };

  const deleteRow = (id: string) => {
    if (rows.length <= 1) { toast.error('Need at least one ad set'); return; }
    onChange(rows.filter(r => r.id !== id));
  };

  const togglePanel = (rowId: string, panel: PanelType) => {
    setExpandedPanel(prev => {
      if (prev?.rowId === rowId && prev?.panel === panel) return null;
      if (panel === 'targeting') setAudienceFocus('location');
      return { rowId, panel };
    });
  };

  const getOptFields = (rowId: string) => activeOptFields[rowId] ?? new Set<string>();

  const addOptField = (rowId: string, key: string) => {
    setActiveOptFields(prev => ({
      ...prev,
      [rowId]: new Set([...Array.from(prev[rowId] ?? []), key]),
    }));
  };

  const removeOptField = (rowId: string, key: string) => {
    setActiveOptFields(prev => {
      const next = new Set(prev[rowId] ?? []);
      next.delete(key);
      return { ...prev, [rowId]: next };
    });
  };

  const getCampaignObjective = (campaignName: string) => {
    return campaigns.find(c => c.name === campaignName)?.objective;
  };

  const getCampaignSAC = (campaignName: string) => {
    return campaigns.find(c => c.name === campaignName)?.specialAdCategory ?? 'NONE';
  };

  return (
    <div ref={tableRef} className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-1/80">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-700 text-muted-foreground tracking-wider uppercase">Ad Sets</span>
          <span className="text-[10px] text-muted-foreground/50 bg-surface-2 px-1.5 py-0.5 rounded font-mono">{rows.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Reach Estimate button */}
          <button
            onClick={() => setActiveAnalysisPanel(p => p === 'reach' ? null : 'reach')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
              activeAnalysisPanel === 'reach'
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
            )}>
            <SlidersHorizontal size={12} />
            Reach Estimate
            {reachHistory.length > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">{reachHistory.length}</span>
            )}
          </button>
          {/* Audience Overlap button */}
          <button
            onClick={() => setActiveAnalysisPanel(p => p === 'overlap' ? null : 'overlap')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
              activeAnalysisPanel === 'overlap'
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
            )}>
            <Users size={12} />
            Audience Overlap
            {overlapHistory.length > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">{overlapHistory.length}</span>
            )}
          </button>
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-[11px] font-600 hover:bg-primary/20 transition-colors">
            <Plus size={12} /> Add Ad Set
          </button>
        </div>
      </div>

      {/* Analysis panels */}
      {activeAnalysisPanel === 'reach' && (
        <div className="px-4 py-4 border-b border-border bg-surface-1/60">
          <ReachEstimatePanel
            rows={rows}
            settings={settings}
            history={reachHistory}
            onHistoryChange={onReachHistoryChange}
          />
        </div>
      )}
      {activeAnalysisPanel === 'overlap' && (
        <div className="px-4 py-4 border-b border-border bg-surface-1/60">
          <AudienceOverlapPanel
            rows={rows}
            settings={settings}
            history={overlapHistory}
            onHistoryChange={onOverlapHistoryChange}
          />
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 1400 }}>
          <thead>
            <tr className="border-b border-border">
              <Th className="w-8" />
              <Th required>Status</Th>
              <Th required>Campaign</Th>
              <Th required>Ad Set Name</Th>
              <Th required>Budget</Th>
              <Th required>Start</Th>
              <Th required>End</Th>
              <Th required>Opt Goal</Th>
              <Th>Conv. Location</Th>
              <Th required>Placements</Th>
              <Th>Age</Th>
              <Th>Gender</Th>
              <Th>Targeting</Th>
              <Th>Optional Fields</Th>
              <Th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const objective = getCampaignObjective(row.campaignName);
              const sac = getCampaignSAC(row.campaignName);
              const sacRestricted = sacRestrictsTargeting(sac);
              const validGoals = objective ? OBJECTIVE_OPT_GOALS[objective] : Object.keys(OPTIMIZATION_GOAL_LABELS) as import('@/lib/campaignStore').OptimizationGoal[];
              const showFreqControl = frequencyControlApplicable(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal);
              const freqMandatory = frequencyControlMandatory(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal);
              const showBillingChoice = billingChoiceApplicable(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal);
              const showConvEvent = conversionEventApplicable(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal);
              const showLeadGen = leadGenApplicable(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal);
              const showEngagementGoal = engagementGoalApplicable(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal);
              const isExpanded = expandedPanel?.rowId === row.id;
              const optFields = getOptFields(row.id);

              // Conversion locations filtered by objective
              const validConvLocs = CONVERSION_LOCATIONS.filter(cl =>
                !cl.objectives || (objective && cl.objectives.includes(objective))
              );

              return (
                <React.Fragment key={row.id}>
                  <tr
                    className={cn(
                      'border-b border-border/50 hover:bg-surface-2/20 transition-colors group',
                      isExpanded && 'bg-surface-2/30'
                    )}>
                    {/* Row number */}
                    <td className="px-2 py-1 text-center text-[10px] text-muted-foreground/40 border-r border-border/30 font-mono">
                      {idx + 1}
                    </td>

                    {/* Status */}
                    <td className="border-r border-border/30 p-0 min-w-[100px]">
                      <BtnGroup
                        options={[
                          { value: 'ACTIVE', label: 'Active', color: 'green' },
                          { value: 'PAUSED', label: 'Paused', color: 'red' },
                        ]}
                        value={row.status}
                        onChange={v => update(row.id, { status: v as 'ACTIVE' | 'PAUSED' })}
                      />
                    </td>

                    {/* Campaign */}
                    <td className="border-r border-border/30 p-0 min-w-[160px]">
                      <select
                        value={row.campaignName}
                        onChange={e => {
                          const newCampaign = e.target.value;
                          const campaignRows = rows.filter(r => r.campaignName === newCampaign);
                          const nextNum = campaignRows.length + 1;
                          update(row.id, {
                            campaignName: newCampaign,
                            name: `Ad Set #${nextNum}`,
                            optimizationGoal: objective ? defaultOptGoal(objective) : row.optimizationGoal,
                          });
                        }}
                        className="cell-input w-full h-full px-2 py-1.5 text-[12px] bg-transparent border-0 outline-none focus:bg-surface-2/40"
                      >
                        <option value="">Select campaign…</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.name}>{c.name || `Campaign ${c.id.slice(0, 4)}`}</option>
                        ))}
                      </select>
                    </td>

                    {/* Ad Set Name */}
                    <td className="border-r border-border/30 p-0 min-w-[180px]">
                      <CellInput
                        value={row.name}
                        onChange={v => update(row.id, { name: v })}
                        placeholder="Ad Set #1"
                      />
                    </td>

                    {/* Budget */}
                    <td className="border-r border-border/30 p-0 min-w-[160px]">
                      <div className="flex items-center">
                        <BtnGroup
                          options={[
                            { value: 'LIFETIME', label: 'LT' },
                            { value: 'DAILY', label: 'Daily' },
                          ]}
                          value={row.budgetType}
                          onChange={v => update(row.id, { budgetType: v as 'LIFETIME' | 'DAILY' })}
                          small
                        />
                        <div className="flex items-center gap-0.5 px-1">
                          <span className="text-muted-foreground/50 text-[11px]">$</span>
                          <CellInput
                            value={row.budget}
                            onChange={v => update(row.id, { budget: v })}
                            placeholder="0.00"
                            type="number"
                            className="w-20"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Start date */}
                    <td className="border-r border-border/30 p-0 min-w-[130px]">
                      <div className="flex flex-col">
                        <input type="date" value={row.startDate}
                          onChange={e => update(row.id, { startDate: e.target.value })}
                          className="cell-input px-2 py-1 text-[11px] bg-transparent border-0 outline-none w-full" />
                        <input type="time" value={row.startTime}
                          onChange={e => update(row.id, { startTime: e.target.value })}
                          className="cell-input px-2 py-0.5 text-[10px] bg-transparent border-0 outline-none w-full text-muted-foreground" />
                      </div>
                    </td>

                    {/* End date */}
                    <td className="border-r border-border/30 p-0 min-w-[130px]">
                      <div className="flex flex-col">
                        <input type="date" value={row.endDate}
                          onChange={e => update(row.id, { endDate: e.target.value })}
                          className="cell-input px-2 py-1 text-[11px] bg-transparent border-0 outline-none w-full" />
                        <input type="time" value={row.endTime}
                          onChange={e => update(row.id, { endTime: e.target.value })}
                          className="cell-input px-2 py-0.5 text-[10px] bg-transparent border-0 outline-none w-full text-muted-foreground" />
                      </div>
                    </td>

                    {/* Optimization Goal */}
                    <td className="border-r border-border/30 p-0 min-w-[200px]">
                      <div className="space-y-0.5">
                        <select
                          value={row.optimizationGoal}
                          onChange={e => {
                            const goal = e.target.value as import('@/lib/campaignStore').OptimizationGoal;
                            const updates: Partial<AdSetRow> = { optimizationGoal: goal };
                            // Auto-clear frequency control if no longer applicable
                            if (!frequencyControlApplicable(goal)) {
                              updates.frequencyControl = undefined;
                            }
                            update(row.id, updates);
                          }}
                          className="cell-input w-full px-2 py-1.5 text-[12px] bg-transparent border-0 outline-none focus:bg-surface-2/40"
                        >
                          {validGoals.map(g => (
                            <option key={g} value={g}>{OPTIMIZATION_GOAL_LABELS[g]}</option>
                          ))}
                        </select>

                        {/* Billing choice for ThruPlay / 2-sec */}
                        {showBillingChoice && (
                          <div className="px-2 pb-1">
                            <select
                              value={row.billingChoice ?? 'IMPRESSIONS'}
                              onChange={e => update(row.id, { billingChoice: e.target.value })}
                              className="w-full text-[10px] bg-surface-2/50 border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground"
                            >
                              {billingChoiceOptions(row.optimizationGoal as import('@/lib/campaignStore').OptimizationGoal).map(o => (
                                <option key={o.value} value={o.value}>Billed by: {o.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Conversion event */}
                        {showConvEvent && (
                          <div className="px-2 pb-1">
                            {(pixelEvents.length > 0 || customConversions.length > 0) ? (
                              <select
                                value={row.customConversionId ? `cc::${row.customConversionId}` : row.conversionEvent}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val.startsWith('cc::')) {
                                    const ccId = val.slice(4);
                                    const cc = customConversions.find(c => c.id === ccId);
                                    update(row.id, { conversionEvent: cc?.name || '', customConversionId: ccId, customConversionRule: (cc as { rule?: string })?.rule || undefined });
                                  } else {
                                    // Standard event selected — check if it matches a custom conversion by name
                                    const matchingCC = customConversions.find(c => c.name === val);
                                    update(row.id, { conversionEvent: val, customConversionId: matchingCC?.id || undefined, customConversionRule: (matchingCC as { rule?: string })?.rule || undefined });
                                  }
                                }}
                                className="w-full px-2 py-1 text-[10px] bg-surface-2/50 border border-border rounded outline-none focus:border-primary/50 text-foreground"
                              >
                                <option value="">Select conversion event…</option>
                                {customConversions.length > 0 && (
                                  <optgroup label="Custom Conversions">
                                    {customConversions.map(cc => (
                                      <option key={`cc-${cc.id}`} value={`cc::${cc.id}`}>{cc.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {pixelEvents.length > 0 && (
                                  <optgroup label="Standard Pixel Events">
                                    {pixelEvents.map((ev: string) => (
                                      <option key={ev} value={ev}>{ev}{conversionsApiEvents.has(ev) ? ' ✓ CAPI' : ''}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            ) : (
                              <CellInput
                                value={row.conversionEvent}
                                onChange={v => update(row.id, { conversionEvent: v })}
                                placeholder={hasPixel ? 'Loading events…' : 'Conversion event…'}
                                className="text-[10px] text-muted-foreground"
                              />
                            )}
                          </div>
                        )}

                        {/* Engagement goal */}
                        {showEngagementGoal && (
                          <div className="px-2 pb-1.5 pt-0.5">
                            <div className="border border-primary/40 rounded-md bg-primary/5 px-2 py-1.5">
                              <label className="text-[9px] font-700 text-primary uppercase tracking-wider block mb-1">Engagement Goal (numeric)</label>
                              <CellInput
                                value={row.engagementGoal ?? ''}
                                onChange={v => update(row.id, { engagementGoal: v })}
                                placeholder="e.g. 500"
                                className="text-[12px] text-foreground font-600"
                              />
                            </div>
                          </div>
                        )}

                        {/* Mandatory frequency control badge */}
                        {freqMandatory && !row.frequencyControl && (
                          <div className="px-2 pb-1">
                            <button
                              onClick={() => {
                                const fc: FrequencyControl = {
                                  mode: row.optimizationGoal === 'REACH' ? 'target' : 'default',
                                  times: row.optimizationGoal === 'REACH' ? 1 : 3,
                                  days: 7,
                                  enabled: true,
                                };
                                update(row.id, { frequencyControl: fc });
                              }}
                              className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                            >
                              <Info size={10} /> Set frequency control (required)
                            </button>
                          </div>
                        )}

                        {/* Frequency control display */}
                        {showFreqControl && row.frequencyControl && (
                          <div className="px-2 pb-1">
                            <span className="text-[10px] text-primary font-600">
                              Freq: {row.frequencyControl.times}× / {row.frequencyControl.days}d
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Conversion Location */}
                    <td className="border-r border-border/30 p-0 min-w-[160px]">
                      <select
                        value={row.conversionLocation}
                        onChange={e => update(row.id, { conversionLocation: e.target.value as import('@/lib/campaignStore').ConversionLocation })}
                        className="cell-input w-full px-2 py-1.5 text-[12px] bg-transparent border-0 outline-none focus:bg-surface-2/40"
                      >
                        {validConvLocs.map(cl => (
                          <option key={cl.value} value={cl.value}>{cl.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Placements */}
                    <td className="border-r border-border/30 p-0 min-w-[120px] relative">
                      <PlacementSummary
                        row={row}
                        onClick={() => setOpenPlacement(openPlacement === row.id ? null : row.id)}
                      />
                      {openPlacement === row.id && (
                        <PlacementPicker
                          row={row}
                          onChange={updates => update(row.id, updates)}
                          onClose={() => setOpenPlacement(null)}
                        />
                      )}
                    </td>

                    {/* Age Range */}
                    <td className="border-r border-border/30 p-0 min-w-[110px]">
                      <div className={cn('flex items-center gap-1 px-2 py-1.5', sacRestricted && 'opacity-40 pointer-events-none')}>
                        <input type="number" min={18} max={65}
                          value={row.ageMin}
                          onChange={e => update(row.id, { ageMin: e.target.value })}
                          className="w-12 px-1.5 py-1 text-[11px] bg-surface-2/50 border border-border/50 rounded text-center cell-input" />
                        <span className="text-muted-foreground text-[10px]">–</span>
                        <input type="number" min={18} max={65}
                          value={row.ageMax}
                          onChange={e => update(row.id, { ageMax: e.target.value })}
                          className="w-12 px-1.5 py-1 text-[11px] bg-surface-2/50 border border-border/50 rounded text-center cell-input" />
                        {sacRestricted && <span className="text-[9px] text-amber-400 ml-1">SAC</span>}
                      </div>
                    </td>

                    {/* Gender */}
                    <td className="border-r border-border/30 p-0 min-w-[120px]">
                      <div className={cn('px-1 py-1', sacRestricted && 'opacity-40 pointer-events-none')}>
                        <BtnGroup
                          options={[
                            { value: 'all', label: 'All' },
                            { value: '1', label: 'M' },
                            { value: '2', label: 'F' },
                          ]}
                          value={row.genders}
                          onChange={v => update(row.id, { genders: v })}
                          small
                        />
                      </div>
                    </td>

                    {/* Unified Targeting expand button */}
                    <td className="border-r border-border/30 p-0 min-w-[130px]">
                      <button
                        onClick={() => togglePanel(row.id, 'targeting')}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors',
                          isExpanded && expandedPanel?.panel === 'targeting' && 'text-primary'
                        )}
                      >
                        <MapPin size={11} className={row.geoLocations ? 'text-primary' : 'text-muted-foreground/40'} />
                        <span className={cn('text-[11px] truncate max-w-[90px]',
                          (row.geoLocations || row.detailedInterests || row.targetedAudiences) ? 'text-foreground' : 'text-muted-foreground/40')}>
                          {[row.geoLocations && 'Loc', row.detailedInterests && 'Int', row.targetedAudiences && 'Aud']
                            .filter(Boolean).join(' · ') || 'Add…'}
                        </span>
                        {isExpanded && expandedPanel?.panel === 'targeting'
                          ? <ChevronUp size={10} className="ml-auto text-muted-foreground" />
                          : <ChevronDown size={10} className="ml-auto text-muted-foreground/40" />}
                      </button>
                    </td>

                    {/* Optional Fields expand button */}
                    <td className="border-r border-border/30 p-0 min-w-[110px]">
                      <button
                        onClick={() => togglePanel(row.id, 'optional')}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors',
                          isExpanded && expandedPanel?.panel === 'optional' && 'text-primary'
                        )}
                      >
                        <SlidersHorizontal size={11} className={optFields.size > 0 ? 'text-primary' : 'text-muted-foreground/40'} />
                        <span className={cn('text-[11px]', optFields.size > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
                          {optFields.size > 0 ? `${optFields.size} active` : 'Add…'}
                        </span>
                        {isExpanded && expandedPanel?.panel === 'optional'
                          ? <ChevronUp size={10} className="ml-auto text-muted-foreground" />
                          : <ChevronDown size={10} className="ml-auto text-muted-foreground/40" />}
                      </button>
                    </td>

                    {/* Row actions */}
                    <td className="p-0 w-16">
                      <div className="flex items-center justify-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => duplicateRow(row)}
                          className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors">
                          <Copy size={12} />
                        </button>
                        <button onClick={() => deleteRow(row.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded panel row */}
                  {isExpanded && (
                    <tr key={`${row.id}-expanded`} className="border-b border-border bg-surface-2/10">
                      <td colSpan={15} className="p-0 overflow-hidden">
                        <div className="sticky left-0 px-6 py-4 space-y-4" style={{ width: 'min(100vw - 2rem, 860px)' }}>

                          {/* UNIFIED TARGETING PANEL */}
                          {expandedPanel?.panel === 'targeting' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] font-700 text-foreground">Targeting</span>
                                  <div className="flex gap-0.5">
                                    {(['location', 'interests', 'custom'] as AudienceFocus[]).map(f => (
                                      <button key={f} onClick={() => setAudienceFocus(f)}
                                        className={cn(
                                          'px-2 py-0.5 rounded text-[10px] font-600 border transition-all',
                                          audienceFocus === f
                                            ? 'bg-primary/15 border-primary/40 text-primary'
                                            : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                                        )}>
                                        {f === 'location' ? 'Location' : f === 'interests' ? 'Interests & Behaviors' : 'Custom / LAL'}
                                      </button>
                                    ))}
                                  </div>
                                  {audienceFocus === 'location' && (
                                    <button onClick={() => { setBulkLocModal({ rowId: row.id }); setBulkLocText(''); }}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[10px] font-600 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                                      <Plus size={9} /> Bulk Paste
                                    </button>
                                  )}
                                </div>
                                <button onClick={() => { setExpandedPanel(null); setLocationQuery(''); setLocationRowId(null); }}
                                  className="text-[11px] text-primary hover:text-primary/80 font-600 transition-colors">
                                  Done
                                </button>
                              </div>

                              {/* LOCATION TAB */}
                              {audienceFocus === 'location' && (
                                <div className="max-w-2xl space-y-3">
                                {/* Typeahead search */}
                                {hasCredentials ? (
                                  <div className="relative">
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">
                                      Search Locations
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        value={locationRowId === row.id ? locationQuery : ''}
                                        onChange={e => { setLocationQuery(e.target.value); setLocationRowId(row.id); }}
                                        onFocus={() => setLocationRowId(row.id)}
                                        placeholder="Type city, state, country, or zip…"
                                        className="flex-1 px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                                      />
                                      {searchingLocations && <span className="text-[10px] text-muted-foreground">Searching…</span>}
                                    </div>
                                    {/* Dropdown results */}
                                    {locationRowId === row.id && locationQuery.length >= 2 && locationResults && locationResults.results.length > 0 && (
                                      <div className="absolute z-50 mt-1 w-full bg-surface-1 border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {locationResults.results.map((loc: { key: string; name: string; type?: string; countryCode?: string; countryName?: string; region?: string }) => (
                                          <button
                                            key={loc.key}
                                            onClick={() => {
                                              const label = [loc.name, loc.region, loc.countryName].filter(Boolean).join(', ');
                                              const current = row.geoLocations ? row.geoLocations.split('\n').filter(Boolean) : [];
                                              const currentObjs = row.geoLocationObjects || [];
                                              if (!current.includes(label)) {
                                                update(row.id, {
                                                  geoLocations: [...current, label].join('\n'),
                                                  geoLocationObjects: [...currentObjs, { key: loc.key, type: loc.type || 'country', name: label }],
                                                });
                                              }
                                              setLocationQuery('');
                                              setLocationRowId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-[12px] hover:bg-surface-2 transition-colors flex items-center justify-between gap-2">
                                            <span className="text-foreground">{loc.name}{loc.region ? `, ${loc.region}` : ''}{loc.countryName ? ` (${loc.countryName})` : ''}</span>
                                            <span className="text-[10px] text-muted-foreground/60 capitalize">{loc.type}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-amber-400">Add credentials in Settings to enable location search.</p>
                                )}
                                {/* Selected locations chips + manual fallback */}
                                {row.geoLocations && (
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block">Selected Locations</label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {row.geoLocations.split('\n').filter(Boolean).map((loc, i) => (
                                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[11px] text-primary">
                                          {loc}
                                          <button onClick={() => {
                                            const updated = row.geoLocations!.split('\n').filter((l, li) => li !== i).join('\n');
                                            const updatedObjs = (row.geoLocationObjects || []).filter((_, oi) => oi !== i);
                                            update(row.id, { geoLocations: updated, geoLocationObjects: updatedObjs });
                                          }} className="hover:text-red-400 transition-colors"><X size={10} /></button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Manual fallback textarea */}
                                <div>
                                  <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">
                                    Or enter manually (one per line)
                                  </label>
                                  <textarea
                                    value={row.geoLocations}
                                    onChange={e => update(row.id, { geoLocations: e.target.value })}
                                    placeholder="New York, NY&#10;Los Angeles, CA&#10;90210"
                                    rows={3}
                                    className="w-full px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30"
                                  />
                                </div>
                                </div>
                              )}

                              {/* INTERESTS & BEHAVIORS TAB */}
                              {audienceFocus === 'interests' && (
                                <div className="grid grid-cols-2 gap-6">
                                {/* Left: Interest targeting */}
                                <div className="space-y-3">
                                  {/* Detailed Interests — live typeahead */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase">Detailed Targeting</label>
                                      <div className="flex gap-0.5">
                                        {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                                          <button key={t} onClick={() => setDetailedType(t)}
                                            className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                                              detailedType === t ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                                            }`}>
                                            {t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="relative">
                                      <input
                                        value={detailedRowId === row.id ? detailedQuery : ''}
                                        onChange={e => { setDetailedRowId(row.id); setDetailedQuery(e.target.value); }}
                                        onFocus={() => setDetailedRowId(row.id)}
                                        placeholder={hasCredentials ? `Search ${detailedType === 'adinterest' ? 'interests' : detailedType}…` : 'Enter credentials in Settings first'}
                                        className="w-full px-3 py-1.5 text-[11px] bg-surface-2/50 border border-border rounded outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                                      />
                                      {searchingDetailed && detailedRowId === row.id && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">…</span>
                                      )}
                                    </div>
                                    {/* Dropdown results */}
                                    {detailedRowId === row.id && detailedQuery.length >= 2 && (detailedResults?.results?.length ?? 0) > 0 && (
                                      <div className="border border-border rounded-lg bg-surface-1 shadow-xl mt-1 max-h-40 overflow-y-auto divide-y divide-border/30 z-50">
                                        {(detailedResults?.results ?? []).slice(0, 10).map((r: { id: string; name: string; type?: string; audienceSizeLower?: number }) => (
                                          <button key={r.id} onMouseDown={e => e.preventDefault()} onClick={() => {
                                            const current = row.detailedInterests ? row.detailedInterests.split('\n').filter(Boolean) : [];
                                            const currentObjs = row.detailedInterestObjects || [];
                                            if (!current.includes(r.name)) {
                                              update(row.id, {
                                                detailedInterests: [...current, r.name].join('\n'),
                                                detailedInterestObjects: [...currentObjs, { id: r.id, type: r.type || 'adinterest', name: r.name }],
                                              });
                                            }
                                            setDetailedQuery('');
                                            setDetailedRowId(null);
                                          }}
                                            className="w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 hover:bg-surface-2 transition-colors">
                                            <span className="text-foreground">{r.name}</span>
                                            {r.audienceSizeLower && (
                                              <span className="text-[10px] text-muted-foreground/60">{(r.audienceSizeLower / 1_000_000).toFixed(1)}M</span>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {/* Selected tags */}
                                    {row.detailedInterests && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {row.detailedInterests.split('\n').filter(Boolean).map((interest, i) => (
                                          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-primary">
                                            {interest}
                                            <button onClick={() => {
                                              const updatedObjs = (row.detailedInterestObjects || []).filter((_, oi) => oi !== i);
                                              update(row.id, {
                                                detailedInterests: row.detailedInterests!.split('\n').filter((_, li) => li !== i).join('\n'),
                                                detailedInterestObjects: updatedObjs,
                                              });
                                            }} className="hover:text-primary/60"><X size={9} /></button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {/* Fallback textarea when no credentials */}
                                    {!hasCredentials && (
                                      <textarea
                                        value={row.detailedInterests}
                                        onChange={e => update(row.id, { detailedInterests: e.target.value })}
                                        placeholder="Running, Fitness, Nike, Outdoor Sports…"
                                        rows={2}
                                        className="w-full mt-1 px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30"
                                      />
                                    )}
                                  </div>
                                  {/* Narrow Interests — live typeahead */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase">Narrow Targeting (AND)</label>
                                      <div className="flex gap-0.5">
                                        {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                                          <button key={t} onClick={() => setNarrowType(t)}
                                            className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                                              narrowType === t ? 'bg-amber-500 text-black' : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                                            }`}>
                                            {t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="relative">
                                      <input
                                        value={narrowRowId === row.id ? narrowQuery : ''}
                                        onChange={e => { setNarrowRowId(row.id); setNarrowQuery(e.target.value); }}
                                        onFocus={() => setNarrowRowId(row.id)}
                                        placeholder={hasCredentials ? `Search ${narrowType === 'adinterest' ? 'interests' : narrowType} to narrow by…` : 'Enter credentials in Settings first'}
                                        className="w-full px-3 py-1.5 text-[11px] bg-surface-2/50 border border-border rounded outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                                      />
                                      {searchingNarrow && narrowRowId === row.id && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">…</span>
                                      )}
                                    </div>
                                    {/* Dropdown results */}
                                    {narrowRowId === row.id && narrowQuery.length >= 2 && (narrowResults?.results?.length ?? 0) > 0 && (
                                      <div className="border border-border rounded-lg bg-surface-1 shadow-xl mt-1 max-h-40 overflow-y-auto divide-y divide-border/30 z-50">
                                        {(narrowResults?.results ?? []).slice(0, 10).map((r: { id: string; name: string; type?: string; audienceSizeLower?: number }) => (
                                          <button key={r.id} onMouseDown={e => e.preventDefault()} onClick={() => {
                                            const current = row.narrowInterests ? row.narrowInterests.split('\n').filter(Boolean) : [];
                                            const currentObjs = row.narrowInterestObjects || [];
                                            if (!current.includes(r.name)) {
                                              update(row.id, {
                                                narrowInterests: [...current, r.name].join('\n'),
                                                narrowInterestObjects: [...currentObjs, { id: r.id, type: r.type || 'adinterest', name: r.name }],
                                              });
                                            }
                                            // narrowInterestObjects is already the correct field name
                                            setNarrowQuery('');
                                            setNarrowRowId(null);
                                          }}
                                            className="w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 hover:bg-surface-2 transition-colors">
                                            <span className="text-foreground">{r.name}</span>
                                            {r.audienceSizeLower && (
                                              <span className="text-[10px] text-muted-foreground/60">{(r.audienceSizeLower / 1_000_000).toFixed(1)}M</span>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {/* Selected tags */}
                                    {row.narrowInterests && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {row.narrowInterests.split('\n').filter(Boolean).map((interest, i) => (
                                          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-400">
                                            {interest}
                                            <button onClick={() => update(row.id, { narrowInterests: row.narrowInterests!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-amber-600"><X size={9} /></button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {/* Fallback textarea when no credentials */}
                                    {!hasCredentials && (
                                      <textarea
                                        value={row.narrowInterests}
                                        onChange={e => update(row.id, { narrowInterests: e.target.value })}
                                        placeholder="Must also match these interests…"
                                        rows={2}
                                        className="w-full mt-1 px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30"
                                      />
                                    )}
                                  </div>
                                </div>
                                </div>
                              )}


                              {/* Custom/LAL full view when focused */}
                              {audienceFocus === 'custom' && (
                                <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Targeted Custom / LAL Audiences</label>
                                    {hasCredentials ? (
                                      <>
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <input value={audienceSearch} onChange={e => setAudienceSearch(e.target.value)}
                                            placeholder="Search audiences…"
                                            className="flex-1 px-2 py-1.5 text-[11px] bg-surface-2/50 border border-border rounded outline-none focus:border-primary/50 placeholder:text-muted-foreground/30" />
                                          {loadingAudiences && <span className="text-[10px] text-muted-foreground">Loading…</span>}
                                        </div>
                                        {audienceSearch.trim().length === 0 && (
                                          <p className="text-[10px] text-muted-foreground/50 italic px-1">Type to search your account audiences…</p>
                                        )}
                                        {customAudiences.length > 0 && (
                                          <div className="max-h-40 overflow-y-auto border border-border rounded-lg bg-surface-2/30 divide-y divide-border/30">
                                            {customAudiences.map((aud: { id: string; name: string; approximateCount?: number; subtype?: string }) => {
                                              const isSel = (row.targetedAudiences || '').includes(aud.name);
                                              return (
                                                <button key={aud.id} onClick={() => {
                                                  const cur = row.targetedAudiences ? row.targetedAudiences.split('\n').filter(Boolean) : [];
                                                  update(row.id, { targetedAudiences: isSel ? cur.filter(a => a !== aud.name).join('\n') : [...cur, aud.name].join('\n') });
                                                }} className={cn('w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors',
                                                  isSel ? 'bg-primary/10 text-primary' : 'hover:bg-surface-2 text-foreground')}>
                                                  <span>{aud.name}</span>
                                                  <span className="text-[10px] text-muted-foreground/60">{aud.subtype} {aud.approximateCount ? `• ${(aud.approximateCount / 1000).toFixed(0)}K` : ''}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {row.targetedAudiences && (
                                          <div className="flex flex-wrap gap-1 mt-1.5">
                                            {row.targetedAudiences.split('\n').filter(Boolean).map((a, i) => (
                                              <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-primary">
                                                {a}
                                                <button onClick={() => update(row.id, { targetedAudiences: row.targetedAudiences!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-red-400"><X size={9} /></button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <textarea value={row.targetedAudiences} onChange={e => update(row.id, { targetedAudiences: e.target.value })}
                                        placeholder="Website Visitors 180d, Email List LAL 1%…" rows={3}
                                        className="w-full px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30" />
                                    )}
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Excluded Custom / LAL Audiences</label>
                                    {hasCredentials ? (
                                      <>
                                        {audienceSearch.trim().length === 0 && (
                                          <p className="text-[10px] text-muted-foreground/50 italic px-1">Use the search above to find audiences to exclude…</p>
                                        )}
                                        {customAudiences.length > 0 && (
                                          <div className="max-h-40 overflow-y-auto border border-border rounded-lg bg-surface-2/30 divide-y divide-border/30">
                                            {customAudiences.map((aud: { id: string; name: string; subtype?: string }) => {
                                              const isExcl = (row.excludedAudiences || '').includes(aud.name);
                                              return (
                                                <button key={aud.id} onClick={() => {
                                                  const cur = row.excludedAudiences ? row.excludedAudiences.split('\n').filter(Boolean) : [];
                                                  update(row.id, { excludedAudiences: isExcl ? cur.filter(a => a !== aud.name).join('\n') : [...cur, aud.name].join('\n') });
                                                }} className={cn('w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors',
                                                  isExcl ? 'bg-red-500/10 text-red-400' : 'hover:bg-surface-2 text-foreground')}>
                                                  <span>{aud.name}</span>
                                                  <span className="text-[10px] text-muted-foreground/60">{aud.subtype}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {row.excludedAudiences && (
                                          <div className="flex flex-wrap gap-1 mt-1.5">
                                            {row.excludedAudiences.split('\n').filter(Boolean).map((a, i) => (
                                              <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-400">
                                                {a}
                                                <button onClick={() => update(row.id, { excludedAudiences: row.excludedAudiences!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-red-600"><X size={9} /></button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <textarea value={row.excludedAudiences} onChange={e => update(row.id, { excludedAudiences: e.target.value })}
                                        placeholder="Existing Customers, Purchasers 180d…" rows={3}
                                        className="w-full px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30" />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* OPTIONAL FIELDS PANEL */}
                          {expandedPanel?.panel === 'optional' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-700 text-foreground">Optional Fields</span>
                                <button onClick={() => setExpandedPanel(null)}
                                  className="text-[11px] text-primary hover:text-primary/80 font-600 transition-colors">
                                  Done
                                </button>
                              </div>

                              {/* Field selector */}
                              <div className="flex flex-wrap gap-1.5">
                                {TREE_FIELDS.map(f => {
                                  const isActive = Array.from(optFields).includes(f.key as string);
                                  // Auto-show frequency control if mandatory
                                  const isMandatoryFreq = f.key === 'frequencyControl' && freqMandatory;
                                  return (
                                    <button
                                      key={f.key as string}
                                      onClick={() => {
                                        if (isActive) removeOptField(row.id, f.key as string);
                                        else addOptField(row.id, f.key as string);
                                      }}
                                      className={cn(
                                        'flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-600 transition-all',
                                        isActive || isMandatoryFreq
                                          ? 'bg-primary/15 border-primary/40 text-primary'
                                          : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                                      )}
                                    >
                                      {isActive && <Check size={9} />}
                                      {f.label}
                                      {isMandatoryFreq && <span className="text-amber-400 ml-0.5">*</span>}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Active field inputs */}
                              <div className="space-y-3 mt-2">
                                {/* Language */}
                                {optFields.has('language') && (
                                  <div>
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Language</label>
                                    <select value={row.language ?? ''}
                                      onChange={e => update(row.id, { language: e.target.value })}
                                      className="px-2 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded">
                                      <option value="">Any</option>
                                      {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                    </select>
                                  </div>
                                )}

                                {/* Operating System */}
                                {optFields.has('operatingSystem') && (
                                  <div>
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Operating System</label>
                                    <BtnGroup
                                      options={[
                                        { value: 'all', label: 'All' },
                                        { value: 'android', label: 'Android' },
                                        { value: 'ios', label: 'iOS' },
                                      ]}
                                      value={row.operatingSystem ?? 'all'}
                                      onChange={v => update(row.id, { operatingSystem: v })}
                                    />
                                  </div>
                                )}

                                {/* Device Type */}
                                {optFields.has('devicePlatforms') && (
                                  <div>
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Device Type</label>
                                    <BtnGroup
                                      options={[
                                        { value: 'all', label: 'All' },
                                        { value: 'mobile', label: 'Mobile' },
                                        { value: 'desktop', label: 'Desktop' },
                                      ]}
                                      value={row.devicePlatforms ?? 'all'}
                                      onChange={v => update(row.id, { devicePlatforms: v })}
                                    />
                                  </div>
                                )}

                                {/* Frequency Control */}
                                {(optFields.has('frequencyControl') || freqMandatory) && showFreqControl && (
                                  <FrequencyControlPanel
                                    row={row}
                                    goal={row.optimizationGoal}
                                    onChange={fc => update(row.id, { frequencyControl: fc })}
                                  />
                                )}

                                {/* Attribution Window */}
                                {optFields.has('attributionWindow') && (
                                  <div>
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Attribution Window</label>
                                    <select value={row.attributionWindow}
                                      onChange={e => update(row.id, { attributionWindow: e.target.value })}
                                      className="px-2 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded">
                                      <option value="7d_click_1d_engaged_1d_view">7-day click, 1-day engaged view, 1-day view (default)</option>
                                      <option value="7d_click">7-day click</option>
                                      <option value="1d_click">1-day click</option>
                                      <option value="7d_click_1d_view">7-day click, 1-day view</option>
                                      <option value="1d_click_1d_view">1-day click, 1-day view</option>
                                    </select>
                                  </div>
                                )}

                                {/* Attribution Model */}
                                {optFields.has('attributionModel') && (
                                  <div>
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Attribution Model</label>
                                    <BtnGroup
                                      options={[
                                        { value: 'standard', label: 'Standard' },
                                        { value: 'incremental', label: 'Incremental' },
                                      ]}
                                      value={row.attributionModel ?? 'standard'}
                                      onChange={v => update(row.id, { attributionModel: v })}
                                    />
                                  </div>
                                )}

                                {/* Lead Gen Form */}
                                {optFields.has('leadGenFormId') && showLeadGen && (
                                  <div>
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Lead Gen Form ID</label>
                                    <input
                                      value={row.leadGenFormId ?? ''}
                                      onChange={e => update(row.id, { leadGenFormId: e.target.value })}
                                      placeholder="Form ID from Meta or created above…"
                                      className="w-full px-2 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded"
                                    />
                                  </div>
                                )}

                                {/* Day Parting */}
                                {optFields.has('adScheduling') && (
                                  <DayPartingGrid
                                    value={row.adScheduling ?? ''}
                                    onChange={v => update(row.id, { adScheduling: v })}
                                  />
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground text-[13px]">No ad sets yet</p>
            <p className="text-muted-foreground/50 text-[11px] mt-1">Add a campaign first, then ad sets will auto-populate</p>
          </div>
        )}
      </div>

      {/* Bulk Location Paste Modal */}
      {bulkLocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setBulkLocModal(null)}>
          <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-700 text-foreground">Bulk Paste Locations</span>
              <button onClick={() => setBulkLocModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
            </div>
            <div>
              <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Location Type</label>
              <div className="flex gap-1.5">
                {(['city', 'region', 'country', 'zip'] as const).map(t => (
                  <button key={t} onClick={() => setBulkLocType(t)}
                    className={cn(
                      'px-3 py-1 rounded border text-[11px] font-600 capitalize transition-all',
                      bulkLocType === t
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                    )}>
                    {t === 'region' ? 'State/Region' : t === 'zip' ? 'Zip/Postal' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Paste Locations (one per line)</label>
              <textarea
                value={bulkLocText}
                onChange={e => setBulkLocText(e.target.value)}
                placeholder={bulkLocType === 'city' ? 'New York\nLos Angeles\nChicago' : bulkLocType === 'region' ? 'California\nTexas\nNew York' : bulkLocType === 'zip' ? '10001\n90210\n60601' : 'United States\nCanada\nUnited Kingdom'}
                rows={8}
                className="w-full px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30 font-mono"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground">{bulkLocText.split('\n').filter(s => s.trim()).length} location{bulkLocText.split('\n').filter(s => s.trim()).length !== 1 ? 's' : ''} entered</span>
              <div className="flex gap-2">
                <button onClick={() => setBulkLocModal(null)}
                  className="px-3 py-1.5 rounded border border-border text-[12px] font-600 text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  disabled={bulkLocMatching || !bulkLocText.trim()}
                  onClick={async () => {
                    if (!bulkLocModal) return;
                    const lines = bulkLocText.split('\n').map(s => s.trim()).filter(Boolean);
                    if (!lines.length) return;
                    setBulkLocMatching(true);
                    try {
                      const row = rows.find(r => r.id === bulkLocModal.rowId);
                      if (!row) return;
                      const matched: { key: string; type: string; name: string }[] = [];
                      const labels: string[] = [];
                      for (const line of lines) {
                        try {
                          const res = await utils.meta.searchGeoLocations.fetch({
                            accessToken: settings?.accessToken ?? '',
                            query: line,
                            location_types: [bulkLocType],
                          });
                          if (res?.results?.length) {
                            const loc = res.results[0];
                            const label = [loc.name, loc.region, loc.countryName].filter(Boolean).join(', ');
                            matched.push({ key: loc.key, type: loc.type || bulkLocType, name: label });
                            labels.push(label);
                          }
                        } catch { /* skip failed lookups */ }
                      }
                      const currentLabels = row.geoLocations ? row.geoLocations.split('\n').filter(Boolean) : [];
                      const currentObjs = row.geoLocationObjects || [];
                      const newLabels = labels.filter(l => !currentLabels.includes(l));
                      const newObjs = matched.filter(m => !currentLabels.includes(m.name));
                      update(bulkLocModal.rowId, {
                        geoLocations: [...currentLabels, ...newLabels].join('\n'),
                        geoLocationObjects: [...currentObjs, ...newObjs],
                      });
                      setBulkLocModal(null);
                    } finally {
                      setBulkLocMatching(false);
                    }
                  }}
                  className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-[12px] font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                  {bulkLocMatching ? <><span className="animate-spin">⟳</span> Matching…</> : 'Match Locations'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
