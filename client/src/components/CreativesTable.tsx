// CreativesTable — row-per-creative bulk-entry table
// Columns: # | ID | Asset Type (buttons) | Dimensions (pills) | Creative Concept | Asset Length | Asset(s) | Website URL | Headline (40) | Primary Text (125) | Description (30) | CTA | UTM Params
// Multiple dimensions = placement-customized (stacked asset inputs with per-placement URL/copy overrides)
// Single dimension = can use post ID / dark post / social proof

import { useRef, KeyboardEvent, useState, useCallback, useEffect } from 'react';
import { Plus, Copy, Trash2, ChevronDown, Link2, Share2, ChevronUp, Layers, ChevronRight, Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  CreativeRow, CarouselCard, PlacementDimension, PlacementAsset,
  PLACEMENT_DIMENSIONS, newCreative, newCarouselCard, CTA_OPTIONS,
  AdType, genId, generateCreativeId,
} from '@/lib/campaignStore';
import AssetDropCell, { AssetFile } from './AssetDropCell';
import MediaBrowserModal, { MediaSelection } from './MediaBrowserModal';
import { toast } from 'sonner';
import { BuildSettings } from '@/lib/campaignStore';

interface Props {
  rows: CreativeRow[];
  carouselRows: CreativeRow[];
  onChange: (rows: CreativeRow[]) => void;
  onCarouselChange: (rows: CreativeRow[]) => void;
  settings?: BuildSettings;
}

interface AssetUploadModalProps {
  settings: BuildSettings;
  onClose: () => void;
}

