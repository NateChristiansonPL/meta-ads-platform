// Shared TargetingPopup component — used by both AdSetsTableAdmin (spreadsheet view)
// and PillarHubAdmin (pillar view). Extracted to avoid duplication.

import React, { useRef, useEffect } from 'react';
import { MapPin, Plus, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdSetRow } from './campaignStoreAdmin';

export type AudienceFocus = 'location' | 'interests' | 'custom';

export type TargetingPopupProps = {
  tmRow: AdSetRow;
  audienceFocus: AudienceFocus;
  setAudienceFocus: (f: AudienceFocus) => void;
  hasCredentials: boolean;
  locationQuery: string;
  locationRowId: string | null;
  setLocationQuery: (q: string) => void;
  setLocationRowId: (id: string | null) => void;
  locationResults: unknown;
  searchingLocations: boolean;
  detailedQuery: string;
  detailedRowId: string | null;
  setDetailedQuery: (q: string) => void;
  setDetailedRowId: (id: string | null) => void;
  detailedType: 'adinterest' | 'behaviors' | 'demographics';
  setDetailedType: (t: 'adinterest' | 'behaviors' | 'demographics') => void;
  detailedResults: { results?: { id: string; name: string; type?: string; audienceSizeLower?: number }[] } | null | undefined;
  searchingDetailed: boolean;
  narrowQuery: string;
  narrowRowId: string | null;
  setNarrowQuery: (q: string) => void;
  setNarrowRowId: (id: string | null) => void;
  narrowType: 'adinterest' | 'behaviors' | 'demographics';
  setNarrowType: (t: 'adinterest' | 'behaviors' | 'demographics') => void;
  narrowResults: { results?: { id: string; name: string; type?: string; audienceSizeLower?: number }[] } | null | undefined;
  searchingNarrow: boolean;
  audienceSearch: string;
  setAudienceSearch: (s: string) => void;
  customAudiences: { id: string; name: string; approximateCount?: number; subtype?: string }[];
  loadingAudiences: boolean;
  update: (id: string, updates: Partial<AdSetRow>) => void;
  onClose: () => void;
  setBulkLocModal: (v: { rowId: string } | null) => void;
  setBulkLocText: (v: string) => void;
  /** When true, renders as an inline panel (no absolute positioning, no outside-click dismiss) */
  inline?: boolean;
};

