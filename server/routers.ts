import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { metaRouter } from "./routers/meta";
import { sessionsRouter } from "./routers/sessions";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  createFeedback,
  createKnowledgeEntry,
  createSkillRun,
  deactivateToken,
  deleteFeedback,
  getFeedbackUnreadCount,
  markFeedbackRead,
  deleteKnowledgeEntry,
  getAllAppSettings,
  getAllTokens,
  getAllUsers,
  getTeamMembers,
  setUserRole,
  getActiveTokens,
  getAppSetting,
  getCreditsByUser,
  getCreditsByUserForUser,
  getKnowledgeEntries,
  getLastSkillOutput,
  getRecentRuns,
  getRecentRunsWithSidecar,
  getRunById,
  getSidecarJsonByRunId,
  getRunsByUser,
  getRunsByUserAndSkill,
  getSkillSuccessCounts,
  getTokenById,
  getFirstActiveTokenWithValue,
  getUserSuccessCounts,
  insertToken,
  listFeedback,
  setAppSetting,
  updateSkillRun,
  updateToken,
} from "./db";
import axios from "axios";
import { buildSkillPrompt, buildCampaignCreationPrompt, listManusSkills, runManusSkillTask, SKILL_IDS } from "./manusTask";
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

  meta: metaRouter,
  sessions: sessionsRouter,

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
        tokenId: z.number().int().positive().optional(),
        datePreset: z.string().default("last_7d"),
        campaignIds: z.array(z.string()).optional(),
        additionalInstructions: z.string().optional(),
        extraParams: z.record(z.string(), z.unknown()).optional(),
        agentProfile: z.enum(["manus-1.6", "manus-1.6-lite", "manus-1.6-max"]).default("manus-1.6-lite"),
      }))
      .mutation(async ({ ctx, input }) => {
        // ── Team membership gate ───────────────────────────────────────────────
        // Only users verified as team members (isTeamMember = true) may execute
        // skill runs. This is enforced server-side regardless of UI state.
        if (!ctx.user.isTeamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Skill runs require a Pathlabs team account. Please contact your admin.",
          });
        }
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

        // Fetch the Meta access token from the Token Vault so we can inject it
        // into the skill prompt at runtime (skills must NOT have hardcoded tokens).
        let metaAccessToken: string | undefined;
        if (input.tokenId) {
          const tokenEntry = await getTokenById(input.tokenId);
          metaAccessToken = tokenEntry?.accessToken ?? undefined;
        }
        if (!metaAccessToken) {
          // Fallback: use the first active token if no specific tokenId provided
          const fallbackToken = await getFirstActiveTokenWithValue();
          metaAccessToken = fallbackToken?.accessToken ?? undefined;
        }

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
            // Resolve enrichment sidecar JSON for Performance Insights
            let enrichOverlapJson: string | undefined;
            let enrichLifecycleJson: string | undefined;
            if (input.skillId === "performance-insights") {
              const ep = input.extraParams as Record<string, unknown>;
              const overlapRunId = typeof ep?.enrichOverlapRunId === "number" ? ep.enrichOverlapRunId : null;
              const lifecycleRunId = typeof ep?.enrichLifecycleRunId === "number" ? ep.enrichLifecycleRunId : null;
              if (overlapRunId) {
                const run = await getSidecarJsonByRunId(overlapRunId);
                if (run?.sidecarJson) enrichOverlapJson = run.sidecarJson;
              }
              if (lifecycleRunId) {
                const run = await getSidecarJsonByRunId(lifecycleRunId);
                if (run?.sidecarJson) enrichLifecycleJson = run.sidecarJson;
              }
            }

            const prompt = buildSkillPrompt(input.skillId, {
              adAccountId: input.adAccountId,
              businessManagerId: input.businessManagerId,
              campaignIds: input.campaignIds,
              dateRange: input.datePreset,
              additionalInstructions: input.additionalInstructions,
              knowledgeContext: relevantKnowledge || undefined,
              accessToken: metaAccessToken,
              enrichOverlapJson,
              enrichLifecycleJson,
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
              onProgress: async (msg: string, taskId?: string) => {
                statusLog.push({ ts: Date.now(), msg });
                console.log(`[Run ${runId}] ${msg}`);
                // Store manusTaskId as soon as we have it (first progress after task creation)
                if (taskId) {
                  await updateSkillRun(runId, { manusTaskId: taskId }).catch(() => {});
                }
                flushCounter++;
                if (flushCounter % 3 === 0) await flushStatusLog();
              },
            });

            const durationMs = Date.now() - startedAt;

            // For skills that produce a JSON sidecar (Audience Overlap, Creative Lifecycle),
            // fetch the JSON attachment and store it for downstream enrichment in Performance Insights.
            const SIDECAR_SKILLS = ["audience-overlap", "creative-lifecycle"];  // app-level skill IDs
            let sidecarJson: string | null = null;
            if (result.status === "success" && SIDECAR_SKILLS.includes(input.skillId)) {
              const jsonAtt = result.attachments.find(
                (a) => a.filename.endsWith(".json") && a.url
              );
              if (jsonAtt) {
                try {
                  const jsonResp = await axios.get(jsonAtt.url, {
                    timeout: 20000,
                    responseType: "text",
                    headers: jsonAtt.url.includes("api.manus.ai")
                      ? { "x-manus-api-key": apiKey }
                      : {},
                  });
                  sidecarJson = typeof jsonResp.data === "string"
                    ? jsonResp.data
                    : JSON.stringify(jsonResp.data);
                  console.log(`[Run ${runId}] Sidecar JSON captured from ${jsonAtt.filename} (${sidecarJson.length} chars)`);
                } catch (jsonErr) {
                  console.warn(`[Run ${runId}] Failed to fetch sidecar JSON from ${jsonAtt.filename}:`, jsonErr);
                }
              }
            }

            await updateSkillRun(runId, {
              status: result.status,
              reportMarkdown: result.report || result.errorMessage,
              errorMessage: result.errorMessage,
              taskUrl: result.taskUrl,
              attachments: result.attachments,
              statusLog,
              durationMs,
              creditUsage: result.creditUsage ?? null,
              manusTaskId: result.taskId,
              sidecarJson,
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

    /**
     * abortRun: Stop a running Manus task and mark the run as error/aborted.
     * Uses the Manus task.stop API.
     */
    abortRun: protectedProcedure
      .input(z.object({ runId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (run.status !== "running") return { success: false, message: "Run is not currently running." };

        const apiKey = process.env.MANUS_API_KEY;
        if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MANUS_API_KEY not configured" });

        const manusTaskId = (run as { manusTaskId?: string }).manusTaskId;
        if (manusTaskId) {
          try {
            await axios.post(
              "https://api.manus.ai/v2/task.stop",
              { task_id: manusTaskId },
              { headers: { "x-manus-api-key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
            );
          } catch (e) {
            console.warn(`[abortRun] task.stop failed for ${manusTaskId}:`, e);
          }
        }

        await updateSkillRun(input.runId, {
          status: "error",
          errorMessage: "Run aborted by user.",
          durationMs: run.startedAt ? Date.now() - new Date(run.startedAt).getTime() : undefined,
        });
        return { success: true };
      }),

    /**
     * redeliverReport: Re-fetch attachments from a completed Manus task and update the run record.
     * Useful when the agent completed but no report was captured (e.g., structural audit with no files).
     */
    redeliverReport: protectedProcedure
      .input(z.object({ runId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

        const apiKey = process.env.MANUS_API_KEY;
        if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MANUS_API_KEY not configured" });

        const manusTaskId = (run as { manusTaskId?: string }).manusTaskId;
        if (!manusTaskId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Manus task ID stored for this run. Cannot redeliver." });
        }

        const headers = { "x-manus-api-key": apiKey };

        // Fetch all messages from the task
        const allMessages: Array<Record<string, unknown>> = [];
        let cursor: string | undefined;
        do {
          const resp = await axios.get("https://api.manus.ai/v2/task.listMessages", {
            params: { task_id: manusTaskId, order: "asc", limit: 100, ...(cursor ? { cursor } : {}) },
            headers,
            timeout: 15000,
          });
          if (!resp.data?.ok) break;
          const msgs: Array<Record<string, unknown>> = resp.data.messages ?? [];
          allMessages.push(...msgs);
          cursor = msgs.length === 100 ? resp.data.next_cursor : undefined;
        } while (cursor);

        // Extract attachments
        const rawAttachments = allMessages
          .flatMap((m) => (m.assistant_message as { attachments?: Array<{ url?: string; filename?: string; content_type?: string }> } | undefined)?.attachments ?? [])
          .filter((a) => a.url && a.filename);

        const attachments = rawAttachments.map((a) => ({
          filename: a.filename!,
          url: a.url!,
          contentType: a.content_type ?? "application/octet-stream",
        }));

        // Download .md files for report
        const mdAttachments = rawAttachments.filter((a) => a.filename?.endsWith(".md") && a.url);
        const reportSections: string[] = [];
        for (const att of mdAttachments) {
          try {
            const fileResp = await axios.get(att.url!, { timeout: 30000, responseType: "text", headers: att.url!.includes("api.manus.ai") ? headers : {} });
            const content = typeof fileResp.data === "string" ? fileResp.data : JSON.stringify(fileResp.data);
            if (content.trim()) reportSections.push(`## ${att.filename}\n\n${content}`);
          } catch { /* skip failed files */ }
        }

        // Fallback to assistant messages if no .md files
        let report = reportSections.join("\n\n---\n\n");
        if (!report) {
          const assistantMsgs = allMessages.filter(
            (m) => m.type === "assistant_message" && (m.assistant_message as { content?: string } | undefined)?.content?.trim()
          );
          report = assistantMsgs.map((m) => (m.assistant_message as { content: string }).content).join("\n\n");
        }

        if (!report && attachments.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No report content or attachments found in the Manus task." });
        }

        await updateSkillRun(input.runId, {
          status: "success",
          reportMarkdown: report || run.reportMarkdown || "Report redelivered — see attachments.",
          attachments,
        });

        return {
          success: true,
          reportMarkdown: report || run.reportMarkdown || "",
          attachments,
        };
      }),

    /**
     * requestUpdate: Send a status-check message to a running Manus task.
     * The agent will reply with a plain-language update on what it's currently doing.
     * The reply will be surfaced in the next poll cycle via the live status log.
     */
    requestUpdate: protectedProcedure
      .input(z.object({ runId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const run = await getRunById(input.runId);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        if (run.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (run.status !== "running") return { success: false, message: "Run is not currently running." };

        const apiKey = process.env.MANUS_API_KEY;
        if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MANUS_API_KEY not configured" });

        const manusTaskId = (run as { manusTaskId?: string }).manusTaskId;
        if (!manusTaskId) return { success: false, message: "No task ID stored yet — run may still be initializing." };

        try {
          await axios.post(
            "https://api.manus.ai/v2/task.sendMessage",
            {
              task_id: manusTaskId,
              message: {
                content: [
                  {
                    type: "text",
                    text: "Please provide a brief status update: what step are you currently on, what have you completed so far, and are there any errors or issues you have encountered?",
                  },
                ],
              },
            },
            { headers: { "x-manus-api-key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
          );
          return { success: true, message: "Update requested — response will appear in the live status feed shortly." };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          return { success: false, message: `Failed to send update request: ${errMsg}` };
        }
      }),

     allRuns: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
      .query(async ({ input }) => getRecentRuns(input.limit)),
    // Returns the most recent successful run output for the calling user + skillId.
    // Used to restore the output panel when the user navigates back to a skill page.
    lastOutput: protectedProcedure
      .input(z.object({ skillId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return getLastSkillOutput(ctx.user.id, input.skillId);
      }),
    /**
     * recentWithSidecar: Returns recent successful runs for a given skill that have sidecar JSON.
     * Used by Performance Insights to populate the enrichment picker.
     * Optionally filtered by adAccountId to show only runs for the same account.
     */
    recentWithSidecar: protectedProcedure
      .input(z.object({
        skillId: z.string().min(1),
        adAccountId: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }))
      .query(async ({ ctx, input }) => {
        return getRecentRunsWithSidecar(ctx.user.id, input.skillId, input.adAccountId, input.limit);
      }),

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

    // monthlyCreditsUsed — per-user, billing-period-aware, DB-based.
    // The Manus task.list API returns all workspace tasks (not per-user), so we
    // use the DB which records credit_usage per skill run per user.
    monthlyCreditsUsed: protectedProcedure.query(async ({ ctx }) => {
      const { periodStart, periodEnd } = await resolveBillingPeriod();
      const creditsUsed = await getCreditsByUserForUser(ctx.user.id, { periodStart, periodEnd });
      return { creditsUsed, source: "db" as const, periodStart, periodEnd };
    }),

    /**
     * launchCampaignBuild: Fires the pl-campaign-creation skill with the full
     * Campaign Builder state as the prompt. Returns a runId immediately; the
     * frontend polls getRunStatus for progress (same pattern as execute).
     */
    launchCampaignBuild: protectedProcedure
      .input(z.object({
        adAccountId: z.string().min(1),
        adAccountName: z.string().optional(),
        businessManagerId: z.string().optional(),
        tokenId: z.number().int().positive().optional(),
        facebookPageId: z.string().min(1),
        instagramUserId: z.string().optional(),
        pixelId: z.string().optional(),
        buildMode: z.enum(["full", "ads-only", "update"]),
        stateJson: z.string().min(1), // full CampaignBuilderState as JSON
        agentProfile: z.enum(["manus-1.6", "manus-1.6-lite"]).default("manus-1.6-lite"),
      }))
      .mutation(async ({ ctx, input }) => {
        // ── Team membership gate ───────────────────────────────────────────────
        if (!ctx.user.isTeamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Campaign builds require a Pathlabs team account. Please contact your admin.",
          });
        }
        const apiKey = process.env.MANUS_API_KEY;
        if (!apiKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "MANUS_API_KEY is not configured. Please ask your admin to add it in the Token Vault.",
          });
        }

        // Fetch the Meta access token
        let metaAccessToken: string | undefined;
        if (input.tokenId) {
          const tokenEntry = await getTokenById(input.tokenId);
          metaAccessToken = tokenEntry?.accessToken ?? undefined;
        }
        if (!metaAccessToken) {
          const fallbackToken = await getFirstActiveTokenWithValue();
          metaAccessToken = fallbackToken?.accessToken ?? undefined;
        }
        if (!metaAccessToken) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No active Meta access token found. Please add one in the Token Vault.",
          });
        }

        // Look up the Manus project ID configured for campaign-creation
        const skillProjectId = await getAppSetting("skillProjectId:campaign-creation") ?? undefined;

        // Create the run record immediately
        const runId = await createSkillRun({
          userId: ctx.user.id,
          skillId: "campaign-creation",
          skillName: "Campaign Builder Launch",
          status: "running",
          adAccountId: input.adAccountId,
          adAccountName: input.adAccountName ?? null,
          businessManagerId: input.businessManagerId ?? null,
          datePreset: null,
          campaignIds: [],
          extraParams: { buildMode: input.buildMode },
        });

        const startedAt = Date.now();

        // Fire-and-forget background execution
        (async () => {
          try {
            const prompt = buildCampaignCreationPrompt({
              accessToken: metaAccessToken!,
              adAccountId: input.adAccountId,
              facebookPageId: input.facebookPageId,
              instagramUserId: input.instagramUserId,
              pixelId: input.pixelId,
              buildMode: input.buildMode,
              stateJson: input.stateJson,
            });

            const statusLog: Array<{ ts: number; msg: string }> = [];
            let flushCounter = 0;
            const flushStatusLog = async () => {
              await updateSkillRun(runId, { statusLog }).catch(() => {});
            };

            const result = await runManusSkillTask({
              apiKey,
              skillId: "campaign-creation",
              prompt,
              agentProfile: input.agentProfile,
              projectId: skillProjectId,
              onProgress: async (msg: string, taskId?: string) => {
                statusLog.push({ ts: Date.now(), msg });
                if (taskId) {
                  await updateSkillRun(runId, { manusTaskId: taskId }).catch(() => {});
                }
                flushCounter++;
                if (flushCounter % 3 === 0) await flushStatusLog();
              },
            });

            const durationMs = Date.now() - startedAt;
            await updateSkillRun(runId, {
              status: result.status,
              reportMarkdown: result.report || undefined,
              errorMessage: result.errorMessage || undefined,
              durationMs,
              taskUrl: result.taskUrl,
              attachments: result.attachments,
              creditUsage: result.creditUsage,
              statusLog,
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await updateSkillRun(runId, {
              status: "error",
              errorMessage: errMsg,
              durationMs: Date.now() - startedAt,
            }).catch(() => {});
          }
        })();

        return { runId };
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
    /** All users with all-time credits and run count — admin only */
    teamMembers: adminProcedure.query(async () => getTeamMembers()),
    /** Promote or demote a user role — admin only, cannot change your own role */
    setRole: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot change your own role." });
        }
        await setUserRole(input.userId, input.role);
        return { success: true };
      }),
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
        category: z.enum(["skill", "skill-issue", "suggestion", "general"]),
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
        category: z.enum(["skill", "skill-issue", "suggestion", "general"]).optional(),
      }).optional())
      .query(async ({ input }) => listFeedback(input ?? {})),

    /** Delete a feedback entry (admin only) */
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteFeedback(input.id);
        return { success: true };
      }),

    /** Count unread feedback since admin last acknowledged (admin only) */
    unreadCount: adminProcedure
      .query(async ({ ctx }) => {
        const count = await getFeedbackUnreadCount(ctx.user.id);
        return { count };
      }),

    /** Mark all feedback as read for the current admin (admin only) */
    markRead: adminProcedure
      .mutation(async ({ ctx }) => {
        await markFeedbackRead(ctx.user.id);
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
