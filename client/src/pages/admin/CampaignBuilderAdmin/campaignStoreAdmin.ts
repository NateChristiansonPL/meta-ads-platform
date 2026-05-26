// campaignStore.ts — Precision Tool Dark design system
// All data is row-based for fast paste/copy operations

export type BuildMode = 'full' | 'ads-only' | 'update';
export type Objective =
  | 'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS' | 'OUTCOME_APP_PROMOTION' | 'OUTCOME_SALES';
export type BudgetType = 'DAILY' | 'LIFETIME';
export type AdType = 'static' | 'video' | 'carousel';
export type OptimizationGoal =
  | 'REACH' | 'IMPRESSIONS' | 'LINK_CLICKS' | 'LANDING_PAGE_VIEWS'
  | 'LEAD_GENERATION' | 'QUALITY_LEAD' | 'OFFSITE_CONVERSIONS' | 'VALUE'
  | 'APP_INSTALLS' | 'THRUPLAY' | 'VIDEO_VIEWS' | 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'
  | 'POST_ENGAGEMENT' | 'PAGE_LIKES' | 'PAGE_VISITS' | 'AD_RECALL_LIFT';
export type BillingEvent = 'IMPRESSIONS' | 'LINK_CLICKS' | 'THRUPLAY' | 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS';
export type PlacementType = 'advantage_plus' | 'manual';
export type PlacementDimension = '1:1' | '4:5' | '9:16';
export type ConversionLocation =
  | 'WEBSITE' | 'APP' | 'MESSENGER' | 'INSTAGRAM_PROFILE' | 'FACEBOOK_PAGE'
  | 'PHONE_CALL' | 'ON_AD' | 'IG_FB_COMBINED';
export type SpecialAdCategory = 'NONE' | 'HOUSING' | 'EMPLOYMENT' | 'CREDIT' | 'ISSUES_ELECTIONS_POLITICS';

// Frequency control types
export type FrequencyControlType = 'target' | 'cap';
export type FrequencyControlMode = 'default' | 'custom';

export const PLACEMENT_DIMENSIONS: PlacementDimension[] = ['1:1', '4:5', '9:16'];

// ── Per-placement asset override ──────────────────────────────────────────────
export interface PlacementAsset {
  dimension: PlacementDimension;
  assetUrl: string;        // image hash, video ID, or URL
  websiteUrl?: string;     // override row-level URL (optional)
  primaryText?: string;    // override row-level primary text (optional)
  localFile?: File;        // held in memory for upload on publish
  localPreviewUrl?: string;// object URL for thumbnail preview
}

// ── Carousel card ─────────────────────────────────────────────────────────────
export interface CarouselCard {
  id: string;
  cardNumber: number;
  fileName: string;
  fileHash: string;
  headline: string;
  description: string;
  url: string;
  localFile?: File;          // held in memory for upload on publish
  localPreviewUrl?: string;  // object URL for thumbnail preview
}

// ── Lead Gen Form ─────────────────────────────────────────────────────────────
export interface LeadGenFormField {
  id: string;
  type: 'FULL_NAME' | 'EMAIL' | 'PHONE_NUMBER' | 'STREET_ADDRESS' | 'CITY' | 'STATE' | 'ZIP' | 'COUNTRY' | 'CUSTOM';
  label: string;
  required: boolean;
}

export interface LeadGenFormPage {
  id: string;
  type: 'INTRO' | 'QUESTIONS' | 'CONFIRMATION';
  headline: string;
  description: string;
  imageUrl?: string;
}

export interface LeadGenForm {
  id: string;
  name: string;
  formType: 'MORE_VOLUME' | 'HIGHER_INTENT';
  privacyPolicyUrl: string;
  privacyPolicyLinkText: string;
  pages: LeadGenFormPage[];
  fields: LeadGenFormField[];
  thankYouHeadline: string;
  thankYouDescription: string;
  thankYouCta: string;
  thankYouCtaUrl: string;
  // write-back
  formId: string;
}