export function TargetingPopup({
  tmRow, audienceFocus, setAudienceFocus, hasCredentials,
  locationQuery, locationRowId, setLocationQuery, setLocationRowId,
  locationResults, searchingLocations,
  detailedQuery, detailedRowId, setDetailedQuery, setDetailedRowId,
  detailedType, setDetailedType, detailedResults, searchingDetailed,
  narrowQuery, narrowRowId, setNarrowQuery, setNarrowRowId,
  narrowType, setNarrowType, narrowResults, searchingNarrow,
  audienceSearch, setAudienceSearch, customAudiences, loadingAudiences,
  update, onClose, setBulkLocModal, setBulkLocText, inline = false,
}: TargetingPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inline) return; // no outside-click dismiss when inline
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, inline]);

  return (
    <div ref={ref}
      className={inline ? 'rounded-xl flex flex-col' : 'absolute z-[70] top-full right-0 mt-1 rounded-xl shadow-2xl flex flex-col'}
      style={inline
        ? { width: '100%', background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }
        : { width: 560, maxHeight: 520, background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <MapPin size={12} className="text-[#00BEEF]" />
          <span className="text-[12px] font-700 text-white">Targeting · {tmRow.name}</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors"><X size={14} /></button>
      </div>
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 pt-2 pb-0">
        {(['location', 'interests', 'custom'] as AudienceFocus[]).map(f => (
          <button key={f} onClick={() => setAudienceFocus(f)}
            className={cn(
              'px-3 py-1.5 rounded-t text-[10px] font-600 border-b-2 transition-all',
              audienceFocus === f
                ? 'border-[#00BEEF] text-[#00BEEF] bg-[rgba(0,190,239,0.06)]'
                : 'border-transparent text-white/40 hover:text-white/70'
            )}>
            {f === 'location' ? '📍 Location' : f === 'interests' ? '🎯 Interests' : '👥 Custom'}
          </button>
        ))}
        {audienceFocus === 'location' && (
          <button onClick={() => { setBulkLocModal({ rowId: tmRow.id }); setBulkLocText(''); }}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-[rgba(255,255,255,0.12)] text-[10px] font-600 text-white/50 hover:text-white/80 hover:border-[rgba(255,255,255,0.25)] transition-colors">
            <Plus size={9} /> Bulk Paste
          </button>
        )}
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* LOCATION TAB */}
        {audienceFocus === 'location' && (
          <div className="space-y-3">
            {hasCredentials ? (
              <div className="relative">
                <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Search Locations</label>
                <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2">
                  <MapPin size={11} className="text-white/30 shrink-0" />
                  <input
                    value={locationRowId === tmRow.id ? locationQuery : ''}
                    onChange={e => { setLocationQuery(e.target.value); setLocationRowId(tmRow.id); }}
                    onFocus={() => setLocationRowId(tmRow.id)}
                    placeholder="Type city, state, country, or zip…"
                    className="flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
                  />
                  {searchingLocations && <span className="text-[10px] text-white/30">…</span>}
                </div>
                {locationRowId === tmRow.id && locationQuery.length >= 2 && locationResults != null && ((locationResults as { results?: unknown[] }).results?.length ?? 0) > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg shadow-2xl max-h-48 overflow-y-auto" style={{ background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {((locationResults as { results?: { key: string; name: string; type?: string; countryCode?: string; countryName?: string; region?: string }[] }).results ?? []).map((loc) => (
                      <button key={loc.key} onClick={() => {
                        const label = [loc.name, loc.region, loc.countryName].filter(Boolean).join(', ');
                        const current = tmRow.geoLocations ? tmRow.geoLocations.split('\n').filter(Boolean) : [];
                        const currentObjs = tmRow.geoLocationObjects || [];
                        if (!current.includes(label)) {
                          update(tmRow.id, {
                            geoLocations: [...current, label].join('\n'),
                            geoLocationObjects: [...currentObjs, { key: loc.key, type: loc.type || 'country', name: label }],
                          });
                        }
                        setLocationQuery('');
                        setLocationRowId(null);
                      }} className="w-full text-left px-3 py-2 text-[11px] hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center justify-between gap-2">
                        <span className="text-white">{loc.name}{loc.region ? `, ${loc.region}` : ''}{loc.countryName ? ` (${loc.countryName})` : ''}</span>
                        <span className="text-[10px] text-white/30 capitalize">{loc.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-amber-400">Add credentials in Settings to enable location search.</p>
            )}
            {tmRow.geoLocations && (
              <div className="space-y-1">
                <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block">Selected ({tmRow.geoLocations.split('\n').filter(Boolean).length})</label>
                <div className="flex flex-wrap gap-1.5">
                  {tmRow.geoLocations.split('\n').filter(Boolean).map((loc, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(0,190,239,0.1)] border border-[rgba(0,190,239,0.25)] rounded-full text-[10px] text-[#00BEEF]">
                      {loc}
                      <button onClick={() => {
                        const updated = tmRow.geoLocations!.split('\n').filter((_, li) => li !== i).join('\n');
                        const updatedObjs = (tmRow.geoLocationObjects || []).filter((_, oi) => oi !== i);
                        update(tmRow.id, { geoLocations: updated, geoLocationObjects: updatedObjs });
                      }} className="hover:text-red-400 transition-colors"><X size={9} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <details className="group">
              <summary className="text-[10px] text-[#00BEEF] cursor-pointer list-none flex items-center gap-1">
                <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
                Or paste a list (one per line)
              </summary>
              <textarea
                value={tmRow.geoLocations}
                onChange={e => update(tmRow.id, { geoLocations: e.target.value })}
                placeholder="New York, NY&#10;Los Angeles, CA"
                rows={3}
                className="w-full mt-1 px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] resize-none placeholder:text-white/20 text-white"
              />
            </details>
          </div>
        )}

        {/* INTERESTS TAB */}
        {audienceFocus === 'interests' && (
          <div className="flex flex-col gap-4">
            {/* Detailed Targeting */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase">Detailed Targeting</label>
                <div className="flex gap-0.5">
                  {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                    <button key={t} onClick={() => setDetailedType(t)}
                      className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                        detailedType === t ? 'bg-primary text-primary-foreground' : 'bg-[rgba(255,255,255,0.06)] text-white/40 hover:text-white/70'
                      }`}>
                      {t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  value={detailedRowId === tmRow.id ? detailedQuery : ''}
                  onChange={e => { setDetailedRowId(tmRow.id); setDetailedQuery(e.target.value); }}
                  onFocus={() => setDetailedRowId(tmRow.id)}
                  placeholder={hasCredentials ? `Search ${detailedType === 'adinterest' ? 'interests' : detailedType}…` : 'Enter credentials in Settings first'}
                  className="w-full px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] placeholder:text-white/20 text-white"
                />
                {searchingDetailed && detailedRowId === tmRow.id && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">…</span>}
              </div>
              {detailedRowId === tmRow.id && detailedQuery.length >= 2 && (detailedResults?.results?.length ?? 0) > 0 && (
                <div className="border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl max-h-36 overflow-y-auto divide-y divide-[rgba(255,255,255,0.05)]" style={{ background: '#0e0d3a' }}>
                  {(detailedResults?.results ?? []).slice(0, 10).map((r) => (
                    <button key={r.id} onMouseDown={e => e.preventDefault()} onClick={() => {
                      const current = tmRow.detailedInterests ? tmRow.detailedInterests.split('\n').filter(Boolean) : [];
                      const currentObjs = tmRow.detailedInterestObjects || [];
                      if (!current.includes(r.name)) {
                        update(tmRow.id, {
                          detailedInterests: [...current, r.name].join('\n'),
                          detailedInterestObjects: [...currentObjs, { id: r.id, type: r.type || 'adinterest', name: r.name }],
                        });
                      }
                      setDetailedQuery('');
                      setDetailedRowId(null);
                    }} className="w-full text-left px-3 py-2 text-[11px] flex items-center justify-between gap-2 hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                      <span className="text-white">{r.name}</span>
                      {r.audienceSizeLower && <span className="text-[10px] text-white/30">{(r.audienceSizeLower / 1_000_000).toFixed(1)}M</span>}
                    </button>
                  ))}
                </div>
              )}
              {tmRow.detailedInterests && (
                <div className="flex flex-wrap gap-1">
                  {tmRow.detailedInterests.split('\n').filter(Boolean).map((interest, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(0,190,239,0.1)] border border-[rgba(0,190,239,0.2)] rounded-full text-[10px] text-[#00BEEF]">
                      {interest}
                      <button onClick={() => {
                        const updatedObjs = (tmRow.detailedInterestObjects || []).filter((_, oi) => oi !== i);
                        update(tmRow.id, {
                          detailedInterests: tmRow.detailedInterests!.split('\n').filter((_, li) => li !== i).join('\n'),
                          detailedInterestObjects: updatedObjs,
                        });
                      }} className="hover:text-red-400"><X size={9} /></button>
                    </span>
                  ))}
                </div>
              )}
              {!hasCredentials && (
                <textarea value={tmRow.detailedInterests} onChange={e => update(tmRow.id, { detailedInterests: e.target.value })}
                  placeholder="Running, Fitness, Nike…" rows={2}
                  className="w-full px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] resize-none placeholder:text-white/20 text-white" />
              )}
            </div>
            {/* Narrow Targeting — stacked below */}
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase">Narrow Targeting (AND)</label>
                <div className="flex gap-0.5">
                  {(['adinterest', 'behaviors', 'demographics'] as const).map(t => (
                    <button key={t} onClick={() => setNarrowType(t)}
                      className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                        narrowType === t ? 'bg-amber-500 text-black font-700' : 'bg-[rgba(255,255,255,0.06)] text-white/40 hover:text-white/70'
                      }`}>
                      {t === 'adinterest' ? 'Interests' : t === 'behaviors' ? 'Behaviors' : 'Demographics'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  value={narrowRowId === tmRow.id ? narrowQuery : ''}
                  onChange={e => { setNarrowRowId(tmRow.id); setNarrowQuery(e.target.value); }}
                  onFocus={() => setNarrowRowId(tmRow.id)}
                  placeholder={hasCredentials ? `Search ${narrowType === 'adinterest' ? 'interests' : narrowType} to narrow by…` : 'Enter credentials in Settings first'}
                  className="w-full px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] placeholder:text-white/20 text-white"
                />
                {searchingNarrow && narrowRowId === tmRow.id && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">…</span>}
              </div>
              {narrowRowId === tmRow.id && narrowQuery.length >= 2 && (narrowResults?.results?.length ?? 0) > 0 && (
                <div className="border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl max-h-36 overflow-y-auto divide-y divide-[rgba(255,255,255,0.05)]" style={{ background: '#0e0d3a' }}>
                  {(narrowResults?.results ?? []).slice(0, 10).map((r) => (
                    <button key={r.id} onMouseDown={e => e.preventDefault()} onClick={() => {
                      const current = tmRow.narrowInterests ? tmRow.narrowInterests.split('\n').filter(Boolean) : [];
                      const currentObjs = tmRow.narrowInterestObjects || [];
                      if (!current.includes(r.name)) {
                        update(tmRow.id, {
                          narrowInterests: [...current, r.name].join('\n'),
                          narrowInterestObjects: [...currentObjs, { id: r.id, type: r.type || 'adinterest', name: r.name }],
                        });
                      }
                      setNarrowQuery('');
                      setNarrowRowId(null);
                    }} className="w-full text-left px-3 py-2 text-[11px] flex items-center justify-between gap-2 hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                      <span className="text-white">{r.name}</span>
                      {r.audienceSizeLower && <span className="text-[10px] text-white/30">{(r.audienceSizeLower / 1_000_000).toFixed(1)}M</span>}
                    </button>
                  ))}
                </div>
              )}
              {tmRow.narrowInterests && (
                <div className="flex flex-wrap gap-1">
                  {tmRow.narrowInterests.split('\n').filter(Boolean).map((interest, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-400">
                      {interest}
                      <button onClick={() => update(tmRow.id, { narrowInterests: tmRow.narrowInterests!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-amber-600"><X size={9} /></button>
                    </span>
                  ))}
                </div>
              )}
              {!hasCredentials && (
                <textarea value={tmRow.narrowInterests} onChange={e => update(tmRow.id, { narrowInterests: e.target.value })}
                  placeholder="Must also match…" rows={2}
                  className="w-full px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] resize-none placeholder:text-white/20 text-white" />
              )}
            </div>
          </div>
        )}

        {/* CUSTOM TAB */}
        {audienceFocus === 'custom' && (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block">Targeted Custom / LAL Audiences</label>
              {hasCredentials ? (
                <>
                  <div className="flex items-center gap-2">
                    <input value={audienceSearch} onChange={e => setAudienceSearch(e.target.value)}
                      placeholder="Search audiences…"
                      className="flex-1 px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded outline-none focus:border-[rgba(0,190,239,0.4)] placeholder:text-white/20 text-white" />
                    {loadingAudiences && <span className="text-[10px] text-white/30">Loading…</span>}
                  </div>
                  {audienceSearch.trim().length === 0 && <p className="text-[10px] text-white/25 italic px-1">Type to search your account audiences…</p>}
                  {customAudiences.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-[rgba(255,255,255,0.08)] rounded-lg bg-[rgba(255,255,255,0.03)] divide-y divide-[rgba(255,255,255,0.05)]">
                      {customAudiences.map((aud) => {
                        const isSel = (tmRow.targetedAudiences || '').includes(aud.name);
                        return (
                          <button key={aud.id} onClick={() => {
                            const cur = tmRow.targetedAudiences ? tmRow.targetedAudiences.split('\n').filter(Boolean) : [];
                            update(tmRow.id, { targetedAudiences: isSel ? cur.filter(a => a !== aud.name).join('\n') : [...cur, aud.name].join('\n') });
                          }} className={cn('w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors',
                            isSel ? 'bg-[rgba(0,190,239,0.1)] text-[#00BEEF]' : 'hover:bg-[rgba(255,255,255,0.04)] text-white')}>
                            <span>{aud.name}</span>
                            <span className="text-[10px] text-white/25">{aud.subtype} {aud.approximateCount ? `• ${(aud.approximateCount / 1000).toFixed(0)}K` : ''}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {tmRow.targetedAudiences && (
                    <div className="flex flex-wrap gap-1">
                      {tmRow.targetedAudiences.split('\n').filter(Boolean).map((a, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(0,190,239,0.1)] border border-[rgba(0,190,239,0.2)] rounded-full text-[10px] text-[#00BEEF]">
                          {a}
                          <button onClick={() => update(tmRow.id, { targetedAudiences: tmRow.targetedAudiences!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-red-400"><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <textarea value={tmRow.targetedAudiences} onChange={e => update(tmRow.id, { targetedAudiences: e.target.value })}
                  placeholder="Website Visitors 180d, Email List LAL 1%…" rows={3}
                  className="w-full px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] resize-none placeholder:text-white/20 text-white" />
              )}
            </div>
            {/* Excluded — stacked below with its own search */}
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block">Excluded Custom / LAL Audiences</label>
              {hasCredentials ? (
                <>
                  <div className="flex items-center gap-2">
                    <input value={audienceSearch} onChange={e => setAudienceSearch(e.target.value)}
                      placeholder="Search audiences to exclude…"
                      className="flex-1 px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded outline-none focus:border-[rgba(0,190,239,0.4)] placeholder:text-white/20 text-white" />
                    {loadingAudiences && <span className="text-[10px] text-white/30">Loading…</span>}
                  </div>
                  {audienceSearch.trim().length === 0 && <p className="text-[10px] text-white/25 italic px-1">Type to search audiences to exclude…</p>}
                  {customAudiences.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-[rgba(255,255,255,0.08)] rounded-lg bg-[rgba(255,255,255,0.03)] divide-y divide-[rgba(255,255,255,0.05)]">
                      {customAudiences.map((aud) => {
                        const isExcl = (tmRow.excludedAudiences || '').includes(aud.name);
                        return (
                          <button key={aud.id} onClick={() => {
                            const cur = tmRow.excludedAudiences ? tmRow.excludedAudiences.split('\n').filter(Boolean) : [];
                            update(tmRow.id, { excludedAudiences: isExcl ? cur.filter(a => a !== aud.name).join('\n') : [...cur, aud.name].join('\n') });
                          }} className={cn('w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors',
                            isExcl ? 'bg-red-500/10 text-red-400' : 'hover:bg-[rgba(255,255,255,0.04)] text-white')}>
                            <span>{aud.name}</span>
                            <span className="text-[10px] text-white/25">{aud.subtype}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {tmRow.excludedAudiences && (
                    <div className="flex flex-wrap gap-1">
                      {tmRow.excludedAudiences.split('\n').filter(Boolean).map((a, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-400">
                          {a}
                          <button onClick={() => update(tmRow.id, { excludedAudiences: tmRow.excludedAudiences!.split('\n').filter((_, li) => li !== i).join('\n') })} className="hover:text-red-600"><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <textarea value={tmRow.excludedAudiences} onChange={e => update(tmRow.id, { excludedAudiences: e.target.value })}
                  placeholder="Existing Customers, Purchasers 180d…" rows={3}
                  className="w-full px-3 py-2 text-[11px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg outline-none focus:border-[rgba(0,190,239,0.4)] resize-none placeholder:text-white/20 text-white" />
              )}
            </div>
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-end px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[#00BEEF] text-[#0e0d3a] text-[11px] font-700 hover:bg-[#00d4ff] transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}
