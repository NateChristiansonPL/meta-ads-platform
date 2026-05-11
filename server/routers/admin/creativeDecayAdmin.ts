import { TRPCError } from "@trpc/server";
import axios from "axios";
import crypto from "node:crypto";
import { and, between, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb, getTokenById } from "../../db";
import { adPerformance, adSourceDetails, creativeFatigueResults, metaSyncHistory } from "../../../drizzle/schema";

const META_BASE = "https://graph.facebook.com/v21.0";

type MetaAction = { action_type: string; value: string };
type InsightRow = {
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  publisher_platform?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  spend?: string;
  cpm?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
};

type CreativeMeta = {
  creativeId: string;
  mediaType: string | null;
  imageUrl: string | null;
  imageHash: string | null;
  videoId: string | null;
  contentFingerprint: string;
  destinationUrl: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  ctaType: string | null;
  sourcePayload: Record<string, unknown>;
};

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  return next({ ctx });
});

const cleanAccountId = (value: string) => value.replace(/^act_/, "");
const actAccountId = (value: string) => `act_${cleanAccountId(value)}`;
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dec = (value: unknown, scale = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(scale) : null;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function actionValue(actions: MetaAction[] | undefined, keys: string[]) {
  const found = actions?.find((action) => keys.includes(action.action_type));
  return found ? num(found.value) : 0;
}

function costValue(actions: MetaAction[] | undefined, keys: string[]) {
  const found = actions?.find((action) => keys.includes(action.action_type));
  return found ? num(found.value) : null;
}

function firstText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length) return firstText(value[0]);
  if (value && typeof value === "object" && "text" in value) return firstText((value as { text?: unknown }).text);
  return null;
}

function buildFingerprint(creativeId: string, imageHash: string | null, videoId: string | null) {
  const basis = imageHash ? `image:${imageHash}` : videoId ? `video:${videoId}` : `creative:${creativeId}`;
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 24);
}

function parseCreative(adId: string, payload: Record<string, unknown>): CreativeMeta | null {
  const creative = payload.creative as Record<string, unknown> | undefined;
  if (!creative?.id) return null;
  const objectStorySpec = creative.object_story_spec as Record<string, unknown> | undefined;
  const assetFeedSpec = creative.asset_feed_spec as Record<string, unknown> | undefined;
  const linkData = objectStorySpec?.link_data as Record<string, unknown> | undefined;
  const videoData = objectStorySpec?.video_data as Record<string, unknown> | undefined;
  const firstTitle = Array.isArray(assetFeedSpec?.titles) ? assetFeedSpec?.titles[0] : undefined;
  const firstBody = Array.isArray(assetFeedSpec?.bodies) ? assetFeedSpec?.bodies[0] : undefined;
  const imageHash = String(creative.image_hash ?? linkData?.image_hash ?? "") || null;
  const videoId = String(videoData?.video_id ?? "") || null;
  const creativeId = String(creative.id);
  const mediaType = String(creative.object_type ?? (videoId ? "VIDEO" : imageHash ? "IMAGE" : "UNKNOWN"));
  return {
    creativeId,
    mediaType,
    imageUrl: String(creative.thumbnail_url ?? linkData?.picture ?? "") || null,
    imageHash,
    videoId,
    contentFingerprint: buildFingerprint(creativeId, imageHash, videoId),
    destinationUrl: String(linkData?.link ?? "") || null,
    primaryText: firstText(linkData?.message) ?? firstText(videoData?.message) ?? firstText(firstBody),
    headline: firstText(linkData?.name) ?? firstText(firstTitle),
    description: firstText(linkData?.description),
    ctaType: String((linkData?.call_to_action as Record<string, unknown> | undefined)?.type ?? "") || null,
    sourcePayload: { adId, creative },
  };
}

async function metaGetAll(path: string, params: Record<string, string>, accessToken: string) {
  const out: unknown[] = [];
  let url: string | null = `${META_BASE}${path}`;
  let page = 0;
  while (url && page < 50) {
    const response = await axios.get(url, { params: page === 0 ? { ...params, access_token: accessToken } : undefined, timeout: 60000 });
    const data = response.data as { data?: unknown[]; paging?: { next?: string } };
    out.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
    page += 1;
  }
  return out;
}

