/**
 * Campaign Builder — 5-tab spreadsheet-style Meta Ads builder
 * Tabs: Campaigns | Ad Sets | Creative Library | Ads | Export & Launch
 *
 * Credential flow: BM token (vault) → ad account → FB page → IG → pixel
 * All credentials resolved server-side via tokenId; accessToken never typed manually.
 */
import { useState, useRef } from "react";
import AppShell from "@/components/AppShell";
import CampaignTable from "./CampaignTableAdmin";
import AdSetsTable from "./AdSetsTableAdmin";
import CreativesTable from "./CreativesTableAdmin";
import AdsMatrix from "./AdsMatrixAdmin";
import ExportPanel from "./ExportPanelAdmin";
import SettingsDrawer from "./SettingsDrawerAdmin";
import SessionManager from "./SessionManagerAdmin";
import LeadGenFormModal from "./LeadGenFormModalAdmin";
import ImportMetaStructureModal from "./ImportMetaStructureModalAdmin";
import CreativeLibrarySessionModal from "./CreativeLibrarySessionModalAdmin";
import { useLaunchBuild } from "./useLaunchBuildAdmin";
import PillarHubAdmin, { TweakSettings } from "./PillarHubAdmin";
import TweaksPanelAdmin from "./TweaksPanelAdmin";
import {
  CampaignBuilderState,
  BuildSettings,
  BuildMode,
  Objective,
  newCampaign,
  newAdSet,
  newCreative,
  newLeadGenForm,
  LeadGenForm,
  ImportedMetaCampaign,
  ImportedMetaAdSet,
  CreativeRow,
} from "./campaignStoreAdmin";
import { DownloadCloud, Layers, Settings, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type TabId = "campaigns" | "ad-sets" | "creative-library" | "ads" | "export";
type ViewMode = "spreadsheet" | "pillar";

const DEFAULT_TWEAKS: TweakSettings = {
  density: "comfortable",
  friendly: false,
  advanced: false,
  dark: true,
};

// ── Initial state ─────────────────────────────────────────────────────────────
function makeInitialSettings(): BuildSettings {
  return {
    tokenId: null,
    bmId: "",
    adAccountId: "",
    adAccountName: "",
    accessToken: "",
    facebookPageId: "",
    facebookPageName: "",
    instagramUserId: "",
    instagramUsername: "",
    pixelId: "",
  };
}

function makeInitialState(): CampaignBuilderState {
  return {
    buildMode: "full",
    campaigns: [newCampaign()],
    adSets: [newAdSet()],
    creatives: [newCreative()],
    carouselCreatives: [],
    ads: [],
    settings: makeInitialSettings(),
    leadGenForms: [],
    importedCampaigns: [],
    importedAdSets: [],
    reachHistory: [],
    overlapHistory: [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CampaignBuilderAdmin() {
  const [state, setState] = useState<CampaignBuilderState>(makeInitialState);
  const [activeTab, setActiveTab] = useState<TabId>("campaigns");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creativeImportOpen, setCreativeImportOpen] = useState(false);
  const [leadGenOpen, setLeadGenOpen] = useState(false);
  const [activeLeadGenFormId, setActiveLeadGenFormId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("spreadsheet");
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweaks] = useState<TweakSettings>(DEFAULT_TWEAKS);
  const tweaksBtnRef = useRef<HTMLDivElement>(null);

  // ── Launch hook ──────────────────────────────────────────────────────────────
  const { launch, progress, reset } = useLaunchBuild(state, ({ ads, campaigns, adSets }) => {
    setState(s => ({ ...s, ads, campaigns, adSets }));
  });

  // ── State helpers ────────────────────────────────────────────────────────────
  const update = <K extends keyof CampaignBuilderState>(key: K, val: CampaignBuilderState[K]) => {
    setState(s => ({ ...s, [key]: val }));
  };

  const handleLoad = (loaded: CampaignBuilderState) => {
    setState({
      ...loaded,
      importedCampaigns: loaded.importedCampaigns ?? [],
      importedAdSets: loaded.importedAdSets ?? [],
    });
    setActiveTab("campaigns");
    reset();
    toast.success("Session loaded.");
  };

  // ── Lead gen form helpers ────────────────────────────────────────────────────
  const openLeadGenForm = () => {
    if (state.leadGenForms.length === 0) {
      const form = newLeadGenForm();
      setState(s => ({ ...s, leadGenForms: [form] }));
      setActiveLeadGenFormId(form.id);
    } else {
      setActiveLeadGenFormId(state.leadGenForms[0].id);
    }
    setLeadGenOpen(true);
  };

  const activeLeadGenForm = state.leadGenForms.find(f => f.id === activeLeadGenFormId);

  const normalizeImportedObjective = (objective: string): Objective => {
    const valid: Objective[] = [
      'OUTCOME_AWARENESS',
      'OUTCOME_TRAFFIC',
      'OUTCOME_ENGAGEMENT',
      'OUTCOME_LEADS',
      'OUTCOME_APP_PROMOTION',
      'OUTCOME_SALES',
    ];
    return valid.includes(objective as Objective) ? (objective as Objective) : 'OUTCOME_TRAFFIC';
  };

  const handleMetaImport = ({
    campaigns,
    adSets,
    populateRows,
  }: {
    campaigns: ImportedMetaCampaign[];
    adSets: ImportedMetaAdSet[];
    populateRows: boolean;
  }) => {
    setState(s => {
      const campaignById = new Map(campaigns.map(c => [c.id, c]));
      const existingCampaignIds = new Set(s.campaigns.map(c => c.campaignId).filter(Boolean));
      const existingAdSetIds = new Set(s.adSets.map(a => a.adSetId).filter(Boolean));

      const importedCampaignRows = populateRows
        ? campaigns
          .filter(campaign => !existingCampaignIds.has(campaign.id))
          .map(campaign => newCampaign({
            name: campaign.name,
            objective: normalizeImportedObjective(campaign.objective),
            status: campaign.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
            campaignId: campaign.id,
          }))
        : [];

      const importedAdSetRows = populateRows
        ? adSets
          .filter(adSet => !existingAdSetIds.has(adSet.id))
          .map(adSet => {
            const campaign = campaignById.get(adSet.campaignId);
            return newAdSet({
              name: adSet.name,
              campaignName: campaign?.name ?? '',
              status: adSet.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
              budgetType: adSet.dailyBudget ? 'DAILY' : 'LIFETIME',
              budget: adSet.dailyBudget || adSet.lifetimeBudget || '',
              adSetId: adSet.id,
              campaignId: adSet.campaignId,
            });
          })
        : [];

      return {
        ...s,
        importedCampaigns: campaigns,
        importedAdSets: adSets,
        campaigns: populateRows ? [...s.campaigns, ...importedCampaignRows] : s.campaigns,
        adSets: populateRows ? [...s.adSets, ...importedAdSetRows] : s.adSets,
      };
    });
  };

  const creativeMergeKey = (creative: CreativeRow): string => {
    const durableId = creative.creativeId?.trim();
    if (durableId) return `creative-id:${durableId.toLowerCase()}`;
    return [
      creative.concept?.trim().toLowerCase() || '',
      creative.adType || '',
      creative.assetLength?.trim() || '',
      creative.websiteUrl?.trim().toLowerCase() || '',
    ].join('|');
  };

  const mergeCreativeRows = (existing: CreativeRow[], incoming: CreativeRow[]) => {
    const existingKeys = new Set(existing.map(creativeMergeKey));
    const merged = [...existing];
    incoming.forEach(creative => {
      const key = creativeMergeKey(creative);
      if (key.replace(/\|/g, '').trim() && !existingKeys.has(key)) {
        merged.push(creative);
        existingKeys.add(key);
      }
    });
    return merged;
  };

  const handleCreativeLibraryImport = ({
    creatives,
    carouselCreatives,
    mode,
    sourceName,
  }: {
    creatives: CreativeRow[];
    carouselCreatives: CreativeRow[];
    mode: 'merge' | 'replace';
    sourceName: string;
  }) => {
    setState(s => ({
      ...s,
      creatives: mode === 'replace' ? (creatives.length ? creatives : [newCreative()]) : mergeCreativeRows(s.creatives, creatives),
      carouselCreatives: mode === 'replace' ? carouselCreatives : mergeCreativeRows(s.carouselCreatives, carouselCreatives),
    }));
    setActiveTab('creative-library');
    toast.success(`Creative Library ${mode === 'replace' ? 'loaded' : 'merged'} from “${sourceName}”.`);
  };

  const handleLeadGenFormChange = (form: LeadGenForm) => {
    setState(s => ({
      ...s,
      leadGenForms: s.leadGenForms.map(f => f.id === form.id ? form : f),
    }));
  };

  // ── Settings readiness indicator ─────────────────────────────────────────────
  const settingsReady = !!state.settings.tokenId && !!state.settings.adAccountId && !!state.settings.facebookPageId;

  // ── Tab definitions ──────────────────────────────────────────────────────────
  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "campaigns",        label: "Campaigns",       count: state.campaigns.filter(c => c.name).length },
    { id: "ad-sets",          label: "Ad Sets",         count: state.adSets.filter(a => a.name).length },
    { id: "creative-library", label: "Creative Library",count: state.creatives.filter(c => c.concept).length + state.carouselCreatives.length },
    { id: "ads",              label: "Ads",             count: state.ads.filter(a => a.adName).length },
    { id: "export",           label: "Export & Launch" },
  ];

  // ── Build mode selector ──────────────────────────────────────────────────────
  const BUILD_MODES: { id: BuildMode; label: string; sub: string }[] = [
    { id: "full",     label: "Full Build",  sub: "Campaigns + ad sets + ads" },
    { id: "ads-only", label: "Ads Only",    sub: "Use existing ad set IDs" },
    { id: "update",   label: "Update Ads",  sub: "Swap creative on live ads" },
  ];

  // ── Header actions ───────────────────────────────────────────────────────────
  const headerActions = (
    <div className="flex items-center gap-2">
      <SessionManager state={state} onLoad={handleLoad} />

      <button
        onClick={() => setImportOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
        style={{
          background: state.importedCampaigns.length || state.importedAdSets.length ? "rgba(0,190,239,0.12)" : "rgba(255,255,255,0.08)",
          color: state.importedCampaigns.length || state.importedAdSets.length ? "#00BEEF" : "rgba(255,255,255,0.7)",
          border: `1px solid ${state.importedCampaigns.length || state.importedAdSets.length ? "rgba(0,190,239,0.3)" : "rgba(255,255,255,0.16)"}`,
        }}
        title="Import specific existing Meta campaigns and ad sets"
      >
        <DownloadCloud size={12} />
        <span>Import Existing</span>
      </button>

      <button
        onClick={() => setCreativeImportOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
        style={{
          background: state.creatives.filter(c => c.concept || c.creativeId).length || state.carouselCreatives.length ? "rgba(0,190,239,0.12)" : "rgba(255,255,255,0.08)",
          color: state.creatives.filter(c => c.concept || c.creativeId).length || state.carouselCreatives.length ? "#00BEEF" : "rgba(255,255,255,0.7)",
          border: `1px solid ${state.creatives.filter(c => c.concept || c.creativeId).length || state.carouselCreatives.length ? "rgba(0,190,239,0.3)" : "rgba(255,255,255,0.16)"}`,
        }}
        title="Load only Creative Library rows from a saved builder session"
      >
        <Layers size={12} />
        <span>Load Creatives</span>
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
        style={{
          background: settingsReady ? "rgba(0,190,239,0.18)" : "rgba(255,255,255,0.10)",
          color: settingsReady ? "#00BEEF" : "rgba(255,255,255,0.75)",
          border: `1px solid ${settingsReady ? "rgba(0,190,239,0.35)" : "rgba(255,255,255,0.18)"}`,
        }}
        title="Account settings"
      >
        <Settings size={12} />
        {settingsReady
          ? <span className="max-w-[140px] truncate">{state.settings.adAccountName || state.settings.adAccountId}</span>
          : <span>Setup Account</span>
        }
      </button>

      {/* UI View toggle + tweaks */}
      <div ref={tweaksBtnRef} style={{ position: "relative" }}>
        <button
          onClick={() => {
            if (viewMode === "spreadsheet") {
              setViewMode("pillar");
              setTweaksOpen(true);
            } else {
              setTweaksOpen(v => !v);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
          style={{
            background: viewMode === "pillar" ? "rgba(237,19,95,0.15)" : "rgba(255,255,255,0.08)",
            color: viewMode === "pillar" ? "#ED135F" : "rgba(255,255,255,0.7)",
            border: `1px solid ${viewMode === "pillar" ? "rgba(237,19,95,0.35)" : "rgba(255,255,255,0.16)"}`,
          }}
          title={viewMode === "spreadsheet" ? "Switch to Pillar Hub view" : "Pillar Hub view active — click to adjust tweaks"}
        >
          <LayoutGrid size={12} />
          <span>UI View</span>
        </button>
        {viewMode === "pillar" && (
          <button
            onClick={() => setViewMode("spreadsheet")}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-600 transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              marginLeft: 4,
            }}
            title="Switch back to spreadsheet view"
          >
            ← Spreadsheet
          </button>
        )}
        {tweaksOpen && viewMode === "pillar" && (
          <TweaksPanelAdmin
            tweaks={tweaks}
            onChange={setTweaks}
            onClose={() => setTweaksOpen(false)}
          />
        )}
      </div>
    </div>
  );

  return (
    <AppShell
      title="Campaign Builder"
      subtitle="Meta Ads campaign creation"
      badge="beta"
      headerActions={headerActions}
    >
      {/* Full-bleed container — cancels AppShell's p-6 */}
      <div className="-m-6 h-[calc(100%+3rem)] flex flex-col overflow-hidden">

        {/* ── Build mode + tab bar (spreadsheet view only) ── */}
        {viewMode === "spreadsheet" && (
          <div
            className="flex items-center justify-between shrink-0 px-4"
            style={{
              height: 44,
              background: "rgba(14,13,58,0.98)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Build mode pills */}
            <div className="flex items-center gap-1">
              {BUILD_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => update("buildMode", m.id)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-600 transition-all"
                  style={{
                    background: state.buildMode === m.id ? "rgba(0,190,239,0.15)" : "transparent",
                    color: state.buildMode === m.id ? "#00BEEF" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${state.buildMode === m.id ? "rgba(0,190,239,0.3)" : "transparent"}`,
                  }}
                  title={m.sub}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0.5">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-600 transition-all"
                  style={{
                    background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                    color: activeTab === tab.id ? "#FAFAFA" : "rgba(255,255,255,0.4)",
                    borderBottom: activeTab === tab.id ? "2px solid #00BEEF" : "2px solid transparent",
                    borderRadius: "6px 6px 0 0",
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className="text-[9px] font-700 px-1 py-0.5 rounded-full"
                      style={{ background: "rgba(0,190,239,0.2)", color: "#00BEEF" }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Content area ── */}
        <div className="flex-1 overflow-hidden">

          {/* Pillar Hub view */}
          {viewMode === "pillar" && (
            <PillarHubAdmin
              state={state}
              tweaks={tweaks}
              onStateChange={(key, val) => update(key as keyof CampaignBuilderState, val as CampaignBuilderState[keyof CampaignBuilderState])}
              onGoToExport={() => {
                setViewMode("spreadsheet");
                setActiveTab("export");
              }}
            />
          )}

          {/* Spreadsheet tabs */}
          {viewMode === "spreadsheet" && (
            <>
              {activeTab === "campaigns" && (
                <div className="h-full overflow-auto">
                  <CampaignTable
                    rows={state.campaigns}
                    onChange={rows => update("campaigns", rows)}
                  />
                </div>
              )}

              {activeTab === "ad-sets" && (
                <div className="h-full overflow-auto">
                  <AdSetsTable
                    rows={state.adSets}
                    campaigns={state.campaigns}
                    onChange={rows => update("adSets", rows)}
                    settings={state.settings}
                    reachHistory={state.reachHistory}
                    overlapHistory={state.overlapHistory}
                    onReachHistoryChange={h => update("reachHistory", h)}
                    onOverlapHistoryChange={h => update("overlapHistory", h)}
                  />
                </div>
              )}

              {activeTab === "creative-library" && (
                <div className="h-full overflow-auto">
                  <CreativesTable
                    rows={state.creatives}
                    carouselRows={state.carouselCreatives}
                    onChange={rows => update("creatives", rows)}
                    onCarouselChange={rows => update("carouselCreatives", rows)}
                    settings={state.settings}
                  />
                </div>
              )}

              {activeTab === "ads" && (
                <div className="h-full overflow-hidden">
                  <AdsMatrix
                    ads={state.ads}
                    adSets={state.adSets}
                    creatives={[...state.creatives, ...state.carouselCreatives]}
                    campaigns={state.campaigns}
                    buildMode={state.buildMode}
                    settings={state.settings.accessToken ? {
                      accessToken: state.settings.accessToken,
                      facebookPageId: state.settings.facebookPageId,
                    } : undefined}
                    onChange={ads => update("ads", ads)}
                  />
                </div>
              )}

              {activeTab === "export" && (
                <div className="h-full overflow-auto">
                  <ExportPanel
                    state={state}
                    onLaunch={launch}
                    launchProgress={progress}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Import Existing Meta Structure Modal ── */}
      {importOpen && (
        <ImportMetaStructureModal
          settings={state.settings}
          existingCampaigns={state.importedCampaigns ?? []}
          existingAdSets={state.importedAdSets ?? []}
          onImport={handleMetaImport}
          onClose={() => setImportOpen(false)}
        />
      )}

      {/* ── Creative Library Session Import Modal ── */}
      {creativeImportOpen && (
        <CreativeLibrarySessionModal
          onClose={() => setCreativeImportOpen(false)}
          onImport={handleCreativeLibraryImport}
        />
      )}

      {/* ── Settings Drawer ── */}
      {settingsOpen && (
        <SettingsDrawer
          settings={state.settings}
          onUpdate={s => update("settings", s)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── Lead Gen Form Modal ── */}
      {leadGenOpen && activeLeadGenForm && (
        <LeadGenFormModal
          form={activeLeadGenForm}
          onChange={handleLeadGenFormChange}
          onClose={() => setLeadGenOpen(false)}
        />
      )}
    </AppShell>
  );
}
