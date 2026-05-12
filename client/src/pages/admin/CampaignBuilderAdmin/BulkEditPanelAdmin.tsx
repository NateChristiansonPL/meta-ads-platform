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
  UserRound, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AdSetRow, BuildSettings, OPTIMIZATION_GOAL_LABELS, OptimizationGoal,
  conversionEventApplicable, LANGUAGE_OPTIONS, TREE_FIELDS, FrequencyControl,
  frequencyControlApplicable, PLATFORM_PLACEMENTS, InterestObject,
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

type NameMode = 'prefix' | 'suffix' | 'replace';
interface BulkFields {
  nameValue: string;
  nameMode: NameMode;
  budgetType: 'DAILY' | 'LIFETIME';
  budget: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  optimizationGoal: OptimizationGoal;
  conversionEvent: string;
  ageMin: string;
  ageMax: string;
  genders: string;
  locationsToAdd: string[];          // display labels
  locationsMode: LocationMode;
  targetedAudiencesToAdd: string[];  // id|name format
  targetedAudiencesMode: AudienceMode;
  excludedAudiencesToAdd: string[];  // id|name format
  excludedAudiencesMode: AudienceMode;
  // placements
  placementType: 'advantage_plus' | 'manual';
  platforms: string[];
  placements: string[];
  // detailed targeting
  detailedInterestObjects: InterestObject[];
  detailedInterestsMode: 'add' | 'replace';
  narrowInterestObjects: InterestObject[];
  narrowInterestsMode: 'add' | 'replace';
  // optional fields
  language: string;
  operatingSystem: string;
  devicePlatforms: string;
  attributionWindow: string;
  attributionModel: string;
  frequencyControl?: FrequencyControl;
}

