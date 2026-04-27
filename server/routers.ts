import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  createFeedback,
  createKnowledgeEntry,
  createSkillRun,
  deactivateToken,
  deleteFeedback,
  deleteKnowledgeEntry,
  getAllAppSettings,
  getAllTokens,
  getAllUsers,
  getActiveTokens,
  getAppSetting,
  getCreditsByUser,
  getKnowledgeEntries,
  getRecentRuns,
  getRunById,
  getRunsByUser,
  getRunsByUserAndSkill,
  getSkillSuccessCounts,
  getTokenById,
  getUserSuccessCounts,
  insertToken,
  listFeedback,
  setAppSetting,
  updateSkillRun,
  updateToken,
} from "./db";
import axios from "axios";
import { buildSkillPrompt, listManusSkills, runManusSkillTask, SKILL_IDS } from "./manusTask";
import { ENV } from "./_core/env";

const META_BASE = "https://graph.facebook.com/v21.0";

/**
 * Resolve the current billing period window.
 * Priority:
 *   1. Explicit billingPeriodStart + billingPeriodEnd dates stored in app_settings.
 *   2. billingCycleStartDay (day-of-month) — rolling window starting that day each month.
 *   3. Default: calendar month (day 1).
 */
async function resolveBillingPeriod(): Promise<{ periodStart: Date; periodEnd: Date; billingCycleStartDay: number; isExplicit: boolean }> {
  const startStr = await getAppSetting("billingPeriodStart");
  const endStr = await getAppSetting("billingPeriodEnd");

  if (startStr && endStr) {
    const periodStart = new Date(startStr + "T00:00:00.000Z");
    // End date is inclusive — set to end of that day
    const periodEnd = new Date(endStr + "T23:59:59.999Z");
    if (!isNaN(periodStart.getTime()) && !isNaN(periodEnd.getTime())) {
      return { periodStart, periodEnd, billingCycleStartDay: periodStart.getUTCDate(), isExplicit: true };
    }
  }

  // Fallback: rolling day-of-month window
  const startDayStr = await getAppSetting("billingCycleStartDay");
  const startDay = startDayStr ? Math.max(1, Math.min(28, parseInt(startDayStr, 10))) : 1;
  const now = new Date();
  const today = now.getDate();
  let periodStart: Date;
  if (today >= startDay) {
    periodStart = new Date(now.getFullYear(), now.getMonth(), startDay);
  } else {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periodStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), startDay);
  }
  return { periodStart, periodEnd: now, billingCycleStartDay: startDay, isExplicit: false };
}

async function metaGet(path: string, params: Record<string, string>, accessToken: string) {
  const resp = await axios.get(`${META_BASE}${path}`, {
    params: { ...params, access_token: accessToken },
    timeout: 30000,
  });
  return resp.data;
}

