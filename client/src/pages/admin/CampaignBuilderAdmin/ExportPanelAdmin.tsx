/**
 * ExportPanel — Export & Launch tab
 * Design: Precision Tool Dark
 * Features:
 * - Pre-flight checklist with expandable details
 * - Video delay warning banner
 * - Find & Replace for bulk UTM/URL edits
 * - Pre-publish ad-level override table
 * - Manus command generator
 * - Launch button
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, AlertTriangle, Copy, Rocket,
  ChevronDown, ChevronRight, Film, Info, Replace, Search, Eye, Loader2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { CampaignBuilderState, AdRow } from './campaignStoreAdmin';
import { LaunchProgress } from './useLaunchBuildAdmin';
import { trpc } from '@/lib/trpc';

interface Props {
  state: CampaignBuilderState;
  onLaunch: () => void;
  launchProgress?: LaunchProgress;
}

interface ManusLaunchState {
  phase: 'idle' | 'launching' | 'running' | 'done' | 'error';
  runId?: number;
  statusMessages: string[];
  taskUrl?: string;
  errorMessage?: string;
  reportMarkdown?: string;
}

interface Check {
  id: string;
  label: string;
  pass: boolean;
  warn?: boolean;
  detail?: string;
}

// ── Find & Replace ─────────────────────────────────────────────────────────────
function FindReplace({ ads, onUpdate }: { ads: AdRow[]; onUpdate: (ads: AdRow[]) => void }) {
  const [findStr, setFindStr] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  const [field, setField] = useState<'overrideUtmParams' | 'overrideWebsiteUrl' | 'adName'>('overrideUtmParams');
  const [preview, setPreview] = useState<number | null>(null);

  const doPreview = () => {
    if (!findStr.trim()) { toast.error('Enter a search string.'); return; }
    const count = ads.filter(a => ((a[field] as string) || '').includes(findStr)).length;
    setPreview(count);
  };

  const doApply = () => {
    if (!findStr.trim() || preview === null) return;
    const updated = ads.map(a => {
      const val = (a[field] as string) || '';
      if (!val.includes(findStr)) return a;
      return { ...a, [field]: val.replaceAll(findStr, replaceStr) };
    });
    onUpdate(updated);
    toast.success(`Replaced in ${preview} ad${preview !== 1 ? 's' : ''}.`);
    setFindStr(''); setReplaceStr(''); setPreview(null);
  };

  return (
    <div className="p-4 bg-surface-1 rounded-xl border border-border space-y-3">
      <div className="flex items-center gap-2">
        <Replace className="w-4 h-4 text-primary" />
        <span className="text-[12px] font-700 text-foreground">Find &amp; Replace</span>
        <span className="text-[10px] text-muted-foreground">Bulk-edit ad fields before launch</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Field</label>
          <select
            value={field}
            onChange={e => { setField(e.target.value as typeof field); setPreview(null); }}
            className="cell-input w-full appearance-none text-xs"
          >
            <option value="overrideUtmParams">URL Parameters (UTM)</option>
            <option value="overrideWebsiteUrl">Website URL</option>
            <option value="adName">Ad Name</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1">
            <Search className="w-3 h-3" /> Find
          </label>
          <input
            value={findStr}
            onChange={e => { setFindStr(e.target.value); setPreview(null); }}
            placeholder="e.g. utm_campaign=old_name"
            className="cell-input w-full text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1">
            <Replace className="w-3 h-3" /> Replace with
          </label>
          <input
            value={replaceStr}
            onChange={e => setReplaceStr(e.target.value)}
            placeholder="e.g. utm_campaign=new_name"
            className="cell-input w-full text-xs font-mono"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={doPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-[11px] font-600 text-foreground border border-border transition-all"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        {preview !== null && (
          <>
            <span className={`text-[11px] font-600 ${preview > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {preview > 0 ? `${preview} match${preview !== 1 ? 'es' : ''} found` : 'No matches'}
            </span>
            {preview > 0 && (
              <button
                onClick={doApply}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-[11px] font-600 text-primary border border-primary/30 transition-all"
              >
                <Replace className="w-3.5 h-3.5" /> Apply to {preview} ad{preview !== 1 ? 's' : ''}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Ad override table ─────────────────────────────────────────────────────────
function AdOverrideTable({ ads, onUpdate }: { ads: AdRow[]; onUpdate: (ads: AdRow[]) => void }) {
  const [expanded, setExpanded] = useState(true);

  const setAdField = (id: string, field: keyof AdRow, val: string) => {
    onUpdate(ads.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-1 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="text-[12px] font-700 text-foreground">Pre-Publish Ad Review</span>
        <span className="text-[10px] text-muted-foreground">{ads.length} ad{ads.length !== 1 ? 's' : ''} — final chance to edit names, URLs, and UTMs</span>
        <div className="ml-auto">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          {ads.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] text-muted-foreground">
              No ads assembled yet — go to the Ads tab to generate ads from your creative × ad set matrix.
            </div>
          ) : (
            <table className="w-full border-collapse text-xs" style={{ minWidth: 1400 }}>
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  {[
                    ['#', 32], ['Status', 80], ['Needs Update', 90], ['Ad Name', 200], ['Ad Set', 150],
                    ['Campaign', 150], ['Type', 80], ['Length', 70], ['Launch Date', 100],
                    ['Source Post ID', 140], ['Website URL', 180], ['UTM Parameters', 220],
                    ['Ad ID', 130], ['Preview', 90],
                  ].map(([h, w], i) => (
                    <th key={h as string} className="px-2 py-2 text-left text-[10px] font-700 text-muted-foreground border-r border-border"
                      style={{ minWidth: w as number }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ads.map((ad, i) => (
                  <tr key={ad.id} className={`border-b border-border hover:bg-surface-2/30 transition-colors ${i % 2 === 0 ? '' : 'bg-surface-1/20'}`}>
                    <td className="px-2 py-0 text-center text-[10px] text-muted-foreground font-mono border-r border-border w-8">{i + 1}</td>
                    <td className="px-1 py-1 border-r border-border">
                      <span className={`text-[9px] font-700 px-1.5 py-0.5 rounded border ${
                        ad.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>{ad.status === 'ACTIVE' ? 'On' : 'Off'}</span>
                    </td>
                    <td className="px-1 py-1 border-r border-border">
                      <span className={`text-[9px] font-700 px-1.5 py-0.5 rounded border ${
                        ad.needsUpdate ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' : 'bg-surface-2 text-muted-foreground border-border'
                      }`}>{ad.needsUpdate ? 'Update' : '—'}</span>
                    </td>
                    <td className="p-0 border-r border-border">
                      <input value={ad.adName || ''} onChange={e => setAdField(ad.id, 'adName', e.target.value)}
                        className="cell-input w-full text-[11px]" style={{ minWidth: 200 }} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-border text-[11px] text-muted-foreground whitespace-nowrap">{ad.adSetName || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-border text-[11px] text-muted-foreground whitespace-nowrap">{ad.campaignName || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-border">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-600 ${
                        ad.creativeType === 'video' ? 'bg-violet-500/20 text-violet-400' :
                        ad.creativeType === 'carousel' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-surface-2 text-muted-foreground'
                      }`}>{ad.creativeType?.toUpperCase() || '—'}</span>
                    </td>
                    <td className="px-2 py-1.5 border-r border-border text-[11px] font-mono text-muted-foreground">{ad.creativeLength || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-border text-[11px] font-mono text-muted-foreground">{ad.launchDate || '—'}</td>
                    <td className="p-0 border-r border-border">
                      <input value={ad.sourcePostId || ''} onChange={e => setAdField(ad.id, 'sourcePostId', e.target.value)}
                        placeholder="Post ID" className="cell-input w-full text-[10px] font-mono" style={{ minWidth: 140 }} />
                    </td>
                    <td className="p-0 border-r border-border">
                      <input value={ad.overrideWebsiteUrl || ''} onChange={e => setAdField(ad.id, 'overrideWebsiteUrl', e.target.value)}
                        placeholder="https://..." className="cell-input w-full text-[11px] font-mono" style={{ minWidth: 180 }} />
                    </td>
                    <td className="p-0 border-r border-border">
                      <input value={ad.overrideUtmParams || ''} onChange={e => setAdField(ad.id, 'overrideUtmParams', e.target.value)}
                        placeholder="utm_source=meta&utm_medium=paid_social" className="cell-input w-full text-[10px] font-mono" style={{ minWidth: 220 }} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-border text-[10px] font-mono text-muted-foreground">{ad.adId || <span className="italic opacity-40">auto</span>}</td>
                    <td className="px-2 py-1.5">
                      {ad.previewLink ? (
                        <a href={ad.previewLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Preview</a>
                      ) : <span className="text-[10px] text-muted-foreground italic opacity-40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ExportPanel({ state, onLaunch, launchProgress }: Props) {
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [localAds, setLocalAds] = useState<AdRow[]>(state.ads);
  const [agentProfile, setAgentProfile] = useState<'manus-1.6-lite' | 'manus-1.6'>('manus-1.6-lite');
  const [manusLaunch, setManusLaunch] = useState<ManusLaunchState>({
    phase: 'idle',
    statusMessages: [],
  });

  const launchCampaignBuild = trpc.runs.launchCampaignBuild.useMutation();
  const getRunStatus = trpc.runs.getRunStatus.useQuery(
    { runId: manusLaunch.runId! },
    {
      enabled: manusLaunch.runId !== undefined && (manusLaunch.phase === 'running' || manusLaunch.phase === 'launching'),
      refetchInterval: 4000,
    }
  );

  useEffect(() => {
    const run = getRunStatus.data;
    if (!run) return;
    const statusLog: Array<{ ts: number; msg: string }> = (run as { statusLog?: Array<{ ts: number; msg: string }> }).statusLog ?? [];
    const msgs = statusLog.map((s) => s.msg);
    if (run.status === 'success') {
      setManusLaunch(prev => ({
        ...prev,
        phase: 'done',
        statusMessages: msgs,
        taskUrl: (run as { taskUrl?: string }).taskUrl ?? undefined,
        reportMarkdown: run.reportMarkdown ?? undefined,
      }));
    } else if (run.status === 'error') {
      setManusLaunch(prev => ({
        ...prev,
        phase: 'error',
        statusMessages: msgs,
        errorMessage: run.errorMessage ?? 'Unknown error',
        taskUrl: (run as { taskUrl?: string }).taskUrl ?? undefined,
      }));
    } else {
      setManusLaunch(prev => ({ ...prev, phase: 'running', statusMessages: msgs }));
    }
  }, [getRunStatus.data]);

  const handleManusLaunch = async () => {
    const { settings, buildMode } = state;
    if (!settings.adAccountId.trim()) { toast.error('Ad Account ID is required.'); return; }
    if (!settings.facebookPageId?.trim()) { toast.error('Facebook Page ID is required in Settings.'); return; }
    setManusLaunch({ phase: 'launching', statusMessages: ['Submitting build to Manus...'] });
    try {
      const result = await launchCampaignBuild.mutateAsync({
        adAccountId: settings.adAccountId,
        adAccountName: settings.adAccountName,
        facebookPageId: settings.facebookPageId,
        instagramUserId: settings.instagramUserId,
        pixelId: settings.pixelId,
        buildMode,
        stateJson: JSON.stringify(state),
        agentProfile,
      });
      setManusLaunch(prev => ({ ...prev, phase: 'running', runId: result.runId, statusMessages: ['Build submitted. Manus agent is running...'] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setManusLaunch({ phase: 'error', statusMessages: [], errorMessage: msg });
      toast.error(`Launch failed: ${msg}`);
    }
  };

  const { campaigns, adSets, creatives, ads, settings, buildMode } = state;

  const filledCampaigns = campaigns.filter(c => c.name.trim());
  const filledAdSets = adSets.filter(a => a.name.trim());
  const filledCreatives = creatives.filter(c => c.concept.trim() || c.creativeId.trim());
  // Only warn if actual video files have been uploaded (not just rows with video type selected)
  const hasVideos = creatives.some(c =>
    c.adType === 'video' &&
    c.placementAssets?.some(pa => pa.localFile instanceof File)
  );

  const checks: Check[] = useMemo(() => [
    {
      id: 'campaigns',
      label: `${filledCampaigns.length} campaign${filledCampaigns.length !== 1 ? 's' : ''} defined`,
      pass: buildMode === 'ads-only' || filledCampaigns.length > 0,
      detail: filledCampaigns.length === 0 ? 'Add at least one campaign in the Campaigns tab.' : filledCampaigns.map(c => `• ${c.name} (${c.objective})`).join('\n'),
    },
    {
      id: 'adsets',
      label: `${filledAdSets.length} ad set${filledAdSets.length !== 1 ? 's' : ''} defined`,
      pass: buildMode === 'ads-only' || filledAdSets.length > 0,
      detail: filledAdSets.length === 0 ? 'Add at least one ad set.' : filledAdSets.map(a => `• ${a.name} — $${a.budget || '?'} ${a.budgetType}`).join('\n'),
    },
    {
      id: 'creatives',
      label: `${filledCreatives.length} creative${filledCreatives.length !== 1 ? 's' : ''} in library`,
      pass: filledCreatives.length > 0,
      detail: filledCreatives.map(c => `• ${c.concept || c.creativeId} (${c.adType})`).join('\n') || 'No creatives — add in Creative Library tab.',
    },
    {
      id: 'ads',
      label: `${ads.length} ad${ads.length !== 1 ? 's' : ''} assembled`,
      pass: ads.length > 0,
      detail: ads.length === 0 ? 'Go to the Ads tab, check your matrix, and click Generate Ads.' : `${ads.length} ad${ads.length !== 1 ? 's' : ''} ready to traffic.`,
    },
    {
      id: 'linkage',
      label: 'All ad sets linked to a campaign',
      pass: filledAdSets.every(a => a.campaignName.trim()),
      warn: filledAdSets.some(a => !a.campaignName.trim()),
      detail: filledAdSets.filter(a => !a.campaignName.trim()).map(a => `• "${a.name}" has no campaign`).join('\n') || 'All ad sets have campaigns.',
    },
    {
      id: 'assets',
      label: 'All creatives have assets or post IDs',
      pass: filledCreatives.every(c =>
        (c.placementAssets && c.placementAssets.some(a => a.assetUrl.trim())) ||
        c.postId?.trim() ||
        (c.carouselCards && c.carouselCards.length > 0)
      ),
      warn: filledCreatives.some(c =>
        !(c.placementAssets && c.placementAssets.some(a => a.assetUrl.trim())) &&
        !c.postId?.trim() &&
        !(c.carouselCards && c.carouselCards.length > 0)
      ),
      detail: filledCreatives.filter(c =>
        !(c.placementAssets && c.placementAssets.some(a => a.assetUrl.trim())) &&
        !c.postId?.trim() &&
        !(c.carouselCards && c.carouselCards.length > 0)
      ).map(c => `• "${c.concept || c.creativeId}" missing asset`).join('\n') || 'All creatives have assets.',
    },
    {
      id: 'adAccountId',
      label: 'Ad Account ID configured',
      pass: !!settings.adAccountId.trim(),
      detail: settings.adAccountId ? `act_${settings.adAccountId}` : 'Set in Settings (gear icon, bottom-left).',
    },
    {
      id: 'accessToken',
      label: 'Access Token configured',
      pass: !!settings.accessToken.trim(),
      detail: settings.accessToken ? '••••••••' : 'Set in Settings (gear icon, bottom-left).',
    },
  ], [filledCampaigns, filledAdSets, filledCreatives, ads, settings, buildMode]);

  const allPass = checks.every(c => c.pass);
  const passCount = checks.filter(c => c.pass).length;
  const failCount = checks.filter(c => !c.pass && !c.warn).length;
  const warnCount = checks.filter(c => c.warn && !c.pass).length;



  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-base font-700 text-foreground">Export &amp; Launch</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Review your build, make final edits, then launch via Manus to push to Meta.
          </p>
        </div>

        {/* Video delay warning */}
        {hasVideos && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Film className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-700 text-amber-300">Video Processing Delay</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                This build includes video creatives. Videos must finish processing on Meta before their ads can be created.
                A notification will appear in this tool once each video is ready and its ads have been created.
              </p>
            </div>
          </div>
        )}

        {/* Build summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Campaigns', val: filledCampaigns.length, color: 'text-blue-400' },
            { label: 'Ad Sets',   val: filledAdSets.length,    color: 'text-violet-400' },
            { label: 'Creatives', val: filledCreatives.length, color: 'text-indigo-400' },
            { label: 'Ads',       val: ads.length,             color: 'text-emerald-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-surface-1 rounded-xl border border-border p-4 text-center">
              <div className={`text-2xl font-700 font-mono ${color}`}>{val}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Pre-flight checks */}
        <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[12px] font-700 text-foreground">Pre-Flight Checks</h3>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-emerald-400 font-700">{passCount} pass</span>
              {warnCount > 0 && <span className="text-amber-400 font-700">{warnCount} warn</span>}
              {failCount > 0 && <span className="text-red-400 font-700">{failCount} fail</span>}
            </div>
          </div>
          <div className="divide-y divide-border">
            {checks.map(check => (
              <div key={check.id}>
                <button
                  onClick={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                >
                  {check.pass
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : check.warn
                    ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  }
                  <span className={`text-[12px] font-600 flex-1 ${check.pass ? 'text-foreground' : check.warn ? 'text-amber-300' : 'text-red-300'}`}>
                    {check.label}
                  </span>
                  {check.detail && (
                    expandedCheck === check.id
                      ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {expandedCheck === check.id && check.detail && (
                  <div className="px-11 pb-3 text-[11px] text-muted-foreground font-mono whitespace-pre-line">
                    {check.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Ad override table */}
        <AdOverrideTable ads={localAds} onUpdate={setLocalAds} />

        {/* Model selector */}
        <div className="bg-surface-1 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-700 text-foreground">Manus Model</span>
            <span className="text-[10px] text-muted-foreground">Select the agent model for this build</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['manus-1.6-lite', 'manus-1.6'] as const).map(profile => (
              <button
                key={profile}
                onClick={() => setAgentProfile(profile)}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                  agentProfile === profile
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-surface-2/30 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <span className="text-[12px] font-700">{profile === 'manus-1.6-lite' ? 'Manus 1.6 Lite' : 'Manus 1.6'}</span>
                <span className="text-[10px] mt-0.5">{profile === 'manus-1.6-lite' ? 'Faster · fewer credits' : 'Deeper reasoning · more credits'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Launch via Manus Panel */}
        <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-[12px] font-700 text-foreground flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5 text-primary" /> Launch via Manus
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Runs the pl-campaign-creation skill to push your build to Meta. Progress is tracked in real time.</p>
            </div>
            {manusLaunch.phase !== 'idle' && (
              <button
                onClick={() => setManusLaunch({ phase: 'idle', statusMessages: [] })}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {manusLaunch.phase === 'idle' && (
              <p className="text-[11px] text-muted-foreground">
                Click <strong>Launch Build</strong> below to submit this build to a Manus agent running the pl-campaign-creation skill.
                The agent will create your campaigns, ad sets, and ads in Meta Ads Manager.
              </p>
            )}
            {(manusLaunch.phase === 'launching' || manusLaunch.phase === 'running') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Manus agent is running...</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-surface-0 rounded-lg p-3">
                  {manusLaunch.statusMessages.map((msg, i) => (
                    <p key={i} className="text-[10px] font-mono text-foreground/70 leading-relaxed">{msg}</p>
                  ))}
                </div>
                {manusLaunch.taskUrl && (
                  <a href={manusLaunch.taskUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" /> View task in Manus
                  </a>
                )}
              </div>
            )}
            {manusLaunch.phase === 'done' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Build complete!</span>
                </div>
                {manusLaunch.taskUrl && (
                  <a href={manusLaunch.taskUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" /> View full report in Manus
                  </a>
                )}
                {manusLaunch.reportMarkdown && (
                  <div className="max-h-48 overflow-y-auto bg-surface-0 rounded-lg p-3">
                    <pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap leading-relaxed">{manusLaunch.reportMarkdown.slice(0, 2000)}{manusLaunch.reportMarkdown.length > 2000 ? '\n...(see full report in Manus)' : ''}</pre>
                  </div>
                )}
              </div>
            )}
            {manusLaunch.phase === 'error' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Launch failed</span>
                </div>
                <p className="text-[11px] text-red-300/80 font-mono bg-surface-0 rounded-lg p-3">{manusLaunch.errorMessage}</p>
                {manusLaunch.taskUrl && (
                  <a href={manusLaunch.taskUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" /> View task in Manus
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Launch */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <div className="text-[11px]">
            {!allPass ? (
              <span className="flex items-center gap-1.5 text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                Fix {failCount} failing check{failCount !== 1 ? 's' : ''} before launching
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All checks passed — ready to launch
              </span>
            )}
          </div>
          {/* Launch Build is disabled — direct campaign creation via Manus agent is not yet available */}
          <div className="flex flex-col items-end gap-1">
            <button
              disabled
              title="Launch Build is coming soon"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-700 bg-surface-2 text-muted-foreground cursor-not-allowed border border-border opacity-50"
            >
              <Rocket className="w-4 h-4" /> Launch Build
            </button>
            <span className="text-[11px] text-muted-foreground">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateManusCommand(state: CampaignBuilderState): string {
  const { campaigns, adSets, creatives, ads, settings, buildMode } = state;

  const lines = [
    `# Meta Campaign Builder — ${buildMode === 'full' ? 'Full Build' : buildMode === 'ads-only' ? 'Ads Only' : 'Update Ads'}`,
    `# Generated: ${new Date().toLocaleString()}`,
    ``,
    `Use the /pl-campaign-creation skill with the following configuration:`,
    ``,
    `Ad Account ID: ${settings.adAccountId || '<YOUR_AD_ACCOUNT_ID>'}`,
    `Facebook Page ID: ${settings.facebookPageId || '<YOUR_PAGE_ID>'}`,
    `Instagram User ID: ${settings.instagramUserId || '<YOUR_IG_USER_ID>'}`,
    `Pixel ID: ${settings.pixelId || '<YOUR_PIXEL_ID>'}`,
    `Build Mode: ${buildMode}`,
    ``,
  ];

  if (buildMode !== 'ads-only') {
    lines.push(`## Campaigns (${campaigns.filter(c => c.name).length})`);
    campaigns.filter(c => c.name).forEach(c => {
      lines.push(`- ${c.name} | Objective: ${c.objective} | Status: ${c.status}${c.cbo ? ' | CBO: YES' : ''}`);
    });
    lines.push(``);

    lines.push(`## Ad Sets (${adSets.filter(a => a.name).length})`);
    adSets.filter(a => a.name).forEach(a => {
      lines.push(`- ${a.name} | Campaign: ${a.campaignName} | Budget: $${a.budget} ${a.budgetType} | Opt: ${a.optimizationGoal}`);
    });
    lines.push(``);
  }

  lines.push(`## Creatives (${creatives.filter(c => c.concept).length})`);
  creatives.filter(c => c.concept).forEach(c => {
    lines.push(`- ${c.concept} | Type: ${c.adType} | Dims: ${c.placementDimensions.join(', ') || 'none'} | CTA: ${c.cta}`);
  });
  lines.push(``);

  lines.push(`## Ads to Traffic (${ads.length})`);
    ads.forEach(a => {
    lines.push(`- ${a.adName} | Ad Set: ${a.adSetName} | Status: ${a.status}${a.needsUpdate ? ' | NEEDS UPDATE' : ''}`);
  });

  return lines.join('\n');
}
