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
  Plus, Copy, CopyPlus, Trash2, ChevronDown, ChevronUp, SlidersHorizontal,
  MapPin, Users, Clock, X, Check, Info, ExternalLink, BarChart2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { TargetingPopup, AudienceFocus } from './TargetingPopupAdmin';
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
} from './campaignStoreAdmin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { trpc } from '@/lib/trpc';
import { BuildSettings } from './campaignStoreAdmin';
import { ReachEstimatePanel, AudienceOverlapPanel } from './BuilderReachOverlapPanelAdmin';
import { buildBuilderTargetingSpec } from './builderMetaMappingAdmin';
import { BulkEditPanel } from './BulkEditPanelAdmin';
import AudienceBuilderModal from './AudienceBuilderModalAdmin';

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
// AudienceFocus is imported from TargetingPopupAdmin

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


// ── Optional Fields Popup (inline, anchored to cell) ──────────────────────────
type OptionalFieldsPopupProps = {
  row: AdSetRow;
  optFields: Set<string>;
  freqMandatory: boolean;
  showFreqControl: boolean;
  showLeadGen: boolean;
  addOptField: (rowId: string, key: string) => void;
  removeOptField: (rowId: string, key: string) => void;
  update: (id: string, updates: Partial<AdSetRow>) => void;
  onClose: () => void;
};

