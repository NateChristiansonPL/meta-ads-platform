import type { AdRow, AdSetRow, CreativeRow, GeoLocationObject, InterestObject, PlacementAsset } from './campaignStoreAdmin';

export type MetaTargetingSpec = Record<string, unknown>;

const VALID_PUBLISHER_PLATFORMS = new Set(['facebook', 'instagram', 'audience_network', 'messenger']);

const FB_POSITION_MAP: Record<string, string> = {
  facebook_feed: 'feed',
  facebook_profile_feed: 'profile_feed',
  facebook_stories: 'story',
  facebook_reels: 'facebook_reels',
  facebook_reels_overlay: 'facebook_reels_overlay',
  facebook_right_column: 'right_hand_column',
  facebook_marketplace: 'marketplace',
  facebook_search: 'search',
  facebook_business_explore: 'business_explore',
  facebook_notifications: 'notification',
  facebook_instream_reels: 'instream_video',
};

const IG_POSITION_MAP: Record<string, string> = {
  instagram_stream: 'stream',
  instagram_stories: 'story',
  instagram_reels: 'reels',
  instagram_explore_home: 'explore_home',
  instagram_profile_feed: 'profile_feed',
  instagram_search: 'ig_search',
};

const MESSENGER_POSITION_MAP: Record<string, string> = {
  messenger_stories: 'messenger_stories',
};

const AUDIENCE_NETWORK_POSITION_MAP: Record<string, string> = {
  audience_network_native: 'native',
  audience_network_banner: 'banner',
};

const LOCALE_MAP: Record<string, number> = {
  english_all: 1001,
  english_us: 6,
  english_uk: 24,
  spanish_all: 1002,
  spanish: 1002,
  french_all: 1003,
  german: 5,
  portuguese: 1005,
};

function clean(s?: string | null): string {
  return (s || '').trim();
}

