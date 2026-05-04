/**
 * Campaign Builder — 5-tab spreadsheet-style Meta Ads builder
 * Tabs: Campaigns | Ad Sets | Creative Library | Ads | Export & Launch
 *
 * Credential flow: BM token (vault) → ad account → FB page → IG → pixel
 * All credentials resolved server-side via tokenId; accessToken never typed manually.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import CampaignTable from "./CampaignTableAdmin";
import AdSetsTable from "./AdSetsTableAdmin";
import CreativesTable from "./CreativesTableAdmin";
import AdsMatrix from "./AdsMatrixAdmin";
import ExportPanel from "./ExportPanelAdmin";
import SettingsDrawer from "./SettingsDrawerAdmin";
import SessionManager from "./SessionManagerAdmin";
import LeadGenFormModal from "./LeadGenFormModalAdmin";
import { useLaunchBuild } from "./useLaunchBuildAdmin";
import {
  CampaignBuilderState,
  BuildSettings,
  BuildMode,
  newCampaign,
  newAdSet,
  newCreative,
  newLeadGenForm,
  AdRow,
  LeadGenForm,
} from "./campaignStoreAdmin";
import { Settings } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type TabId = "campaigns" | "ad-sets" | "creative-library" | "ads" | "export";

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
    sheetUrl: "",
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
    reachHistory: [],
    overlapHistory: [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CampaignBuilder() {
  const [state, setState] = useState<CampaignBuilderState>(makeInitialState);
  const [activeTab, setActiveTab] = useState<TabId>("campaigns");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leadGenOpen, setLeadGenOpen] = useState(false);
  const [activeLeadGenFormId, setActiveLeadGenFormId] = useState<string | null>(null);

  // ── Launch hook ──────────────────────────────────────────────────────────────
  const { launch, progress, reset } = useLaunchBuild(state, (updatedAds: AdRow[]) => {
    setState(s => ({ ...s, ads: updatedAds }));
  });

  // ── State helpers ────────────────────────────────────────────────────────────
  const update = <K extends keyof CampaignBuilderState>(key: K, val: CampaignBuilderState[K]) => {
    setState(s => ({ ...s, [key]: val }));
  };

  const handleLoad = (loaded: CampaignBuilderState) => {
    setState(loaded);
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

        {/* ── Build mode + tab bar ── */}
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

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-hidden">
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
        </div>
      </div>

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