async function fetchInsights(accessToken: string, accountId: string, dateFrom: string, dateTo: string, campaignIds: string[]) {
  const filtering = campaignIds.length ? JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]) : undefined;
  return (await metaGetAll(`/${actAccountId(accountId)}/insights`, {
    level: "ad",
    time_increment: "1",
    breakdowns: "publisher_platform",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    fields: "account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,publisher_platform,impressions,reach,frequency,spend,cpm,clicks,ctr,cpc,actions,cost_per_action_type",
    limit: "500",
    ...(filtering ? { filtering } : {}),
  }, accessToken)) as InsightRow[];
}

async function fetchCreativeMap(accessToken: string, adIds: string[]) {
  const map = new Map<string, CreativeMeta>();
  for (const adId of adIds) {
    try {
      const response = await axios.get(`${META_BASE}/${adId}`, {
        params: { fields: "creative{id,name,object_type,image_hash,thumbnail_url,object_story_spec,asset_feed_spec}", access_token: accessToken },
        timeout: 30000,
      });
      const parsed = parseCreative(adId, response.data as Record<string, unknown>);
      if (parsed) map.set(adId, parsed);
    } catch (error) {
      console.warn(`[CreativeDecay] Creative lookup failed for ad ${adId}`, error);
    }
  }
  return map;
}

