import { readFileSync, writeFileSync } from "fs";

const filePath =
  "/home/ubuntu/meta-ads-platform/server/routers/admin/creativePerformanceSyncAdmin.ts";
let src = readFileSync(filePath, "utf8");

// 1. Add `isNotNull` to drizzle-orm imports
src = src.replace(
  `import { desc, eq } from "drizzle-orm";`,
  `import { desc, eq, isNotNull, isNull, and } from "drizzle-orm";`,
);

// 2. Insert getAdsetGoalStats before saveSyncSchedulerConfig
const marker = `  saveSyncSchedulerConfig: adminProcedure`;
const insertion = `  getAdsetGoalStats: adminProcedure
    .input(z.object({ accountId: z.string() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { total: 0, customConvResolved: 0, standardEvent: 0, noGoal: 0, byGoal: [] };
      const cleanId = input?.accountId?.replace(/^act_/, "") ?? null;
      const rows = await db
        .select()
        .from(adsetGoals)
        .where(cleanId ? eq(adsetGoals.accountId, cleanId) : undefined);
      const total = rows.length;
      const customConvResolved = rows.filter((r) => !!r.customConversionId).length;
      const standardEvent = rows.filter((r) => !r.customConversionId && !!r.customEventType).length;
      const noGoal = rows.filter((r) => !r.optimizationGoal).length;
      const goalCounts = new Map<string, number>();
      for (const r of rows) {
        const g = r.optimizationGoal ?? "UNKNOWN";
        goalCounts.set(g, (goalCounts.get(g) ?? 0) + 1);
      }
      const byGoal = Array.from(goalCounts.entries())
        .map(([goal, count]) => ({ goal, count }))
        .sort((a, b) => b.count - a.count);
      return { total, customConvResolved, standardEvent, noGoal, byGoal };
    }),
  `;

if (!src.includes(marker)) {
  console.error("Marker not found:", marker);
  process.exit(1);
}
src = src.replace(marker, insertion + marker);

writeFileSync(filePath, src, "utf8");
console.log("Done — getAdsetGoalStats inserted");
