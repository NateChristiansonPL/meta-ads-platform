/**
 * MediaBrowserModal
 * Browse images and videos from the Meta ad account and select them into a creative.
 * Dark theme: pageBg #0d0c36, modalSurface #141349, cardSurface #1a1860, cyan #00BEEF
 */

import { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon, Film, Check, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BuildSettings } from './campaignStoreAdmin';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const T = {
  pageBg:       '#0d0c36',
  modalSurface: '#141349',
  cardSurface:  '#1a1860',
  activeState:  '#1f1d70',
  border:       'rgba(255,255,255,0.1)',
  cyan:         '#00BEEF',
  ink:          '#f0f0ff',
  muted:        '#a8a8c8',
  hint:         '#6b6b8f',
  white:        '#ffffff',
};

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

type ImageItem = { hash: string; url?: string; name?: string; width?: number; height?: number };
type VideoItem = { id: string; title?: string; thumbnailUrl?: string; lengthSeconds?: number };

export default function MediaBrowserModal({ settings, onSelect, onClose, defaultTab = 'images' }: Props) {
  const [tab, setTab] = useState<'images' | 'videos'>(defaultTab);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaSelection | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const hasCredentials = !!(settings.accessToken && settings.adAccountId);

  const { data: imagesData, isLoading: loadingImages, refetch: refetchImages } = trpc.adminMeta.getAdImages.useQuery(
    { accessToken: settings.accessToken, adAccountId: settings.adAccountId },
    { enabled: hasCredentials && tab === 'images', staleTime: 2 * 60 * 1000 }
  );
  const images: ImageItem[] = imagesData?.images ?? [];

  const { data: videosData, isLoading: loadingVideos, refetch: refetchVideos } = trpc.adminMeta.getAdVideos.useQuery(
    { accessToken: settings.accessToken, adAccountId: settings.adAccountId },
    { enabled: hasCredentials && tab === 'videos', staleTime: 2 * 60 * 1000 }
  );
  const videos: VideoItem[] = videosData?.videos ?? [];

  useEffect(() => { setSearch(''); setSelected(null); }, [tab]);

  const handleConfirm = () => {
    if (selected) { onSelect(selected); onClose(); }
  };

  const filteredImages = images.filter(img => !search || (img.name || img.hash).toLowerCase().includes(search.toLowerCase()));
  const filteredVideos = videos.filter(vid => !search || (vid.title || vid.id).toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,12,54,0.8)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: 760, maxHeight: '85vh', background: T.modalSurface, borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: `0 32px 80px rgba(0,190,239,0.1), 0 0 0 1px ${T.border}`, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `2px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={16} color={T.pageBg} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>Media Library</h2>
              <p style={{ fontSize: 11, color: T.muted, margin: 0, marginTop: 1 }}>Browse images and videos from your ad account</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 6, borderRadius: 8, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = T.cyan)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Tabs + Search + View toggle + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: T.pageBg, borderRadius: 10, padding: 3 }}>
            {(['images', 'videos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                background: tab === t ? T.activeState : 'transparent',
                color: tab === t ? T.cyan : T.muted,
                boxShadow: tab === t ? `0 0 0 1px ${T.cyan}` : 'none',
              }}>
                {t === 'images' ? <ImageIcon size={12} /> : <Film size={12} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.hint }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab}…`}
              style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, fontSize: 12, background: T.cardSurface, color: T.ink, border: `1.5px solid ${T.border}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.target.style.borderColor = T.cyan; e.target.style.boxShadow = `0 0 0 3px rgba(0,190,239,0.15)`; }}
              onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: T.pageBg, borderRadius: 8, padding: 3 }}>
            {(['grid', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} title={`${v} view`} style={{
                padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: viewMode === v ? T.activeState : 'transparent',
                color: viewMode === v ? T.cyan : T.hint,
              }}>
                {v === 'grid' ? <LayoutGrid size={13} /> : <List size={13} />}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button onClick={() => tab === 'images' ? refetchImages() : refetchVideos()} title="Refresh"
            style={{ padding: '6px 8px', background: 'transparent', border: `1.5px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.muted, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.cyan; (e.currentTarget as HTMLButtonElement).style.color = T.cyan; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.muted; }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Content grid/list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!hasCredentials && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 12, color: '#fbbf24' }}>
              Add credentials in Settings to browse your media library.
            </div>
          )}

          {/* ── Images ── */}
          {hasCredentials && tab === 'images' && (
            <>
              {loadingImages && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 12, color: T.muted }}>Loading images…</div>
              )}
              {!loadingImages && filteredImages.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 12, color: T.muted }}>
                  {images.length === 0 ? 'No images found in this ad account.' : 'No images match your search.'}
                </div>
              )}
              {!loadingImages && filteredImages.length > 0 && (
                viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {filteredImages.map(img => {
                      const isSelected = selected?.type === 'image' && selected.hash === img.hash;
                      return (
                        <button key={img.hash} onClick={() => setSelected({ type: 'image', hash: img.hash, url: img.url, name: img.name })}
                          style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `2px solid ${isSelected ? T.cyan : 'transparent'}`, cursor: 'pointer', aspectRatio: '1', background: T.cardSurface, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: isSelected ? `0 0 0 2px rgba(0,190,239,0.3)` : 'none', padding: 0 }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}>
                          {img.url ? (
                            <img src={img.url} alt={img.name || img.hash} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ImageIcon size={20} style={{ color: T.hint }} />
                            </div>
                          )}
                          {isSelected && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, background: T.cyan, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={11} color={T.pageBg} />
                            </div>
                          )}
                          {img.name && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(13,12,54,0.75)', padding: '3px 6px' }}>
                              <p style={{ fontSize: 9, color: T.white, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredImages.map(img => {
                      const isSelected = selected?.type === 'image' && selected.hash === img.hash;
                      return (
                        <button key={img.hash} onClick={() => setSelected({ type: 'image', hash: img.hash, url: img.url, name: img.name })}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${isSelected ? T.cyan : 'transparent'}`, background: isSelected ? T.activeState : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.background = T.cardSurface; } }}
                          onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: T.cardSurface, flexShrink: 0, overflow: 'hidden' }}>
                            {img.url ? <img src={img.url} alt={img.name || img.hash} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={16} style={{ color: T.hint, margin: '12px auto', display: 'block' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: T.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name || 'Untitled'}</p>
                            <p style={{ fontSize: 10, color: T.hint, margin: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.hash}</p>
                          </div>
                          {isSelected && <Check size={14} style={{ color: T.cyan, flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}

          {/* ── Videos ── */}
          {hasCredentials && tab === 'videos' && (
            <>
              {loadingVideos && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 12, color: T.muted }}>Loading videos…</div>
              )}
              {!loadingVideos && filteredVideos.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 12, color: T.muted }}>
                  {videos.length === 0 ? 'No videos found in this ad account.' : 'No videos match your search.'}
                </div>
              )}
              {!loadingVideos && filteredVideos.length > 0 && (
                viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {filteredVideos.map(vid => {
                      const isSelected = selected?.type === 'video' && selected.videoId === vid.id;
                      return (
                        <button key={vid.id} onClick={() => setSelected({ type: 'video', videoId: vid.id, url: vid.thumbnailUrl, name: vid.title })}
                          style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `2px solid ${isSelected ? T.cyan : 'transparent'}`, cursor: 'pointer', aspectRatio: '16/9', background: T.cardSurface, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: isSelected ? `0 0 0 2px rgba(0,190,239,0.3)` : 'none', padding: 0 }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}>
                          {vid.thumbnailUrl ? (
                            <img src={vid.thumbnailUrl} alt={vid.title || vid.id} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Film size={20} style={{ color: T.hint }} />
                            </div>
                          )}
                          {/* Play overlay */}
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(13,12,54,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Film size={14} style={{ color: T.white }} />
                            </div>
                          </div>
                          {isSelected && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, background: T.cyan, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={11} color={T.pageBg} />
                            </div>
                          )}
                          {(vid.title || vid.lengthSeconds) && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(13,12,54,0.75)', padding: '3px 6px' }}>
                              {vid.title && <p style={{ fontSize: 9, color: T.white, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vid.title}</p>}
                              {vid.lengthSeconds && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{vid.lengthSeconds}s</p>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredVideos.map(vid => {
                      const isSelected = selected?.type === 'video' && selected.videoId === vid.id;
                      return (
                        <button key={vid.id} onClick={() => setSelected({ type: 'video', videoId: vid.id, url: vid.thumbnailUrl, name: vid.title })}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${isSelected ? T.cyan : 'transparent'}`, background: isSelected ? T.activeState : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.background = T.cardSurface; } }}
                          onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}>
                          <div style={{ width: 48, height: 32, borderRadius: 8, background: T.cardSurface, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                            {vid.thumbnailUrl ? <img src={vid.thumbnailUrl} alt={vid.title || vid.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Film size={14} style={{ color: T.hint, position: 'absolute', inset: 0, margin: 'auto' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: T.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vid.title || 'Untitled'}</p>
                            <p style={{ fontSize: 10, color: T.hint, margin: 0, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vid.id}{vid.lengthSeconds ? ` · ${vid.lengthSeconds}s` : ''}</p>
                          </div>
                          {isSelected && <Check size={14} style={{ color: T.cyan, flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `2px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: T.muted }}>
            {selected ? (
              <span style={{ color: T.cyan, fontWeight: 600 }}>
                ✓ Selected: {selected.name || selected.hash || selected.videoId}
              </span>
            ) : (
              'Click an asset to select it'
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '7px 16px', background: 'transparent', color: T.muted, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.cyan; (e.currentTarget as HTMLButtonElement).style.color = T.cyan; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.muted; }}>
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={!selected}
              style={{ padding: '7px 20px', background: selected ? T.cyan : T.border, color: selected ? T.pageBg : T.hint, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: selected ? 'pointer' : 'not-allowed', transition: 'all 0.15s', opacity: selected ? 1 : 0.5 }}>
              Use This Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
