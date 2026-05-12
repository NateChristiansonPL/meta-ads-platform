import fs from "fs";

// ── 1. Update creativeDecayAdmin.ts ──────────────────────────────────────────
const decayPath = "/home/ubuntu/meta-ads-platform/server/routers/admin/creativeDecayAdmin.ts";
let decay = fs.readFileSync(decayPath, "utf8");

// 1a. Add decayReports to imports
decay = decay.replace(
  `  adPerformance,
  creativeFatigueResults,
  metaSyncSchedule,
  firstFatigueDetected,
  decayNotificationLog,
} from "../../../drizzle/schema";`,
  `  adPerformance,
  creativeFatigueResults,
  metaSyncSchedule,
  firstFatigueDetected,
  decayNotificationLog,
  decayReports,
  users,
} from "../../../drizzle/schema";`
);

// 1b. Add isNotNull, or, gt imports
decay = decay.replace(
  `import { and, between, desc, eq, inArray } from "drizzle-orm";`,
  `import { and, between, desc, eq, inArray, isNotNull, or, gt } from "drizzle-orm";`
);

// 1c. Update getAnalysisSchedulerConfig to support user-scoped lookup
decay = decay.replace(
  `async function getAnalysisSchedulerConfig() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(metaSyncSchedule)
    .where(eq(metaSyncSchedule.id, 1))
    .limit(1);
  return rows[0] ?? null;
}`,
  `async function getAnalysisSchedulerConfig(userId?: number) {
  const db = await getDb();
  if (!db) return null;
  if (userId) {
    // User-scoped: return all schedules for this user
    const rows = await db
      .select()
      .from(metaSyncSchedule)
      .where(eq(metaSyncSchedule.userId, userId));
    return rows;
  }
  // Legacy global row (id=1) for cron
  const rows = await db
    .select()
    .from(metaSyncSchedule)
    .where(isNotNull(metaSyncSchedule.analysisEnabled))
    .orderBy(metaSyncSchedule.id);
  return rows;
}`
);

// 1d. Update runDecayChain to accept userId + alwaysSendReport and save to decay_reports + Slack
decay = decay.replace(
  `async function runDecayChain(config: {
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
}) {`,
  `async function sendSlackNotification(webhookUrl: string, message: string) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    if (!res.ok) console.warn("[Slack] Webhook returned", res.status);
  } catch (e) {
    console.warn("[Slack] Failed to send notification:", e);
  }
}

async function runDecayChain(config: {
  accountId: string;
  accountName?: string;
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
  userId?: number | null;
  alwaysSendReport?: boolean;
}) {`
);

// 1e. Update the notifications block in runDecayChain to also save report + Slack
decay = decay.replace(
  `  if (triggered.length > 0) {
    const lines = triggered.map((r) => {
      const level = r.fatigueStatus === "URGENT" ? "Probable"
        : r.fatigueStatus === "REFRESH" ? "Possible" : "Emerging";
      const firstDate = r.firstDetectedAt?.[level.toLowerCase() as "emerging" | "possible" | "probable"];
      return \`- \${r.creativeName} (\${level} fatigue, score \${r.fatigueScore.toFixed(0)})\${
        firstDate ? \` — first detected \${new Date(firstDate).toLocaleDateString()}\` : ""
      }\`;
    }).join("\\n");
    await notifyOwner({
      title: \`Creative Fatigue Alert — \${triggered.length} signal\${triggered.length > 1 ? "s" : ""} detected\`,
      content: \`Analysis (\${config.dateFrom} to \${config.dateTo}):\\n\\n\${lines}\${
        syncWarnings.length ? \`\\n\\nSync warnings:\\n\${syncWarnings.join("\\n")}\` : ""
      }\`,
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
}`,
  `  // Count signals by level
  const probableCount = analysis.records.filter(r => r.fatigueStatus === "URGENT").length;
  const possibleCount = analysis.records.filter(r => r.fatigueStatus === "REFRESH").length;
  const emergingCount = analysis.records.filter(r => r.fatigueStatus === "MONITOR").length;
  const signalCount = probableCount + possibleCount + emergingCount;

  // Save automated report to decay_reports if userId is set and (signals found OR alwaysSendReport)
  if (config.userId && (signalCount > 0 || config.alwaysSendReport)) {
    const dbReport = await getDb();
    if (dbReport) {
      await dbReport.insert(decayReports).values({
        userId: config.userId,
        accountId: cleanAccountId(config.accountId),
        accountName: config.accountName ?? cleanAccountId(config.accountId),
        campaignIds: config.campaignIds.join(","),
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
        reportType: "auto",
        signalCount,
        probableCount,
        possibleCount,
        emergingCount,
        reportJson: JSON.stringify(analysis.records),
      });
    }
  }

  if (triggered.length > 0) {
    const lines = triggered.map((r) => {
      const level = r.fatigueStatus === "URGENT" ? "Probable"
        : r.fatigueStatus === "REFRESH" ? "Possible" : "Emerging";
      const firstDate = r.firstDetectedAt?.[level.toLowerCase() as "emerging" | "possible" | "probable"];
      return \`- \${r.creativeName} (\${level} fatigue, score \${r.fatigueScore.toFixed(0)})\${
        firstDate ? \` — first detected \${new Date(firstDate).toLocaleDateString()}\` : ""
      }\`;
    }).join("\\n");

    const alertTitle = \`Creative Fatigue Alert — \${triggered.length} signal\${triggered.length > 1 ? "s" : ""} detected\`;
    const alertContent = \`Analysis (\${config.dateFrom} to \${config.dateTo}):\\n\\n\${lines}\${
      syncWarnings.length ? \`\\n\\nSync warnings:\\n\${syncWarnings.join("\\n")}\` : ""
    }\`;

    // In-app notification
    await notifyOwner({ title: alertTitle, content: alertContent });

    // Slack notification (if user has a webhook configured)
    if (config.userId) {
      const dbUser = await getDb();
      if (dbUser) {
        const userRows = await dbUser.select({ slackWebhookUrl: users.slackWebhookUrl })
          .from(users).where(eq(users.id, config.userId)).limit(1);
        const webhookUrl = userRows[0]?.slackWebhookUrl;
        if (webhookUrl) {
          const slackMsg = \`*\${alertTitle}*\\nAccount: \${config.accountName ?? config.accountId}\\nPeriod: \${config.dateFrom} → \${config.dateTo}\\n\\n\${lines}\`;
          await sendSlackNotification(webhookUrl, slackMsg);
        }
      }
    }

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
          notifyUserId: config.userId ?? undefined,
          dateFrom: config.dateFrom,
          dateTo: config.dateTo,
        };
      });
      if (logRows.length) await dbLog.insert(decayNotificationLog).values(logRows);
    }
  }
  return { analysis, syncWarnings };
}`
);

