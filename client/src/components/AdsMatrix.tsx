// AdsMatrix — Ad List (default) + Ad Trafficker (secondary)
// Ad List: spreadsheet table of all assembled ads with full column set
// Ad Trafficker: creative × ad set cross-join matrix for bulk assignment

import { useState, useMemo } from 'react';
import {
  Zap, Plus, Trash2, Eye, Copy, Grid3X3, List, ChevronDown,
  AlertTriangle, RefreshCw, Search, Replace,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdRow, AdSetRow, CreativeRow, CampaignRow, BuildMode,
  newAdRow,
} from '@/lib/campaignStore';

interface Props {
  ads: AdRow[];
  adSets: AdSetRow[];
  creatives: CreativeRow[];
  campaigns: CampaignRow[];
  buildMode: BuildMode;
  onChange: (ads: AdRow[]) => void;
}

type MatrixKey = string;
function matrixKey(creativeId: string, adSetId: string): MatrixKey {
  return `${creativeId}__${adSetId}`;
}

// Build ad name: [Type] Concept - Dimension/Length
function buildAdName(
  adSetName: string,
  concept: string,
  adType: string,
  assetLength: string,
  dimensions: string[],
  launchDate?: string,
): string {
  const typeLabel = adType === 'video' ? 'Video' : adType === 'carousel' ? 'Carousel' : 'Static';
  const dimPart = adType === 'video'
    ? (assetLength ? `${assetLength}s` : '')
    : dimensions.length > 1
      ? 'Placement Custom'
      : dimensions[0] || '';
  const datePart = launchDate ? ` - ${launchDate}` : '';
  const suffix = dimPart ? ` - ${dimPart}${datePart}` : datePart;
  return `[${typeLabel}] ${concept || 'Untitled'}${suffix}`;
}

// Parse launch date from ad set start date → "Apr-26" format
function parseLaunchDate(startDate: string): string {
  if (!startDate) return '';
  try {
    const d = new Date(startDate + 'T12:00:00'); // noon to avoid UTC offset issues
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mo = months[d.getMonth()];
    const yr = String(d.getFullYear()).slice(2);
    return `${mo}-${yr}`;
  } catch { return ''; }
}

