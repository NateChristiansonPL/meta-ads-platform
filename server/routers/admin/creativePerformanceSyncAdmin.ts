/**
 * creativePerformanceSyncAdmin.ts
 *
 * Admin router for syncing Meta ad performance data into the database.
 * Contains ONLY sync logic — no creative decay / fatigue analysis.
 *
 * Procedures:
 *   syncPerformance        — manual sync trigger
 *   getHistory             — recent sync run history
 *   getSchedulerConfig     — read sync scheduler config
 *   saveSyncSchedulerConfig — write sync scheduler config
 *
 * Also exports startCreativePerformanceSyncCron() for server startup.
 */

import { TRPCError } from "@trpc/server";
import axios from "axios";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb, getTokenById } from "../../db";
import {
  adPerformance,
  adSourceDetails,
  adsetGoals,
  metaSyncHistory,
  metaSyncSchedule,
} from "../../../drizzle/schema";

const META_BASE = "https://graph.facebook.com/v21.0";

// ── Helpers ───────────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  return next({ ctx });
});

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

// ── Ad set goal metadata (fetched from Meta Graph API per adset) ─────────────
type AdsetGoalMeta = {
  adsetId: string;
  adsetName: string | null;
  accountId: string | null;
  campaignId: string | null;
  optimizationGoal: string | null;
  // From promoted_object — only present when the ad set explicitly targets a
  // custom conversion (not a standard pixel event).
  customConversionId: string | null;
  // From promoted_object.custom_event_type — e.g. PURCHASE, LEAD, OTHER.
  customEventType: string | null;
  pixelId: string | null;
  // Human-readable label derived at fetch time for use in decay analysis.
  convEventLabel: string | null;
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

const cleanAccountId = (value: string) => value.replace(/^act_/, "");
const actAccountId = (value: string) => `act_${cleanAccountId(value)}`;
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dec = (value: unknown, scale = 4) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(scale) : null;

function actionValue(actions: MetaAction[] | undefined, keys: string[]) {
  const found = actions?.find((a) => keys.includes(a.action_type));
  return found ? num(found.value) : 0;
}
function costValue(actions: MetaAction[] | undefined, keys: string[]) {
  const found = actions?.find((a) => keys.includes(a.action_type));
  return found ? num(found.value) : null;
}
function firstText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length) return firstText(value[0]);
  if (value && typeof value === "object" && "text" in value)
    return firstText((value as { text?: unknown }).text);
  return null;
}

