import { readFileSync, writeFileSync } from 'fs';

const filePath = 'server/routers/admin/creativeDecayAdmin.ts';
const content = readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// ── Find insertion points ─────────────────────────────────────────────────────
const routerExportLine = lines.findIndex(l => l.trim() === 'export const creativeDecayAdminRouter = router({');
const getLatestLine = lines.findIndex(l => l.trim().startsWith('getLatestResults:'));

if (routerExportLine === -1) { console.error('Router export not found'); process.exit(1); }
if (getLatestLine === -1) { console.error('getLatestResults not found'); process.exit(1); }

console.log('routerExportLine:', routerExportLine + 1);
console.log('getLatestLine:', getLatestLine + 1);

// ── 1. Insert runDecayChain before the router export ─────────────────────────
// Find the blank line before the router export comment
let insertBeforeRouter = routerExportLine - 1;
// Walk back past the comment line
while (insertBeforeRouter > 0 && lines[insertBeforeRouter - 1].trim() === '') {
  insertBeforeRouter--;
}

const runDecayChainBlock = `
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
        console.log(\`[DecayChain] Sync completed (\${config.dateFrom} to \${config.dateTo})\`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        syncWarnings.push(\`Sync failed: \${msg}\`);
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
}
`.split('\n');

// ── 2. triggerDecayAnalysis procedure ────────────────────────────────────────
const triggerProcedureBlock = `
  // ── On-demand trigger: sync then analysis ───────────────────────────────────
  // Runs the full sync → analysis chain on demand.
  // Reads scheduler config for account/campaigns/date range.
  triggerDecayAnalysis: adminProcedure
    .input(
      z.object({
        dateFrom: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
        dateTo: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
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

`.split('\n');

// Apply insertions (from bottom to top to preserve line numbers)
// First insert triggerDecayAnalysis before getLatestResults
const newLines1 = [
  ...lines.slice(0, getLatestLine),
  ...triggerProcedureBlock,
  ...lines.slice(getLatestLine),
];

// Then insert runDecayChain before the router export (line number unchanged since we inserted after)
const newLines2 = [
  ...newLines1.slice(0, routerExportLine),
  ...runDecayChainBlock,
  ...newLines1.slice(routerExportLine),
];

writeFileSync(filePath, newLines2.join('\n'));
console.log('Done — runDecayChain and triggerDecayAnalysis inserted');
