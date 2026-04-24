import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  createKnowledgeEntry,
  createSkillRun,
  deactivateToken,
  deleteKnowledgeEntry,
  getAllTokens,
  getAllUsers,
  getActiveTokens,
  getKnowledgeEntries,
  getRecentRuns,
  getRunById,
  getRunsByUser,
  getSkillSuccessCounts,
  getTokenById,
  getUserSuccessCounts,
  insertToken,
  updateSkillRun,
  updateToken,
} from "./db";
import axios from "axios";
import { buildSkillPrompt, listManusSkills, runManusSkillTask, SKILL_IDS } from "./manusTask";
import { ENV } from "./_core/env";

const META_BASE = "https://graph.facebook.com/v21.0";

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