function splitTokens(value?: string): string[] {
  return clean(value)
    .split(/[\n,;]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function parseJsonRecord(value?: string): Record<string, unknown> | null {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value?: string): unknown[] | null {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeGeoFromObjects(geoObjs: GeoLocationObject[]): Record<string, unknown> | null {
  if (!geoObjs?.length) return null;
  const geo: Record<string, unknown> = {};
  const cities: Record<string, unknown>[] = [];
  const regions: Record<string, unknown>[] = [];
  const countries: string[] = [];
  const zips: Record<string, unknown>[] = [];
  const geoMarkets: Record<string, unknown>[] = [];

  for (const g of geoObjs) {
    const type = clean(g.type).toLowerCase();
    const key = clean(g.key);
    if (!key) continue;
    if (type === 'city') cities.push({ key });
    else if (type === 'region') regions.push({ key });
    else if (type === 'country') countries.push(key.toUpperCase());
    else if (type === 'zip') zips.push({ key });
    else if (type === 'geo_market' || type === 'dma') geoMarkets.push({ key });
    else if (/^[A-Z]{2}$/i.test(key)) countries.push(key.toUpperCase());
  }

  if (cities.length) geo.cities = cities;
  if (regions.length) geo.regions = regions;
  if (countries.length) geo.countries = Array.from(new Set(countries));
  if (zips.length) geo.zips = zips;
  if (geoMarkets.length) geo.geo_markets = geoMarkets;
  return Object.keys(geo).length ? geo : null;
}

function normalizeGeoFromLegacyText(value?: string): Record<string, unknown> | null {
  const json = parseJsonRecord(value);
  if (json) return json;
  const tokens = splitTokens(value);
  const countries = tokens.filter(t => /^[A-Z]{2}$/i.test(t)).map(t => t.toUpperCase());
  return countries.length ? { countries: Array.from(new Set(countries)) } : null;
}

function groupInterests(items: InterestObject[]): Record<string, unknown> | null {
  const interests: Record<string, string>[] = [];
  const behaviors: Record<string, string>[] = [];
  const demographics: Record<string, string>[] = [];

  for (const item of items || []) {
    const id = clean(item.id);
    if (!id) continue;
    const entry = { id, name: item.name || id };
    const type = clean(item.type).toLowerCase();
    if (type.includes('behavior')) behaviors.push(entry);
    else if (type.includes('demographic')) demographics.push(entry);
    else interests.push(entry);
  }

  const layer: Record<string, unknown> = {};
  if (interests.length) layer.interests = interests;
  if (behaviors.length) layer.behaviors = behaviors;
  if (demographics.length) layer.demographics = demographics;
  return Object.keys(layer).length ? layer : null;
}

function buildFlexibleSpec(row: AdSetRow): Record<string, unknown>[] | undefined {
  const layers: Record<string, unknown>[] = [];

  const broadLayer = groupInterests(row.detailedInterestObjects || []);
  if (broadLayer) layers.push(broadLayer);

  const narrowLayer = groupInterests(row.narrowInterestObjects || []);
  if (narrowLayer) layers.push(narrowLayer);

  if (!layers.length) {
    const parsed = parseJsonArray(row.detailedInterests);
    if (parsed) return parsed as Record<string, unknown>[];
  }
  return layers.length ? layers : undefined;
}

function applyPlacements(row: AdSetRow, spec: MetaTargetingSpec): void {
  if (row.placementType !== 'manual') return;
  const platforms = new Set<string>();
  const fb: string[] = [];
  const ig: string[] = [];
  const messenger: string[] = [];
  const audienceNetwork: string[] = [];

  for (const placement of row.placements || []) {
    if (FB_POSITION_MAP[placement]) {
      platforms.add('facebook');
      fb.push(FB_POSITION_MAP[placement]);
    } else if (IG_POSITION_MAP[placement]) {
      platforms.add('instagram');
      ig.push(IG_POSITION_MAP[placement]);
    } else if (MESSENGER_POSITION_MAP[placement]) {
      platforms.add('messenger');
      messenger.push(MESSENGER_POSITION_MAP[placement]);
    } else if (AUDIENCE_NETWORK_POSITION_MAP[placement]) {
      platforms.add('audience_network');
      audienceNetwork.push(AUDIENCE_NETWORK_POSITION_MAP[placement]);
    }
    // Threads is intentionally ignored until Meta exposes a stable Ads API targeting key for it.
  }

  const validPlatforms = Array.from(platforms).filter(p => VALID_PUBLISHER_PLATFORMS.has(p));
  if (validPlatforms.length) spec.publisher_platforms = validPlatforms;
  if (fb.length) spec.facebook_positions = Array.from(new Set(fb));
  if (ig.length) spec.instagram_positions = Array.from(new Set(ig));
  if (messenger.length) spec.messenger_positions = Array.from(new Set(messenger));
  if (audienceNetwork.length) spec.audience_network_positions = Array.from(new Set(audienceNetwork));
}

function parseAudiences(value?: string): Record<string, string>[] | undefined {
  // Entries may be stored as plain numeric IDs OR as "id|name" pairs (new format from UI).
  // Extract the ID portion from both formats.
  const ids = splitTokens(value)
    .map(entry => entry.includes('|') ? entry.split('|')[0] : entry)
    .filter(id => /^\d+$/.test(id.trim()));
  return ids.length ? ids.map(id => ({ id: id.trim() })) : undefined;
}

function parseLocales(value?: string): number[] | undefined {
  const locales = splitTokens(value).map(raw => {
    if (/^\d+$/.test(raw)) return Number(raw);
    return LOCALE_MAP[raw.toLowerCase().replace(/[\s-]+/g, '_')];
  }).filter((v): v is number => Number.isFinite(v));
  return locales.length ? Array.from(new Set(locales)) : undefined;
}

export function buildBuilderTargetingSpec(row: AdSetRow): MetaTargetingSpec {
  const spec: MetaTargetingSpec = {};

  const ageMin = Number.parseInt(row.ageMin || '18', 10);
  const ageMax = Number.parseInt(row.ageMax || '65', 10);
  if (Number.isFinite(ageMin)) spec.age_min = ageMin;
  if (Number.isFinite(ageMax)) spec.age_max = ageMax;

  const gender = clean(row.genders).toLowerCase();
  if (gender === 'male' || gender === 'men') spec.genders = [1];
  else if (gender === 'female' || gender === 'women') spec.genders = [2];

  spec.geo_locations = normalizeGeoFromObjects(row.geoLocationObjects || [])
    || normalizeGeoFromLegacyText(row.geoLocations)
    || { countries: ['US'] };

  const flexibleSpec = buildFlexibleSpec(row);
  if (flexibleSpec?.length) spec.flexible_spec = flexibleSpec;

  const customAudiences = parseAudiences(row.targetedAudiences);
  if (customAudiences?.length) spec.custom_audiences = customAudiences;
  const excludedCustomAudiences = parseAudiences(row.excludedAudiences);
  if (excludedCustomAudiences?.length) spec.excluded_custom_audiences = excludedCustomAudiences;

  applyPlacements(row, spec);

  const devicePlatforms = splitTokens(row.devicePlatforms).filter(v => ['mobile', 'desktop'].includes(v.toLowerCase()));
  if (devicePlatforms.length) spec.device_platforms = Array.from(new Set(devicePlatforms.map(v => v.toLowerCase())));

  const userOs = splitTokens(row.operatingSystem);
  if (userOs.length) spec.user_os = userOs;

  const locales = parseLocales(row.language);
  if (locales?.length) spec.locales = locales;

  return spec;
}

export function isNarrowedTargeting(row: AdSetRow): boolean {
  return (row.narrowInterestObjects?.length || 0) > 0 || !!clean(row.narrowInterests);
}

export function buildAttributionSpec(attributionWindow?: string): Record<string, unknown>[] | undefined {
  const raw = clean(attributionWindow).toLowerCase();
  if (!raw) return undefined;
  const specs: Record<string, unknown>[] = [];
  if (raw.includes('7') && raw.includes('click')) specs.push({ event_type: 'CLICK_THROUGH', window_days: 7 });
  if (raw.includes('1') && raw.includes('click')) specs.push({ event_type: 'CLICK_THROUGH', window_days: 1 });
  if (raw.includes('1') && raw.includes('view')) specs.push({ event_type: 'VIEW_THROUGH', window_days: 1 });
  return specs.length ? specs : undefined;
}

export function buildAdSetApiExtras(row: AdSetRow): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const attributionSpec = buildAttributionSpec(row.attributionWindow);
  if (attributionSpec) extras.attributionSpec = attributionSpec;
  if (row.frequencyControl?.enabled) extras.frequencyControl = row.frequencyControl;
  const adScheduling = parseJsonArray(row.adScheduling);
  if (adScheduling?.length) extras.adScheduling = adScheduling;
  if (clean(row.leadGenFormId)) extras.leadGenFormId = clean(row.leadGenFormId);
  if (clean(row.facebookPageId)) extras.facebookPageId = clean(row.facebookPageId);
  if (clean(row.instagramProfileId)) extras.instagramProfileId = clean(row.instagramProfileId);
  if (clean(row.engagementGoal)) extras.engagementGoal = clean(row.engagementGoal);
  if (clean(row.attributionModel)) extras.attributionModel = clean(row.attributionModel);
  return extras;
}

function placementAssetFor(creative: CreativeRow, dimensions: string[]): PlacementAsset | undefined {
  // Normalize dimension strings for comparison (e.g. '9:16', '9x16', '916' all treated as 9:16)
  const normalize = (d: string) => d.replace(/[^0-9]/g, ':').replace(/^(\d+)[^0-9]+(\d+)$/, '$1:$2');
  const normalizedDims = dimensions.map(normalize);
  return creative.placementAssets?.find(pa => {
    const paDim = normalize(pa.dimension || '');
    return normalizedDims.includes(paDim) && clean(pa.assetUrl);
  });
}

export function buildAdCreativeApiInput(
  ad: AdRow,
  creative: CreativeRow,
  resolvedAdSetId: string,
  resolvedCampaignId: string,
  settings: { accessToken: string; adAccountId: string; facebookPageId: string; instagramUserId?: string; pixelId?: string }
): Record<string, unknown> {
  const feedAsset = placementAssetFor(creative, ['1:1', '4:5']);
  const storiesAsset = placementAssetFor(creative, ['9:16']);
  const feedAssetId = clean(feedAsset?.assetUrl) || undefined;
  const storiesAssetId = clean(storiesAsset?.assetUrl) || undefined;
  const websiteUrl = clean(ad.overrideWebsiteUrl) || clean(creative.websiteUrl);
  const urlParameters = clean(ad.overrideUtmParams) || clean(creative.urlParams) || undefined;
  const primaryTexts = clean(ad.overridePrimaryText)
    ? [clean(ad.overridePrimaryText)]
    : (creative.primaryTexts || []).map(clean).filter(Boolean);
  const headlines = clean(ad.overrideHeadline)
    ? [clean(ad.overrideHeadline)]
    : (creative.headlines || []).map(clean).filter(Boolean);
  const descriptions = clean(ad.overrideDescription)
    ? [clean(ad.overrideDescription)]
    : (creative.descriptions || []).map(clean).filter(Boolean);
  const callToAction = clean(ad.overrideCta) || clean(creative.cta) || 'LEARN_MORE';
  const isSingleVideo = creative.adType === 'video' && !!feedAssetId && !storiesAssetId;

  return {
    accessToken: settings.accessToken,
    adAccountId: settings.adAccountId,
    adSetId: resolvedAdSetId,
    campaignId: resolvedCampaignId || undefined,
    pageId: settings.facebookPageId,
    instagramActorId: settings.instagramUserId || undefined,
    pixelId: settings.pixelId || creative.pixelId || undefined,
    name: ad.adName,
    status: ad.status,
    adType: creative.adType,
    feedAssetId,
    storiesAssetId,
    singleVideoId: isSingleVideo ? feedAssetId : undefined,
    feedWebsiteUrl: clean(feedAsset?.websiteUrl) || undefined,
    storiesWebsiteUrl: clean(storiesAsset?.websiteUrl) || undefined,
    feedPrimaryText: clean(feedAsset?.primaryText) || undefined,
    storiesPrimaryText: clean(storiesAsset?.primaryText) || undefined,
    cards: creative.adType === 'carousel'
      ? creative.carouselCards.map(card => ({
          assetId: clean(card.fileHash),
          headline: clean(card.headline) || undefined,
          description: clean(card.description) || undefined,
          linkUrl: clean(card.url) || websiteUrl,
          callToAction: callToAction || undefined,
        })).filter(card => card.assetId && card.linkUrl)
      : undefined,
    headlines: headlines.length ? headlines : [''],
    primaryTexts: primaryTexts.length ? primaryTexts : [''],
    descriptions: descriptions.length ? descriptions : undefined,
    callToAction,
    websiteUrl,
    urlParameters,
    displayUrl: clean(creative.displayUrl) || undefined,
    sourcePostId: clean(ad.sourcePostId) || clean(creative.postId) || undefined,
    leadGenFormId: clean(ad.leadGenFormId) || clean(creative.leadGenFormId) || undefined,
  };
}