function resultMetric(row: InsightRow) {
  const priority = [
    { label: "Lead", keys: ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"] },
    { label: "Purchase", keys: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"] },
    { label: "Landing page view", keys: ["landing_page_view"] },
    { label: "Link click", keys: ["link_click"] },
    { label: "ThruPlay", keys: ["video_thruplay_watched_actions"] },
    { label: "Video view", keys: ["video_view"] },
    { label: "Post engagement", keys: ["post_engagement"] },
  ];
  for (const metric of priority) {
    const value = actionValue(row.actions, metric.keys);
    if (value > 0) return { results: value, costPerResult: costValue(row.cost_per_action_type, metric.keys), convEvent: metric.label };
  }
  return { results: 0, costPerResult: null, convEvent: null };
}

async function syncMetaPerformance(input: { accessToken: string; accountId: string; campaignIds: string[]; dateFrom: string; dateTo: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured." });
  const started = Date.now();
  const warnings: string[] = [];
  const rows = (await fetchInsights(input.accessToken, input.accountId, input.dateFrom, input.dateTo, input.campaignIds)).filter((row) => num(row.spend) > 0 || num(row.impressions) > 0);
  const adIds = Array.from(new Set(rows.map((row) => row.ad_id).filter(Boolean) as string[]));
  const creativeMap = await fetchCreativeMap(input.accessToken, adIds);
  if (creativeMap.size < adIds.length) warnings.push(`${adIds.length - creativeMap.size} ads had performance but no resolved creative metadata.`);

  for (const row of rows) {
    const meta = row.ad_id ? creativeMap.get(row.ad_id) : undefined;
    if (meta) {
      const details = {
        creativeId: meta.creativeId,
        accountId: row.account_id ?? cleanAccountId(input.accountId),
        campaignId: row.campaign_id ?? null,
        adId: row.ad_id ?? null,
        adName: row.ad_name ?? null,
        mediaType: meta.mediaType,
        imageUrl: meta.imageUrl,
        imageHash: meta.imageHash,
        videoId: meta.videoId,
        contentFingerprint: meta.contentFingerprint,
        destinationUrl: meta.destinationUrl,
        primaryText: meta.primaryText,
        headline: meta.headline,
        description: meta.description,
        ctaType: meta.ctaType,
        sourcePayload: meta.sourcePayload,
      };
      await db.insert(adSourceDetails).values(details).onDuplicateKeyUpdate({ set: details });
    }

    const result = resultMetric(row);
    const values = {
      adId: row.ad_id ?? "unknown",
      date: row.date_start ?? input.dateFrom,
      publisherPlatform: row.publisher_platform ?? "unknown",
      accountId: row.account_id ?? cleanAccountId(input.accountId),
      accountName: row.account_name ?? null,
      campaignId: row.campaign_id ?? null,
      campaignName: row.campaign_name ?? null,
      adsetId: row.adset_id ?? null,
      adsetName: row.adset_name ?? null,
      adName: row.ad_name ?? null,
      creativeId: meta?.creativeId ?? null,
      adType: meta?.mediaType ?? null,
      contentFingerprint: meta?.contentFingerprint ?? null,
      imageHash: meta?.imageHash ?? null,
      videoId: meta?.videoId ?? null,
      impressions: Math.round(num(row.impressions)),
      reach: Math.round(num(row.reach)) || null,
      frequency: dec(row.frequency),
      spend: dec(row.spend) ?? "0.0000",
      cpm: dec(row.cpm),
      clicks: Math.round(num(row.clicks)) || null,
      ctr: dec(num(row.ctr) / 100, 6),
      cpc: dec(row.cpc),
      linkClicks: Math.round(actionValue(row.actions, ["link_click"])) || null,
      landingPageViews: Math.round(actionValue(row.actions, ["landing_page_view"])) || null,
      costPerLpv: dec(costValue(row.cost_per_action_type, ["landing_page_view"])),
      results: dec(result.results),
      costPerResult: dec(result.costPerResult),
      convEvent: result.convEvent,
      pageLikes: Math.round(actionValue(row.actions, ["like", "page_like"])) || null,
      postEngagement: Math.round(actionValue(row.actions, ["post_engagement"])) || null,
      pageEngagement: Math.round(actionValue(row.actions, ["page_engagement"])) || null,
      fbLeads: Math.round(actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"])) || null,
      videoViews: Math.round(actionValue(row.actions, ["video_view"])) || null,
      thruplays: Math.round(actionValue(row.actions, ["video_thruplay_watched_actions"])) || null,
    };
    await db.insert(adPerformance).values(values).onDuplicateKeyUpdate({ set: values });
  }

  await db.insert(metaSyncHistory).values({
    mode: "manual",
    accountId: cleanAccountId(input.accountId),
    campaignFilter: input.campaignIds.length ? input.campaignIds.join(",") : null,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    rowsUpserted: rows.length,
    adsProcessed: adIds.length,
    adsetsProcessed: new Set(rows.map((row) => row.adset_id).filter(Boolean)).size,
    durationMs: Date.now() - started,
    status: warnings.length ? "partial" : "success",
    warnings,
  });
  return { rowsUpserted: rows.length, adsProcessed: adIds.length, warnings, durationMs: Date.now() - started };
}

type VisionRow = typeof adPerformance.$inferSelect;
const eventCount = (row: VisionRow) => [row.results, row.fbLeads, row.landingPageViews, row.linkClicks, row.thruplays, row.videoViews, row.pageLikes].map(num).find((value) => value > 0) ?? 0;
const sum = (rows: VisionRow[], selector: (row: VisionRow) => number) => rows.reduce((total, row) => total + selector(row), 0);
function weightedCtr(rows: VisionRow[]) {
  const impressions = sum(rows, (row) => num(row.impressions));
  return impressions ? sum(rows, (row) => num(row.ctr) * num(row.impressions)) / impressions : 0;
}
function ewma(values: number[], alpha = 0.35) {
  return values.reduce<number[]>((series, value, index) => [...series, index ? alpha * value + (1 - alpha) * series[index - 1] : value], []);
}
function classify(score: number, totalEvents: number, cpeDegrade: number, ctrDrop: number) {
  if (totalEvents < 1 && score < 20) return { label: "weak signal", status: "BLOCKED" as const, level: null };
  if (cpeDegrade < -0.1 || ctrDrop < -0.1) return { label: "improving", status: "IMPROVING" as const, level: null };
  if (score >= 70) return { label: "probable fatigue", status: "URGENT" as const, level: "probable" as const };
  if (score >= 50) return { label: "possible fatigue", status: "REFRESH" as const, level: "possible" as const };
  if (score >= 30) return { label: "emerging fatigue", status: "MONITOR" as const, level: "emerging" as const };
  return { label: "none", status: "HEALTHY" as const, level: null };
}

async function analyzeStoredPerformance(input: { accountId: string; campaignIds: string[]; dateFrom: string; dateTo: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured." });
  const filters = [eq(adPerformance.accountId, cleanAccountId(input.accountId)), between(adPerformance.date, input.dateFrom, input.dateTo)];
  if (input.campaignIds.length) filters.push(inArray(adPerformance.campaignId, input.campaignIds));
  const rows = await db.select().from(adPerformance).where(and(...filters));
  const groups = new Map<string, VisionRow[]>();
  for (const row of rows) {
    const key = row.contentFingerprint || (row.creativeId ? `creative:${row.creativeId}` : null);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const analysisRunId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const inserted = [];
  for (const [fingerprint, group] of Array.from(groups.entries())) {
    const dates = Array.from(new Set(group.map((row: VisionRow) => row.date))).sort();
    const half = Math.max(1, Math.floor(dates.length / 2));
    const earlyDates = new Set(dates.slice(0, half));
    const recentDates = new Set(dates.slice(half));
    const early = group.filter((row) => earlyDates.has(row.date));
    const recent = group.filter((row) => recentDates.has(row.date));
    const totalImpressions = Math.round(sum(group, (row) => num(row.impressions)));
    const totalSpend = sum(group, (row) => num(row.spend));
    const totalEvents = sum(group, eventCount);
    const avgCtr = weightedCtr(group);
    const avgFrequency = group.length ? sum(group, (row) => num(row.frequency)) / group.length : 0;
    const earlyCtr = weightedCtr(early);
    const recentCtr = weightedCtr(recent.length ? recent : early);
    const ctrDrop = earlyCtr ? (earlyCtr - recentCtr) / earlyCtr : 0;
    const earlySpend = sum(early, (row) => num(row.spend));
    const recentSpend = sum(recent, (row) => num(row.spend));
    const earlyEvents = sum(early, eventCount);
    const recentEvents = sum(recent, eventCount);
    const earlyCpe = earlyEvents ? earlySpend / earlyEvents : null;
    const recentCpe = recentEvents ? recentSpend / recentEvents : null;
    const cpeDegrade = earlyCpe && recentCpe ? (recentCpe - earlyCpe) / Math.max(earlyCpe, 0.01) : 0;
    const dailyEwma = ewma(dates.map((date) => weightedCtr(group.filter((row) => row.date === date))));
    const ewmaEarly = dailyEwma[Math.min(half - 1, dailyEwma.length - 1)] ?? 0;
    const ewmaLate = dailyEwma[dailyEwma.length - 1] ?? 0;
    const ewmaDrop = ewmaEarly ? (ewmaEarly - ewmaLate) / ewmaEarly : 0;
    const frequencyFatigue = clamp((avgFrequency - 2.5) / 4.5, 0, 1);
    const reliability = totalImpressions >= 100 ? clamp(Math.sqrt(totalImpressions / 5000) * Math.min(1, dates.length / 7), 0.25, 1) : clamp(totalImpressions / 100, 0, 0.3);
    const cpeWeight = totalEvents >= 5 ? 0.35 : 0.15;
    const ctrWeight = totalEvents >= 5 ? 0.30 : 0.45;
    const ewmaWeight = 0.20;
    const freqWeight = totalEvents >= 5 ? 0.15 : 0.20;
    const rawSignal = clamp(cpeDegrade, 0, 1) * cpeWeight + clamp(ctrDrop, 0, 1) * ctrWeight + clamp(ewmaDrop, 0, 1) * ewmaWeight + frequencyFatigue * freqWeight;
    const fatigueScore = clamp(rawSignal * reliability * 100, 0, 100);
    const label = classify(fatigueScore, totalEvents, cpeDegrade, ctrDrop);
    const adNames = Array.from(new Set(group.map((row: VisionRow) => row.adName).filter(Boolean) as string[]));
    const result = {
      analysisRunId,
      accountId: cleanAccountId(input.accountId),
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      contentFingerprint: fingerprint,
      creativeIds: Array.from(new Set(group.map((row: VisionRow) => row.creativeId).filter(Boolean) as string[])),
      adNames,
      representativeName: adNames[0] ?? fingerprint,
      campaignIds: Array.from(new Set(group.map((row: VisionRow) => row.campaignId).filter(Boolean) as string[])),
      campaignName: group.find((row) => row.campaignName)?.campaignName ?? null,
      optimizationGoal: group.find((row) => row.optimizationGoal)?.optimizationGoal ?? null,
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
    };
    await db.insert(creativeFatigueResults).values(result);
    inserted.push(result);
  }
  return { analysisRunId, records: inserted.sort((a, b) => num(b.fatigueScore) - num(a.fatigueScore)).map((row, index) => mapResult({ ...row, id: index + 1 })) };
}

type FatigueResultLike = typeof creativeFatigueResults.$inferSelect | (typeof creativeFatigueResults.$inferInsert & { id?: number });
function mapResult(row: FatigueResultLike) {
  const score = num(row.fatigueScore);
  const label = row.fatigueLabel === "probable fatigue" ? "Probable Fatigue" : row.fatigueLabel === "possible fatigue" ? "Possible Fatigue" : row.fatigueLabel === "emerging fatigue" ? "Emerging Fatigue" : row.fatigueStatus === "IMPROVING" ? "Improving" : row.fatigueStatus === "BLOCKED" ? "Weak Signal" : "No Fatigue Signal";
  return {
    id: row.id ?? 0,
    analysisRunId: row.analysisRunId,
    creativeId: row.contentFingerprint ?? String(row.id),
    creativeName: row.representativeName ?? row.contentFingerprint ?? "Unnamed creative",
    adFormat: row.mediaType?.toLowerCase().includes("video") ? "video" : row.mediaType?.toLowerCase().includes("carousel") ? "carousel" : "image",
    campaignName: row.campaignName ?? "Multiple campaigns",
    compositeAssessment: score >= 80 ? "High-Confidence Fatigue" : label,
    cdrPct: row.ctrDrop === null ? null : num(row.ctrDrop) * 100,
    cdrSignificant: num(row.ctrDrop) > 0.2 && num(row.reliability) > 0.5,
    relCdr: row.cpeDegrade === null ? null : num(row.cpeDegrade) * 100,
    bocpdFired: false,
    cusumFired: row.badgeCtrSplit,
    ewmaFired: row.badgeEwma,
    elasticityFired: row.badgeFrequency,
    totalSpend: num(row.totalSpend),
    totalImpressions: num(row.totalImpressions),
    daysActive: num(row.daysActive),
    marginalCpa: row.recentCpe === null ? null : num(row.recentCpe),
    baselineCpa: row.earlyCpe === null ? null : num(row.earlyCpe),
    fatigueStatus: row.fatigueStatus ?? "HEALTHY",
    fatigueScore: score,
    evidence: {
      avgCtr: num(row.avgCtr),
      avgFrequency: num(row.avgFrequency),
      ewmaDrop: num(row.ewmaDrop),
      reliability: num(row.reliability),
      totalEvents: num(row.totalEvents),
    },
  };
}

export const creativeDecayAdminRouter = router({
  runAnalysis: adminProcedure.input(z.object({
    tokenId: z.number().int().positive(),
    adAccountId: z.string().min(1),
    campaignIds: z.array(z.string()).default([]),
    syncDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    syncDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    analysisDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    analysisDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).mutation(async ({ input }) => {
    const token = await getTokenById(input.tokenId);
    if (!token?.accessToken) throw new TRPCError({ code: "NOT_FOUND", message: "Token not found." });
    const sync = await syncMetaPerformance({ accessToken: token.accessToken, accountId: input.adAccountId, campaignIds: input.campaignIds, dateFrom: input.syncDateFrom, dateTo: input.syncDateTo });
    const analysis = await analyzeStoredPerformance({ accountId: input.adAccountId, campaignIds: input.campaignIds, dateFrom: input.analysisDateFrom, dateTo: input.analysisDateTo });
    return { sync, ...analysis };
  }),

  getLatestResults: adminProcedure.input(z.object({ accountId: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { analysisRunId: null, records: [] };
    const conditions = input?.accountId ? [eq(creativeFatigueResults.accountId, cleanAccountId(input.accountId))] : [];
    const latest = await db.select({ analysisRunId: creativeFatigueResults.analysisRunId }).from(creativeFatigueResults).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(creativeFatigueResults.analyzedAt)).limit(1);
    if (!latest[0]?.analysisRunId) return { analysisRunId: null, records: [] };
    const rows = await db.select().from(creativeFatigueResults).where(eq(creativeFatigueResults.analysisRunId, latest[0].analysisRunId)).orderBy(desc(creativeFatigueResults.fatigueScore));
    return { analysisRunId: latest[0].analysisRunId, records: rows.map(mapResult) };
  }),

  getHistory: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { history: [] };
    const history = await db.select().from(metaSyncHistory).orderBy(desc(metaSyncHistory.createdAt)).limit(input?.limit ?? 10);
    return { history };
  }),
});
