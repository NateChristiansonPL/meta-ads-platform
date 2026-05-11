/**
 * qaChecksAdmin.ts
 * Shared pre-launch QA check logic for both the Spreadsheet and Pillar views.
 * Returns a flat list of issues (error / warning / info) with optional row
 * references so the UI can navigate directly to the offending ad set.
 */

import { AdSetRow, CampaignRow, CreativeRow, AdRow, BuildSettings, conversionEventApplicable } from "./campaignStoreAdmin";

export type QAIssueType = "error" | "warning" | "info";

export interface QAIssue {
  type: QAIssueType;
  /** Short description shown in the issue card */
  message: string;
  /** Which ad set this issue belongs to (if applicable) */
  rowId?: string;
  rowName?: string;
  /**
   * Which pillar step to navigate to when the user clicks "Fix".
   * 1 = Locations, 2 = Audience, 3 = Delivery, 4 = Platform
   */
  step?: 1 | 2 | 3 | 4;
}

export interface QASummary {
  issues: QAIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  allPassed: boolean;
}

/**
 * Run all QA checks against the current builder state.
 * Pass `adSets`, `campaigns`, `creatives`, `ads`, and `settings`.
 */
export function runQAChecks({
  adSets,
  campaigns,
  // creatives parameter kept for API compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  creatives: _creatives,
  ads,
  settings,
}: {
  adSets: AdSetRow[];
  campaigns: CampaignRow[];
  creatives?: CreativeRow[];
  ads: AdRow[];
  settings: BuildSettings;
}): QASummary {
  const issues: QAIssue[] = [];

  // ── Global checks ─────────────────────────────────────────────────────────
  if (!settings.tokenId || !settings.adAccountId) {
    issues.push({ type: "error", message: "Ad account not configured — go to Settings to connect your Meta account" });
  }
  if (campaigns.filter(c => c.name).length === 0) {
    issues.push({ type: "error", message: "No campaigns defined" });
  }
  if (adSets.length === 0) {
    issues.push({ type: "error", message: "No ad sets defined" });
  }
  // (creative count check is surfaced via the per-ad mapping check below)
  if (ads.filter(a => a.adName).length === 0) {
    issues.push({ type: "warning", message: "No ads assembled yet — map creatives to ad sets in the Ads pillar" });
  }

  // ── Per-ad-set checks ─────────────────────────────────────────────────────
  adSets.forEach(row => {
    const ref = { rowId: row.id, rowName: row.name || `(unnamed ad set ${row.id.slice(-4)})` };

    // Required fields
    if (!row.name) {
      issues.push({ type: "error", message: "Missing ad set name", ...ref });
    }
    if (!row.campaignName) {
      issues.push({ type: "error", message: "No campaign assigned", ...ref });
    }
    if (!row.budget || parseFloat(row.budget) <= 0) {
      issues.push({ type: "error", message: "Missing or zero budget", ...ref, step: 3 });
    }
    if (!row.startDate) {
      issues.push({ type: "error", message: "Missing start date", ...ref, step: 3 });
    }
    if (!row.optimizationGoal) {
      issues.push({ type: "warning", message: "No optimization goal set", ...ref, step: 3 });
    }

    // Conversion event required when goal is conversion-based
    if (row.optimizationGoal && conversionEventApplicable(row.optimizationGoal) && !row.conversionEvent) {
      issues.push({ type: "error", message: "Conversion event required for this optimization goal", ...ref, step: 3 });
    }

    // Placements
    if (!row.placements.length && row.placementType !== "advantage_plus") {
      issues.push({ type: "warning", message: "No placements selected (will default to Advantage+)", ...ref, step: 4 });
    }

    // Targeting
    if (!row.geoLocations) {
      issues.push({ type: "warning", message: "No location targeting set (broad — all countries)", ...ref, step: 1 });
    }
    if (!row.detailedInterests && !row.targetedAudiences) {
      issues.push({ type: "info", message: "No interest or custom audience targeting (broad)", ...ref, step: 2 });
    }

    // Age range sanity
    if (row.ageMin && row.ageMax && parseInt(row.ageMin) > parseInt(row.ageMax)) {
      issues.push({ type: "error", message: `Age range invalid: min (${row.ageMin}) > max (${row.ageMax})`, ...ref, step: 2 });
    }

    // End date before start date
    if (row.startDate && row.endDate) {
      const start = new Date(row.startDate).getTime();
      const end = new Date(row.endDate).getTime();
      if (!isNaN(start) && !isNaN(end) && end <= start) {
        issues.push({ type: "error", message: "End date must be after start date", ...ref, step: 3 });
      }
    }

    // Ad mapped to this ad set?
    const hasAd = ads.some(a => a.adSetId === row.id || a.adSetName === row.name || a.adSetName === row.name);
    if (!hasAd) {
      issues.push({ type: "warning", message: "No ads mapped to this ad set", ...ref });
    }
  });

  const errorCount = issues.filter(i => i.type === "error").length;
  const warningCount = issues.filter(i => i.type === "warning").length;
  const infoCount = issues.filter(i => i.type === "info").length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    allPassed: errorCount === 0 && warningCount === 0,
  };
}
