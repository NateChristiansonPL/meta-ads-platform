/**
 * BulkEditPanelAdmin — slide-in drawer for bulk-editing multiple ad sets at once.
 * Each field has an individual enable toggle so only checked fields are applied.
 * Supports: budget type/amount, start/end datetime, optimization goal, conversion
 * event, locations (add/replace), custom/LAL targeted audiences (add/replace),
 * excluded audiences (add/replace).
 *
 * Features:
 * - Per-ad-set editing: each targeting field shows "All Ad Sets" + individual ad set tabs
 * - Combined sections: Detailed + Narrow Targeting in one section; Targeted + Excluded Audiences in one section
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
  frequencyControlApplicable, PLATFORM_PLACEMENTS, InterestObject, GeoLocationObject,
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

// Per-ad-set field values (keyed by ad set ID or 'all')
interface PerAdSetLocations {
  locationsToAdd: string[];
  locationObjectsToAdd: GeoLocationObject[];
  locationsMode: LocationMode;
}

interface PerAdSetDetailed {
  detailedInterestObjects: InterestObject[];
  detailedInterestsMode: 'add' | 'replace';
  narrowInterestObjects: InterestObject[];
  narrowInterestsMode: 'add' | 'replace';
}

interface PerAdSetAudiences {
  targetedAudiencesToAdd: string[];
  targetedAudiencesMode: AudienceMode;
  excludedAudiencesToAdd: string[];
  excludedAudiencesMode: AudienceMode;
}

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
  // placements
  placementType: 'advantage_plus' | 'manual';
  platforms: string[];
  placements: string[];
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
  audiences: boolean; // combined targeted + excluded
  placements: boolean;
  detailedTargeting: boolean; // combined detailed + narrow
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

// ── Ad Set Tab Switcher ───────────────────────────────────────────────────────

function AdSetTabSwitcher({
  selectedRows,
  activeTab,
  onTabChange,
}: {
  selectedRows: AdSetRow[];
  activeTab: string; // 'all' or ad set ID
  onTabChange: (tab: string) => void;
}) {
  if (selectedRows.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-border/30">
      <button
        onClick={() => onTabChange('all')}
        className={cn(
          'px-2 py-0.5 rounded text-[10px] font-700 border transition-all',
          activeTab === 'all'
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
        )}
      >
        All Ad Sets
      </button>
      {selectedRows.map(row => (
        <button
          key={row.id}
          onClick={() => onTabChange(row.id)}
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-700 border transition-all truncate max-w-[120px]',
            activeTab === row.id
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
          )}
          title={row.name || 'Untitled'}
        >
          {row.name || 'Untitled'}
        </button>
      ))}
    </div>
  );
}

// ── Sub-tab switcher for combined sections ────────────────────────────────────

function SubSectionTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; color?: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-2">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-2.5 py-0.5 rounded text-[10px] font-700 border transition-all',
            active === t.id
              ? t.color === 'amber' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : t.color === 'red' ? 'bg-red-500/15 border-red-500/40 text-red-400'
                : 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
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
    { accessToken: settings?.accessToken ?? '', query: locationQuery, location_types: ['city', 'subcity', 'neighborhood', 'region', 'country', 'zip', 'geo_market'] },
    { enabled: hasCredentials && locationQuery.trim().length >= 2, staleTime: 60 * 1000 },
  );
  const geoResults = (locationResults as { results?: { key: string; name: string; type: string; region?: string; countryName?: string }[] })?.results ?? [];

  // ── Address geocoding (Pin a Location) ─────────────────────────────────────
  const [addressQuery, setAddressQuery] = useState('');
  const { data: geocodeResults, isFetching: geocodingLoading } = trpc.adminMeta.geocodeAddress.useQuery(
    { address: addressQuery },
    { enabled: addressQuery.length >= 3, staleTime: 60 * 1000 },
  );

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
    // Placements
    placementType: shared(r => r.placementType || undefined, 'manual' as const),
    platforms: [],
    placements: [],
    // Optional
    language: shared(r => r.language || undefined, ''),
    operatingSystem: shared(r => r.operatingSystem || undefined, 'all'),
    devicePlatforms: shared(r => r.devicePlatforms || undefined, 'all'),
    attributionWindow: shared(r => r.attributionWindow || undefined, '7d_click_1d_engaged_1d_view'),
    attributionModel: shared(r => r.attributionModel || undefined, 'standard'),
  }));

  // ── Per-ad-set state for Locations ──────────────────────────────────────────
  const initPerAdSetLocations = (): Record<string, PerAdSetLocations> => {
    const map: Record<string, PerAdSetLocations> = {
      all: { locationsToAdd: [], locationObjectsToAdd: [], locationsMode: 'add' },
    };
    selectedRows.forEach(r => {
      map[r.id] = { locationsToAdd: [], locationObjectsToAdd: [], locationsMode: 'add' };
    });
    return map;
  };
  const [perAdSetLocations, setPerAdSetLocations] = useState<Record<string, PerAdSetLocations>>(initPerAdSetLocations);
  const [locationTab, setLocationTab] = useState('all');

  // ── Per-ad-set state for Detailed + Narrow Targeting ────────────────────────
  const initPerAdSetDetailed = (): Record<string, PerAdSetDetailed> => {
    const map: Record<string, PerAdSetDetailed> = {
      all: { detailedInterestObjects: [], detailedInterestsMode: 'add', narrowInterestObjects: [], narrowInterestsMode: 'add' },
    };
    selectedRows.forEach(r => {
      map[r.id] = { detailedInterestObjects: [], detailedInterestsMode: 'add', narrowInterestObjects: [], narrowInterestsMode: 'add' };
    });
    return map;
  };
  const [perAdSetDetailed, setPerAdSetDetailed] = useState<Record<string, PerAdSetDetailed>>(initPerAdSetDetailed);
  const [detailedTab, setDetailedTab] = useState('all');
  const [detailedSubSection, setDetailedSubSection] = useState<'detailed' | 'narrow'>('detailed');

  // ── Per-ad-set state for Audiences (Targeted + Excluded) ────────────────────
  const initPerAdSetAudiences = (): Record<string, PerAdSetAudiences> => {
    const map: Record<string, PerAdSetAudiences> = {
      all: { targetedAudiencesToAdd: [], targetedAudiencesMode: 'add', excludedAudiencesToAdd: [], excludedAudiencesMode: 'add' },
    };
    selectedRows.forEach(r => {
      map[r.id] = { targetedAudiencesToAdd: [], targetedAudiencesMode: 'add', excludedAudiencesToAdd: [], excludedAudiencesMode: 'add' };
    });
    return map;
  };
  const [perAdSetAudiences, setPerAdSetAudiences] = useState<Record<string, PerAdSetAudiences>>(initPerAdSetAudiences);
  const [audienceTab, setAudienceTab] = useState('all');
  const [audienceSubSection, setAudienceSubSection] = useState<'targeted' | 'excluded'>('targeted');

  const [enabled, setEnabled] = useState<EnabledFields>({
    name: false,
    budget: false,
    dates: false,
    optimizationGoal: false,
    conversionEvent: false,
    ageGender: false,
    locations: false,
    audiences: false,
    placements: false,
    detailedTargeting: false,
    // optional fields (each individually toggled inside the collapsed section)
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

  // ── Helpers for per-ad-set location state ───────────────────────────────────
  const getLocState = (tab: string): PerAdSetLocations => perAdSetLocations[tab] || perAdSetLocations['all'];
  const setLocState = (tab: string, update: Partial<PerAdSetLocations>) => {
    setPerAdSetLocations(prev => ({ ...prev, [tab]: { ...prev[tab], ...update } }));
  };

  // ── Helpers for per-ad-set detailed state ───────────────────────────────────
  const getDetState = (tab: string): PerAdSetDetailed => perAdSetDetailed[tab] || perAdSetDetailed['all'];
  const setDetState = (tab: string, update: Partial<PerAdSetDetailed>) => {
    setPerAdSetDetailed(prev => ({ ...prev, [tab]: { ...prev[tab], ...update } }));
  };

  // ── Helpers for per-ad-set audience state ───────────────────────────────────
  const getAudState = (tab: string): PerAdSetAudiences => perAdSetAudiences[tab] || perAdSetAudiences['all'];
  const setAudState = (tab: string, update: Partial<PerAdSetAudiences>) => {
    setPerAdSetAudiences(prev => ({ ...prev, [tab]: { ...prev[tab], ...update } }));
  };

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

      // ── Locations (per-ad-set aware) ──
      if (enabled.locations) {
        // Get the per-ad-set state for this specific row, falling back to 'all'
        const rowLocState = perAdSetLocations[row.id];
        const allLocState = perAdSetLocations['all'];
        // Merge: apply 'all' first, then per-ad-set overrides
        const effectiveStates: PerAdSetLocations[] = [];
        if (allLocState && allLocState.locationsToAdd.length > 0) effectiveStates.push(allLocState);
        if (rowLocState && rowLocState.locationsToAdd.length > 0) effectiveStates.push(rowLocState);

        for (const locState of effectiveStates) {
          if (locState.locationsToAdd.length > 0) {
            if (locState.locationsMode === 'replace') {
              patch.geoLocations = locState.locationsToAdd.join('\n');
              patch.geoLocationObjects = [...locState.locationObjectsToAdd];
            } else {
              const existing = (patch.geoLocations ?? row.geoLocations ?? '').split('\n').filter(Boolean);
              const existingObjs = patch.geoLocationObjects ?? row.geoLocationObjects ?? [];
              const newLocs: string[] = [];
              const newObjs: GeoLocationObject[] = [];
              locState.locationsToAdd.forEach((l, idx) => {
                if (!existing.includes(l)) {
                  newLocs.push(l);
                  if (locState.locationObjectsToAdd[idx]) newObjs.push(locState.locationObjectsToAdd[idx]);
                }
              });
              patch.geoLocations = [...existing, ...newLocs].join('\n');
              patch.geoLocationObjects = [...existingObjs, ...newObjs];
            }
          }
        }
      }

      // ── Audiences (per-ad-set aware) ──
      if (enabled.audiences) {
        const rowAudState = perAdSetAudiences[row.id];
        const allAudState = perAdSetAudiences['all'];
        const effectiveStates: PerAdSetAudiences[] = [];
        if (allAudState) effectiveStates.push(allAudState);
        if (rowAudState) effectiveStates.push(rowAudState);

        for (const audState of effectiveStates) {
          // Targeted
          if (audState.targetedAudiencesToAdd.length > 0) {
            if (audState.targetedAudiencesMode === 'replace') {
              patch.targetedAudiences = audState.targetedAudiencesToAdd.join('\n');
            } else {
              const existing = (patch.targetedAudiences ?? row.targetedAudiences ?? '').split('\n').filter(Boolean);
              const existingIds = existing.map(a => a.split('|')[0]);
              const newAuds = audState.targetedAudiencesToAdd.filter(a => !existingIds.includes(a.split('|')[0]));
              patch.targetedAudiences = [...existing, ...newAuds].join('\n');
            }
          }
          // Excluded
          if (audState.excludedAudiencesToAdd.length > 0) {
            if (audState.excludedAudiencesMode === 'replace') {
              patch.excludedAudiences = audState.excludedAudiencesToAdd.join('\n');
            } else {
              const existing = (patch.excludedAudiences ?? row.excludedAudiences ?? '').split('\n').filter(Boolean);
              const existingIds = existing.map(a => a.split('|')[0]);
              const newAuds = audState.excludedAudiencesToAdd.filter(a => !existingIds.includes(a.split('|')[0]));
              patch.excludedAudiences = [...existing, ...newAuds].join('\n');
            }
          }
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

      // ── Detailed + Narrow Targeting (per-ad-set aware) ──
      if (enabled.detailedTargeting) {
        const rowDetState = perAdSetDetailed[row.id];
        const allDetState = perAdSetDetailed['all'];
        const effectiveStates: PerAdSetDetailed[] = [];
        if (allDetState) effectiveStates.push(allDetState);
        if (rowDetState) effectiveStates.push(rowDetState);

        for (const detState of effectiveStates) {
          // Detailed
          if (detState.detailedInterestObjects.length > 0) {
            const newObjs = detState.detailedInterestObjects;
            const newNames = newObjs.map(o => o.name);
            if (detState.detailedInterestsMode === 'replace') {
              patch.detailedInterests = newNames.join('\n');
              patch.detailedInterestObjects = newObjs;
            } else {
              const existingObjs = patch.detailedInterestObjects ?? row.detailedInterestObjects ?? [];
              const existingIds = new Set(existingObjs.map(o => o.id));
              const toAdd = newObjs.filter(o => !existingIds.has(o.id));
              const existingNames = (patch.detailedInterests ?? row.detailedInterests ?? '').split('\n').filter(Boolean);
              patch.detailedInterests = [...existingNames, ...toAdd.map(o => o.name)].join('\n');
              patch.detailedInterestObjects = [...existingObjs, ...toAdd];
            }
          }
          // Narrow
          if (detState.narrowInterestObjects.length > 0) {
            const newObjs = detState.narrowInterestObjects;
            const newNames = newObjs.map(o => o.name);
            if (detState.narrowInterestsMode === 'replace') {
              patch.narrowInterests = newNames.join('\n');
              patch.narrowInterestObjects = newObjs;
            } else {
              const existingObjs = patch.narrowInterestObjects ?? row.narrowInterestObjects ?? [];
              const existingIds = new Set(existingObjs.map(o => o.id));
              const toAdd = newObjs.filter(o => !existingIds.has(o.id));
              const existingNames = (patch.narrowInterests ?? row.narrowInterests ?? '').split('\n').filter(Boolean);
              patch.narrowInterests = [...existingNames, ...toAdd.map(o => o.name)].join('\n');
              patch.narrowInterestObjects = [...existingObjs, ...toAdd];
            }
          }
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
  }, [applyCount, enabled, fields, selectedRows, allRows, onChange, onClose, perAdSetLocations, perAdSetDetailed, perAdSetAudiences]);

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

  // ── Current per-ad-set states for rendering ─────────────────────────────────
  const curLocState = getLocState(locationTab);
  const curDetState = getDetState(detailedTab);
  const curAudState = getAudState(audienceTab);

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

          {/* Locations (with per-ad-set tabs) */}
          <FieldToggle label="Locations" icon={<MapPin size={13} />} enabled={enabled.locations} onToggle={() => toggleEnabled('locations')}>
            <AdSetTabSwitcher selectedRows={selectedRows} activeTab={locationTab} onTabChange={setLocationTab} />
            <ModeToggle mode={curLocState.locationsMode} onChange={m => setLocState(locationTab, { locationsMode: m })} />
            {/* City/Region/Country Search */}
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
            {/* Geo Results */}
            {geoResults.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-2/80 max-h-[140px] overflow-y-auto">
                {geoResults.slice(0, 8).map((r: { key: string; name: string; type: string; region?: string; countryName?: string }) => {
                  const label = [r.name, r.region, r.countryName].filter(Boolean).join(', ');
                  const alreadyAdded = curLocState.locationsToAdd.includes(label);
                  return (
                    <button
                      key={r.key}
                      onClick={() => {
                        if (!alreadyAdded) {
                          setLocState(locationTab, {
                            locationsToAdd: [...curLocState.locationsToAdd, label],
                            locationObjectsToAdd: [...curLocState.locationObjectsToAdd, { key: r.key, type: r.type, name: label }],
                          });
                        }
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

            {/* Pin a Specific Address */}
            {hasCredentials && (
              <div className="relative mt-2">
                <label className="text-[10px] font-700 text-muted-foreground/60 tracking-wider uppercase block mb-1">Pin a Specific Address</label>
                <div className="flex items-center gap-2 bg-surface-2/50 border border-border rounded-lg px-2.5 py-1.5">
                  <MapPin size={11} className="text-muted-foreground/40 shrink-0" />
                  <input
                    value={addressQuery}
                    onChange={e => setAddressQuery(e.target.value)}
                    placeholder="Type a street address, place, or business…"
                    className="flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  {geocodingLoading && <span className="text-[10px] text-muted-foreground animate-pulse">…</span>}
                </div>
                {addressQuery.length >= 3 && geocodeResults != null && ((geocodeResults as { results?: { address: string; lat: number; lng: number; placeId: string }[] }).results?.length ?? 0) > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface-2 shadow-xl max-h-48 overflow-y-auto">
                    {((geocodeResults as { results?: { address: string; lat: number; lng: number; placeId: string }[] }).results ?? []).map((geo) => (
                      <button key={geo.placeId} onClick={() => {
                        const label = geo.address;
                        if (!curLocState.locationsToAdd.includes(label)) {
                          setLocState(locationTab, {
                            locationsToAdd: [...curLocState.locationsToAdd, label],
                            locationObjectsToAdd: [...curLocState.locationObjectsToAdd, {
                              key: geo.placeId || `${geo.lat},${geo.lng}`,
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
                      }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0 flex items-center justify-between gap-2">
                        <span className="text-foreground">{geo.address}</span>
                        <span className="text-[10px] text-muted-foreground/50">📍 Pin</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected locations with radius controls */}
            {curLocState.locationsToAdd.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <label className="text-[10px] font-700 text-muted-foreground/60 tracking-wider uppercase block">Selected ({curLocState.locationsToAdd.length})</label>
                <div className="space-y-1.5">
                  {curLocState.locationsToAdd.map((loc, i) => {
                    const geoObj = curLocState.locationObjectsToAdd[i];
                    const geoType = (geoObj?.type || '').toLowerCase();
                    const supportsRadius = geoObj && ['city', 'subcity', 'neighborhood', 'custom_location'].includes(geoType);
                    const isCustom = geoType === 'custom_location';
                    return (
                      <div key={i} className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-primary">
                          {isCustom && <span>📍</span>}
                          {loc}
                          <button onClick={() => {
                            setLocState(locationTab, {
                              locationsToAdd: curLocState.locationsToAdd.filter((_, li) => li !== i),
                              locationObjectsToAdd: curLocState.locationObjectsToAdd.filter((_, oi) => oi !== i),
                            });
                          }} className="hover:text-red-400 transition-colors"><X size={9} /></button>
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
                                const updatedObjs = [...curLocState.locationObjectsToAdd];
                                updatedObjs[i] = { ...updatedObjs[i], radius: val };
                                setLocState(locationTab, { locationObjectsToAdd: updatedObjs });
                              }}
                              placeholder="Radius"
                              className="w-14 px-1.5 py-0.5 text-[10px] bg-surface-2/50 border border-border rounded text-center outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/30"
                            />
                            <select
                              value={geoObj.distanceUnit || 'mile'}
                              onChange={e => {
                                const updatedObjs = [...curLocState.locationObjectsToAdd];
                                updatedObjs[i] = { ...updatedObjs[i], distanceUnit: e.target.value as 'mile' | 'kilometer' };
                                setLocState(locationTab, { locationObjectsToAdd: updatedObjs });
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
            {curLocState.locationsToAdd.length === 0 && (
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

          {/* ── Combined: Detailed Targeting + Narrow Targeting (AND) ── */}
          <FieldToggle label="Detailed & Narrow Targeting" icon={<Target size={13} />} enabled={enabled.detailedTargeting} onToggle={() => toggleEnabled('detailedTargeting')}>
            <AdSetTabSwitcher selectedRows={selectedRows} activeTab={detailedTab} onTabChange={setDetailedTab} />
            <SubSectionTabs
              tabs={[
                { id: 'detailed', label: 'Detailed (OR)' },
                { id: 'narrow', label: 'Narrow (AND)', color: 'amber' },
              ]}
              active={detailedSubSection}
              onChange={id => setDetailedSubSection(id as 'detailed' | 'narrow')}
            />

            {detailedSubSection === 'detailed' ? (
              <>
                <ModeToggle mode={curDetState.detailedInterestsMode} onChange={m => setDetState(detailedTab, { detailedInterestsMode: m })} />
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
                          const already = curDetState.detailedInterestObjects.some(o => o.id === r.id);
                          if (!already) {
                            setDetState(detailedTab, {
                              detailedInterestObjects: [...curDetState.detailedInterestObjects, { id: r.id, type: r.type || 'adinterest', name: r.name }],
                            });
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
                {curDetState.detailedInterestObjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {curDetState.detailedInterestObjects.map((obj, i) => (
                      <span key={obj.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-600 bg-primary/10 text-primary border border-primary/20">
                        {obj.name}
                        <button onClick={() => setDetState(detailedTab, { detailedInterestObjects: curDetState.detailedInterestObjects.filter((_, oi) => oi !== i) })} className="hover:text-red-400"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/50 italic">No detailed interests added yet</p>
                )}
              </>
            ) : (
              <>
                <ModeToggle mode={curDetState.narrowInterestsMode} onChange={m => setDetState(detailedTab, { narrowInterestsMode: m })} />
                <div className="flex gap-1">
                  {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setNarrowType(t)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-600 border transition-all',
                        narrowType === t
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                          : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
                      )}
                    >{t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}</button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    className="w-full px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40"
                    placeholder="Must also match (AND layer)..."
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
                          const already = curDetState.narrowInterestObjects.some(o => o.id === r.id);
                          if (!already) {
                            setDetState(detailedTab, {
                              narrowInterestObjects: [...curDetState.narrowInterestObjects, { id: r.id, type: r.type || 'adinterest', name: r.name }],
                            });
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
                {curDetState.narrowInterestObjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {curDetState.narrowInterestObjects.map((obj, i) => (
                      <span key={obj.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-600 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {obj.name}
                        <button onClick={() => setDetState(detailedTab, { narrowInterestObjects: curDetState.narrowInterestObjects.filter((_, oi) => oi !== i) })} className="hover:text-red-400"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/50 italic">No narrow targets added yet</p>
                )}
              </>
            )}
          </FieldToggle>

          {/* ── Combined: Targeted + Excluded Audiences ── */}
          <FieldToggle label="Custom & LAL Audiences" icon={<Users size={13} />} enabled={enabled.audiences} onToggle={() => toggleEnabled('audiences')}>
            <AdSetTabSwitcher selectedRows={selectedRows} activeTab={audienceTab} onTabChange={setAudienceTab} />
            <SubSectionTabs
              tabs={[
                { id: 'targeted', label: 'Targeted' },
                { id: 'excluded', label: 'Excluded', color: 'red' },
              ]}
              active={audienceSubSection}
              onChange={id => setAudienceSubSection(id as 'targeted' | 'excluded')}
            />

            {audienceSubSection === 'targeted' ? (
              <>
                <ModeToggle mode={curAudState.targetedAudiencesMode} onChange={m => setAudState(audienceTab, { targetedAudiencesMode: m })} />
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
                      const alreadyAdded = curAudState.targetedAudiencesToAdd.some(a => a.split('|')[0] === aud.id);
                      return (
                        <button
                          key={aud.id}
                          onClick={() => {
                            if (!alreadyAdded) setAudState(audienceTab, { targetedAudiencesToAdd: [...curAudState.targetedAudiencesToAdd, `${aud.id}|${aud.name}`] });
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
                {curAudState.targetedAudiencesToAdd.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {curAudState.targetedAudiencesToAdd.map((aud, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {aud.includes('|') ? aud.split('|').slice(1).join('|') : aud}
                        <button onClick={() => setAudState(audienceTab, { targetedAudiencesToAdd: curAudState.targetedAudiencesToAdd.filter((_, li) => li !== i) })}>
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {curAudState.targetedAudiencesToAdd.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic">No targeted audiences added yet</p>
                )}
              </>
            ) : (
              <>
                <ModeToggle mode={curAudState.excludedAudiencesMode} onChange={m => setAudState(audienceTab, { excludedAudiencesMode: m })} />
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
                      const alreadyAdded = curAudState.excludedAudiencesToAdd.some(a => a.split('|')[0] === aud.id);
                      return (
                        <button
                          key={aud.id}
                          onClick={() => {
                            if (!alreadyAdded) setAudState(audienceTab, { excludedAudiencesToAdd: [...curAudState.excludedAudiencesToAdd, `${aud.id}|${aud.name}`] });
                          }}
                          disabled={alreadyAdded}
                          className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0 flex items-center justify-between"
                        >
                          <span className="text-foreground">{aud.name}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {aud.subtype && <span className="text-[9px] text-muted-foreground/60 bg-surface-2 px-1 rounded">{aud.subtype}</span>}
                            {alreadyAdded
                              ? <Check size={10} className="text-red-400" />
                              : <Plus size={10} className="text-muted-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {curAudState.excludedAudiencesToAdd.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {curAudState.excludedAudiencesToAdd.map((aud, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                        {aud.includes('|') ? aud.split('|').slice(1).join('|') : aud}
                        <button onClick={() => setAudState(audienceTab, { excludedAudiencesToAdd: curAudState.excludedAudiencesToAdd.filter((_, li) => li !== i) })}>
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {curAudState.excludedAudiencesToAdd.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic">No exclusions added yet</p>
                )}
              </>
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