function normalizeAdAccountId(raw: string): string {
  return `act_${raw.replace(/^act_/, "")}`;
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  meta: router({
    validateToken: protectedProcedure
      .input(z.object({ accessToken: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          const me = await metaGet("/me", { fields: "id,name" }, input.accessToken);
          const bms = await metaGet("/me/businesses", { fields: "id,name" }, input.accessToken);
          return { valid: true, userId: me.id as string, userName: me.name as string, businesses: (bms.data || []) as Array<{ id: string; name: string }> };
        } catch {
          return { valid: false, userId: "", userName: "", businesses: [] };
        }
      }),

    getAdAccounts: protectedProcedure
      .input(z.object({ businessManagerId: z.string().min(1), tokenId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const token = await getTokenById(input.tokenId);
        if (!token) throw new TRPCError({ code: "NOT_FOUND", message: "Token not found." });
        type AdAccount = { id: string; name: string; currency: string; account_status: number };

        // Paginate through all pages of a Meta Graph API list endpoint
        async function fetchAllPages(path: string, params: Record<string, string>): Promise<AdAccount[]> {
          const results: AdAccount[] = [];
          let url: string | null = null;
          let firstPage = true;
          while (firstPage || url) {
            let data: { data?: AdAccount[]; paging?: { next?: string } };
            if (firstPage) {
              data = await metaGet(path, params, token!.accessToken);
              firstPage = false;
            } else {
              const resp = await axios.get(url!, { params: { access_token: token!.accessToken }, timeout: 30000 });
              data = resp.data;
            }
            results.push(...(data.data ?? []));
            url = data.paging?.next ?? null;
          }
          return results;
        }

        try {
          const fields = "id,name,currency,account_status";
          const limit = "200";
          // Fetch both owned accounts (direct) and client accounts (via agency relationship)
          const [owned, client] = await Promise.allSettled([
            fetchAllPages(`/${input.businessManagerId}/owned_ad_accounts`, { fields, limit }),
            fetchAllPages(`/${input.businessManagerId}/client_ad_accounts`, { fields, limit }),
          ]);
          const all: AdAccount[] = [
            ...(owned.status === "fulfilled" ? owned.value : []),
            ...(client.status === "fulfilled" ? client.value : []),
          ];
          // Deduplicate by id, then sort alphabetically by name
          const seen = new Set<string>();
          const deduped = all.filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
          return deduped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        } catch { return []; }
      }),
    getCampaigns: protectedProcedure
      .input(z.object({ adAccountId: z.string().min(1), tokenId: z.number().int().positive(), statusFilter: z.string().optional() }))
      .query(async ({ input }) => {
        const token = await getTokenById(input.tokenId);
        if (!token) throw new TRPCError({ code: "NOT_FOUND", message: "Token not found." });
        const accountId = normalizeAdAccountId(input.adAccountId);
        type Campaign = { id: string; name: string; status: string; objective: string };
        try {
          const params: Record<string, string> = { fields: "id,name,status,objective", limit: "200" };
          if (input.statusFilter === "active") params.effective_status = '["ACTIVE"]';
          else if (input.statusFilter === "inactive") params.effective_status = '["PAUSED","ARCHIVED","DELETED"]';
          // else last_30d / all — no status filter, rely on date filtering at analysis time
          // Paginate through all campaign pages
          const results: Campaign[] = [];
          let url: string | null = null;
          let firstPage = true;
          while (firstPage || url) {
            let data: { data?: Campaign[]; paging?: { next?: string } };
            if (firstPage) {
              data = await metaGet(`/${accountId}/campaigns`, params, token.accessToken);
              firstPage = false;
            } else {
              const resp = await axios.get(url!, { params: { access_token: token.accessToken }, timeout: 30000 });
              data = resp.data;
            }
            results.push(...(data.data ?? []));
            url = data.paging?.next ?? null;
          }
          return results;
        } catch { return []; }
      }),
  }),

  tokens: router({
    listActive: protectedProcedure.query(async () => getActiveTokens()),
    listAll: adminProcedure.query(async () => getAllTokens()),

    add: adminProcedure
      .input(z.object({
        label: z.string().min(1).max(255),
        businessManagerId: z.string().min(1),
        businessManagerName: z.string().optional(),
        accessToken: z.string().min(1),
        tokenExpiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await insertToken({
          label: input.label,
          businessManagerId: input.businessManagerId,
          businessManagerName: input.businessManagerName ?? null,
          accessToken: input.accessToken,
          tokenExpiresAt: input.tokenExpiresAt ?? null,
          isActive: true,
          addedByUserId: ctx.user.id,
        });
        return { id };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        label: z.string().min(1).max(255).optional(),
        accessToken: z.string().min(1).optional(),
        tokenExpiresAt: z.date().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...patch } = input;
        await updateToken(id, patch as Parameters<typeof updateToken>[1]);
        return { success: true };
      }),

    deactivate: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deactivateToken(input.id);
        return { success: true };
      }),
  }),

  runs: router({
    start: protectedProcedure
      .input(z.object({
        skillId: z.string().min(1),
        skillName: z.string().min(1),
        adAccountId: z.string().optional(),
        adAccountName: z.string().optional(),
        businessManagerId: z.string().optional(),
        datePreset: z.string().optional(),
        campaignIds: z.array(z.string()).optional(),
        extraParams: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createSkillRun({
          userId: ctx.user.id,
          skillId: input.skillId,
          skillName: input.skillName,
          status: "running",
          adAccountId: input.adAccountId ?? null,
          adAccountName: input.adAccountName ?? null,
          businessManagerId: input.businessManagerId ?? null,
          datePreset: input.datePreset ?? null,
          campaignIds: input.campaignIds ?? [],
          extraParams: input.extraParams ?? {},
        });
        return { runId: id };
      }),

    complete: protectedProcedure
      .input(z.object({
        runId: z.number().int().positive(),
        status: z.enum(["success", "error"]),
        reportMarkdown: z.string().optional(),
        errorMessage: z.string().optional(),
        durationMs: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateSkillRun(input.runId, {
          status: input.status,
          reportMarkdown: input.reportMarkdown,
          errorMessage: input.errorMessage,
          durationMs: input.durationMs,
        });
        return { success: true };
      }),

    /**
     * execute: Creates a skill run record, calls the Manus Task API with the
     * appropriate skill prompt, polls until completion, and saves the report.
     * Requires MANUS_API_KEY env var to be set (admin configures via Token Vault).
     */
    execute: protectedProcedure
      .input(z.object({
        skillId: z.string().min(1),
        skillName: z.string().min(1),
        adAccountId: z.string().min(1),
        adAccountName: z.string().optional(),
        businessManagerId: z.string().optional(),
        datePreset: z.string().default("last_7d"),
        campaignIds: z.array(z.string()).optional(),
        additionalInstructions: z.string().optional(),
        extraParams: z.record(z.string(), z.unknown()).optional(),
        agentProfile: z.enum(["manus-1.6", "manus-1.6-lite", "manus-1.6-max"]).default("manus-1.6-lite"),
      }))
      .mutation(async ({ ctx, input }) => {
        const apiKey = process.env.MANUS_API_KEY;
        if (!apiKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "MANUS_API_KEY is not configured. Please ask your admin to add it in the Token Vault.",
          });
        }

        // Fetch knowledge base context for this skill
        const knowledge = await getKnowledgeEntries();
        const relevantKnowledge = knowledge
          .filter((k) => k.category === "general" || k.category === input.skillId)
          .map((k) => `[${k.title}]\n${k.content}`)
          .join("\n\n");

        // Look up the Manus project ID configured for this skill
        const skillProjectId = await getAppSetting(`skillProjectId:${input.skillId}`) ?? undefined;

        // Create the run record immediately so we can return the runId right away.
        // The actual Manus agent call runs in the background — this prevents HTTP
        // request timeouts on the deployed platform (which kills requests after ~60s).
        const runId = await createSkillRun({
          userId: ctx.user.id,
          skillId: input.skillId,
          skillName: input.skillName,
          status: "running",
          adAccountId: input.adAccountId,
          adAccountName: input.adAccountName ?? null,
          businessManagerId: input.businessManagerId ?? null,
          datePreset: input.datePreset,
          campaignIds: input.campaignIds ?? [],
          extraParams: input.extraParams ?? {},
        });

        const startedAt = Date.now();

        // ── Fire-and-forget background execution ──────────────────────────
        // We intentionally do NOT await this. The HTTP response returns the
        // runId immediately; the frontend polls getRunStatus for progress.
        (async () => {
          try {
            const prompt = buildSkillPrompt(input.skillId, {
              adAccountId: input.adAccountId,
              businessManagerId: input.businessManagerId,
              campaignIds: input.campaignIds,
              dateRange: input.datePreset,
              additionalInstructions: input.additionalInstructions,
              knowledgeContext: relevantKnowledge || undefined,
            });

            const statusLog: Array<{ ts: number; msg: string }> = [];

            // Persist status log entries to DB every 5 progress messages so
            // the polling endpoint can surface them to the frontend in real time.
            let flushCounter = 0;
            const flushStatusLog = async () => {
              await updateSkillRun(runId, { statusLog }).catch(() => {});
            };

            const result = await runManusSkillTask({
              apiKey,
              skillId: input.skillId,
              prompt,
              agentProfile: input.agentProfile,
              projectId: skillProjectId,
              onProgress: async (msg: string) => {
                statusLog.push({ ts: Date.now(), msg });
                console.log(`[Run ${runId}] ${msg}`);
                flushCounter++;
                if (flushCounter % 3 === 0) await flushStatusLog();
              },
            });

            const durationMs = Date.now() - startedAt;
            await updateSkillRun(runId, {
              status: result.status,
              reportMarkdown: result.report || result.errorMessage,
              errorMessage: result.errorMessage,
              taskUrl: result.taskUrl,
              attachments: result.attachments,
              statusLog,
              durationMs,
              creditUsage: result.creditUsage ?? null,
            });
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`[Run ${runId}] Background execution failed:`, errorMessage);
            await updateSkillRun(runId, {
              status: "error",
              errorMessage,
              durationMs: Date.now() - startedAt,
            }).catch(() => {});
          }
        })();

        // Return immediately — frontend polls getRunStatus for updates.
        return { runId, status: "running" as const };
      }),

    /**
     * verifyManusKey: Admin-only — tests the MANUS_API_KEY by listing available skills.
     */
    verifyManusKey: adminProcedure.mutation(async () => {
      const apiKey = process.env.MANUS_API_KEY;
      if (!apiKey) {
        return { ok: false, message: "MANUS_API_KEY is not set." };
      }
      try {
        const skills = await listManusSkills(apiKey);
        const skillNames = skills.map((s: { name?: string; id?: string }) => s.name ?? s.id).join(", ");
        return { ok: true, message: `Connected. Available skills: ${skillNames || "(none listed)"}` };
      } catch (err: unknown) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    }),

    myRuns: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
      .query(async ({ ctx, input }) => getRunsByUser(ctx.user.id, input.limit)),
    skillHistory: protectedProcedure
      .input(z.object({ skillId: z.string().min(1), limit: z.number().int().min(1).max(100).default(50) }))
      .query(async ({ ctx, input }) => getRunsByUserAndSkill(ctx.user.id, input.skillId, input.limit)),

    /**
     * getRunStatus: Lightweight poll for a running task's current status.
     * Returns status, elapsed time, statusLog entries, and result when done.
     */
    getRunStatus: protectedProcedure
      .input(z.object({ runId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return {
          runId: run.id,
          status: run.status,
          statusLog: (run.statusLog as Array<{ ts: number; msg: string }> | null) ?? [],
          taskUrl: run.taskUrl ?? null,
          attachments: (run.attachments as Array<{ filename: string; url: string; contentType: string }> | null) ?? [],
          reportMarkdown: run.reportMarkdown ?? null,
          errorMessage: run.errorMessage ?? null,
          durationMs: run.durationMs ?? null,
          creditUsage: run.creditUsage ?? null,
          startedAt: run.startedAt,
          completedAt: run.completedAt ?? null,
        };
      }),

    getReport: protectedProcedure
      .input(z.object({ runId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return run;
      }),

    allRuns: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
      .query(async ({ input }) => getRecentRuns(input.limit)),

    userSuccessCounts: adminProcedure.query(async () => getUserSuccessCounts()),
    skillSuccessCounts: adminProcedure.query(async () => getSkillSuccessCounts()),
    creditsByUser: adminProcedure.query(async () => {
      const { periodStart, periodEnd } = await resolveBillingPeriod();
      return getCreditsByUser({ periodStart, periodEnd });
    }),

    /**
     * Compute billing period window.
     * Prefers explicit billingPeriodStart/End dates set by admin.
     * Falls back to billingCycleStartDay (day-of-month) for backward compat.
     */
    billingPeriodWindow: protectedProcedure.query(async () => {
      const { periodStart, periodEnd, billingCycleStartDay } = await resolveBillingPeriod();
      return { periodStart, periodEnd, billingCycleStartDay };
    }),

    /**
     * billingPeriodCredits: Sums credit_usage from the Manus API for all tasks
     * created within the current billing period.
     * Uses explicit start/end dates if set by admin, otherwise falls back to billingCycleStartDay.
     * Falls back to DB sum if API is unavailable.
     */
    billingPeriodCredits: protectedProcedure.query(async () => {
      const apiKey = process.env.MANUS_API_KEY;
      if (!apiKey) return { creditsUsed: null, source: "none" as const, periodStart: null, periodEnd: null, billingCycleStartDay: 1 };

      const { periodStart, periodEnd, billingCycleStartDay: startDay } = await resolveBillingPeriod();

      try {
        const axiosInst = (await import("axios")).default;
        const headers = { "x-manus-api-key": apiKey };

        let totalCredits = 0;
        let cursor: string | undefined;
        const PAGE_SIZE = 50;

        do {
          const params: Record<string, string | number> = { limit: PAGE_SIZE };
          if (cursor) params.cursor = cursor;
          const resp = await axiosInst.get("https://api.manus.ai/v2/task.list", {
            params,
            headers,
            timeout: 15000,
          });
          const respData = resp.data?.data ?? resp.data?.tasks ?? [];
          const tasks: Array<{ created_at?: string; credit_usage?: number }> = respData;
          if (!tasks.length && !resp.data?.next_cursor) break;
          // created_at is Unix timestamp in SECONDS (string)
          const periodTasks = tasks.filter((t) => {
            if (!t.created_at) return false;
            const tsMs = Number(t.created_at) * 1000;
            const d = new Date(tsMs);
            return d >= periodStart && d <= periodEnd;
          });
          totalCredits += periodTasks.reduce((sum, t) => sum + (t.credit_usage ?? 0), 0);
          const oldest = tasks[tasks.length - 1];
          const oldestTsMs = oldest?.created_at ? Number(oldest.created_at) * 1000 : 0;
          const oldestDate = oldestTsMs ? new Date(oldestTsMs) : null;
          cursor = (tasks.length === PAGE_SIZE && oldestDate && oldestDate >= periodStart)
            ? (resp.data.next_cursor ?? undefined)
            : undefined;
        } while (cursor);

        return { creditsUsed: totalCredits, source: "api" as const, periodStart, periodEnd, billingCycleStartDay: startDay };
      } catch {
        // Fallback: sum creditUsage from our own DB
        const db = await (await import("./db.js")).getDb();
        if (!db) return { creditsUsed: null, source: "none" as const, periodStart, periodEnd, billingCycleStartDay: startDay };
        const { skillRuns } = await import("../drizzle/schema.js");
        const { sql, gte: gteOp, lte: lteOp, and: andOp } = await import("drizzle-orm");
        const [row] = await db
          .select({ total: sql<number>`COALESCE(SUM(creditUsage), 0)` })
          .from(skillRuns)
          .where(andOp(gteOp(skillRuns.startedAt, periodStart), lteOp(skillRuns.startedAt, periodEnd)));
        return { creditsUsed: row?.total ?? 0, source: "db" as const, periodStart, periodEnd, billingCycleStartDay: startDay };
      }
    }),

    /**
     * dailyCreditsChart: Returns per-day credit usage for the current billing period.
     * Used to render the credits bar chart on the Dashboard.
     */
    dailyCreditsChart: protectedProcedure.query(async () => {
      const apiKey = process.env.MANUS_API_KEY;
      if (!apiKey) return { days: [] as Array<{ date: string; credits: number }>, periodStart: null, periodEnd: null, billingCycleStartDay: 1 };

      const { periodStart, periodEnd, billingCycleStartDay: startDay } = await resolveBillingPeriod();

      try {
        const axiosInst = (await import("axios")).default;
        const headers = { "x-manus-api-key": apiKey };
        const allTasks: Array<{ created_at?: string; credit_usage?: number }> = [];
        let cursor: string | undefined;
        const PAGE_SIZE = 50;

        do {
          const params: Record<string, string | number> = { limit: PAGE_SIZE };
          if (cursor) params.cursor = cursor;
          const resp = await axiosInst.get("https://api.manus.ai/v2/task.list", {
            params,
            headers,
            timeout: 15000,
          });
          const respData = resp.data?.data ?? resp.data?.tasks ?? [];
          const tasks: Array<{ created_at?: string; credit_usage?: number }> = respData;
          if (!tasks.length && !resp.data?.next_cursor) break;
          const periodTasks = tasks.filter((t) => {
            if (!t.created_at) return false;
            const d = new Date(Number(t.created_at) * 1000);
            return d >= periodStart && d <= periodEnd;
          });
          allTasks.push(...periodTasks);
          const oldest = tasks[tasks.length - 1];
          const oldestTsMs = oldest?.created_at ? Number(oldest.created_at) * 1000 : 0;
          const oldestDate = oldestTsMs ? new Date(oldestTsMs) : null;
          cursor = (tasks.length === PAGE_SIZE && oldestDate && oldestDate >= periodStart)
            ? (resp.data.next_cursor ?? undefined)
            : undefined;
        } while (cursor);

        // Group by date (YYYY-MM-DD)
        const byDay: Record<string, number> = {};
        for (const t of allTasks) {
          if (!t.created_at) continue;
          const d = new Date(Number(t.created_at) * 1000);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          byDay[key] = (byDay[key] ?? 0) + (t.credit_usage ?? 0);
        }

        // Build a complete day-by-day array from periodStart to periodEnd
        const days: Array<{ date: string; credits: number }> = [];
        const cur = new Date(periodStart);
        const endDay = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
        while (cur <= endDay) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
          days.push({ date: key, credits: byDay[key] ?? 0 });
          cur.setDate(cur.getDate() + 1);
        }

        return { days, periodStart, periodEnd, billingCycleStartDay: startDay };
      } catch {
        return { days: [] as Array<{ date: string; credits: number }>, periodStart, periodEnd, billingCycleStartDay: startDay };
      }
    }),

    // monthlyCreditsUsed — now uses the admin-configured billing period (explicit dates or day-of-month)
    monthlyCreditsUsed: protectedProcedure.query(async () => {
      const apiKey = process.env.MANUS_API_KEY;
      if (!apiKey) return { creditsUsed: null, source: "none" as const };

      const { periodStart, periodEnd } = await resolveBillingPeriod();

      try {
        const axiosInst = (await import("axios")).default;
        const headers = { "x-manus-api-key": apiKey };
        let totalCredits = 0;
        let cursor: string | undefined;
        const PAGE_SIZE = 50;

        do {
          const params: Record<string, string | number> = { limit: PAGE_SIZE };
          if (cursor) params.cursor = cursor;
          const resp = await axiosInst.get("https://api.manus.ai/v2/task.list", {
            params,
            headers,
            timeout: 15000,
          });
          const respData = resp.data?.data ?? resp.data?.tasks ?? [];
          const tasks: Array<{ created_at?: string; credit_usage?: number }> = respData;
          if (!tasks.length && !resp.data?.next_cursor) break;
          const periodTasks = tasks.filter((t) => {
            if (!t.created_at) return false;
            const d = new Date(Number(t.created_at) * 1000);
            return d >= periodStart && d <= periodEnd;
          });
          totalCredits += periodTasks.reduce((sum, t) => sum + (t.credit_usage ?? 0), 0);
          const oldest = tasks[tasks.length - 1];
          const oldestTsMs = oldest?.created_at ? Number(oldest.created_at) * 1000 : 0;
          const oldestDate = oldestTsMs ? new Date(oldestTsMs) : null;
          cursor = (tasks.length === PAGE_SIZE && oldestDate && oldestDate >= periodStart)
            ? (resp.data.next_cursor ?? undefined)
            : undefined;
        } while (cursor);

        return { creditsUsed: totalCredits, source: "api" as const };
      } catch {
        const db = await (await import("./db.js")).getDb();
        if (!db) return { creditsUsed: null, source: "none" as const };
        const { skillRuns } = await import("../drizzle/schema.js");
        const { sql, gte: gteOp, lte: lteOp, and: andOp } = await import("drizzle-orm");
        const [row] = await db
          .select({ total: sql<number>`COALESCE(SUM(creditUsage), 0)` })
          .from(skillRuns)
          .where(andOp(gteOp(skillRuns.startedAt, periodStart), lteOp(skillRuns.startedAt, periodEnd)));
        return { creditsUsed: row?.total ?? 0, source: "db" as const };
      }
    }),
  }),

  settings: router({
    getAll: adminProcedure.query(async () => getAllAppSettings()),

    set: adminProcedure
      .input(z.object({
        key: z.string().min(1).max(128),
        value: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await setAppSetting(input.key, input.value, ctx.user.id);
        return { success: true };
      }),

    billingCycleStartDay: protectedProcedure.query(async () => {
      // Legacy: kept for backward compat, returns day from explicit start date if set
      const startStr = await getAppSetting("billingPeriodStart");
      if (startStr) {
        const d = new Date(startStr);
        return { day: isNaN(d.getTime()) ? 1 : d.getDate() };
      }
      const val = await getAppSetting("billingCycleStartDay");
      return { day: val ? parseInt(val, 10) : 1 };
    }),

    setBillingCycleStartDay: adminProcedure
      .input(z.object({ day: z.number().int().min(1).max(28) }))
      .mutation(async ({ ctx, input }) => {
        await setAppSetting("billingCycleStartDay", String(input.day), ctx.user.id);
        return { success: true };
      }),

    /** Get the explicit billing period start/end dates set by admin */
    billingPeriod: protectedProcedure.query(async () => {
      const startStr = await getAppSetting("billingPeriodStart");
      const endStr = await getAppSetting("billingPeriodEnd");
      return {
        periodStart: startStr ?? null,
        periodEnd: endStr ?? null,
      };
    }),

    /** Admin sets explicit billing period start and end dates (ISO date strings YYYY-MM-DD) */
    setBillingPeriod: adminProcedure
      .input(z.object({
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
      }))
      .mutation(async ({ ctx, input }) => {
        await setAppSetting("billingPeriodStart", input.periodStart, ctx.user.id);
        await setAppSetting("billingPeriodEnd", input.periodEnd, ctx.user.id);
        return { success: true };
      }),

    /** Returns masked status of MANUS_API_KEY — never exposes the full key */
    manusApiKeyStatus: adminProcedure.query(async () => {
      const key = process.env.MANUS_API_KEY;
      if (!key) return { configured: false, masked: null as string | null };
      const masked = key.length > 8
        ? key.slice(0, 4) + "*".repeat(Math.max(0, key.length - 8)) + key.slice(-4)
        : "****";
      return { configured: true, masked };
    }),

    /** Returns Google Sheets config stored in app_settings */
    googleSheetsConfig: adminProcedure.query(async () => {
      const sheetId = await getAppSetting("googleSheetId");
      const sheetName = await getAppSetting("googleSheetName");
      return { sheetId: sheetId ?? null, sheetName: sheetName ?? null };
    }),

    /** Admin sets Google Sheets config */
    setGoogleSheetsConfig: adminProcedure
      .input(z.object({
        sheetId: z.string().min(1),
        sheetName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await setAppSetting("googleSheetId", input.sheetId, ctx.user.id);
        if (input.sheetName !== undefined) await setAppSetting("googleSheetName", input.sheetName ?? "", ctx.user.id);
        return { success: true };
      }),

    /** Returns all per-skill project ID assignments */
    skillProjectIds: adminProcedure.query(async () => {
      const all = await getAllAppSettings();
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith("skillProjectId:")) {
          result[k.replace("skillProjectId:", "")] = v;
        }
      }
      return result;
    }),

    /** Admin sets a project ID for a specific skill */
    setSkillProjectId: adminProcedure
      .input(z.object({
        skillId: z.string().min(1),
        projectId: z.string(), // empty string clears the assignment
      }))
      .mutation(async ({ ctx, input }) => {
        await setAppSetting(`skillProjectId:${input.skillId}`, input.projectId, ctx.user.id);
        return { success: true };
      }),
  }),

  users: router({
    list: adminProcedure.query(async () => getAllUsers()),
  }),

  knowledge: router({
    list: protectedProcedure.query(async () => getKnowledgeEntries()),

    add: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        category: z.string().default("general"),
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createKnowledgeEntry({ ...input, addedByUserId: ctx.user.id });
        return { id };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteKnowledgeEntry(input.id);
        return { success: true };
      }),
  }),

  feedback: router({
    /** Submit feedback (any logged-in user) */
    submit: protectedProcedure
      .input(z.object({
        category: z.enum(["skill", "suggestion", "general"]),
        skillId: z.string().optional(),
        skillName: z.string().optional(),
        message: z.string().min(1).max(4000),
        rating: z.number().int().min(1).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createFeedback({
          userId: ctx.user.id,
          category: input.category,
          skillId: input.skillId ?? null,
          skillName: input.skillName ?? null,
          message: input.message,
          rating: input.rating ?? null,
        });
        return { id };
      }),

    /** List all feedback (admin only) */
    list: adminProcedure
      .input(z.object({
        category: z.enum(["skill", "suggestion", "general"]).optional(),
      }).optional())
      .query(async ({ input }) => listFeedback(input ?? {})),

    /** Delete a feedback entry (admin only) */
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteFeedback(input.id);
        return { success: true };
      }),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
        context: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = `You are an expert Meta Ads AI assistant embedded in the Pathlabs Intelligence Platform. You help users interpret results from five analysis skills: Weekly Optimization (breakdown-level insights with statistical significance), Performance Insights (KPI-anchored analysis with placement conversion data), Creative Lifecycle (fatigue detection using CDR, BOCPD, CUSUM, EWMA, and Frequency-CPM elasticity), Structural Audit (Andromeda-focused account health checks), and Audience Overlap & Wasted Spend (pairwise overlap with CPM-based wasted spend estimation).

Key concepts you deeply understand: Meta auction mechanics, CPM dynamics, creative fatigue signals, signal density and CAPI, learning phase risks, liquidity consolidation, ASC adoption, and budget pacing.

Always use standard metric abbreviations: CPM, CPC, CTR, CPA, CPL, CPLV, CPVV.

Be concise, specific, and actionable. When interpreting metrics, anchor to the optimization goal.${input.context ? `

User context: ${input.context}` : ""}`;

        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...input.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const result = await invokeLLM({ messages: llmMessages });
        const content = result.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
        return { content };
      }),
  }),
});
export type AppRouter = typeof appRouter;
