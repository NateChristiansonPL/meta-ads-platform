/**
 * useLaunchBuild — orchestrates the full Meta Ads campaign creation flow.
 *
 * Build modes:
 *   full:     create campaigns → ad sets → ads
 *   ads-only: skip campaigns/ad sets, use existing ad set IDs from AdRow
 *   update:   call updateAdCreative for each ad with needsUpdate=true
 *
 * After each ad is created or updated, persists adId, campaignId, adSetId, and
 * previewLink into the in-app builder state via the onWriteBack callback.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  CampaignBuilderState,
  AdRow,
  CampaignRow,
  AdSetRow,
  CreativeRow,
} from './campaignStoreAdmin';
import {
  buildAdCreativeApiInput,
  buildAdSetApiExtras,
  buildBuilderTargetingSpec,
} from './builderMetaMappingAdmin';

export interface LaunchProgress {
  phase: 'idle' | 'campaigns' | 'adsets' | 'ads' | 'done' | 'error';
  total: number;
  completed: number;
  currentItem: string;
  errors: string[];
}

export interface LaunchWriteBackPayload {
  ads: AdRow[];
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
}

export function useLaunchBuild(
  state: CampaignBuilderState,
  onWriteBack: (payload: LaunchWriteBackPayload) => void
) {
  const [progress, setProgress] = useState<LaunchProgress>({
    phase: 'idle',
    total: 0,
    completed: 0,
    currentItem: '',
    errors: [],
  });

  const createCampaign = trpc.adminMeta.createCampaign.useMutation();
  const createAdSet = trpc.adminMeta.createAdSet.useMutation();
  const createAd = trpc.adminMeta.createAd.useMutation();
  const updateAdCreative = trpc.adminMeta.updateAdCreative.useMutation();

  const launch = useCallback(async () => {
    const { settings, campaigns, adSets, creatives, ads, buildMode } = state;
    const { accessToken, adAccountId, facebookPageId, instagramUserId, pixelId } = settings;

    const errors: string[] = [];
    const updatedAds = [...ads];
    const updatedCampaigns = [...campaigns];
    const updatedAdSets = [...adSets];

    // ── Helper: find creative for an ad row ────────────────────────────────
    const findCreative = (ad: AdRow): CreativeRow | undefined =>
      creatives.find(c => c.id === ad.creativeId || c.creativeId === ad.creativeId || c.concept === ad.creativeConcept);

    const isMetaObjectId = (value?: string): boolean => /^\d{8,}$/.test((value || '').trim());

    const resolveBuilderAdSet = (ad: AdRow): AdSetRow | undefined =>
      adSets.find(a => a.id === ad.adSetId || a.adSetId === ad.adSetId || a.name === ad.adSetName);

    const resolveExistingAdSetId = (ad: AdRow): string => {
      if (isMetaObjectId(ad.adSetId)) return ad.adSetId.trim();
      const matchedAdSet = resolveBuilderAdSet(ad);
      return isMetaObjectId(matchedAdSet?.adSetId) ? matchedAdSet!.adSetId.trim() : '';
    };

    const resolveCampaignIdForAd = (ad: AdRow, fallbackMap?: Record<string, string>): string => {
      if (isMetaObjectId(ad.campaignId)) return ad.campaignId.trim();
      if (fallbackMap?.[ad.campaignName]) return fallbackMap[ad.campaignName];
      const matchedAdSet = resolveBuilderAdSet(ad);
      if (isMetaObjectId(matchedAdSet?.campaignId)) return matchedAdSet!.campaignId!.trim();
      const matchedCampaign = campaigns.find(c => c.name === ad.campaignName || c.id === ad.campaignId || c.campaignId === ad.campaignId);
      return isMetaObjectId(matchedCampaign?.campaignId) ? matchedCampaign!.campaignId.trim() : '';
    };

    // ── Helper: build createAd input from ad row + creative ────────────────
    const buildAdInput = (
      ad: AdRow,
      creative: CreativeRow,
      resolvedAdSetId: string,
      resolvedCampaignId: string
    ) => buildAdCreativeApiInput(ad, creative, resolvedAdSetId, resolvedCampaignId, {
      accessToken,
      adAccountId,
      facebookPageId,
      instagramUserId,
      pixelId,
    });

    // ── Phase: Full Build ──────────────────────────────────────────────────
    if (buildMode === 'full') {
      const filledCampaigns = campaigns.filter(c => c.name.trim());
      const filledAdSets = adSets.filter(a => a.name.trim());
      const filledAds = ads.filter(a => a.adName.trim());

      const totalSteps = filledCampaigns.length + filledAdSets.length + filledAds.length;
      setProgress({ phase: 'campaigns', total: totalSteps, completed: 0, currentItem: '', errors: [] });

      // Map: campaignName → campaignId
      const campaignIdMap: Record<string, string> = {};

      // 1. Create campaigns
      for (let campaignIndex = 0; campaignIndex < filledCampaigns.length; campaignIndex++) {
        const campaign = filledCampaigns[campaignIndex];
        const stateCampaignIndex = campaigns.findIndex(c => c === campaign);
        setProgress(p => ({ ...p, currentItem: `Creating campaign: ${campaign.name}` }));
        try {
          // If campaign already has an ID (from a previous run), skip creation
          if (campaign.campaignId) {
            campaignIdMap[campaign.name] = campaign.campaignId;
          } else {
            const result = await createCampaign.mutateAsync({
              accessToken,
              adAccountId,
              name: campaign.name,
              objective: campaign.objective,
              status: campaign.status,
              spendCapCents: campaign.spendCap ? Math.round(parseFloat(campaign.spendCap) * 100) : undefined,
              // Issue 2: always pass cbo so server can set is_adset_budget_sharing_enabled correctly
              cbo: campaign.cbo === true,
              // specialAdCategory: NONE → [] (empty array), any other value → [value]
              specialAdCategories: campaign.specialAdCategory && campaign.specialAdCategory !== 'NONE'
                ? [campaign.specialAdCategory]
                : [],
            });
            campaignIdMap[campaign.name] = result.campaignId;
            if (stateCampaignIndex >= 0) updatedCampaigns[stateCampaignIndex] = { ...updatedCampaigns[stateCampaignIndex], campaignId: result.campaignId };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // If it's a duplicate conflict, try to get the existing ID from the error message
          if (msg.includes('already exists') && msg.includes('ID:')) {
            const match = msg.match(/ID: (\d+)/);
            if (match) {
              campaignIdMap[campaign.name] = match[1];
              if (stateCampaignIndex >= 0) updatedCampaigns[stateCampaignIndex] = { ...updatedCampaigns[stateCampaignIndex], campaignId: match[1] };
            }
            toast.warning(`Campaign "${campaign.name}" already exists — using existing.`);
          } else {
            errors.push(`Campaign "${campaign.name}": ${msg}`);
            toast.error(`Campaign "${campaign.name}" failed: ${msg}`);
          }
        }
        setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
      }

      // Map: adSetName → adSetId
      const adSetIdMap: Record<string, string> = {};

      // 2. Create ad sets
      setProgress(p => ({ ...p, phase: 'adsets' }));
      for (let adSetIndex = 0; adSetIndex < filledAdSets.length; adSetIndex++) {
        const adSet = filledAdSets[adSetIndex];
        const stateAdSetIndex = adSets.findIndex(a => a === adSet);
        setProgress(p => ({ ...p, currentItem: `Creating ad set: ${adSet.name}` }));
        const campaignId = campaignIdMap[adSet.campaignName];
        if (!campaignId) {
          errors.push(`Ad set "${adSet.name}": Campaign "${adSet.campaignName}" was not created.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        try {
          if (adSet.adSetId) {
            adSetIdMap[adSet.name] = adSet.adSetId;
          } else {
            const budgetCents = Math.round(parseFloat(adSet.budget || '0') * 100);
            const targeting = buildBuilderTargetingSpec(adSet);
            // Resolve the parent campaign's objective so the server can gate
            // promoted_object and attribution_spec correctly per Issues 4, 5, 6.
            const parentCampaign = campaigns.find(c => c.name === adSet.campaignName);
            const result = await createAdSet.mutateAsync({
              accessToken,
              adAccountId,
              campaignId,
              name: adSet.name,
              status: adSet.status,
              optimizationGoal: adSet.optimizationGoal,
              billingEvent: adSet.billingChoice || adSet.billingEvent,
              budgetType: adSet.budgetType === 'DAILY' ? 'daily' : 'lifetime',
              budgetCents,
              startTime: adSet.startDate ? `${adSet.startDate}T${adSet.startTime || '00:00:00'}` : undefined,
              endTime: adSet.endDate ? `${adSet.endDate}T${adSet.endTime || '23:59:59'}` : undefined,
              targeting,
              pixelId: pixelId || undefined,
              customEventType: adSet.conversionEvent || undefined,
              conversionLocation: adSet.conversionLocation || undefined,
              objective: parentCampaign?.objective || undefined,
              ...buildAdSetApiExtras(adSet),
            });
            adSetIdMap[adSet.name] = result.adSetId;
            if (stateAdSetIndex >= 0) updatedAdSets[stateAdSetIndex] = { ...updatedAdSets[stateAdSetIndex], adSetId: result.adSetId, campaignId };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('already exists') && msg.includes('ID:')) {
            const match = msg.match(/ID: (\d+)/);
            if (match) {
              adSetIdMap[adSet.name] = match[1];
              if (stateAdSetIndex >= 0) updatedAdSets[stateAdSetIndex] = { ...updatedAdSets[stateAdSetIndex], adSetId: match[1], campaignId };
            }
            toast.warning(`Ad set "${adSet.name}" already exists — using existing.`);
          } else {
            errors.push(`Ad set "${adSet.name}": ${msg}`);
            toast.error(`Ad set "${adSet.name}" failed: ${msg}`);
          }
        }
        setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
      }

      // 3. Create ads
      setProgress(p => ({ ...p, phase: 'ads' }));
      for (let i = 0; i < updatedAds.length; i++) {
        const ad = updatedAds[i];
        if (!ad.adName.trim()) continue;

        setProgress(p => ({ ...p, currentItem: `Creating ad: ${ad.adName}` }));

        const creative = findCreative(ad);
        if (!creative) {
          errors.push(`Ad "${ad.adName}": Creative not found (ID: ${ad.creativeId}).`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        if (isMetaObjectId(ad.adId)) {
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        const resolvedAdSetId = adSetIdMap[ad.adSetName] || resolveExistingAdSetId(ad);
        const resolvedCampaignId = resolveCampaignIdForAd(ad, campaignIdMap);

        if (!resolvedAdSetId) {
          errors.push(`Ad "${ad.adName}": Ad set "${ad.adSetName}" has no ID.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        try {
          const adInput = buildAdInput(ad, creative, resolvedAdSetId, resolvedCampaignId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await createAd.mutateAsync(adInput as any);
          updatedAds[i] = {
            ...ad,
            adId: result.adId,
            campaignId: resolvedCampaignId,
            adSetId: resolvedAdSetId,
            metaCreativeId: result.creativeId || ad.metaCreativeId || '',
            previewLink: result.previewLink || '',
          };
          toast.success(`Ad created: ${ad.adName}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Ad "${ad.adName}": ${msg}`);
          toast.error(`Ad "${ad.adName}" failed: ${msg}`);
        }
        setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
      }
    }

    // ── Phase: Ads Only ────────────────────────────────────────────────────
    else if (buildMode === 'ads-only') {
      const filledAds = ads.filter(a => a.adName.trim() && !isMetaObjectId(a.adId) && resolveExistingAdSetId(a));
      setProgress({ phase: 'ads', total: filledAds.length, completed: 0, currentItem: '', errors: [] });

      for (let i = 0; i < updatedAds.length; i++) {
        const ad = updatedAds[i];
        if (!ad.adName.trim() || isMetaObjectId(ad.adId)) continue;
        const resolvedAdSetId = resolveExistingAdSetId(ad);
        const resolvedCampaignId = resolveCampaignIdForAd(ad);
        if (!resolvedAdSetId) {
          errors.push(`Ad "${ad.adName}": Existing Meta ad set ID is required. Enter it on the ad row or the matching ad set row.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        setProgress(p => ({ ...p, currentItem: `Creating ad: ${ad.adName}` }));

        const creative = findCreative(ad);
        if (!creative) {
          errors.push(`Ad "${ad.adName}": Creative not found.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        try {
          const adInput = buildAdInput(ad, creative, resolvedAdSetId, resolvedCampaignId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await createAd.mutateAsync(adInput as any);
          updatedAds[i] = {
            ...ad,
            adId: result.adId,
            campaignId: resolvedCampaignId || ad.campaignId,
            adSetId: resolvedAdSetId,
            metaCreativeId: result.creativeId || ad.metaCreativeId || '',
            previewLink: result.previewLink || '',
          };
          toast.success(`Ad created: ${ad.adName}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Ad "${ad.adName}": ${msg}`);
          toast.error(`Ad "${ad.adName}" failed: ${msg}`);
        }
        setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
      }
    }

    // ── Phase: Update Ads ──────────────────────────────────────────────────
    else if (buildMode === 'update') {
      const adsToUpdate = ads.filter(a => a.needsUpdate && a.adId.trim());
      setProgress({ phase: 'ads', total: adsToUpdate.length, completed: 0, currentItem: '', errors: [] });

      for (let i = 0; i < updatedAds.length; i++) {
        const ad = updatedAds[i];
        if (!ad.needsUpdate || !ad.adId.trim()) continue;

        setProgress(p => ({ ...p, currentItem: `Updating ad: ${ad.adName}` }));

        const creative = findCreative(ad);
        if (!creative) {
          errors.push(`Ad "${ad.adName}": Creative not found.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        try {
          const updateInput = buildAdCreativeApiInput(ad, creative, ad.adSetId, ad.campaignId, {
            accessToken,
            adAccountId,
            facebookPageId,
            instagramUserId,
            pixelId,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await updateAdCreative.mutateAsync({
            ...(updateInput as any),
            adId: ad.adId,
          });
          // Mark as no longer needing update and persist returned creative/preview data.
          updatedAds[i] = {
            ...ad,
            needsUpdate: false,
            campaignId: (updateInput as any).campaignId || ad.campaignId,
            adSetId: (updateInput as any).adSetId || ad.adSetId,
            metaCreativeId: result.creativeId || ad.metaCreativeId || '',
            sourcePostId: ad.sourcePostId,
            previewLink: result.previewLink || ad.previewLink || '',
          };
          toast.success(`Ad updated: ${ad.adName}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Ad "${ad.adName}": ${msg}`);
          toast.error(`Ad "${ad.adName}" update failed: ${msg}`);
        }
        setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
      }
    }

    // ── Finalize ───────────────────────────────────────────────────────────
    onWriteBack({ ads: updatedAds, campaigns: updatedCampaigns, adSets: updatedAdSets });


    if (errors.length === 0) {
      setProgress(p => ({ ...p, phase: 'done', errors: [] }));
      toast.success('Build complete! All ads created successfully.');
    } else {
      setProgress(p => ({ ...p, phase: 'error', errors }));
      toast.error(`Build finished with ${errors.length} error${errors.length !== 1 ? 's' : ''}.`);
    }
  }, [state, onWriteBack, createCampaign, createAdSet, createAd, updateAdCreative]);

  const reset = useCallback(() => {
    setProgress({ phase: 'idle', total: 0, completed: 0, currentItem: '', errors: [] });
  }, []);

  return { launch, progress, reset };
}