export default function AdsMatrix({ ads, adSets, creatives, campaigns, buildMode, onChange }: Props) {
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [checked, setChecked] = useState<Set<MatrixKey>>(new Set());
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findStr, setFindStr] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  const [findField, setFindField] = useState<'overrideUtmParams' | 'overrideWebsiteUrl' | 'adName'>('overrideUtmParams');
  const [findPreview, setFindPreview] = useState<number | null>(null);

  const doFindPreview = () => {
    if (!findStr.trim()) { toast.error('Enter a search string.'); return; }
    const count = ads.filter(a => ((a[findField] as string) || '').includes(findStr)).length;
    setFindPreview(count);
  };

  const doFindApply = () => {
    if (!findStr.trim() || findPreview === null) return;
    const updated = ads.map(a => {
      const val = (a[findField] as string) || '';
      if (!val.includes(findStr)) return a;
      return { ...a, [findField]: val.replaceAll(findStr, replaceStr) };
    });
    onChange(updated);
    toast.success(`Replaced in ${findPreview} ad${findPreview !== 1 ? 's' : ''}.`);
    setFindStr(''); setReplaceStr(''); setFindPreview(null); setShowFindReplace(false);
  };

  const filledAdSets = adSets.filter(a => a.name.trim());
  const filledCreatives = creatives.filter(c => c.concept.trim() || c.creativeId.trim());

  // ── Matrix logic ────────────────────────────────────────────────────────────

  const toggle = (cId: string, aId: string) => {
    const key = matrixKey(cId, aId);
    setChecked(prev => {
      const next = new Set(Array.from(prev));
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleRow = (cId: string) => {
    const allKeys = filledAdSets.map(a => matrixKey(cId, a.id));
    const allChecked = allKeys.every(k => checked.has(k));
    setChecked(prev => {
      const next = new Set(Array.from(prev));
      allKeys.forEach(k => allChecked ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const toggleCol = (aId: string) => {
    const allKeys = filledCreatives.map(c => matrixKey(c.id, aId));
    const allChecked = allKeys.every(k => checked.has(k));
    setChecked(prev => {
      const next = new Set(Array.from(prev));
      allKeys.forEach(k => allChecked ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const selectAll = () => {
    setChecked(new Set(filledCreatives.flatMap(c => filledAdSets.map(a => matrixKey(c.id, a.id)))));
  };

  const clearAll = () => setChecked(new Set());

  const generateAds = () => {
    if (checked.size === 0) {
      toast.error('Check at least one creative × ad set combination first.');
      return;
    }
    const existingKeys = new Set(ads.map(a => matrixKey(a.creativeId, a.adSetId)));
    const newAds: AdRow[] = [];

    Array.from(checked).forEach(key => {
      if (existingKeys.has(key)) return;
      const [creativeId, adSetId] = key.split('__');
      const creative = creatives.find(c => c.id === creativeId);
      const adSet = adSets.find(a => a.id === adSetId);
      if (!creative || !adSet) return;

      const launchDate = parseLaunchDate(adSet.startDate);
      const dims = creative.placementDimensions || [];
      const adName = buildAdName(adSet.name, creative.concept, creative.adType, creative.assetLength, dims, launchDate);

      // Inherit URL and UTM from creative (use first placement override or row-level value)
      const firstPlacement = creative.placementAssets?.[0];
      const inheritedUrl = firstPlacement?.websiteUrl || creative.websiteUrl || '';
      const inheritedUtm = creative.urlParams || '';

      // Inherit copy from creative (first variant of each)
      const _inheritedHeadline = creative.headlines?.[0] || '';
      const _inheritedPrimaryText = creative.primaryTexts?.[0] || '';

      newAds.push({
        ...newAdRow(),
        campaignName: adSet.campaignName,
        adSetName: adSet.name,
        adSetId: adSet.adSetId || adSet.id,
        creativeId: creative.id,
        adName,
        creativeConcept: creative.concept,
        creativeType: creative.adType,
        creativeLength: creative.assetLength,
        launchDate,
        status: 'PAUSED',
        needsUpdate: false,
        overrideWebsiteUrl: inheritedUrl,
        overrideUtmParams: inheritedUtm,
      });
    });

    if (newAds.length === 0) {
      toast.info('All selected combinations already exist as ads.');
      return;
    }

    onChange([...ads, ...newAds]);
    toast.success(`Generated ${newAds.length} ad${newAds.length !== 1 ? 's' : ''}`);
    setView('list');
  };

  const existingKeys = useMemo(() => new Set(ads.map(a => matrixKey(a.creativeId, a.adSetId))), [ads]);
  const checkedCount = checked.size;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-700 text-foreground">Ads</h2>
          <p className="text-[11px] text-muted-foreground">
            {view === 'list'
              ? `${ads.length} ad${ads.length !== 1 ? 's' : ''} assembled — review and edit before launch.`
              : 'Check cells to map creatives to ad sets. Row header = one creative to all ad sets. Column header = all creatives to one ad set.'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {view === 'list' ? (
            <>
              <button
                onClick={() => setShowFindReplace(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-600 transition-all ${
                  showFindReplace
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-surface-2 text-foreground hover:bg-surface-1'
                }`}
              >
                <Replace className="w-3.5 h-3.5" />
                Find &amp; Replace
              </button>
              <button
                onClick={() => setView('matrix')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-2 text-xs font-600 text-foreground hover:bg-surface-1 transition-all"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                Ad Trafficker
              </button>
              <button
                onClick={() => {
                  const row = newAdRow();
                  onChange([...ads, { ...row, status: 'PAUSED' }]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-2 text-xs font-600 text-foreground hover:bg-surface-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setView('list')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-2 text-xs font-600 text-foreground hover:bg-surface-1 transition-all"
              >
                <List className="w-3.5 h-3.5" />
                Ad List {ads.length > 0 && <span className="ml-1 text-[10px] text-primary">{ads.length}</span>}
              </button>
              <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface-2">
                Select All
              </button>
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface-2">
                Clear
              </button>
              <button
                onClick={generateAds}
                disabled={checkedCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-700 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Zap className="w-3.5 h-3.5" />
                Generate {checkedCount > 0 ? `${checkedCount} Ad${checkedCount !== 1 ? 's' : ''}` : 'Ads'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Find & Replace panel */}
      {view === 'list' && showFindReplace && (
        <div className="px-4 py-3 border-b border-border bg-surface-1/80 flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Field</label>
            <select
              value={findField}
              onChange={e => { setFindField(e.target.value as typeof findField); setFindPreview(null); }}
              className="cell-input text-xs appearance-none"
            >
              <option value="overrideUtmParams">URL Parameters (UTM)</option>
              <option value="overrideWebsiteUrl">Website URL</option>
              <option value="adName">Ad Name</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1"><Search className="w-3 h-3" /> Find</label>
            <input
              value={findStr}
              onChange={e => { setFindStr(e.target.value); setFindPreview(null); }}
              placeholder="e.g. utm_campaign=old"
              className="cell-input text-xs font-mono w-56"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1"><Replace className="w-3 h-3" /> Replace with</label>
            <input
              value={replaceStr}
              onChange={e => setReplaceStr(e.target.value)}
              placeholder="e.g. utm_campaign=new"
              className="cell-input text-xs font-mono w-56"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <button onClick={doFindPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-[11px] font-600 text-foreground border border-border transition-all">
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            {findPreview !== null && (
              <>
                <span className={`text-[11px] font-600 ${findPreview > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  {findPreview > 0 ? `${findPreview} match${findPreview !== 1 ? 'es' : ''}` : 'No matches'}
                </span>
                {findPreview > 0 && (
                  <button onClick={doFindApply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-[11px] font-600 text-primary border border-primary/30 transition-all">
                    <Replace className="w-3.5 h-3.5" /> Apply to {findPreview} ad{findPreview !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {view === 'list' ? (
        <AdListView
          ads={ads}
          adSets={adSets}
          creatives={creatives}
          campaigns={campaigns}
          onChange={onChange}
        />
      ) : (
        <MatrixView
          creatives={filledCreatives}
          adSets={filledAdSets}
          checked={checked}
          existingKeys={existingKeys}
          onToggle={toggle}
          onToggleRow={toggleRow}
          onToggleCol={toggleCol}
        />
      )}
    </div>
  );
}

// ── Ad List View ──────────────────────────────────────────────────────────────

const AD_COLUMNS = [
  { key: 'status', label: 'Status', width: 110 },
  { key: 'needsUpdate', label: 'Needs Update', width: 100 },
  { key: 'adName', label: 'Ad Name', width: 220 },
  { key: 'adSetName', label: 'Ad Set Name', width: 180 },
  { key: 'campaignName', label: 'Campaign Name', width: 180 },
  { key: 'creativeConcept', label: 'Creative Concept', width: 160 },
  { key: 'creativeType', label: 'Type', width: 90 },
  { key: 'creativeLength', label: 'Length', width: 80 },
  { key: 'launchDate', label: 'Launch Date', width: 110 },
  { key: 'sourcePostId', label: 'Source Post ID', width: 150 },
  { key: 'overrideWebsiteUrl', label: 'Website URL Override', width: 200 },
  { key: 'overrideUtmParams', label: 'UTM Override', width: 200 },
  { key: 'adId', label: 'Ad ID (write-back)', width: 150 },
  { key: 'adSetId', label: 'Ad Set ID', width: 130 },
  { key: 'campaignId', label: 'Campaign ID', width: 130 },
  { key: 'previewLink', label: 'Preview Link', width: 200 },
];

interface AdListProps {
  ads: AdRow[];
  adSets: AdSetRow[];
  creatives: CreativeRow[];
  campaigns: CampaignRow[];
  onChange: (ads: AdRow[]) => void;
}

function AdListView({ ads, adSets, creatives, campaigns, onChange }: AdListProps) {
  const setField = (id: string, key: keyof AdRow, val: unknown) => {
    onChange(ads.map(a => a.id === id ? { ...a, [key]: val } : a));
  };

  const removeAd = (id: string) => {
    onChange(ads.filter(a => a.id !== id));
  };

  const duplicateAd = (id: string) => {
    const ad = ads.find(a => a.id === id);
    if (!ad) return;
    const dup = { ...ad, id: crypto.randomUUID(), adId: '', previewLink: '' };
    const idx = ads.findIndex(a => a.id === id);
    const next = [...ads];
    next.splice(idx + 1, 0, dup);
    onChange(next);
  };

  if (ads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
            <Grid3X3 className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-700 text-foreground mb-1">No ads yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Use the <strong>Ad Trafficker</strong> button to map creatives to ad sets and generate ads, or add a row manually.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: AD_COLUMNS.reduce((s, c) => s + c.width, 60) }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-1 border-b border-border">
            <th className="w-8 px-2 py-2 text-left sticky left-0 bg-surface-1 z-20 border-r border-border">
              <span className="text-[10px] text-muted-foreground font-700">#</span>
            </th>
            {AD_COLUMNS.map(col => (
              <th
                key={col.key}
                className="px-2 py-2 text-left text-[10px] font-700 text-muted-foreground uppercase tracking-wider whitespace-nowrap border-r border-border"
                style={{ minWidth: col.width, width: col.width }}
              >
                {col.label}
              </th>
            ))}
            <th className="w-16 px-2 py-2 text-left text-[10px] font-700 text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad, idx) => (
            <tr key={ad.id} className={`border-b border-border group hover:bg-surface-2/40 transition-colors ${idx % 2 === 0 ? 'bg-surface-0' : 'bg-surface-1/30'}`}>
              <td className="px-2 py-1.5 text-[10px] text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">
                {idx + 1}
              </td>

              {/* Status */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 110 }}>
                <div className="flex gap-1">
                  {['ACTIVE', 'PAUSED'].map(s => (
                    <button
                      key={s}
                      onClick={() => setField(ad.id, 'status', s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-600 transition-all ${
                        ad.status === s
                          ? s === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-surface-2 text-muted-foreground border border-border hover:text-foreground'
                      }`}
                    >
                      {s === 'ACTIVE' ? 'On' : 'Off'}
                    </button>
                  ))}
                </div>
              </td>

              {/* Needs Update */}
              <td className="px-2 py-1 border-r border-border" style={{ minWidth: 100 }}>
                <button
                  onClick={() => setField(ad.id, 'needsUpdate', !ad.needsUpdate)}
                  className={`px-2 py-0.5 rounded text-[10px] font-600 transition-all ${
                    ad.needsUpdate
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-surface-2 text-muted-foreground border border-border hover:text-foreground'
                  }`}
                >
                  {ad.needsUpdate ? 'Update' : '—'}
                </button>
              </td>

              {/* Ad Name */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 220 }}>
                <input
                  value={ad.adName}
                  onChange={e => setField(ad.id, 'adName', e.target.value)}
                  className="cell-input w-full"
                  placeholder="Ad name"
                />
              </td>

              {/* Ad Set Name */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 180 }}>
                <input
                  value={ad.adSetName}
                  onChange={e => setField(ad.id, 'adSetName', e.target.value)}
                  className="cell-input w-full"
                  placeholder="Ad set name"
                />
              </td>

              {/* Campaign Name */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 180 }}>
                <input
                  value={ad.campaignName}
                  onChange={e => setField(ad.id, 'campaignName', e.target.value)}
                  className="cell-input w-full"
                  placeholder="Campaign name"
                />
              </td>

              {/* Creative Concept */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 160 }}>
                <input
                  value={ad.creativeConcept || ''}
                  onChange={e => setField(ad.id, 'creativeConcept', e.target.value)}
                  className="cell-input w-full"
                  placeholder="Concept"
                />
              </td>

              {/* Type */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 90 }}>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-600 ${
                  ad.creativeType === 'video' ? 'bg-violet-500/20 text-violet-400' :
                  ad.creativeType === 'carousel' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-surface-2 text-muted-foreground'
                }`}>
                  {ad.creativeType || '—'}
                </span>
              </td>

              {/* Length */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 80 }}>
                <input
                  value={ad.creativeLength || ''}
                  onChange={e => setField(ad.id, 'creativeLength', e.target.value)}
                  className="cell-input w-full"
                  placeholder="—"
                />
              </td>

              {/* Launch Date */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 110 }}>
                <input
                  value={ad.launchDate || ''}
                  onChange={e => setField(ad.id, 'launchDate', e.target.value)}
                  className="cell-input w-full font-mono text-[10px]"
                  placeholder="MM-DD-YY"
                />
              </td>

              {/* Source Post ID */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 150 }}>
                <input
                  value={ad.sourcePostId || ''}
                  onChange={e => setField(ad.id, 'sourcePostId', e.target.value)}
                  className="cell-input w-full font-mono text-[10px]"
                  placeholder="Post ID"
                />
              </td>

              {/* URL Override */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 200 }}>
                <input
                  value={ad.overrideWebsiteUrl || ''}
                  onChange={e => setField(ad.id, 'overrideWebsiteUrl', e.target.value)}
                  className="cell-input w-full text-[10px]"
                  placeholder="Override URL"
                />
              </td>

              {/* UTM Override */}
              <td className="px-1 py-1 border-r border-border" style={{ minWidth: 200 }}>
                <input
                  value={ad.overrideUtmParams || ''}
                  onChange={e => setField(ad.id, 'overrideUtmParams', e.target.value)}
                  className="cell-input w-full font-mono text-[10px]"
                  placeholder="UTM params"
                />
              </td>

              {/* Ad ID (write-back, read-only) */}
              <td className="px-2 py-1 border-r border-border" style={{ minWidth: 150 }}>
                <span className="text-[10px] font-mono text-muted-foreground">{ad.adId || <span className="italic opacity-40">auto-populated</span>}</span>
              </td>

              {/* Ad Set ID */}
              <td className="px-2 py-1 border-r border-border" style={{ minWidth: 130 }}>
                <input
                  value={ad.adSetId || ''}
                  onChange={e => setField(ad.id, 'adSetId', e.target.value)}
                  className="cell-input w-full font-mono text-[10px]"
                  placeholder="Ad Set ID"
                />
              </td>

              {/* Campaign ID */}
              <td className="px-2 py-1 border-r border-border" style={{ minWidth: 130 }}>
                <input
                  value={ad.campaignId || ''}
                  onChange={e => setField(ad.id, 'campaignId', e.target.value)}
                  className="cell-input w-full font-mono text-[10px]"
                  placeholder="Campaign ID"
                />
              </td>

              {/* Preview Link */}
              <td className="px-2 py-1 border-r border-border" style={{ minWidth: 200 }}>
                {ad.previewLink ? (
                  <a href={ad.previewLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Preview
                  </a>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic opacity-40">auto-populated</span>
                )}
              </td>

              {/* Actions */}
              <td className="px-2 py-1">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => duplicateAd(ad.id)}
                    className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeAd(ad.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Matrix View ───────────────────────────────────────────────────────────────

interface MatrixViewProps {
  creatives: CreativeRow[];
  adSets: AdSetRow[];
  checked: Set<MatrixKey>;
  existingKeys: Set<MatrixKey>;
  onToggle: (cId: string, aId: string) => void;
  onToggleRow: (cId: string) => void;
  onToggleCol: (aId: string) => void;
}

function MatrixView({ creatives, adSets, checked, existingKeys, onToggle, onToggleRow, onToggleCol }: MatrixViewProps) {
  if (creatives.length === 0 || adSets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-700 text-foreground mb-1">Nothing to map yet</p>
          <p className="text-xs text-muted-foreground">Fill in at least one ad set and one creative first, then come back here to assemble your ads.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="inline-block min-w-full">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-52 min-w-[208px] p-2 text-left text-[10px] text-muted-foreground font-700 uppercase tracking-wider border-b-2 border-r-2 border-border bg-surface-1 sticky left-0 z-20">
                Creative ↓ / Ad Set →
              </th>
              {adSets.map(adSet => {
                const colKeys = creatives.map(c => matrixKey(c.id, adSet.id));
                const allChecked = colKeys.every(k => checked.has(k));
                const someChecked = colKeys.some(k => checked.has(k));
                return (
                  <th key={adSet.id} className="p-0 border-b-2 border-r border-border bg-surface-1 min-w-[110px] max-w-[150px]">
                    <button
                      onClick={() => onToggleCol(adSet.id)}
                      className={`w-full h-full px-2 py-2 text-left transition-colors hover:bg-surface-2 ${allChecked ? 'text-primary' : someChecked ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      <div className="text-[10px] font-700 uppercase tracking-wider truncate">{adSet.name || '—'}</div>
                      <div className="text-[9px] text-muted-foreground truncate mt-0.5">{adSet.campaignName || 'No campaign'}</div>
                      <div className={`mt-1 text-[9px] font-600 ${allChecked ? 'text-primary' : someChecked ? 'text-foreground/60' : 'text-muted-foreground/40'}`}>
                        {allChecked ? '✓ All' : someChecked ? `${colKeys.filter(k => checked.has(k)).length}/${creatives.length}` : 'Click to select all'}
                      </div>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {creatives.map((creative, ci) => {
              const rowKeys = adSets.map(a => matrixKey(creative.id, a.id));
              const allChecked = rowKeys.every(k => checked.has(k));
              const someChecked = rowKeys.some(k => checked.has(k));
              const dimLabel = creative.adType === 'video'
                ? (creative.assetLength ? `${creative.assetLength}s` : 'Video')
                : creative.placementDimensions?.length > 1
                  ? 'Placement Custom'
                  : creative.placementDimensions?.[0] || '';

              return (
                <tr key={creative.id} className={`border-b border-border ${ci % 2 === 0 ? 'bg-surface-0' : 'bg-surface-1/30'}`}>
                  <td className="p-0 border-r-2 border-border sticky left-0 bg-inherit z-10">
                    <button
                      onClick={() => onToggleRow(creative.id)}
                      className={`w-full h-full px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${allChecked ? 'text-primary' : someChecked ? 'text-foreground' : 'text-foreground'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-700 ${
                          creative.adType === 'video' ? 'bg-violet-500/20 text-violet-400' :
                          creative.adType === 'carousel' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-surface-2 text-muted-foreground'
                        }`}>
                          {creative.adType?.toUpperCase() || 'STATIC'}
                        </span>
                        {dimLabel && <span className="text-[9px] text-muted-foreground font-mono">{dimLabel}</span>}
                      </div>
                      <div className="text-[11px] font-600 text-foreground mt-0.5 truncate max-w-[180px]">
                        {creative.concept || creative.creativeId || 'Untitled'}
                      </div>
                    </button>
                  </td>
                  {adSets.map(adSet => {
                    const key = matrixKey(creative.id, adSet.id);
                    const isChecked = checked.has(key);
                    const isExisting = existingKeys.has(key);
                    return (
                      <td key={adSet.id} className="p-0 border-r border-border text-center">
                        <button
                          onClick={() => !isExisting && onToggle(creative.id, adSet.id)}
                          disabled={isExisting}
                          className={`w-full h-full min-h-[52px] flex items-center justify-center transition-all ${
                            isExisting
                              ? 'bg-emerald-500/10 cursor-default'
                              : isChecked
                                ? 'bg-primary/20 hover:bg-primary/30'
                                : 'hover:bg-surface-2'
                          }`}
                        >
                          {isExisting ? (
                            <span className="text-emerald-400 text-base">✓</span>
                          ) : isChecked ? (
                            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                              <span className="text-primary-foreground text-[10px] font-700">✓</span>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded border border-border bg-surface-2 group-hover:border-primary/50" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
