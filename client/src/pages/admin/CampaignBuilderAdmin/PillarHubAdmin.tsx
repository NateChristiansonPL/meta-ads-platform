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
} from "lucide-react";

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
  focusId,
  onFocus,
  onChange,
}: {
  adSets: AdSetRow[];
  campaigns: CampaignRow[];
  focusId: string;
  onFocus: (id: string) => void;
  onChange: (rows: AdSetRow[]) => void;
}) {
  const [step, setStep] = useState(1);
  const focused = adSets.find((a) => a.id === focusId) ?? adSets[0];
  const idx = adSets.findIndex((a) => a.id === focused?.id);

  const updateFocused = useCallback(
    (patch: Partial<AdSetRow>) => {
      onChange(adSets.map((a) => (a.id === focused?.id ? { ...a, ...patch } : a)));
    },
    [adSets, focused, onChange]
  );

  const STEPS = ["Locations", "Audience", "Schedule", "Budget"];

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
            {step === 1 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <MapPin size={12} style={{ color: "var(--pl-cyan)" }} />
                  <h4>Where do they live?</h4>
                </div>
                <div className="ph-fld-group-body">
                  <div className="ph-fld">
                    <label className="ph-lbl">Locations</label>
                    <input
                      className="ph-input"
                      value={focused.geoLocations}
                      onChange={(e) => updateFocused({ geoLocations: e.target.value })}
                      placeholder="City, state, country, or ZIP…"
                    />
                    <div className="ph-help">Paste a list — one per line — or use the spreadsheet view for advanced geo targeting.</div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <Users size={12} style={{ color: "var(--pl-orange)" }} />
                  <h4>Who are we reaching?</h4>
                </div>
                <div className="ph-fld-group-body">
                  <div className="ph-fld-row">
                    <div className="ph-fld">
                      <label className="ph-lbl">Age Min</label>
                      <input
                        className="ph-input"
                        value={focused.ageMin}
                        onChange={(e) => updateFocused({ ageMin: e.target.value })}
                        placeholder="18"
                      />
                    </div>
                    <div className="ph-fld">
                      <label className="ph-lbl">Age Max</label>
                      <input
                        className="ph-input"
                        value={focused.ageMax}
                        onChange={(e) => updateFocused({ ageMax: e.target.value })}
                        placeholder="65"
                      />
                    </div>
                    <div className="ph-fld">
                      <label className="ph-lbl">Gender</label>
                      <div className="ph-seg">
                        {(["All", "M", "F"] as const).map((g) => {
                          const val = g === "All" ? "" : g;
                          const isOn = g === "All" ? !focused.genders : focused.genders === val;
                          return (
                            <button
                              key={g}
                              className={isOn ? "ph-seg-btn ph-seg-btn--on" : "ph-seg-btn"}
                              onClick={() => updateFocused({ genders: val })}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="ph-fld">
                    <label className="ph-lbl">Interests & Behaviors <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>(optional)</span></label>
                    <input
                      className="ph-input"
                      value={focused.detailedInterests}
                      onChange={(e) => updateFocused({ detailedInterests: e.target.value })}
                      placeholder="e.g. Tennis, Golf, Fitness"
                    />
                    <div className="ph-help">Leave blank to start broad — Meta's algorithm will narrow on its own.</div>
                  </div>
                  <div className="ph-fld">
                    <label className="ph-lbl">Excluded Audiences</label>
                    <input
                      className="ph-input"
                      value={focused.excludedAudiences}
                      onChange={(e) => updateFocused({ excludedAudiences: e.target.value })}
                      placeholder="e.g. Retargeting - Sitewide"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <Calendar size={12} style={{ color: "var(--pl-cyan)" }} />
                  <h4>When does it run?</h4>
                </div>
                <div className="ph-fld-group-body">
                  <div className="ph-fld-row">
                    <div className="ph-fld">
                      <label className="ph-lbl">Start Date</label>
                      <input
                        className="ph-input"
                        type="date"
                        value={focused.startDate}
                        onChange={(e) => updateFocused({ startDate: e.target.value })}
                      />
                    </div>
                    <div className="ph-fld">
                      <label className="ph-lbl">End Date</label>
                      <input
                        className="ph-input"
                        type="date"
                        value={focused.endDate}
                        onChange={(e) => updateFocused({ endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="ph-fld">
                    <label className="ph-lbl">Campaign</label>
                    <select
                      className="ph-input"
                      value={focused.campaignName}
                      onChange={(e) => updateFocused({ campaignName: e.target.value })}
                    >
                      <option value="">— Select campaign —</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="ph-fld-group">
                <div className="ph-fld-group-head">
                  <DollarSign size={12} style={{ color: "var(--pl-green)" }} />
                  <h4>Budget</h4>
                </div>
                <div className="ph-fld-group-body">
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
                      <div className="ph-help">Average over the campaign run. Meta may spend up to 25% more in a single day.</div>
                    </div>
                  </div>
                  <div className="ph-fld">
                    <label className="ph-lbl">Optimization Goal</label>
                    <select
                      className="ph-input"
                      value={focused.optimizationGoal}
                      onChange={(e) => updateFocused({ optimizationGoal: e.target.value as AdSetRow["optimizationGoal"] })}
                    >
                      {["REACH","IMPRESSIONS","LINK_CLICKS","LANDING_PAGE_VIEWS","LEAD_GENERATION","QUALITY_LEAD","CONVERSIONS","VALUE","APP_INSTALLS","THRUPLAY","VIDEO_VIEWS","POST_ENGAGEMENT","PAGE_LIKES","PAGE_VISITS","AD_RECALL_LIFT"].map((g) => (
                        <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
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
                    }
                  }}
                >
                  Save &amp; next ad set <ChevronRight size={11} />
                </button>
              )}
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
