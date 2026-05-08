/**
 * PillarHubAdmin — Alternate "Pillar Hub" view for the Admin Campaign Builder.
 * A dashboard of the 5 campaign-build pillars with health stats.
 * Click into one to drill down into a focused single-item editor.
 * Most novice-friendly: never see all columns at once.
 *
 * Reads from / writes to the same CampaignBuilderState as the spreadsheet view.
 * Scoped entirely within the admin builder — no global CSS pollution.
 */
import { useState, useCallback } from "react";
import {
  CampaignBuilderState,
  AdSetRow,
  CampaignRow,
  CreativeRow,
  BuildSettings,
  conversionEventApplicable,
  OPTIMIZATION_GOAL_LABELS,
  PLATFORM_PLACEMENTS,
} from "./campaignStoreAdmin";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Layers,
  Image,
  Rocket,
  Users,
  MapPin,
  Calendar,
  DollarSign,
  Target,
  Check,
  Monitor,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TargetingPopup, AudienceFocus } from "./TargetingPopupAdmin";

// ── Types ─────────────────────────────────────────────────────────────────────
type PillarKey = "campaigns" | "adsets" | "creatives" | "ads" | "launch";

export interface TweakSettings {
  density: "compact" | "comfortable";
  friendly: boolean;
  advanced: boolean;
  dark: boolean;
}

