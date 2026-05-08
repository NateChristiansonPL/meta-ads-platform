/**
 * BulkEditPanelAdmin — slide-in drawer for bulk-editing multiple ad sets at once.
 * Each field has an individual enable toggle so only checked fields are applied.
 * Supports: budget type/amount, start/end datetime, optimization goal, conversion
 * event, locations (add/replace), custom/LAL targeted audiences (add/replace),
 * excluded audiences (add/replace).
 *
 * Used by both AdSetsTableAdmin (spreadsheet) and PillarHubAdmin (pillar view).
 */
import React, { useState, useCallback } from 'react';
import {
  X, Check, ChevronDown, DollarSign, Calendar, Target, MapPin, Users, Minus, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AdSetRow, BuildSettings, OPTIMIZATION_GOAL_LABELS, OptimizationGoal,
  conversionEventApplicable,
} from './campaignStoreAdmin';
import { trpc } from '@/lib/trpc';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BulkEditPanelProps {
  /** The ad sets that will be edited */
  selectedRows: AdSetRow[];
  /** All ad sets (needed to apply changes) */
  allRows: AdSetRow[];
  /** Called with the full updated rows array */
  onChange: (rows: AdSetRow[]) => void;
  /** Called to close the panel */
  onClose: () => void;
  settings?: BuildSettings;
}

type LocationMode = 'add' | 'replace';
type AudienceMode = 'add' | 'replace';

interface BulkFields {
  budgetType: 'DAILY' | 'LIFETIME';
  budget: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  optimizationGoal: OptimizationGoal;
  conversionEvent: string;
  locationsToAdd: string[];          // display labels
  locationsMode: LocationMode;
  targetedAudiencesToAdd: string[];  // display names
  targetedAudiencesMode: AudienceMode;
  excludedAudiencesToAdd: string[];
  excludedAudiencesMode: AudienceMode;
}

interface EnabledFields {
  budget: boolean;
  dates: boolean;
  optimizationGoal: boolean;
  conversionEvent: boolean;
  locations: boolean;
  targetedAudiences: boolean;
  excludedAudiences: boolean;
}

// ── Toggle row helper ─────────────────────────────────────────────────────────

