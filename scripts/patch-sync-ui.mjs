import { readFileSync, writeFileSync } from "fs";

const filePath =
  "/home/ubuntu/meta-ads-platform/client/src/pages/admin/AdminCreativePerformanceSync.tsx";
let src = readFileSync(filePath, "utf8");

// 1. Add BarChart2 icon to imports
src = src.replace(
  `import {\n  Bell,\n  BellOff,\n  Calendar,\n  CheckCircle2,\n  ChevronDown,\n  Clock,\n  Database,\n  Filter,\n  Loader2,\n  RefreshCw,\n  Search,\n  Settings2,\n  Upload,\n} from "lucide-react";`,
  `import {\n  BarChart2,\n  Bell,\n  BellOff,\n  Calendar,\n  CheckCircle2,\n  ChevronDown,\n  Clock,\n  Database,\n  Filter,\n  Loader2,\n  RefreshCw,\n  Search,\n  Settings2,\n  Upload,\n} from "lucide-react";`
);

// 2. Add getAdsetGoalStats query after the historyData query
const afterHistoryQuery = `  // Mutations\n  const syncMutation`;
src = src.replace(
  afterHistoryQuery,
  `  // Adset goal resolution stats\n  const { data: goalStats, refetch: refetchGoalStats } =\n    trpc.adminCreativePerformanceSync.getAdsetGoalStats.useQuery(\n      accountId ? { accountId } : undefined,\n      { enabled: true, staleTime: 60_000 },\n    );\n  // Mutations\n  const syncMutation`
);

// 3. Refetch goalStats on sync success
src = src.replace(
  `      refetchHistory();\n      toast.success(`,
  `      refetchHistory();\n      refetchGoalStats();\n      toast.success(`
);

// 4. Insert goal resolution stats card between syncResult and Sync History
const syncHistoryMarker = `        {/* ── Sync History`;
const goalStatsCard = `        {/* ── Adset Goal Resolution Stats */}
        {goalStats && goalStats.total > 0 && (
          <section
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <BarChart2 size={14} style={{ color: "#1A6CF6" }} />
                <div>
                  <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Adset Goal Resolution</h2>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                    How optimization goals and conversion events were resolved for this account.
                  </p>
                </div>
              </div>
              <button onClick={() => refetchGoalStats()}>
                <RefreshCw size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <GoalStatCard label="Total Ad Sets" value={goalStats.total} color="#1A6CF6" />
                <GoalStatCard
                  label="Custom Conv. Resolved"
                  value={goalStats.customConvResolved}
                  color="#00B37A"
                  subtitle={goalStats.total > 0 ? String(Math.round((goalStats.customConvResolved / goalStats.total) * 100)) + "%" : undefined}
                />
                <GoalStatCard
                  label="Standard Event"
                  value={goalStats.standardEvent}
                  color="#F7901E"
                  subtitle={goalStats.total > 0 ? String(Math.round((goalStats.standardEvent / goalStats.total) * 100)) + "%" : undefined}
                />
                <GoalStatCard
                  label="No Goal Detected"
                  value={goalStats.noGoal}
                  color={goalStats.noGoal > 0 ? "#ED135F" : "rgba(255,255,255,0.35)"}
                  subtitle={goalStats.noGoal > 0 ? "needs attention" : "all resolved"}
                />
              </div>
              {goalStats.byGoal.length > 0 && (
                <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>By Optimization Goal</p>
                  <div className="flex flex-wrap gap-2">
                    {goalStats.byGoal.map((g) => (
                      <span key={g.goal} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ color: "#FAFAFA" }}>{g.count}</span>
                        {g.goal.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        `;

src = src.replace(syncHistoryMarker, goalStatsCard + syncHistoryMarker);

writeFileSync(filePath, src, "utf8");
console.log("Done — AdminCreativePerformanceSync.tsx patched");