// ── Structured targeting objects (needed for Meta API reach/overlap calls) ────
export interface GeoLocationObject {
  key: string;   // Meta geo key (e.g. "2460644" for a city) or place_id for custom locations
  type: string;  // 'city' | 'region' | 'country' | 'zip' | 'geo_market' | 'custom_location'
  name: string;  // display label
  radius?: number;        // radius around location (cities: 10-50 mi / 17-80 km; custom: 1-50 mi)
  distanceUnit?: 'mile' | 'kilometer';  // default: 'mile'
  latitude?: number;      // for custom_location type (geocoded address)
  longitude?: number;     // for custom_location type (geocoded address)
}
export interface InterestObject {
  id: string;    // Meta interest/behavior/demographic ID
  type: string;  // 'adinterest' | 'behaviors' | 'demographics'
  name: string;  // display label
}

// ── Frequency Control ─────────────────────────────────────────────────────────
export interface FrequencyControl {
  // For Reach: 'target' | 'cap'; For Ad Recall: 'default' | 'custom'; For ThruPlay/2secVV: enabled toggle
  mode: string;
  times: number;   // 1-3 for Reach, up to 50 for Ad Recall/ThruPlay/2secVV
  days: number;    // 2-7 for all
  enabled: boolean;
}

// ── Campaign row ──────────────────────────────────────────────────────────────
export interface CampaignRow {
  id: string;
  name: string;
  objective: Objective;
  specialAdCategory: SpecialAdCategory;
  spendCap: string;
  cbo: boolean;
  status: 'ACTIVE' | 'PAUSED';
  // write-back
  campaignId: string;
}

// ── Ad Set row ────────────────────────────────────────────────────────────────
export interface AdSetRow {
  id: string;
  status: 'ACTIVE' | 'PAUSED';          // MOVED TO FRONT
  campaignName: string;
  name: string;
  budgetType: BudgetType;
  budget: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  optimizationGoal: OptimizationGoal;
  billingEvent: BillingEvent;
  // Billing choice for ThruPlay / 2-sec vid views
  billingChoice?: string;               // 'IMPRESSIONS' | 'THRUPLAY' | 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'
  conversionLocation: ConversionLocation;
  conversionEvent: string;
  customConversionId?: string;          // Meta custom conversion ID (when a custom conversion is selected)
  customConversionRule?: string;        // pixel_rule JSON for the custom conversion (from Meta API)
  // Engagement objective extras
  engagementGoal?: string;              // numeric goal for page visits / page likes
  facebookPageId?: string;             // required for Awareness + Engagement
  instagramProfileId?: string;         // required for Engagement IG/FB combined
  placementType: PlacementType;
  platforms: string[];
  placements: string[];
  geoLocations: string;
  geoLocationObjects: GeoLocationObject[];  // structured: key+type+name for API calls
  ageMin: string;
  ageMax: string;
  genders: string;
  detailedInterests: string;           // renamed from 'interests'
  detailedInterestObjects: InterestObject[];  // structured: id+type+name for API calls
  narrowInterests: string;             // new: narrow detailed interests
  narrowInterestObjects: InterestObject[];    // structured: id+type+name for API calls
  targetedAudiences: string;           // renamed from 'customAudiences'
  excludedAudiences: string;
  attributionWindow: string;
  // Frequency control — structured object
  frequencyControl?: FrequencyControl;
  // Optional tree fields
  language?: string;
  devicePlatforms?: string;
  operatingSystem?: string;
  adScheduling?: string;
  attributionModel?: string;
  leadGenFormId?: string;
  // Bid strategy (optional — defaults to LOWEST_COST_WITHOUT_CAP / Highest Volume)
  bidStrategy?: 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'LOWEST_COST_WITH_MIN_ROAS';
  bidCap?: string;       // cents (for LOWEST_COST_WITH_BID_CAP) — entered as dollars in UI
  costCap?: string;      // cents (for COST_CAP) — entered as dollars in UI
  roasFloor?: string;    // decimal ROAS floor e.g. "2.5" (for LOWEST_COST_WITH_MIN_ROAS)
  // Advantage+ Audience: when true, omit targeting_automation so Meta can expand targeting
  advantageAudience?: boolean;
  // write-back
  adSetId: string;
  campaignId?: string;
}

