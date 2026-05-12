/**
 * creativeDecayAdmin.ts
 *
 * Admin router for running creative fatigue / decay analysis.
 * Contains ONLY analysis logic — no Meta API sync, no raw data fetching.
 * Raw ad performance data must already be in the database (populated by
 * the separate creativePerformanceSyncAdmin router).
 *
 * Procedures:
 *   runDecayAnalysis       — manual analysis trigger
 *   getLatestResults       — fetch most recent analysis results
 *   getAnalysisSchedulerConfig     — read analysis scheduler config
 *   saveAnalysisSchedulerConfig    — write analysis scheduler config
 *
 * Also exports startCreativeDecayCron() for server startup.
 */

import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { and, between, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { getTokenById } from "../../db";
import {
  adPerformance,
  creativeFatigueResults,
  metaSyncSchedule,
  firstFatigueDetected,
  decayNotificationLog,
} from "../../../drizzle/schema";
import { notifyOwner } from "../../_core/notification";
import { syncMetaPerformanceData } from "./creativePerformanceSyncAdmin";

// ── Admin guard ───────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  return next({ ctx });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const cleanAccountId = (value: string) => value.replace(/^act_/, "");
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type VisionRow = typeof adPerformance.$inferSelect;

/**
 * Goal-aware event count selector.
 *
 * Returns the single metric that corresponds to what the ad set is optimising
 * for. This ensures CPE calculations in the decay analysis always use the
 * correct denominator — never a proxy metric from a different funnel stage.
 *
 * The `optimizationGoal` and `convEvent` values are populated by the sync
 * router from the ad set's `optimization_goal` and `promoted_object` fields.
 *
 * Weight implications by goal:
 *   REACH / IMPRESSIONS  → no CPE signal; cpeWeight forced to 0 at call site
 *   all others           → use the goal-specific column directly
 *   null / unknown       → generic waterfall fallback (safe)
 */
function goalEventCount(row: VisionRow): number {
  const goal = row.optimizationGoal ?? null;

  if (goal === "OFFSITE_CONVERSIONS") {
    // `results` is already scoped to the ad set's optimization event by Meta.
    // For custom conversions this is the custom event count; for standard
    // pixel events (PURCHASE, LEAD, etc.) it is the standard event count.
    return num(row.results);
  }
  if (goal === "LEAD_GENERATION") return num(row.fbLeads) || num(row.results);
  if (goal === "LINK_CLICKS") return num(row.linkClicks);
  if (goal === "LANDING_PAGE_VIEWS") return num(row.landingPageViews);
  if (goal === "THRUPLAY") return num(row.thruplays);
  if (goal === "VIDEO_VIEWS") return num(row.videoViews);
  if (goal === "PAGE_LIKES") return num(row.pageLikes);
  if (goal === "POST_ENGAGEMENT") return num(row.postEngagement);
  // REACH / IMPRESSIONS: no conversion metric — return 0 so cpeWeight is
  // suppressed by the caller.
  if (goal === "REACH" || goal === "IMPRESSIONS") return 0;

  // Generic waterfall fallback when optimizationGoal is null/unknown.
  return (
    [
      row.results,
      row.fbLeads,
      row.landingPageViews,
      row.linkClicks,
      row.thruplays,
      row.videoViews,
      row.pageLikes,
    ]
      .map(num)
      .find((v) => v > 0) ?? 0
  );
}

/**
 * Whether the optimization goal has a meaningful CPE signal.
 * REACH and IMPRESSIONS campaigns have no conversion denominator so we
 * suppress the CPE weight entirely and redistribute to CTR + EWMA + freq.
 */
function goalHasCpeSignal(goal: string | null): boolean {
  return goal !== "REACH" && goal !== "IMPRESSIONS";
}
const sum = (rows: VisionRow[], selector: (row: VisionRow) => number) =>
  rows.reduce((total, row) => total + selector(row), 0);

function weightedCtr(rows: VisionRow[]) {
  const impressions = sum(rows, (row) => num(row.impressions));
  return impressions
    ? sum(rows, (row) => num(row.ctr) * num(row.impressions)) / impressions
    : 0;
}

function ewma(values: number[], alpha = 0.35) {
  return values.reduce<number[]>(
    (series, value, index) => [
      ...series,
      index ? alpha * value + (1 - alpha) * series[index - 1] : value,
    ],
    [],
  );
}

function classify(
  score: number,
  totalEvents: number,
  cpeDegrade: number,
  ctrDrop: number,
) {
  if (totalEvents < 1 && score < 20)
    return { label: "weak signal", status: "BLOCKED" as const, level: null };
  if (cpeDegrade < -0.1 || ctrDrop < -0.1)
    return { label: "improving", status: "IMPROVING" as const, level: null };
  if (score >= 70)
    return {
      label: "probable fatigue",
      status: "URGENT" as const,
      level: "probable" as const,
    };
  if (score >= 50)
    return {
      label: "possible fatigue",
      status: "REFRESH" as const,
      level: "possible" as const,
    };
  if (score >= 30)
    return {
      label: "emerging fatigue",
      status: "MONITOR" as const,
      level: "emerging" as const,
    };
  return { label: "none", status: "HEALTHY" as const, level: null };
}

// ── Core analysis function ────────────────────────────────────────────────────

async function analyzeStoredPerformance(input: {
  accountId: string;
  campaignIds: string[];
  dateFrom: string;
  dateTo: string;
  onlyLiveAds?: boolean;
}) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database is not configured.",
    });

  const filters = [
    eq(adPerformance.accountId, cleanAccountId(input.accountId)),
    between(adPerformance.date, input.dateFrom, input.dateTo),
  ];
  if (input.campaignIds.length)
    filters.push(inArray(adPerformance.campaignId, input.campaignIds));
  let rows = await db
    .select()
    .from(adPerformance)
    .where(and(...filters));

  // If onlyLiveAds, filter to ad IDs that have data on the most recent date
  if (input.onlyLiveAds) {
    const allDates = Array.from(new Set(rows.map((r) => r.date))).sort();
    const latestDate = allDates[allDates.length - 1];
    if (latestDate) {
      const liveAdIds = new Set(
        rows.filter((r) => r.date === latestDate).map((r) => r.adId),
      );
      rows = rows.filter((r) => liveAdIds.has(r.adId));
    }
  }

  const groups = new Map<string, VisionRow[]>();
  for (const row of rows) {
    const key =
      row.contentFingerprint ||
      (row.creativeId ? `creative:${row.creativeId}` : null);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const analysisRunId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const inserted: Array<typeof creativeFatigueResults.$inferInsert & { id?: number }> = [];

  for (const [fingerprint, group] of Array.from(groups.entries())) {
    const dates = Array.from(
      new Set(group.map((row: VisionRow) => row.date)),
    ).sort();
    const half = Math.max(1, Math.floor(dates.length / 2));
    const earlyDates = new Set(dates.slice(0, half));
    const recentDates = new Set(dates.slice(half));
    const early = group.filter((row) => earlyDates.has(row.date));
    const recent = group.filter((row) => recentDates.has(row.date));
    const totalImpressions = Math.round(
      sum(group, (row) => num(row.impressions)),
    );
    const totalSpend = sum(group, (row) => num(row.spend));
    // Derive the optimization goal for this creative group. All rows in a
    // group share the same ad set (or at least the same account + campaign),
    // so the first non-null value is authoritative.
    const groupGoal =
      group.find((row) => row.optimizationGoal)?.optimizationGoal ?? null;
    const hasCpe = goalHasCpeSignal(groupGoal);

    const totalEvents = sum(group, goalEventCount);
    const avgCtr = weightedCtr(group);
    const avgFrequency = group.length
      ? sum(group, (row) => num(row.frequency)) / group.length
      : 0;
    const earlyCtr = weightedCtr(early);
    const recentCtr = weightedCtr(recent.length ? recent : early);
    const ctrDrop = earlyCtr ? (earlyCtr - recentCtr) / earlyCtr : 0;
    const earlySpend = sum(early, (row) => num(row.spend));
    const recentSpend = sum(recent, (row) => num(row.spend));
    const earlyEvents = sum(early, goalEventCount);
    const recentEvents = sum(recent, goalEventCount);
    const earlyCpe = earlyEvents ? earlySpend / earlyEvents : null;
    const recentCpe = recentEvents ? recentSpend / recentEvents : null;
    const cpeDegrade =
      hasCpe && earlyCpe && recentCpe
        ? (recentCpe - earlyCpe) / Math.max(earlyCpe, 0.01)
        : 0;
    const dailyEwma = ewma(
      dates.map((date) =>
        weightedCtr(group.filter((row) => row.date === date)),
      ),
    );
    const ewmaEarly =
      dailyEwma[Math.min(half - 1, dailyEwma.length - 1)] ?? 0;
    const ewmaLate = dailyEwma[dailyEwma.length - 1] ?? 0;
    const ewmaDrop = ewmaEarly ? (ewmaEarly - ewmaLate) / ewmaEarly : 0;
    const frequencyFatigue = clamp((avgFrequency - 2.5) / 4.5, 0, 1);
    const reliability =
      totalImpressions >= 100
        ? clamp(
            Math.sqrt(totalImpressions / 5000) *
              Math.min(1, dates.length / 7),
            0.25,
            1,
          )
        : clamp(totalImpressions / 100, 0, 0.3);
    // Goal-aware weight distribution:
    //   - REACH/IMPRESSIONS: no CPE signal, redistribute weight to CTR + EWMA
    //   - Conversion goals with enough events: standard weights
    //   - Conversion goals with sparse events: lean on CTR + EWMA
    const cpeWeight = !hasCpe ? 0 : totalEvents >= 5 ? 0.35 : 0.15;
    const ctrWeight = !hasCpe ? 0.55 : totalEvents >= 5 ? 0.3 : 0.45;
    const ewmaWeight = !hasCpe ? 0.3 : 0.2;
    const freqWeight = !hasCpe ? 0.15 : totalEvents >= 5 ? 0.15 : 0.2;
    const rawSignal =
      clamp(cpeDegrade, 0, 1) * cpeWeight +
      clamp(ctrDrop, 0, 1) * ctrWeight +
      clamp(ewmaDrop, 0, 1) * ewmaWeight +
      frequencyFatigue * freqWeight;
    const fatigueScore = clamp(rawSignal * reliability * 100, 0, 100);
    const label = classify(fatigueScore, totalEvents, cpeDegrade, ctrDrop);
    const adNames = Array.from(
      new Set(
        group
          .map((row: VisionRow) => row.adName)
          .filter(Boolean) as string[],
      ),
    );
    const result = {
      analysisRunId,
      accountId: cleanAccountId(input.accountId),
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      contentFingerprint: fingerprint,
      creativeIds: Array.from(
        new Set(
          group
            .map((row: VisionRow) => row.creativeId)
            .filter(Boolean) as string[],
        ),
      ),
      adNames,
      representativeName: adNames[0] ?? fingerprint,
      campaignIds: Array.from(
        new Set(
          group
            .map((row: VisionRow) => row.campaignId)
            .filter(Boolean) as string[],
        ),
      ),
      campaignName:
        group.find((row) => row.campaignName)?.campaignName ?? null,
      optimizationGoal:
        group.find((row) => row.optimizationGoal)?.optimizationGoal ?? null,
      mediaType: group.find((row) => row.adType)?.adType ?? null,
      eligible: totalImpressions >= 100,
      totalSpend: totalSpend.toFixed(4),
      totalImpressions,
      totalEvents: totalEvents.toFixed(4),
      daysActive: dates.length,
      avgCtr: avgCtr.toFixed(6),
      avgFrequency: avgFrequency.toFixed(4),
      earlyCtr: earlyCtr.toFixed(6),
      recentCtr: recentCtr.toFixed(6),
      ctrDrop: ctrDrop.toFixed(6),
      earlySpend: earlySpend.toFixed(4),
      recentSpend: recentSpend.toFixed(4),
      earlyEvents: earlyEvents.toFixed(4),
      recentEvents: recentEvents.toFixed(4),
      earlyCpe: earlyCpe?.toFixed(4) ?? null,
      recentCpe: recentCpe?.toFixed(4) ?? null,
      cpeDegrade: cpeDegrade.toFixed(6),
      ewmaEarly: ewmaEarly.toFixed(6),
      ewmaLate: ewmaLate.toFixed(6),
      ewmaDrop: ewmaDrop.toFixed(6),
      frequencyFatigue: frequencyFatigue.toFixed(4),
      reliability: reliability.toFixed(4),
      cpeWeight: cpeWeight.toFixed(2),
      ctrWeight: ctrWeight.toFixed(2),
      ewmaWeight: ewmaWeight.toFixed(2),
      freqWeight: freqWeight.toFixed(2),
      rawSignal: rawSignal.toFixed(6),
      fatigueScore: fatigueScore.toFixed(2),
      fatigueLabel: label.label,
      fatigueStatus: label.status,
      badgeCpeCdr: cpeDegrade > 0,
      badgeCtrSplit: ctrDrop > 0,
      badgeEwma: ewmaDrop > 0.05,
      badgeFrequency: avgFrequency > 3,
      notificationLevel: label.level,
      // Derive the human-readable label for the metric used in scoring
      convEventLabel: (() => {
        const goal = group.find((r) => r.optimizationGoal)?.optimizationGoal ?? null;
        if (!goal) return null;
        if (goal === 'OFFSITE_CONVERSIONS') {
          const convEvent = group.find((r) => r.convEvent)?.convEvent ?? null;
          if (convEvent) return convEvent;
          return 'Offsite Conversions';
        }
        const GOAL_LABELS: Record<string, string> = {
          LEAD_GENERATION: 'Lead Generation',
          LINK_CLICKS: 'Link Clicks',
          LANDING_PAGE_VIEWS: 'Landing Page Views',
          THRUPLAY: 'ThruPlay',
          VIDEO_VIEWS: 'Video Views',
          PAGE_LIKES: 'Page Likes',
          POST_ENGAGEMENT: 'Post Engagement',
          REACH: 'Reach',
          IMPRESSIONS: 'Impressions',
        };
        return GOAL_LABELS[goal] ?? goal.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      })(),
    };
    await db
      .insert(creativeFatigueResults)
      .values(result)
      .onDuplicateKeyUpdate({ set: result });
    inserted.push(result);

    // Track first-detected dates for fatigue signal levels
    if (label.level) {
      const accountIdClean = cleanAccountId(input.accountId);
      await db
        .insert(firstFatigueDetected)
        .values({
          accountId: accountIdClean,
          contentFingerprint: fingerprint,
          level: label.level,
          representativeName: adNames[0] ?? fingerprint,
        })
        .onDuplicateKeyUpdate({
          set: { representativeName: adNames[0] ?? fingerprint },
        });
    }
  }

  // Load first-detected dates for all fingerprints in this run
  const fingerprintList = inserted
    .map((r) => r.contentFingerprint)
    .filter(Boolean) as string[];
  const firstDetectedMap = new Map<string, Map<string, Date>>();
  if (fingerprintList.length) {
    const fdRows = await db
      .select()
      .from(firstFatigueDetected)
      .where(
        and(
          eq(
            firstFatigueDetected.accountId,
            cleanAccountId(input.accountId),
          ),
          inArray(firstFatigueDetected.contentFingerprint, fingerprintList),
        ),
      );
    for (const fd of fdRows) {
      if (!firstDetectedMap.has(fd.contentFingerprint))
        firstDetectedMap.set(fd.contentFingerprint, new Map());
      firstDetectedMap
        .get(fd.contentFingerprint)!
        .set(fd.level, fd.firstDetectedAt);
    }
  }

  // Build per-fingerprint daily trend series
  const trendByFingerprint = new Map<
    string,
    Array<{
      date: string;
      ctr: number;
      frequency: number;
      impressions: number;
      fatigueScore: number;
    }>
  >();
  for (const [fingerprint, group] of Array.from(groups.entries())) {
    const dates = Array.from(
      new Set(group.map((r: VisionRow) => r.date)),
    ).sort() as string[];
    const series = dates.map((date) => {
      const dayRows = group.filter((r: VisionRow) => r.date === date);
      const dayImpressions = sum(dayRows, (r) => num(r.impressions));
      const dayClicks = sum(dayRows, (r) => num(r.clicks));
      const dayCtr =
        dayImpressions > 0 ? (dayClicks / dayImpressions) * 100 : 0;
      const dayFreq = dayRows.length
        ? sum(dayRows, (r) => num(r.frequency)) / dayRows.length
        : 0;
      const rowsUpToDate = group.filter((r: VisionRow) => r.date <= date);
      const datesUpTo = Array.from(
        new Set(rowsUpToDate.map((r: VisionRow) => r.date)),
      ).sort() as string[];
      const halfUpTo = Math.max(1, Math.floor(datesUpTo.length / 2));
      const earlyD = new Set(datesUpTo.slice(0, halfUpTo));
      const recentD = new Set(datesUpTo.slice(halfUpTo));
      const earlyR = rowsUpToDate.filter((r: VisionRow) => earlyD.has(r.date));
      const recentR = rowsUpToDate.filter((r: VisionRow) =>
        recentD.has(r.date),
      );
      const eCtr = weightedCtr(earlyR);
      const rCtr = weightedCtr(recentR.length ? recentR : earlyR);
      const ctrDropD = eCtr ? (eCtr - rCtr) / eCtr : 0;
      const totalImpD = sum(rowsUpToDate, (r) => num(r.impressions));
      // Use the same goal-aware event count for the trend series
      const trendGoal =
        rowsUpToDate.find((r: VisionRow) => r.optimizationGoal)?.optimizationGoal ?? null;
      const trendHasCpe = goalHasCpeSignal(trendGoal);
      const totalEvD = sum(rowsUpToDate, goalEventCount);
      const eSpend = sum(earlyR, (r) => num(r.spend));
      const rSpend = sum(recentR, (r) => num(r.spend));
      const eEv = sum(earlyR, goalEventCount);
      const rEv = sum(recentR, goalEventCount);
      const eCpe = eEv ? eSpend / eEv : null;
      const rCpe = rEv ? rSpend / rEv : null;
      const cpeDeg =
        trendHasCpe && eCpe && rCpe ? (rCpe - eCpe) / Math.max(eCpe, 0.01) : 0;
      const avgFreqD = rowsUpToDate.length
        ? sum(rowsUpToDate, (r) => num(r.frequency)) / rowsUpToDate.length
        : 0;
      const freqFat = clamp((avgFreqD - 2.5) / 4.5, 0, 1);
      const ewmaVals = ewma(
        datesUpTo.map((d) =>
          weightedCtr(
            rowsUpToDate.filter((r: VisionRow) => r.date === d),
          ),
        ),
      );
      const ewmaE =
        ewmaVals[Math.min(halfUpTo - 1, ewmaVals.length - 1)] ?? 0;
      const ewmaL = ewmaVals[ewmaVals.length - 1] ?? 0;
      const ewmaDropD = ewmaE ? (ewmaE - ewmaL) / ewmaE : 0;
      const rel =
        totalImpD >= 100
          ? clamp(
              Math.sqrt(totalImpD / 5000) *
                Math.min(1, datesUpTo.length / 7),
              0.25,
              1,
            )
          : clamp(totalImpD / 100, 0, 0.3);
      const cpeW = !trendHasCpe ? 0 : totalEvD >= 5 ? 0.35 : 0.15;
      const ctrW = !trendHasCpe ? 0.55 : totalEvD >= 5 ? 0.3 : 0.45;
      const rawSig =
        clamp(cpeDeg, 0, 1) * cpeW +
        clamp(ctrDropD, 0, 1) * ctrW +
        clamp(ewmaDropD, 0, 1) * (!trendHasCpe ? 0.3 : 0.2) +
        freqFat * (!trendHasCpe ? 0.15 : totalEvD >= 5 ? 0.15 : 0.2);
      const dayFatigueScore = clamp(rawSig * rel * 100, 0, 100);
      return {
        date,
        ctr: parseFloat(dayCtr.toFixed(4)),
        frequency: parseFloat(dayFreq.toFixed(3)),
        impressions: Math.round(dayImpressions),
        fatigueScore: parseFloat(dayFatigueScore.toFixed(1)),
      };
    });
    trendByFingerprint.set(fingerprint, series);
  }

  return {
    analysisRunId,
    records: inserted
      .sort((a, b) => num(b.fatigueScore) - num(a.fatigueScore))
      .map((row, index) => ({
        ...mapResult({ ...row, id: index + 1 }, firstDetectedMap),
        trendData:
          trendByFingerprint.get(row.contentFingerprint ?? "") ?? [],
      })),
  };
}

