import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Loader2, X, Layers, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { CampaignBuilderState, CreativeRow } from './campaignStoreAdmin';

interface Props {
  onClose: () => void;
  onImport: (payload: {
    creatives: CreativeRow[];
    carouselCreatives: CreativeRow[];
    mode: 'merge' | 'replace';
    sourceName: string;
  }) => void;
}

function nonEmptyCreative(row: CreativeRow): boolean {
  return Boolean(
    row.concept?.trim()
    || row.creativeId?.trim()
    || row.assetLength?.trim()
    || row.placementAssets?.length
    || row.carouselCards?.length
    || row.primaryTexts?.some(v => v.trim())
    || row.headlines?.some(v => v.trim())
  );
}

function safeCreativeRows(rows: unknown): CreativeRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is CreativeRow => Boolean(row && typeof row === 'object' && 'id' in row)).filter(nonEmptyCreative);
}

export default function CreativeLibrarySessionModal({ onClose, onImport }: Props) {
  const { isAuthenticated } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [preview, setPreview] = useState<{
    sourceName: string;
    creatives: CreativeRow[];
    carouselCreatives: CreativeRow[];
  } | null>(null);

  const { data: sessions = [], isLoading } = trpc.adminSessions.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const loadSession = trpc.adminSessions.load.useQuery(
    { id: selectedSessionId! },
    { enabled: selectedSessionId !== null, staleTime: 0 }
  );

  useEffect(() => {
    if (!loadSession.data || selectedSessionId === null) return;
    try {
      const parsed = JSON.parse(loadSession.data.stateJson) as Partial<CampaignBuilderState>;
      const creatives = safeCreativeRows(parsed.creatives);
      const carouselCreatives = safeCreativeRows(parsed.carouselCreatives);
      setPreview({ sourceName: loadSession.data.name, creatives, carouselCreatives });
    } catch (err) {
      toast.error(`Could not read Creative Library from that session: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSelectedSessionId(null);
    }
  }, [loadSession.data, selectedSessionId]);

  const totalPreviewRows = useMemo(
    () => (preview?.creatives.length ?? 0) + (preview?.carouselCreatives.length ?? 0),
    [preview]
  );

  const handleImport = () => {
    if (!preview || totalPreviewRows === 0) {
      toast.error('Select a saved session that contains Creative Library rows first.');
      return;
    }
    onImport({ ...preview, mode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[620px] max-h-[82vh] bg-surface-1 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-700 text-foreground flex items-center gap-2">
              <Layers size={15} className="text-primary" />
              Load Creative Library from Session
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Pull only creative rows from a saved full build without replacing the current campaigns, ad sets, imported Meta structure, or ads.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="p-6 text-sm text-muted-foreground">
            Log in to save and load builder sessions. Creative Library rows are stored inside saved sessions.
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="rounded-xl border border-border bg-surface-2/50 p-3">
              <p className="text-[11px] font-700 text-muted-foreground uppercase tracking-wider mb-2">Saved Sessions</p>
              {isLoading && (
                <div className="py-6 flex items-center justify-center text-[12px] text-muted-foreground">
                  <Loader2 size={14} className="animate-spin mr-2" /> Loading sessions…
                </div>
              )}
              {!isLoading && sessions.length === 0 && (
                <div className="py-6 text-center text-[12px] text-muted-foreground">
                  No saved sessions yet. Build or paste Creative Library rows, then save the build through Sessions.
                </div>
              )}
              {!isLoading && sessions.length > 0 && (
                <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
                  {sessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      disabled={selectedSessionId === session.id}
                      className="w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-lg hover:bg-surface-1 transition-colors disabled:opacity-60"
                    >
                      <FolderOpen size={14} className="text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-600 text-foreground truncate">{session.name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(session.updatedAt).toLocaleString()}</p>
                      </div>
                      {selectedSessionId === session.id && <Loader2 size={13} className="animate-spin text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-2/50 p-3">
              <p className="text-[11px] font-700 text-muted-foreground uppercase tracking-wider mb-2">Import Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('merge')}
                  className={`px-3 py-2 rounded-lg text-left border transition-all ${mode === 'merge' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-surface-1 text-foreground hover:border-border/80'}`}
                >
                  <p className="text-[12px] font-700">Merge into current</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Recommended. Adds missing creatives and skips likely duplicates.</p>
                </button>
                <button
                  onClick={() => setMode('replace')}
                  className={`px-3 py-2 rounded-lg text-left border transition-all ${mode === 'replace' ? 'border-amber-400/50 bg-amber-500/10 text-amber-300' : 'border-border bg-surface-1 text-foreground hover:border-border/80'}`}
                >
                  <p className="text-[12px] font-700">Replace library</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Use when starting fresh. Existing ads may need to be regenerated.</p>
                </button>
              </div>
            </div>

            {preview && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                <p className="text-[12px] font-700 text-primary">Ready to import from “{preview.sourceName}”</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {preview.creatives.length} standard creative row{preview.creatives.length !== 1 ? 's' : ''} and {preview.carouselCreatives.length} carousel creative row{preview.carouselCreatives.length !== 1 ? 's' : ''} found.
                </p>
                {totalPreviewRows === 0 && (
                  <p className="text-[11px] text-amber-300 mt-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> This session does not contain usable Creative Library rows.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-surface-0">
          <p className="text-[10px] text-muted-foreground">
            New creative entries are saved by saving the current build as a session.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-600 text-muted-foreground hover:text-foreground border border-border hover:bg-surface-2 transition-all">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!preview || totalPreviewRows === 0}
              className="px-4 py-1.5 rounded-lg text-xs font-700 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Import Creative Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