// ── Creative row ──────────────────────────────────────────────────────────────
export interface CreativeRow {
  id: string;
  creativeId: string;
  adType: AdType;
  placementDimensions: PlacementDimension[];
  concept: string;
  assetLength: string;
  placementAssets: PlacementAsset[];
  primaryTexts: string[];
  headlines: string[];
  descriptions: string[];   // max 1 (no variants per feedback)
  cta: string;
  websiteUrl: string;
  urlParams: string;
  displayUrl: string;       // display link shown in ad (e.g. "example.com") — passed as display_url
  postId: string;
  pixelId: string;
  carouselCards: CarouselCard[];
  leadGenFormId?: string;
  placementCustomized: boolean;
}

// ── Ad row ────────────────────────────────────────────────────────────────────
export interface AdRow {
  id: string;
  status: 'ACTIVE' | 'PAUSED';          // defaulted to PAUSED
  adName: string;
  adSetName: string;
  campaignName: string;
  // write-back IDs
  adId: string;
  adSetId: string;
  campaignId: string;
  metaCreativeId: string;
  sourcePostId: string;
  // Creative reference
  creativeId: string;
  creativeConcept: string;
  creativeType: AdType | '';
  creativeLength: string;
  // Launch date (auto-parsed from setup date, e.g. "Apr/26")
  launchDate: string;
  // Preview
  previewLink: string;
  // Pre-publish overrides
  overrideUtmParams?: string;
  overridePrimaryText?: string;
  overrideHeadline?: string;
  overrideDescription?: string;
  overrideWebsiteUrl?: string;
  overrideCta?: string;
  leadGenFormId?: string;  // selected lead gen form ID for this ad
  needsUpdate: boolean;
}

// ── Imported Meta structure ───────────────────────────────────────────────────
export interface ImportedMetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

