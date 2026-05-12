import { readFileSync, writeFileSync } from "fs";

// ── 1. Update getAdsetGoalStats in sync router ────────────────────────────────
{
  const filePath =
    "/home/ubuntu/meta-ads-platform/server/routers/admin/creativePerformanceSyncAdmin.ts";
  let src = readFileSync(filePath, "utf8");

  // Replace the return statement to include stalestFetchedAt and freshestFetchedAt
  src = src.replace(
    `      const byGoal = Array.from(goalCounts.entries())
        .map(([goal, count]) => ({ goal, count }))
        .sort((a, b) => b.count - a.count);
      return { total, customConvResolved, standardEvent, noGoal, byGoal };`,
    `      const byGoal = Array.from(goalCounts.entries())
        .map(([goal, count]) => ({ goal, count }))
        .sort((a, b) => b.count - a.count);
      // Stalest record — the one that was synced the longest ago
      const fetchedDates = rows
        .map((r) => r.lastFetchedAt)
        .filter(Boolean) as Date[];
      const stalestFetchedAt =
        fetchedDates.length > 0
          ? new Date(Math.min(...fetchedDates.map((d) => d.getTime()))).toISOString()
          : null;
      const freshestFetchedAt =
        fetchedDates.length > 0
          ? new Date(Math.max(...fetchedDates.map((d) => d.getTime()))).toISOString()
          : null;
      return { total, customConvResolved, standardEvent, noGoal, byGoal, stalestFetchedAt, freshestFetchedAt };`,
  );

  // Also fix the early-return default to include the new fields
  src = src.replace(
    `if (!db) return { total: 0, customConvResolved: 0, standardEvent: 0, noGoal: 0, byGoal: [] };`,
    `if (!db) return { total: 0, customConvResolved: 0, standardEvent: 0, noGoal: 0, byGoal: [], stalestFetchedAt: null, freshestFetchedAt: null };`,
  );

  writeFileSync(filePath, src, "utf8");
  console.log("Done — getAdsetGoalStats updated with lastFetchedAt stats");
}

// ── 2. Add convEventLabel to mapResult in decay router ────────────────────────
{
  const filePath =
    "/home/ubuntu/meta-ads-platform/server/routers/admin/creativeDecayAdmin.ts";
  let src = readFileSync(filePath, "utf8");

  // Add convEventLabel to the mapResult return object, after optimizationGoal
  src = src.replace(
    `    optimizationGoal: row.optimizationGoal ?? null,`,
    `    optimizationGoal: row.optimizationGoal ?? null,
    convEventLabel: row.convEvent ?? null,`,
  );

  writeFileSync(filePath, src, "utf8");
  console.log("Done — convEventLabel added to mapResult");
}