// ── Result mapper ─────────────────────────────────────────────────────────────

type FatigueResultLike =
  | typeof creativeFatigueResults.$inferSelect
  | (typeof creativeFatigueResults.$inferInsert & { id?: number });

function mapResult(
  row: FatigueResultLike,
  firstDetectedMap?: Map<string, Map<string, Date>>,
) {
  const fp = row.contentFingerprint ?? String(row.id);
  const levelMap = firstDetectedMap?.get(fp);
  const firstDetectedAt: Record<string, string | null> = {
    emerging: levelMap?.get("emerging")?.toISOString() ?? null,
    possible: levelMap?.get("possible")?.toISOString() ?? null,
    probable: levelMap?.get("probable")?.toISOString() ?? null,
  };
  const score = num(row.fatigueScore);
  const label =
    row.fatigueLabel === "probable fatigue"
      ? "Probable Fatigue"
      : row.fatigueLabel === "possible fatigue"
        ? "Possible Fatigue"
        : row.fatigueLabel === "emerging fatigue"
          ? "Emerging Fatigue"
          : row.fatigueStatus === "IMPROVING"
            ? "Improving"
            : row.fatigueStatus === "BLOCKED"
              ? "Weak Signal"
              : "No Fatigue Signal";
  return {
    id: row.id ?? 0,
    analysisRunId: row.analysisRunId,
    creativeId: row.contentFingerprint ?? String(row.id),
    creativeName:
      row.representativeName ??
      row.contentFingerprint ??
      "Unnamed creative",
    adFormat: row.mediaType?.toLowerCase().includes("video")
      ? "video"
      : row.mediaType?.toLowerCase().includes("carousel")
        ? "carousel"
        : "image",
    campaignName: row.campaignName ?? "Multiple campaigns",
    compositeAssessment:
      score >= 80 ? "High-Confidence Fatigue" : label,
    cdrPct:
      row.ctrDrop === null ? null : num(row.ctrDrop) * 100,
    cdrSignificant:
      num(row.ctrDrop) > 0.2 && num(row.reliability) > 0.5,
    relCdr:
      row.cpeDegrade === null ? null : num(row.cpeDegrade) * 100,
    bocpdFired: false,
    cusumFired: row.badgeCtrSplit,
    ewmaFired: row.badgeEwma,
    elasticityFired: row.badgeFrequency,
    totalSpend: num(row.totalSpend),
    totalImpressions: num(row.totalImpressions),
    daysActive: num(row.daysActive),
    marginalCpa:
      row.recentCpe === null ? null : num(row.recentCpe),
    baselineCpa:
      row.earlyCpe === null ? null : num(row.earlyCpe),
    fatigueStatus: row.fatigueStatus ?? "HEALTHY",
    fatigueScore: score,
    optimizationGoal: row.optimizationGoal ?? null,
    convEventLabel: row.convEventLabel ?? null,
    evidence: {
      avgCtr: num(row.avgCtr),
      avgFrequency: num(row.avgFrequency),
      ewmaDrop: num(row.ewmaDrop),
      reliability: num(row.reliability),
      totalEvents: num(row.totalEvents),
    },
    firstDetectedAt,
  };
}

