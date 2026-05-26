/**
 * Meta Ads API Router
 *
 * Handles all Meta Graph API interactions:
 * - Settings validation (token, ad account, page, pixel)
 * - Pixel event fetching
 * - Saved audience search
 * - Reach estimates
 * - Asset upload (image hash, video ID)
 * - Campaign creation (full build, ads-only, update ads)
 */

import { TRPCError } from "@trpc/server";
import axios from "axios";
import FormData from "form-data";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../../_core/trpc";
import { getTokenById } from "../../db";
import { sheetsValuesBatchUpdate, extractSpreadsheetId, type ValueRange } from "./googleSheetsAdmin";
import { makeRequest as mapsRequest } from "../../_core/map";

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function metaGet(
  path: string,
  params: Record<string, string>,
  accessToken: string
) {
  const url = `${META_BASE}${path}`;
  try {
    const resp = await axios.get(url, {
      params: { ...params, access_token: accessToken },
      timeout: 30000,
    });
    return resp.data;
  } catch (err: unknown) {
    // Extract the actual Meta API error message from the axios response body
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string; error_user_msg?: string } } } };
      const metaMsg = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.error?.error_user_msg;
      if (metaMsg) throw new Error(`Meta API: ${metaMsg}`);
    }
    throw err;
  }
}

async function metaPost(
  path: string,
  data: Record<string, unknown>,
  accessToken: string
) {
  const url = `${META_BASE}${path}`;
  const resp = await axios.post(
    url,
    { ...data, access_token: accessToken },
    { timeout: 60000 }
  );
  return resp.data;
}

type RawAdAccount = { id: string; name: string; account_status: number; currency: string };

/**
 * Fetches all pages of a Meta Graph API edge that supports cursor-based pagination.
 * Follows the `paging.cursors.after` cursor until no next page is returned.
 * Caps at 20 pages (4,000 accounts) as a safety guard.
 */
async function metaGetAllPages(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<unknown[]> {
  const MAX_PAGES = 20;
  const results: unknown[] = [];
  let after: string | undefined;
  let page = 0;

  while (page < MAX_PAGES) {
    const pageParams: Record<string, string> = { ...params, access_token: accessToken };
    if (after) pageParams.after = after;

    const url = `${META_BASE}${path}`;
    let data: { data?: unknown[]; paging?: { cursors?: { after?: string }; next?: string } };
    try {
      const resp = await axios.get(url, { params: pageParams, timeout: 30000 });
      data = resp.data;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        const metaMsg = axiosErr.response?.data?.error?.message;
        if (metaMsg) throw new Error(`Meta API: ${metaMsg}`);
      }
      throw err;
    }

    const items = data.data || [];
    results.push(...items);
    page++;

    // Stop if there's no next page cursor
    const nextAfter = data.paging?.cursors?.after;
    if (!nextAfter || !data.paging?.next) break;
    after = nextAfter;
  }

  return results;
}

function normalizeAdAccountId(raw: string): string {
  const stripped = raw.replace(/^act_/, "");
  return `act_${stripped}`;
}


function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map(v => stripUndefinedDeep(v))
      .filter(v => v !== undefined && v !== null && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || v === null || v === "") continue;
      const cleaned = stripUndefinedDeep(v);
      if (cleaned === undefined || cleaned === null) continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned as Record<string, unknown>).length === 0) continue;
      out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

/**
 * Build the degrees_of_freedom_spec for a given ad type.
 * Each format has a specific required set of OPT_OUT fields per the
 * creative_payload_branch_logic.md reference in pl-meta-builder.
 */
function buildDegreesOfFreedomSpec(adType: 'static' | 'video' | 'carousel' | 'source_post' = 'static'): Record<string, unknown> {
  const off = { enroll_status: "OPT_OUT" };
  // Base fields shared across image, video, and carousel
  const base: Record<string, unknown> = {
    adapt_to_placement:           off,
    add_text_overlay:             off,
    creative_stickers:            off,
    description_automation:       off,
    enhance_cta:                  off,
    generate_cta:                 off,
    image_background_gen:         off,
    image_brightness_and_contrast: off,
    image_templates:              off,
    image_touchups:               off,
    image_uncrop:                 off,
    inline_comment:               off,
    media_type_automation:        off,
    pac_relaxation:               off,
    product_extensions:           off,
    reveal_details_over_time:     off,
    text_optimizations:           off,
    text_translation:             off,
    video_auto_crop:              off,
  };
  if (adType === 'video') {
    // Video adds video_filtering on top of base
    return { creative_features_spec: { ...base, video_filtering: off } };
  }
  if (adType === 'carousel') {
    // Carousel uses the shared base set only.
    // profile_end_card, carousel_highlight_card, and video_highlights were removed
    // from the accepted set by the Meta API and must NOT be sent.
    return { creative_features_spec: base };
  }
  // image / source_post: base fields only
  return { creative_features_spec: base };
}

/**
 * Build the 5-label placement customization rules per pl-meta-builder spec.
 * Labels: lbl_fb_story, lbl_fb_reels, lbl_ig_story, lbl_ig_reels, lbl_default
 * @param mediaType 'image' | 'video' — determines whether to use image_label or video_label
 */
function buildPlacementCustomizationRules(mediaType: 'image' | 'video' = 'image'): Record<string, unknown>[] {
  const mediaKey = mediaType === 'video' ? 'video_label' : 'image_label';
  return [
    {
      customization_spec: { publisher_platforms: ["facebook"], facebook_positions: ["story"] },
      [mediaKey]:     { name: "lbl_fb_story" },
      body_label:     { name: "lbl_fb_story" },
      title_label:    { name: "lbl_fb_story" },
      link_url_label: { name: "lbl_fb_story" },
      priority: 1,
    },
    {
      customization_spec: { publisher_platforms: ["facebook"], facebook_positions: ["facebook_reels"] },
      [mediaKey]:     { name: "lbl_fb_reels" },
      body_label:     { name: "lbl_fb_reels" },
      title_label:    { name: "lbl_fb_reels" },
      link_url_label: { name: "lbl_fb_reels" },
      priority: 2,
    },
    {
      customization_spec: { publisher_platforms: ["instagram"], instagram_positions: ["story"] },
      [mediaKey]:     { name: "lbl_ig_story" },
      body_label:     { name: "lbl_ig_story" },
      title_label:    { name: "lbl_ig_story" },
      link_url_label: { name: "lbl_ig_story" },
      priority: 3,
    },
    {
      customization_spec: { publisher_platforms: ["instagram"], instagram_positions: ["reels"] },
      [mediaKey]:     { name: "lbl_ig_reels" },
      body_label:     { name: "lbl_ig_reels" },
      title_label:    { name: "lbl_ig_reels" },
      link_url_label: { name: "lbl_ig_reels" },
      priority: 4,
    },
    {
      customization_spec: {},
      [mediaKey]:     { name: "lbl_default" },
      title_label:    { name: "lbl_default" },
      link_url_label: { name: "lbl_default" },
      priority: 5,
    },
  ];
}