// 1f. Add new procedures before the closing }); of the router
decay = decay.replace(
  `  saveAnalysisSchedulerConfig: adminProcedure
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
});`,
  `  saveAnalysisSchedulerConfig: adminProcedure
    .input(
      z.object({
        analysisEnabled: z.boolean(),
        analysisUtcHour: z.number().int().min(0).max(23),
        analysisRollingDays: z.number().int().min(1).max(90),
        notifyEmerging: z.boolean(),
        notifyPossible: z.boolean(),
        notifyProbable: z.boolean(),
        onlyLiveAds: z.boolean(),
        alwaysSendReport: z.boolean().optional(),
        accountId: z.string(),
        campaignIds: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database not configured." });
      const userId = ctx.user.id;
      const cleanId = cleanAccountId(input.accountId);
      // Find existing user+account row or create new
      const existing = await db
        .select({ id: metaSyncSchedule.id })
        .from(metaSyncSchedule)
        .where(and(eq(metaSyncSchedule.userId, userId), eq(metaSyncSchedule.accountId, cleanId)))
        .limit(1);
      const payload = { ...input, userId, accountId: cleanId };
      if (existing.length > 0) {
        await db.update(metaSyncSchedule).set(payload).where(eq(metaSyncSchedule.id, existing[0].id));
      } else {
        await db.insert(metaSyncSchedule).values(payload);
      }
      return { ok: true };
    }),

  getAnalysisSchedulerConfigForAccount: adminProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const cleanId = cleanAccountId(input.accountId);
      const rows = await db
        .select()
        .from(metaSyncSchedule)
        .where(and(eq(metaSyncSchedule.userId, ctx.user.id), eq(metaSyncSchedule.accountId, cleanId)))
        .limit(1);
      return rows[0] ?? null;
    }),

  getUserDecaySchedules: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { schedules: [] };
    const rows = await db
      .select()
      .from(metaSyncSchedule)
      .where(eq(metaSyncSchedule.userId, ctx.user.id))
      .orderBy(desc(metaSyncSchedule.id));
    return { schedules: rows };
  }),

  saveDecayReport: adminProcedure
    .input(z.object({
      accountId: z.string(),
      accountName: z.string().optional(),
      campaignIds: z.string().optional(),
      dateFrom: z.string(),
      dateTo: z.string(),
      reportType: z.enum(["manual", "auto"]),
      signalCount: z.number().int(),
      probableCount: z.number().int(),
      possibleCount: z.number().int(),
      emergingCount: z.number().int(),
      reportJson: z.string(),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database not configured." });
      const result = await db.insert(decayReports).values({
        userId: ctx.user.id,
        accountId: cleanAccountId(input.accountId),
        accountName: input.accountName ?? cleanAccountId(input.accountId),
        campaignIds: input.campaignIds ?? "",
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        reportType: input.reportType,
        signalCount: input.signalCount,
        probableCount: input.probableCount,
        possibleCount: input.possibleCount,
        emergingCount: input.emergingCount,
        reportJson: input.reportJson,
        label: input.label,
      });
      return { ok: true, id: Number(result[0].insertId) };
    }),

  getDecayReports: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { reports: [] };
      const rows = await db
        .select({
          id: decayReports.id,
          accountId: decayReports.accountId,
          accountName: decayReports.accountName,
          campaignIds: decayReports.campaignIds,
          dateFrom: decayReports.dateFrom,
          dateTo: decayReports.dateTo,
          reportType: decayReports.reportType,
          signalCount: decayReports.signalCount,
          probableCount: decayReports.probableCount,
          possibleCount: decayReports.possibleCount,
          emergingCount: decayReports.emergingCount,
          label: decayReports.label,
          createdAt: decayReports.createdAt,
        })
        .from(decayReports)
        .where(eq(decayReports.userId, ctx.user.id))
        .orderBy(desc(decayReports.createdAt))
        .limit(input?.limit ?? 50);
      return { reports: rows };
    }),

  getDecayReportById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(decayReports)
        .where(and(eq(decayReports.id, input.id), eq(decayReports.userId, ctx.user.id)))
        .limit(1);
      return rows[0] ?? null;
    }),

  saveSlackWebhook: adminProcedure
    .input(z.object({ webhookUrl: z.string().url().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database not configured." });
      await db.update(users).set({ slackWebhookUrl: input.webhookUrl || null }).where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  getSlackWebhook: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { webhookUrl: null };
    const rows = await db.select({ slackWebhookUrl: users.slackWebhookUrl }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return { webhookUrl: rows[0]?.slackWebhookUrl ?? null };
  }),
});`
);