function buildFingerprint(
  creativeId: string,
  imageHash: string | null,
  videoId: string | null,
): string {
  const { createHash } = require("node:crypto");
  return createHash("sha256")
    .update(`${creativeId}:${imageHash ?? ""}:${videoId ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}

function parseCreative(
  adId: string,
  adData: Record<string, unknown>,
): CreativeMeta | null {
  const creative = adData.creative as Record<string, unknown> | undefined;
  if (!creative) return null;
  const creativeId = String(creative.id ?? adId);
  const spec = creative.object_story_spec as Record<string, unknown> | undefined;
  const feed = creative.asset_feed_spec as Record<string, unknown> | undefined;
  const linkData = (spec?.link_data ?? spec?.video_data ?? feed) as
    | Record<string, unknown>
    | undefined;
  const videoData = spec?.video_data as Record<string, unknown> | undefined;
  const firstBody = (feed?.bodies as Array<{ text?: unknown }> | undefined)?.[0];
  const firstTitle = (feed?.titles as Array<{ text?: unknown }> | undefined)?.[0];
  const imageHash = String(creative.image_hash ?? "") || null;
  const videoId =
    String(
      (videoData?.video_id as string | undefined) ??
        (spec?.video_id as string | undefined) ??
        "",
    ) || null;
  const objectType = String(creative.object_type ?? "").toUpperCase();
  const mediaType =
    objectType === "VIDEO" || videoId
      ? "video"
      : objectType === "SHARE" || linkData
        ? "image"
        : null;
  return {
    creativeId,
    mediaType,
    imageUrl:
      String(creative.thumbnail_url ?? linkData?.picture ?? "") || null,
    imageHash,
    videoId,
    contentFingerprint: buildFingerprint(creativeId, imageHash, videoId),
    destinationUrl: String(linkData?.link ?? "") || null,
    primaryText:
      firstText(linkData?.message) ??
      firstText(videoData?.message) ??
      firstText(firstBody) ??
      null,
    headline: firstText(linkData?.name) ?? firstText(firstTitle) ?? null,
    description: firstText(linkData?.description) ?? null,
    ctaType:
      String(
        (linkData?.call_to_action as Record<string, unknown> | undefined)
          ?.type ?? "",
      ) || null,
    sourcePayload: { adId, creative },
  };
}

/**
 * Batch-fetch optimization_goal + promoted_object for a set of ad set IDs.
 * Uses the Meta Batch API (up to 50 per request) to minimise round-trips.
 * Returns a Map<adsetId, AdsetGoalMeta>.
 */
async function fetchAdsetGoals(
  accessToken: string,
  adsetIds: string[],
): Promise<Map<string, AdsetGoalMeta>> {
  const map = new Map<string, AdsetGoalMeta>();
  if (!adsetIds.length) return map;

  // Chunk into batches of 50 (Meta Batch API limit)
  const chunks: string[][] = [];
  for (let i = 0; i < adsetIds.length; i += 50) {
    chunks.push(adsetIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const batch = chunk.map((id) => ({
        method: "GET",
        relative_url: `${id}?fields=id,name,account_id,campaign_id,optimization_goal,promoted_object`,
      }));
      const resp = await axios.post(
        `${META_BASE}/`,
        { batch: JSON.stringify(batch), access_token: accessToken },
        { timeout: 60000 },
      );
      const results = resp.data as Array<{ code: number; body: string }>;
      for (const item of results) {
        if (item.code !== 200) continue;
        try {
          const data = JSON.parse(item.body) as {
            id?: string;
            name?: string;
            account_id?: string;
            campaign_id?: string;
            optimization_goal?: string;
            promoted_object?: {
              pixel_id?: string;
              custom_conversion_id?: string;
              custom_event_type?: string;
              lead_gen_form_id?: string;
            };
          };
          if (!data.id) continue;
          const goal = data.optimization_goal ?? null;
          const po = data.promoted_object ?? {};
          const customConvId = po.custom_conversion_id ?? null;
          const customEventType = po.custom_event_type ?? null;
          const pixelId = po.pixel_id ?? null;

          // Build a human-readable convEventLabel:
          //   - If there's a custom_conversion_id, label it "Custom:{id}"
          //   - If there's a custom_event_type (e.g. PURCHASE, LEAD), use that
          //   - Otherwise fall back to the optimization goal itself
          let convEventLabel: string | null = null;
          if (customConvId) {
            convEventLabel = `Custom:${customConvId}`;
          } else if (customEventType && customEventType !== "OTHER") {
            // Capitalise: PURCHASE → Purchase
            convEventLabel = customEventType.charAt(0).toUpperCase() + customEventType.slice(1).toLowerCase();
          } else if (goal === "OFFSITE_CONVERSIONS") {
            // OTHER or no custom_event_type — Meta scopes results to the pixel's
            // primary event; label as "Conversion" generically
            convEventLabel = "Conversion";
          } else if (goal === "LEAD_GENERATION") {
            convEventLabel = "Lead";
          } else if (goal === "LINK_CLICKS") {
            convEventLabel = "Link click";
          } else if (goal === "LANDING_PAGE_VIEWS") {
            convEventLabel = "Landing page view";
          } else if (goal === "THRUPLAY") {
            convEventLabel = "ThruPlay";
          } else if (goal === "VIDEO_VIEWS") {
            convEventLabel = "Video view";
          } else if (goal === "PAGE_LIKES") {
            convEventLabel = "Page like";
          } else if (goal === "POST_ENGAGEMENT") {
            convEventLabel = "Post engagement";
          } else if (goal === "REACH" || goal === "IMPRESSIONS") {
            convEventLabel = null; // No conversion metric for reach/impressions
          }

          map.set(data.id, {
            adsetId: data.id,
            adsetName: data.name ?? null,
            accountId: data.account_id ? cleanAccountId(data.account_id) : null,
            campaignId: data.campaign_id ?? null,
            optimizationGoal: goal,
            customConversionId: customConvId,
            customEventType,
            pixelId,
            convEventLabel,
          });
        } catch {
          // Skip malformed batch item
        }
      }
    } catch (err) {
      console.warn("[PerformanceSync] fetchAdsetGoals batch failed:", err);
    }
  }
  return map;
}

async function metaGetAll(
  path: string,
  params: Record<string, string>,
  accessToken: string,
) {
  const out: unknown[] = [];
  let url: string | null = `${META_BASE}${path}`;
  let page = 0;
  while (url && page < 50) {
    const response = await axios.get(url, {
      params: page === 0 ? { ...params, access_token: accessToken } : undefined,
      timeout: 60000,
    });
    const data = response.data as {
      data?: unknown[];
      paging?: { next?: string };
    };
    out.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
    page += 1;
  }
  return out;
}

async function fetchInsights(
  accessToken: string,
  accountId: string,
  dateFrom: string,
  dateTo: string,
  campaignIds: string[],
) {
  const filtering = campaignIds.length
    ? JSON.stringify([
        { field: "campaign.id", operator: "IN", value: campaignIds },
      ])
    : undefined;
  return (await metaGetAll(
    `/${actAccountId(accountId)}/insights`,
    {
      level: "ad",
      time_increment: "1",
      breakdowns: "publisher_platform",
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      fields:
        "account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,publisher_platform,impressions,reach,frequency,spend,cpm,clicks,ctr,cpc,actions,cost_per_action_type",
      limit: "500",
      ...(filtering ? { filtering } : {}),
    },
    accessToken,
  )) as InsightRow[];
}

async function fetchCreativeMap(accessToken: string, adIds: string[]) {
  const map = new Map<string, CreativeMeta>();
  for (const adId of adIds) {
    try {
      const response = await axios.get(`${META_BASE}/${adId}`, {
        params: {
          fields:
            "creative{id,name,object_type,image_hash,thumbnail_url,object_story_spec,asset_feed_spec}",
          access_token: accessToken,
        },
        timeout: 30000,
      });
      const parsed = parseCreative(
        adId,
        response.data as Record<string, unknown>,
      );
      if (parsed) map.set(adId, parsed);
    } catch (error) {
      console.warn(
        `[PerformanceSync] Creative lookup failed for ad ${adId}`,
        error,
      );
    }
  }
  return map;
}

/**
 * Goal-aware result metric extraction.
 *
 * When we know the ad set's optimization goal (from adsetGoals), we use the
 * metric that directly corresponds to what Meta is optimising for. This ensures
 * the decay analysis always measures the right event.
 *
 * For OFFSITE_CONVERSIONS with a custom_conversion_id, Meta reports the
 * conversion under the action type `offsite_conversion.custom.{id}`. We look
 * for that specific key first, then fall back to the generic `results` field
 * (which Meta already scopes to the ad set's optimization event).
 *
 * For all other goals we use the dedicated action type column directly.
 * The generic waterfall is only used when no goal metadata is available.
 */
function resultMetric(
  row: InsightRow,
  goalMeta?: AdsetGoalMeta | null,
): { results: number; costPerResult: number | null; convEvent: string | null } {
  const goal = goalMeta?.optimizationGoal ?? null;

  if (goal === "OFFSITE_CONVERSIONS") {
    const customConvId = goalMeta?.customConversionId;
    const label = goalMeta?.convEventLabel ?? "Conversion";
    if (customConvId) {
      // Try the exact custom conversion action type first
      const customKey = `offsite_conversion.custom.${customConvId}`;
      const customVal = actionValue(row.actions, [customKey]);
      if (customVal > 0) {
        return {
          results: customVal,
          costPerResult: costValue(row.cost_per_action_type, [customKey]),
          convEvent: label,
        };
      }
    }
    // Fall back to the generic `results` field — Meta already scopes this to
    // the ad set's optimization event in the API response.
    const genericKeys = [
      "offsite_conversion.fb_pixel_custom",
      "purchase",
      "omni_purchase",
      "offsite_conversion.fb_pixel_purchase",
      "lead",
      "onsite_conversion.lead_grouped",
      "offsite_conversion.fb_pixel_lead",
    ];
    for (const key of genericKeys) {
      const v = actionValue(row.actions, [key]);
      if (v > 0) return { results: v, costPerResult: costValue(row.cost_per_action_type, [key]), convEvent: label };
    }
    return { results: 0, costPerResult: null, convEvent: label };
  }

  if (goal === "LEAD_GENERATION") {
    const keys = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
    const v = actionValue(row.actions, keys);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, keys), convEvent: "Lead" };
  }

  if (goal === "LINK_CLICKS") {
    const v = actionValue(row.actions, ["link_click"]);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, ["link_click"]), convEvent: "Link click" };
  }

  if (goal === "LANDING_PAGE_VIEWS") {
    const v = actionValue(row.actions, ["landing_page_view"]);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, ["landing_page_view"]), convEvent: "Landing page view" };
  }

  if (goal === "THRUPLAY") {
    const v = actionValue(row.actions, ["video_thruplay_watched_actions"]);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, ["video_thruplay_watched_actions"]), convEvent: "ThruPlay" };
  }

  if (goal === "VIDEO_VIEWS") {
    const v = actionValue(row.actions, ["video_view"]);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, ["video_view"]), convEvent: "Video view" };
  }

  if (goal === "PAGE_LIKES") {
    const v = actionValue(row.actions, ["like", "page_like"]);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, ["like", "page_like"]), convEvent: "Page like" };
  }

  if (goal === "POST_ENGAGEMENT") {
    const v = actionValue(row.actions, ["post_engagement"]);
    return { results: v, costPerResult: costValue(row.cost_per_action_type, ["post_engagement"]), convEvent: "Post engagement" };
  }

  if (goal === "REACH" || goal === "IMPRESSIONS") {
    // No conversion metric for reach/impressions — decay uses CTR + frequency only
    return { results: 0, costPerResult: null, convEvent: null };
  }

  // ── Generic waterfall fallback (no goal metadata available) ──────────────────
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
    if (value > 0)
      return { results: value, costPerResult: costValue(row.cost_per_action_type, metric.keys), convEvent: metric.label };
  }
  return { results: 0, costPerResult: null, convEvent: null };
}

// ── Core sync function ────────────────────────────────────────────────────────

export async function syncMetaPerformanceData(input: {
  accessToken: string;
  accountId: string;
  campaignIds: string[];
  dateFrom: string;
  dateTo: string;
  mode?: "manual" | "scheduled";
}) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database is not configured.",
    });
  const started = Date.now();
  const warnings: string[] = [];
  const rows = (
    await fetchInsights(
      input.accessToken,
      input.accountId,
      input.dateFrom,
      input.dateTo,
      input.campaignIds,
    )
  ).filter((row) => num(row.spend) > 0 || num(row.impressions) > 0);
  const adIds = Array.from(
    new Set(rows.map((row) => row.ad_id).filter(Boolean) as string[]),
  );
  const creativeMap = await fetchCreativeMap(input.accessToken, adIds);
  if (creativeMap.size < adIds.length)
    warnings.push(
      `${adIds.length - creativeMap.size} ads had performance but no resolved creative metadata.`,
    );

  // ── Fetch ad set optimization goals + promoted_object ──────────────────────
  // Collect unique adset IDs from insight rows, then batch-fetch their
  // optimization_goal and promoted_object from the Meta Graph API.
  const adsetIds = Array.from(
    new Set(rows.map((row) => row.adset_id).filter(Boolean) as string[]),
  );
  const adsetGoalMap = await fetchAdsetGoals(input.accessToken, adsetIds);

  // Upsert adset goal records into the adset_goals table so the decay analysis
  // can always look up the correct metric without hitting the API again.
  for (const goal of Array.from(adsetGoalMap.values())) {
    const goalRecord = {
      adsetId: goal.adsetId,
      adsetName: goal.adsetName,
      accountId: goal.accountId ?? cleanAccountId(input.accountId),
      campaignId: goal.campaignId,
      optimizationGoal: goal.optimizationGoal,
      customConversionId: goal.customConversionId,
      customEventType: goal.customEventType,
      pixelId: goal.pixelId,
      convEventLabel: goal.convEventLabel,
    };
    await db
      .insert(adsetGoals)
      .values(goalRecord)
      .onDuplicateKeyUpdate({ set: goalRecord });
  }

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
      await db
        .insert(adSourceDetails)
        .values(details)
        .onDuplicateKeyUpdate({ set: details });
    }

    const goalMeta = row.adset_id ? adsetGoalMap.get(row.adset_id) ?? null : null;
    const result = resultMetric(row, goalMeta);
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
      linkClicks:
        Math.round(actionValue(row.actions, ["link_click"])) || null,
      landingPageViews:
        Math.round(actionValue(row.actions, ["landing_page_view"])) || null,
      costPerLpv: dec(
        costValue(row.cost_per_action_type, ["landing_page_view"]),
      ),
      results: dec(result.results),
      costPerResult: dec(result.costPerResult),
      convEvent: result.convEvent,
      // Populate optimizationGoal from the fetched ad set metadata so the
      // decay analysis can use goal-aware metric selection.
      optimizationGoal: goalMeta?.optimizationGoal ?? null,
      pageLikes:
        Math.round(actionValue(row.actions, ["like", "page_like"])) || null,
      postEngagement:
        Math.round(actionValue(row.actions, ["post_engagement"])) || null,
      pageEngagement:
        Math.round(actionValue(row.actions, ["page_engagement"])) || null,
      fbLeads:
        Math.round(
          actionValue(row.actions, [
            "lead",
            "onsite_conversion.lead_grouped",
            "offsite_conversion.fb_pixel_lead",
          ]),
        ) || null,
      videoViews:
        Math.round(actionValue(row.actions, ["video_view"])) || null,
      thruplays:
        Math.round(
          actionValue(row.actions, ["video_thruplay_watched_actions"]),
        ) || null,
    };
    await db
      .insert(adPerformance)
      .values(values)
      .onDuplicateKeyUpdate({ set: values });
  }

  await db.insert(metaSyncHistory).values({
    mode: input.mode ?? "manual",
    accountId: cleanAccountId(input.accountId),
    campaignFilter: input.campaignIds.length
      ? input.campaignIds.join(",")
      : null,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    rowsUpserted: rows.length,
    adsProcessed: adIds.length,
    adsetsProcessed: new Set(
      rows.map((row) => row.adset_id).filter(Boolean),
    ).size,
    durationMs: Date.now() - started,
    status: warnings.length ? "partial" : "success",
    warnings,
  });
  return {
    rowsUpserted: rows.length,
    adsProcessed: adIds.length,
    warnings,
    durationMs: Date.now() - started,
  };
}

// ── Scheduler config helper ───────────────────────────────────────────────────

async function getSyncSchedulerConfig() {
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

export const creativePerformanceSyncAdminRouter = router({
  syncPerformance: adminProcedure
    .input(
      z.object({
        tokenId: z.number().int().positive(),
        adAccountId: z.string().min(1),
        campaignIds: z.array(z.string()).default([]),
        campaignStatusFilter: z
          .enum(["active", "active_30d", "inactive", "all"])
          .default("active"),
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ input }) => {
      const token = await getTokenById(input.tokenId);
      if (!token?.accessToken)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token not found.",
        });
      return syncMetaPerformanceData({
        accessToken: token.accessToken,
        accountId: input.adAccountId,
        campaignIds: input.campaignIds,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        mode: "manual",
      });
    }),

  getHistory: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(50).default(20) })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [] };
      const history = await db
        .select()
        .from(metaSyncHistory)
        .orderBy(desc(metaSyncHistory.createdAt))
        .limit(input?.limit ?? 20);
      return { history };
    }),

  getSchedulerConfig: adminProcedure.query(async () => {
    const config = await getSyncSchedulerConfig();
    return (
      config ?? {
        syncEnabled: false,
        syncUtcHour: 6,
        syncRollingDays: 14,
        syncPreset: "rolling" as const,
        vaultTokenId: null,
        accountId: "",
        campaignIds: null,
        campaignStatusFilter: "active" as const,
        lastRunAt: null,
        lastRunStatus: null,
      }
    );
  }),

  saveSyncSchedulerConfig: adminProcedure
    .input(
      z.object({
        syncEnabled: z.boolean(),
        syncUtcHour: z.number().int().min(0).max(23),
        syncRollingDays: z.number().int().min(1).max(90),
        syncPreset: z.enum(["rolling", "yesterday"]),
        vaultTokenId: z.number().int().positive().nullable(),
        accountId: z.string(),
        campaignIds: z.string().nullable(),
        campaignStatusFilter: z.enum([
          "active",
          "active_30d",
          "inactive",
          "all",
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Database not configured.",
        });
      // Preserve analysis fields when updating sync-only config
      await db
        .insert(metaSyncSchedule)
        .values({ id: 1, ...input })
        .onDuplicateKeyUpdate({ set: input });
      return { ok: true };
    }),
});

// ── Cron scheduler ────────────────────────────────────────────────────────────

export async function startCreativePerformanceSyncCron() {
  const { default: cron } = await import("node-cron");
  cron.schedule("0 * * * *", async () => {
    try {
      const config = await getSyncSchedulerConfig();
      if (!config?.syncEnabled || !config.vaultTokenId || !config.accountId)
        return;
      const nowUtcHour = new Date().getUTCHours();
      if (nowUtcHour !== config.syncUtcHour) return;

      const token = await getTokenById(config.vaultTokenId);
      if (!token?.accessToken) return;

      const today = new Date();
      let dateFrom: string;
      let dateTo: string;
      if (config.syncPreset === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        dateFrom = dateTo = yesterday.toISOString().slice(0, 10);
      } else {
        const from = new Date(today);
        from.setUTCDate(
          from.getUTCDate() - (config.syncRollingDays ?? 14),
        );
        dateFrom = from.toISOString().slice(0, 10);
        dateTo = today.toISOString().slice(0, 10);
      }
      const campaignIds = config.campaignIds
        ? config.campaignIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      try {
        await syncMetaPerformanceData({
          accessToken: token.accessToken,
          accountId: config.accountId,
          campaignIds,
          dateFrom,
          dateTo,
          mode: "scheduled",
        });
        const db = await getDb();
        if (db)
          await db
            .update(metaSyncSchedule)
            .set({ lastRunAt: new Date(), lastRunStatus: "success" })
            .where(eq(metaSyncSchedule.id, 1));
      } catch (e) {
        const db = await getDb();
        if (db)
          await db
            .update(metaSyncSchedule)
            .set({ lastRunAt: new Date(), lastRunStatus: "error" })
            .where(eq(metaSyncSchedule.id, 1));
        console.error("[PerformanceSync Cron] Sync failed:", e);
      }
    } catch (e) {
      console.error("[PerformanceSync Cron] Unexpected error:", e);
    }
  });
  console.log("[PerformanceSync Cron] Hourly scheduler started.");
}