async function getAdPreviewLink(adId: string, accessToken: string): Promise<string> {
  const formats = ["DESKTOP_FEED_STANDARD", "MOBILE_FEED_STANDARD", "INSTAGRAM_STANDARD", "INSTAGRAM_STORY"];
  for (const ad_format of formats) {
    try {
      const preview = await metaGet(`/${adId}/previews`, { ad_format }, accessToken);
      const body = (preview.data as Array<{ body?: string }>)?.[0]?.body;
      const match = body?.match(/href=\"([^\"]+)\"/);
      if (match?.[1]) return match[1].replace(/&amp;/g, "&");
      if (body) return body;
    } catch {
      // Try the next format.
    }
  }
  return "";
}

function readReachBounds(data: Record<string, unknown>): { lower: number; upper: number } {
  const directLower = Number(data.users_lower_bound || 0);
  const directUpper = Number(data.users_upper_bound || 0);
  if (directLower || directUpper) return { lower: directLower, upper: directUpper };
  const first = (data.data as Array<Record<string, unknown>> | undefined)?.[0] || {};
  return {
    lower: Number(first.estimate_mau_lower_bound || first.users_lower_bound || 0),
    upper: Number(first.estimate_mau_upper_bound || first.users_upper_bound || 0),
  };
}

// ─── Input Schemas ─────────────────────────────────────────────────────────────

const MetaSettingsInput = z.object({
  accessToken: z.string().min(1),
  adAccountId: z.string().min(1),
  pageId: z.string().min(1),
  instagramActorId: z.string().optional(),
  pixelId: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const metaAdminRouter = router({
  /**
   * Fetch campaigns for a given adAccountId using a tokenId stored in the vault.
   * Keeps the raw accessToken server-side — never exposed to the frontend.
   */
  getCampaignsByTokenId: protectedProcedure
    .input(
      z.object({
        tokenId: z.number().int().positive(),
        adAccountId: z.string().min(1),
        statusFilter: z.enum(["active", "active_30d", "inactive", "all"]).default("active"),
      })
    )
    .query(async ({ input }) => {
      const { tokenId, adAccountId, statusFilter } = input;
      const tokenRecord = await getTokenById(tokenId);
      if (!tokenRecord?.accessToken) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
      }
      const accountId = normalizeAdAccountId(adAccountId);
      // Build effective_status filter based on statusFilter
      let effectiveStatus: string;
      if (statusFilter === "active") {
        effectiveStatus = '["ACTIVE"]';
      } else if (statusFilter === "active_30d") {
        // Fetch active + paused (we'll filter by date client-side or just return all active/paused)
        effectiveStatus = '["ACTIVE","PAUSED","CAMPAIGN_PAUSED"]';
      } else if (statusFilter === "inactive") {
        effectiveStatus = '["PAUSED","ARCHIVED","DELETED","CAMPAIGN_PAUSED"]';
      } else {
        // all
        effectiveStatus = '["ACTIVE","PAUSED","ARCHIVED","CAMPAIGN_PAUSED"]';
      }
      try {
        const data = await metaGet(
          `/${accountId}/campaigns`,
          {
            fields: "id,name,status,objective",
            limit: "200",
            effective_status: effectiveStatus,
          },
          tokenRecord.accessToken
        );
        return {
          campaigns: (data.data || []).map(
            (c: { id: string; name: string; status: string; objective: string }) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              objective: c.objective,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch campaigns: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Resolve the raw accessToken for a given tokenId.
   * Used by the Campaign Builder to populate settings.accessToken from the vault.
   * The token is returned to the frontend so the builder can use it in API calls.
   * Only accessible to authenticated users.
   */
  getBuilderToken: protectedProcedure
    .input(z.object({ tokenId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const tokenRecord = await getTokenById(input.tokenId);
      if (!tokenRecord?.accessToken) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
      }
      return { accessToken: tokenRecord.accessToken };
    }),

  /**
   * Validate Meta credentials — token, ad account, page, pixel.
   * Returns validated names/labels so the UI can confirm they're correct.
   */
  validateSettings: publicProcedure
    .input(MetaSettingsInput)
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, pageId, instagramActorId, pixelId } =
        input;
      const accountId = normalizeAdAccountId(adAccountId);

      const results: {
        token: boolean;
        adAccount: { valid: boolean; name?: string; currency?: string };
        page: { valid: boolean; name?: string };
        instagram: { valid: boolean; name?: string } | null;
        pixel: { valid: boolean; name?: string } | null;
        errors: string[];
      } = {
        token: false,
        adAccount: { valid: false },
        page: { valid: false },
        instagram: null,
        pixel: null,
        errors: [],
      };

      // 1. Validate token
      try {
        await metaGet("/me", { fields: "id,name" }, accessToken);
        results.token = true;
      } catch {
        results.errors.push("Access token is invalid or expired.");
        return results;
      }

      // 2. Validate ad account
      try {
        const acct = await metaGet(
          `/${accountId}`,
          { fields: "id,name,currency,account_status" },
          accessToken
        );
        results.adAccount = {
          valid: acct.account_status === 1,
          name: acct.name,
          currency: acct.currency,
        };
        if (acct.account_status !== 1) {
          results.errors.push(
            `Ad account status is ${acct.account_status} (expected 1 = ACTIVE).`
          );
        }
      } catch {
        results.errors.push(`Ad account ${accountId} not found or not accessible.`);
      }

      // 3. Validate page
      try {
        const page = await metaGet(
          `/${pageId}`,
          { fields: "id,name" },
          accessToken
        );
        results.page = { valid: true, name: page.name };
      } catch {
        results.errors.push(`Facebook Page ID ${pageId} not found or not accessible.`);
      }

      // 4. Validate Instagram actor (optional)
      if (instagramActorId) {
        try {
          const ig = await metaGet(
            `/${instagramActorId}`,
            { fields: "id,name,username" },
            accessToken
          );
          results.instagram = { valid: true, name: ig.username || ig.name };
        } catch {
          results.errors.push(
            `Instagram Actor ID ${instagramActorId} not found or not accessible.`
          );
          results.instagram = { valid: false };
        }
      }

      // 5. Validate pixel (optional)
      if (pixelId) {
        try {
          const px = await metaGet(
            `/${pixelId}`,
            { fields: "id,name" },
            accessToken
          );
          results.pixel = { valid: true, name: px.name };
        } catch {
          results.errors.push(`Pixel ID ${pixelId} not found or not accessible.`);
          results.pixel = { valid: false };
        }
      }

      return results;
    }),

  /**
   * Fetch pixel custom events for the conversion event selector.
   */
  getPixelEvents: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        pixelId: z.string().min(1),
        adAccountId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, pixelId, adAccountId } = input;
      try {
        const eventSet = new Set<string>();

        // 1. Standard pixel events fired in the last 30 days (pixel stats edge)
        try {
          const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
          const statsData = await metaGet(
            `/${pixelId}/stats`,
            { aggregation: "event", start_time: String(thirtyDaysAgo) },
            accessToken
          );
          for (const bucket of statsData.data || []) {
            for (const item of (bucket.data || [])) {
              if (item.value) eventSet.add(item.value as string);
            }
          }
        } catch {
          // pixel stats may fail if pixel has no recent events — continue
        }

        // 2. Custom conversions defined on the ad account (separate from pixel events)
        const customConversions: { id: string; name: string }[] = [];
        if (adAccountId) {
          try {
            const accountId = normalizeAdAccountId(adAccountId);
            const ccData = await metaGet(
              `/${accountId}/customconversions`,
              { fields: "id,name,pixel", limit: "200" },
              accessToken
            );
            for (const cc of ccData.data || []) {
              if (cc.id && cc.name) {
                customConversions.push({ id: cc.id as string, name: cc.name as string });
              }
            }
          } catch {
            // custom conversions may not be accessible — continue
          }
        }

        const events = Array.from(eventSet).sort();
        return { events, customConversions };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch pixel events: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Search Meta targeting (interests, behaviors, demographics).
   */
  searchTargeting: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        query: z.string().min(2),
        type: z
          .enum(["adinterest", "behaviors", "demographics", "adgeolocation"])
          .default("adinterest"),
        location_types: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId, query, type } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const params: Record<string, string> = { q: query, type, limit: "20" };
        if (input.location_types && input.location_types.length > 0) {
          params.location_types = JSON.stringify(input.location_types);
        }
        const data = await metaGet(
          `/${accountId}/targetingsearch`,
          params,
          accessToken
        );
        return {
          results: (data.data || []).map(
            (item: {
              key?: string;
              id?: string;
              name: string;
              type?: string;
              country_code?: string;
              region?: string;
              audience_size_lower_bound?: number;
              audience_size_upper_bound?: number;
            }) => ({
              id: item.key || item.id || '',
              name: item.name,
              type: item.type,
              countryCode: item.country_code,
              region: item.region,
              audienceSizeLower: item.audience_size_lower_bound,
              audienceSizeUpper: item.audience_size_upper_bound,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Targeting search failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Search Meta geo locations (cities, regions, countries, zips).
   * Uses /search?type=adgeolocation — NOT the targeting search endpoint.
   */
  searchGeoLocations: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        query: z.string().min(1),
        location_types: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, query } = input;
      try {
        const params: Record<string, string> = {
          q: query,
          type: "adgeolocation",
          limit: "20",
        };
        if (input.location_types && input.location_types.length > 0) {
          params.location_types = JSON.stringify(input.location_types);
        }
        // Correct endpoint: /search (no account prefix)
        const data = await metaGet("/search", params, accessToken);
        return {
          results: (data.data || []).map(
            (item: {
              key: string;
              name: string;
              type: string;
              country_code?: string;
              country_name?: string;
              region?: string;
              region_id?: string;
            }) => ({
              key: item.key,
              name: item.name,
              type: item.type,
              countryCode: item.country_code,
              countryName: item.country_name,
              region: item.region,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Geo location search failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    }),

  /**
   * Fetch saved audiences for the ad account.
   */
  getSavedAudiences: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const data = await metaGet(
          `/${accountId}/saved_audiences`,
          { fields: "id,name,approximate_count", limit: "200" },
          accessToken
        );
        return {
          audiences: (data.data || []).map(
            (a: { id: string; name: string; approximate_count?: number }) => ({
              id: a.id,
              name: a.name,
              approximateCount: a.approximate_count,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch saved audiences: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Fetch custom audiences (Custom and Lookalike) for the ad account.
   */
  getCustomAudiences: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        // search is used for client-side filtering only — Meta API does not support a search param on customaudiences
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId, search } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        // approximate_count was deprecated in API v21+; use lower/upper bounds instead
        const params: Record<string, string> = {
          fields: "id,name,approximate_count_lower_bound,approximate_count_upper_bound,subtype",
          limit: "500",
        };
        // Do NOT pass search to the API — it's not a valid param and causes 400s.
        // We fetch all and filter client-side.
        const data = await metaGet(
          `/${accountId}/customaudiences`,
          params,
          accessToken
        );
        return {
          audiences: (data.data || [])
            .filter((a: { name: string }) =>
              !search || a.name.toLowerCase().includes(search.toLowerCase())
            )
            .map(
              (a: { id: string; name: string; approximate_count_lower_bound?: number; approximate_count_upper_bound?: number; subtype?: string }) => ({
                id: a.id,
                name: a.name,
                // Use midpoint of lower/upper bounds as approximate count
                approximateCount: a.approximate_count_lower_bound != null
                  ? Math.round((a.approximate_count_lower_bound + (a.approximate_count_upper_bound ?? a.approximate_count_lower_bound)) / 2)
                  : undefined,
                subtype: a.subtype, // CUSTOM, LOOKALIKE, etc.
              })
            ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch custom audiences: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Get reach estimate for a targeting spec.
   */
  getReachEstimate: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        targetingSpec: z.record(z.string(), z.unknown()),
        optimizationGoal: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, targetingSpec, optimizationGoal } =
        input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const data = await metaGet(
          `/${accountId}/delivery_estimate`,
          {
            targeting_spec: JSON.stringify(targetingSpec),
            optimization_goal: optimizationGoal || "REACH",
          },
          accessToken
        );
        const { lower, upper } = readReachBounds(data);
        return {
          users: upper,
          usersLowerBound: lower,
          usersUpperBound: upper,
          estimateMau: upper,
          estimateDau: undefined,
          estimateReady: lower > 0 || upper > 0,
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Reach estimate failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Upload an image to Meta and return the image hash.
   * The client sends the image as a base64-encoded string.
   */
  uploadImage: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        imageBase64: z.string().min(1),
        fileName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, imageBase64, fileName } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const form = new FormData();
        form.append("access_token", accessToken);
        form.append(
          "bytes",
          Buffer.from(imageBase64, "base64"),
          { filename: fileName, contentType: "image/jpeg" }
        );

        const resp = await axios.post(
          `${META_BASE}/${accountId}/adimages`,
          form,
          { headers: form.getHeaders(), timeout: 60000 }
        );
        const images = resp.data.images;
        const key = Object.keys(images)[0];
        const hash = images[key]?.hash;
        if (!hash) throw new Error("No hash returned from Meta");
        return { hash, fileName: key };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Image upload failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Upload a video to Meta and return the video ID.
   * The client sends the video as a base64-encoded string.
   */
  uploadVideo: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        videoBase64: z.string().min(1),
        fileName: z.string().min(1),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, videoBase64, fileName, title } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const form = new FormData();
        form.append("access_token", accessToken);
        form.append(
          "source",
          Buffer.from(videoBase64, "base64"),
          { filename: fileName, contentType: "video/mp4" }
        );
        if (title) form.append("title", title);

        const resp = await axios.post(
          `${META_BASE}/${accountId}/advideos`,
          form,
          { headers: form.getHeaders(), timeout: 300000 }
        );
        const videoId = resp.data.id;
        if (!videoId) throw new Error("No video ID returned from Meta");
        return { videoId };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Video upload failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Poll video processing status.
   */
  getVideoStatus: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        videoId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, videoId } = input;
      try {
        const data = await metaGet(
          `/${videoId}`,
          { fields: "id,status,picture" },
          accessToken
        );
        return {
          videoId,
          status: data.status?.video_status || "unknown",
          thumbnailUrl: data.picture,
          ready: data.status?.video_status === "ready",
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to get video status: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Fetch existing campaigns for the ad account (for the "Ads Only" mode).
   */
  getCampaigns: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const data = await metaGet(
          `/${accountId}/campaigns`,
          {
            fields: "id,name,status,objective",
            limit: "200",
            effective_status: '["ACTIVE","PAUSED","CAMPAIGN_PAUSED"]',
          },
          accessToken
        );
        return {
          campaigns: (data.data || []).map(
            (c: { id: string; name: string; status: string; objective: string }) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              objective: c.objective,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch campaigns: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Fetch ad sets for a campaign (for the "Ads Only" mode).
   */
  getAdSets: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        campaignId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, campaignId } = input;
      try {
        const data = await metaGet(
          `/${campaignId}/adsets`,
          {
            fields: "id,name,status,daily_budget,lifetime_budget",
            limit: "200",
          },
          accessToken
        );
        return {
          adSets: (data.data || []).map(
            (a: { id: string; name: string; status: string; daily_budget?: string; lifetime_budget?: string }) => ({
              id: a.id,
              name: a.name,
              status: a.status,
              dailyBudget: a.daily_budget,
              lifetimeBudget: a.lifetime_budget,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch ad sets: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Create a campaign.
   * Returns the created campaign ID.
   */
  createCampaign: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        name: z.string().min(1),
        objective: z.string().min(1),
        status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
        spendCapCents: z.number().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        // Issue 2: cbo flag → is_adset_budget_sharing_enabled must always be explicit
        cbo: z.boolean().optional(),
        // specialAdCategories: array of special ad category strings; empty array = no special category
        specialAdCategories: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, name, objective, status, spendCapCents, startTime, endTime, cbo, specialAdCategories } = input;
      const accountId = normalizeAdAccountId(adAccountId);

      // Duplicate check
      try {
        const existing = await metaGet(
          `/${accountId}/campaigns`,
          { fields: "id,name", limit: "200" },
          accessToken
        );
        const dup = (existing.data || []).find(
          (c: { name: string }) => c.name.toLowerCase() === name.toLowerCase()
        );
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Campaign "${name}" already exists (ID: ${dup.id}). Skipping to prevent duplicate.`,
          });
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        // If duplicate check fails, continue with creation
      }

      const payload: Record<string, unknown> = {
        name,
        objective,
        status,
        // Issue 1: special_ad_categories must always be an array, never a string
        // Use provided categories if any, otherwise empty array (= no special category)
        special_ad_categories: specialAdCategories && specialAdCategories.length > 0 ? specialAdCategories : [],
        // Issue 2: is_adset_budget_sharing_enabled must be explicitly set based on cbo flag.
        // Meta requires this field to be present when CBO is off; omitting it causes an API error.
        is_adset_budget_sharing_enabled: cbo === true,
      };
      if (spendCapCents) payload.spend_cap = spendCapCents;
      if (startTime) payload.start_time = startTime;
      if (endTime) payload.stop_time = endTime;

      const data = await metaPost(`/${accountId}/campaigns`, payload, accessToken);
      return { campaignId: data.id };
    }),

  /**
   * Create an ad set.
   * Returns the created ad set ID.
   */
  createAdSet: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        campaignId: z.string().min(1),
        name: z.string().min(1),
        status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
        optimizationGoal: z.string().min(1),
        billingEvent: z.string().min(1),
        budgetType: z.enum(["daily", "lifetime"]).default("lifetime"),
        budgetCents: z.number().min(1),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        targeting: z.record(z.string(), z.unknown()),
        attributionSpec: z.array(z.record(z.string(), z.unknown())).optional(),
        frequencyControl: z.record(z.string(), z.unknown()).optional(),
        adScheduling: z.array(z.record(z.string(), z.unknown())).optional(),
        conversionLocation: z.string().optional(),
        pixelId: z.string().optional(),
        customEventType: z.string().optional(),
        customConversionId: z.string().optional(),
        leadGenFormId: z.string().optional(),
        facebookPageId: z.string().optional(),
        instagramProfileId: z.string().optional(),
        // Issue 4/5: objective is needed to gate promoted_object and attribution_spec correctly
        objective: z.string().optional(),
        // Bid strategy fields
        bidStrategy: z.string().optional(),   // e.g. LOWEST_COST_WITHOUT_CAP, COST_CAP, LOWEST_COST_WITH_BID_CAP, LOWEST_COST_WITH_MIN_ROAS
        bidAmount: z.number().optional(),     // cents (for COST_CAP and LOWEST_COST_WITH_BID_CAP)
        roasFloor: z.number().optional(),     // decimal ROAS floor (for LOWEST_COST_WITH_MIN_ROAS)
        // destination_type: inferred from conversionLocation on the client, passed explicitly here
        destinationType: z.string().optional(),
        // pacing_type: 'standard' or 'day_parting' (auto-set based on adScheduling presence)
        pacingType: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const {
        accessToken, adAccountId, campaignId, name, status,
        optimizationGoal, billingEvent, budgetType, budgetCents,
        startTime, endTime, targeting, attributionSpec, frequencyControl, adScheduling,
        conversionLocation, pixelId, customEventType, customConversionId, leadGenFormId, facebookPageId, instagramProfileId,
        objective, bidStrategy, bidAmount, roasFloor, destinationType, pacingType,
      } = input;
      const accountId = normalizeAdAccountId(adAccountId);

      // Duplicate check within campaign
      try {
        const existing = await metaGet(
          `/${campaignId}/adsets`,
          { fields: "id,name", limit: "200" },
          accessToken
        );
        const dup = (existing.data || []).find(
          (a: { name: string }) => a.name.toLowerCase() === name.toLowerCase()
        );
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ad set "${name}" already exists in this campaign (ID: ${dup.id}). Skipping to prevent duplicate.`,
          });
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
      }

      const payload: Record<string, unknown> = {
        name,
        campaign_id: campaignId,
        status,
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        targeting,
      };

      if (budgetType === "daily") {
        payload.daily_budget = budgetCents;
      } else {
        payload.lifetime_budget = budgetCents;
        if (endTime) payload.end_time = endTime;
      }

      if (startTime) payload.start_time = startTime;

      // Fix 5: attribution_spec rules by objective.
      // OUTCOME_TRAFFIC: Meta rejects ALL attribution_spec values with error 1885501
      //   (validated across LANDING_PAGE_VIEWS, LINK_CLICKS, IMPRESSIONS, REACH on v19+v21).
      //   Omit the key entirely — do NOT send null, undefined, or an empty array.
      // All other objectives: always send the canonical 3-event spec.
      if (objective !== 'OUTCOME_TRAFFIC') {
        payload.attribution_spec = [
          { event_type: 'CLICK_THROUGH',       window_days: 7 },
          { event_type: 'ENGAGED_VIDEO_VIEW',  window_days: 1 },
          { event_type: 'VIEW_THROUGH',        window_days: 1 },
        ];
      }
      // For OUTCOME_TRAFFIC: attribution_spec key is omitted entirely.

      if (adScheduling?.length) payload.adset_schedule = adScheduling;

      // pacing_type: must be 'day_parting' when a schedule is set, otherwise 'standard'
      if (pacingType?.length) payload.pacing_type = pacingType;

      // destination_type: inferred from conversionLocation
      if (destinationType) payload.destination_type = destinationType;

      // bid_strategy: always send explicitly (defaults to LOWEST_COST_WITHOUT_CAP = Highest Volume)
      payload.bid_strategy = bidStrategy || 'LOWEST_COST_WITHOUT_CAP';
      // bid_amount: required for COST_CAP and LOWEST_COST_WITH_BID_CAP (in cents)
      if (bidAmount && (bidStrategy === 'COST_CAP' || bidStrategy === 'LOWEST_COST_WITH_BID_CAP')) {
        payload.bid_amount = bidAmount;
      }
      // roas_average_floor: required for LOWEST_COST_WITH_MIN_ROAS
      if (roasFloor && bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS') {
        payload.roas_average_floor = roasFloor;
      }
      if (frequencyControl?.enabled) {
        const times = Number(frequencyControl.times || 1);
        const days = Number(frequencyControl.days || 7);
        if (Number.isFinite(times) && Number.isFinite(days)) {
          payload.frequency_control_specs = [{ event: "IMPRESSIONS", interval_days: days, max_frequency: times }];
        }
      }

      // Issues 4 & 5: promoted_object rules are objective-specific.
      //
      // OUTCOME_TRAFFIC: Meta does NOT accept promoted_object at the ad set level for traffic
      //   campaigns optimizing toward LANDING_PAGE_VIEWS or LINK_CLICKS. The pixel is attached
      //   via tracking_specs at the ad level instead. Omit promoted_object entirely.
      //
      // OUTCOME_SALES / OUTCOME_LEADS: use pixel_id + custom_event_type + custom_conversion_id.
      //   When a custom conversion is selected, pass custom_conversion_id in promoted_object.
      //   Meta requires custom_event_type to be set alongside custom_conversion_id.
      //
      // All other objectives (AWARENESS, ENGAGEMENT, etc.): include page_id / instagram_profile_id
      //   when required; pixel_id only when a pixel is configured.
      const promotedObject: Record<string, unknown> = {};
      if (objective !== 'OUTCOME_TRAFFIC') {
        if (customConversionId) {
          // Custom conversion: Meta's native UI sends pixel_id + custom_event_type: "OTHER" + custom_conversion_id together
          promotedObject.custom_conversion_id = customConversionId;
          promotedObject.custom_event_type = 'OTHER';
          if (pixelId) promotedObject.pixel_id = pixelId;
        } else if (pixelId) {
          // Standard pixel event: use pixel_id + custom_event_type
          promotedObject.pixel_id = pixelId;
          if (objective === 'OUTCOME_SALES' || objective === 'OUTCOME_LEADS') {
            promotedObject.custom_event_type = customEventType || 'OTHER';
          } else if (customEventType) {
            promotedObject.custom_event_type = customEventType;
          }
        }
        if (leadGenFormId) promotedObject.lead_gen_form_id = leadGenFormId;
        if (facebookPageId) promotedObject.page_id = facebookPageId;
        if (instagramProfileId) promotedObject.instagram_profile_id = instagramProfileId;
        if (Object.keys(promotedObject).length) payload.promoted_object = promotedObject;
      }
      // For OUTCOME_TRAFFIC: pixel is attached at the ad level via tracking_specs only.

      // Debug: log the final payload being sent to Meta
      console.log('[createAdSet] promoted_object:', JSON.stringify(payload.promoted_object));
      console.log('[createAdSet] customConversionId input:', customConversionId);
      console.log('[createAdSet] customEventType input:', customEventType);
      console.log('[createAdSet] objective:', objective);
      console.log('[createAdSet] pixelId:', pixelId);
      console.log('[createAdSet] targeting.publisher_platforms:', JSON.stringify((targeting as Record<string, unknown>).publisher_platforms));

      const data = await metaPost(`/${accountId}/adsets`, stripUndefinedDeep(payload), accessToken);
      return { adSetId: data.id };
    }),

  /**
   * Create an ad with full creative spec.
   * Supports static (asset_feed_spec), video (asset_feed_spec or object_story_spec),
   * and carousel (object_story_spec).
   * All Advantage+ enhancements explicitly disabled.
   */
  createAd: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        adSetId: z.string().min(1),
        pageId: z.string().min(1),
        instagramActorId: z.string().optional(),
        pixelId: z.string().optional(),
        name: z.string().min(1),
        status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
        adType: z.enum(["static", "video", "carousel"]),
        // For static / placement-customized video: asset_feed_spec path
        feedAssetId: z.string().optional(),   // image hash or video ID for feed
        storiesAssetId: z.string().optional(), // image hash or video ID for stories/reels
        // For single-video (feed only): object_story_spec path
        singleVideoId: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        // Carousel cards
        cards: z.array(z.object({
          assetId: z.string(),
          headline: z.string().optional(),
          description: z.string().optional(),
          linkUrl: z.string(),
          callToAction: z.string().optional(),
        })).optional(),
        // Copy
        headlines: z.array(z.string()).min(1),
        primaryTexts: z.array(z.string()).min(1),
        descriptions: z.array(z.string()).optional(),
        callToAction: z.string().min(1),
        // URLs
        websiteUrl: z.string().min(1),
        feedWebsiteUrl: z.string().optional(),
        storiesWebsiteUrl: z.string().optional(),
        feedPrimaryText: z.string().optional(),
        storiesPrimaryText: z.string().optional(),
        leadGenFormId: z.string().optional(),
        urlParameters: z.string().optional(),
        displayUrl: z.string().optional(),
        // Post ID (dark post / social proof)
        sourcePostId: z.string().optional(),
        // Placements
        placements: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const {
        accessToken, adAccountId, adSetId, pageId, instagramActorId, pixelId,
        name, status, adType,
        feedAssetId, storiesAssetId, singleVideoId, thumbnailUrl, cards,
        headlines, primaryTexts, descriptions, callToAction,
        websiteUrl, feedWebsiteUrl, storiesWebsiteUrl, feedPrimaryText, storiesPrimaryText, leadGenFormId, urlParameters, displayUrl,
        sourcePostId, placements,
      } = input;
      const accountId = normalizeAdAccountId(adAccountId);

      // ── Helper: normalize text (smart quotes → ASCII) ──────────────────────
      const normalize = (s: string) =>
        s
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/\u2013|\u2014/g, "-")
          .replace(/\u2026/g, "...");

      // ── URL building — UTMs go into url_tags ONLY, never appended to the URL ──
      // Meta has a dedicated url_tags field for UTM parameters. Appending them to
      // the website URL causes double-encoding and breaks reporting attribution.
      const baseUrl = websiteUrl;
      const feedUrl = feedWebsiteUrl ?? baseUrl;
      const storiesUrl = storiesWebsiteUrl ?? baseUrl;

      // appendParams is still used for carousel card links (per-card URL overrides)
      // but NOT for the top-level website URL.
      const appendParams = (url: string, params?: string) => {
        if (!params) return url;
        return url.includes("?") ? `${url}&${params}` : `${url}?${params}`;
      };

      // ── Degrees of freedom spec (format-specific OPT_OUT fields) ───────────
      const degreesOfFreedomSpec = buildDegreesOfFreedomSpec(
        sourcePostId ? 'source_post' : adType
      );
      // ── contextual_multi_ads: always OPT_OUT (required by Meta spec) ─────────
      const contextualMultiAds = { enroll_status: "OPT_OUT" };

      // ── Pixel tracking ─────────────────────────────────────────────────────
      const trackingSpec = pixelId
        ? [{ action_type: ["offsite_conversion"], fb_pixel: [pixelId] }]
        : undefined;

      let creativeSpec: Record<string, unknown>;

      // ── If source post ID is provided, use existing post ───────────────────
      if (sourcePostId) {
        // ── Source post (dark post / social proof) ─────────────────────────
        creativeSpec = {
          object_story_id: sourcePostId,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        };
      } else if (adType === "carousel" && cards && cards.length > 0) {
        // ── Carousel: always object_story_spec (no asset_feed_spec branch) ──
        const childAttachments = cards.map((card) => {
          const att: Record<string, unknown> = {
            link: appendParams(card.linkUrl, urlParameters),
            image_hash: card.assetId,
            multi_share_end_card: false,
          };
          if (card.headline) att.name = normalize(card.headline);
          if (card.description) att.description = normalize(card.description);
          if (card.callToAction) {
            att.call_to_action = {
              type: card.callToAction,
              value: { link: appendParams(card.linkUrl, urlParameters) },
            };
          }
          return att;
        });

        const carouselLinkData: Record<string, unknown> = {
          link: baseUrl,
          message: normalize(primaryTexts[0]),
          multi_share_end_card: false,
          multi_share_optimized: false,
          child_attachments: childAttachments,
          call_to_action: { type: callToAction, value: stripUndefinedDeep({ link: baseUrl, lead_gen_form_id: leadGenFormId }) },
        };
        // Note: display_url is NOT supported in carousel object_story_spec link_data.
        // It is only valid in asset_feed_spec link_urls entries.

        const carouselObjectStorySpec: Record<string, unknown> = {
          page_id: pageId,
          link_data: carouselLinkData,
        };
        if (instagramActorId) carouselObjectStorySpec.instagram_user_id = instagramActorId;

        creativeSpec = {
          object_story_spec: carouselObjectStorySpec,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        };
      } else if (adType === "video" && singleVideoId && !storiesAssetId) {
        // ── Single video (feed only): object_story_spec ────────────────────
        const videoData: Record<string, unknown> = {
          video_id: singleVideoId,
          message: normalize(primaryTexts[0]),
          call_to_action: {
            type: callToAction,
            value: { link: baseUrl },
          },
          link: baseUrl,
        };
        if (thumbnailUrl) videoData.image_url = thumbnailUrl;
        if (headlines[0]) videoData.title = normalize(headlines[0]);
        // description field for video ads (shown below the video in feed)
        if (descriptions?.[0]) videoData.description = normalize(descriptions[0]);
        if (urlParameters) videoData.url_tags = urlParameters;

        const singleVideoObjectStorySpec: Record<string, unknown> = {
          page_id: pageId,
          video_data: videoData,
        };
        if (instagramActorId) singleVideoObjectStorySpec.instagram_user_id = instagramActorId;

        creativeSpec = {
          object_story_spec: stripUndefinedDeep(singleVideoObjectStorySpec),
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        };
      } else if ((adType === "static" || adType === "video") && feedAssetId && storiesAssetId) {
        // ── Placement-customized image or video: asset_feed_spec (5-label scheme) ──
        const mediaType = adType === 'video' ? 'video' : 'image';
        const isVideo = adType === 'video';

        // 5-label ad_labels
        const adLabels = [
          { name: "lbl_default" },
          { name: "lbl_fb_story" },
          { name: "lbl_fb_reels" },
          { name: "lbl_ig_story" },
          { name: "lbl_ig_reels" },
        ];

        // Assets: feed → lbl_default; stories/reels → the 4 story/reels labels
        const storyReelsLabels = [
          { name: "lbl_fb_story" },
          { name: "lbl_fb_reels" },
          { name: "lbl_ig_story" },
          { name: "lbl_ig_reels" },
        ];

        const assetFeedSpec: Record<string, unknown> = {
          ad_formats: ["AUTOMATIC_FORMAT"],
          optimization_type: "PLACEMENT",
          call_to_action_types: [callToAction],
          ad_labels: adLabels,
        };

        if (isVideo) {
          assetFeedSpec.videos = [
            { video_id: feedAssetId, adlabels: [{ name: "lbl_default" }], ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) },
            { video_id: storiesAssetId, adlabels: storyReelsLabels, ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) },
          ];
        } else {
          assetFeedSpec.images = [
            { hash: feedAssetId, adlabels: [{ name: "lbl_default" }] },
            { hash: storiesAssetId, adlabels: storyReelsLabels },
          ];
        }

        // Bodies (primary text)
        // Issue 7: Meta error 1815809 — duplicate text entries in asset_feed_spec are rejected.
        // If feed and stories text are identical, use a single entry covering all labels.
        const feedBody = normalize(feedPrimaryText || primaryTexts[0]);
        const storyBody = normalize(storiesPrimaryText || primaryTexts[0]);
        if (feedBody === storyBody) {
          assetFeedSpec.bodies = [
            { text: feedBody, adlabels: adLabels },
          ];
        } else {
          assetFeedSpec.bodies = [
            { text: feedBody, adlabels: [{ name: "lbl_default" }] },
            { text: storyBody, adlabels: storyReelsLabels },
          ];
        }

        // Titles (headline)
        assetFeedSpec.titles = headlines.map((h) => ({ text: normalize(h) }));

        // Descriptions — same dedup rule: if text is the same for all placements, use one entry
        if (descriptions && descriptions.length > 0) {
          const descText = normalize(descriptions[0]);
          assetFeedSpec.descriptions = [
            { text: descText, adlabels: adLabels },
          ];
        }

        // Link URLs — single shared URL or per-placement override
        const allLabels = [
          { name: "lbl_default" },
          { name: "lbl_fb_story" },
          { name: "lbl_fb_reels" },
          { name: "lbl_ig_story" },
          { name: "lbl_ig_reels" },
        ];
        if (feedUrl !== storiesUrl) {
          assetFeedSpec.link_urls = [
            { website_url: feedUrl, ...(displayUrl ? { display_url: displayUrl } : {}), adlabels: [{ name: "lbl_default" }] },
            { website_url: storiesUrl, ...(displayUrl ? { display_url: displayUrl } : {}), adlabels: storyReelsLabels },
          ];
        } else {
          assetFeedSpec.link_urls = [
            { website_url: feedUrl, ...(displayUrl ? { display_url: displayUrl } : {}), adlabels: allLabels },
          ];
        }

        if (urlParameters) assetFeedSpec.url_tags = urlParameters;

        assetFeedSpec.asset_customization_rules = buildPlacementCustomizationRules(mediaType);

        // Fix 8: Meta requires an object_story_spec anchor alongside asset_feed_spec
        // for placement-customized creatives. Without it the API returns error 100 / 1885390.
        // The anchor must contain ONLY page_id (and instagram_user_id when present).
        const assetFeedAnchor: Record<string, unknown> = { page_id: pageId };
        if (instagramActorId) assetFeedAnchor.instagram_user_id = instagramActorId;
        creativeSpec = stripUndefinedDeep({
          asset_feed_spec: assetFeedSpec,
          object_story_spec: assetFeedAnchor,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
          ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
        });
      } else {
        // ── Standard image or video (single asset, no placement customization): object_story_spec ──
        const objectStorySpec: Record<string, unknown> = { page_id: pageId };
        if (instagramActorId) objectStorySpec.instagram_user_id = instagramActorId;

        if (adType === 'video' && feedAssetId) {
          const videoData: Record<string, unknown> = {
            video_id: feedAssetId,
            message: normalize(primaryTexts[0]),
            call_to_action: { type: callToAction, value: { link: feedUrl } },
            link: feedUrl,
          };
          if (thumbnailUrl) videoData.image_url = thumbnailUrl;
          if (headlines[0]) videoData.title = normalize(headlines[0]);
          // description field for video ads (shown below the video in feed)
          if (descriptions?.[0]) videoData.description = normalize(descriptions[0]);
          if (urlParameters) videoData.url_tags = urlParameters;
          objectStorySpec.video_data = videoData;
        } else {
          // Standard image: link_data with image_hash
          const linkData: Record<string, unknown> = {
            link: feedUrl,
            message: normalize(primaryTexts[0]),
            call_to_action: { type: callToAction, value: stripUndefinedDeep({ link: feedUrl, lead_gen_form_id: leadGenFormId }) },
          };
          if (feedAssetId) linkData.image_hash = feedAssetId;
          if (headlines[0]) linkData.name = normalize(headlines[0]);
          if (descriptions?.[0]) linkData.description = normalize(descriptions[0]);
          if (displayUrl) linkData.display_url = displayUrl;
          if (urlParameters) linkData.url_tags = urlParameters;
          objectStorySpec.link_data = linkData;
        }

        creativeSpec = stripUndefinedDeep({
          object_story_spec: objectStorySpec,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        });
      }

      // ── Create ad creative ─────────────────────────────────────────────────
      const creativePayload: Record<string, unknown> = {
        name: `${name} Creative`,
        ...creativeSpec,
      };

      const creativeData = await metaPost(
        `/${accountId}/adcreatives`,
        stripUndefinedDeep(creativePayload),
        accessToken
      );
      const creativeId = creativeData.id;
      if (!creativeId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Meta did not return a creative ID.",
        });
      }

      // ── Create ad ──────────────────────────────────────────────────────────
      const adPayload: Record<string, unknown> = {
        name,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status,
      };
      if (trackingSpec) adPayload.tracking_specs = trackingSpec;

      const adData = await metaPost(`/${accountId}/ads`, adPayload, accessToken);
      const adId = adData.id;
      if (!adId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Meta did not return an ad ID.",
        });
      }

      // ── Fetch preview link ─────────────────────────────────────────────────
      const previewLink = await getAdPreviewLink(adId, accessToken);

      return { adId, creativeId, previewLink };
    }),

  /**
   * Update an existing ad creative in-place (for the "Update Ads" mode).
   * Fetches the existing creative ID and POSTs updated fields to it.
   * No new IDs are generated.
   */
  updateAdCreative: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        adId: z.string().min(1),
        pageId: z.string().min(1),
        instagramActorId: z.string().optional(),
        pixelId: z.string().optional(),
        // Same creative fields as createAd
        adType: z.enum(["static", "video", "carousel"]),
        feedAssetId: z.string().optional(),
        storiesAssetId: z.string().optional(),
        singleVideoId: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        cards: z.array(z.object({
          assetId: z.string(),
          headline: z.string().optional(),
          description: z.string().optional(),
          linkUrl: z.string(),
          callToAction: z.string().optional(),
        })).optional(),
        headlines: z.array(z.string()).min(1),
        primaryTexts: z.array(z.string()).min(1),
        descriptions: z.array(z.string()).optional(),
        callToAction: z.string().min(1),
        websiteUrl: z.string().min(1),
        feedWebsiteUrl: z.string().optional(),
        storiesWebsiteUrl: z.string().optional(),
        feedPrimaryText: z.string().optional(),
        storiesPrimaryText: z.string().optional(),
        leadGenFormId: z.string().optional(),
        urlParameters: z.string().optional(),
        displayUrl: z.string().optional(),
        sourcePostId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adId } = input;

      // 1. Fetch existing creative ID
      const adData = await metaGet(
        `/${adId}`,
        { fields: "creative" },
        accessToken
      );
      const existingCreativeId = adData.creative?.id;
      if (!existingCreativeId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Could not find creative for ad ${adId}`,
        });
      }

      // 2. Build updated creative spec (reuse same logic as createAd)
      // For brevity, we delegate to a shared helper by calling createAd logic inline
      // The key difference: POST to /{existingCreativeId} instead of creating new
      const normalize = (s: string) =>
        s
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/\u2013|\u2014/g, "-")
          .replace(/\u2026/g, "...");

      const appendParams = (url: string, params?: string) => {
        if (!params) return url;
        return url.includes("?") ? `${url}&${params}` : `${url}?${params}`;
      };

      const {
        adAccountId, pageId, instagramActorId, pixelId, adType,
        feedAssetId, storiesAssetId, singleVideoId, thumbnailUrl, cards,
        headlines, primaryTexts, descriptions, callToAction,
        websiteUrl, feedWebsiteUrl, storiesWebsiteUrl, feedPrimaryText, storiesPrimaryText, leadGenFormId, urlParameters, displayUrl, sourcePostId,
      } = input;

      // UTMs go into url_tags ONLY — do NOT append to the URL itself.
      const baseUrl = websiteUrl;
      const feedUrl = feedWebsiteUrl ?? baseUrl;
      const storiesUrl = storiesWebsiteUrl ?? baseUrl;

      const degreesOfFreedomSpec = buildDegreesOfFreedomSpec(
        sourcePostId ? 'source_post' : adType
      );
      const contextualMultiAds = { enroll_status: "OPT_OUT" };

      let updatedSpec: Record<string, unknown> = {};

      if (sourcePostId) {
        updatedSpec = {
          object_story_id: sourcePostId,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        };
      } else if (adType === "carousel" && cards && cards.length > 0) {
        const childAttachments = cards.map((card) => {
          const att: Record<string, unknown> = {
            link: appendParams(card.linkUrl, urlParameters),
            image_hash: card.assetId,
            multi_share_end_card: false,
          };
          if (card.headline) att.name = normalize(card.headline);
          if (card.description) att.description = normalize(card.description);
          if (card.callToAction) {
            att.call_to_action = {
              type: card.callToAction,
              value: { link: appendParams(card.linkUrl, urlParameters) },
            };
          }
          return att;
        });
        const carouselLinkData: Record<string, unknown> = {
          link: baseUrl,
          message: normalize(primaryTexts[0]),
          multi_share_end_card: false,
          multi_share_optimized: false,
          child_attachments: childAttachments,
          call_to_action: { type: callToAction, value: stripUndefinedDeep({ link: baseUrl, lead_gen_form_id: leadGenFormId }) },
        };
        // display_url is NOT supported in carousel object_story_spec link_data.
        const carouselObjectStorySpec: Record<string, unknown> = { page_id: pageId, link_data: carouselLinkData };
        if (instagramActorId) carouselObjectStorySpec.instagram_user_id = instagramActorId;
        updatedSpec = {
          object_story_spec: carouselObjectStorySpec,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        };
      } else if (adType === "video" && singleVideoId && !storiesAssetId) {
        const videoData: Record<string, unknown> = {
          video_id: singleVideoId,
          message: normalize(primaryTexts[0]),
          call_to_action: { type: callToAction, value: stripUndefinedDeep({ link: baseUrl, lead_gen_form_id: leadGenFormId }) },
          link: baseUrl,
        };
        if (thumbnailUrl) videoData.image_url = thumbnailUrl;
        if (headlines[0]) videoData.title = normalize(headlines[0]);
        if (descriptions?.[0]) videoData.description = normalize(descriptions[0]);
        if (urlParameters) videoData.url_tags = urlParameters;
        const singleVideoSpec: Record<string, unknown> = { page_id: pageId, video_data: videoData };
        if (instagramActorId) singleVideoSpec.instagram_user_id = instagramActorId;
        updatedSpec = {
          object_story_spec: stripUndefinedDeep(singleVideoSpec),
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        };
      } else if ((adType === "static" || adType === "video") && feedAssetId && storiesAssetId) {
        // Placement-customized: 5-label asset_feed_spec
        const mediaType = adType === 'video' ? 'video' : 'image';
        const isVideo = adType === 'video';
        const storyReelsLabels = [
          { name: "lbl_fb_story" }, { name: "lbl_fb_reels" },
          { name: "lbl_ig_story" }, { name: "lbl_ig_reels" },
        ];
        const allLabels = [{ name: "lbl_default" }, ...storyReelsLabels];
        // Issue 7: deduplicate bodies/descriptions — identical text must use one entry with all labels
        const feedBodyU = normalize(feedPrimaryText || primaryTexts[0]);
        const storyBodyU = normalize(storiesPrimaryText || primaryTexts[0]);
        const bodiesU = feedBodyU === storyBodyU
          ? [{ text: feedBodyU, adlabels: allLabels }]
          : [
              { text: feedBodyU, adlabels: [{ name: "lbl_default" }] },
              { text: storyBodyU, adlabels: storyReelsLabels },
            ];
        const assetFeedSpec: Record<string, unknown> = {
          ad_formats: ["AUTOMATIC_FORMAT"],
          optimization_type: "PLACEMENT",
          call_to_action_types: [callToAction],
          ad_labels: allLabels,
          titles: headlines.map((h) => ({ text: normalize(h) })),
          bodies: bodiesU,
          link_urls: feedUrl !== storiesUrl
            ? [
                { website_url: feedUrl, ...(displayUrl ? { display_url: displayUrl } : {}), adlabels: [{ name: "lbl_default" }] },
                { website_url: storiesUrl, ...(displayUrl ? { display_url: displayUrl } : {}), adlabels: storyReelsLabels },
              ]
            : [{ website_url: feedUrl, ...(displayUrl ? { display_url: displayUrl } : {}), adlabels: allLabels }],
          asset_customization_rules: buildPlacementCustomizationRules(mediaType),
        };
        if (urlParameters) assetFeedSpec.url_tags = urlParameters;
        if (descriptions && descriptions.length > 0) {
          // Descriptions always use one entry with all labels (no per-placement override supported)
          assetFeedSpec.descriptions = [
            { text: normalize(descriptions[0]), adlabels: allLabels },
          ];
        }
        if (isVideo) {
          assetFeedSpec.videos = [
            { video_id: feedAssetId, adlabels: [{ name: "lbl_default" }], ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) },
            { video_id: storiesAssetId, adlabels: storyReelsLabels, ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) },
          ];
        } else {
          assetFeedSpec.images = [
            { hash: feedAssetId, adlabels: [{ name: "lbl_default" }] },
            { hash: storiesAssetId, adlabels: storyReelsLabels },
          ];
        }
        // Fix 8: anchor required alongside asset_feed_spec
        const updateAnchor: Record<string, unknown> = { page_id: pageId };
        if (instagramActorId) updateAnchor.instagram_user_id = instagramActorId;
        updatedSpec = stripUndefinedDeep({
          asset_feed_spec: assetFeedSpec,
          object_story_spec: updateAnchor,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
          ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
        });
      } else {
        // Standard single-asset: object_story_spec
        const objectStorySpec: Record<string, unknown> = { page_id: pageId };
        if (instagramActorId) objectStorySpec.instagram_user_id = instagramActorId;
        if (adType === 'video' && feedAssetId) {
          const videoData: Record<string, unknown> = {
            video_id: feedAssetId,
            message: normalize(primaryTexts[0]),
            call_to_action: { type: callToAction, value: { link: feedUrl } },
            link: feedUrl,
          };
          if (thumbnailUrl) videoData.image_url = thumbnailUrl;
          if (headlines[0]) videoData.title = normalize(headlines[0]);
          if (descriptions?.[0]) videoData.description = normalize(descriptions[0]);
          if (urlParameters) videoData.url_tags = urlParameters;
          objectStorySpec.video_data = videoData;
        } else {
          const linkData: Record<string, unknown> = {
            link: feedUrl,
            message: normalize(primaryTexts[0]),
            call_to_action: { type: callToAction, value: stripUndefinedDeep({ link: feedUrl, lead_gen_form_id: leadGenFormId }) },
          };
          if (feedAssetId) linkData.image_hash = feedAssetId;
          if (headlines[0]) linkData.name = normalize(headlines[0]);
          if (descriptions?.[0]) linkData.description = normalize(descriptions[0]);
          if (displayUrl) linkData.display_url = displayUrl;
          if (urlParameters) linkData.url_tags = urlParameters;
          objectStorySpec.link_data = linkData;
        }
        updatedSpec = stripUndefinedDeep({
          object_story_spec: objectStorySpec,
          degrees_of_freedom_spec: degreesOfFreedomSpec,
          contextual_multi_ads: contextualMultiAds,
          multi_advertiser_eligibility: "INELIGIBLE",
        });
      }

       // 3. POST update to existing creative ID (in-place, no new ID)
      await metaPost(`/${existingCreativeId}`, stripUndefinedDeep(updatedSpec), accessToken);
      const previewLink = await getAdPreviewLink(adId, accessToken);
      return { creativeId: existingCreativeId, previewLink, updated: true };
    }),

  /**
   * Fetch ad images from the ad account (from the account's image library).
   * Returns image hashes, URLs, and names for use in the media browser.
   */
  getAdImages: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId, limit } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const data = await metaGet(
          `/${accountId}/adimages`,
          {
            fields: "hash,url,url_128,name,width,height,created_time",
            limit: String(limit),
          },
          accessToken
        );
        return {
          images: (data.data || []).map(
            (img: {
              hash: string;
              url?: string;
              url_128?: string;
              name?: string;
              width?: number;
              height?: number;
              created_time?: string;
            }) => ({
              hash: img.hash,
              url: img.url || img.url_128 || '',
              thumbnailUrl: img.url_128 || img.url || '',
              name: img.name || img.hash,
              width: img.width,
              height: img.height,
              createdTime: img.created_time,
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch ad images: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Fetch ad videos from the ad account.
   * Returns video IDs, thumbnails, and titles for use in the media browser.
   */
  getAdVideos: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId, limit } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const data = await metaGet(
          `/${accountId}/advideos`,
          {
            fields: "id,title,description,thumbnails,length,created_time,status",
            limit: String(limit),
          },
          accessToken
        );
        return {
          videos: (data.data || []).map(
            (vid: {
              id: string;
              title?: string;
              description?: string;
              thumbnails?: { data: { uri: string }[] };
              length?: number;
              created_time?: string;
              status?: { video_status: string };
            }) => ({
              id: vid.id,
              title: vid.title || vid.id,
              description: vid.description,
              thumbnailUrl: vid.thumbnails?.data?.[0]?.uri || '',
              lengthSeconds: vid.length,
              createdTime: vid.created_time,
              status: vid.status?.video_status || 'ready',
            })
          ),
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch ad videos: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Audience overlap analysis across active ad sets in a campaign (or all active ad sets).
   * Uses the Meta delivery_estimate API to compute pairwise overlap.
   * Only runs on ACTIVE ad sets per skill guidance.
   */
  getAudienceOverlap: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { accessToken, adAccountId, campaignId } = input;
      const accountId = normalizeAdAccountId(adAccountId);

      // 1. Fetch active ad sets
      try {
        const params: Record<string, string> = {
          fields: "id,name,targeting,daily_budget,lifetime_budget,status,campaign_id,campaign{name}",
          filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
          limit: "100",
        };
        if (campaignId) params.campaign_id = campaignId;

        const adSetsData = await metaGet(
          `/${accountId}/adsets`,
          params,
          accessToken
        );

        const adSets: {
          id: string;
          name: string;
          targeting: Record<string, unknown>;
          campaignName?: string;
          dailyBudget?: number;
          lifetimeBudget?: number;
        }[] = (adSetsData.data || []).map(
          (a: {
            id: string;
            name: string;
            targeting?: Record<string, unknown>;
            daily_budget?: string;
            lifetime_budget?: string;
            campaign?: { name: string };
          }) => ({
            id: a.id,
            name: a.name,
            targeting: a.targeting || {},
            campaignName: a.campaign?.name,
            dailyBudget: a.daily_budget ? parseInt(a.daily_budget, 10) : undefined,
            lifetimeBudget: a.lifetime_budget ? parseInt(a.lifetime_budget, 10) : undefined,
          })
        );

        if (adSets.length < 2) {
          return { pairs: [], adSets, message: "Need at least 2 active ad sets for overlap analysis." };
        }

        // 2. Fetch reach estimates for each ad set to use as denominator
        const reachMap: Record<string, number> = {};
        for (const adSet of adSets) {
          try {
            const reachData = await metaGet(
              `/${accountId}/delivery_estimate`,
              {
                targeting_spec: JSON.stringify(adSet.targeting),
                optimization_goal: "REACH",
              },
              accessToken
            );
            const estimate = reachData?.data?.[0];
            reachMap[adSet.id] = estimate?.estimate_mau_upper_bound ||
              estimate?.estimate_ready ||
              estimate?.users_lower_bound ||
              0;
          } catch {
            reachMap[adSet.id] = 0;
          }
        }

        // 3. Compute pairwise overlap using combined targeting spec
        const pairs: {
          adSetA: { id: string; name: string };
          adSetB: { id: string; name: string };
          overlapPct: number;
          overlapEstimate: number;
          reachA: number;
          reachB: number;
        }[] = [];

        for (let i = 0; i < adSets.length; i++) {
          for (let j = i + 1; j < adSets.length; j++) {
            const a = adSets[i];
            const b = adSets[j];
            const reachA = reachMap[a.id] || 1;
            const reachB = reachMap[b.id] || 1;

            // Merge targeting specs to estimate combined audience
            const mergedTargeting = mergeTargetingSpecs(a.targeting, b.targeting);
            let combinedReach = 0;
            try {
              const combinedData = await metaGet(
                `/${accountId}/delivery_estimate`,
                {
                  targeting_spec: JSON.stringify(mergedTargeting),
                  optimization_goal: "REACH",
                },
                accessToken
              );
              const est = combinedData?.data?.[0];
              combinedReach = est?.estimate_mau_upper_bound ||
                est?.estimate_ready ||
                est?.users_lower_bound ||
                0;
            } catch {
              combinedReach = 0;
            }

            // Overlap = A + B - combined (inclusion-exclusion)
            const overlapEstimate = Math.max(0, reachA + reachB - combinedReach);
            const denominator = Math.min(reachA, reachB);
            const overlapPct = denominator > 0
              ? Math.min(100, Math.round((overlapEstimate / denominator) * 100))
              : 0;

            pairs.push({
              adSetA: { id: a.id, name: a.name },
              adSetB: { id: b.id, name: b.name },
              overlapPct,
              overlapEstimate,
              reachA,
              reachB,
            });
          }
        }

        // Sort by highest overlap first, deduplicate pairs
        pairs.sort((a, b) => b.overlapPct - a.overlapPct);

        return { pairs, adSets, message: null };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Overlap analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Get ad accounts accessible to a BM token.
   * Uses tokenId (server-side vault lookup) so the raw token is never sent to the frontend.
   */
  getAdAccountsByTokenId: protectedProcedure
    .input(
      z.object({
        tokenId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const tokenRecord = await getTokenById(input.tokenId);
      if (!tokenRecord?.accessToken) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
      }
      try {
        // Fetch ALL pages of both owned and client ad accounts in parallel
        const bmId = tokenRecord.businessManagerId;
        const mapAccounts = (raw: unknown[]) =>
          (raw || []).map((a) => {
            const acc = a as RawAdAccount;
            return { id: acc.id, name: acc.name, status: acc.account_status, currency: acc.currency };
          });

        const [ownedResult, clientResult] = await Promise.allSettled([
          metaGetAllPages(`/${bmId}/owned_ad_accounts`, { fields: "id,name,account_status,currency", limit: "200" }, tokenRecord.accessToken),
          metaGetAllPages(`/${bmId}/client_ad_accounts`, { fields: "id,name,account_status,currency", limit: "200" }, tokenRecord.accessToken),
        ]);

        const ownedAccounts = ownedResult.status === "fulfilled" ? mapAccounts(ownedResult.value) : [];
        const clientAccounts = clientResult.status === "fulfilled" ? mapAccounts(clientResult.value) : [];

        // Merge and deduplicate by account id
        const seen = new Set<string>();
        const accounts = [...ownedAccounts, ...clientAccounts].filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        // Sort alphabetically by name for easier scanning
        accounts.sort((a, b) => a.name.localeCompare(b.name));

        return { accounts };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch ad accounts: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Get Facebook Pages accessible to a BM token.
   * Uses tokenId (server-side vault lookup) so the raw token is never sent to the frontend.
   */
  getFacebookPagesByTokenId: protectedProcedure
    .input(
      z.object({
        tokenId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const tokenRecord = await getTokenById(input.tokenId);
      if (!tokenRecord?.accessToken) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
      }
      try {
        const bmId = tokenRecord.businessManagerId;
        type RawPage = { id: string; name: string; picture?: { data?: { url?: string } } };
        const mapPage = (p: RawPage) => ({ id: p.id, name: p.name, pictureUrl: p.picture?.data?.url ?? null });

        const [ownedData, clientData] = await Promise.allSettled([
          metaGet(`/${bmId}/owned_pages`, { fields: "id,name,picture", limit: "200" }, tokenRecord.accessToken),
          metaGet(`/${bmId}/client_pages`, { fields: "id,name,picture", limit: "200" }, tokenRecord.accessToken),
        ]);

        const ownedPages: ReturnType<typeof mapPage>[] =
          ownedData.status === "fulfilled" ? (ownedData.value.data || []).map(mapPage) : [];
        const clientPages: ReturnType<typeof mapPage>[] =
          clientData.status === "fulfilled" ? (clientData.value.data || []).map(mapPage) : [];

        const seen = new Set<string>();
        const pages: ReturnType<typeof mapPage>[] = [];
        for (const p of [...ownedPages, ...clientPages]) {
          if (!seen.has(p.id)) { seen.add(p.id); pages.push(p); }
        }
        return { pages };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch Facebook pages: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Get Meta Pixels accessible via the BM token (owned + client pixels).
   */
  getPixelsByTokenId: protectedProcedure
    .input(
      z.object({
        tokenId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const tokenRecord = await getTokenById(input.tokenId);
      if (!tokenRecord?.accessToken) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Token not found' });
      }
      try {
        const bmId = tokenRecord.businessManagerId;
        type RawPixel = { id: string; name: string };
        const mapItem = (p: RawPixel, source: 'pixel' | 'dataset') => ({ id: p.id, name: p.name, source });

        const [ownedPixels, clientPixels, ownedDatasets, clientDatasets] = await Promise.allSettled([
          metaGet(`/${bmId}/owned_pixels`, { fields: 'id,name', limit: '200' }, tokenRecord.accessToken),
          metaGet(`/${bmId}/client_pixels`, { fields: 'id,name', limit: '200' }, tokenRecord.accessToken),
          metaGet(`/${bmId}/owned_offline_conversion_data_sets`, { fields: 'id,name', limit: '200' }, tokenRecord.accessToken),
          metaGet(`/${bmId}/client_offline_conversion_data_sets`, { fields: 'id,name', limit: '200' }, tokenRecord.accessToken),
        ]);

        const ownedPx = ownedPixels.status === 'fulfilled' ? (ownedPixels.value.data || []).map((p: RawPixel) => mapItem(p, 'pixel')) : [];
        const clientPx = clientPixels.status === 'fulfilled' ? (clientPixels.value.data || []).map((p: RawPixel) => mapItem(p, 'pixel')) : [];
        const ownedDs = ownedDatasets.status === 'fulfilled' ? (ownedDatasets.value.data || []).map((p: RawPixel) => mapItem(p, 'dataset')) : [];
        const clientDs = clientDatasets.status === 'fulfilled' ? (clientDatasets.value.data || []).map((p: RawPixel) => mapItem(p, 'dataset')) : [];

        const seen = new Set<string>();
        const pixels: ReturnType<typeof mapItem>[] = [];
        for (const p of [...ownedPx, ...clientPx, ...ownedDs, ...clientDs]) {
          if (!seen.has(p.id)) { seen.add(p.id); pixels.push(p); }
        }
        return { pixels };
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to fetch pixels/datasets: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Get Instagram accounts connected to a Facebook Page.
   * Requires pageId and tokenId.
   */
  getInstagramAccountsByPage: protectedProcedure
    .input(
      z.object({
        tokenId: z.number().int().positive(),
        pageId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const tokenRecord = await getTokenById(input.tokenId);
      if (!tokenRecord?.accessToken) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
      }
      try {
        const data = await metaGet(
          `/${input.pageId}/instagram_accounts`,
          { fields: "id,username,profile_pic" },
          tokenRecord.accessToken
        );
        const accounts = (data.data || []).map(
          (a: { id: string; username: string; profile_pic?: string }) => ({
            id: a.id,
            username: a.username,
            profilePic: a.profile_pic ?? null,
          })
        );
        return { accounts };
      } catch (err) {
        return { accounts: [] };
      }
    }),


  writeBackToSheet: publicProcedure
    .input(
      z.object({
        sheetUrl: z.string().min(1),
        rows: z.array(
          z.object({
            exportRowNumber: z.number().int().positive().optional(),
            adsRowNumber: z.number().int().positive().optional(),
            adId: z.string().optional(),
            adSetId: z.string().optional(),
            campaignId: z.string().optional(),
            previewLink: z.string().optional(),
          })
        ),
        exportTabName: z.string().default("Export"),
        adsTabName: z.string().default("Ads"),
      })
    )
    .mutation(async ({ input }) => {
      const spreadsheetId = extractSpreadsheetId(input.sheetUrl);
      const valueRanges: ValueRange[] = [];
      for (const row of input.rows) {
        if (row.exportRowNumber) {
          const r = row.exportRowNumber;
          const tab = input.exportTabName;
          if (row.adSetId)   valueRanges.push({ range: `${tab}!F${r}`,  values: [[row.adSetId]] });
          if (row.campaignId) valueRanges.push({ range: `${tab}!G${r}`, values: [[row.campaignId]] });
          if (row.adId)      valueRanges.push({ range: `${tab}!AM${r}`, values: [[row.adId]] });
        }
        if (row.adsRowNumber) {
          const r = row.adsRowNumber;
          const tab = input.adsTabName;
          if (row.adId)       valueRanges.push({ range: `${tab}!D${r}`,  values: [[row.adId]] });
          if (row.adSetId)    valueRanges.push({ range: `${tab}!E${r}`,  values: [[row.adSetId]] });
          if (row.campaignId) valueRanges.push({ range: `${tab}!F${r}`,  values: [[row.campaignId]] });
          if (row.previewLink) valueRanges.push({ range: `${tab}!L${r}`, values: [[row.previewLink]] });
        }
      }
      if (valueRanges.length === 0) {
        return { written: 0, message: "No data to write back." };
      }
      try {
        await sheetsValuesBatchUpdate(spreadsheetId, valueRanges);
        return { written: valueRanges.length, message: null };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Sheet write-back failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Batch reach + CPM estimates for multiple targeting specs.
   * Used by the Campaign Builder Ad Sets tab Reach Estimate feature.
   */
  batchReachEstimates: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        adSets: z.array(z.object({
          id: z.string(),
          name: z.string(),
          targetingSpec: z.record(z.string(), z.unknown()),
          optimizationGoal: z.string().optional(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, adSets } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      const OPT_GOAL_MAP: Record<string, string> = {
        LANDING_PAGE_VIEWS: 'LANDING_PAGE_VIEWS',
        LINK_CLICKS: 'LINK_CLICKS',
        REACH: 'REACH',
        IMPRESSIONS: 'IMPRESSIONS',
        THRUPLAY: 'THRUPLAY',
        AD_RECALL_LIFT: 'AD_RECALL_LIFT',
        POST_ENGAGEMENT: 'POST_ENGAGEMENT',
        PAGE_LIKES: 'PAGE_LIKES',
        VIDEO_VIEWS: 'VIDEO_VIEWS',
        CONVERSIONS: 'OFFSITE_CONVERSIONS',
        VALUE: 'VALUE',
        LEAD_GENERATION: 'LEAD_GENERATION',
      };
      const results = await Promise.all(adSets.map(async (adSet) => {
        try {
          const reachData = await metaGet(
            `/${accountId}/delivery_estimate`,
            {
              targeting_spec: JSON.stringify(adSet.targetingSpec),
              optimization_goal: OPT_GOAL_MAP[adSet.optimizationGoal || ''] || 'LINK_CLICKS',
            },
            accessToken
          );
          const { lower, upper } = readReachBounds(reachData);
          let cpm: number | null = null;
          const optGoal = OPT_GOAL_MAP[adSet.optimizationGoal || ''] || 'LINK_CLICKS';
          try {
            const deliveryData = await metaGet(
              `/${accountId}/delivery_estimate`,
              {
                targeting_spec: JSON.stringify(adSet.targetingSpec),
                optimization_goal: optGoal,
              },
              accessToken
            );
            const est = (deliveryData?.data as { estimate_cpm?: string }[])?.[0];
            if (est?.estimate_cpm) cpm = parseFloat(est.estimate_cpm) / 100;
          } catch { /* CPM optional */ }
          return {
            id: adSet.id,
            name: adSet.name,
            reachLower: lower,
            reachUpper: upper,
            reachMid: Math.round((lower + upper) / 2),
            cpm,
            error: null as string | null,
          };
        } catch (err) {
          return {
            id: adSet.id,
            name: adSet.name,
            reachLower: 0,
            reachUpper: 0,
            reachMid: 0,
            cpm: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }));
      return { results };
    }),

  /**
   * Audience overlap analysis for builder ad sets using the dual-anchor methodology.
   * Implements the same algorithm as Overlap.gs:
   *   - Single-entry flex: A-anchor only (HIGH confidence)
   *   - Narrowed (AND logic): dual-anchor cross-validation when within layer limit
   *   - Combined layer count > 4: A-anchor with truncation (MEDIUM confidence)
   */
  builderAudienceOverlap: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(1),
        adAccountId: z.string().min(1),
        adSets: z.array(z.object({
          id: z.string(),
          name: z.string(),
          campaignName: z.string(),
          targetingSpec: z.record(z.string(), z.unknown()),
          isNarrowed: z.boolean(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, adSets } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      const FLEX_SPEC_MAX_LAYERS = 4;
      const AGE_MAX_DEFAULT = 65;

      function mergeSpecsAnchored(
        anchorSpec: Record<string, unknown>,
        otherSpec: Record<string, unknown>
      ): Record<string, unknown> {
        const merged: Record<string, unknown> = {};
        merged.geo_locations = anchorSpec.geo_locations || { countries: ['US'] };
        const ageMinA = (anchorSpec.age_min as number) || 18;
        const ageMinB = (otherSpec.age_min as number) || 18;
        const ageMaxA = (anchorSpec.age_max as number) || AGE_MAX_DEFAULT;
        const ageMaxB = (otherSpec.age_max as number) || AGE_MAX_DEFAULT;
        const intAgeMin = Math.max(ageMinA, ageMinB);
        const intAgeMax = Math.min(ageMaxA, ageMaxB);
        if (intAgeMin > intAgeMax) return { geo_locations: { countries: ['US'] }, age_min: 99, age_max: 99 };
        merged.age_min = intAgeMin;
        merged.age_max = intAgeMax;
        const gA = (anchorSpec.genders as number[]) || [];
        const gB = (otherSpec.genders as number[]) || [];
        if (gA.length && gB.length) {
          const shared = gA.filter(g => gB.includes(g));
          if (!shared.length) return { geo_locations: { countries: ['US'] }, age_min: 99, age_max: 99 };
          merged.genders = shared;
        } else if (gA.length) {
          merged.genders = gA;
        } else if (gB.length) {
          merged.genders = gB;
        }
        const flexA = (anchorSpec.flexible_spec as unknown[]) || [];
        const flexB = (otherSpec.flexible_spec as unknown[]) || [];
        let combined = [...flexA, ...flexB];
        if (combined.length > FLEX_SPEC_MAX_LAYERS) combined = combined.slice(0, FLEX_SPEC_MAX_LAYERS);
        if (combined.length) merged.flexible_spec = combined;
        return merged;
      }

      async function batchReach(specs: Record<string, unknown>[]): Promise<number[]> {
        return Promise.all(specs.map(async (spec) => {
          try {
            const data = await metaGet(
              `/${accountId}/delivery_estimate`,
              { targeting_spec: JSON.stringify(spec), optimization_goal: "REACH" },
              accessToken
            );
            const { lower, upper } = readReachBounds(data);
            return (lower + upper) / 2;
          } catch { return 0; }
        }));
      }

      const individualReaches = await batchReach(adSets.map(a => a.targetingSpec));
      const adSetsWithReach = adSets.map((a, i) => ({ ...a, reach: individualReaches[i] }));

      interface PairEntry {
        ii: number; jj: number;
        eitherNarrowed: boolean; skipBAnchor: boolean;
        specA: Record<string, unknown>;
        specB?: Record<string, unknown>;
        intersectionReach: number;
        confidence: string;
      }
      const pairs: PairEntry[] = [];

      for (let ii = 0; ii < adSetsWithReach.length; ii++) {
        for (let jj = ii + 1; jj < adSetsWithReach.length; jj++) {
          if (adSetsWithReach[ii].campaignName !== adSetsWithReach[jj].campaignName) continue;
          const flexLayersA = ((adSetsWithReach[ii].targetingSpec.flexible_spec as unknown[]) || []).length;
          const flexLayersB = ((adSetsWithReach[jj].targetingSpec.flexible_spec as unknown[]) || []).length;
          const totalLayers = flexLayersA + flexLayersB;
          const eitherNarrowed = adSetsWithReach[ii].isNarrowed || adSetsWithReach[jj].isNarrowed;
          const skipBAnchor = eitherNarrowed && totalLayers > FLEX_SPEC_MAX_LAYERS;
          pairs.push({
            ii, jj, eitherNarrowed, skipBAnchor,
            specA: mergeSpecsAnchored(adSetsWithReach[ii].targetingSpec, adSetsWithReach[jj].targetingSpec),
            specB: (!eitherNarrowed || skipBAnchor) ? undefined :
              mergeSpecsAnchored(adSetsWithReach[jj].targetingSpec, adSetsWithReach[ii].targetingSpec),
            intersectionReach: 0,
            confidence: 'HIGH',
          });
        }
      }

      const aReaches = await batchReach(pairs.map(p => p.specA));
      const bAnchorIndices: number[] = [];
      const bAnchorSpecs: Record<string, unknown>[] = [];
      pairs.forEach((p, pi) => {
        if (p.eitherNarrowed && !p.skipBAnchor && p.specB) {
          bAnchorIndices.push(pi);
          bAnchorSpecs.push(p.specB);
        }
      });
      const bReaches = bAnchorSpecs.length ? await batchReach(bAnchorSpecs) : [];
      const bReachByPairIndex: Record<number, number> = {};
      bAnchorIndices.forEach((pi, ni) => { bReachByPairIndex[pi] = bReaches[ni]; });

      pairs.forEach((pair, pi) => {
        const reachA = adSetsWithReach[pair.ii].reach;
        const reachB = adSetsWithReach[pair.jj].reach;
        const maxPossible = Math.min(reachA, reachB);
        const midA = aReaches[pi];
        const clampA = Math.min(midA, maxPossible);
        if (!pair.eitherNarrowed) {
          pair.intersectionReach = clampA;
          pair.confidence = 'HIGH';
        } else if (pair.skipBAnchor) {
          pair.intersectionReach = clampA;
          pair.confidence = 'MEDIUM';
        } else {
          const midB = bReachByPairIndex[pi] || 0;
          const clampB = Math.min(midB, maxPossible);
          if (clampA > 0 && clampB > 0) {
            const ratio = Math.max(clampA, clampB) / Math.min(clampA, clampB);
            if (ratio <= 1.2) {
              pair.intersectionReach = Math.sqrt(clampA * clampB);
              pair.confidence = 'HIGH';
            } else {
              pair.intersectionReach = Math.min(clampA, clampB);
              pair.confidence = 'LOW_CONF';
            }
          } else if (clampA > 0) {
            pair.intersectionReach = clampA;
            pair.confidence = 'MEDIUM';
          } else if (clampB > 0) {
            pair.intersectionReach = clampB;
            pair.confidence = 'MEDIUM';
          } else {
            pair.intersectionReach = 0;
            pair.confidence = 'LOW_CONF';
          }
        }
      });

      const overlapResults = adSetsWithReach.map((asA, i) => {
        const pairsForA = pairs
          .filter(p => p.ii === i || p.jj === i)
          .map(p => {
            const otherIdx = p.ii === i ? p.jj : p.ii;
            const other = adSetsWithReach[otherIdx];
            const pct = asA.reach > 0
              ? Math.min(100, Math.round((p.intersectionReach / asA.reach) * 1000) / 10)
              : 0;
            return { pct, name: other.name, confidence: p.confidence };
          })
          .sort((a, b) => b.pct - a.pct);
        return {
          id: asA.id,
          name: asA.name,
          reach: Math.round(asA.reach),
          overlaps: pairsForA,
        };
      });

      const pairList = pairs.map(p => ({
        adSetA: { id: adSetsWithReach[p.ii].id, name: adSetsWithReach[p.ii].name },
        adSetB: { id: adSetsWithReach[p.jj].id, name: adSetsWithReach[p.jj].name },
        intersectionReach: Math.round(p.intersectionReach),
        overlapPctA: adSetsWithReach[p.ii].reach > 0
          ? Math.min(100, Math.round((p.intersectionReach / adSetsWithReach[p.ii].reach) * 1000) / 10)
          : 0,
        overlapPctB: adSetsWithReach[p.jj].reach > 0
          ? Math.min(100, Math.round((p.intersectionReach / adSetsWithReach[p.jj].reach) * 1000) / 10)
          : 0,
        confidence: p.confidence,
      })).sort((a, b) => b.overlapPctA - a.overlapPctA);

      return { overlapResults, pairList };
    }),

  // ── Audience Builder Source Data ─────────────────────────────────────────────
  /**
   * Get Facebook Pages accessible by the access token (for lead form, events, IG profile sources).
   */
  getAccessiblePages: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const { accessToken } = input;
      try {
        const data = await metaGet('/me/accounts', { fields: 'id,name,picture', limit: '200' }, accessToken);
        const pages = (data.data || []).map((p: { id: string; name: string; picture?: { data?: { url?: string } } }) => ({
          id: p.id,
          name: p.name,
          pictureUrl: p.picture?.data?.url ?? null,
        }));
        return { pages };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to fetch pages: ${msg}` });
      }
    }),

  /**
   * Get Instagram accounts connected to a Facebook Page (for IG Profile audience source).
   */
  getPageInstagramAccounts: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      pageId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const { accessToken, pageId } = input;
      try {
        const data = await metaGet(`/${pageId}/instagram_accounts`, { fields: 'id,username,profile_pic' }, accessToken);
        const accounts = (data.data || []).map((a: { id: string; username: string; profile_pic?: string }) => ({
          id: a.id,
          username: a.username,
          profilePic: a.profile_pic ?? null,
        }));
        return { accounts };
      } catch {
        return { accounts: [] };
      }
    }),

  /**
   * Get Facebook Events for a page (for event-based audience source).
   */
  getPageEvents: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      pageId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const { accessToken, pageId } = input;
      try {
        const data = await metaGet(`/${pageId}/events`, { fields: 'id,name,start_time', limit: '100' }, accessToken);
        const events = (data.data || []).map((e: { id: string; name: string; start_time?: string }) => ({
          id: e.id,
          name: e.name,
          startTime: e.start_time ?? null,
        }));
        return { events };
      } catch {
        return { events: [] };
      }
    }),

  /**
   * Get Instant Experiences (Canvas ads) for a page.
   */
  getPageInstantExperiences: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      pageId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const { accessToken, pageId } = input;
      try {
        const data = await metaGet(`/${pageId}/canvas_elements`, { fields: 'id,name', limit: '100' }, accessToken);
        const experiences = (data.data || []).map((e: { id: string; name: string }) => ({
          id: e.id,
          name: e.name,
        }));
        return { experiences };
      } catch {
        return { experiences: [] };
      }
    }),

  /**
   * Get Facebook Shops / Catalogs for the ad account (for shopping audience source).
   */
  getAdAccountCatalogs: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      adAccountId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const { accessToken, adAccountId } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        const data = await metaGet(`/${accountId}/product_catalogs`, { fields: 'id,name', limit: '100' }, accessToken);
        const catalogs = (data.data || []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }));
        return { catalogs };
      } catch {
        return { catalogs: [] };
      }
    }),

  /**
   * Create a Custom Audience via the Meta API.
   * Supports: website (pixel), engagement (page/IG/video/lead form/instant experience/event/shopping), app activity, customer list.
   */
  createCustomAudience: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      adAccountId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      subtype: z.enum(['WEBSITE', 'ENGAGEMENT', 'APP', 'CUSTOM']),
      retentionDays: z.number().int().min(1).max(365).default(30),
      // Website (pixel) specific
      pixelId: z.string().optional(),
      pixelRule: z.string().optional(), // JSON string of inclusion rules
      // Engagement specific
      engagementType: z.enum(['PAGE', 'INSTAGRAM_PROFILE', 'VIDEO', 'LEAD_FORM', 'INSTANT_EXPERIENCE', 'EVENTS', 'SHOPPING']).optional(),
      engagementAction: z.string().optional(), // e.g. PAGE_ENGAGED, INSTAGRAM_PROFILE_VISITED
      engagementObjectId: z.string().optional(), // page ID, IG account ID, etc.
      // App specific
      appId: z.string().optional(),
      appRule: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, name, description, subtype, retentionDays } = input;
      const accountId = normalizeAdAccountId(adAccountId);

      let rule: Record<string, unknown> | undefined;
      let customerFileSource: string | undefined;

      if (subtype === 'WEBSITE' && input.pixelId) {
        // Website custom audience rule
        const pixelRule = input.pixelRule ? JSON.parse(input.pixelRule) : {
          inclusions: {
            operator: 'OR',
            rules: [{
              event_sources: [{ id: input.pixelId, type: 'pixel' }],
              retention_seconds: retentionDays * 86400,
              filter: { operator: 'AND', filters: [{ field: 'event', operator: 'eq', value: 'PageView' }] },
            }],
          },
        };
        rule = pixelRule;
      } else if (subtype === 'ENGAGEMENT' && input.engagementType && input.engagementObjectId) {
        // Engagement audience rule
        const engagementSourceType = {
          PAGE: 'page',
          INSTAGRAM_PROFILE: 'ig_account',
          VIDEO: 'video',
          LEAD_FORM: 'lead_gen',
          INSTANT_EXPERIENCE: 'canvas',
          EVENTS: 'event',
          SHOPPING: 'ig_shopping',
        }[input.engagementType] || 'page';

        rule = {
          inclusions: {
            operator: 'OR',
            rules: [{
              event_sources: [{ id: input.engagementObjectId, type: engagementSourceType }],
              retention_seconds: retentionDays * 86400,
              filter: { operator: 'AND', filters: [{ field: 'event', operator: 'eq', value: input.engagementAction || 'PAGE_ENGAGED' }] },
            }],
          },
        };
      } else if (subtype === 'CUSTOM') {
        customerFileSource = 'USER_PROVIDED_ONLY';
      }

      const payload: Record<string, unknown> = {
        name,
        subtype,
        retention_days: retentionDays,
      };
      if (description) payload.description = description;
      if (rule) payload.rule = JSON.stringify(rule);
      if (customerFileSource) payload.customer_file_source = customerFileSource;

      try {
        const data = await metaPost(`/${accountId}/customaudiences`, payload, accessToken);
        return { audienceId: data.id, name };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to create custom audience: ${msg}` });
      }
    }),

  /**
   * Create a Lookalike Audience from a source custom audience.
   */
  createLookalikeAudience: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      adAccountId: z.string().min(1),
      name: z.string().min(1),
      originAudienceId: z.string().min(1),
      country: z.string().min(2).max(2), // ISO 2-letter country code
      ratio: z.number().min(0.01).max(0.20).default(0.01), // 1%-20% of country population
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { accessToken, adAccountId, name, originAudienceId, country, ratio, description } = input;
      const accountId = normalizeAdAccountId(adAccountId);

      const payload: Record<string, unknown> = {
        name,
        subtype: 'LOOKALIKE',
        origin_audience_id: originAudienceId,
        lookalike_spec: JSON.stringify({
          type: 'similarity',
          country,
          ratio,
        }),
      };
      if (description) payload.description = description;

      try {
        const data = await metaPost(`/${accountId}/customaudiences`, payload, accessToken);
        return { audienceId: data.id, name };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to create lookalike audience: ${msg}` });
      }
    }),

  /**
   * Create a Lead Gen Form via the Meta API.
   */
  createLeadGenForm: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      pageId: z.string().min(1),
      name: z.string().min(1),
      formType: z.enum(['MORE_VOLUME', 'HIGHER_INTENT', 'RICH_CREATIVE']).default('MORE_VOLUME'),
      privacyPolicyUrl: z.string().optional(),
      privacyPolicyLinkText: z.string().optional(),
      thankYouPage: z.object({
        title: z.string().optional(),
        body: z.string().optional(),
        businessName: z.string().optional(),
        websiteUrl: z.string().optional(),
        ctaTitle: z.string().optional(),
        ctaType: z.string().optional(),
      }).optional(),
      questions: z.array(z.object({
        type: z.string(),
        label: z.string().optional(),
        key: z.string().optional(),
        options: z.array(z.object({ value: z.string(), key: z.string().optional() })).optional(),
      })),
      contextCard: z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        style: z.enum(['LIST_STYLE', 'PARAGRAPH_STYLE']).optional(),
        coverPhoto: z.string().optional(),
      }).optional(),
      locale: z.string().optional(),
      trackingParameters: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
      followUpActionUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { accessToken, pageId, name, formType, privacyPolicyUrl, privacyPolicyLinkText,
        thankYouPage, questions, contextCard, locale, trackingParameters, followUpActionUrl } = input;

      const payload: Record<string, unknown> = {
        name,
        form_type: formType,
        questions: questions.map(q => {
          const qObj: Record<string, unknown> = { type: q.type };
          if (q.label) qObj.label = q.label;
          if (q.key) qObj.key = q.key;
          if (q.options) qObj.options = q.options;
          return qObj;
        }),
      };

      if (privacyPolicyUrl) {
        payload.privacy_policy = { url: privacyPolicyUrl, link_text: privacyPolicyLinkText || 'Privacy Policy' };
      }

      if (thankYouPage) {
        const tp: Record<string, unknown> = {};
        if (thankYouPage.title) tp.title = thankYouPage.title;
        if (thankYouPage.body) tp.body = thankYouPage.body;
        if (thankYouPage.businessName) tp.business_name = thankYouPage.businessName;
        if (thankYouPage.websiteUrl) tp.website_url = thankYouPage.websiteUrl;
        if (thankYouPage.ctaTitle) tp.cta_title = thankYouPage.ctaTitle;
        if (thankYouPage.ctaType) tp.cta_type = thankYouPage.ctaType;
        payload.thank_you_page = tp;
      }

      if (contextCard) {
        const cc: Record<string, unknown> = {};
        if (contextCard.title) cc.title = contextCard.title;
        if (contextCard.content) cc.content = contextCard.content;
        if (contextCard.style) cc.style = contextCard.style;
        if (contextCard.coverPhoto) cc.cover_photo = contextCard.coverPhoto;
        payload.context_card = cc;
      }

      if (locale) payload.locale = locale;
      if (trackingParameters && trackingParameters.length > 0) {
        payload.tracking_parameters = Object.fromEntries(trackingParameters.map(p => [p.key, p.value]));
      }
      if (followUpActionUrl) payload.follow_up_action_url = followUpActionUrl;

      try {
        const data = await metaPost(`/${pageId}/leadgen_forms`, payload, accessToken);
        return { formId: data.id, name };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to create lead gen form: ${msg}` });
      }
    }),

  // ── Video Selector: FB Page Videos ──────────────────────────────────────────
  getPageVideos: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      pageId: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(50),
      after: z.string().optional(),
      uploadedAfter: z.string().optional(),  // ISO date string
      uploadedBefore: z.string().optional(), // ISO date string
    }))
    .query(async ({ input }) => {
      const { accessToken, pageId, limit, after, uploadedAfter, uploadedBefore } = input;
      try {
        const params: Record<string, string> = {
          fields: 'id,title,description,thumbnails,length,created_time,place_of_origin,content_tags',
          limit: String(limit),
        };
        if (after) params.after = after;
        const data = await metaGet(`/${pageId}/videos`, params, accessToken);
        let videos = (data.data || []) as Array<{
          id: string;
          title?: string;
          description?: string;
          thumbnails?: { data: { uri: string; width: number; height: number }[] };
          length?: number;
          created_time?: string;
        }>;
        // Filter by upload date if requested
        if (uploadedAfter || uploadedBefore) {
          const afterTs = uploadedAfter ? new Date(uploadedAfter).getTime() : 0;
          const beforeTs = uploadedBefore ? new Date(uploadedBefore).getTime() : Infinity;
          videos = videos.filter(v => {
            if (!v.created_time) return true;
            const ts = new Date(v.created_time).getTime();
            return ts >= afterTs && ts <= beforeTs;
          });
        }
        return {
          videos: videos.map(v => ({
            id: v.id,
            title: v.title || v.id,
            description: v.description,
            thumbnailUrl: v.thumbnails?.data?.[0]?.uri || '',
            lengthSeconds: v.length,
            createdTime: v.created_time,
            source: 'page' as const,
          })),
          paging: data.paging,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to fetch page videos: ${msg}` });
      }
    }),

  // ── Video Selector: IG Account Videos ─────────────────────────────────────────
  getIGAccountVideos: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      igUserId: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(50),
      after: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { accessToken, igUserId, limit, after } = input;
      try {
        const params: Record<string, string> = {
          fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count',
          limit: String(limit),
        };
        if (after) params.after = after;
        const data = await metaGet(`/${igUserId}/media`, params, accessToken);
        const items = (data.data || []) as Array<{
          id: string;
          caption?: string;
          media_type?: string;
          media_url?: string;
          thumbnail_url?: string;
          timestamp?: string;
          like_count?: number;
          comments_count?: number;
        }>;
        // Only return VIDEO items
        const videos = items.filter(i => i.media_type === 'VIDEO' || i.media_type === 'REELS');
        return {
          videos: videos.map(v => ({
            id: v.id,
            title: v.caption ? v.caption.substring(0, 80) : v.id,
            description: v.caption,
            thumbnailUrl: v.thumbnail_url || v.media_url || '',
            lengthSeconds: undefined as number | undefined,
            createdTime: v.timestamp,
            source: 'instagram' as const,
          })),
          paging: data.paging,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to fetch IG videos: ${msg}` });
      }
    }),

  // ── Video Selector: Campaign Videos ───────────────────────────────────────────
  getCampaignVideos: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      adAccountId: z.string().min(1),
      campaignId: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const { accessToken, adAccountId, campaignId, limit } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        // Get ads in the campaign, then extract unique video IDs from creatives
        const adsData = await metaGet(
          `/${campaignId}/ads`,
          { fields: 'id,name,creative{id,object_story_spec,asset_feed_spec}', limit: String(limit) },
          accessToken
        );
        const videoIds = new Set<string>();
        const videoMeta: Record<string, { adName: string; adId: string }> = {};
        for (const ad of (adsData.data || []) as Array<{ id: string; name: string; creative?: { object_story_spec?: Record<string, unknown>; asset_feed_spec?: Record<string, unknown> } }>) {
          const spec = ad.creative?.object_story_spec;
          const videoData = (spec?.video_data || spec?.link_data) as Record<string, unknown> | undefined;
          const videoId = videoData?.video_id as string | undefined;
          if (videoId) {
            videoIds.add(videoId);
            videoMeta[videoId] = { adName: ad.name, adId: ad.id };
          }
          const feedSpec = ad.creative?.asset_feed_spec as Record<string, unknown> | undefined;
          if (feedSpec?.videos) {
            for (const v of feedSpec.videos as Array<{ video_id?: string }>) {
              if (v.video_id) {
                videoIds.add(v.video_id);
                videoMeta[v.video_id] = { adName: ad.name, adId: ad.id };
              }
            }
          }
        }
        // Fetch video details for each unique video ID
        const videoList = await Promise.all(
          Array.from(videoIds).map(async (vid) => {
            try {
              const v = await metaGet(`/${vid}`, { fields: 'id,title,thumbnails,length,created_time' }, accessToken);
              return {
                id: v.id as string,
                title: (v.title as string) || (videoMeta[vid]?.adName) || vid,
                thumbnailUrl: ((v.thumbnails as { data: { uri: string }[] } | undefined)?.data?.[0]?.uri) || '',
                lengthSeconds: v.length as number | undefined,
                createdTime: v.created_time as string | undefined,
                source: 'campaign' as const,
                adName: videoMeta[vid]?.adName,
                adId: videoMeta[vid]?.adId,
              };
            } catch {
              return null;
            }
          })
        );
        return { videos: videoList.filter(Boolean) };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to fetch campaign videos: ${msg}` });
      }
    }),

  // ── Video Selector: Video Stats (3s views, last used) ─────────────────────────
  getVideoStats: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      adAccountId: z.string().min(1),
      videoIds: z.array(z.string()).min(1).max(50),
    }))
    .query(async ({ input }) => {
      const { accessToken, adAccountId, videoIds } = input;
      const accountId = normalizeAdAccountId(adAccountId);
      try {
        // Fetch video insights for 3-second views
        const statsMap: Record<string, { threeSecViews: number; lastUsed: string | null }> = {};
        // Initialize all requested IDs
        for (const vid of videoIds) {
          statsMap[vid] = { threeSecViews: 0, lastUsed: null };
        }
        // Query ad insights filtered by video_id to find last used
        const insightsData = await metaGet(
          `/${accountId}/insights`,
          {
            fields: 'video_id,video_3_sec_watched_actions,date_start',
            filtering: JSON.stringify([{ field: 'video_id', operator: 'IN', value: videoIds }]),
            level: 'ad',
            time_range: JSON.stringify({ since: '2020-01-01', until: new Date().toISOString().split('T')[0] }),
            limit: '500',
          },
          accessToken
        ).catch(() => ({ data: [] }));
        for (const row of (insightsData.data || []) as Array<{
          video_id?: string;
          video_3_sec_watched_actions?: Array<{ action_type: string; value: string }>;
          date_start?: string;
        }>) {
          const vid = row.video_id;
          if (!vid || !statsMap[vid]) continue;
          const views3s = row.video_3_sec_watched_actions?.find(a => a.action_type === 'video_view');
          if (views3s) statsMap[vid].threeSecViews += parseInt(views3s.value, 10) || 0;
          if (row.date_start) {
            const existing = statsMap[vid].lastUsed;
            if (!existing || row.date_start > existing) statsMap[vid].lastUsed = row.date_start;
          }
        }
        return { stats: statsMap };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to fetch video stats: ${msg}` });
      }
    }),

  // ── Lead Gen Forms ────────────────────────────────────────────────────────────
  getLeadGenForms: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      pageId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const { accessToken, pageId } = input;
      try {
        const data = await metaGet(
          `/${pageId}/leadgen_forms`,
          { fields: 'id,name,status,leads_count,created_time', limit: '100' },
          accessToken,
        );
        const forms = (data.data || []) as Array<{
          id: string;
          name: string;
          status: string;
          leads_count?: number;
          created_time?: string;
        }>;
        return { forms };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to fetch lead gen forms: ${msg}` });
      }
    }),

  /**
   * Geocode an address to lat/lng using Google Maps Geocoding API.
   * Used for custom_locations targeting in Meta Ads.
   */
  geocodeAddress: protectedProcedure
    .input(z.object({ address: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const data = await mapsRequest<{
          results: Array<{
            formatted_address: string;
            geometry: { location: { lat: number; lng: number } };
            place_id: string;
          }>;
          status: string;
        }>('/maps/api/geocode/json', { address: input.address });
        if (data.status !== 'OK' || !data.results?.length) {
          return { results: [] as Array<{ address: string; lat: number; lng: number; placeId: string }> };
        }
        return {
          results: data.results.slice(0, 5).map((r: { formatted_address: string; geometry: { location: { lat: number; lng: number } }; place_id: string }) => ({
            address: r.formatted_address,
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            placeId: r.place_id,
          })),
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Geocoding failed: ${msg}` });
      }
    }),
});
// ─── Targeting spec merge helperr (for overlap analysis) ───────────────────────
function mergeTargetingSpecs(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> {
  // Use the union of geo locations and the intersection of age/gender
  // This gives the broadest combined audience for inclusion-exclusion
  const merged: Record<string, unknown> = {};

  // Age: use the wider range
  const ageMin = Math.min(
    (a.age_min as number) || 18,
    (b.age_min as number) || 18
  );
  const ageMax = Math.max(
    (a.age_max as number) || 65,
    (b.age_max as number) || 65
  );
  merged.age_min = ageMin;
  merged.age_max = ageMax;

  // Gender: if both target same gender, keep it; otherwise all genders
  const gA = a.genders as number[] | undefined;
  const gB = b.genders as number[] | undefined;
  if (gA && gB && JSON.stringify(gA.sort()) === JSON.stringify(gB.sort())) {
    merged.genders = gA;
  }

  // Geo: union of countries/regions
  const geoA = (a.geo_locations as Record<string, unknown>) || {};
  const geoB = (b.geo_locations as Record<string, unknown>) || {};
  const countriesA = (geoA.countries as string[]) || [];
  const countriesB = (geoB.countries as string[]) || [];
  const allCountries = Array.from(new Set([...countriesA, ...countriesB]));
  if (allCountries.length > 0) {
    merged.geo_locations = { countries: allCountries };
  }

  // Publisher platforms: union
  const ppA = (a.publisher_platforms as string[]) || [];
  const ppB = (b.publisher_platforms as string[]) || [];
  const allPlatforms = Array.from(new Set([...ppA, ...ppB]));
  if (allPlatforms.length > 0) {
    merged.publisher_platforms = allPlatforms;
  }

  return merged;
}