// 1g. Update the cron to iterate all enabled schedule rows (multi-user)
decay = decay.replace(
  `export async function startCreativeDecayCron() {
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
}`,
  `export async function startCreativeDecayCron() {
  const { default: cron } = await import("node-cron");
  cron.schedule("0 * * * *", async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const nowUtcHour = new Date().getUTCHours();
      // Fetch all enabled analysis schedule rows for this UTC hour
      const configs = await db
        .select()
        .from(metaSyncSchedule)
        .where(
          and(
            eq(metaSyncSchedule.analysisEnabled, true),
            eq(metaSyncSchedule.analysisUtcHour, nowUtcHour),
            isNotNull(metaSyncSchedule.accountId),
          )
        );
      if (configs.length === 0) return;
      console.log(\`[CreativeDecay Cron] \${configs.length} schedule(s) to run at UTC hour \${nowUtcHour}\`);
      for (const config of configs) {
        if (!config.accountId) continue;
        const today = new Date();
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() - (config.analysisRollingDays ?? 14));
        const dateFrom = from.toISOString().slice(0, 10);
        const dateTo = today.toISOString().slice(0, 10);
        const campaignIds = config.campaignIds
          ? config.campaignIds.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        try {
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
            userId: config.userId ?? undefined,
            alwaysSendReport: false, // TODO: add alwaysSendReport column to schema
          });
          await db
            .update(metaSyncSchedule)
            .set({ lastAnalysisAt: new Date(), lastAnalysisStatus: "success" })
            .where(eq(metaSyncSchedule.id, config.id));
        } catch (e) {
          await db
            .update(metaSyncSchedule)
            .set({ lastAnalysisAt: new Date(), lastAnalysisStatus: "error" })
            .where(eq(metaSyncSchedule.id, config.id));
          console.error(\`[CreativeDecay Cron] Chain failed for account \${config.accountId}:\`, e);
        }
      }
    } catch (e) {
      console.error("[CreativeDecay Cron] Unexpected error:", e);
    }
  });
  console.log("[CreativeDecay Cron] Analysis scheduler started (multi-user, sync → analysis chain enabled).");
}`
);

fs.writeFileSync(decayPath, decay, "utf8");
console.log("creativeDecayAdmin.ts patched");

// ── 2. Update creativePerformanceSyncAdmin.ts ─────────────────────────────────
const syncPath = "/home/ubuntu/meta-ads-platform/server/routers/admin/creativePerformanceSyncAdmin.ts";
let sync = fs.readFileSync(syncPath, "utf8");

// 2a. Update getSchedulerConfig to be user-scoped
sync = sync.replace(
  `  getSchedulerConfig: adminProcedure.query(async () => {`,
  `  getSchedulerConfig: adminProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {`
);

// Find the getSchedulerConfig body and update it
sync = sync.replace(
  `  getSchedulerConfig: adminProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(metaSyncSchedule)
      .where(eq(metaSyncSchedule.id, 1))
      .limit(1);
    return rows[0] ?? null;
  }),`,
  `  getSchedulerConfig: adminProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    if (input?.accountId) {
      const cleanId = input.accountId.replace(/^act_/, "");
      const rows = await db
        .select()
        .from(metaSyncSchedule)
        .where(and(eq(metaSyncSchedule.userId, ctx.user.id), eq(metaSyncSchedule.accountId, cleanId)))
        .limit(1);
      return rows[0] ?? null;
    }
    // Legacy: return global row
    const rows = await db
      .select()
      .from(metaSyncSchedule)
      .where(eq(metaSyncSchedule.id, 1))
      .limit(1);
    return rows[0] ?? null;
  }),`
);

// 2b. Update saveSyncSchedulerConfig to be user-scoped
sync = sync.replace(
  `    saveSyncSchedulerConfig: adminProcedure`,
  `  saveSyncSchedulerConfig: adminProcedure`
);

fs.writeFileSync(syncPath, sync, "utf8");
console.log("creativePerformanceSyncAdmin.ts patched");