export interface ImportedMetaAdSet {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface BuildSettings {
  /** Vault token ID — used to resolve accessToken server-side */
  tokenId: number | null;
  /** BM ID associated with the selected token */
  bmId: string;
  adAccountId: string;
  adAccountName: string;
  accessToken: string;
  facebookPageId: string;
  facebookPageName: string;
  instagramUserId: string;
  instagramUsername: string;
  pixelId: string;
  pixelName: string;
}

// ── Reach / Overlap history types ───────────────────────────────────────────
export interface ReachEstimateResult {
  id: string;
  name: string;
  reachLower: number;
  reachUpper: number;
  reachMid: number;
  cpm: number | null;
  error: string | null;
}

export interface ReachEstimateRun {
  runAt: number;
  results: ReachEstimateResult[];
}

export interface OverlapPair {
  adSetA: { id: string; name: string };
  adSetB: { id: string; name: string };
  intersectionReach: number;
  overlapPctA: number;
  overlapPctB: number;
  confidence: string;
}

export interface OverlapAdSetResult {
  id: string;
  name: string;
  reach: number;
  overlaps: { pct: number; name: string; confidence: string }[];
}

export interface OverlapRun {
  runAt: number;
  overlapResults: OverlapAdSetResult[];
  pairList: OverlapPair[];
}

// ── Full state ────────────────────────────────────────────────────────────────
export interface CampaignBuilderState {
  buildMode: BuildMode;
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
  creatives: CreativeRow[];
  carouselCreatives: CreativeRow[];
  ads: AdRow[];
  settings: BuildSettings;
  leadGenForms: LeadGenForm[];
  importedCampaigns: ImportedMetaCampaign[];
  importedAdSets: ImportedMetaAdSet[];
  reachHistory: ReachEstimateRun[];
  overlapHistory: OverlapRun[];
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultStartDate(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function defaultEndDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

/** Returns "Mon/YY" format from current date */
export function currentLaunchDate(): string {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export function generateCreativeId(concept: string, adType: AdType, assetLength: string): string {
  if (!concept) return '';
  const words = concept.trim().split(/\s+/).slice(0, 4);
  const prefix = words.map(w => w.slice(0, 3).toUpperCase()).join('');
  const typePart = adType === 'static' ? 'IMG' : adType === 'video' ? 'VID' : 'CAR';
  const lengthPart = adType === 'video' && assetLength ? `-${assetLength}S` : '';
  return `${prefix}-${typePart}${lengthPart}`;
}

/** Generate ad name: Creative Concept - Asset Type - Length (if applicable) - Month-Yr
 * Format: "Summer Sale - Video - 15s - May-26" or "Summer Sale - Static - May-26"
 * Launch date must be in "Mon-YY" format (e.g. "May-26") or will default to current month.
 */
export function generateAdName(creative: CreativeRow, launchDate?: string): string {
  const concept = creative.concept || 'Untitled';
  // Normalize launch date: accept "Mon/YY" or "Mon-YY" format, output "Mon-YY"
  const rawDate = launchDate || currentLaunchDate();
  const date = rawDate.replace('/', '-');

  const parts: string[] = [concept];

  if (creative.adType === 'video') {
    parts.push('Video');
    if (creative.assetLength) parts.push(`${creative.assetLength}s`);
  } else if (creative.adType === 'carousel') {
    parts.push('Carousel');
  } else {
    // static
    parts.push('Static');
  }

  parts.push(date);
  return parts.join(' - ');
}

export function sacRestrictsTargeting(specialAdCategory: SpecialAdCategory): boolean {
  return specialAdCategory !== 'NONE';
}

// ── Objective → valid optimization goals ──────────────────────────────────────
export const OBJECTIVE_OPT_GOALS: Record<Objective, OptimizationGoal[]> = {
  OUTCOME_AWARENESS:    ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT', 'THRUPLAY', 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'],
  OUTCOME_TRAFFIC:      ['LANDING_PAGE_VIEWS', 'LINK_CLICKS', 'IMPRESSIONS', 'REACH'],
  OUTCOME_ENGAGEMENT:   ['POST_ENGAGEMENT', 'PAGE_LIKES', 'PAGE_VISITS', 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', 'THRUPLAY', 'LINK_CLICKS'],
  OUTCOME_LEADS:        ['LEAD_GENERATION', 'QUALITY_LEAD', 'OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS'],
  OUTCOME_APP_PROMOTION:['APP_INSTALLS', 'LINK_CLICKS'],
  OUTCOME_SALES:        ['OFFSITE_CONVERSIONS', 'VALUE', 'LANDING_PAGE_VIEWS', 'LINK_CLICKS'],
};

export function defaultOptGoal(objective: Objective): OptimizationGoal {
  const map: Record<Objective, OptimizationGoal> = {
    OUTCOME_AWARENESS:    'REACH',
    OUTCOME_TRAFFIC:      'LANDING_PAGE_VIEWS',
    OUTCOME_ENGAGEMENT:   'POST_ENGAGEMENT',
    OUTCOME_LEADS:        'LEAD_GENERATION',
    OUTCOME_APP_PROMOTION:'APP_INSTALLS',
    OUTCOME_SALES:        'OFFSITE_CONVERSIONS',
  };
  return map[objective];
}

export function attributionApplicable(objective: Objective, goal: OptimizationGoal): boolean {
  const conversionGoals: OptimizationGoal[] = ['OFFSITE_CONVERSIONS', 'VALUE', 'LEAD_GENERATION', 'QUALITY_LEAD', 'APP_INSTALLS', 'LANDING_PAGE_VIEWS', 'LINK_CLICKS'];
  const conversionObjectives: Objective[] = ['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_APP_PROMOTION'];
  return conversionObjectives.includes(objective) && conversionGoals.includes(goal);
}

/** Frequency control applicability per optimization goal */
export function frequencyControlApplicable(goal: OptimizationGoal): boolean {
  return ['REACH', 'AD_RECALL_LIFT', 'THRUPLAY', 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', 'IMPRESSIONS'].includes(goal);
}

/** Whether frequency control is MANDATORY (vs optional) */
export function frequencyControlMandatory(goal: OptimizationGoal): boolean {
  return goal === 'REACH' || goal === 'AD_RECALL_LIFT';
}

/** Max times value for frequency control */
export function frequencyControlMaxTimes(goal: OptimizationGoal): number {
  if (goal === 'REACH') return 3;
  return 50; // AD_RECALL_LIFT, THRUPLAY, TWO_SECOND_CONTINUOUS_VIDEO_VIEWS
}

/** Whether billing choice (when to get charged) is available */
export function billingChoiceApplicable(goal: OptimizationGoal): boolean {
  return goal === 'THRUPLAY' || goal === 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS';
}

/** Billing choice options for a given goal */
export function billingChoiceOptions(goal: OptimizationGoal): { value: string; label: string }[] {
  if (goal === 'THRUPLAY') {
    return [
      { value: 'IMPRESSIONS', label: 'Impressions' },
      { value: 'THRUPLAY', label: 'ThruPlays' },
    ];
  }
  if (goal === 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS') {
    return [
      { value: 'IMPRESSIONS', label: 'Impressions' },
      { value: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', label: '2-Sec Video Views' },
    ];
  }
  return [];
}

/** Whether conversion event picker should be shown */
export function conversionEventApplicable(goal: OptimizationGoal): boolean {
  return goal === 'OFFSITE_CONVERSIONS' || goal === 'VALUE' || goal === 'QUALITY_LEAD';
}

/** Whether lead gen form field should be shown */
export function leadGenApplicable(goal: OptimizationGoal): boolean {
  return goal === 'LEAD_GENERATION' || goal === 'QUALITY_LEAD';
}

/** Whether Facebook Page ID is required at ad set level */
export function fbPageRequiredAtAdSet(objective: Objective): boolean {
  return objective === 'OUTCOME_AWARENESS' || objective === 'OUTCOME_ENGAGEMENT';
}

/** Whether engagement goal input is required */
export function engagementGoalApplicable(goal: OptimizationGoal): boolean {
  return goal === 'PAGE_VISITS' || goal === 'PAGE_LIKES';
}

/** Whether IG/FB combined conversion location needs IG profile */
export function igFbCombinedApplicable(convLoc: ConversionLocation): boolean {
  return convLoc === 'IG_FB_COMBINED';
}

export function ctaOptionsForObjective(objective: Objective): string[] {
  const base = ['NO_BUTTON'];
  switch (objective) {
    case 'OUTCOME_AWARENESS':
      return ['LEARN_MORE', 'WATCH_MORE', 'SHOP_NOW', 'CONTACT_US', 'BOOK_NOW', ...base];
    case 'OUTCOME_TRAFFIC':
      return ['LEARN_MORE', 'SHOP_NOW', 'WATCH_MORE', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW', 'ORDER_NOW', ...base];
    case 'OUTCOME_ENGAGEMENT':
      return ['LEARN_MORE', 'MESSAGE_PAGE', 'CONTACT_US', 'WATCH_MORE', 'SHOP_NOW', 'LIKE_PAGE', 'FOLLOW_PAGE', ...base];
    case 'OUTCOME_LEADS':
      return ['SIGN_UP', 'APPLY_NOW', 'GET_QUOTE', 'SUBSCRIBE', 'LEARN_MORE', 'CONTACT_US', 'DOWNLOAD', 'BOOK_NOW', ...base];
    case 'OUTCOME_APP_PROMOTION':
      return ['DOWNLOAD', 'INSTALL_APP', 'USE_APP', 'PLAY_GAME', ...base];
    case 'OUTCOME_SALES':
      return ['SHOP_NOW', 'ORDER_NOW', 'GET_OFFER', 'LEARN_MORE', 'BOOK_NOW', 'SUBSCRIBE', 'GET_QUOTE', ...base];
    default:
      return ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW', 'APPLY_NOW', 'SUBSCRIBE', 'WATCH_MORE', 'GET_OFFER', 'ORDER_NOW', 'CALL_NOW', 'MESSAGE_PAGE', ...base];
  }
}

// ── Platform / Placement structure — UPDATED ─────────────────────────────────
export const PLATFORM_PLACEMENTS: Record<string, { key: string; label: string }[]> = {
  facebook: [
    { key: 'facebook_feed',              label: 'Feed' },
    { key: 'facebook_profile_feed',      label: 'Profile Feed' },
    { key: 'facebook_stories',           label: 'Stories' },
    { key: 'facebook_reels',             label: 'Reels' },
    { key: 'facebook_reels_overlay',     label: 'Reels Overlay' },
    { key: 'facebook_right_column',      label: 'Right Column' },
    { key: 'facebook_marketplace',       label: 'Marketplace' },
    { key: 'facebook_search',            label: 'Search' },
    { key: 'facebook_business_explore',  label: 'Business Explore' },
    { key: 'facebook_notifications',     label: 'Notifications' },
    { key: 'facebook_instream_reels',    label: 'In-Stream Reels' },
  ],
  instagram: [
    { key: 'instagram_stream',           label: 'Feed' },
    { key: 'instagram_stories',          label: 'Stories' },
    { key: 'instagram_reels',            label: 'Reels' },
    { key: 'instagram_explore_home',     label: 'Explore Home' },
    { key: 'instagram_profile_feed',     label: 'Profile Feed' },
    { key: 'instagram_search',           label: 'Search' },
  ],
  threads: [
    { key: 'threads_feed',               label: 'Feed' },
  ],
  messenger: [
    { key: 'messenger_stories',          label: 'Stories' },
  ],
  audience_network: [
    { key: 'audience_network_native',    label: 'Native' },
    { key: 'audience_network_banner',    label: 'Banner' },
  ],
};

// ── Factories ─────────────────────────────────────────────────────────────────
export function newCampaign(overrides: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: genId(),
    name: '',
    objective: 'OUTCOME_TRAFFIC',
    specialAdCategory: 'NONE',
    spendCap: '',
    cbo: false,
    status: 'ACTIVE',
    campaignId: '',
    ...overrides,
  };
}

export function newAdSet(overrides: Partial<AdSetRow> = {}): AdSetRow {
  return {
    id: genId(),
    status: 'PAUSED',
    campaignName: '',
    name: '',
    budgetType: 'LIFETIME',
    budget: '',
    startDate: defaultStartDate(),
    startTime: '08:00',
    endDate: defaultEndDate(),
    endTime: '20:00',
    optimizationGoal: 'LANDING_PAGE_VIEWS',
    billingEvent: 'IMPRESSIONS',
    conversionLocation: 'WEBSITE',
    conversionEvent: '',
    placementType: 'manual',   // NO default — user must select
    platforms: [],
    placements: [],
    geoLocations: '',
    geoLocationObjects: [],
    ageMin: '18',
    ageMax: '65',
    genders: 'all',
    detailedInterests: '',
    detailedInterestObjects: [],
    narrowInterests: '',
    narrowInterestObjects: [],
    targetedAudiences: '',
    excludedAudiences: '',
    attributionWindow: '7d_click_1d_engaged_1d_view',
    adSetId: '',
    campaignId: '',
    ...overrides,
  };
}

export function newCreative(overrides: Partial<CreativeRow> = {}): CreativeRow {
  return {
    id: genId(),
    creativeId: '',
    adType: 'static',
    placementDimensions: [],
    concept: '',
    assetLength: '',
    placementAssets: [],
    primaryTexts: [''],
    headlines: [''],
    descriptions: [''],
    cta: 'LEARN_MORE',
    websiteUrl: '',
    urlParams: '',
    displayUrl: '',
    postId: '',
    pixelId: '',
    carouselCards: [],
    placementCustomized: false,
    ...overrides,
  };
}

export function newCarouselCard(cardNumber: number): CarouselCard {
  return {
    id: genId(),
    cardNumber,
    fileName: '',
    fileHash: '',
    headline: '',
    description: '',
    url: '',
  };
}

export function newAdRow(overrides: Partial<AdRow> = {}): AdRow {
  return {
    id: genId(),
    status: 'PAUSED',
    adName: '',
    adSetName: '',
    campaignName: '',
    adId: '',
    adSetId: '',
    campaignId: '',
    metaCreativeId: '',
    sourcePostId: '',
    creativeId: '',
    creativeConcept: '',
    creativeType: '',
    creativeLength: '',
    launchDate: currentLaunchDate(),
    previewLink: '',
    needsUpdate: false,
    ...overrides,
  };
}

export function newLeadGenForm(overrides: Partial<LeadGenForm> = {}): LeadGenForm {
  return {
    id: genId(),
    name: '',
    formType: 'MORE_VOLUME',
    privacyPolicyUrl: '',
    privacyPolicyLinkText: 'Privacy Policy',
    pages: [
      { id: genId(), type: 'INTRO', headline: '', description: '' },
      { id: genId(), type: 'QUESTIONS', headline: '', description: '' },
      { id: genId(), type: 'CONFIRMATION', headline: 'Thank you!', description: '' },
    ],
    fields: [
      { id: genId(), type: 'FULL_NAME', label: 'Full Name', required: true },
      { id: genId(), type: 'EMAIL', label: 'Email', required: true },
    ],
    thankYouHeadline: 'Thank you!',
    thankYouDescription: '',
    thankYouCta: 'LEARN_MORE',
    thankYouCtaUrl: '',
    formId: '',
    ...overrides,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: 'OUTCOME_AWARENESS',    label: 'Awareness' },
  { value: 'OUTCOME_TRAFFIC',      label: 'Traffic' },
  { value: 'OUTCOME_ENGAGEMENT',   label: 'Engagement' },
  { value: 'OUTCOME_LEADS',        label: 'Leads' },
  { value: 'OUTCOME_APP_PROMOTION',label: 'App Promotion' },
  { value: 'OUTCOME_SALES',        label: 'Sales' },
];

export const OPTIMIZATION_GOAL_LABELS: Record<OptimizationGoal, string> = {
  REACH:                              'Reach',
  IMPRESSIONS:                        'Impressions',
  LINK_CLICKS:                        'Link Clicks',
  LANDING_PAGE_VIEWS:                 'Landing Page Views',
  LEAD_GENERATION:                    'Lead Generation',
  QUALITY_LEAD:                       'Quality Lead',
  OFFSITE_CONVERSIONS:                'Conversions',
  VALUE:                              'Value',
  APP_INSTALLS:                       'App Installs',
  THRUPLAY:                           'ThruPlay',
  VIDEO_VIEWS:                        'Video Views',
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS:  '2-Sec Continuous Video Views',
  POST_ENGAGEMENT:                    'Post Engagement',
  PAGE_LIKES:                         'Page Likes',
  PAGE_VISITS:                        'Page/Profile Visits',
  AD_RECALL_LIFT:                     'Ad Recall Lift',
};

export const OPTIMIZATION_GOAL_KPI: Record<OptimizationGoal, string> = {
  REACH:                              'CPM / Reach',
  IMPRESSIONS:                        'CPM',
  LINK_CLICKS:                        'CPC',
  LANDING_PAGE_VIEWS:                 'Cost per LPV',
  LEAD_GENERATION:                    'Cost per Lead',
  QUALITY_LEAD:                       'Cost per Quality Lead',
  OFFSITE_CONVERSIONS:                'Cost per Conversion',
  VALUE:                              'ROAS',
  APP_INSTALLS:                       'Cost per Install',
  THRUPLAY:                           'Cost per ThruPlay',
  VIDEO_VIEWS:                        'Cost per Video View',
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS:  'Cost per 2-Sec View',
  POST_ENGAGEMENT:                    'Cost per Post Engagement',
  PAGE_LIKES:                         'Cost per Like/Follow',
  PAGE_VISITS:                        'Cost per Page/Profile Visit',
  AD_RECALL_LIFT:                     'Cost per Ad Recall Lift',
};

export const CTA_OPTIONS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'GET_QUOTE',
  'CONTACT_US', 'BOOK_NOW', 'APPLY_NOW', 'SUBSCRIBE', 'WATCH_MORE',
  'GET_OFFER', 'ORDER_NOW', 'CALL_NOW', 'MESSAGE_PAGE', 'INSTALL_APP',
  'USE_APP', 'PLAY_GAME', 'LIKE_PAGE', 'FOLLOW_PAGE', 'NO_BUTTON',
];

export const SPECIAL_AD_CATEGORIES: SpecialAdCategory[] = ['NONE', 'HOUSING', 'EMPLOYMENT', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS'];

export const CONVERSION_LOCATIONS: { value: ConversionLocation; label: string; objectives?: Objective[] }[] = [
  { value: 'WEBSITE',           label: 'Website' },
  { value: 'APP',               label: 'App' },
  { value: 'MESSENGER',         label: 'Messenger' },
  { value: 'INSTAGRAM_PROFILE', label: 'Instagram Profile' },
  { value: 'FACEBOOK_PAGE',     label: 'Facebook Page' },
  { value: 'PHONE_CALL',        label: 'Phone Call' },
  { value: 'ON_AD',             label: 'On Your Ad',              objectives: ['OUTCOME_ENGAGEMENT'] },
  { value: 'IG_FB_COMBINED',    label: 'Instagram or Facebook',   objectives: ['OUTCOME_ENGAGEMENT'] },
];

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese/Mandarin' },
  { value: 'ru', label: 'Russian' },
  { value: 'it', label: 'Italian' },
];

export const TREE_FIELDS: { key: keyof AdSetRow; label: string; description: string }[] = [
  { key: 'language',         label: 'Language',           description: 'Target by language' },
  { key: 'operatingSystem',  label: 'Operating System',   description: 'Android only or iOS only' },
  { key: 'devicePlatforms',  label: 'Device Type',        description: 'Mobile, Desktop, or All' },
  { key: 'frequencyControl', label: 'Frequency Control',  description: 'Awareness/Reach opt goals' },
  { key: 'adScheduling',     label: 'Day Parting',        description: 'Day-parting schedule' },
  { key: 'attributionWindow',label: 'Attribution Window', description: 'Click/view attribution' },
  { key: 'attributionModel', label: 'Attribution Model',  description: 'Standard or Incremental (conversions only)' },
  { key: 'bidStrategy',      label: 'Bid Strategy',       description: 'Override default Highest Volume bidding' },
];

export const SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// All 24 hours — labels shown at 3-hour markers only
export const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i);
export const SCHEDULE_HOUR_LABELS: Record<number, string> = {
  0: '12am', 3: '3am', 6: '6am', 9: '9am', 12: '12pm', 15: '3pm', 18: '6pm', 21: '9pm',
};