function FieldToggle({
  label, icon, enabled, onToggle, children,
}: {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'rounded-lg border transition-all',
      enabled ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-surface-2/20 opacity-60',
    )}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" onClick={onToggle}>
        <div className={cn(
          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
          enabled ? 'bg-primary border-primary' : 'border-border bg-transparent',
        )}>
          {enabled && <Check size={10} className="text-primary-foreground" />}
        </div>
        <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        <span className="text-[12px] font-700 text-foreground">{label}</span>
      </div>
      {enabled && (
        <div className="px-3 pb-3 pt-0 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Mode toggle (Add / Replace) ───────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: 'add' | 'replace'; onChange: (m: 'add' | 'replace') => void }) {
  return (
    <div className="flex gap-1 mb-2">
      {(['add', 'replace'] as const).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'px-2.5 py-0.5 rounded text-[10px] font-700 border transition-all',
            mode === m
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {m === 'add' ? '+ Add to existing' : '↺ Replace all'}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BulkEditPanel({ selectedRows, allRows, onChange, onClose, settings }: BulkEditPanelProps) {
  const hasCredentials = !!(settings?.accessToken && settings?.adAccountId);
  const hasPixel = !!(settings?.pixelId && hasCredentials);

  // ── Remote data ─────────────────────────────────────────────────────────────
  const { data: pixelEventsData } = trpc.adminMeta.getPixelEvents.useQuery(
    { accessToken: settings?.accessToken ?? '', pixelId: settings?.pixelId ?? '', adAccountId: settings?.adAccountId ?? '' },
    { enabled: hasPixel, staleTime: 5 * 60 * 1000 },
  );
  const pixelEvents = pixelEventsData?.events ?? [];

  const [audienceSearch, setAudienceSearch] = useState('');
  const { data: customAudiencesData, isLoading: loadingAudiences } = trpc.adminMeta.getCustomAudiences.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', search: audienceSearch || undefined },
    { enabled: hasCredentials && audienceSearch.trim().length >= 2, staleTime: 2 * 60 * 1000 },
  );
  const customAudiences = customAudiencesData?.audiences ?? [];

  const [locationQuery, setLocationQuery] = useState('');
  const { data: locationResults, isFetching: searchingLocations } = trpc.adminMeta.searchGeoLocations.useQuery(
    { accessToken: settings?.accessToken ?? '', query: locationQuery, location_types: ['city', 'region', 'country', 'zip'] },
    { enabled: hasCredentials && locationQuery.trim().length >= 2, staleTime: 60 * 1000 },
  );
  const geoResults = (locationResults as { results?: { key: string; name: string; type: string; region?: string; countryName?: string }[] })?.results ?? [];

  // ── Local field state ────────────────────────────────────────────────────────
  const [fields, setFields] = useState<BulkFields>({
    budgetType: 'DAILY',
    budget: '',
    startDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '20:00',
    optimizationGoal: 'LINK_CLICKS',
    conversionEvent: '',
    locationsToAdd: [],
    locationsMode: 'add',
    targetedAudiencesToAdd: [],
    targetedAudiencesMode: 'add',
    excludedAudiencesToAdd: [],
    excludedAudiencesMode: 'add',
  });

  const [enabled, setEnabled] = useState<EnabledFields>({
    budget: false,
    dates: false,
    optimizationGoal: false,
    conversionEvent: false,
    locations: false,
    targetedAudiences: false,
    excludedAudiences: false,
  });

  const setField = useCallback(<K extends keyof BulkFields>(key: K, val: BulkFields[K]) => {
    setFields(f => ({ ...f, [key]: val }));
  }, []);

  const toggleEnabled = useCallback((key: keyof EnabledFields) => {
    setEnabled(e => ({ ...e, [key]: !e[key] }));
  }, []);

  // ── Apply ────────────────────────────────────────────────────────────────────
  const applyCount = Object.values(enabled).filter(Boolean).length;

  const handleApply = useCallback(() => {
    if (!applyCount) return;
    const selectedIds = new Set(selectedRows.map(r => r.id));
    const updated = allRows.map(row => {
      if (!selectedIds.has(row.id)) return row;
      const patch: Partial<AdSetRow> = {};

      if (enabled.budget) {
        patch.budgetType = fields.budgetType;
        if (fields.budget) patch.budget = fields.budget;
      }

      if (enabled.dates) {
        if (fields.startDate) { patch.startDate = fields.startDate; patch.startTime = fields.startTime; }
        if (fields.endDate) { patch.endDate = fields.endDate; patch.endTime = fields.endTime; }
      }

      if (enabled.optimizationGoal) {
        patch.optimizationGoal = fields.optimizationGoal;
      }

      if (enabled.conversionEvent) {
        patch.conversionEvent = fields.conversionEvent;
      }

      if (enabled.locations && fields.locationsToAdd.length > 0) {
        if (fields.locationsMode === 'replace') {
          patch.geoLocations = fields.locationsToAdd.join('\n');
          patch.geoLocationObjects = [];
        } else {
          const existing = row.geoLocations ? row.geoLocations.split('\n').filter(Boolean) : [];
          const newLocs = fields.locationsToAdd.filter(l => !existing.includes(l));
          patch.geoLocations = [...existing, ...newLocs].join('\n');
        }
      }

      if (enabled.targetedAudiences && fields.targetedAudiencesToAdd.length > 0) {
        if (fields.targetedAudiencesMode === 'replace') {
          patch.targetedAudiences = fields.targetedAudiencesToAdd.join('\n');
        } else {
          const existing = row.targetedAudiences ? row.targetedAudiences.split('\n').filter(Boolean) : [];
          const newAuds = fields.targetedAudiencesToAdd.filter(a => !existing.includes(a));
          patch.targetedAudiences = [...existing, ...newAuds].join('\n');
        }
      }

      if (enabled.excludedAudiences && fields.excludedAudiencesToAdd.length > 0) {
        if (fields.excludedAudiencesMode === 'replace') {
          patch.excludedAudiences = fields.excludedAudiencesToAdd.join('\n');
        } else {
          const existing = row.excludedAudiences ? row.excludedAudiences.split('\n').filter(Boolean) : [];
          const newAuds = fields.excludedAudiencesToAdd.filter(a => !existing.includes(a));
          patch.excludedAudiences = [...existing, ...newAuds].join('\n');
        }
      }

      return { ...row, ...patch };
    });
    onChange(updated);
    onClose();
  }, [applyCount, enabled, fields, selectedRows, allRows, onChange, onClose]);

  const showConvEvent = conversionEventApplicable(fields.optimizationGoal);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[151] flex flex-col shadow-2xl"
        style={{
          width: 420,
          background: 'var(--surface-1, #0e0d3a)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-[14px] font-700 text-foreground">Bulk Edit Ad Sets</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Editing <span className="text-primary font-700">{selectedRows.length}</span> ad set{selectedRows.length !== 1 ? 's' : ''}.
              Check a field to include it in the update.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Selected ad set names */}
        <div className="px-5 py-2 border-b border-border flex-shrink-0">
          <div className="flex flex-wrap gap-1">
            {selectedRows.slice(0, 6).map(r => (
              <span key={r.id} className="text-[10px] bg-surface-2 border border-border px-2 py-0.5 rounded-full text-muted-foreground truncate max-w-[160px]">
                {r.name || 'Untitled'}
              </span>
            ))}
            {selectedRows.length > 6 && (
              <span className="text-[10px] text-muted-foreground/60 px-1 py-0.5">+{selectedRows.length - 6} more</span>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Budget */}
          <FieldToggle label="Budget" icon={<DollarSign size={13} />} enabled={enabled.budget} onToggle={() => toggleEnabled('budget')}>
            <div className="flex gap-2">
              <div className="flex gap-1">
                {(['DAILY', 'LIFETIME'] as const).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setField('budgetType', bt)}
                    className={cn(
                      'px-2.5 py-1 rounded border text-[11px] font-600 transition-all',
                      fields.budgetType === bt
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {bt === 'DAILY' ? 'Daily' : 'Lifetime'}
                  </button>
                ))}
              </div>
              <input
                className="flex-1 px-2.5 py-1 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                value={fields.budget}
                onChange={e => setField('budget', e.target.value)}
                placeholder="Amount ($)"
              />
            </div>
          </FieldToggle>

          {/* Dates */}
          <FieldToggle label="Schedule Dates" icon={<Calendar size={13} />} enabled={enabled.dates} onToggle={() => toggleEnabled('dates')}>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">Start</label>
                <input
                  type="datetime-local"
                  className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                  value={fields.startDate ? `${fields.startDate}T${fields.startTime}` : ''}
                  onChange={e => {
                    const [d, t] = e.target.value.split('T');
                    setField('startDate', d ?? '');
                    setField('startTime', t ?? '08:00');
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">End</label>
                <input
                  type="datetime-local"
                  className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                  value={fields.endDate ? `${fields.endDate}T${fields.endTime}` : ''}
                  onChange={e => {
                    const [d, t] = e.target.value.split('T');
                    setField('endDate', d ?? '');
                    setField('endTime', t ?? '20:00');
                  }}
                />
              </div>
            </div>
          </FieldToggle>

          {/* Optimization Goal */}
          <FieldToggle label="Optimization Goal" icon={<Target size={13} />} enabled={enabled.optimizationGoal} onToggle={() => toggleEnabled('optimizationGoal')}>
            <select
              className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
              value={fields.optimizationGoal}
              onChange={e => setField('optimizationGoal', e.target.value as OptimizationGoal)}
            >
              {Object.entries(OPTIMIZATION_GOAL_LABELS).map(([g, label]) => (
                <option key={g} value={g}>{label}</option>
              ))}
            </select>
          </FieldToggle>

          {/* Conversion Event — shown only when opt goal supports it */}
          {(enabled.optimizationGoal ? showConvEvent : true) && (
            <FieldToggle label="Conversion Event" icon={<Target size={13} />} enabled={enabled.conversionEvent} onToggle={() => toggleEnabled('conversionEvent')}>
              {pixelEvents.length > 0 ? (
                <select
                  className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                  value={fields.conversionEvent}
                  onChange={e => setField('conversionEvent', e.target.value)}
                >
                  <option value="">Select conversion event…</option>
                  {pixelEvents.map((ev: string) => (
                    <option key={ev} value={ev}>{ev}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                  value={fields.conversionEvent}
                  onChange={e => setField('conversionEvent', e.target.value)}
                  placeholder={hasPixel ? 'Loading events…' : 'e.g. Purchase'}
                />
              )}
            </FieldToggle>
          )}

          {/* Locations */}
          <FieldToggle label="Locations" icon={<MapPin size={13} />} enabled={enabled.locations} onToggle={() => toggleEnabled('locations')}>
            <ModeToggle mode={fields.locationsMode} onChange={m => setField('locationsMode', m)} />
            {/* Search */}
            <div className="relative">
              <input
                className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                value={locationQuery}
                onChange={e => setLocationQuery(e.target.value)}
                placeholder="Search city, state, country, zip…"
              />
              {searchingLocations && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground animate-pulse">searching…</span>
              )}
            </div>
            {/* Results */}
            {geoResults.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-2/80 max-h-[140px] overflow-y-auto">
                {geoResults.slice(0, 8).map((r: { key: string; name: string; type: string; region?: string; countryName?: string }) => {
                  const label = [r.name, r.region, r.countryName].filter(Boolean).join(', ');
                  const alreadyAdded = fields.locationsToAdd.includes(label);
                  return (
                    <button
                      key={r.key}
                      onClick={() => {
                        if (!alreadyAdded) setField('locationsToAdd', [...fields.locationsToAdd, label]);
                        setLocationQuery('');
                      }}
                      disabled={alreadyAdded}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0 flex items-center justify-between"
                    >
                      <span className="text-foreground">{label}</span>
                      {alreadyAdded
                        ? <Check size={10} className="text-primary flex-shrink-0" />
                        : <Plus size={10} className="text-muted-foreground flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Selected chips */}
            {fields.locationsToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {fields.locationsToAdd.map((loc, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {loc}
                    <button onClick={() => setField('locationsToAdd', fields.locationsToAdd.filter((_, li) => li !== i))}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {fields.locationsToAdd.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 italic">No locations added yet</p>
            )}
          </FieldToggle>

          {/* Targeted Audiences (Custom / LAL) */}
          <FieldToggle label="Targeted Audiences (Custom / LAL)" icon={<Users size={13} />} enabled={enabled.targetedAudiences} onToggle={() => toggleEnabled('targetedAudiences')}>
            <ModeToggle mode={fields.targetedAudiencesMode} onChange={m => setField('targetedAudiencesMode', m)} />
            <div className="relative">
              <input
                className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                value={audienceSearch}
                onChange={e => setAudienceSearch(e.target.value)}
                placeholder="Search custom / lookalike audiences…"
              />
              {loadingAudiences && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground animate-pulse">loading…</span>
              )}
            </div>
            {customAudiences.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-2/80 max-h-[140px] overflow-y-auto">
                {customAudiences.map((aud: { id: string; name: string; subtype?: string }) => {
                  const alreadyAdded = fields.targetedAudiencesToAdd.includes(aud.name);
                  return (
                    <button
                      key={aud.id}
                      onClick={() => {
                        if (!alreadyAdded) setField('targetedAudiencesToAdd', [...fields.targetedAudiencesToAdd, aud.name]);
                      }}
                      disabled={alreadyAdded}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0 flex items-center justify-between"
                    >
                      <span className="text-foreground">{aud.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {aud.subtype && <span className="text-[9px] text-muted-foreground/60 bg-surface-2 px-1 rounded">{aud.subtype}</span>}
                        {alreadyAdded
                          ? <Check size={10} className="text-primary" />
                          : <Plus size={10} className="text-muted-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {fields.targetedAudiencesToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {fields.targetedAudiencesToAdd.map((aud, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {aud}
                    <button onClick={() => setField('targetedAudiencesToAdd', fields.targetedAudiencesToAdd.filter((_, li) => li !== i))}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {fields.targetedAudiencesToAdd.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 italic">No audiences added yet</p>
            )}
          </FieldToggle>

          {/* Excluded Audiences */}
          <FieldToggle label="Excluded Audiences" icon={<Minus size={13} />} enabled={enabled.excludedAudiences} onToggle={() => toggleEnabled('excludedAudiences')}>
            <ModeToggle mode={fields.excludedAudiencesMode} onChange={m => setField('excludedAudiencesMode', m)} />
            <div className="relative">
              <input
                className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                value={audienceSearch}
                onChange={e => setAudienceSearch(e.target.value)}
                placeholder="Search audiences to exclude…"
              />
            </div>
            {customAudiences.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-2/80 max-h-[140px] overflow-y-auto">
                {customAudiences.map((aud: { id: string; name: string; subtype?: string }) => {
                  const alreadyAdded = fields.excludedAudiencesToAdd.includes(aud.name);
                  return (
                    <button
                      key={aud.id}
                      onClick={() => {
                        if (!alreadyAdded) setField('excludedAudiencesToAdd', [...fields.excludedAudiencesToAdd, aud.name]);
                      }}
                      disabled={alreadyAdded}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0 flex items-center justify-between"
                    >
                      <span className="text-foreground">{aud.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {aud.subtype && <span className="text-[9px] text-muted-foreground/60 bg-surface-2 px-1 rounded">{aud.subtype}</span>}
                        {alreadyAdded
                          ? <Check size={10} className="text-primary" />
                          : <Plus size={10} className="text-muted-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {fields.excludedAudiencesToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {fields.excludedAudiencesToAdd.map((aud, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                    {aud}
                    <button onClick={() => setField('excludedAudiencesToAdd', fields.excludedAudiencesToAdd.filter((_, li) => li !== i))}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {fields.excludedAudiencesToAdd.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 italic">No exclusions added yet</p>
            )}
          </FieldToggle>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            {applyCount > 0
              ? <><span className="text-primary font-700">{applyCount}</span> field{applyCount !== 1 ? 's' : ''} will be updated</>
              : 'Check fields above to include in update'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-600 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applyCount === 0}
              className={cn(
                'px-4 py-1.5 rounded-lg text-[12px] font-700 transition-all flex items-center gap-1.5',
                applyCount > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-surface-2 text-muted-foreground/40 cursor-not-allowed border border-border/30',
              )}
            >
              <Check size={12} />
              Apply to {selectedRows.length} ad set{selectedRows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