function OptionalFieldsPopup({
  row, optFields, freqMandatory, showFreqControl, showLeadGen,
  addOptField, removeOptField, update, onClose,
}: OptionalFieldsPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute z-[70] top-full right-0 mt-1 rounded-xl shadow-2xl"
      style={{ width: 380, maxHeight: 480, overflowY: 'auto', background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-[12px] font-700 text-white">Optional Fields</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors"><X size={14} /></button>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Field selector */}
        <div className="flex flex-wrap gap-1.5">
          {TREE_FIELDS.map(f => {
            const isActive = Array.from(optFields).includes(f.key as string);
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
                    : 'bg-transparent border-[rgba(255,255,255,0.12)] text-white/40 hover:text-white/70 hover:border-[rgba(255,255,255,0.25)]'
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
        <div className="space-y-3">
          {optFields.has('language') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Language</label>
              <select value={row.language ?? ''} onChange={e => update(row.id, { language: e.target.value })}
                className="px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white">
                <option value="">Any</option>
                {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          )}
          {optFields.has('operatingSystem') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Operating System</label>
              <BtnGroup
                options={[{ value: 'all', label: 'All' }, { value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }]}
                value={row.operatingSystem ?? 'all'}
                onChange={v => update(row.id, { operatingSystem: v })}
              />
            </div>
          )}
          {optFields.has('devicePlatforms') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Device Type</label>
              <BtnGroup
                options={[{ value: 'all', label: 'All' }, { value: 'mobile', label: 'Mobile' }, { value: 'desktop', label: 'Desktop' }]}
                value={row.devicePlatforms ?? 'all'}
                onChange={v => update(row.id, { devicePlatforms: v })}
              />
            </div>
          )}
          {(optFields.has('frequencyControl') || freqMandatory) && showFreqControl && (
            <FrequencyControlPanel row={row} goal={row.optimizationGoal} onChange={fc => update(row.id, { frequencyControl: fc })} />
          )}
          {optFields.has('attributionWindow') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Attribution Window</label>
              <select value={row.attributionWindow} onChange={e => update(row.id, { attributionWindow: e.target.value })}
                className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white">
                <option value="7d_click_1d_engaged_1d_view">7-day click, 1-day engaged view, 1-day view (default)</option>
                <option value="7d_click">7-day click</option>
                <option value="1d_click">1-day click</option>
                <option value="7d_click_1d_view">7-day click, 1-day view</option>
                <option value="1d_click_1d_view">1-day click, 1-day view</option>
              </select>
            </div>
          )}
          {optFields.has('attributionModel') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Attribution Model</label>
              <BtnGroup
                options={[{ value: 'standard', label: 'Standard' }, { value: 'incremental', label: 'Incremental' }]}
                value={row.attributionModel ?? 'standard'}
                onChange={v => update(row.id, { attributionModel: v })}
              />
            </div>
          )}
          {optFields.has('leadGenFormId') && showLeadGen && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Lead Gen Form ID</label>
              <input value={row.leadGenFormId ?? ''} onChange={e => update(row.id, { leadGenFormId: e.target.value })}
                placeholder="Form ID from Meta or created above…"
                className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white" />
            </div>
          )}
          {optFields.has('adScheduling') && (
            <DayPartingGrid value={row.adScheduling ?? ''} onChange={v => update(row.id, { adScheduling: v })} />
          )}
          {optFields.has('bidStrategy') && (
            <div className="space-y-2">
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block">Bid Strategy</label>
              <select
                value={row.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP'}
                onChange={e => update(row.id, { bidStrategy: e.target.value as AdSetRow['bidStrategy'], bidCap: '', costCap: '', roasFloor: '' })}
                className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white"
              >
                <option value="LOWEST_COST_WITHOUT_CAP">Highest Volume (default — no cap)</option>
                <option value="COST_CAP">Cost Cap</option>
                <option value="LOWEST_COST_WITH_BID_CAP">Bid Cap</option>
                <option value="LOWEST_COST_WITH_MIN_ROAS">Minimum ROAS</option>
              </select>
              {(row.bidStrategy === 'COST_CAP') && (
                <div>
                  <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Cost Cap ($ per result)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={row.costCap ?? ''}
                    onChange={e => update(row.id, { costCap: e.target.value })}
                    placeholder="e.g. 15.00"
                    className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white"
                  />
                </div>
              )}
              {(row.bidStrategy === 'LOWEST_COST_WITH_BID_CAP') && (
                <div>
                  <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Bid Cap ($ per result)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={row.bidCap ?? ''}
                    onChange={e => update(row.id, { bidCap: e.target.value })}
                    placeholder="e.g. 10.00"
                    className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white"
                  />
                </div>
              )}
              {(row.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS') && (
                <div>
                  <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Minimum ROAS (e.g. 2.5)</label>
                  <input
                    type="number" min="0" step="0.1"
                    value={row.roasFloor ?? ''}
                    onChange={e => update(row.id, { roasFloor: e.target.value })}
                    placeholder="e.g. 2.5"
                    className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[#00BEEF] text-[#0e0d3a] text-[11px] font-700 hover:bg-[#00d4ff] transition-colors">
          Done
        </button>
      </div>
    </div>
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
      className="absolute z-50 top-full right-0 mt-1 rounded-lg shadow-2xl p-3 space-y-3" style={{ width: 560, background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }}>
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
              <div className="grid grid-cols-3 gap-1">
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
  const optGoal = goal as import('./campaignStoreAdmin').OptimizationGoal;
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
  const { data: pixelEventsData } = trpc.adminMeta.getPixelEvents.useQuery(
    { accessToken: settings?.accessToken ?? '', pixelId: settings?.pixelId ?? '', adAccountId: settings?.adAccountId ?? '' },
    { enabled: hasPixel, staleTime: 5 * 60 * 1000 }
  );
  const pixelEvents = pixelEventsData?.events ?? [];
  const customConversions = pixelEventsData?.customConversions ?? [];

  // ── Live API: custom audiences ─────────────────────────────────────────────
  const [audienceSearch, setAudienceSearch] = useState('');
  const { data: customAudiencesData, isLoading: loadingAudiences } = trpc.adminMeta.getCustomAudiences.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', search: audienceSearch || undefined },
    { enabled: hasCredentials && audienceSearch.trim().length > 0, staleTime: 2 * 60 * 1000 }
  );
  const { data: savedAudiencesData } = trpc.adminMeta.getSavedAudiences.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '' },
    { enabled: hasCredentials, staleTime: 2 * 60 * 1000 }
  );
  const customAudiences = customAudiencesData?.audiences ?? [];
  const savedAudiences = savedAudiencesData?.audiences ?? [];

  // ── Live API: location search ──────────────────────────────────────────────
  const [locationQuery, setLocationQuery] = useState('');
  const [locationRowId, setLocationRowId] = useState<string | null>(null);
  const { data: locationResults, isFetching: searchingLocations } = trpc.adminMeta.searchGeoLocations.useQuery(
    {
      accessToken: settings?.accessToken ?? '',
      query: locationQuery,
      location_types: ['city', 'subcity', 'neighborhood', 'region', 'country', 'zip', 'geo_market'],
    },
    { enabled: hasCredentials && locationQuery.length >= 2, staleTime: 60 * 1000 }
  );
  // ── Live API: address geocoding (Pin a Location) ──────────────────────────
  const [addressQuery, setAddressQuery] = useState('');
  const [addressRowId, setAddressRowId] = useState<string | null>(null);
  const { data: geocodeResults, isFetching: geocodingLoading } = trpc.adminMeta.geocodeAddress.useQuery(
    { address: addressQuery },
    { enabled: addressQuery.length >= 3, staleTime: 60 * 1000 }
  );
  // ── Live API: detailed targeting search ─────────────────────────────────
  const [detailedQuery, setDetailedQuery] = useState('');
  const [detailedRowId, setDetailedRowId] = useState<string | null>(null);
  const [detailedType, setDetailedType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const [narrowQuery, setNarrowQuery] = useState('');
  const [narrowRowId, setNarrowRowId] = useState<string | null>(null);
  const [narrowType, setNarrowType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const { data: detailedResults, isFetching: searchingDetailed } = trpc.adminMeta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: detailedQuery, type: detailedType },
    { enabled: hasCredentials && detailedQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const { data: narrowResults, isFetching: searchingNarrow } = trpc.adminMeta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: narrowQuery, type: narrowType },
    { enabled: hasCredentials && narrowQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const [expandedPanel, setExpandedPanel] = useState<{ rowId: string; panel: PanelType } | null>(null);
  const [audienceFocus, setAudienceFocus] = useState<AudienceFocus>('location');
  const [openPlacement, setOpenPlacement] = useState<string | null>(null);
  const [activeOptFields, setActiveOptFields] = useState<Record<string, Set<string>>>({});
  const [bulkLocModal, setBulkLocModal] = useState<{ rowId: string } | null>(null);
  const [bulkLocText, setBulkLocText] = useState('');
  const [bulkLocType, setBulkLocType] = useState<'city' | 'region' | 'country' | 'zip'>('city');
  const [bulkLocMatching, setBulkLocMatching] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // ── Column resizing ──────────────────────────────────────────────────────────
  const AD_SET_COL_DEFAULTS: Record<string, number> = {
    checkbox: 32, status: 100, campaign: 180, name: 180, budget: 120,
    startEnd: 200, optGoal: 200, convLoc: 160, placements: 130,
    ageGender: 130, targeting: 140, optFields: 120, actions: 64,
  };
  const [colWidths, setColWidths] = useState(AD_SET_COL_DEFAULTS);
  const resizingCol = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[key];
    resizingCol.current = { key, startX, startW };
    const onMove = (me: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = me.clientX - startX;
      setColWidths(prev => ({ ...prev, [key]: Math.max(60, startW + delta) }));
    };
    const onUp = () => { resizingCol.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const colW = (key: string) => ({ width: colWidths[key], minWidth: colWidths[key] });

  // ── Row selection (checkboxes) ─────────────────────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const toggleRowSelect = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedRows.size === rows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(rows.map(r => r.id)));
  };

  // ── Targeting modal ────────────────────────────────────────────────────────
  const [targetingModal, setTargetingModal] = useState<{ rowId: string } | null>(null);
  const openTargetingModal = (rowId: string) => {
    setAudienceFocus('location');
    setTargetingModal({ rowId });
  };
  const closeTargetingModal = () => {
    setTargetingModal(null);
    setLocationQuery('');
    setLocationRowId(null);
  };

  // ── Analysis modal (reach + overlap) ──────────────────────────────────────
  const [analysisModal, setAnalysisModal] = useState<{ tab: 'reach' | 'overlap' } | null>(null);
  const [overlapRunning, setOverlapRunning] = useState(false);
  const builderOverlapMutation = trpc.adminMeta.builderAudienceOverlap.useMutation();

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
        targetingSpec: (() => {
          try { return buildBuilderTargetingSpec(row) as Record<string, unknown>; } catch { return {}; }
        })(),
        isNarrowed: !!(row.narrowInterests || row.narrowInterestObjects?.length),
      }));
      const result = await builderOverlapMutation.mutateAsync({
        accessToken: settings.accessToken,
        adAccountId: settings.adAccountId,
        adSets,
      });
      const run = { runAt: Date.now(), overlapResults: result.overlapResults, pairList: result.pairList };
      onOverlapHistoryChange([run, ...overlapHistory].slice(0, 10));
      setAnalysisModal({ tab: 'overlap' });
    } catch (err) {
      console.error('Overlap from reach failed:', err);
    } finally {
      setOverlapRunning(false);
    }
  }, [rows, settings, overlapHistory, onOverlapHistoryChange, builderOverlapMutation]);

  // ── Pre-Launch QA rail ─────────────────────────────────────────────────────
  const [qaOpen, setQaOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [audienceBuilderOpen, setAudienceBuilderOpen] = useState(false);
  const [bulkDuplicateModal, setBulkDuplicateModal] = useState(false);
  const [bulkDupCampaign, setBulkDupCampaign] = useState('');

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

  // Derive selected rows and QA issues
  const selectedAdSets = rows.filter(r => selectedRows.has(r.id));
  const canRunReach = selectedRows.size > 0 || reachHistory.length > 0;
  const selectedSameCampaign = selectedAdSets.length >= 2 &&
    selectedAdSets.every(r => r.campaignName === selectedAdSets[0].campaignName);
  const canRunOverlap = selectedSameCampaign || overlapHistory.length > 0;

  // QA issues derived from rows
  const qaIssues = React.useMemo(() => {
    const issues: { type: 'error' | 'warning' | 'info'; message: string; rowId?: string; rowName?: string }[] = [];
    rows.forEach(row => {
      if (!row.campaignName) issues.push({ type: 'error', message: 'No campaign assigned', rowId: row.id, rowName: row.name });
      if (!row.budget || parseFloat(row.budget) <= 0) issues.push({ type: 'error', message: 'Missing or zero budget', rowId: row.id, rowName: row.name });
      if (!row.startDate) issues.push({ type: 'error', message: 'Missing start date', rowId: row.id, rowName: row.name });
      if (!row.placements.length && row.placementType !== 'advantage_plus') issues.push({ type: 'warning', message: 'No placements selected', rowId: row.id, rowName: row.name });
      if (!row.geoLocations && !row.targetedAudiences) issues.push({ type: 'info', message: 'No targeting set (broad)', rowId: row.id, rowName: row.name });
    });
    return issues;
  }, [rows]);

  const errorCount = qaIssues.filter(i => i.type === 'error').length;
  const warningCount = qaIssues.filter(i => i.type === 'warning').length;

  return (
    <div ref={tableRef} className="flex flex-row h-full overflow-hidden">
      {/* Main content area (table + toolbar) */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-1/80">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-700 text-muted-foreground tracking-wider uppercase">Ad Sets</span>
          <span className="text-[10px] text-muted-foreground/50 bg-surface-2 px-1.5 py-0.5 rounded font-mono">{rows.length}</span>
          {selectedRows.size > 0 && (
            <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-600">{selectedRows.size} selected</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Reach Estimate button */}
          <button
            onClick={() => canRunReach && setAnalysisModal({ tab: 'reach' })}
            disabled={!canRunReach}
            title={!canRunReach ? 'Select at least one ad set row to run reach estimate' : 'Run reach estimate for selected rows'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
              !canRunReach
                ? 'bg-surface-2/30 border-border/30 text-muted-foreground/30 cursor-not-allowed'
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
            onClick={() => canRunOverlap && setAnalysisModal({ tab: 'overlap' })}
            disabled={!canRunOverlap}
            title={!canRunOverlap ? 'Select 2+ ad sets from the same campaign to check overlap' : 'Check audience overlap for selected rows'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
              !canRunOverlap
                ? 'bg-surface-2/30 border-border/30 text-muted-foreground/30 cursor-not-allowed'
                : 'bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
            )}>
            <Users size={12} />
            Audience Overlap
            {overlapHistory.length > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">{overlapHistory.length}</span>
            )}
          </button>
          {/* Bulk Edit button */}
          {selectedRows.size >= 2 && (
            <button
              onClick={() => setBulkEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border bg-primary/10 border-primary/30 text-primary hover:bg-primary/20">
              <SlidersHorizontal size={12} />
              Bulk Edit
              <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">{selectedRows.size}</span>
            </button>
          )}
          {/* Bulk Duplicate button */}
          {selectedRows.size >= 2 && (
            <button
              onClick={() => { setBulkDupCampaign(campaigns[0]?.name ?? ''); setBulkDuplicateModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20">
              <CopyPlus size={12} />
              Bulk Duplicate
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded">{selectedRows.size}</span>
            </button>
          )}
          {/* Build Custom/LAL Audience button */}
          <button
            onClick={() => setAudienceBuilderOpen(true)}
            title="Build a Custom or Lookalike Audience"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30">
            <Users size={12} />
            Build Audience
          </button>
          {/* Pre-Launch QA toggle */}
          <button
            onClick={() => setQaOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-600 transition-colors border',
              qaOpen
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : errorCount > 0
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:border-red-500/50'
                  : 'bg-surface-2/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
            )}>
            <Info size={12} />
            QA
            {(errorCount > 0 || warningCount > 0) && (
              <span className={cn('text-[9px] px-1 rounded', errorCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>
                {errorCount > 0 ? errorCount : warningCount}
              </span>
            )}
          </button>
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-[11px] font-600 hover:bg-primary/20 transition-colors">
            <Plus size={12} /> Add Ad Set
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="border-collapse text-[12px]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={colW('checkbox')} />
            <col style={colW('status')} />
            <col style={colW('campaign')} />
            <col style={colW('name')} />
            <col style={colW('budget')} />
            <col style={colW('startEnd')} />
            <col style={colW('optGoal')} />
            <col style={colW('convLoc')} />
            <col style={colW('placements')} />
            <col style={colW('ageGender')} />
            <col style={colW('targeting')} />
            <col style={colW('optFields')} />
            <col style={colW('actions')} />
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              {[
                { key: 'checkbox', label: '', isCheckbox: true },
                { key: 'status', label: 'Status', required: true },
                { key: 'campaign', label: 'Campaign', required: true },
                { key: 'name', label: 'Ad Set Name', required: true },
                { key: 'budget', label: 'Budget', required: true },
                { key: 'startEnd', label: 'Start / End', required: true },
                { key: 'optGoal', label: 'Opt Goal', required: true },
                { key: 'convLoc', label: 'Conv. Location' },
                { key: 'placements', label: 'Placements', required: true },
                { key: 'ageGender', label: 'Age / Gender' },
                { key: 'targeting', label: 'Targeting' },
                { key: 'optFields', label: 'Optional Fields' },
                { key: 'actions', label: '' },
              ].map(col => (
                <th key={col.key} className={cn(
                  'relative px-2 py-2 text-left text-[10px] font-700 tracking-wider border-r border-border last:border-r-0 whitespace-nowrap sticky top-0 bg-surface-1 z-10',
                  'text-muted-foreground'
                )}>
                  {(col as any).isCheckbox ? (
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedRows.size === rows.length}
                      ref={el => { if (el) el.indeterminate = selectedRows.size > 0 && selectedRows.size < rows.length; }}
                      onChange={toggleSelectAll}
                      className="w-3 h-3 accent-primary cursor-pointer"
                      title="Select all"
                    />
                  ) : (
                    <>{col.label}{col.required && <span className="text-primary ml-0.5">*</span>}</>
                  )}
                  {col.key !== 'checkbox' && col.key !== 'actions' && (
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 transition-colors"
                      onMouseDown={e => startResize(col.key, e)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const objective = getCampaignObjective(row.campaignName);
              const sac = getCampaignSAC(row.campaignName);
              const sacRestricted = sacRestrictsTargeting(sac);
              const validGoals = objective ? OBJECTIVE_OPT_GOALS[objective] : Object.keys(OPTIMIZATION_GOAL_LABELS) as import('./campaignStoreAdmin').OptimizationGoal[];
              const showFreqControl = frequencyControlApplicable(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal);
              const freqMandatory = frequencyControlMandatory(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal);
              const showBillingChoice = billingChoiceApplicable(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal);
              const showConvEvent = conversionEventApplicable(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal);
              const showLeadGen = leadGenApplicable(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal);
              const showEngagementGoal = engagementGoalApplicable(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal);
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
                    {/* Checkbox */}
                    <td className="px-2 py-1 text-center border-r border-border/30">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleRowSelect(row.id)}
                        className="w-3 h-3 accent-primary cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      />
                    </td>

                    {/* Status */}
                    <td className="border-r border-border/30 p-0">
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
                    <td className="border-r border-border/30 p-0">
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
                    <td className="border-r border-border/30 p-0">
                      <CellInput
                        value={row.name}
                        onChange={v => update(row.id, { name: v })}
                        placeholder="Ad Set #1"
                      />
                    </td>

                    {/* Budget */}
                    <td className="border-r border-border/30 p-0">
                      <div className="flex flex-col px-1.5 py-1 gap-0.5">
                        <BtnGroup
                          options={[
                            { value: 'LIFETIME', label: 'LT' },
                            { value: 'DAILY', label: 'Daily' },
                          ]}
                          value={row.budgetType}
                          onChange={v => update(row.id, { budgetType: v as 'LIFETIME' | 'DAILY' })}
                          small
                        />
                        <div className="flex items-center gap-0.5">
                          <span className="text-muted-foreground/50 text-[10px]">$</span>
                          <CellInput
                            value={row.budget}
                            onChange={v => update(row.id, { budget: v })}
                            placeholder="0.00"
                            type="number"
                            className="w-full text-[11px]"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Start / End combined */}
                    <td className="border-r border-border/30 p-0">
                      <div className="flex flex-col divide-y divide-border/30">
                        <input
                          type="datetime-local"
                          value={row.startDate && row.startTime ? `${row.startDate}T${row.startTime}` : row.startDate ? `${row.startDate}T08:00` : ''}
                          onChange={e => {
                            const [d, t] = e.target.value.split('T');
                            update(row.id, { startDate: d ?? '', startTime: t ?? '08:00' });
                          }}
                          className="cell-input datetime-white px-2 py-1.5 text-[11px] bg-transparent border-0 outline-none w-full"
                        />
                        <input
                          type="datetime-local"
                          value={row.endDate && row.endTime ? `${row.endDate}T${row.endTime}` : row.endDate ? `${row.endDate}T20:00` : ''}
                          onChange={e => {
                            const [d, t] = e.target.value.split('T');
                            update(row.id, { endDate: d ?? '', endTime: t ?? '20:00' });
                          }}
                          className="cell-input datetime-white px-2 py-1.5 text-[11px] bg-transparent border-0 outline-none w-full"
                        />
                      </div>
                    </td>

                    {/* Optimization Goal */}
                    <td className="border-r border-border/30 p-0">
                      <div className="space-y-0.5">
                        <select
                          value={row.optimizationGoal}
                          onChange={e => {
                            const goal = e.target.value as import('./campaignStoreAdmin').OptimizationGoal;
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
                              {billingChoiceOptions(row.optimizationGoal as import('./campaignStoreAdmin').OptimizationGoal).map(o => (
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
                                    update(row.id, { conversionEvent: cc?.name ?? '', customConversionId: ccId });
                                  } else {
                                    // Standard event selected — check if it matches a custom conversion by name
                                    // (CAPI-connected events appear in standard list but need custom_conversion_id for Meta API)
                                    const matchingCC = customConversions.find((c: { id: string; name: string }) => c.name === val);
                                    update(row.id, { conversionEvent: val, customConversionId: matchingCC?.id || undefined });
                                  }
                                }}
                                className="w-full px-2 py-1 text-[10px] bg-surface-2/50 border border-border rounded outline-none focus:border-primary/50 text-foreground"
                              >
                                <option value="">Select conversion event…</option>
                                {customConversions.length > 0 && (
                                  <optgroup label="Custom Conversions">
                                    {customConversions.map((cc: { id: string; name: string }) => (
                                      <option key={cc.id} value={`cc::${cc.id}`}>{cc.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {pixelEvents.length > 0 && (
                                  <optgroup label="Standard Pixel Events">
                                    {pixelEvents.map((ev: string) => (
                                      <option key={ev} value={ev}>{ev}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            ) : (
                              <CellInput
                                value={row.conversionEvent}
                                onChange={v => update(row.id, { conversionEvent: v, customConversionId: undefined })}
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
                    <td className="border-r border-border/30 p-0">
                      <select
                        value={row.conversionLocation}
                        onChange={e => update(row.id, { conversionLocation: e.target.value as import('./campaignStoreAdmin').ConversionLocation })}
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

                    {/* Age + Gender combined */}
                    <td className="border-r border-border/30 p-0">
                      <div className={cn('flex flex-col divide-y divide-border/30', sacRestricted && 'opacity-40 pointer-events-none')}>
                        {/* Age row */}
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5">
                          <input type="number" min={18} max={65}
                            value={row.ageMin}
                            onChange={e => update(row.id, { ageMin: e.target.value })}
                            className="w-10 px-1 py-0.5 text-[11px] bg-surface-2/50 border border-border/50 rounded text-center cell-input" />
                          <span className="text-muted-foreground text-[10px]">–</span>
                          <input type="number" min={18} max={65}
                            value={row.ageMax}
                            onChange={e => update(row.id, { ageMax: e.target.value })}
                            className="w-10 px-1 py-0.5 text-[11px] bg-surface-2/50 border border-border/50 rounded text-center cell-input" />
                          {sacRestricted && <span className="text-[9px] text-amber-400 ml-0.5">SAC</span>}
                        </div>
                        {/* Gender row */}
                        <div className="px-1 py-0.5">
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
                      </div>
                    </td>

                    {/* Unified Targeting — inline popup (like Placements) */}
                    <td className="border-r border-border/30 p-0 relative">
                      <button
                        onClick={() => {
                          if (targetingModal?.rowId === row.id) { closeTargetingModal(); }
                          else { openTargetingModal(row.id); }
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors',
                          targetingModal?.rowId === row.id && 'text-primary'
                        )}
                      >
                        <MapPin size={11} className={row.geoLocations ? 'text-primary' : 'text-muted-foreground/40'} />
                        <span className={cn('text-[11px] truncate max-w-[90px]',
                          (row.geoLocations || row.detailedInterests || row.targetedAudiences) ? 'text-foreground' : 'text-muted-foreground/40')}>
                          {[row.geoLocations && 'Loc', row.detailedInterests && 'Int', row.targetedAudiences && 'Aud']
                            .filter(Boolean).join(' · ') || 'Add…'}
                        </span>
                        <ChevronDown size={9} className={cn('ml-auto transition-transform', targetingModal?.rowId === row.id && 'rotate-180 text-primary')} />
                      </button>
                      {targetingModal?.rowId === row.id && (() => {
                        const tmRow = row;
                        return (
                          <TargetingPopup
                            tmRow={tmRow}
                            audienceFocus={audienceFocus}
                            setAudienceFocus={setAudienceFocus}
                            hasCredentials={hasCredentials}
                            locationQuery={locationQuery}
                            locationRowId={locationRowId}
                            setLocationQuery={setLocationQuery}
                            setLocationRowId={setLocationRowId}
                            locationResults={locationResults}
                            searchingLocations={searchingLocations}
                            detailedQuery={detailedQuery}
                            detailedRowId={detailedRowId}
                            setDetailedQuery={setDetailedQuery}
                            setDetailedRowId={setDetailedRowId}
                            detailedType={detailedType}
                            setDetailedType={setDetailedType}
                            detailedResults={detailedResults}
                            searchingDetailed={searchingDetailed}
                            narrowQuery={narrowQuery}
                            narrowRowId={narrowRowId}
                            setNarrowQuery={setNarrowQuery}
                            setNarrowRowId={setNarrowRowId}
                            narrowType={narrowType}
                            setNarrowType={setNarrowType}
                            narrowResults={narrowResults}
                            searchingNarrow={searchingNarrow}
                            audienceSearch={audienceSearch}
                            setAudienceSearch={setAudienceSearch}
                            customAudiences={customAudiences}
                            loadingAudiences={loadingAudiences}
                            update={update}
                            onClose={closeTargetingModal}
                            setBulkLocModal={setBulkLocModal}
                            setBulkLocText={setBulkLocText}
                            addressQuery={addressQuery}
                            addressRowId={addressRowId}
                            setAddressQuery={setAddressQuery}
                            setAddressRowId={setAddressRowId}
                            geocodeResults={geocodeResults}
                            geocodingLoading={geocodingLoading}
                          />
                        );
                      })()}
                    </td>

                    {/* Optional Fields — inline popup */}
                    <td className="border-r border-border/30 p-0 min-w-[110px] relative">
                      <button
                        onClick={() => {
                          if (isExpanded && expandedPanel?.panel === 'optional') setExpandedPanel(null);
                          else setExpandedPanel({ rowId: row.id, panel: 'optional' });
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors',
                          isExpanded && expandedPanel?.panel === 'optional' && 'text-primary'
                        )}
                      >
                        <SlidersHorizontal size={11} className={optFields.size > 0 ? 'text-primary' : 'text-muted-foreground/40'} />
                        <span className={cn('text-[11px]', optFields.size > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
                          {optFields.size > 0 ? `${optFields.size} active` : 'Add…'}
                        </span>
                        <ChevronDown size={10} className={cn('ml-auto transition-transform', isExpanded && expandedPanel?.panel === 'optional' && 'rotate-180 text-primary')} />
                      </button>
                      {isExpanded && expandedPanel?.panel === 'optional' && (
                        <OptionalFieldsPopup
                          row={row}
                          optFields={optFields}
                          freqMandatory={freqMandatory}
                          showFreqControl={showFreqControl}
                          showLeadGen={showLeadGen}
                          addOptField={addOptField}
                          removeOptField={removeOptField}
                          update={update}
                          onClose={() => setExpandedPanel(null)}
                        />
                      )}
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

                  {/* Expanded panel row — REMOVED: targeting and optional fields now use inline popups */}
                  {false && (
                    <tr key={`${row.id}-expanded`} className="border-b border-border bg-surface-2/10">
                      <td colSpan={15} className="p-0 overflow-hidden">
                        <div className="sticky left-0 px-6 py-4 space-y-4" style={{ width: 'min(100vw - 2rem, 860px)' }}>

                          {/* UNIFIED TARGETING PANEL — moved to modal, kept here as dead branch */}
                          {false && (
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
                                        placeholder="Type city, neighborhood, state, country, zip, or DMA…"
                                        className="flex-1 px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                                      />
                                      {searchingLocations && <span className="text-[10px] text-muted-foreground">Searching…</span>}
                                    </div>
                                    {/* Dropdown results */}
                                    {locationRowId === row.id && locationQuery.length >= 2 && locationResults != null && ((locationResults as { results?: unknown[] }).results?.length ?? 0) > 0 && (
                                      <div className="absolute z-50 mt-1 w-full bg-surface-1 border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {((locationResults as { results?: { key: string; name: string; type?: string; countryCode?: string; countryName?: string; region?: string }[] }).results ?? []).map((loc) => (
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
                                {/* Pin a specific address */}
                                {hasCredentials && (
                                  <div className="relative">
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">
                                      Pin a Specific Address
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        value={addressRowId === row.id ? addressQuery : ''}
                                        onChange={e => { setAddressQuery(e.target.value); setAddressRowId(row.id); }}
                                        onFocus={() => setAddressRowId(row.id)}
                                        placeholder="Type a street address, place, or business…"
                                        className="flex-1 px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                                      />
                                      {geocodingLoading && <span className="text-[10px] text-muted-foreground">Geocoding…</span>}
                                    </div>
                                    {/* Geocode results dropdown */}
                                    {addressRowId === row.id && addressQuery.length >= 3 && geocodeResults != null && ((geocodeResults as { results?: unknown[] }).results?.length ?? 0) > 0 && (
                                      <div className="absolute z-50 mt-1 w-full bg-surface-1 border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {((geocodeResults as { results?: { address: string; lat: number; lng: number; placeId: string }[] }).results ?? []).map((geo) => (
                                          <button
                                            key={geo.placeId}
                                            onClick={() => {
                                              const label = geo.address;
                                              const current = row.geoLocations ? row.geoLocations.split('\n').filter(Boolean) : [];
                                              const currentObjs = row.geoLocationObjects || [];
                                              if (!current.includes(label)) {
                                                update(row.id, {
                                                  geoLocations: [...current, label].join('\n'),
                                                  geoLocationObjects: [...currentObjs, {
                                                    key: geo.placeId,
                                                    type: 'custom_location',
                                                    name: label,
                                                    latitude: geo.lat,
                                                    longitude: geo.lng,
                                                    radius: 10,
                                                    distanceUnit: 'mile',
                                                  }],
                                                });
                                              }
                                              setAddressQuery('');
                                              setAddressRowId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-[12px] hover:bg-surface-2 transition-colors flex items-center justify-between gap-2">
                                            <span className="text-foreground">{geo.address}</span>
                                            <span className="text-[10px] text-muted-foreground/60">📍 Pin</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Selected locations chips with radius controls */}
                                {row.geoLocations && (
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block">Selected Locations</label>
                                    <div className="space-y-1.5">
                                      {row.geoLocations.split('\n').filter(Boolean).map((loc, i) => {
                                        const geoObj = (row.geoLocationObjects || [])[i];
                                        const geoType = (geoObj?.type || '').toLowerCase();
                                        const supportsRadius = geoObj && ['city', 'subcity', 'neighborhood', 'custom_location'].includes(geoType);
                                        const isCustom = geoType === 'custom_location';
                                        return (
                                          <div key={i} className="flex items-center gap-2 flex-wrap">
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[11px] text-primary">
                                              {loc}
                                              <button onClick={() => {
                                                const updated = row.geoLocations!.split('\n').filter((l, li) => li !== i).join('\n');
                                                const updatedObjs = (row.geoLocationObjects || []).filter((_, oi) => oi !== i);
                                                update(row.id, { geoLocations: updated, geoLocationObjects: updatedObjs });
                                              }} className="hover:text-red-400 transition-colors"><X size={10} /></button>
                                            </span>
                                            {supportsRadius && (
                                              <div className="flex items-center gap-1">
                                                <input
                                                  type="number"
                                                  min={isCustom ? 1 : (geoObj.distanceUnit === 'kilometer' ? 17 : 10)}
                                                  max={geoObj.distanceUnit === 'kilometer' ? 80 : 50}
                                                  value={geoObj.radius || ''}
                                                  onChange={e => {
                                                    const val = e.target.value ? Number(e.target.value) : undefined;
                                                    const updatedObjs = [...(row.geoLocationObjects || [])];
                                                    updatedObjs[i] = { ...updatedObjs[i], radius: val };
                                                    update(row.id, { geoLocationObjects: updatedObjs });
                                                  }}
                                                  placeholder="Radius"
                                                  className="w-16 px-1.5 py-0.5 text-[10px] bg-surface-2/50 border border-border rounded text-center outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                                                />
                                                <select
                                                  value={geoObj.distanceUnit || 'mile'}
                                                  onChange={e => {
                                                    const updatedObjs = [...(row.geoLocationObjects || [])];
                                                    updatedObjs[i] = { ...updatedObjs[i], distanceUnit: e.target.value as 'mile' | 'kilometer' };
                                                    update(row.id, { geoLocationObjects: updatedObjs });
                                                  }}
                                                  className="px-1 py-0.5 text-[10px] bg-surface-2/50 border border-border rounded outline-none focus:border-primary/50 text-foreground"
                                                >
                                                  <option value="mile">mi</option>
                                                  <option value="kilometer">km</option>
                                                </select>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
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
                                              // Store aud.id (numeric Meta ID) so the API mapper can send correct IDs
                                              const isSel = (row.targetedAudiences || '').split('\n').filter(Boolean).some(entry => entry.split('|')[0] === aud.id);
                                              return (
                                                <button key={aud.id} onClick={() => {
                                                  const cur = row.targetedAudiences ? row.targetedAudiences.split('\n').filter(Boolean) : [];
                                                  // Store as "id|name" so we can display the name in chips but pass the ID to Meta
                                                  const entry = `${aud.id}|${aud.name}`;
                                                  update(row.id, { targetedAudiences: isSel ? cur.filter(a => a.split('|')[0] !== aud.id).join('\n') : [...cur, entry].join('\n') });
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
                                            {row.targetedAudiences.split('\n').filter(Boolean).map((entry, i) => {
                                              const [, displayName] = entry.includes('|') ? entry.split('|') : [entry, entry];
                                              return (
                                              <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-primary">
                                                {displayName}
                                                <button onClick={() => update(row.id, { targetedAudiences: row.targetedAudiences!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-red-400"><X size={9} /></button>
                                              </span>
                                              );
                                            })}
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
                                              // Store aud.id (numeric Meta ID) so the API mapper can send correct IDs
                                              const isExcl = (row.excludedAudiences || '').split('\n').filter(Boolean).some(entry => entry.split('|')[0] === aud.id);
                                              return (
                                                <button key={aud.id} onClick={() => {
                                                  const cur = row.excludedAudiences ? row.excludedAudiences.split('\n').filter(Boolean) : [];
                                                  const entry = `${aud.id}|${aud.name}`;
                                                  update(row.id, { excludedAudiences: isExcl ? cur.filter(a => a.split('|')[0] !== aud.id).join('\n') : [...cur, entry].join('\n') });
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
                                            {row.excludedAudiences.split('\n').filter(Boolean).map((entry, i) => {
                                              const [, displayName] = entry.includes('|') ? entry.split('|') : [entry, entry];
                                              return (
                                              <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-400">
                                                {displayName}
                                                <button onClick={() => update(row.id, { excludedAudiences: row.excludedAudiences!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-red-600"><X size={9} /></button>
                                              </span>
                                              );
                                            })}
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
      </div>{/* end main content */}

      {/* ── Audience Builder Modal ─────────────────────────────────────────── */}
      {audienceBuilderOpen && settings && (
        <AudienceBuilderModal
          accessToken={settings.accessToken}
          adAccountId={settings.adAccountId}
          pixelId={settings.pixelId}
          facebookPageId={settings.facebookPageId}
          instagramUserId={settings.instagramUserId}
          onCreated={(aud) => {
            toast.success(`Audience "${aud.name}" created and ready to use (ID: ${aud.id})`);
          }}
          onClose={() => setAudienceBuilderOpen(false)}
        />
      )}

      {/* ── Pre-Launch QA Rail (flex push, not overlay) ────────────────────── */}
      {qaOpen ? (
        <div
          className="flex flex-col shrink-0 border-l"
          style={{
            width: 280,
            background: '#0e0d3a',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <Info size={13} className="text-amber-400" />
              <span className="text-[13px] font-700 text-white">Pre-Launch QA</span>
            </div>
            <button onClick={() => setQaOpen(false)} className="text-white/40 hover:text-white/80 transition-colors"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-600 text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
                <AlertTriangle size={9} /> {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-600 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            {qaIssues.length === 0 && (
              <span className="flex items-center gap-1 text-[10px] font-600 text-emerald-400">
                <Check size={10} /> All checks passed
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {qaIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <Check size={24} className="text-emerald-400" />
                <p className="text-[12px] text-white/50">No issues found. Ready to launch.</p>
              </div>
            ) : (
              qaIssues.map((issue, i) => (
                <div key={i} className={cn(
                  'rounded-lg border p-3 space-y-1.5',
                  issue.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                  issue.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-blue-500/5 border-blue-500/20'
                )}>
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      'text-[9px] font-700 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 mt-0.5',
                      issue.type === 'error' ? 'bg-red-500/15 text-red-400' :
                      issue.type === 'warning' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-blue-500/15 text-blue-400'
                    )}>{issue.type}</span>
                    <span className="text-[11px] text-white/80">{issue.message}</span>
                  </div>
                  {issue.rowName && (
                    <p className="text-[10px] text-white/40 pl-7">{issue.rowName}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Collapsed QA tab */
        <button
          onClick={() => setQaOpen(true)}
          className="flex flex-col items-center justify-center shrink-0 border-l transition-colors hover:bg-white/5"
          style={{
            width: 44,
            background: '#0e0d3a',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
          title="Open Pre-Launch QA"
        >
          <span
            className="text-[10px] font-700 tracking-widest uppercase whitespace-nowrap"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              color: errorCount > 0 ? '#f87171' : warningCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.35)',
            }}
          >
            QA{(errorCount > 0 || warningCount > 0) ? ` · ${errorCount > 0 ? errorCount : warningCount}` : ''}
          </span>
        </button>
      )}


      {/* ── Analysis Modal (Reach + Overlap) ─────────────────────────────────── */}
      {analysisModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} onClick={() => setAnalysisModal(null)}>
          <div className="rounded-2xl shadow-2xl w-[700px] max-w-[95vw] max-h-[88vh] flex flex-col" style={{ background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-3">
                <BarChart2 size={14} className="text-primary" />
                <span className="text-[14px] font-700 text-foreground">Analysis</span>
                {selectedRows.size > 0 && (
                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-600">{selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected</span>
                )}
              </div>
              <button onClick={() => setAnalysisModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
            </div>
            {/* Tab bar */}
            <div className="flex items-center gap-0.5 px-5 pt-3 border-b border-border">
              {(['reach', 'overlap'] as const).map(tab => (
                <button key={tab} onClick={() => setAnalysisModal({ tab })}
                  className={cn(
                    'px-4 py-2 text-[11px] font-600 border-b-2 -mb-px transition-all capitalize',
                    analysisModal.tab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}>
                  {tab === 'reach' ? '📊 Reach Estimate' : '👥 Audience Overlap'}
                </button>
              ))}
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {analysisModal.tab === 'reach' && (
                <ReachEstimatePanel
                  rows={selectedRows.size > 0 ? selectedAdSets : rows}
                  settings={settings}
                  history={reachHistory}
                  onHistoryChange={onReachHistoryChange}
                  onRunOverlap={handleRunOverlapFromReach}
                  overlapRunning={overlapRunning}
                />
              )}
              {analysisModal.tab === 'overlap' && (
                <AudienceOverlapPanel
                  rows={selectedRows.size > 0 ? selectedAdSets : rows}
                  settings={settings}
                  history={overlapHistory}
                  onHistoryChange={onOverlapHistoryChange}
                />
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <button onClick={() => setAnalysisModal(null)}
                className="px-4 py-1.5 rounded border border-border text-[12px] font-600 text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
              {selectedRows.size === 0 && (
                <span className="text-[10px] text-muted-foreground/50">Tip: check rows to scope analysis to specific ad sets</span>
              )}
            </div>
          </div>
        </div>
      )}



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
      {/* ── Bulk Edit Panel ────────────────────────────────────────────────────── */}
      {bulkEditOpen && (
        <BulkEditPanel
          selectedRows={selectedAdSets}
          allRows={rows}
          onChange={onChange}
          onClose={() => setBulkEditOpen(false)}
          settings={settings}
        />
      )}
      {/* ── Bulk Duplicate Modal ───────────────────────────────────────────────── */}
      {bulkDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setBulkDuplicateModal(false)}>
          <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[420px] max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-700 text-foreground">Bulk Duplicate Ad Sets</span>
              <button onClick={() => setBulkDuplicateModal(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Duplicate <span className="font-700 text-foreground">{selectedRows.size}</span> selected ad set{selectedRows.size !== 1 ? 's' : ''} into the chosen campaign. All settings will be carried over.
            </p>
            <div>
              <label className="text-[10px] font-700 text-muted-foreground tracking-wider uppercase block mb-1">Destination Campaign</label>
              <select
                value={bulkDupCampaign}
                onChange={e => setBulkDupCampaign(e.target.value)}
                className="w-full px-3 py-2 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50"
              >
                {campaigns.map(c => (
                  <option key={c.id} value={c.name}>{c.name || `Campaign ${c.id.slice(0, 4)}`}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setBulkDuplicateModal(false)}
                className="px-3 py-1.5 rounded border border-border text-[12px] font-600 text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                disabled={!bulkDupCampaign}
                onClick={() => {
                  const targetCampaign = bulkDupCampaign;
                  const existingInCampaign = rows.filter(r => r.campaignName === targetCampaign).length;
                  const newRows: AdSetRow[] = [];
                  selectedAdSets.forEach((row, i) => {
                    newRows.push({
                      ...row,
                      id: genId(),
                      campaignName: targetCampaign,
                      name: `Ad Set #${existingInCampaign + i + 1}`,
                      adSetId: '',
                    });
                  });
                  onChange([...rows, ...newRows]);
                  toast.success(`Duplicated ${newRows.length} ad set${newRows.length !== 1 ? 's' : ''} into "${targetCampaign}"`);
                  setBulkDuplicateModal(false);
                  setSelectedRows(new Set());
                }}
                className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-[12px] font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Duplicate {selectedRows.size} Ad Set{selectedRows.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