// ── Scheduler config helper ───────────────────────────────────────────────────

async function getAnalysisSchedulerConfig() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(metaSyncSchedule)
    .where(eq(metaSyncSchedule.id, 1))
    .limit(1);
  return rows[0] ?? null;
}

// ── Router ────────────────────────────────────────────────────────────────────


// ── Shared trigger logic (used by manual procedure + cron) ──────────────────

/**
 * runDecayChain — the single source of truth for triggering the full
 * sync → analysis pipeline.
 *
 * When vaultTokenId is configured, it runs syncMetaPerformanceData before
 * the analysis so the analysis always sees fresh data.
 *
 * Called by:
 *   - triggerDecayAnalysis procedure (manual on-demand trigger)
 *   - startCreativeDecayCron() (automated daily run)
 */
async function runDecayChain(config: {
  accountId: string;
  campaignIds: string[];
  dateFrom: string;
  dateTo: string;
  onlyLiveAds: boolean;
  notifyEmerging: boolean;
  notifyPossible: boolean;
  notifyProbable: boolean;
  vaultTokenId?: number | null;
  syncPreset?: string | null;
  syncRollingDays?: number | null;
}) {
  const syncWarnings: string[] = [];

  // Step 1: Sync (if token is configured)
  if (config.vaultTokenId) {
    const token = await getTokenById(config.vaultTokenId);
    if (token?.accessToken) {
      try {
        await syncMetaPerformanceData({
          accessToken: token.accessToken,
          accountId: config.accountId,
          campaignIds: config.campaignIds,
          dateFrom: config.dateFrom,
          dateTo: config.dateTo,
          mode: "scheduled",
        });
        console.log(`[DecayChain] Sync completed (${config.dateFrom} to ${config.dateTo})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        syncWarnings.push(`Sync failed: ${msg}`);
        console.warn("[DecayChain] Sync failed, proceeding with existing data:", e);
      }
    } else {
      syncWarnings.push("vaultTokenId configured but token not found.");
    }
  }

  // Step 2: Analysis
  const analysis = await analyzeStoredPerformance({
    accountId: config.accountId,
    campaignIds: config.campaignIds,
    dateFrom: config.dateFrom,
    dateTo: config.dateTo,
    onlyLiveAds: config.onlyLiveAds,
  });

  // Step 3: Notifications
  const triggered = analysis.records.filter((r) => {
    const level =
      r.fatigueStatus === "URGENT" ? "probable"
      : r.fatigueStatus === "REFRESH" ? "possible"
      : r.fatigueStatus === "MONITOR" ? "emerging"
      : null;
    if (!level) return false;
    return (
      (level === "probable" && config.notifyProbable) ||
      (level === "possible" && config.notifyPossible) ||
      (level === "emerging" && config.notifyEmerging)
    );
  });

  if (triggered.length > 0) {
    const lines = triggered.map((r) => {
      const level = r.fatigueStatus === "URGENT" ? "Probable"
        : r.fatigueStatus === "REFRESH" ? "Possible" : "Emerging";
      const firstDate = r.firstDetectedAt?.[level.toLowerCase() as "emerging" | "possible" | "probable"];
      return `- ${r.creativeName} (${level} fatigue, score ${r.fatigueScore.toFixed(0)})${
        firstDate ? ` — first detected ${new Date(firstDate).toLocaleDateString()}` : ""
      }`;
    }).join("\n");
    await notifyOwner({
      title: `Creative Fatigue Alert — ${triggered.length} signal${triggered.length > 1 ? "s" : ""} detected`,
      content: `Analysis (${config.dateFrom} to ${config.dateTo}):\n\n${lines}${
        syncWarnings.length ? `\n\nSync warnings:\n${syncWarnings.join("\n")}` : ""
      }`,
    });
    const dbLog = await getDb();
    if (dbLog) {
      const logRows = triggered.map((r) => {
        const lvl = r.fatigueStatus === "URGENT" ? "probable"
          : r.fatigueStatus === "REFRESH" ? "possible" : "emerging";
        const firstDate = r.firstDetectedAt?.[lvl as "emerging" | "possible" | "probable"];
        return {
          accountId: cleanAccountId(config.accountId),
          adId: r.creativeId ?? "",
          adName: r.creativeName ?? "",
          signalLevel: lvl as "emerging" | "possible" | "probable",
          fatigueScore: Math.round(r.fatigueScore ?? 0),
          firstDetectedAt: firstDate ? new Date(firstDate) : undefined,
          notifiedAt: new Date(),
          dateFrom: config.dateFrom,
          dateTo: config.dateTo,
        };
      });
      if (logRows.length) await dbLog.insert(decayNotificationLog).values(logRows);
    }
  }

  return { analysis, syncWarnings };
}

export const creativeDecayAdminRouter = router({
  // ── Manual analysis trigger ─────────────────────────────────────────────────
  runDecayAnalysis: adminProcedure
    .input(
      z.object({
        adAccountId: z.string().min(1),
        campaignIds: z.array(z.string()).default([]),
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        onlyLiveAds: z.boolean().default(false),
        notifyEmerging: z.boolean().default(false),
        notifyPossible: z.boolean().default(false),
        notifyProbable: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const analysis = await analyzeStoredPerformance({
        accountId: input.adAccountId,
        campaignIds: input.campaignIds,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        onlyLiveAds: input.onlyLiveAds,
      });

      // Send owner notifications for triggered signals
      const triggered = analysis.records.filter((r) => {
        const level =
          r.fatigueStatus === "URGENT"
            ? "probable"
            : r.fatigueStatus === "REFRESH"
              ? "possible"
              : r.fatigueStatus === "MONITOR"
                ? "emerging"
                : null;
        if (!level) return false;
        return (
          (level === "probable" && input.notifyProbable) ||
          (level === "possible" && input.notifyPossible) ||
          (level === "emerging" && input.notifyEmerging)
        );
      });
      if (triggered.length > 0) {
        const lines = triggered
          .map((r) => {
            const level =
              r.fatigueStatus === "URGENT"
                ? "Probable"
                : r.fatigueStatus === "REFRESH"
                  ? "Possible"
                  : "Emerging";
            const firstDate =
              r.firstDetectedAt?.[
                level.toLowerCase() as "emerging" | "possible" | "probable"
              ];
            return `- ${r.creativeName} (${level} fatigue, score ${r.fatigueScore.toFixed(0)})${firstDate ? ` — first detected ${new Date(firstDate).toLocaleDateString()}` : ""}`;
          })
          .join("\n");
        await notifyOwner({
          title: `Creative Fatigue Alert — ${triggered.length} signal${triggered.length > 1 ? "s" : ""} detected`,
          content: `The following creatives triggered fatigue signals in the ${input.dateFrom} to ${input.dateTo} analysis window:\n\n${lines}`,
        });
      }

      return analysis;
    }),

  // ── Latest results ──────────────────────────────────────────────────────────

  // ── On-demand trigger: sync then analysis ───────────────────────────────────
  // Runs the full sync → analysis chain on demand.
  // Reads scheduler config for account/campaigns/date range.
  triggerDecayAnalysis: adminProcedure
    .input(
      z.object({
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        skipSync: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const config = await getAnalysisSchedulerConfig();
      if (!config?.accountId)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No account configured in the analysis scheduler.",
        });

      const today = new Date();
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - (config.analysisRollingDays ?? 14));
      const dateFrom = input.dateFrom ?? from.toISOString().slice(0, 10);
      const dateTo = input.dateTo ?? today.toISOString().slice(0, 10);
      const campaignIds = config.campaignIds
        ? config.campaignIds.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const { analysis, syncWarnings } = await runDecayChain({
        accountId: config.accountId,
        campaignIds,
        dateFrom,
        dateTo,
        onlyLiveAds: config.onlyLiveAds ?? false,
        notifyEmerging: config.notifyEmerging ?? false,
        notifyPossible: config.notifyPossible ?? true,
        notifyProbable: config.notifyProbable ?? true,
        vaultTokenId: input.skipSync ? null : config.vaultTokenId,
        syncPreset: config.syncPreset,
        syncRollingDays: config.syncRollingDays,
      });

      const db = await getDb();
      if (db)
        await db
          .update(metaSyncSchedule)
          .set({ lastAnalysisAt: new Date(), lastAnalysisStatus: "success" })
          .where(eq(metaSyncSchedule.id, 1));

      return {
        analysisRunId: analysis.analysisRunId,
        recordCount: analysis.records.length,
        dateFrom,
        dateTo,
        syncWarnings,
      };
    }),


  getLatestResults: adminProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { analysisRunId: null, records: [] };
      const conditions = input?.accountId
        ? [
            eq(
              creativeFatigueResults.accountId,
              cleanAccountId(input.accountId),
            ),
          ]
        : [];
      const latest = await db
        .select({ analysisRunId: creativeFatigueResults.analysisRunId })
        .from(creativeFatigueResults)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(creativeFatigueResults.analyzedAt))
        .limit(1);
      if (!latest[0]?.analysisRunId)
        return { analysisRunId: null, records: [] };
      const rows = await db
        .select()
        .from(creativeFatigueResults)
        .where(
          eq(
            creativeFatigueResults.analysisRunId,
            latest[0].analysisRunId,
          ),
        )
        .orderBy(desc(creativeFatigueResults.fatigueScore));
      const fpList = rows
        .map((r) => r.contentFingerprint)
        .filter(Boolean) as string[];
      const firstDetectedMap = new Map<string, Map<string, Date>>();
      if (fpList.length && input?.accountId) {
        const fdRows = await db
          .select()
          .from(firstFatigueDetected)
          .where(
            and(
              eq(
                firstFatigueDetected.accountId,
                cleanAccountId(input.accountId),
              ),
              inArray(firstFatigueDetected.contentFingerprint, fpList),
            ),
          );
        for (const fd of fdRows) {
          if (!firstDetectedMap.has(fd.contentFingerprint))
            firstDetectedMap.set(fd.contentFingerprint, new Map());
          firstDetectedMap
            .get(fd.contentFingerprint)!
            .set(fd.level, fd.firstDetectedAt);
        }
      }
      return {
        analysisRunId: latest[0].analysisRunId,
        records: rows.map((r) => mapResult(r, firstDetectedMap)),
      };
    }),

  // ── Analysis scheduler config ───────────────────────────────────────────────
  getAnalysisSchedulerConfig: adminProcedure.query(async () => {
    const config = await getAnalysisSchedulerConfig();
    return (
      config ?? {
        analysisEnabled: false,
        analysisUtcHour: 7,
        analysisRollingDays: 14,
        notifyEmerging: false,
        notifyPossible: true,
        notifyProbable: true,
        onlyLiveAds: false,
        accountId: "",
        campaignIds: null,
        lastAnalysisAt: null,
        lastAnalysisStatus: null,
      }
    );
  }),

  getDecayNotifications: adminProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { notifications: [] };
      const rows = await db
        .select()
        .from(decayNotificationLog)
        .orderBy(desc(decayNotificationLog.notifiedAt))
        .limit(input?.limit ?? 50);
      return { notifications: rows };
    }),

  saveAnalysisSchedulerConfig: adminProcedure
    .input(
      z.object({
        analysisEnabled: z.boolean(),
        analysisUtcHour: z.number().int().min(0).max(23),
        analysisRollingDays: z.number().int().min(1).max(90),
        notifyEmerging: z.boolean(),
        notifyPossible: z.boolean(),
        notifyProbable: z.boolean(),
        onlyLiveAds: z.boolean(),
        accountId: z.string(),
        campaignIds: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Database not configured.",
        });
      // Preserve sync fields when updating analysis-only config
      await db
        .insert(metaSyncSchedule)
        .values({ id: 1, ...input })
        .onDuplicateKeyUpdate({ set: input });
      return { ok: true };
    }),
});

// ── Cron scheduler (analysis only) ───────────────────────────────────────────

export async function startCreativeDecayCron() {
  const { default: cron } = await import("node-cron");
  cron.schedule("0 * * * *", async () => {
    try {
      const config = await getAnalysisSchedulerConfig();
      if (!config?.analysisEnabled || !config.accountId) return;
      const nowUtcHour = new Date().getUTCHours();
      if (nowUtcHour !== config.analysisUtcHour) return;

      const today = new Date();
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - (config.analysisRollingDays ?? 14));
      const dateFrom = from.toISOString().slice(0, 10);
      const dateTo = today.toISOString().slice(0, 10);
      const campaignIds = config.campaignIds
        ? config.campaignIds.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      try {
        // runDecayChain handles sync → analysis → notifications in sequence.
        // Sync is only performed when vaultTokenId is configured (i.e. the
        // sync scheduler has a token set). This guarantees fresh data before
        // every automated analysis run.
        await runDecayChain({
          accountId: config.accountId,
          campaignIds,
          dateFrom,
          dateTo,
          onlyLiveAds: config.onlyLiveAds ?? false,
          notifyEmerging: config.notifyEmerging ?? false,
          notifyPossible: config.notifyPossible ?? true,
          notifyProbable: config.notifyProbable ?? true,
          vaultTokenId: config.vaultTokenId,
          syncPreset: config.syncPreset,
          syncRollingDays: config.syncRollingDays,
        });
        const db = await getDb();
        if (db)
          await db
            .update(metaSyncSchedule)
            .set({ lastAnalysisAt: new Date(), lastAnalysisStatus: "success" })
            .where(eq(metaSyncSchedule.id, 1));
      } catch (e) {
        const db = await getDb();
        if (db)
          await db
            .update(metaSyncSchedule)
            .set({ lastAnalysisAt: new Date(), lastAnalysisStatus: "error" })
            .where(eq(metaSyncSchedule.id, 1));
        console.error("[CreativeDecay Cron] Chain failed:", e);
      }
    } catch (e) {
      console.error("[CreativeDecay Cron] Unexpected error:", e);
    }
  });
  console.log("[CreativeDecay Cron] Analysis scheduler started (sync → analysis chain enabled).");
}
