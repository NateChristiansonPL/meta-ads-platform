import { readFileSync, writeFileSync } from 'fs';

const filePath = 'server/routers/admin/creativeDecayAdmin.ts';
let content = readFileSync(filePath, 'utf8');

// Replace the startCreativeDecayCron function (lines 803-922)
const oldCron = `export async function startCreativeDecayCron() {
  const { default: cron } = await import("node-cron");
  cron.schedule("0 * * * *", async () => {
    try {
      const config = await getAnalysisSchedulerConfig();
      if (!config?.analysisEnabled || !config.accountId) return;
      const nowUtcHour = new Date().getUTCHours();
      if (nowUtcHour !== config.analysisUtcHour) return;
      const today = new Date();
      const from = new Date(today);
      from.setUTCDate(
        from.getUTCDate() - (config.analysisRollingDays ?? 14),
      );
      const dateFrom = from.toISOString().slice(0, 10);
      const dateTo = today.toISOString().slice(0, 10);
      const campaignIds = config.campaignIds
        ? config.campaignIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      try {
        const analysis = await analyzeStoredPerformance({
          accountId: config.accountId,
          campaignIds,
          dateFrom,
          dateTo,
          onlyLiveAds: config.onlyLiveAds,
        });
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
            (level === "probable" && config.notifyProbable) ||
            (level === "possible" && config.notifyPossible) ||
            (level === "emerging" && config.notifyEmerging)
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
                  level.toLowerCase() as
                    | "emerging"
                    | "possible"
                    | "probable"
                ];
              return \`- \${r.creativeName} (\${level} fatigue, score \${r.fatigueScore.toFixed(0)})\${firstDate ? \` — first detected \${new Date(firstDate).toLocaleDateString()}\` : ""}\`;
            })
            .join("\\n");
          await notifyOwner({
            title: \`[Scheduled] Creative Fatigue Alert - \${triggered.length} signal\${triggered.length > 1 ? "s" : ""} detected\`,
            content: \`Automated daily analysis (\${dateFrom} to \${dateTo}) detected the following fatigue signals:\\n\\n\${lines}\`,
          });
          // Log to decayNotificationLog for UI display (one row per triggered ad)
          const dbLog = await getDb();
          if (dbLog) {
            const logRows = triggered.map((r) => {
              const lvl =
                r.fatigueStatus === "URGENT" ? "probable" :
                r.fatigueStatus === "REFRESH" ? "possible" : "emerging";
              const firstDate = r.firstDetectedAt?.[lvl as "emerging" | "possible" | "probable"];
              return {
                accountId: cleanAccountId(config.accountId),
                adId: r.creativeId ?? "",
                adName: r.creativeName ?? "",
                signalLevel: lvl as "emerging" | "possible" | "probable",
                fatigueScore: Math.round(r.fatigueScore ?? 0),
                firstDetectedAt: firstDate ? new Date(firstDate) : undefined,
                notifiedAt: new Date(),
                dateFrom,
                dateTo,
              };
            });
            if (logRows.length) await dbLog.insert(decayNotificationLog).values(logRows);
          }
        }
        const db = await getDb();
        if (db)
          await db
            .update(metaSyncSchedule)
            .set({
              lastAnalysisAt: new Date(),
              lastAnalysisStatus: "success",
            })
            .where(eq(metaSyncSchedule.id, 1));
      } catch (e) {
        const db = await getDb();
        if (db)
          await db
            .update(metaSyncSchedule)
            .set({
              lastAnalysisAt: new Date(),
              lastAnalysisStatus: "error",
            })
            .where(eq(metaSyncSchedule.id, 1));
        console.error("[CreativeDecay Cron] Analysis failed:", e);
      }
    } catch (e) {
      console.error("[CreativeDecay Cron] Unexpected error:", e);
    }
  });
  console.log("[CreativeDecay Cron] Analysis scheduler started.");
}`;

const newCron = `export async function startCreativeDecayCron() {
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
}`;

if (!content.includes('export async function startCreativeDecayCron()')) {
  console.error('ERROR: startCreativeDecayCron not found');
  process.exit(1);
}

// Use line-based replacement
const lines = content.split('\n');
const startLine = lines.findIndex(l => l === 'export async function startCreativeDecayCron() {');
const endLine = lines.findIndex((l, i) => i > startLine && l === '}');

if (startLine === -1 || endLine === -1) {
  console.error('Could not find function boundaries, startLine:', startLine, 'endLine:', endLine);
  process.exit(1);
}

console.log(`Replacing lines ${startLine+1}-${endLine+1}`);
const newLines = [...lines.slice(0, startLine), ...newCron.split('\n'), ...lines.slice(endLine + 1)];
writeFileSync(filePath, newLines.join('\n'));
console.log('Done');
