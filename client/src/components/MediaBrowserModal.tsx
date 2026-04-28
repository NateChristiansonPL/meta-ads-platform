/**
 * MediaBrowserModal
 * Browse images and videos from the Meta ad account and select them into a creative.
 * Tabs: Images | Videos
 * Per knowledge: only load from 'Accounts' source (adimages / advideos endpoints).
 */

import { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon, Film, Check, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BuildSettings } from '@/lib/campaignStore';
import { cn } from '@/lib/utils';

export interface MediaSelection {
  type: 'image' | 'video';
  hash?: string;       // for images
  videoId?: string;    // for videos
  url?: string;        // preview URL
  name?: string;
}

interface Props {
  settings: BuildSettings;
  onSelect: (media: MediaSelection) => void;
  onClose: () => void;
  /** If set, only show this tab */
  defaultTab?: 'images' | 'videos';
}

export default function MediaBrowserModal({ settings, onSelect, onClose, defaultTab = 'images' }: Props) {
  const [tab, setTab] = useState<'images' | 'videos'>(defaultTab);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaSelection | null>(null);

  const hasCredentials = !!(settings.accessToken && settings.adAccountId);

  // ── Images ──────────────────────────────────────────────────────────────────
  const { data: imagesData, isLoading: loadingImages, refetch: refetchImages } = trpc.meta.getAdImages.useQuery(
    { accessToken: settings.accessToken, adAccountId: settings.adAccountId },
    { enabled: hasCredentials && tab === 'images', staleTime: 2 * 60 * 1000 }
  );
  const images = imagesData?.images ?? [];

  // ── Videos ──────────────────────────────────────────────────────────────────
  const { data: videosData, isLoading: loadingVideos, refetch: refetchVideos } = trpc.meta.getAdVideos.useQuery(
    { accessToken: settings.accessToken, adAccountId: settings.adAccountId },
    { enabled: hasCredentials && tab === 'videos', staleTime: 2 * 60 * 1000 }
  );
  const videos = videosData?.videos ?? [];

  // Reset search when tab changes
  useEffect(() => { setSearch(''); setSelected(null); }, [tab]);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-700 text-foreground">Media Library</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Browse images and videos from your ad account</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5">
            {(['images', 'videos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-600 transition-all capitalize',
                  tab === t ? 'bg-surface-1 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {t === 'images' ? <ImageIcon size={12} /> : <Film size={12} />}
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab}…`}
              className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
            />
          </div>
          <button
            onClick={() => tab === 'images' ? refetchImages() : refetchVideos()}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasCredentials && (
            <div className="flex items-center justify-center h-40 text-[12px] text-amber-400">
              Add credentials in Settings to browse your media library.
            </div>
          )}

          {hasCredentials && tab === 'images' && (
            <>
              {loadingImages && (
                <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground">Loading images…</div>
              )}
              {!loadingImages && images.length === 0 && (
                <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground">No images found.</div>
              )}
              {!loadingImages && images.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((img: { hash: string; url?: string; name?: string; width?: number; height?: number }) => {
                    const isSelected = selected?.type === 'image' && selected.hash === img.hash;
                    return (
                      <button
                        key={img.hash}
                        onClick={() => setSelected({ type: 'image', hash: img.hash, url: img.url, name: img.name })}
                        className={cn(
                          'relative rounded-lg overflow-hidden border-2 transition-all aspect-square bg-surface-2',
                          isSelected ? 'border-primary shadow-lg shadow-primary/20' : 'border-transparent hover:border-border'
                        )}>
                        {img.url ? (
                          <img src={img.url} alt={img.name || img.hash} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={20} className="text-muted-foreground/30" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                        {img.name && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                            <p className="text-[9px] text-white truncate">{img.name}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {hasCredentials && tab === 'videos' && (
            <>
              {loadingVideos && (
                <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground">Loading videos…</div>
              )}
              {!loadingVideos && videos.length === 0 && (
                <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground">No videos found.</div>
              )}
              {!loadingVideos && videos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {videos.map((vid: { id: string; title?: string; thumbnailUrl?: string; lengthSeconds?: number }) => {
                    const isSelected = selected?.type === 'video' && selected.videoId === vid.id;
                    return (
                      <button
                        key={vid.id}
                        onClick={() => setSelected({ type: 'video', videoId: vid.id, url: vid.thumbnailUrl, name: vid.title })}
                        className={cn(
                          'relative rounded-lg overflow-hidden border-2 transition-all aspect-video bg-surface-2',
                          isSelected ? 'border-primary shadow-lg shadow-primary/20' : 'border-transparent hover:border-border'
                        )}>
                        {vid.thumbnailUrl ? (
                          <img src={vid.thumbnailUrl} alt={vid.title || vid.id} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={20} className="text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                            <Film size={14} className="text-white" />
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                        {vid.title && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                            <p className="text-[9px] text-white truncate">{vid.title}</p>
                            {vid.lengthSeconds && <p className="text-[9px] text-white/60">{vid.lengthSeconds}s</p>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0">
          <div className="text-[11px] text-muted-foreground">
            {selected ? (
              <span className="text-primary font-600">
                Selected: {selected.name || selected.hash || selected.videoId}
              </span>
            ) : (
              'Click an asset to select it'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 text-xs font-600 text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="px-4 py-1.5 text-xs font-700 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Use This Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
