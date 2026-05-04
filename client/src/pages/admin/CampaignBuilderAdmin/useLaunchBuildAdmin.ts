/**
 * useLaunchBuild — orchestrates the full Meta Ads campaign creation flow.
 *
 * Build modes:
 *   full:     create campaigns → ad sets → ads
 *   ads-only: skip campaigns/ad sets, use existing ad set IDs from AdRow
 *   update:   call updateAdCreative for each ad with needsUpdate=true
 *
 * After each ad is created, writes back adId, campaignId, adSetId, and previewLink
 * into the corresponding AdRow via the onWriteBack callback.
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

export interface LaunchProgress {
  phase: 'idle' | 'campaigns' | 'adsets' | 'ads' | 'done' | 'error';
  total: number;
  completed: number;
  currentItem: string;
  errors: string[];
  /** Sheet write-back result — set after launch completes */
  sheetWriteBack?: {
    status: 'success' | 'error' | 'skipped';
    written?: number;
    message?: string;
  };
}

export function useLaunchBuild(
  state: CampaignBuilderState,
  onWriteBack: (updatedAds: AdRow[]) => void
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
  const writeBackToSheet = trpc.adminMeta.writeBackToSheet.useMutation();

  const launch = useCallback(async () => {
    const { settings, campaigns, adSets, creatives, ads, buildMode } = state;
    const { accessToken, adAccountId, facebookPageId, instagramUserId, pixelId } = settings;

    const errors: string[] = [];
    const updatedAds = [...ads];

    // ── Helper: find creative for an ad row ────────────────────────────────
    const findCreative = (ad: AdRow): CreativeRow | undefined =>
      creatives.find(c => c.creativeId === ad.creativeId || c.concept === ad.creativeConcept);

    // ── Helper: get asset IDs for a creative ───────────────────────────────
    // In the current UI, placementAssets hold localFile + assetUrl (image hash or video ID
    // after upload). Feed = 1:1 or 4:5, Stories = 9:16.
    const getFeedAssetId = (creative: CreativeRow): string | undefined => {
      const feedDims = ['1:1', '4:5'];
      const feedAsset = creative.placementAssets?.find(pa =>
        feedDims.includes(pa.dimension) && pa.assetUrl.trim()
      );
      return feedAsset?.assetUrl || undefined;
    };

    const getStoriesAssetId = (creative: CreativeRow): string | undefined => {
      const storiesAsset = creative.placementAssets?.find(pa =>
        pa.dimension === '9:16' && pa.assetUrl.trim()
      );
      return storiesAsset?.assetUrl || undefined;
    };

    // ── Helper: build createAd input from ad row + creative ────────────────
    const buildAdInput = (
      ad: AdRow,
      creative: CreativeRow,
      resolvedAdSetId: string,
      resolvedCampaignId: string
    ) => {
      const feedAssetId = getFeedAssetId(creative);
      const storiesAssetId = getStoriesAssetId(creative);

      // Determine if single video (feed only, no stories asset)
      const isSingleVideo =
        creative.adType === 'video' && feedAssetId && !storiesAssetId;

      // URL resolution: override > creative-level
      const websiteUrl = ad.overrideWebsiteUrl || creative.websiteUrl || '';
      const urlParameters = ad.overrideUtmParams || creative.urlParams || '';

      // Copy resolution: override > creative-level
      const headlines = ad.overrideHeadline
        ? [ad.overrideHeadline]
        : creative.headlines.filter(h => h.trim());
      const primaryTexts = ad.overridePrimaryText
        ? [ad.overridePrimaryText]
        : creative.primaryTexts.filter(p => p.trim());
      const callToAction = ad.overrideCta || creative.cta || 'LEARN_MORE';

      return {
        accessToken,
        adAccountId,
        adSetId: resolvedAdSetId,
        pageId: facebookPageId,
        instagramActorId: instagramUserId || undefined,
        pixelId: pixelId || creative.pixelId || undefined,
        name: ad.adName,
        status: ad.status,
        adType: creative.adType,
        feedAssetId: feedAssetId || undefined,
        storiesAssetId: storiesAssetId || undefined,
        singleVideoId: isSingleVideo ? feedAssetId : undefined,
        cards: creative.adType === 'carousel'
          ? creative.carouselCards.map(card => ({
              assetId: card.fileHash,
              headline: card.headline || undefined,
              description: card.description || undefined,
              linkUrl: card.url || websiteUrl,
              callToAction: callToAction || undefined,
            }))
          : undefined,
        headlines: headlines.length > 0 ? headlines : [''],
        primaryTexts: primaryTexts.length > 0 ? primaryTexts : [''],
        descriptions: creative.descriptions?.filter(d => d.trim()) || undefined,
        callToAction,
        websiteUrl,
        urlParameters: urlParameters || undefined,
        sourcePostId: ad.sourcePostId || creative.postId || undefined,
        placements: undefined,
        campaignId: resolvedCampaignId,
      };
    };

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
      for (const campaign of filledCampaigns) {
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
            });
            campaignIdMap[campaign.name] = result.campaignId;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // If it's a duplicate conflict, try to get the existing ID from the error message
          if (msg.includes('already exists') && msg.includes('ID:')) {
            const match = msg.match(/ID: (\d+)/);
            if (match) campaignIdMap[campaign.name] = match[1];
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
      for (const adSet of filledAdSets) {
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
            const targeting = buildTargetingSpec(adSet);
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
            });
            adSetIdMap[adSet.name] = result.adSetId;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('already exists') && msg.includes('ID:')) {
            const match = msg.match(/ID: (\d+)/);
            if (match) adSetIdMap[adSet.name] = match[1];
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

        const resolvedAdSetId = adSetIdMap[ad.adSetName] || ad.adSetId;
        const resolvedCampaignId = campaignIdMap[ad.campaignName] || ad.campaignId;

        if (!resolvedAdSetId) {
          errors.push(`Ad "${ad.adName}": Ad set "${ad.adSetName}" has no ID.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        try {
          const adInput = buildAdInput(ad, creative, resolvedAdSetId, resolvedCampaignId);
          const result = await createAd.mutateAsync(adInput);
          updatedAds[i] = {
            ...ad,
            adId: result.adId,
            campaignId: resolvedCampaignId,
            adSetId: resolvedAdSetId,
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
      const filledAds = ads.filter(a => a.adName.trim() && a.adSetId.trim());
      setProgress({ phase: 'ads', total: filledAds.length, completed: 0, currentItem: '', errors: [] });

      for (let i = 0; i < updatedAds.length; i++) {
        const ad = updatedAds[i];
        if (!ad.adName.trim() || !ad.adSetId.trim()) continue;

        setProgress(p => ({ ...p, currentItem: `Creating ad: ${ad.adName}` }));

        const creative = findCreative(ad);
        if (!creative) {
          errors.push(`Ad "${ad.adName}": Creative not found.`);
          setProgress(p => ({ ...p, completed: p.completed + 1, errors }));
          continue;
        }

        try {
          const adInput = buildAdInput(ad, creative, ad.adSetId, ad.campaignId);
          const result = await createAd.mutateAsync(adInput);
          updatedAds[i] = {
            ...ad,
            adId: result.adId,
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

        const feedAssetId = getFeedAssetId(creative);
        const storiesAssetId = getStoriesAssetId(creative);
        const isSingleVideo = creative.adType === 'video' && feedAssetId && !storiesAssetId;
        const websiteUrl = ad.overrideWebsiteUrl || creative.websiteUrl || '';
        const urlParameters = ad.overrideUtmParams || creative.urlParams || '';
        const headlines = ad.overrideHeadline ? [ad.overrideHeadline] : creative.headlines.filter(h => h.trim());
        const primaryTexts = ad.overridePrimaryText ? [ad.overridePrimaryText] : creative.primaryTexts.filter(p => p.trim());
        const callToAction = ad.overrideCta || creative.cta || 'LEARN_MORE';

        try {
          await updateAdCreative.mutateAsync({
            accessToken,
            adAccountId,
            adId: ad.adId,
            pageId: facebookPageId,
            instagramActorId: instagramUserId || undefined,
            pixelId: pixelId || creative.pixelId || undefined,
            adType: creative.adType,
            feedAssetId: feedAssetId || undefined,
            storiesAssetId: storiesAssetId || undefined,
            singleVideoId: isSingleVideo ? feedAssetId : undefined,
            cards: creative.adType === 'carousel'
              ? creative.carouselCards.map(card => ({
                  assetId: card.fileHash,
                  headline: card.headline || undefined,
                  description: card.description || undefined,
                  linkUrl: card.url || websiteUrl,
                  callToAction: callToAction || undefined,
                }))
              : undefined,
            headlines: headlines.length > 0 ? headlines : [''],
            primaryTexts: primaryTexts.length > 0 ? primaryTexts : [''],
            descriptions: creative.descriptions?.filter(d => d.trim()) || undefined,
            callToAction,
            websiteUrl,
            urlParameters: urlParameters || undefined,
          });
          // Mark as no longer needing update
          updatedAds[i] = { ...ad, needsUpdate: false };
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
    onWriteBack(updatedAds);

    // ── Sheet write-back (if sheetUrl is configured) ───────────────────────
    const sheetUrl = settings.sheetUrl?.trim();
    if (sheetUrl && buildMode !== 'update') {
      setProgress(p => ({ ...p, currentItem: 'Writing back to Google Sheet…' }));
      try {
        // Build write-back rows.
        // Row numbers are 1-based; row 1 = header, so first data row = 2.
        // We use the ad's position in the full ads array (not filtered) so row
        // numbers stay stable even if some ads failed.
        const writeBackRows = updatedAds
          .map((ad, idx) => ({ ad, exportRowNumber: idx + 2, adsRowNumber: idx + 2 }))
          .filter(({ ad }) => ad.adId)
          .map(({ ad, exportRowNumber, adsRowNumber }) => ({
            exportRowNumber,
            adsRowNumber,
            adId: ad.adId || undefined,
            adSetId: ad.adSetId || undefined,
            campaignId: ad.campaignId || undefined,
            previewLink: ad.previewLink || undefined,
          }));

        if (writeBackRows.length > 0) {
          const result = await writeBackToSheet.mutateAsync({
            sheetUrl,
            rows: writeBackRows,
          });
          if (result.message) {
            toast.warning(`Sheet write-back: ${result.message}`);
            setProgress(p => ({ ...p, sheetWriteBack: { status: 'skipped', message: result.message ?? undefined } }));
          } else {
            toast.success(`Sheet write-back complete — ${result.written} cells updated.`);
            setProgress(p => ({ ...p, sheetWriteBack: { status: 'success', written: result.written } }));
          }
        } else {
          setProgress(p => ({ ...p, sheetWriteBack: { status: 'skipped', message: 'No ads with IDs to write back.' } }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Non-fatal: log but don't block the done state
        errors.push(`Sheet write-back failed: ${msg}`);
        toast.error(`Sheet write-back failed: ${msg}`);
        setProgress(p => ({ ...p, sheetWriteBack: { status: 'error', message: msg } }));
      }
    } else if (!sheetUrl) {
      setProgress(p => ({ ...p, sheetWriteBack: { status: 'skipped', message: 'No sheet URL configured.' } }));
    }

    if (errors.length === 0) {
      setProgress(p => ({ ...p, phase: 'done', errors: [] }));
      toast.success('Build complete! All ads created successfully.');
    } else {
      setProgress(p => ({ ...p, phase: 'error', errors }));
      toast.error(`Build finished with ${errors.length} error${errors.length !== 1 ? 's' : ''}.`);
    }
  }, [state, onWriteBack, createCampaign, createAdSet, createAd, updateAdCreative, writeBackToSheet]);

  const reset = useCallback(() => {
    setProgress({ phase: 'idle', total: 0, completed: 0, currentItem: '', errors: [] });
  }, []);

  return { launch, progress, reset };
}

// ── Targeting spec builder ─────────────────────────────────────────────────────
function buildTargetingSpec(adSet: AdSetRow): Record<string, unknown> {
  const spec: Record<string, unknown> = {};

  // Age
  if (adSet.ageMin) spec.age_min = parseInt(adSet.ageMin, 10);
  if (adSet.ageMax) spec.age_max = parseInt(adSet.ageMax, 10);

  // Gender: 0 = all, 1 = male, 2 = female
  if (adSet.genders && adSet.genders !== 'All') {
    spec.genders = adSet.genders === 'Male' ? [1] : adSet.genders === 'Female' ? [2] : [];
  }

  // Geo locations
  if (adSet.geoLocations) {
    try {
      spec.geo_locations = JSON.parse(adSet.geoLocations);
    } catch {
      // Treat as comma-separated country codes
      const countries = adSet.geoLocations.split(',').map(c => c.trim()).filter(Boolean);
      spec.geo_locations = { countries };
    }
  }

  // Placements
  if (adSet.placementType === 'advantage_plus') {
    spec.publisher_platforms = ['facebook', 'instagram', 'audience_network', 'messenger'];
  } else if (adSet.placements && adSet.placements.length > 0) {
    const platforms = new Set<string>();
    const fbPlacements: string[] = [];
    const igPlacements: string[] = [];
    const audienceNetworkPlacements: string[] = [];
    const messengerPlacements: string[] = [];

    adSet.placements.forEach(p => {
      if (p.startsWith('facebook_')) {
        platforms.add('facebook');
        fbPlacements.push(p.replace('facebook_', ''));
      } else if (p.startsWith('instagram_')) {
        platforms.add('instagram');
        igPlacements.push(p.replace('instagram_', ''));
      } else if (p.startsWith('audience_network_')) {
        platforms.add('audience_network');
        audienceNetworkPlacements.push(p.replace('audience_network_', ''));
      } else if (p.startsWith('messenger_')) {
        platforms.add('messenger');
        messengerPlacements.push(p.replace('messenger_', ''));
      }
    });

    spec.publisher_platforms = Array.from(platforms);
    if (fbPlacements.length > 0) spec.facebook_positions = fbPlacements;
    if (igPlacements.length > 0) spec.instagram_positions = igPlacements;
    if (audienceNetworkPlacements.length > 0) spec.audience_network_positions = audienceNetworkPlacements;
    if (messengerPlacements.length > 0) spec.messenger_positions = messengerPlacements;
  }

  // Detailed interests
  if (adSet.detailedInterests) {
    try {
      spec.flexible_spec = JSON.parse(adSet.detailedInterests);
    } catch {
      // Not JSON — skip
    }
  }

  // Custom audiences (targeted)
  if (adSet.targetedAudiences) {
    const ids = adSet.targetedAudiences.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      spec.custom_audiences = ids.map(id => ({ id }));
    }
  }

  // Excluded audiences
  if (adSet.excludedAudiences) {
    const ids = adSet.excludedAudiences.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      spec.excluded_custom_audiences = ids.map(id => ({ id }));
    }
  }

  return spec;
}