function AssetUploadModal({ settings, onClose }: AssetUploadModalProps) {
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<'image' | 'video'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ hash?: string; videoId?: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageMut = trpc.meta.uploadImage.useMutation();
  const uploadVideoMut = trpc.meta.uploadVideo.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!assetName) setAssetName(f.name.replace(/\.[^.]+$/, ''));
    setAssetType(f.type.startsWith('video') ? 'video' : 'image');
  };

  const handleUpload = async () => {
    if (!settings.accessToken || !settings.adAccountId) {
      toast.error('Configure access token and ad account in Settings first.');
      return;
    }
    const name = assetName.trim() || 'Untitled Asset';
    setUploading(true);
    try {
      if (mode === 'file' && file) {
        const reader = new FileReader();
        const b64 = await new Promise<string>((res, rej) => {
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        if (assetType === 'image') {
          const r = await uploadImageMut.mutateAsync({
            accessToken: settings.accessToken,
            adAccountId: settings.adAccountId,
            imageBase64: b64,
            fileName: file.name,
          });
          setResult({ hash: r.hash, name });
          toast.success(`Image uploaded — hash: ${r.hash}`);
        } else {
          const r = await uploadVideoMut.mutateAsync({
            accessToken: settings.accessToken,
            adAccountId: settings.adAccountId,
            videoBase64: b64,
            fileName: file.name,
            title: name,
          });
          setResult({ videoId: r.videoId, name });
          toast.success(`Video uploaded — ID: ${r.videoId}`);
        }
      } else if (mode === 'url' && urlInput.trim()) {
        // For URL-based: fetch and re-upload
        toast.info('Fetching asset from URL…');
        const resp = await fetch(urlInput.trim());
        const blob = await resp.blob();
        const isVideo = blob.type.startsWith('video');
        const reader = new FileReader();
        const b64 = await new Promise<string>((res, rej) => {
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        const ext = isVideo ? 'mp4' : 'jpg';
        const fn = `${name}.${ext}`;
        if (isVideo) {
          const r = await uploadVideoMut.mutateAsync({
            accessToken: settings.accessToken,
            adAccountId: settings.adAccountId,
            videoBase64: b64,
            fileName: fn,
            title: name,
          });
          setResult({ videoId: r.videoId, name });
          toast.success(`Video uploaded — ID: ${r.videoId}`);
        } else {
          const r = await uploadImageMut.mutateAsync({
            accessToken: settings.accessToken,
            adAccountId: settings.adAccountId,
            imageBase64: b64,
            fileName: fn,
          });
          setResult({ hash: r.hash, name });
          toast.success(`Image uploaded — hash: ${r.hash}`);
        }
      } else {
        toast.error('Select a file or enter a URL.');
      }
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h2 className="text-sm font-700 text-foreground">Asset Upload</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Upload an image or video directly to your ad account library</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Asset Name */}
          <div>
            <label className="text-[11px] font-600 text-muted-foreground block mb-1">Asset Name</label>
            <input value={assetName} onChange={e => setAssetName(e.target.value)}
              placeholder="e.g. Summer Campaign Hero" className="cell-input w-full" />
          </div>
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5 w-fit">
            {(['file', 'url'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-600 transition-all capitalize ${
                  mode === m ? 'bg-surface-1 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>{m === 'file' ? 'Upload File' : 'From URL'}</button>
            ))}
          </div>
          {mode === 'file' ? (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-600 text-foreground">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · {file.type}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                    <p className="text-[12px] text-muted-foreground">Click to select image or video file</p>
                  </div>
                )}
              </button>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-600 text-muted-foreground block mb-1">Asset URL</label>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg" className="cell-input w-full font-mono text-[11px]" />
              <p className="text-[10px] text-muted-foreground mt-1">The asset will be fetched and uploaded to your ad account library.</p>
            </div>
          )}
          {result && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[11px] font-700 text-emerald-400">Upload successful!</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {result.hash ? `Image hash: ${result.hash}` : `Video ID: ${result.videoId}`}
              </p>
              <p className="text-[10px] text-muted-foreground">Name: {result.name}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-600 text-muted-foreground hover:text-foreground border border-border hover:bg-surface-2 transition-all">Close</button>
          {!result && (
            <button onClick={handleUpload} disabled={uploading || (!file && !urlInput.trim())}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-700 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : 'Upload to Library'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const AD_TYPES: { value: AdType; label: string }[] = [
  { value: 'static',   label: 'Static' },
  { value: 'video',    label: 'Video' },
  { value: 'carousel', label: 'Carousel' },
];

function Th({ children, w, required, muted, limit }: { children?: React.ReactNode; w?: number; required?: boolean; muted?: boolean; limit?: number }) {
  return (
    <th style={w ? { minWidth: w, width: w } : undefined}
      className={`px-2 py-2 text-left text-[10px] font-700 tracking-wider border-r border-border whitespace-nowrap ${muted ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
      {children}
      {required && <span className="text-primary ml-0.5">*</span>}
      {limit && <span className="text-muted-foreground/50 font-400 ml-1">({limit})</span>}
    </th>
  );
}

function CharCell({ value, limit, onChange, onKeyDown, placeholder, multiline, dataCell }: {
  value: string; limit: number; onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  placeholder?: string; multiline?: boolean; dataCell?: string;
}) {
  const count = value.length;
  const over = count > limit;
  const near = count > limit * 0.85;
  return (
    <div className="relative">
      {multiline ? (
        <textarea data-cell={dataCell} value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown as (e: KeyboardEvent<HTMLTextAreaElement>) => void}
          placeholder={placeholder} rows={2}
          className="cell-input w-full resize-none text-[11px] pb-3" />
      ) : (
        <input data-cell={dataCell} value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown as (e: KeyboardEvent<HTMLInputElement>) => void}
          placeholder={placeholder} className="cell-input w-full pb-3" />
      )}
      <span className={`absolute bottom-0.5 right-1 text-[9px] font-mono ${over ? 'text-red-400' : near ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
        {count}/{limit}
      </span>
    </div>
  );
}

/** Multi-variant copy cell — up to 5 variants with expand/collapse */
function MultiVariantCell({ values, limit, onChange, placeholder, multiline, dataCell }: {
  values: string[]; limit: number; onChange: (vals: string[]) => void;
  placeholder?: string; multiline?: boolean; dataCell?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 5;
  const safeVals = values.length > 0 ? values : [''];

  const setVal = (idx: number, v: string) => {
    const next = [...safeVals];
    next[idx] = v;
    onChange(next);
  };

  const addVariant = () => {
    if (safeVals.length >= MAX) return;
    onChange([...safeVals, '']);
    setExpanded(true);
  };

  const removeVariant = (idx: number) => {
    if (safeVals.length <= 1) return;
    onChange(safeVals.filter((_, i) => i !== idx));
  };

  const count0 = safeVals[0].length;
  const over0 = count0 > limit;
  const near0 = count0 > limit * 0.85;

  return (
    <div className="relative">
      {/* Primary variant */}
      <div className="relative">
        {multiline ? (
          <textarea data-cell={dataCell} value={safeVals[0]} onChange={e => setVal(0, e.target.value)}
            placeholder={placeholder} rows={2}
            className="cell-input w-full resize-none text-[11px] pb-3" />
        ) : (
          <input data-cell={dataCell} value={safeVals[0]} onChange={e => setVal(0, e.target.value)}
            placeholder={placeholder} className="cell-input w-full pb-3" />
        )}
        <span className={`absolute bottom-0.5 right-1 text-[9px] font-mono ${over0 ? 'text-red-400' : near0 ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
          {count0}/{limit}
        </span>
      </div>

      {/* Variant toggle */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 border-t border-border/50 bg-surface-2/50">
        <button onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
          {safeVals.length > 1 ? `${safeVals.length} variants` : 'Variants'}
        </button>
        {safeVals.length < MAX && (
          <button onClick={addVariant} className="ml-auto text-[9px] text-primary hover:text-primary/80 transition-colors">+ Add</button>
        )}
      </div>

      {/* Additional variants */}
      {expanded && safeVals.slice(1).map((v, idx) => {
        const realIdx = idx + 1;
        const cnt = v.length;
        const ov = cnt > limit;
        const nr = cnt > limit * 0.85;
        return (
          <div key={realIdx} className="relative border-t border-border/30">
            <div className="absolute left-1 top-1 text-[8px] text-muted-foreground/50 font-mono z-10">V{realIdx + 1}</div>
            {multiline ? (
              <textarea value={v} onChange={e => setVal(realIdx, e.target.value)}
                placeholder={`Variant ${realIdx + 1}`} rows={2}
                className="cell-input w-full resize-none text-[11px] pb-3 pl-5" />
            ) : (
              <input value={v} onChange={e => setVal(realIdx, e.target.value)}
                placeholder={`Variant ${realIdx + 1}`} className="cell-input w-full pb-3 pl-5" />
            )}
            <span className={`absolute bottom-0.5 right-5 text-[9px] font-mono ${ov ? 'text-red-400' : nr ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
              {cnt}/{limit}
            </span>
            <button onClick={() => removeVariant(realIdx)}
              className="absolute bottom-0.5 right-1 text-[9px] text-muted-foreground/40 hover:text-destructive transition-colors">
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Stacked asset inputs for placement-customized creatives */
function PlacementAssetStack({ row, dims, onUpdate, settings, onBrowse }: {
  row: CreativeRow;
  dims: PlacementDimension[];
  onUpdate: (assets: PlacementAsset[]) => void;
  settings?: BuildSettings;
  onBrowse?: (dim: PlacementDimension) => void;
}) {
  const [expanded, setExpanded] = useState<Set<PlacementDimension>>(new Set());

  const getAsset = (dim: PlacementDimension): PlacementAsset => {
    return row.placementAssets.find(a => a.dimension === dim) || { dimension: dim, assetUrl: '' };
  };

  const setAsset = (dim: PlacementDimension, field: keyof PlacementAsset, val: string | File | undefined) => {
    const existing = row.placementAssets.find(a => a.dimension === dim);
    const updated: PlacementAsset = existing ? { ...existing, [field]: val } : { dimension: dim, assetUrl: '', [field]: val };
    const rest = row.placementAssets.filter(a => a.dimension !== dim);
    onUpdate([...rest, updated]);
  };

  const setAssetFile = (dim: PlacementDimension, assetFile: AssetFile | null) => {
    const existing = row.placementAssets.find(a => a.dimension === dim);
    const updated: PlacementAsset = {
      ...(existing || { dimension: dim }),
      assetUrl: assetFile?.name || '',
      localFile: assetFile?.file,
      localPreviewUrl: assetFile?.previewUrl,
    };
    const rest = row.placementAssets.filter(a => a.dimension !== dim);
    onUpdate([...rest, updated]);
  };

  const toggleExpand = (dim: PlacementDimension) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(dim) ? next.delete(dim) : next.add(dim);
      return next;
    });
  };

  const isVideo = row.adType === 'video';

  return (
    <div className="space-y-1 p-1">
      {dims.map(dim => {
        const asset = getAsset(dim);
        const isExpanded = expanded.has(dim);
        const hasOverrides = !!(asset.websiteUrl || asset.primaryText);
        const dimLabel = dim === '9:16' ? 'Stories/Reels' : dim === '4:5' ? 'Feed' : dim === '1:1' ? 'Square' : dim;
        return (
          <div key={dim} className="rounded border border-border overflow-hidden">
            <div className="flex items-center gap-1 px-1.5 py-1 bg-surface-2">
              <span className="text-[9px] font-700 text-indigo-400 w-8 flex-shrink-0" title={dimLabel}>{dim}</span>
              <AssetDropCell
                value={asset.localFile ? { file: asset.localFile, name: asset.assetUrl, previewUrl: asset.localPreviewUrl ?? '', type: isVideo ? 'video' : 'image', size: asset.localFile.size } : null}
                accept={isVideo ? 'video/*' : 'image/*'}
                textValue={asset.assetUrl}
                onTextChange={v => setAsset(dim, 'assetUrl', v)}
                onFileChange={f => setAssetFile(dim, f)}
              />
              {settings?.accessToken && settings?.adAccountId && onBrowse && (
                <button onClick={() => onBrowse(dim)}
                  className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-600 text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded transition-all bg-primary/5 hover:bg-primary/10"
                  title={`Browse library for ${dimLabel}`}>
                  <Layers className="w-2.5 h-2.5" />
                </button>
              )}
              <button onClick={() => toggleExpand(dim)}
                className={`flex-shrink-0 p-0.5 rounded transition-colors ${hasOverrides ? 'text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
                title="Per-placement URL / copy overrides">
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            {isExpanded && (
              <div className="px-2 py-1.5 bg-surface-1 space-y-1">
                <div>
                  <label className="text-[9px] text-amber-400 block mb-0.5">URL Override (optional)</label>
                  <input value={asset.websiteUrl || ''} onChange={e => setAsset(dim, 'websiteUrl', e.target.value)}
                    placeholder="Override row URL for this placement"
                    className="cell-input w-full text-[10px] font-mono" />
                </div>
                <div>
                  <label className="text-[9px] text-amber-400 block mb-0.5">Primary Text Override (optional)</label>
                  <textarea value={asset.primaryText || ''} onChange={e => setAsset(dim, 'primaryText', e.target.value)}
                    placeholder="Override row primary text for this placement"
                    rows={2} className="cell-input w-full text-[10px] resize-none" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Carousel cards sub-table */
function CarouselCards({ cards, onUpdate, settings }: {
  cards: CarouselCard[];
  onUpdate: (cards: CarouselCard[]) => void;
  settings?: BuildSettings;
}) {
  const [mediaBrowserTarget, setMediaBrowserTarget] = useState<{ cardId: string } | null>(null);

  const addCard = () => onUpdate([...cards, newCarouselCard(cards.length + 1)]);
  const removeCard = (id: string) => onUpdate(cards.filter(c => c.id !== id));
  const setCard = (id: string, field: keyof CarouselCard, val: unknown) => {
    onUpdate(cards.map(c => c.id === id ? { ...c, [field]: val } : c));
  };
  const setCardFile = (id: string, assetFile: AssetFile | null) => {
    onUpdate(cards.map(c => c.id === id ? {
      ...c,
      fileHash: assetFile?.name || '',
      fileName: assetFile?.file.name || c.fileName,
      localFile: assetFile?.file,
      localPreviewUrl: assetFile?.previewUrl,
    } : c));
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-700 text-amber-400 flex items-center gap-1">
          <Layers className="w-3 h-3" /> Carousel Cards
        </span>
        <button onClick={addCard} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors">
          <Plus className="w-3 h-3" /> Add Card
        </button>
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-surface-3">
            <th className="px-2 py-1 text-left text-muted-foreground font-600 border border-border w-12">Card #</th>
            <th className="px-2 py-1 text-left text-muted-foreground font-600 border border-border">File Name</th>
            <th className="px-2 py-1 text-left text-muted-foreground font-600 border border-border min-w-[220px]">File Hash / Asset</th>
            <th className="px-2 py-1 text-left text-muted-foreground font-600 border border-border">Headline</th>
            <th className="px-2 py-1 text-left text-muted-foreground font-600 border border-border">Description</th>
            <th className="px-2 py-1 text-left text-muted-foreground font-600 border border-border">Card URL</th>
            <th className="px-2 py-1 border border-border w-8"></th>
          </tr>
        </thead>
        <tbody>
          {cards.map(card => (
            <tr key={card.id} className="group">
              <td className="border border-border p-0">
                <input value={String(card.cardNumber)} onChange={e => setCard(card.id, 'cardNumber', e.target.value)}
                  className="cell-input w-full text-center font-mono" type="number" min="1" />
              </td>
              <td className="border border-border p-0">
                <input value={card.fileName} onChange={e => setCard(card.id, 'fileName', e.target.value)}
                  placeholder="Hu_Static_4x5_Card1" className="cell-input w-full font-mono" />
              </td>
              {/* File Hash / Asset — AssetDropCell + Browse Library */}
              <td className="border border-border p-0">
                <div className="flex items-center gap-1 px-1">
                  <div className="flex-1 min-w-0">
                    <AssetDropCell
                      value={card.localFile ? {
                        file: card.localFile,
                        name: card.fileHash,
                        previewUrl: card.localPreviewUrl ?? '',
                        type: 'image',
                        size: card.localFile.size,
                      } : card.localPreviewUrl ? {
                        // Media browser selection — no local file, but has CDN preview URL
                        file: new File([], card.fileName || 'asset'),
                        name: card.fileName || card.fileHash,
                        previewUrl: card.localPreviewUrl,
                        type: 'image',
                        size: 0,
                      } : null}
                      accept="image/*"
                      textValue={card.fileHash}
                      onTextChange={v => setCard(card.id, 'fileHash', v)}
                      onFileChange={f => setCardFile(card.id, f)}
                    />
                  </div>
                  {settings?.accessToken && settings?.adAccountId && (
                    <button
                      onClick={() => setMediaBrowserTarget({ cardId: card.id })}
                      className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-600 text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded transition-all bg-primary/5 hover:bg-primary/10"
                      title="Browse account media library">
                      <Layers className="w-2.5 h-2.5" />
                      <span>Browse</span>
                    </button>
                  )}
                </div>
              </td>
              <td className="border border-border p-0">
                <input value={card.headline} onChange={e => setCard(card.id, 'headline', e.target.value)}
                  placeholder="Chocolate is like a carousel" className="cell-input w-full" />
              </td>
              <td className="border border-border p-0">
                <input value={card.description} onChange={e => setCard(card.id, 'description', e.target.value)}
                  placeholder="Such good coco..." className="cell-input w-full" />
              </td>
              <td className="border border-border p-0">
                <input value={card.url} onChange={e => setCard(card.id, 'url', e.target.value)}
                  placeholder="https://..." className="cell-input w-full font-mono" />
              </td>
              <td className="border border-border text-center">
                <button onClick={() => removeCard(card.id)}
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cards.length === 0 && (
        <div className="text-center py-2 text-[10px] text-muted-foreground">No cards yet — click Add Card</div>
      )}

      {/* Media Browser Modal for carousel cards */}
      {mediaBrowserTarget !== null && settings && (
        <MediaBrowserModal
          settings={settings}
          defaultTab="images"
          onSelect={(media: MediaSelection) => {
            const cardId = mediaBrowserTarget.cardId;
            // Update hash, fileName, and preview URL atomically in one onUpdate call
            const assetHash = media.type === 'image' ? (media.hash || '') : (media.videoId || '');
            onUpdate(cards.map(c => c.id === cardId ? {
              ...c,
              fileHash: assetHash,
              fileName: media.name || c.fileName,
              localPreviewUrl: media.url || c.localPreviewUrl,
            } : c));
            setMediaBrowserTarget(null);
          }}
          onClose={() => setMediaBrowserTarget(null)}
        />
      )}
    </div>
  );
}

/** Single-row table for static/video creatives */
function StaticVideoTable({ rows, onChange, settings }: { rows: CreativeRow[]; onChange: (rows: CreativeRow[]) => void; settings?: BuildSettings }) {
  const [mediaBrowserTarget, setMediaBrowserTarget] = useState<{ rowIndex: number; type: 'image' | 'video'; placement: 'feed' | 'stories'; exactDim?: PlacementDimension } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const set = (idx: number, key: keyof CreativeRow, val: unknown) => {
    const updated = rows.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, [key]: val };
      // Auto-generate creative ID when concept or type changes
      if (key === 'concept' || key === 'adType' || key === 'assetLength') {
        next.creativeId = generateCreativeId(
          key === 'concept' ? (val as string) : next.concept,
          key === 'adType' ? (val as AdType) : next.adType,
          key === 'assetLength' ? (val as string) : next.assetLength
        );
      }
      if (key === 'placementDimensions') {
        next.placementCustomized = (val as PlacementDimension[]).length > 1;
        // Reset placement assets when dimensions change
        const dims = val as PlacementDimension[];
        next.placementAssets = dims.map(dim => {
          const existing = r.placementAssets.find(a => a.dimension === dim);
          return existing || { dimension: dim, assetUrl: '' };
        });
      }
      return next;
    });
    onChange(updated);
  };

  const toggleDimension = (idx: number, dim: PlacementDimension) => {
    const current = rows[idx].placementDimensions;
    const next = current.includes(dim) ? current.filter(d => d !== dim) : [...current, dim];
    set(idx, 'placementDimensions', next);
  };

  const addRows = (n = 1) => onChange([...rows, ...Array.from({ length: n }, () => newCreative())]);

  const duplicate = (idx: number) => {
    const copy = { ...rows[idx], id: genId(), postId: '', carouselCards: [] };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const remove = (idx: number) => {
    if (rows.length === 1) { toast.error('At least one creative row is required.'); return; }
    onChange(rows.filter((_, i) => i !== idx));
  };

  const focusCell = (row: number, col: number) => {
    setTimeout(() => {
      const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`);
      el?.focus();
    }, 50);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number, totalCols = 10) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      const nextRow = nextCol < 0 ? rowIdx - 1 : nextCol >= totalCols ? rowIdx + 1 : rowIdx;
      const actualCol = nextCol < 0 ? totalCols - 1 : nextCol >= totalCols ? 0 : nextCol;
      if (nextRow >= rows.length) addRows(1);
      focusCell(nextRow < 0 ? 0 : nextRow, actualCol);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextRow = rowIdx + 1;
      if (nextRow >= rows.length) addRows(1);
      focusCell(nextRow, colIdx);
    }
  };

  const filledCount = rows.filter(r => r.concept.trim() || r.creativeId.trim()).length;

  // ── Paste-from-spreadsheet ──────────────────────────────────────────────────
  // Column order for paste: Creative Concept | Length | Website URL | Headline | Primary Text | Description | CTA | Link to UTM
  const PASTE_COLS = ['concept', 'assetLength', 'websiteUrl', 'headlines', 'primaryTexts', 'descriptions', 'cta', 'urlParams'] as const;
  type PasteCol = typeof PASTE_COLS[number];

  // Track which row is "focused" for paste anchor
  const [pasteAnchorRow, setPasteAnchorRow] = useState<number | null>(null);

  // Use a stable ref for the paste handler so the effect can clean up properly
  const pasteAnchorRowRef = useRef<number | null>(null);
  const rowsRef = useRef(rows);
  const onChangeRef = useRef(onChange);
  useEffect(() => { pasteAnchorRowRef.current = pasteAnchorRow; }, [pasteAnchorRow]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const applyPaste = useCallback((text: string) => {
    if (!text.includes('\t') && !text.includes('\n')) return false;
    const pasteRows = text.trim().split('\n').map(line => line.split('\t'));
    const startRow = pasteAnchorRowRef.current ?? 0;
    const currentRows = rowsRef.current;

    // Ensure we have enough rows
    const needed = startRow + pasteRows.length;
    let workingRows = [...currentRows];
    while (workingRows.length < needed) workingRows.push(newCreative());

    const updated = workingRows.map((r, ri) => {
      const pasteRowIdx = ri - startRow;
      if (pasteRowIdx < 0 || pasteRowIdx >= pasteRows.length) return r;
      const cells = pasteRows[pasteRowIdx];
      const patch: Partial<CreativeRow> = {};
      cells.forEach((val, ci) => {
        if (ci >= PASTE_COLS.length) return;
        const key = PASTE_COLS[ci] as PasteCol;
        const trimmed = val.trim();
        if (key === 'headlines' || key === 'primaryTexts' || key === 'descriptions') {
          const existing = (r[key] as string[]) || [''];
          patch[key] = [trimmed, ...existing.slice(1)];
        } else if (key === 'concept') {
          patch.concept = trimmed;
          patch.creativeId = generateCreativeId(trimmed, r.adType, r.assetLength);
        } else {
          (patch as Record<string, unknown>)[key] = trimmed;
        }
      });
      return { ...r, ...patch };
    });

    onChangeRef.current(updated);
    toast.success(`Pasted ${pasteRows.length} row${pasteRows.length === 1 ? '' : 's'} into Creative Library`);
    return true;
  }, []);

  // Global paste listener: fires when the table container or any child has focus
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (!tableRef.current?.contains(active)) return;
      // Let normal paste work in text inputs / textareas
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (applyPaste(text)) e.preventDefault();
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [applyPaste]);

  // React onPaste fallback (catches paste when the container div itself is focused)
  const handleTablePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    const text = e.clipboardData.getData('text/plain');
    if (applyPaste(text)) e.preventDefault();
  }, [applyPaste]);

  return (
    <div>
      {/* Sub-toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-1/50">
        <span className="text-[11px] font-700 text-foreground">Static &amp; Video Creatives</span>
        {pasteAnchorRow !== null && (
          <span className="text-[10px] text-primary/80 flex items-center gap-1">
            <span className="font-mono bg-primary/10 px-1 py-0.5 rounded text-[9px]">Ctrl+V</span>
            Paste from row {pasteAnchorRow + 1} · Cols: Concept | Length | URL | Headline | Primary Text | Description | CTA | UTM
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => addRows(1)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-[11px] font-600 text-foreground border border-border transition-all">
            <Plus className="w-3 h-3" /> Add Row
          </button>
          <button onClick={() => addRows(5)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-[11px] font-600 text-foreground border border-border transition-all">
            <Plus className="w-3 h-3" /> Add 5 Rows
          </button>
          <span className="text-[10px] text-muted-foreground font-mono">{filledCount}/{rows.length}</span>
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto outline-none" tabIndex={-1} onPaste={handleTablePaste}>
        <table className="w-full border-collapse text-xs" style={{ minWidth: 1900 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-2 border-b-2 border-border">
              <Th w={32}>#</Th>
              <Th w={90}>ID (auto)</Th>
              <Th w={110}>Asset Type</Th>
              <Th w={130}>Dimensions</Th>
              <Th w={180} required>Creative Concept</Th>
              <Th w={80}>Length (s)</Th>
              <Th w={200}>Feed Asset</Th>
              <Th w={200}>Stories/Reels Asset</Th>
              <Th w={180}>Website URL</Th>
              <Th w={180} limit={40}>Headline</Th>
              <Th w={220} limit={125}>Primary Text</Th>
              <Th w={160} limit={30}>Description</Th>
              <Th w={120}>CTA</Th>
              <Th w={200}>Link to UTM</Th>
              <Th w={64}></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isPlacementCustom = row.placementDimensions.length > 1;
              const isPostIdOk = row.placementDimensions.length === 1;
              const isVideo = row.adType === 'video';

              return (
                <tr key={row.id}
                  className={`border-b border-border group hover:bg-surface-2/30 transition-colors ${pasteAnchorRow === i ? 'ring-1 ring-inset ring-primary/40' : ''}`}
                  onClick={(e) => {
                    // Don't steal focus from inputs/buttons
                    const t = e.target as HTMLElement;
                    if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT' && t.tagName !== 'BUTTON') {
                      tableRef.current?.focus({ preventScroll: true });
                    }
                    setPasteAnchorRow(i);
                  }}
                >
                  {/* # */}
                  <td className="px-2 py-0 text-center text-[10px] text-muted-foreground font-mono border-r border-border select-none">{i + 1}</td>

                  {/* Creative ID (auto) */}
                  <td className="p-0 border-r border-border">
                    <input data-cell={`${i}-0`} value={row.creativeId}
                      onChange={e => set(i, 'creativeId', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 0)}
                      placeholder="auto" className="cell-input w-full font-mono text-[10px] text-muted-foreground" />
                  </td>

                  {/* Asset Type */}
                  <td className="p-1.5 border-r border-border">
                    <div className="flex gap-0.5">
                      {AD_TYPES.filter(t => t.value !== 'carousel').map(({ value, label }) => (
                        <button key={value} onClick={() => set(i, 'adType', value)}
                          className={`flex-1 py-1 rounded text-[10px] font-700 transition-all border ${
                            row.adType === value
                              ? value === 'static'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                : 'bg-violet-500/20 text-violet-400 border-violet-500/40'
                              : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* Dimensions */}
                  <td className="p-1.5 border-r border-border">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1">
                        {PLACEMENT_DIMENSIONS.map(dim => {
                          const sel = row.placementDimensions.includes(dim);
                          return (
                            <button key={dim} onClick={() => toggleDimension(i, dim)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-700 transition-all border ${
                                sel ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground'
                              }`}>
                              {dim}
                            </button>
                          );
                        })}
                      </div>
                      {isPlacementCustom && (
                        <span className="text-[9px] font-700 text-indigo-400 flex items-center gap-0.5">
                          <Share2 className="w-2.5 h-2.5" /> PLACEMENT CUSTOM
                        </span>
                      )}
                      {isPostIdOk && row.placementDimensions.length > 0 && (
                        <span className="text-[9px] font-700 text-emerald-400 flex items-center gap-0.5">
                          <Link2 className="w-2.5 h-2.5" /> POST ID OK
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Creative Concept */}
                  <td className="p-0 border-r border-border">
                    <input data-cell={`${i}-1`} value={row.concept}
                      onChange={e => set(i, 'concept', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 1)}
                      placeholder="e.g. Fine Print" className="cell-input w-full" />
                  </td>

                  {/* Asset Length */}
                  <td className="p-0 border-r border-border">
                    <input data-cell={`${i}-2`} value={row.assetLength}
                      onChange={e => set(i, 'assetLength', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 2)}
                      placeholder={isVideo ? '15, 30...' : '—'}
                      disabled={!isVideo} type={isVideo ? 'number' : 'text'} min="0"
                      className="cell-input w-full font-mono text-center disabled:opacity-30 disabled:cursor-not-allowed" />
                  </td>

                  {/* Feed Asset + Stories/Reels Asset — two separate columns */}
                  {isPlacementCustom ? (
                    <>
                      {/* Feed column: show 4:5 and 1:1 assets */}
                      <td className="p-0 border-r border-border min-w-[200px]">
                        <PlacementAssetStack
                          row={row}
                          dims={row.placementDimensions.filter(d => d !== '9:16')}
                          onUpdate={assets => set(i, 'placementAssets', assets)}
                          settings={settings}
                          onBrowse={(dim) => setMediaBrowserTarget({ rowIndex: i, type: isVideo ? 'video' : 'image', placement: 'feed', exactDim: dim })}
                        />
                      </td>
                      {/* Stories/Reels column: show 9:16 asset */}
                      <td className="p-0 border-r border-border min-w-[200px]">
                        <PlacementAssetStack
                          row={row}
                          dims={row.placementDimensions.filter(d => d === '9:16')}
                          onUpdate={assets => set(i, 'placementAssets', assets)}
                          settings={settings}
                          onBrowse={(dim) => setMediaBrowserTarget({ rowIndex: i, type: isVideo ? 'video' : 'image', placement: 'stories', exactDim: dim })}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Feed Asset (4:5) */}
                      <td className="p-0 border-r border-border min-w-[200px]">
                        <div className="flex flex-col gap-1 p-1">
                          <AssetDropCell
                            value={null}
                            accept={isVideo ? 'video/*' : 'image/*'}
                            textValue={row.placementAssets.find(a => a.dimension === '4:5')?.assetUrl || row.placementAssets[0]?.assetUrl || ''}
                            onTextChange={v => {
                              const rest = row.placementAssets.filter(a => a.dimension !== '4:5');
                              set(i, 'placementAssets', [{ dimension: '4:5', assetUrl: v }, ...rest]);
                            }}
                            onFileChange={(assetFile) => {
                              const rest = row.placementAssets.filter(a => a.dimension !== '4:5');
                              set(i, 'placementAssets', [{
                                dimension: '4:5',
                                assetUrl: assetFile?.name || '',
                                localFile: assetFile?.file,
                                localPreviewUrl: assetFile?.previewUrl,
                              }, ...rest]);
                            }}
                          />
                          {settings?.accessToken && settings?.adAccountId && (
                            <button
                              onClick={() => setMediaBrowserTarget({ rowIndex: i, type: isVideo ? 'video' : 'image', placement: 'feed' })}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-600 text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded transition-all bg-primary/5 hover:bg-primary/10">
                              <Layers className="w-3 h-3" /> Browse Library
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Stories/Reels Asset (9:16) */}
                      <td className="p-0 border-r border-border min-w-[200px]">
                        <div className="flex flex-col gap-1 p-1">
                          <AssetDropCell
                            value={null}
                            accept={isVideo ? 'video/*' : 'image/*'}
                            textValue={row.placementAssets.find(a => a.dimension === '9:16')?.assetUrl || ''}
                            onTextChange={v => {
                              const rest = row.placementAssets.filter(a => a.dimension !== '9:16');
                              set(i, 'placementAssets', [...rest, { dimension: '9:16', assetUrl: v }]);
                            }}
                            onFileChange={(assetFile) => {
                              const rest = row.placementAssets.filter(a => a.dimension !== '9:16');
                              set(i, 'placementAssets', [...rest, {
                                dimension: '9:16',
                                assetUrl: assetFile?.name || '',
                                localFile: assetFile?.file,
                                localPreviewUrl: assetFile?.previewUrl,
                              }]);
                            }}
                          />
                          {settings?.accessToken && settings?.adAccountId && (
                            <button
                              onClick={() => setMediaBrowserTarget({ rowIndex: i, type: isVideo ? 'video' : 'image', placement: 'stories' })}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-600 text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded transition-all bg-primary/5 hover:bg-primary/10">
                              <Layers className="w-3 h-3" /> Browse Library
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}

                  {/* Website URL */}
                  <td className="p-0 border-r border-border">
                    <input data-cell={`${i}-4`} value={row.websiteUrl}
                      onChange={e => set(i, 'websiteUrl', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 4)}
                      placeholder="https://..." className="cell-input w-full font-mono text-[11px]" />
                    {!isPlacementCustom && row.adType !== 'carousel' && (
                      <button
                        onClick={() => set(i, 'placementDimensions', ['4:5', '9:16'])}
                        className="w-full text-[9px] text-indigo-400/70 hover:text-indigo-400 py-0.5 px-1 text-left transition-colors"
                        title="Split into per-placement URL and copy overrides">
                        + Customize by placement
                      </button>
                    )}
                  </td>

                  {/* Headline (40) — up to 5 variants */}
                  <td className="p-0 border-r border-border">
                    <MultiVariantCell dataCell={`${i}-5`} values={row.headlines?.length ? row.headlines : ['']} limit={40}
                      onChange={vals => set(i, 'headlines', vals)}
                      placeholder="Headline" />
                  </td>

                  {/* Primary Text (125) — up to 5 variants */}
                  <td className="p-0 border-r border-border">
                    <MultiVariantCell dataCell={`${i}-6`} values={row.primaryTexts?.length ? row.primaryTexts : ['']} limit={125}
                      onChange={vals => set(i, 'primaryTexts', vals)}
                      placeholder="Primary text" multiline />
                  </td>

                  {/* Description (30) — up to 5 variants */}
                  <td className="p-0 border-r border-border">
                    <MultiVariantCell dataCell={`${i}-7`} values={row.descriptions?.length ? row.descriptions : ['']} limit={30}
                      onChange={vals => set(i, 'descriptions', vals)}
                      placeholder="Description" />
                  </td>

                  {/* CTA */}
                  <td className="p-0 border-r border-border">
                    <div className="relative">
                      <select data-cell={`${i}-8`} value={row.cta}
                        onChange={e => set(i, 'cta', e.target.value)}
                        className="cell-input w-full appearance-none pr-6 cursor-pointer">
                        {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                  </td>

                  {/* UTM Params */}
                  <td className="p-0 border-r border-border">
                    <input data-cell={`${i}-9`} value={row.urlParams}
                      onChange={e => set(i, 'urlParams', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 9)}
                      placeholder="utm_source=meta&utm_medium=paid_social" className="cell-input w-full font-mono text-[10px]" />
                  </td>

                  {/* Actions */}
                  <td className="w-16">
                    <div className="flex items-center gap-0.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                      <button onClick={() => duplicate(i)} title="Duplicate"
                        className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={() => remove(i)} title="Delete"
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-4 py-2 flex items-center gap-3 border-t border-border">
          <button onClick={() => addRows(1)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Add row
          </button>
          <span className="text-muted-foreground text-[10px]">·</span>
          <button onClick={() => addRows(5)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Add 5 rows
          </button>
        </div>
      </div>

      {/* Media Browser Modal */}
      {mediaBrowserTarget !== null && settings && (
        <MediaBrowserModal
          settings={settings}
          defaultTab={mediaBrowserTarget.type === 'video' ? 'videos' : 'images'}
          onSelect={(media: MediaSelection) => {
            const i = mediaBrowserTarget.rowIndex;
            const row = rows[i];
            const assetUrl = media.type === 'image' ? (media.hash || '') : (media.videoId || '');
            // Use exactDim if set (placement-customized rows), otherwise map placement to standard dim
            const targetDim: PlacementDimension = mediaBrowserTarget.exactDim
              || (mediaBrowserTarget.placement === 'stories' ? '9:16' : '4:5');
            const rest = row.placementAssets.filter(a => a.dimension !== targetDim);
            set(i, 'placementAssets', [...rest, { dimension: targetDim, assetUrl }]);
          }}
          onClose={() => setMediaBrowserTarget(null)}
        />
      )}
    </div>
  );
}

/** Carousel table — parent row + expandable card sub-table */
function CarouselTable({ rows, onChange, settings }: { rows: CreativeRow[]; onChange: (rows: CreativeRow[]) => void; settings?: BuildSettings }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(rows.map(r => r.id)));

  const set = (idx: number, key: keyof CreativeRow, val: unknown) => {
    onChange(rows.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const addRow = () => {
    const newRow = newCreative({ adType: 'carousel', carouselCards: [newCarouselCard(1), newCarouselCard(2)] });
    onChange([...rows, newRow]);
    setExpandedRows(prev => new Set(Array.from(prev).concat(newRow.id)));
  };

  const duplicate = (idx: number) => {
    const copy = { ...rows[idx], id: genId(), carouselCards: rows[idx].carouselCards.map(c => ({ ...c, id: genId() })) };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    onChange(next);
    setExpandedRows(prev => new Set(Array.from(prev).concat(copy.id)));
  };

  const remove = (idx: number) => {
    if (rows.length === 0) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="mt-4">
      {/* Sub-toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-t border-border bg-amber-500/5">
        <span className="text-[11px] font-700 text-amber-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Carousel Creatives
        </span>
        <p className="text-[11px] text-muted-foreground">Each carousel has a parent row (shared fields) + card sub-rows.</p>
        <div className="ml-auto">
          <button onClick={addRow} className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[11px] font-600 text-amber-400 border border-amber-500/30 transition-all">
            <Plus className="w-3 h-3" /> Add Carousel
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">
          No carousel creatives yet — click Add Carousel to get started.
        </div>
      )}

      {rows.map((row, i) => {
        const isExpanded = expandedRows.has(row.id);
        return (
          <div key={row.id} className="border-b border-border">
            {/* Parent row */}
            <div className="flex items-start gap-2 px-3 py-2 hover:bg-surface-2/30 transition-colors group">
              <span className="text-[10px] text-muted-foreground font-mono w-6 flex-shrink-0 pt-1.5">{i + 1}</span>

              <div className="grid grid-cols-6 gap-2 flex-1 text-xs">
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Creative ID</label>
                  <input value={row.creativeId} onChange={e => set(i, 'creativeId', e.target.value)}
                    placeholder="FP-CAROUSEL" className="cell-input w-full font-mono text-[10px]" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Creative Concept</label>
                  <input value={row.concept} onChange={e => set(i, 'concept', e.target.value)}
                    placeholder="Fine Print" className="cell-input w-full" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Website URL</label>
                  <input value={row.websiteUrl} onChange={e => set(i, 'websiteUrl', e.target.value)}
                    placeholder="https://..." className="cell-input w-full font-mono text-[10px]" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Primary Text (125)</label>
                  <input value={row.primaryTexts?.[0] ?? ''} onChange={e => set(i, 'primaryTexts', [e.target.value, ...(row.primaryTexts?.slice(1) ?? [])])}
                    placeholder="And on the seventh day..." className="cell-input w-full" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">CTA</label>
                  <select value={row.cta} onChange={e => set(i, 'cta', e.target.value)}
                    className="cell-input w-full appearance-none cursor-pointer">
                    {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Link to UTM</label>
                  <input value={row.urlParams} onChange={e => set(i, 'urlParams', e.target.value)}
                    placeholder="utm_source=meta..." className="cell-input w-full font-mono text-[10px]" />
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                <button onClick={() => toggleExpand(row.id)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => duplicate(i)} title="Duplicate"
                  className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(i)} title="Delete"
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Cards sub-table */}
            {isExpanded && (
              <div className="px-10 pb-3 bg-surface-2/20">
                <CarouselCards
                  cards={row.carouselCards}
                  onUpdate={cards => set(i, 'carouselCards', cards)}
                  settings={settings}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreativesTable({ rows, carouselRows, onChange, onCarouselChange, settings }: Props) {
  const filledCount = rows.filter(r => r.concept.trim() || r.creativeId.trim()).length;
  const carouselCount = carouselRows.length;
  const [showAssetUpload, setShowAssetUpload] = useState(false);
  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Main toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
        <div>
          <h2 className="text-sm font-700 text-foreground">Creative Library</h2>
          <p className="text-[11px] text-muted-foreground">
            One row per creative. Paste directly from your client's doc. Multiple dimensions = placement-customized asset.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-700 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">PLACEMENT CUSTOM</span>
            Multiple dims — separate assets
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-700 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">POST ID OK</span>
            Single dim — dark post OK
          </span>
          <span className="font-mono">{filledCount} static/video · {carouselCount} carousel</span>
          {settings?.accessToken && settings?.adAccountId && (
            <button
              onClick={() => setShowAssetUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-700 text-[11px] transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Asset Upload
            </button>
          )}
        </div>
      </div>
      {showAssetUpload && settings && (
        <AssetUploadModal settings={settings} onClose={() => setShowAssetUpload(false)} />
      )}
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <StaticVideoTable rows={rows} onChange={onChange} settings={settings} />
        <CarouselTable rows={carouselRows} onChange={onCarouselChange} settings={settings} />
      </div>
    </div>
  );
}