interface PillarHubAdminProps {
  state: CampaignBuilderState;
  tweaks: TweakSettings;
  onStateChange: (key: keyof CampaignBuilderState, val: CampaignBuilderState[keyof CampaignBuilderState]) => void;
  onGoToExport: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function adSetIssues(row: AdSetRow): string[] {
  const issues: string[] = [];
  if (!row.name) issues.push("Missing name");
  if (!row.budget) issues.push("Missing budget");
  if (!row.geoLocations) issues.push("No locations set");
  return issues;
}

function campaignIssues(row: CampaignRow): string[] {
  const issues: string[] = [];
  if (!row.name) issues.push("Missing name");
  return issues;
}

// ── Root component ────────────────────────────────────────────────────────────
export default function PillarHubAdmin({
  state,
  tweaks,
  onStateChange,
  onGoToExport,
}: PillarHubAdminProps) {
  const [pillar, setPillar] = useState<PillarKey>("adsets");
  const [focusAdSetId, setFocusAdSetId] = useState<string>(
    state.adSets[0]?.id ?? ""
  );
  const [focusCampaignId, setFocusCampaignId] = useState<string>(
    state.campaigns[0]?.id ?? ""
  );

  const containerClass = [
    "ph-root",
    tweaks.dark ? "ph-dark" : "",
    tweaks.density === "compact" ? "ph-compact" : "",
    tweaks.friendly ? "ph-friendly" : "",
    tweaks.advanced ? "ph-advanced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Pillar health stats
  const campaignCount = state.campaigns.filter((c) => c.name).length;
  const adSetCount = state.adSets.filter((a) => a.name).length;
  const creativeCount =
    state.creatives.filter((c) => c.concept).length +
    state.carouselCreatives.length;
  const adCount = state.ads.filter((a) => a.adName).length;

  const campaignErrors = state.campaigns.filter(
    (c) => campaignIssues(c).length > 0
  ).length;
  const adSetErrors = state.adSets.filter(
    (a) => adSetIssues(a).length > 0
  ).length;

  const pillars: {
    key: PillarKey;
    n: number;
    title: string;
    friendlyTitle: string;
    sub: string;
    stat: string;
    lbl: string;
    progress: number;
    done: boolean;
    issues: number;
  }[] = [
    {
      key: "campaigns",
      n: 1,
      title: "Campaigns",
      friendlyTitle: "Campaigns",
      sub: "Top-level goals",
      stat: String(campaignCount),
      lbl: `campaign${campaignCount !== 1 ? "s" : ""}`,
      progress: campaignCount > 0 && campaignErrors === 0 ? 1.0 : campaignCount > 0 ? 0.5 : 0,
      done: campaignCount > 0 && campaignErrors === 0,
      issues: campaignErrors,
    },
    {
      key: "adsets",
      n: 2,
      title: "Ad Sets",
      friendlyTitle: "Audiences & Schedule",
      sub: "Audiences & schedule",
      stat: String(adSetCount),
      lbl: `of ${state.adSets.length} ready`,
      progress: state.adSets.length > 0 ? adSetCount / Math.max(state.adSets.length, 1) : 0,
      done: adSetCount > 0 && adSetErrors === 0 && state.adSets.length > 0,
      issues: adSetErrors,
    },
    {
      key: "creatives",
      n: 3,
      title: "Creative Library",
      friendlyTitle: "Creative Library",
      sub: "Build once, reuse",
      stat: String(creativeCount),
      lbl: `creative${creativeCount !== 1 ? "s" : ""}`,
      progress: creativeCount > 0 ? 1.0 : 0,
      done: creativeCount > 0,
      issues: 0,
    },
    {
      key: "ads",
      n: 4,
      title: "Ads",
      friendlyTitle: "Ads",
      sub: "Map creative to ad set",
      stat: String(adCount),
      lbl: `of ${state.ads.length} mapped`,
      progress: state.ads.length > 0 ? adCount / Math.max(state.ads.length, 1) : 0,
      done: adCount > 0 && adCount === state.ads.length,
      issues: 0,
    },
    {
      key: "launch",
      n: 5,
      title: "Launch",
      friendlyTitle: "Launch",
      sub: "Final review & push",
      stat: "—",
      lbl: "not ready",
      progress: 0,
      done: false,
      issues: 0,
    },
  ];

  return (
    <div className={containerClass} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Inject scoped styles */}
      <style>{PH_STYLES}</style>

      {/* Pillar strip */}
      <PillarStrip pillars={pillars} active={pillar} onSelect={setPillar} />

      {/* Content area */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {pillar === "campaigns" && (
          <PillarCampaigns
            campaigns={state.campaigns}
            focusId={focusCampaignId}
            onFocus={setFocusCampaignId}
            onChange={(rows) => onStateChange("campaigns", rows)}
          />
        )}
        {pillar === "adsets" && (
          <PillarAdSets
            adSets={state.adSets}
            campaigns={state.campaigns}
            settings={state.settings}
            focusId={focusAdSetId}
            onFocus={setFocusAdSetId}
            onChange={(rows) => onStateChange("adSets", rows)}
          />
        )}
        {pillar === "creatives" && (
          <PillarCreatives
            creatives={state.creatives}
            carouselCreatives={state.carouselCreatives}
          />
        )}
        {pillar === "ads" && (
          <PillarAds
            ads={state.ads}
            adSets={state.adSets}
            creatives={[...state.creatives, ...state.carouselCreatives]}
          />
        )}
        {pillar === "launch" && (
          <PillarLaunch
            state={state}
            onGoToExport={onGoToExport}
          />
        )}
      </div>
    </div>
  );
}

// ── Pillar strip ──────────────────────────────────────────────────────────────
function PillarStrip({
  pillars,
  active,
  onSelect,
}: {
  pillars: ReturnType<typeof buildPillars>;
  active: PillarKey;
  onSelect: (k: PillarKey) => void;
}) {
  return (
    <div className="ph-strip">
      {pillars.map((p) => (
        <button
          key={p.key}
          className={`ph-pillar ${active === p.key ? "ph-pillar--on" : ""} ${p.done ? "ph-pillar--done" : ""}`}
          onClick={() => onSelect(p.key)}
        >
          <div className="ph-pillar-top">
            <div className="ph-pillar-num">
              {p.done ? <CheckCircle2 size={14} /> : p.n}
            </div>
            <div className="ph-pillar-info">
              <div className="ph-pillar-title">{p.title}</div>
              <div className="ph-pillar-sub">{p.sub}</div>
            </div>
          </div>
          <div className="ph-pillar-stat">
            <span className="ph-stat-n">{p.stat}</span>
            <span className="ph-stat-l">{p.lbl}</span>
          </div>
          <div className="ph-pillar-bar">
            <div
              className="ph-pillar-fill"
              style={{
                width: `${p.progress * 100}%`,
                background: p.done ? "var(--pl-green)" : "var(--pl-pink)",
              }}
            />
          </div>
          <div className="ph-pillar-issues">
            {p.issues > 0 ? (
              <>
                <AlertTriangle size={11} style={{ color: "var(--pl-pink)" }} />
                <span style={{ color: "var(--pl-pink)", fontWeight: 600 }}>
                  {p.issues} issue{p.issues !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={11} style={{ color: "var(--pl-green)" }} />
                <span style={{ color: "var(--pl-green)" }}>All clear</span>
              </>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// helper to satisfy TS
type PillarDef = {
  key: PillarKey;
  n: number;
  title: string;
  friendlyTitle: string;
  sub: string;
  stat: string;
  lbl: string;
  progress: number;
  done: boolean;
  issues: number;
};
function buildPillars(_: unknown): PillarDef[] { return []; }

// ── Campaigns pillar ──────────────────────────────────────────────────────────
function PillarCampaigns({
  campaigns,
  focusId,
  onFocus,
  onChange,
}: {
  campaigns: CampaignRow[];
  focusId: string;
  onFocus: (id: string) => void;
  onChange: (rows: CampaignRow[]) => void;
}) {
  const focused = campaigns.find((c) => c.id === focusId) ?? campaigns[0];
  const idx = campaigns.findIndex((c) => c.id === focused?.id);

  const updateFocused = useCallback(
    (patch: Partial<CampaignRow>) => {
      onChange(campaigns.map((c) => (c.id === focused?.id ? { ...c, ...patch } : c)));
    },
    [campaigns, focused, onChange]
  );

  return (
    <div className="ph-split">
      {/* List */}
      <div className="ph-list">
        <div className="ph-list-head">
          <span className="ph-list-label">{campaigns.length} Campaigns</span>
        </div>
        {campaigns.map((c) => {
          const errs = campaignIssues(c);
          return (
            <button
              key={c.id}
              className={`ph-list-card ${c.id === focusId ? "ph-list-card--on" : ""} ${errs.length ? "ph-list-card--err" : ""}`}
              onClick={() => onFocus(c.id)}
            >
              <div className="ph-list-card-name">{c.name || "Untitled campaign"}</div>
              <div className="ph-list-card-meta">{c.objective?.replace("OUTCOME_", "")}</div>
              {errs.length > 0 ? (
                <span className="ph-badge ph-badge--err">{errs.length}</span>
              ) : (
                <CheckCircle2 size={13} style={{ color: "var(--pl-green)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {focused && (
        <div className="ph-editor">
          <div className="ph-editor-head">
            <div>
              <div className="ph-breadcrumb">
                Campaigns <ChevronRight size={10} /> <b>{focused.name || "Untitled"}</b>
              </div>
              <h2 className="ph-editor-title">{focused.name || "Untitled campaign"}</h2>
            </div>
            <div className="ph-nav-btns">
              <button
                className="ph-btn ph-btn--sm"
                disabled={idx === 0}
                onClick={() => onFocus(campaigns[Math.max(0, idx - 1)].id)}
              >
                <ChevronLeft size={10} /> Prev
              </button>
              <span className="ph-nav-count">{idx + 1} of {campaigns.length}</span>
              <button
                className="ph-btn ph-btn--sm"
                disabled={idx === campaigns.length - 1}
                onClick={() => onFocus(campaigns[Math.min(campaigns.length - 1, idx + 1)].id)}
              >
                Next <ChevronRight size={10} />
              </button>
            </div>
          </div>

          <div className="ph-form">
            <div className="ph-fld-group">
              <div className="ph-fld-group-head">
                <Rocket size={12} style={{ color: "var(--pl-pink)" }} />
                <h4>Campaign Details</h4>
              </div>
              <div className="ph-fld-group-body">
                <div className="ph-fld">
                  <label className="ph-lbl">Campaign Name</label>
                  <input
                    className="ph-input"
                    value={focused.name}
                    onChange={(e) => updateFocused({ name: e.target.value })}
                    placeholder="e.g. Spring 2026 - Conversions"
                  />
                </div>
                <div className="ph-fld-row">
                  <div className="ph-fld">
                    <label className="ph-lbl">Objective</label>
                    <select
                      className="ph-input"
                      value={focused.objective}
                      onChange={(e) => updateFocused({ objective: e.target.value as CampaignRow["objective"] })}
                    >
                      {["OUTCOME_AWARENESS","OUTCOME_TRAFFIC","OUTCOME_ENGAGEMENT","OUTCOME_LEADS","OUTCOME_APP_PROMOTION","OUTCOME_SALES"].map((o) => (
                        <option key={o} value={o}>{o.replace("OUTCOME_", "")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ph-fld">
                    <label className="ph-lbl">Status</label>
                    <div className="ph-seg">
                      {(["PAUSED", "ACTIVE"] as const).map((s) => (
                        <button
                          key={s}
                          className={focused.status === s ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                          onClick={() => updateFocused({ status: s })}
                        >
                          {s === "PAUSED" ? "Paused" : "Active"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="ph-fld-row">
                  <div className="ph-fld">
                    <label className="ph-lbl">Spend Cap</label>
                    <input
                      className="ph-input"
                      value={focused.spendCap}
                      onChange={(e) => updateFocused({ spendCap: e.target.value })}
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div className="ph-fld">
                    <label className="ph-lbl">Special Ad Category</label>
                    <select
                      className="ph-input"
                      value={focused.specialAdCategory}
                      onChange={(e) => updateFocused({ specialAdCategory: e.target.value as CampaignRow["specialAdCategory"] })}
                    >
                      {["NONE","HOUSING","EMPLOYMENT","CREDIT","ISSUES_ELECTIONS_POLITICS"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ad Sets pillar ────────────────────────────────────────────────────────────
function PillarAdSets({
  adSets,
  campaigns,
  settings,
  focusId,
  onFocus,
  onChange,
}: {
  adSets: AdSetRow[];
  campaigns: CampaignRow[];
  settings: BuildSettings;
  focusId: string;
  onFocus: (id: string) => void;
  onChange: (rows: AdSetRow[]) => void;
}) {
  const [step, setStep] = useState(1);
  const focused = adSets.find((a) => a.id === focusId) ?? adSets[0];
  const idx = adSets.findIndex((a) => a.id === focused?.id);
  const hasCredentials = !!(settings?.accessToken && settings?.adAccountId);
  const hasPixel = !!(settings?.pixelId && hasCredentials);

  // ── Search state (mirrors AdSetsTableAdmin) ──────────────────────────────
  const [audienceFocus, setAudienceFocus] = useState<AudienceFocus>('location');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationRowId, setLocationRowId] = useState<string | null>(null);
  const [detailedQuery, setDetailedQuery] = useState('');
  const [detailedRowId, setDetailedRowId] = useState<string | null>(null);
  const [detailedType, setDetailedType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const [narrowQuery, setNarrowQuery] = useState('');
  const [narrowRowId, setNarrowRowId] = useState<string | null>(null);
  const [narrowType, setNarrowType] = useState<'adinterest' | 'behaviors' | 'demographics'>('adinterest');
  const [audienceSearch, setAudienceSearch] = useState('');

  // ── Bulk paste state ──────────────────────────────────────────────────────
  const [bulkLocModal, setBulkLocModal] = useState<{ rowId: string } | null>(null);
  const [bulkLocText, setBulkLocText] = useState('');
  const [bulkLocType, setBulkLocType] = useState<'city' | 'region' | 'country' | 'zip'>('city');
  const [bulkLocMatching, setBulkLocMatching] = useState(false);

  // ── tRPC queries (mirrors AdSetsTableAdmin) ──────────────────────────────
  const utils = trpc.useUtils();
  const { data: locationResults, isFetching: searchingLocations } = trpc.adminMeta.searchGeoLocations.useQuery(
    { accessToken: settings?.accessToken ?? '', query: locationQuery, location_types: ['city', 'region', 'country', 'zip'] },
    { enabled: hasCredentials && locationQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const { data: detailedResults, isFetching: searchingDetailed } = trpc.adminMeta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: detailedQuery, type: detailedType },
    { enabled: hasCredentials && detailedQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const { data: narrowResults, isFetching: searchingNarrow } = trpc.adminMeta.searchTargeting.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', query: narrowQuery, type: narrowType },
    { enabled: hasCredentials && narrowQuery.length >= 2, staleTime: 60 * 1000 }
  );
  const { data: customAudiencesData, isLoading: loadingAudiences } = trpc.adminMeta.getCustomAudiences.useQuery(
    { accessToken: settings?.accessToken ?? '', adAccountId: settings?.adAccountId ?? '', search: audienceSearch || undefined },
    { enabled: hasCredentials && audienceSearch.trim().length > 0, staleTime: 2 * 60 * 1000 }
  );
  const { data: pixelEventsData } = trpc.adminMeta.getPixelEvents.useQuery(
    { accessToken: settings?.accessToken ?? '', pixelId: settings?.pixelId ?? '', adAccountId: settings?.adAccountId ?? '' },
    { enabled: hasPixel, staleTime: 5 * 60 * 1000 }
  );
  const customAudiences = customAudiencesData?.audiences ?? [];
  const pixelEvents = pixelEventsData?.events ?? [];

  const updateFocused = useCallback(
    (patch: Partial<AdSetRow>) => {
      onChange(adSets.map((a) => (a.id === focused?.id ? { ...a, ...patch } : a)));
    },
    [adSets, focused, onChange]
  );
  // Generic update by id (required by TargetingPopup)
  const updateById = useCallback(
    (id: string, patch: Partial<AdSetRow>) => {
      onChange(adSets.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [adSets, onChange]
  );

  // Steps: Locations | Audience | Delivery | Platform
  const STEPS = ["Locations", "Audience", "Delivery", "Platform"];

  // Conversion event applicable goals
  const showConvEvent = focused
    ? (focused.optimizationGoal === 'CONVERSIONS' || focused.optimizationGoal === 'VALUE' || focused.optimizationGoal === 'QUALITY_LEAD')
    : false;

  // Platform/placement helpers
  const COMBINED_PLATFORMS = ['facebook', 'instagram', 'threads', 'messenger', 'audience_network'];
  // Combined placement groups: Feed, Stories, Reels are merged across FB+IG
  const COMBINED_PLACEMENTS: { key: string; label: string; platforms: string[] }[] = [
    { key: 'feed',        label: 'Feed',            platforms: ['facebook', 'instagram'] },
    { key: 'stories',     label: 'Stories',          platforms: ['facebook', 'instagram', 'messenger'] },
    { key: 'reels',       label: 'Reels',            platforms: ['facebook', 'instagram'] },
    { key: 'profile_feed',label: 'Profile Feed',     platforms: ['facebook', 'instagram'] },
    { key: 'reels_overlay',label: 'Reels Overlay',   platforms: ['facebook'] },
    { key: 'right_column',label: 'Right Column',     platforms: ['facebook'] },
    { key: 'marketplace', label: 'Marketplace',      platforms: ['facebook'] },
    { key: 'search',      label: 'Search',           platforms: ['facebook', 'instagram'] },
    { key: 'business_explore', label: 'Business Explore', platforms: ['facebook'] },
    { key: 'notifications', label: 'Notifications',  platforms: ['facebook'] },
    { key: 'instream_reels', label: 'In-Stream Reels', platforms: ['facebook'] },
    { key: 'explore_home',label: 'Explore Home',     platforms: ['instagram'] },
    { key: 'threads_feed',label: 'Threads Feed',     platforms: ['threads'] },
    { key: 'native',      label: 'Native',           platforms: ['audience_network'] },
    { key: 'banner',      label: 'Banner',           platforms: ['audience_network'] },
  ];
  // Map combined key → actual API keys
  const COMBINED_TO_API: Record<string, string[]> = {
    feed:             ['facebook_feed', 'instagram_stream'],
    stories:          ['facebook_stories', 'instagram_stories', 'messenger_stories'],
    reels:            ['facebook_reels', 'instagram_reels'],
    profile_feed:     ['facebook_profile_feed', 'instagram_profile_feed'],
    reels_overlay:    ['facebook_reels_overlay'],
    right_column:     ['facebook_right_column'],
    marketplace:      ['facebook_marketplace'],
    search:           ['facebook_search', 'instagram_search'],
    business_explore: ['facebook_business_explore'],
    notifications:    ['facebook_notifications'],
    instream_reels:   ['facebook_instream_reels'],
    explore_home:     ['instagram_explore_home'],
    threads_feed:     ['threads_feed'],
    native:           ['audience_network_native'],
    banner:           ['audience_network_banner'],
  };
  // Check if a combined placement is "selected" (any of its API keys are in placements)
  const isCombinedSelected = (combinedKey: string) => {
    const apiKeys = COMBINED_TO_API[combinedKey] ?? [];
    return apiKeys.some(k => (focused?.placements ?? []).includes(k));
  };
  // Toggle a combined placement
  const toggleCombinedPlacement = (combinedKey: string) => {
    if (!focused) return;
    const apiKeys = COMBINED_TO_API[combinedKey] ?? [];
    const currentlySelected = isCombinedSelected(combinedKey);
    let next: string[];
    if (currentlySelected) {
      // Remove all API keys for this combined placement
      next = focused.placements.filter(p => !apiKeys.includes(p));
    } else {
      // Add only the API keys that match selected platforms
      const toAdd = apiKeys.filter(k =>
        focused.platforms.some(pl => k.startsWith(pl === 'audience_network' ? 'audience_network' : pl))
      );
      next = [...focused.placements, ...toAdd.filter(k => !focused.placements.includes(k))];
    }
    updateFocused({ placements: next });
  };
  // Toggle platform
  const togglePlatform = (p: string) => {
    if (!focused) return;
    const next = focused.platforms.includes(p)
      ? focused.platforms.filter(x => x !== p)
      : [...focused.platforms, p];
    // Remove placements for deselected platform
    const nextPlacements = focused.placements.filter(pl => next.some(np =>
      np === 'audience_network' ? pl.startsWith('audience_network') : pl.startsWith(np)
    ));
    updateFocused({ platforms: next, placements: nextPlacements });
  };

  return (
    <div className="ph-split">
      {/* List */}
      <div className="ph-list">
        <div className="ph-list-head">
          <span className="ph-list-label">{adSets.length} Ad Sets</span>
        </div>
        {adSets.map((a) => {
          const errs = adSetIssues(a);
          return (
            <button
              key={a.id}
              className={`ph-list-card ${a.id === focusId ? "ph-list-card--on" : ""} ${errs.length ? "ph-list-card--err" : ""}`}
              onClick={() => { onFocus(a.id); setStep(1); }}
            >
              <div className="ph-list-card-name">{a.name || "Untitled ad set"}</div>
              <div className="ph-list-card-meta">in {a.campaignName || "—"}</div>
              <div className="ph-list-card-budget">
                {a.budget ? `$${a.budget}` : "—"}
                {errs.length > 0 ? (
                  <span className="ph-badge ph-badge--err">{errs.length}</span>
                ) : (
                  <CheckCircle2 size={12} style={{ color: "var(--pl-green)" }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
      {/* Editor */}
      {focused && (
        <div className="ph-editor">
          <div className="ph-editor-head">
            <div>
              <div className="ph-breadcrumb">
                Ad Sets <ChevronRight size={10} /> <b>{focused.name || "Untitled"}</b>
              </div>
              <h2 className="ph-editor-title">{focused.name || "Untitled ad set"}</h2>
            </div>
            <div className="ph-nav-btns">
              <button
                className="ph-btn ph-btn--sm"
                disabled={idx === 0}
                onClick={() => { onFocus(adSets[Math.max(0, idx - 1)].id); setStep(1); }}
              >
                <ChevronLeft size={10} /> Prev
              </button>
              <span className="ph-nav-count">{idx + 1} of {adSets.length}</span>
              <button
                className="ph-btn ph-btn--sm"
                disabled={idx === adSets.length - 1}
                onClick={() => { onFocus(adSets[Math.min(adSets.length - 1, idx + 1)].id); setStep(1); }}
              >
                Next <ChevronRight size={10} />
              </button>
            </div>
          </div>
          {/* Step progress */}
          <div className="ph-mini-steps">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`ph-mini-step ${i + 1 < step ? "ph-mini-step--done" : ""} ${i + 1 === step ? "ph-mini-step--on" : ""}`}
              />
            ))}
          </div>
          <div className="ph-step-header">
            <div>
              <div className="ph-step-eyebrow">Step {step} of {STEPS.length}</div>
              <h3 className="ph-step-title">{STEPS[step - 1]}</h3>
            </div>
            <div className="ph-seg">
              {STEPS.map((l, i) => (
                <button
                  key={l}
                  className={i + 1 === step ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                  onClick={() => setStep(i + 1)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="ph-form">
            {/* ── STEP 1: Locations ── */}
            {step === 1 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <MapPin size={12} style={{ color: "var(--pl-cyan)" }} />
                  <h4>Where do they live?</h4>
                </div>
                <div className="ph-fld-group-body">
                  {focused && (
                    <TargetingPopup
                      inline
                      tmRow={focused}
                      audienceFocus="location"
                      setAudienceFocus={setAudienceFocus}
                      hasCredentials={hasCredentials}
                      locationQuery={locationQuery}
                      locationRowId={locationRowId}
                      setLocationQuery={setLocationQuery}
                      setLocationRowId={setLocationRowId}
                      locationResults={locationResults}
                      searchingLocations={searchingLocations}
                      detailedQuery={detailedQuery}
                      detailedRowId={detailedRowId}
                      setDetailedQuery={setDetailedQuery}
                      setDetailedRowId={setDetailedRowId}
                      detailedType={detailedType}
                      setDetailedType={setDetailedType}
                      detailedResults={detailedResults}
                      searchingDetailed={searchingDetailed}
                      narrowQuery={narrowQuery}
                      narrowRowId={narrowRowId}
                      setNarrowQuery={setNarrowQuery}
                      setNarrowRowId={setNarrowRowId}
                      narrowType={narrowType}
                      setNarrowType={setNarrowType}
                      narrowResults={narrowResults}
                      searchingNarrow={searchingNarrow}
                      audienceSearch={audienceSearch}
                      setAudienceSearch={setAudienceSearch}
                      customAudiences={customAudiences}
                      loadingAudiences={loadingAudiences}
                      update={updateById}
                      onClose={() => {/* inline — no close needed */}}
                      setBulkLocModal={setBulkLocModal}
                      setBulkLocText={setBulkLocText}
                    />
                  )}
                </div>
              </div>
            )}
            {/* ── STEP 2: Audience ── */}
            {step === 2 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <Users size={12} style={{ color: "var(--pl-cyan)" }} />
                  <h4>Who are they?</h4>
                </div>
                <div className="ph-fld-group-body">
                  {/* Targeting summary chips */}
                  <div className="ph-fld" style={{ marginBottom: 8 }}>
                    <label className="ph-lbl">Active Targeting</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {focused.geoLocations?.split('\n').filter(Boolean).map((loc, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(0,190,239,0.1)', border: '1px solid rgba(0,190,239,0.25)', borderRadius: 999, fontSize: 10, color: '#00BEEF' }}>
                          📍 {loc}
                        </span>
                      ))}
                      {focused.detailedInterests?.split('\n').filter(Boolean).map((i2, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(0,190,239,0.08)', border: '1px solid rgba(0,190,239,0.2)', borderRadius: 999, fontSize: 10, color: '#00BEEF' }}>
                          🎯 {i2}
                        </span>
                      ))}
                      {focused.narrowInterests?.split('\n').filter(Boolean).map((i2, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 999, fontSize: 10, color: '#f59e0b' }}>
                          AND {i2}
                        </span>
                      ))}
                      {focused.targetedAudiences?.split('\n').filter(Boolean).map((a, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(0,190,239,0.08)', border: '1px solid rgba(0,190,239,0.2)', borderRadius: 999, fontSize: 10, color: '#00BEEF' }}>
                          👥 {a}
                        </span>
                      ))}
                      {focused.excludedAudiences?.split('\n').filter(Boolean).map((a, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 999, fontSize: 10, color: '#f87171' }}>
                          ❌ {a}
                        </span>
                      ))}
                      {!focused.geoLocations && !focused.detailedInterests && !focused.targetedAudiences && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No targeting set yet — use the panel below</span>
                      )}
                    </div>
                  </div>
                  {/* Full TargetingPopup — rendered inline (not as a popup) */}
                  {focused && (
                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <TargetingPopup
                        inline
                        tmRow={focused}
                        audienceFocus={audienceFocus}
                        setAudienceFocus={setAudienceFocus}
                        hasCredentials={hasCredentials}
                        locationQuery={locationQuery}
                        locationRowId={locationRowId}
                        setLocationQuery={setLocationQuery}
                        setLocationRowId={setLocationRowId}
                        locationResults={locationResults}
                        searchingLocations={searchingLocations}
                        detailedQuery={detailedQuery}
                        detailedRowId={detailedRowId}
                        setDetailedQuery={setDetailedQuery}
                        setDetailedRowId={setDetailedRowId}
                        detailedType={detailedType}
                        setDetailedType={setDetailedType}
                        detailedResults={detailedResults}
                        searchingDetailed={searchingDetailed}
                        narrowQuery={narrowQuery}
                        narrowRowId={narrowRowId}
                        setNarrowQuery={setNarrowQuery}
                        setNarrowRowId={setNarrowRowId}
                        narrowType={narrowType}
                        setNarrowType={setNarrowType}
                        narrowResults={narrowResults}
                        searchingNarrow={searchingNarrow}
                        audienceSearch={audienceSearch}
                        setAudienceSearch={setAudienceSearch}
                        customAudiences={customAudiences}
                        loadingAudiences={loadingAudiences}
                        update={updateById}
                        onClose={() => {/* inline — no close needed */}}
                        setBulkLocModal={setBulkLocModal}
                        setBulkLocText={setBulkLocText}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* ── STEP 3: Delivery (Schedule + Budget + Optimization) ── */}
            {step === 3 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <Calendar size={12} style={{ color: "var(--pl-cyan)" }} />
                  <h4>Schedule, Budget &amp; Optimization</h4>
                </div>
                <div className="ph-fld-group-body">
                  {/* Datetime pickers */}
                  <div className="ph-fld-row">
                    <div className="ph-fld">
                      <label className="ph-lbl">Start Date &amp; Time</label>
                      <input
                        className="ph-input"
                        type="datetime-local"
                        value={focused.startDate && focused.startTime ? `${focused.startDate}T${focused.startTime}` : focused.startDate ? `${focused.startDate}T08:00` : ''}
                        onChange={(e) => {
                          const [d, t] = e.target.value.split('T');
                          updateFocused({ startDate: d ?? '', startTime: t ?? '08:00' });
                        }}
                      />
                    </div>
                    <div className="ph-fld">
                      <label className="ph-lbl">End Date &amp; Time</label>
                      <input
                        className="ph-input"
                        type="datetime-local"
                        value={focused.endDate && focused.endTime ? `${focused.endDate}T${focused.endTime}` : focused.endDate ? `${focused.endDate}T20:00` : ''}
                        onChange={(e) => {
                          const [d, t] = e.target.value.split('T');
                          updateFocused({ endDate: d ?? '', endTime: t ?? '20:00' });
                        }}
                      />
                    </div>
                  </div>
                  {/* Budget */}
                  <div className="ph-fld-row">
                    <div className="ph-fld">
                      <label className="ph-lbl">Budget Type</label>
                      <div className="ph-seg">
                        {(["DAILY", "LIFETIME"] as const).map((bt) => (
                          <button
                            key={bt}
                            className={focused.budgetType === bt ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                            onClick={() => updateFocused({ budgetType: bt })}
                          >
                            {bt === "DAILY" ? "Daily" : "Lifetime"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="ph-fld">
                      <label className="ph-lbl">Amount ($)</label>
                      <input
                        className="ph-input"
                        value={focused.budget}
                        onChange={(e) => updateFocused({ budget: e.target.value })}
                        placeholder="250"
                      />
                      <div className="ph-help">Meta may spend up to 25% more in a single day.</div>
                    </div>
                  </div>
                  {/* Optimization Goal */}
                  <div className="ph-fld">
                    <label className="ph-lbl">Optimization Goal</label>
                    <select
                      className="ph-input"
                      value={focused.optimizationGoal}
                      onChange={(e) => updateFocused({ optimizationGoal: e.target.value as AdSetRow["optimizationGoal"] })}
                    >
                      {(["REACH","IMPRESSIONS","LINK_CLICKS","LANDING_PAGE_VIEWS","LEAD_GENERATION","QUALITY_LEAD","CONVERSIONS","VALUE","APP_INSTALLS","THRUPLAY","VIDEO_VIEWS","POST_ENGAGEMENT","PAGE_LIKES","PAGE_VISITS","AD_RECALL_LIFT"] as const).map((g) => (
                        <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  {/* Conversion Event — only shown for conversion-type goals */}
                  <div className="ph-fld">
                    <label className="ph-lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Conversion Event
                      {!showConvEvent && (
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontStyle: 'italic' }}>
                          (select Conversions, Value, or Quality Lead to enable)
                        </span>
                      )}
                    </label>
                    {showConvEvent ? (
                      pixelEvents.length > 0 ? (
                        <select
                          className="ph-input"
                          value={focused.conversionEvent}
                          onChange={(e) => updateFocused({ conversionEvent: e.target.value })}
                        >
                          <option value="">Select conversion event…</option>
                          {pixelEvents.map((ev: string) => (
                            <option key={ev} value={ev}>{ev}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="ph-input"
                          value={focused.conversionEvent}
                          onChange={(e) => updateFocused({ conversionEvent: e.target.value })}
                          placeholder={hasPixel ? 'Loading events…' : 'No pixel configured — enter manually'}
                        />
                      )
                    ) : (
                      <input
                        className="ph-input"
                        disabled
                        value=""
                        placeholder="Not applicable for this optimization goal"
                        style={{ opacity: 0.4, cursor: 'not-allowed' }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* ── STEP 4: Platform ── */}
            {step === 4 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <Monitor size={12} style={{ color: "var(--pl-cyan)" }} />
                  <h4>Platform &amp; Placements</h4>
                </div>
                <div className="ph-fld-group-body">
                  {/* Placement type toggle */}
                  <div className="ph-fld">
                    <label className="ph-lbl">Placement Type</label>
                    <div className="ph-seg">
                      {(['advantage_plus', 'manual'] as const).map(t => (
                        <button
                          key={t}
                          className={focused.placementType === t ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                          onClick={() => updateFocused({ placementType: t, placements: t === 'advantage_plus' ? [] : focused.placements })}
                        >
                          {t === 'advantage_plus' ? 'Advantage+' : 'Manual'}
                        </button>
                      ))}
                    </div>
                    {focused.placementType === 'advantage_plus' && (
                      <div className="ph-help">Meta automatically selects the best placements for your goal.</div>
                    )}
                  </div>
                  {focused.placementType === 'manual' && (
                    <>
                      {/* Platform selector */}
                      <div className="ph-fld">
                        <label className="ph-lbl">Platforms</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {Object.keys(PLATFORM_PLACEMENTS).map(p => (
                            <button
                              key={p}
                              className={focused.platforms.includes(p) ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                              onClick={() => {
                                const next = focused.platforms.includes(p)
                                  ? focused.platforms.filter(x => x !== p)
                                  : [...focused.platforms, p];
                                const nextPlacements = focused.placements.filter(pl => next.some(np => pl.startsWith(np)));
                                updateFocused({ platforms: next, placements: nextPlacements });
                              }}
                            >
                              {p === 'audience_network' ? 'Audience Network' : p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Combined placements: Feed, Stories, Reels across selected platforms */}
                      {focused.platforms.length > 0 && (() => {
                        const hasFB = focused.platforms.includes('facebook');
                        const hasIG = focused.platforms.includes('instagram');
                        const hasMSG = focused.platforms.includes('messenger');
                        const hasTH = focused.platforms.includes('threads');
                        const hasAN = focused.platforms.includes('audience_network');
                        const combinedGroups: { label: string; keys: string[] }[] = [];
                        if (hasFB || hasIG) {
                          combinedGroups.push({
                            label: 'Feed',
                            keys: [
                              ...(hasFB ? ['facebook_feed', 'facebook_profile_feed'] : []),
                              ...(hasIG ? ['instagram_stream', 'instagram_profile_feed'] : []),
                            ],
                          });
                          combinedGroups.push({
                            label: 'Stories',
                            keys: [
                              ...(hasFB ? ['facebook_stories'] : []),
                              ...(hasIG ? ['instagram_stories'] : []),
                              ...(hasMSG ? ['messenger_stories'] : []),
                            ],
                          });
                          combinedGroups.push({
                            label: 'Reels',
                            keys: [
                              ...(hasFB ? ['facebook_reels', 'facebook_reels_overlay', 'facebook_instream_reels'] : []),
                              ...(hasIG ? ['instagram_reels'] : []),
                            ],
                          });
                        }
                        if (hasFB) {
                          const fbExtra: [string, string][] = [
                            ['facebook_right_column', 'Right Column'],
                            ['facebook_marketplace', 'Marketplace'],
                            ['facebook_search', 'Search'],
                            ['facebook_business_explore', 'Business Explore'],
                            ['facebook_notifications', 'Notifications'],
                          ];
                          fbExtra.forEach(([key, label]) => combinedGroups.push({ label, keys: [key] }));
                        }
                        if (hasIG) {
                          combinedGroups.push({ label: 'Explore Home', keys: ['instagram_explore_home'] });
                          combinedGroups.push({ label: 'IG Search', keys: ['instagram_search'] });
                        }
                        if (hasTH) combinedGroups.push({ label: 'Threads Feed', keys: ['threads_feed'] });
                        if (hasAN) {
                          combinedGroups.push({ label: 'AN Native', keys: ['audience_network_native'] });
                          combinedGroups.push({ label: 'AN Banner', keys: ['audience_network_banner'] });
                        }
                        return (
                          <div className="ph-fld">
                            <label className="ph-lbl">Placements</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {combinedGroups.map(group => {
                                const isOn = group.keys.some(k => focused.placements.includes(k));
                                return (
                                  <button
                                    key={group.label}
                                    className={isOn ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => {
                                      if (isOn) {
                                        updateFocused({ placements: focused.placements.filter(p => !group.keys.includes(p)) });
                                      } else {
                                        updateFocused({ placements: [...focused.placements, ...group.keys.filter(k => !focused.placements.includes(k))] });
                                      }
                                    }}
                                  >
                                    {isOn && <Check size={9} />}
                                    {group.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="ph-help">
                              {focused.placements.length > 0
                                ? `${focused.placements.length} placement${focused.placements.length !== 1 ? 's' : ''} selected`
                                : 'Select at least one placement'}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            )}
            {/* Step nav */}
            <div className="ph-step-nav">
              <button
                className="ph-btn"
                disabled={step === 1}
                onClick={() => setStep(Math.max(1, step - 1))}
              >
                <ChevronLeft size={11} /> Back
              </button>
              {step < STEPS.length ? (
                <button
                  className="ph-btn ph-btn--primary"
                  onClick={() => setStep(step + 1)}
                >
                  Continue to {STEPS[step]} <ChevronRight size={11} />
                </button>
              ) : (
                <button
                  className="ph-btn ph-btn--primary"
                  onClick={() => {
                    if (idx < adSets.length - 1) {
                      onFocus(adSets[idx + 1].id);
                      setStep(1);
                    } else {
                      // Last ad set — go back to first step of current ad set (Done)
                      setStep(1);
                    }
                  }}
                >
                  {idx < adSets.length - 1 ? (
                    <><CheckCircle2 size={11} /> Done &amp; Next Ad Set <ChevronRight size={11} /></>
                  ) : (
                    <><CheckCircle2 size={11} /> Done</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Bulk Paste Modal */}
      {bulkLocModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setBulkLocModal(null)}
        >
          <div
            className="rounded-xl shadow-2xl p-5 space-y-4"
            style={{ width: 480, background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Bulk Paste Locations</h3>
              <button onClick={() => setBulkLocModal(null)} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Location Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['city', 'region', 'country', 'zip'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBulkLocType(t)}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: bulkLocType === t ? '1px solid rgba(0,190,239,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      background: bulkLocType === t ? 'rgba(0,190,239,0.12)' : 'transparent',
                      color: bulkLocType === t ? '#00BEEF' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {t === 'region' ? 'State/Region' : t === 'zip' ? 'Zip/Postal' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Paste Locations (one per line)</label>
              <textarea
                value={bulkLocText}
                onChange={(e) => setBulkLocText(e.target.value)}
                placeholder={bulkLocType === 'city' ? 'New York\nLos Angeles\nChicago' : bulkLocType === 'region' ? 'California\nTexas\nNew York' : bulkLocType === 'zip' ? '10001\n90210\n60601' : 'United States\nCanada\nUnited Kingdom'}
                rows={8}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, outline: 'none', resize: 'none', color: '#fff', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {bulkLocText.split('\n').filter((s) => s.trim()).length} location{bulkLocText.split('\n').filter((s) => s.trim()).length !== 1 ? 's' : ''} entered
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setBulkLocModal(null)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  disabled={bulkLocMatching || !bulkLocText.trim()}
                  onClick={async () => {
                    if (!bulkLocModal) return;
                    const lines = bulkLocText.split('\n').map((s) => s.trim()).filter(Boolean);
                    if (!lines.length) return;
                    setBulkLocMatching(true);
                    try {
                      const row = adSets.find((r) => r.id === bulkLocModal.rowId);
                      if (!row) return;
                      const matched: { key: string; type: string; name: string }[] = [];
                      const labels: string[] = [];
                      for (const line of lines) {
                        try {
                          const res = await utils.adminMeta.searchGeoLocations.fetch({
                            accessToken: settings?.accessToken ?? '',
                            query: line,
                            location_types: [bulkLocType],
                          });
                          if (res?.results?.length) {
                            const loc = res.results[0];
                            const label = [loc.name, loc.region, loc.countryName].filter(Boolean).join(', ');
                            matched.push({ key: loc.key, type: loc.type || bulkLocType, name: label });
                            labels.push(label);
                          }
                        } catch { /* skip failed lookups */ }
                      }
                      const currentLabels = row.geoLocations ? row.geoLocations.split('\n').filter(Boolean) : [];
                      const currentObjs = row.geoLocationObjects || [];
                      const newLabels = labels.filter((l) => !currentLabels.includes(l));
                      const newObjs = matched.filter((m) => !currentLabels.includes(m.name));
                      updateById(bulkLocModal.rowId, {
                        geoLocations: [...currentLabels, ...newLabels].join('\n'),
                        geoLocationObjects: [...currentObjs, ...newObjs],
                      });
                      setBulkLocModal(null);
                    } finally {
                      setBulkLocMatching(false);
                    }
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: bulkLocMatching || !bulkLocText.trim() ? 'rgba(0,190,239,0.3)' : '#00BEEF',
                    color: '#0e0d3a', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: bulkLocMatching || !bulkLocText.trim() ? 0.6 : 1,
                  }}
                >
                  {bulkLocMatching ? '⟳ Matching…' : 'Match Locations'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creatives pillar ──────────────────────────────────────────────────────────
function PillarCreatives({
  creatives,
  carouselCreatives,
}: {
  creatives: CreativeRow[];
  carouselCreatives: CreativeRow[];
}) {
  const all = [...creatives, ...carouselCreatives];
  return (
    <div className="ph-simple-content">
      <div className="ph-simple-head">
        <h2 className="ph-editor-title">Creative Library</h2>
        <p className="ph-simple-sub">Build each creative once. Map to ad sets in the Ads pillar.</p>
      </div>
      {all.length === 0 ? (
        <div className="ph-empty">
          <Image size={32} style={{ opacity: 0.3 }} />
          <p>No creatives yet. Switch to Spreadsheet view to add creatives.</p>
        </div>
      ) : (
        <div className="ph-creative-grid">
          {all.map((c) => (
            <div key={c.id} className="ph-creative-card">
              <div className="ph-creative-type">
                <span className={`ph-badge ${c.adType === "static" ? "ph-badge--muted" : c.adType === "video" ? "ph-badge--pink" : "ph-badge--amber"}`}>
                  {c.adType}
                </span>
              </div>
              <div className="ph-creative-name">{c.concept || "Untitled"}</div>
              {c.creativeId && (
                <div className="ph-creative-id">{c.creativeId}</div>
              )}
              <div className="ph-creative-dims">
                {c.placementDimensions.join(" · ") || "No dimensions"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ads pillar ────────────────────────────────────────────────────────────────
function PillarAds({
  ads,
  adSets,
  creatives,
}: {
  ads: ReturnType<typeof buildAds>;
  adSets: AdSetRow[];
  creatives: CreativeRow[];
}) {
  return (
    <div className="ph-simple-content">
      <div className="ph-simple-head">
        <h2 className="ph-editor-title">Ads</h2>
        <p className="ph-simple-sub">
          {ads.length} ad{ads.length !== 1 ? "s" : ""} assembled from {adSets.length} ad set{adSets.length !== 1 ? "s" : ""} and {creatives.length} creative{creatives.length !== 1 ? "s" : ""}.
        </p>
      </div>
      {ads.length === 0 ? (
        <div className="ph-empty">
          <Layers size={32} style={{ opacity: 0.3 }} />
          <p>No ads yet. Go to the Ads tab in spreadsheet view to assemble ads.</p>
        </div>
      ) : (
        <div className="ph-ads-list">
          {ads.map((a) => (
            <div key={a.id} className="ph-ad-row">
              <div className="ph-ad-name">{a.adName}</div>
              <div className="ph-ad-meta">{a.adSetName} · {a.campaignName}</div>
              <span className={`ph-badge ${a.status === "ACTIVE" ? "ph-badge--green" : "ph-badge--muted"}`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// helper to satisfy TS
type AdRowLike = { id: string; adName: string; adSetName: string; campaignName: string; status: string };
function buildAds(_: unknown): AdRowLike[] { return []; }

// ── Launch pillar ─────────────────────────────────────────────────────────────
function PillarLaunch({
  state,
  onGoToExport,
}: {
  state: CampaignBuilderState;
  onGoToExport: () => void;
}) {
  const campaignCount = state.campaigns.filter((c) => c.name).length;
  const adSetCount = state.adSets.filter((a) => a.name).length;
  const creativeCount = state.creatives.filter((c) => c.concept).length + state.carouselCreatives.length;
  const adCount = state.ads.filter((a) => a.adName).length;
  const settingsReady = !!state.settings.tokenId && !!state.settings.adAccountId;

  const checks: [string, boolean][] = [
    [`${campaignCount} campaign${campaignCount !== 1 ? "s" : ""} defined`, campaignCount > 0],
    [`${adSetCount} ad set${adSetCount !== 1 ? "s" : ""} defined`, adSetCount > 0],
    [`${creativeCount} creative${creativeCount !== 1 ? "s" : ""} in library`, creativeCount > 0],
    [`${adCount} ad${adCount !== 1 ? "s" : ""} assembled`, adCount > 0],
    ["Ad account configured", settingsReady],
  ];

  const allPass = checks.every(([, ok]) => ok);

  return (
    <div className="ph-simple-content">
      <div className="ph-simple-head">
        <h2 className="ph-editor-title">Launch</h2>
        <p className="ph-simple-sub">Review your build, then launch via Manus to push to Meta.</p>
      </div>

      {/* Stats */}
      <div className="ph-stat-grid">
        {[
          { n: campaignCount, l: "Campaigns" },
          { n: adSetCount, l: "Ad Sets" },
          { n: creativeCount, l: "Creatives" },
          { n: adCount, l: "Ads ready" },
        ].map(({ n, l }) => (
          <div key={l} className="ph-stat-card">
            <div className="ph-stat-n">{n}</div>
            <div className="ph-stat-l">{l}</div>
          </div>
        ))}
      </div>

      {/* Checks */}
      <div className="ph-checks">
        <div className="ph-checks-head">
          <span>Pre-flight Checks</span>
          <span className={`ph-badge ${allPass ? "ph-badge--green" : "ph-badge--err"}`}>
            {checks.filter(([, ok]) => ok).length} / {checks.length} passed
          </span>
        </div>
        {checks.map(([t, ok], i) => (
          <div key={i} className="ph-check-row">
            {ok ? (
              <CheckCircle2 size={14} style={{ color: "var(--pl-green)", flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={14} style={{ color: "var(--pl-pink)", flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, fontSize: 12 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className={`ph-launch-cta ${allPass ? "ph-launch-cta--ready" : "ph-launch-cta--warn"}`}>
        <div className="ph-launch-msg">
          {allPass ? (
            <>
              <CheckCircle2 size={16} style={{ color: "var(--pl-green)" }} />
              <span>All checks passed — ready to launch</span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} style={{ color: "var(--pl-pink)" }} />
              <span>Fix the issues above before launching</span>
            </>
          )}
        </div>
        <button
          className="ph-btn ph-btn--primary"
          onClick={onGoToExport}
        >
          <Rocket size={14} /> Go to Export &amp; Launch
        </button>
      </div>
    </div>
  );
}

// ── Scoped CSS ────────────────────────────────────────────────────────────────
const PH_STYLES = `
/* ── PillarHub root ── */
.ph-root {
  font-family: 'Montserrat', system-ui, sans-serif;
  font-size: 13px;
  color: rgba(250,250,250,0.9);
  --ph-bg:         rgba(14,13,58,0.98);
  --ph-bg-2:       rgba(255,255,255,0.03);
  --ph-bg-3:       rgba(255,255,255,0.06);
  --ph-border:     rgba(255,255,255,0.08);
  --ph-border-2:   rgba(255,255,255,0.05);
  --ph-muted:      rgba(250,250,250,0.45);
  --ph-ink:        rgba(250,250,250,0.9);
  --ph-input-bg:   rgba(255,255,255,0.06);
  --ph-input-border: rgba(255,255,255,0.12);
  --ph-radius:     8px;
  --ph-gap:        16px;
}

/* compact density */
.ph-root.ph-compact { font-size: 11.5px; }
.ph-root.ph-compact .ph-input { height: 26px; padding: 0 8px; font-size: 11px; }
.ph-root.ph-compact .ph-fld { gap: 3px; }

/* ── Pillar strip ── */
.ph-strip {
  display: flex;
  border-bottom: 1px solid var(--ph-border);
  background: rgba(14,13,58,0.99);
  flex-shrink: 0;
}
.ph-pillar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border: none;
  border-right: 1px solid var(--ph-border);
  background: transparent;
  color: var(--ph-ink);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  font-family: inherit;
}
.ph-pillar:last-child { border-right: none; }
.ph-pillar:hover { background: rgba(255,255,255,0.04); }
.ph-pillar--on { background: rgba(0,190,239,0.07) !important; border-bottom: 2px solid #00BEEF; }
.ph-pillar--done .ph-pillar-num { background: var(--pl-green); }

.ph-pillar-top { display: flex; align-items: flex-start; gap: 8px; }
.ph-pillar-num {
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; flex-shrink: 0;
  color: rgba(250,250,250,0.9);
}
.ph-pillar--on .ph-pillar-num { background: #00BEEF; color: #141349; }
.ph-pillar-info { flex: 1; min-width: 0; }
.ph-pillar-title { font-size: 11.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-pillar-sub { font-size: 10px; color: var(--ph-muted); margin-top: 1px; }

.ph-pillar-stat { display: flex; align-items: baseline; gap: 4px; }
.ph-stat-n { font-size: 20px; font-weight: 800; color: var(--pl-pink); letter-spacing: -0.02em; line-height: 1; }
.ph-stat-l { font-size: 10px; color: var(--ph-muted); font-weight: 600; }

.ph-pillar-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
.ph-pillar-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }

.ph-pillar-issues { display: flex; align-items: center; gap: 4px; font-size: 10px; }

/* ── Split layout ── */
.ph-split { display: flex; height: 100%; overflow: hidden; }

/* ── List panel ── */
.ph-list {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--ph-border);
  background: rgba(14,13,58,0.6);
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ph-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.ph-list-label { font-size: 10px; font-weight: 700; color: var(--ph-muted); letter-spacing: 0.06em; text-transform: uppercase; }

.ph-list-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: var(--ph-radius);
  border: 1px solid var(--ph-border-2);
  background: var(--ph-bg-2);
  cursor: pointer;
  text-align: left;
  color: var(--ph-ink);
  font-family: inherit;
  transition: background 0.12s, border-color 0.12s;
  position: relative;
}
.ph-list-card:hover { background: var(--ph-bg-3); border-color: var(--ph-border); }
.ph-list-card--on { background: rgba(0,190,239,0.08) !important; border-color: rgba(0,190,239,0.25) !important; }
.ph-list-card--err { border-color: rgba(237,19,95,0.3) !important; }
.ph-list-card-name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-list-card-meta { font-size: 10px; color: var(--ph-muted); }
.ph-list-card-budget { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; color: var(--ph-muted); margin-top: 4px; }

/* ── Editor panel ── */
.ph-editor {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ph-editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.ph-breadcrumb { font-size: 10px; color: var(--ph-muted); display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.ph-editor-title { font-size: 18px; font-weight: 800; color: rgba(250,250,250,0.95); margin: 0; letter-spacing: -0.01em; }

.ph-nav-btns { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.ph-nav-count { font-size: 11px; color: var(--ph-muted); font-variant-numeric: tabular-nums; }

/* ── Step progress ── */
.ph-mini-steps { display: flex; gap: 4px; }
.ph-mini-step { flex: 1; height: 3px; border-radius: 999px; background: rgba(255,255,255,0.1); transition: background 0.2s; }
.ph-mini-step--done { background: var(--pl-green); }
.ph-mini-step--on { background: var(--pl-cyan); }

.ph-step-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ph-step-eyebrow { font-size: 10px; font-weight: 700; color: var(--ph-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.ph-step-title { font-size: 16px; font-weight: 700; color: rgba(250,250,250,0.95); margin: 2px 0 0; }

/* ── Form elements ── */
.ph-form { display: flex; flex-direction: column; gap: 16px; }
.ph-fld-group { border: 1px solid var(--ph-border); border-radius: 10px; overflow: hidden; }
.ph-fld-group-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: var(--ph-bg-2);
  border-bottom: 1px solid var(--ph-border);
}
.ph-fld-group-head h4 { margin: 0; font-size: 12.5px; font-weight: 700; color: rgba(250,250,250,0.9); }
.ph-fld-group-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

.ph-fld { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.ph-fld-row { display: flex; gap: 12px; }
.ph-lbl { font-size: 11px; font-weight: 600; color: var(--ph-muted); }
.ph-help { font-size: 10.5px; color: var(--ph-muted); line-height: 1.4; }

.ph-input {
  height: 32px;
  padding: 0 10px;
  background: var(--ph-input-bg);
  border: 1px solid var(--ph-input-border);
  border-radius: 6px;
  color: rgba(250,250,250,0.9);
  font-family: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  width: 100%;
}
.ph-input:focus {
  border-color: rgba(0,190,239,0.4);
  background: rgba(0,190,239,0.06);
}
.ph-input::placeholder { color: rgba(250,250,250,0.25); }
select.ph-input { cursor: pointer; }
select.ph-input option { background: #141349; color: rgba(250,250,250,0.9); }

/* ── Segmented control ── */
.ph-seg {
  display: flex;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.ph-seg-btn {
  flex: 1;
  padding: 4px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--ph-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.ph-seg-btn:hover { background: rgba(255,255,255,0.06); color: rgba(250,250,250,0.8); }
.ph-seg-btn--on { background: rgba(255,255,255,0.12) !important; color: rgba(250,250,250,0.95) !important; }

/* ── Buttons ── */
.ph-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  color: rgba(250,250,250,0.8);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.ph-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.22); }
.ph-btn:disabled { opacity: 0.35; cursor: default; }
.ph-btn--sm { padding: 4px 8px; font-size: 10.5px; }
.ph-btn--primary {
  background: var(--pl-cyan) !important;
  color: #141349 !important;
  border-color: transparent !important;
  font-weight: 700;
}
.ph-btn--primary:hover:not(:disabled) { background: #00d4f5 !important; }

/* ── Step nav ── */
.ph-step-nav {
  display: flex;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid var(--ph-border);
  margin-top: 4px;
}

/* ── Badges ── */
.ph-badge {
  display: inline-flex; align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.ph-badge--err { background: rgba(237,19,95,0.15); color: var(--pl-pink); }
.ph-badge--green { background: rgba(0,179,122,0.15); color: var(--pl-green); }
.ph-badge--muted { background: rgba(255,255,255,0.08); color: rgba(250,250,250,0.5); }
.ph-badge--pink { background: rgba(237,19,95,0.15); color: var(--pl-pink); }
.ph-badge--amber { background: rgba(247,144,30,0.15); color: var(--pl-orange); }

/* ── Simple content (creatives, ads, launch) ── */
.ph-simple-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ph-simple-head { display: flex; flex-direction: column; gap: 4px; }
.ph-simple-sub { font-size: 12.5px; color: var(--ph-muted); margin: 0; }

/* ── Creative grid ── */
.ph-creative-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.ph-creative-card {
  padding: 14px;
  border: 1px solid var(--ph-border);
  border-radius: 10px;
  background: var(--ph-bg-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ph-creative-type { display: flex; }
.ph-creative-name { font-size: 12.5px; font-weight: 700; }
.ph-creative-id { font-size: 10px; color: var(--ph-muted); font-family: monospace; }
.ph-creative-dims { font-size: 10.5px; color: var(--ph-muted); }

/* ── Ads list ── */
.ph-ads-list { display: flex; flex-direction: column; gap: 6px; }
.ph-ad-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--ph-border-2);
  border-radius: 8px;
  background: var(--ph-bg-2);
}
.ph-ad-name { flex: 1; font-size: 12px; font-weight: 600; }
.ph-ad-meta { font-size: 10.5px; color: var(--ph-muted); }

/* ── Launch ── */
.ph-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.ph-stat-card {
  padding: 16px 18px;
  border: 1px solid var(--ph-border);
  border-radius: 12px;
  background: var(--ph-bg-2);
}
.ph-stat-card .ph-stat-n { font-size: 28px; font-weight: 800; color: var(--pl-pink); letter-spacing: -0.02em; line-height: 1; }
.ph-stat-card .ph-stat-l { font-size: 10px; color: var(--ph-muted); font-weight: 600; margin-top: 4px; letter-spacing: 0.06em; text-transform: uppercase; }

.ph-checks {
  border: 1px solid var(--ph-border);
  border-radius: 12px;
  overflow: hidden;
}
.ph-checks-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--ph-bg-2);
  border-bottom: 1px solid var(--ph-border);
  font-size: 13px; font-weight: 700;
}
.ph-check-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  border-top: 1px solid var(--ph-border-2);
}
.ph-check-row:first-of-type { border-top: none; }

.ph-launch-cta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid;
}
.ph-launch-cta--ready { background: rgba(0,179,122,0.08); border-color: rgba(0,179,122,0.3); }
.ph-launch-cta--warn { background: rgba(237,19,95,0.06); border-color: rgba(237,19,95,0.25); }
.ph-launch-msg { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }

/* ── Empty state ── */
.ph-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 48px 24px;
  color: var(--ph-muted); text-align: center;
}
.ph-empty p { font-size: 13px; max-width: 320px; }
`;
