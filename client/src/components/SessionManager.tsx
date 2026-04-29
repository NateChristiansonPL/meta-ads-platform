/**
 * SessionManager
 * A dropdown panel for saving, loading, and deleting named builder sessions.
 * Requires the user to be logged in (sessions are user-scoped).
 */

import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Plus, Check, Loader2, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampaignBuilderState } from '@/lib/campaignStore';

interface Props {
  state: CampaignBuilderState;
  onLoad: (state: CampaignBuilderState) => void;
}

export default function SessionManager({ state, onLoad }: Props) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [overwriteId, setOverwriteId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: sessions = [], isLoading: loadingSessions } = trpc.sessions.list.useQuery(
    undefined,
    { enabled: isAuthenticated && open }
  );

  const saveMutation = trpc.sessions.save.useMutation({
    onSuccess: (data) => {
      toast.success(`Session "${saveName}" saved.`);
      setSaveName('');
      setOverwriteId(null);
      utils.sessions.list.invalidate();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      toast.success('Session deleted.');
      utils.sessions.list.invalidate();
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const loadSession = trpc.sessions.load.useQuery(
    { id: loadingId! },
    {
      enabled: loadingId !== null,
      staleTime: 0,
    }
  );

  // Apply loaded state in useEffect to avoid render-phase side effects
  useEffect(() => {
    if (!loadSession.data || loadingId === null) return;
    try {
      const parsed = JSON.parse(loadSession.data.stateJson) as CampaignBuilderState;
      onLoad(parsed);
      toast.success(`Session "${loadSession.data.name}" loaded.`);
    } catch {
      toast.error('Failed to parse session state.');
    }
    setLoadingId(null);
    setOpen(false);
  }, [loadSession.data]);

  const handleSave = () => {
    if (!saveName.trim()) { toast.error('Enter a session name.'); return; }
    saveMutation.mutate({
      name: saveName.trim(),
      stateJson: JSON.stringify(state),
      existingId: overwriteId ?? undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <button
        disabled
        title="Log in to save sessions"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-600 text-muted-foreground/40 border border-border/40 cursor-not-allowed">
        <Save size={13} /> Sessions
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-600 border transition-all',
          open
            ? 'bg-primary/20 text-primary border-primary/40'
            : 'text-foreground border-border bg-surface-2 hover:bg-surface-1 hover:border-border/80'
        )}>
        <FolderOpen size={13} />
        Sessions
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-surface-1 border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Save new */}
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider mb-2">Save Current Build</p>
            <div className="flex gap-2">
              <input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Session name…"
                className="flex-1 px-2.5 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
              />
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending || !saveName.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-700 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>
          </div>

          {/* Saved sessions list */}
          <div className="max-h-64 overflow-y-auto">
            {loadingSessions && (
              <div className="flex items-center justify-center py-6 text-[12px] text-muted-foreground">
                <Loader2 size={14} className="animate-spin mr-2" /> Loading…
              </div>
            )}
            {!loadingSessions && sessions.length === 0 && (
              <div className="py-6 text-center text-[12px] text-muted-foreground">
                No saved sessions yet.
              </div>
            )}
            {!loadingSessions && sessions.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2/50 transition-colors group border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-600 text-foreground truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(s.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setLoadingId(s.id)}
                    title="Load session"
                    className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                    <FolderOpen size={13} />
                  </button>
                  <button
                    onClick={() => {
                      setSaveName(s.name);
                      setOverwriteId(s.id);
                    }}
                    title="Overwrite with current build"
                    className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors">
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate({ id: s.id });
                    }}
                    title="Delete session"
                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {overwriteId !== null && (
            <div className="px-3 py-2 border-t border-border bg-amber-500/10 text-[11px] text-amber-300 flex items-center gap-2">
              <Plus size={12} className="rotate-45" />
              Overwrite mode — saving will replace session #{overwriteId}
              <button onClick={() => { setOverwriteId(null); setSaveName(''); }} className="ml-auto text-amber-300/60 hover:text-amber-300">Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