interface EnabledFields {
  name: boolean;
  budget: boolean;
  dates: boolean;
  optimizationGoal: boolean;
  conversionEvent: boolean;
  ageGender: boolean;
  locations: boolean;
  targetedAudiences: boolean;
  excludedAudiences: boolean;
  placements: boolean;
  detailedTargeting: boolean;
  narrowTargeting: boolean;
  // optional fields (each individually toggled inside the collapsed section)
  language: boolean;
  operatingSystem: boolean;
  devicePlatforms: boolean;
  attributionWindow: boolean;
  attributionModel: boolean;
  frequencyControl: boolean;
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
  // ── Detailed targeting search ─────────────────────────────────────────────
  const [detailedQuery, setDetailedQuery] = useState('');
  const [detailedType, setDetailedType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const [narrowQuery, setNarrowQuery] = useState('');
  const [narrowType, setNarrowType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const { data: detailedResults, isFetching: searchingDetailed } = trpc.adminMeta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: detailedQuery, type: detailedType },
    { enabled: hasCredentials && detailedQuery.trim().length >= 2, staleTime: 60 * 1000 },
  );
  const { data: narrowResults, isFetching: searchingNarrow } = trpc.adminMeta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: narrowQuery, type: narrowType },
    { enabled: hasCredentials && narrowQuery.trim().length >= 2, staleTime: 60 * 1000 },
  );
  const detailedSearchResults = (detailedResults as { results?: { id: string; name: string; type?: string; audience_size?: number }[] })?.results ?? [];
  const narrowSearchResults = (narrowResults as { results?: { id: string; name: string; type?: string; audience_size?: number }[] })?.results ?? [];

  // ── Pre-populate helper: returns the shared value if all rows agree, else the fallback ──
  function shared<T>(getter: (r: AdSetRow) => T | undefined, fallback: T): T {
    if (!selectedRows.length) return fallback;
    const vals = selectedRows.map(getter);
    const first = vals[0];
    return vals.every(v => v === first) && first !== undefined ? first : fallback;
  }

  // ── Local field state (lazy initializer pre-populates shared values) ─────────
  const [fields, setFields] = useState<BulkFields>(() => ({
    nameValue: '',
    nameMode: 'suffix',
    // Budget — pre-fill if all selected rows share the same value
    budgetType: shared(r => r.budgetType, 'DAILY'),
    budget: shared(r => r.budget ? String(r.budget) : undefined, ''),
    // Dates
    startDate: shared(r => r.startDate || undefined, ''),
    startTime: shared(r => r.startTime || undefined, '08:00'),
    endDate: shared(r => r.endDate || undefined, ''),
    endTime: shared(r => r.endTime || undefined, '20:00'),
    // Optimization
    optimizationGoal: shared(r => r.optimizationGoal || undefined, 'LINK_CLICKS' as OptimizationGoal),
    conversionEvent: shared(r => r.conversionEvent || undefined, ''),
    // Age & gender
    ageMin: shared(r => r.ageMin ? String(r.ageMin) : undefined, '18'),
    ageMax: shared(r => r.ageMax ? String(r.ageMax) : undefined, '65'),
    genders: shared(r => r.genders || undefined, 'all'),
    // Audiences (always start empty in add mode — merging makes more sense)
    locationsToAdd: [],
    locationsMode: 'add',
    targetedAudiencesToAdd: [],
    targetedAudiencesMode: 'add',
    excludedAudiencesToAdd: [],
    excludedAudiencesMode: 'add',
    // Placements
    placementType: shared(r => r.placementType || undefined, 'manual' as const),
    platforms: [],
    placements: [],
    // Detailed targeting (always start empty in add mode)
    detailedInterestObjects: [],
    detailedInterestsMode: 'add',
    narrowInterestObjects: [],
    narrowInterestsMode: 'add',
    // Optional
    language: shared(r => r.language || undefined, ''),
    operatingSystem: shared(r => r.operatingSystem || undefined, 'all'),
    devicePlatforms: shared(r => r.devicePlatforms || undefined, 'all'),
    attributionWindow: shared(r => r.attributionWindow || undefined, '7d_click_1d_engaged_1d_view'),
    attributionModel: shared(r => r.attributionModel || undefined, 'standard'),
  }));
  const [enabled, setEnabled] = useState<EnabledFields>({
    name: false,
    budget: false,
    dates: false,
    optimizationGoal: false,
    conversionEvent: false,
    ageGender: false,
    locations: false,
    targetedAudiences: false,
    excludedAudiences: false,
    placements: false,
    detailedTargeting: false,
    narrowTargeting: false,
    language: false,
    operatingSystem: false,
    devicePlatforms: false,
    attributionWindow: false,
    attributionModel: false,
    frequencyControl: false,
  });
  const [optionalOpen, setOptionalOpen] = useState(false);

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

      if (enabled.name && fields.nameValue) {
        const current = row.name || '';
        if (fields.nameMode === 'prefix') patch.name = fields.nameValue + current;
        else if (fields.nameMode === 'suffix') patch.name = current + fields.nameValue;
        else patch.name = fields.nameValue;
      }
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
          const existingIds = existing.map(a => a.split('|')[0]);
          const newAuds = fields.targetedAudiencesToAdd.filter(a => !existingIds.includes(a.split('|')[0]));
          patch.targetedAudiences = [...existing, ...newAuds].join('\n');
        }
      }

      if (enabled.excludedAudiences && fields.excludedAudiencesToAdd.length > 0) {
        if (fields.excludedAudiencesMode === 'replace') {
          patch.excludedAudiences = fields.excludedAudiencesToAdd.join('\n');
        } else {
          const existing = row.excludedAudiences ? row.excludedAudiences.split('\n').filter(Boolean) : [];
          const existingIds = existing.map(a => a.split('|')[0]);
          const newAuds = fields.excludedAudiencesToAdd.filter(a => !existingIds.includes(a.split('|')[0]));
          patch.excludedAudiences = [...existing, ...newAuds].join('\n');
        }
      }
      if (enabled.ageGender) {
        if (fields.ageMin) patch.ageMin = fields.ageMin;
        if (fields.ageMax) patch.ageMax = fields.ageMax;
        patch.genders = fields.genders;
      }
      if (enabled.placements) {
        patch.placementType = fields.placementType;
        patch.platforms = fields.platforms;
        patch.placements = fields.placements;
      }
      if (enabled.detailedTargeting) {
        const newObjs = fields.detailedInterestObjects;
        const newNames = newObjs.map(o => o.name);
        if (fields.detailedInterestsMode === 'replace') {
          patch.detailedInterests = newNames.join('\n');
          patch.detailedInterestObjects = newObjs;
        } else {
          const existingObjs = row.detailedInterestObjects ?? [];
          const existingIds = new Set(existingObjs.map(o => o.id));
          const toAdd = newObjs.filter(o => !existingIds.has(o.id));
          patch.detailedInterests = [...(row.detailedInterests ? row.detailedInterests.split('\n').filter(Boolean) : []), ...toAdd.map(o => o.name)].join('\n');
          patch.detailedInterestObjects = [...existingObjs, ...toAdd];
        }
      }
      if (enabled.narrowTargeting) {
        const newObjs = fields.narrowInterestObjects;
        const newNames = newObjs.map(o => o.name);
        if (fields.narrowInterestsMode === 'replace') {
          patch.narrowInterests = newNames.join('\n');
          patch.narrowInterestObjects = newObjs;
        } else {
          const existingObjs = row.narrowInterestObjects ?? [];
          const existingIds = new Set(existingObjs.map(o => o.id));
          const toAdd = newObjs.filter(o => !existingIds.has(o.id));
          patch.narrowInterests = [...(row.narrowInterests ? row.narrowInterests.split('\n').filter(Boolean) : []), ...toAdd.map(o => o.name)].join('\n');
          patch.narrowInterestObjects = [...existingObjs, ...toAdd];
        }
      }
      if (enabled.language) patch.language = fields.language || undefined;
      if (enabled.operatingSystem) patch.operatingSystem = fields.operatingSystem !== 'all' ? fields.operatingSystem : undefined;
      if (enabled.devicePlatforms) patch.devicePlatforms = fields.devicePlatforms !== 'all' ? fields.devicePlatforms : undefined;
      if (enabled.attributionWindow) patch.attributionWindow = fields.attributionWindow;
      if (enabled.attributionModel) patch.attributionModel = fields.attributionModel;
      if (enabled.frequencyControl) patch.frequencyControl = fields.frequencyControl;
      return { ...row, ...patch };
    });
    onChange(updated);
    onClose();
  }, [applyCount, enabled, fields, selectedRows, allRows, onChange, onClose]);

  const showConvEvent = conversionEventApplicable(fields.optimizationGoal);

  // ── Placement helpers (mirrors PillarHubAdmin logic) ───────────────────────
  const COMBINED_PLACEMENTS = [
    { key: 'feed',            label: 'Feed',            platforms: ['facebook', 'instagram'] },
    { key: 'stories',         label: 'Stories',          platforms: ['facebook', 'instagram', 'messenger'] },
    { key: 'reels',           label: 'Reels',            platforms: ['facebook', 'instagram'] },
    { key: 'profile_feed',    label: 'Profile Feed',     platforms: ['facebook', 'instagram'] },
    { key: 'reels_overlay',   label: 'Reels Overlay',    platforms: ['facebook'] },
    { key: 'right_column',    label: 'Right Column',     platforms: ['facebook'] },
    { key: 'marketplace',     label: 'Marketplace',      platforms: ['facebook'] },
    { key: 'search',          label: 'Search',           platforms: ['facebook', 'instagram'] },
    { key: 'business_explore',label: 'Business Explore', platforms: ['facebook'] },
    { key: 'notifications',   label: 'Notifications',    platforms: ['facebook'] },
    { key: 'instream_reels',  label: 'In-Stream Reels',  platforms: ['facebook'] },
    { key: 'explore_home',    label: 'Explore Home',     platforms: ['instagram'] },
    { key: 'threads_feed',    label: 'Threads Feed',     platforms: ['threads'] },
    { key: 'native',          label: 'Native',           platforms: ['audience_network'] },
    { key: 'banner',          label: 'Banner',           platforms: ['audience_network'] },
  ] as const;
  const COMBINED_TO_API: Record<string, string[]> = {
    feed:             ['facebook_feed', 'instagram_stream'],
    stories:          ['facebook_stories', 'instagram_stories', 'messenger_stories'],
    reels:            ['facebook_reels', 'instagram_reels'],
    profile_feed:     ['facebook_profile_feed', 'instagram_profile_feed'],
    reels_overlay:    ['facebook_reels_overlay'],
    right_column:     ['facebook_right_column'],
    marketplace:      ['facebook_marketplace'],
    search:           ['facebook_search', 'instagram_search'],
    business_explore: ['facebook_business_explore'],
    notifications:    ['facebook_notifications'],
    instream_reels:   ['facebook_instream_reels'],
    explore_home:     ['instagram_explore_home'],
    threads_feed:     ['threads_feed'],
    native:           ['audience_network_native'],
    banner:           ['audience_network_banner'],
  };
  const isCombinedSelected = (combinedKey: string) =>
    (COMBINED_TO_API[combinedKey] ?? []).some(k => fields.placements.includes(k));
  const toggleCombinedPlacement = (combinedKey: string) => {
    const apiKeys = COMBINED_TO_API[combinedKey] ?? [];
    const currentlySelected = isCombinedSelected(combinedKey);
    let next: string[];
    if (currentlySelected) {
      next = fields.placements.filter(p => !apiKeys.includes(p));
    } else {
      const toAdd = apiKeys.filter(k =>
        fields.platforms.some(pl => k.startsWith(pl === 'audience_network' ? 'audience_network' : pl))
      );
      next = [...fields.placements, ...toAdd.filter(k => !fields.placements.includes(k))];
    }
    setField('placements', next);
  };
  const togglePlatform = (p: string) => {
    const next = fields.platforms.includes(p)
      ? fields.platforms.filter(x => x !== p)
      : [...fields.platforms, p];
    const nextPlacements = fields.placements.filter(pl => next.some(np =>
      np === 'audience_network' ? pl.startsWith('audience_network') : pl.startsWith(np)
    ));
    setField('platforms', next);
    setField('placements', nextPlacements);
  };
  const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads',
    messenger: 'Messenger', audience_network: 'Audience Network',
  };
  const visibleCombined = COMBINED_PLACEMENTS.filter(cp =>
    cp.platforms.some(p => fields.platforms.includes(p))
  );

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

          {/* Name */}
          <FieldToggle label="Ad Set Name" icon={<span className="text-[11px]">✏️</span>} enabled={enabled.name} onToggle={() => toggleEnabled('name')}>
            <div className="flex gap-1 mb-1">
              {(['suffix', 'prefix', 'replace'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setField('nameMode', m)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-600 border transition-all capitalize',
                    fields.nameMode === m
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                  )}
                >{m}</button>
              ))}
            </div>
            <input
              className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
              placeholder={
                fields.nameMode === 'prefix' ? 'Text to add before name (e.g. "2026 - ")'
                : fields.nameMode === 'suffix' ? 'Text to add after name (e.g. " - V2")'
                : 'New name (replaces existing name)'
              }
              value={fields.nameValue}
              onChange={e => setField('nameValue', e.target.value)}
            />
            {fields.nameValue && (
              <p className="text-[10px] text-muted-foreground/60 italic">
                {fields.nameMode === 'prefix' && `Preview: "${fields.nameValue}<original name>"`}
                {fields.nameMode === 'suffix' && `Preview: "<original name>${fields.nameValue}"`}
                {fields.nameMode === 'replace' && `Preview: "${fields.nameValue}" (all selected ad sets get this exact name)`}
              </p>
            )}
          </FieldToggle>

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

          {/* Age & Gender */}
          <FieldToggle label="Age & Gender" icon={<UserRound size={13} />} enabled={enabled.ageGender} onToggle={() => toggleEnabled('ageGender')}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">Min Age</label>
                  <input
                    type="number"
                    min={18} max={65}
                    className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                    value={fields.ageMin}
                    onChange={e => setField('ageMin', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">Max Age</label>
                  <input
                    type="number"
                    min={18} max={65}
                    className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                    value={fields.ageMax}
                    onChange={e => setField('ageMax', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">Gender</label>
                <div className="flex gap-1">
                  {[{ value: 'all', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }].map(g => (
                    <button
                      key={g.value}
                      onClick={() => setField('genders', g.value)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-[11px] font-600 border transition-all',
                        fields.genders === g.value
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FieldToggle>

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

          {/* Placements */}
          <FieldToggle label="Placements" icon={<span className="text-[11px]">📲</span>} enabled={enabled.placements} onToggle={() => toggleEnabled('placements')}>
            <div className="space-y-2">
              {/* Advantage+ vs Manual toggle */}
              <div className="flex gap-1">
                {(['advantage_plus', 'manual'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setField('placementType', t)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-[11px] font-600 border transition-all',
                      fields.placementType === t
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                    )}
                  >{t === 'advantage_plus' ? 'Advantage+' : 'Manual'}</button>
                ))}
              </div>
              {fields.placementType === 'manual' && (
                <>
                  {/* Platform selector */}
                  <div>
                    <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">Platforms</label>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(PLATFORM_LABELS).map(p => (
                        <button
                          key={p}
                          onClick={() => togglePlatform(p)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-600 border transition-all',
                            fields.platforms.includes(p)
                              ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                          )}
                        >{PLATFORM_LABELS[p]}</button>
                      ))}
                    </div>
                  </div>
                  {/* Placement checkboxes — dynamic based on selected platforms */}
                  {fields.platforms.length > 0 && (
                    <div>
                      <label className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider block mb-1">Placements</label>
                      <div className="flex flex-wrap gap-1">
                        {visibleCombined.map(cp => (
                          <button
                            key={cp.key}
                            onClick={() => toggleCombinedPlacement(cp.key)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[11px] font-600 border transition-all',
                              isCombinedSelected(cp.key)
                                ? 'bg-primary/15 border-primary/40 text-primary'
                                : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                            )}
                          >{cp.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {fields.platforms.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/50 italic">Select at least one platform to see placements</p>
                  )}
                </>
              )}
              {fields.placementType === 'advantage_plus' && (
                <p className="text-[10px] text-muted-foreground/60 italic">Advantage+ Placements — Meta will automatically optimize placement delivery.</p>
              )}
            </div>
          </FieldToggle>

          {/* Detailed Targeting (Interests & Behaviors) */}
          <FieldToggle label="Detailed Targeting" icon={<Target size={13} />} enabled={enabled.detailedTargeting} onToggle={() => toggleEnabled('detailedTargeting')}>
            <ModeToggle mode={fields.detailedInterestsMode} onChange={m => setField('detailedInterestsMode', m)} />
            {/* Type selector */}
            <div className="flex gap-1">
              {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDetailedType(t)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-600 border transition-all',
                    detailedType === t
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                  )}
                >{t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}</button>
              ))}
            </div>
            <div className="relative">
              <input
                className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                placeholder="Search interests, behaviors..."
                value={detailedQuery}
                onChange={e => setDetailedQuery(e.target.value)}
              />
              {searchingDetailed && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">...</span>}
            </div>
            {detailedQuery.length >= 2 && detailedSearchResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                {detailedSearchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      const already = fields.detailedInterestObjects.some(o => o.id === r.id);
                      if (!already) {
                        setField('detailedInterestObjects', [...fields.detailedInterestObjects, { id: r.id, type: r.type || 'adinterest', name: r.name }]);
                      }
                      setDetailedQuery('');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-surface-2/60 border-b border-border/30 last:border-0 text-foreground"
                  >
                    <span className="font-600">{r.name}</span>
                    {r.audience_size && <span className="text-muted-foreground ml-1">({(r.audience_size / 1e6).toFixed(1)}M)</span>}
                  </button>
                ))}
              </div>
            )}
            {fields.detailedInterestObjects.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {fields.detailedInterestObjects.map((obj, i) => (
                  <span key={obj.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-600 bg-primary/10 text-primary border border-primary/20">
                    {obj.name}
                    <button onClick={() => setField('detailedInterestObjects', fields.detailedInterestObjects.filter((_, oi) => oi !== i))} className="hover:text-red-400"><X size={9} /></button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 italic">No interests added yet</p>
            )}
          </FieldToggle>

          {/* Narrow Targeting (AND layer) */}
          <FieldToggle label="Narrow Targeting (AND)" icon={<span className="text-[11px]">🔍</span>} enabled={enabled.narrowTargeting} onToggle={() => toggleEnabled('narrowTargeting')}>
            <ModeToggle mode={fields.narrowInterestsMode} onChange={m => setField('narrowInterestsMode', m)} />
            <div className="flex gap-1">
              {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNarrowType(t)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-600 border transition-all',
                    narrowType === t
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                  )}
                >{t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}</button>
              ))}
            </div>
            <div className="relative">
              <input
                className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                placeholder="Must also match..."
                value={narrowQuery}
                onChange={e => setNarrowQuery(e.target.value)}
              />
              {searchingNarrow && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">...</span>}
            </div>
            {narrowQuery.length >= 2 && narrowSearchResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                {narrowSearchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      const already = fields.narrowInterestObjects.some(o => o.id === r.id);
                      if (!already) {
                        setField('narrowInterestObjects', [...fields.narrowInterestObjects, { id: r.id, type: r.type || 'adinterest', name: r.name }]);
                      }
                      setNarrowQuery('');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-surface-2/60 border-b border-border/30 last:border-0 text-foreground"
                  >
                    <span className="font-600">{r.name}</span>
                    {r.audience_size && <span className="text-muted-foreground ml-1">({(r.audience_size / 1e6).toFixed(1)}M)</span>}
                  </button>
                ))}
              </div>
            )}
            {fields.narrowInterestObjects.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {fields.narrowInterestObjects.map((obj, i) => (
                  <span key={obj.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-600 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {obj.name}
                    <button onClick={() => setField('narrowInterestObjects', fields.narrowInterestObjects.filter((_, oi) => oi !== i))} className="hover:text-red-400"><X size={9} /></button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 italic">No narrow targets added yet</p>
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
                  const alreadyAdded = fields.targetedAudiencesToAdd.some(a => a.split('|')[0] === aud.id);
                  return (
                    <button
                      key={aud.id}
                      onClick={() => {
                        if (!alreadyAdded) setField('targetedAudiencesToAdd', [...fields.targetedAudiencesToAdd, `${aud.id}|${aud.name}`]);
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
                    {aud.includes('|') ? aud.split('|').slice(1).join('|') : aud}
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
                  const alreadyAdded = fields.excludedAudiencesToAdd.some(a => a.split('|')[0] === aud.id);
                  return (
                    <button
                      key={aud.id}
                      onClick={() => {
                        if (!alreadyAdded) setField('excludedAudiencesToAdd', [...fields.excludedAudiencesToAdd, `${aud.id}|${aud.name}`]);
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
                    {aud.includes('|') ? aud.split('|').slice(1).join('|') : aud}
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

          {/* ── Optional Fields (collapsed) ─────────────────────────────────── */}
          <div className={cn(
            'rounded-lg border transition-all',
            optionalOpen ? 'border-primary/20 bg-primary/3' : 'border-border/50 bg-surface-2/20',
          )}>
            {/* Header row — always visible */}
            <button
              onClick={() => setOptionalOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 select-none"
            >
              <Settings2 size={13} className="text-muted-foreground flex-shrink-0" />
              <span className="text-[12px] font-700 text-foreground flex-1 text-left">Optional Fields</span>
              {(() => {
                const activeOptCount = (['language', 'operatingSystem', 'devicePlatforms', 'attributionWindow', 'attributionModel', 'frequencyControl'] as const).filter(k => enabled[k]).length;
                return activeOptCount > 0 ? (
                  <span className="text-[10px] font-700 text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">{activeOptCount} active</span>
                ) : null;
              })()}
              <ChevronDown size={13} className={cn('text-muted-foreground transition-transform flex-shrink-0', optionalOpen && 'rotate-180')} />
            </button>

            {/* Expanded content */}
            {optionalOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/60 italic pb-1">Check a field to include it in the bulk update.</p>

                {/* Language */}
                <FieldToggle label="Language" icon={<span className="text-[11px]">🌐</span>} enabled={enabled.language} onToggle={() => toggleEnabled('language')}>
                  <select
                    className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                    value={fields.language}
                    onChange={e => setField('language', e.target.value)}
                  >
                    <option value="">Any language</option>
                    {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </FieldToggle>

                {/* Operating System */}
                <FieldToggle label="Operating System" icon={<span className="text-[11px]">📱</span>} enabled={enabled.operatingSystem} onToggle={() => toggleEnabled('operatingSystem')}>
                  <div className="flex gap-1">
                    {[{ value: 'all', label: 'All' }, { value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }].map(o => (
                      <button
                        key={o.value}
                        onClick={() => setField('operatingSystem', o.value)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-600 border transition-all',
                          fields.operatingSystem === o.value
                            ? 'bg-primary/15 border-primary/40 text-primary'
                            : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                        )}
                      >{o.label}</button>
                    ))}
                  </div>
                </FieldToggle>

                {/* Device Type */}
                <FieldToggle label="Device Type" icon={<span className="text-[11px]">💻</span>} enabled={enabled.devicePlatforms} onToggle={() => toggleEnabled('devicePlatforms')}>
                  <div className="flex gap-1">
                    {[{ value: 'all', label: 'All' }, { value: 'mobile', label: 'Mobile' }, { value: 'desktop', label: 'Desktop' }].map(d => (
                      <button
                        key={d.value}
                        onClick={() => setField('devicePlatforms', d.value)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-600 border transition-all',
                          fields.devicePlatforms === d.value
                            ? 'bg-primary/15 border-primary/40 text-primary'
                            : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                        )}
                      >{d.label}</button>
                    ))}
                  </div>
                </FieldToggle>

                {/* Attribution Window */}
                <FieldToggle label="Attribution Window" icon={<span className="text-[11px]">⏱</span>} enabled={enabled.attributionWindow} onToggle={() => toggleEnabled('attributionWindow')}>
                  <select
                    className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                    value={fields.attributionWindow}
                    onChange={e => setField('attributionWindow', e.target.value)}
                  >
                    <option value="7d_click_1d_engaged_1d_view">7-day click, 1-day engaged view, 1-day view (default)</option>
                    <option value="7d_click">7-day click</option>
                    <option value="1d_click">1-day click</option>
                    <option value="7d_click_1d_view">7-day click, 1-day view</option>
                    <option value="1d_click_1d_view">1-day click, 1-day view</option>
                  </select>
                </FieldToggle>

                {/* Attribution Model */}
                <FieldToggle label="Attribution Model" icon={<span className="text-[11px]">🔀</span>} enabled={enabled.attributionModel} onToggle={() => toggleEnabled('attributionModel')}>
                  <div className="flex gap-1">
                    {[{ value: 'standard', label: 'Standard' }, { value: 'incremental', label: 'Incremental' }].map(m => (
                      <button
                        key={m.value}
                        onClick={() => setField('attributionModel', m.value)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-600 border transition-all',
                          fields.attributionModel === m.value
                            ? 'bg-primary/15 border-primary/40 text-primary'
                            : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                        )}
                      >{m.label}</button>
                    ))}
                  </div>
                </FieldToggle>

                {/* Frequency Control — only shown when applicable */}
                {frequencyControlApplicable(fields.optimizationGoal) && (
                  <FieldToggle label="Frequency Control" icon={<span className="text-[11px]">🔁</span>} enabled={enabled.frequencyControl} onToggle={() => toggleEnabled('frequencyControl')}>
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {(['target', 'cap'] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setField('frequencyControl', { ...(fields.frequencyControl ?? { times: 2, days: 7, mode: 'target', enabled: true }), mode: m })}
                            className={cn(
                              'px-3 py-1 rounded-lg text-[11px] font-600 border transition-all',
                              (fields.frequencyControl?.mode ?? 'target') === m
                                ? 'bg-primary/15 border-primary/40 text-primary'
                                : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                            )}
                          >{m === 'target' ? 'Target Frequency' : 'Frequency Cap'}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground block mb-1">Times</label>
                          <input
                            type="number" min={1} max={10}
                            className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                            value={fields.frequencyControl?.times ?? 2}
                            onChange={e => setField('frequencyControl', { ...(fields.frequencyControl ?? { times: 2, days: 7, mode: 'target', enabled: true }), times: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground block mb-1">Per N days</label>
                          <input
                            type="number" min={1} max={90}
                            className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground"
                            value={fields.frequencyControl?.days ?? 7}
                            onChange={e => setField('frequencyControl', { ...(fields.frequencyControl ?? { times: 2, days: 7, mode: 'target', enabled: true }), days: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </FieldToggle>
                )}
              </div>
            )}
          </div>
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
