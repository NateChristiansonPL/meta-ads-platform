import { useMemo, useState } from 'react';
import { Check, DownloadCloud, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  BuildSettings,
  ImportedMetaAdSet,
  ImportedMetaCampaign,
} from './campaignStoreAdmin';
import { cn } from '@/lib/utils';

interface Props {
  settings: BuildSettings;
  existingCampaigns?: ImportedMetaCampaign[];
  existingAdSets?: ImportedMetaAdSet[];
  onImport: (payload: {
    campaigns: ImportedMetaCampaign[];
    adSets: ImportedMetaAdSet[];
    populateRows: boolean;
  }) => void;
  onClose: () => void;
}

export default function ImportMetaStructureModal({
  settings,
  existingCampaigns = [],
  existingAdSets = [],
  onImport,
  onClose,
}: Props) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(existingCampaigns.map(c => c.id))
  );
  const [populateRows, setPopulateRows] = useState(true);
  const [importing, setImporting] = useState(false);

  const hasCredentials = !!(settings.accessToken && settings.adAccountId);

  const { data, isLoading, isFetching, refetch } = trpc.adminMeta.getCampaigns.useQuery(
    { accessToken: settings.accessToken, adAccountId: settings.adAccountId },
    { enabled: hasCredentials, staleTime: 2 * 60 * 1000 }
  );

  const campaigns = (data?.campaigns ?? []) as ImportedMetaCampaign[];
  const existingCampaignMap = useMemo(
    () => new Map(existingCampaigns.map(c => [c.id, c])),
    [existingCampaigns]
  );
  const existingAdSetMap = useMemo(
    () => new Map(existingAdSets.map(a => [a.id, a])),
    [existingAdSets]
  );

  const filteredCampaigns = campaigns.filter(c => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${c.name} ${c.id} ${c.objective} ${c.status}`.toLowerCase().includes(needle);
  });

  const selectedCampaigns = campaigns.filter(c => selectedIds.has(c.id));

  const toggleCampaign = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!hasCredentials) {
      toast.error('Add Meta credentials in Settings before importing existing structure.');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Select at least one campaign to import.');
      return;
    }

    setImporting(true);
    try {
      const selected = campaigns.filter(c => selectedIds.has(c.id));
      const importedAdSets: ImportedMetaAdSet[] = [];

      for (const campaign of selected) {
        const res = await utils.meta.getAdSets.fetch({
          accessToken: settings.accessToken,
          campaignId: campaign.id,
        });
        for (const adSet of res.adSets ?? []) {
          importedAdSets.push({
            id: adSet.id,
            name: adSet.name,
            status: adSet.status,
            campaignId: campaign.id,
            dailyBudget: adSet.dailyBudget,
            lifetimeBudget: adSet.lifetimeBudget,
          });
        }
      }

      const mergedCampaigns = new Map<string, ImportedMetaCampaign>();
      existingCampaignMap.forEach((campaign, id) => mergedCampaigns.set(id, campaign));
      selected.forEach(campaign => mergedCampaigns.set(campaign.id, campaign));

      const mergedAdSets = new Map<string, ImportedMetaAdSet>();
      existingAdSetMap.forEach((adSet, id) => mergedAdSets.set(id, adSet));
      importedAdSets.forEach(adSet => mergedAdSets.set(adSet.id, adSet));

      onImport({
        campaigns: Array.from(mergedCampaigns.values()),
        adSets: Array.from(mergedAdSets.values()),
        populateRows,
      });
      toast.success(`Imported ${selected.length} campaign${selected.length === 1 ? '' : 's'} and ${importedAdSets.length} ad set${importedAdSets.length === 1 ? '' : 's'}.`);
      onClose();
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[760px] max-h-[82vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-700 text-foreground">Import Existing Meta Structure</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select campaigns first; ad sets are fetched only for the selected campaigns.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border flex-shrink-0">
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search campaigns by name, ID, objective, or status…"
              className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-surface-2/50 border border-border rounded-lg outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
            />
          </div>
          <button
            onClick={() => refetch()}
            disabled={!hasCredentials || isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
            title="Refresh campaigns"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="flex items-center justify-between px-5 py-2 border-b border-border bg-surface-2/25 flex-shrink-0">
          <div className="text-[11px] text-muted-foreground">
            {hasCredentials
              ? `${selectedIds.size} selected · ${filteredCampaigns.length} visible · ${campaigns.length} loaded`
              : 'Add account settings before importing.'}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={populateRows}
              onChange={e => setPopulateRows(e.target.checked)}
              className="accent-primary"
            />
            Populate Campaign and Ad Set rows
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!hasCredentials && (
            <div className="flex items-center justify-center h-40 text-[12px] text-amber-400">
              Select a token and ad account in Settings before importing existing campaigns.
            </div>
          )}

          {hasCredentials && isLoading && (
            <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground">Loading campaigns…</div>
          )}

          {hasCredentials && !isLoading && filteredCampaigns.length === 0 && (
            <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground">No campaigns found.</div>
          )}

          {hasCredentials && !isLoading && filteredCampaigns.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredCampaigns.map(campaign => {
                const selected = selectedIds.has(campaign.id);
                return (
                  <button
                    key={campaign.id}
                    onClick={() => toggleCampaign(campaign.id)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left',
                      selected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-surface-2'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                      selected ? 'bg-primary border-primary text-white' : 'border-border text-transparent'
                    )}>
                      <Check size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-600 text-foreground truncate">{campaign.name || 'Untitled Campaign'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{campaign.id}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground flex-shrink-0">
                      <span className="px-2 py-0.5 rounded bg-surface-2 border border-border">{campaign.objective || 'UNKNOWN'}</span>
                      <span className="px-2 py-0.5 rounded bg-surface-2 border border-border">{campaign.status || 'UNKNOWN'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0">
          <p className="text-[11px] text-muted-foreground">
            Imported selections are saved with builder sessions and can be reused in Ads Only mode.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-600 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!hasCredentials || selectedCampaigns.length === 0 || importing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-700 bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <DownloadCloud size={13} />
              {importing ? 'Importing…' : `Import ${selectedCampaigns.length || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
