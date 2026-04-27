import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const SKILL_META: Record<string, { color: string; label: string }> = {
  "weekly-optimization": { color: "#00BEEF", label: "Weekly Optimization" },
  "performance-insights": { color: "#F7901E", label: "Performance Insights" },
  "creative-lifecycle": { color: "#00B37A", label: "Creative Lifecycle" },
  "structural-audit": { color: "#ED135F", label: "Structural Audit" },
  "audience-overlap": { color: "#a78bfa", label: "Audience Overlap" },
};

type UserCount = { userId: number; userName: string | null; count: number };
type SkillCount = { skillId: string; count: number };
type UserRow = { id: number; name?: string | null; email?: string | null; role: string; lastSignedIn: Date };
type CreditsByUserRow = { userId: number; userName: string | null; userEmail: string | null; totalCredits: number; runCount: number; avgCredits: number };

export default function AdminUsage() {
  const { data: userCounts = [] } = trpc.runs.userSuccessCounts.useQuery();
  const { data: skillCounts = [] } = trpc.runs.skillSuccessCounts.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const { data: creditsByUser = [], isLoading: creditsLoading } = trpc.runs.creditsByUser.useQuery();
  const { data: billingPeriodData } = trpc.settings.billingPeriod.useQuery();
  const setBillingPeriod = trpc.settings.setBillingPeriod.useMutation();
  const utils = trpc.useUtils();

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const currentStart = billingPeriodData?.periodStart ?? null;
  const currentEnd = billingPeriodData?.periodEnd ?? null;

  const handleSaveBillingPeriod = async () => {
    if (!startDate || !endDate) return;
    if (startDate > endDate) return;
    await setBillingPeriod.mutateAsync({ periodStart: startDate, periodEnd: endDate });
    setStartDate("");
    setEndDate("");
    utils.settings.billingPeriod.invalidate();
    utils.runs.billingPeriodCredits.invalidate();
    utils.runs.dailyCreditsChart.invalidate();
    utils.runs.monthlyCreditsUsed.invalidate();
    utils.runs.creditsByUser.invalidate();
  };

  const maxSkill = Math.max(1, ...(skillCounts as SkillCount[]).map((s) => s.count));
  const maxUser = Math.max(1, ...(userCounts as UserCount[]).map((u) => u.count));

  return (
    <AppShell title="Usage & Tallies" subtitle="Team-wide skill usage statistics" badge="admin-only">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        {/* Skill tallies */}
        <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "#FAFAFA" }}>Successful Runs by Skill</h3>
          <div className="flex flex-col gap-3">
            {Object.entries(SKILL_META).map(([id, meta]) => {
              const entry = (skillCounts as SkillCount[]).find((s) => s.skillId === id);
              const count = entry?.count ?? 0;
              const pct = Math.round((count / maxSkill) * 100);
              return (
                <div key={id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{meta.label}</span>
                    <span className="text-xs font-bold" style={{ color: meta.color }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User tallies */}
        <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "#FAFAFA" }}>Successful Runs by User</h3>
          {(userCounts as UserCount[]).length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No runs yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(userCounts as UserCount[]).map((u) => {
                const pct = Math.round((u.count / maxUser) * 100);
                return (
                  <div key={u.userId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{u.userName || `User #${u.userId}`}</span>
                      <span className="text-xs font-bold" style={{ color: "#00BEEF" }}>{u.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#00BEEF" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Credits used by user */}
        <div className="rounded-xl overflow-hidden xl:col-span-2" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="px-5 py-4" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Credits Used by User</h3>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Credit consumption per team member during the configured billing period.
              {currentStart && currentEnd && (
                <span style={{ color: "rgba(0,190,239,0.7)" }}>
                  {" "}({new Date(currentStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – {new Date(currentEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                </span>
              )}
            </p>
          </div>
          {creditsLoading ? (
            <div className="px-5 py-6 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
              <span className="text-xs">Loading…</span>
            </div>
          ) : (creditsByUser as CreditsByUserRow[]).length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No credit data yet.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["User", "Total Credits", "Runs", "Avg Credits / Run"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left font-bold"
                      style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.62rem" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(creditsByUser as CreditsByUserRow[]).map((row, i) => {
                  const displayName = row.userName || row.userEmail || `User #${row.userId}`;
                  const initial = displayName.charAt(0).toUpperCase();
                  const grandTotal = (creditsByUser as CreditsByUserRow[]).reduce((s, r) => s + (r.totalCredits ?? 0), 0);
                  const sharePct = grandTotal > 0 ? Math.round(((row.totalCredits ?? 0) / grandTotal) * 100) : 0;
                  return (
                    <tr
                      key={row.userId}
                      style={{
                        borderBottom: i < creditsByUser.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      }}
                    >
                      {/* User */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: "rgba(0,190,239,0.15)", color: "#00BEEF" }}
                          >
                            {initial}
                          </div>
                          <span className="font-semibold" style={{ color: "#FAFAFA" }}>{displayName}</span>
                        </div>
                      </td>
                      {/* Total credits */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm" style={{ color: "#00BEEF" }}>
                            {(row.totalCredits ?? 0).toLocaleString()}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", minWidth: 60, maxWidth: 120 }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${sharePct}%`, background: "#00BEEF" }}
                            />
                          </div>
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>{sharePct}%</span>
                        </div>
                      </td>
                      {/* Run count */}
                      <td className="px-5 py-3">
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>{row.runCount}</span>
                      </td>
                      {/* Avg credits / run */}
                      <td className="px-5 py-3">
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>
                          {row.runCount > 0 ? Math.round(row.avgCredits).toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand total footer */}
              {(creditsByUser as CreditsByUserRow[]).length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                    <td className="px-5 py-3 text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Total</td>
                    <td className="px-5 py-3">
                      <span className="font-bold text-sm" style={{ color: "#00BEEF" }}>
                        {(creditsByUser as CreditsByUserRow[]).reduce((s, r) => s + (r.totalCredits ?? 0), 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        {(creditsByUser as CreditsByUserRow[]).reduce((s, r) => s + r.runCount, 0)}
                      </span>
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Billing cycle setting */}
        <div className="rounded-xl p-5 xl:col-span-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "#FAFAFA" }}>Billing Cycle Settings</h3>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Set the exact start and end dates of your Manus billing period. All credit counters — the header widget, Dashboard chart, and the Credits by User table — will reflect usage within this window.
            Manus does not expose a billing API, so this must be set manually.
          </p>

          {/* Current period display */}
          {currentStart && currentEnd && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: "rgba(0,190,239,0.08)", border: "1px solid rgba(0,190,239,0.2)" }}>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Current period:</span>
              <span className="text-xs font-bold" style={{ color: "#00BEEF" }}>
                {new Date(currentStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>→</span>
              <span className="text-xs font-bold" style={{ color: "#00BEEF" }}>
                {new Date(currentEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}

          {/* Date pickers */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs" style={{ color: "transparent" }}>Save</label>
              <button
                onClick={handleSaveBillingPeriod}
                disabled={setBillingPeriod.isPending || !startDate || !endDate || startDate > endDate}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
                style={{
                  background: "#00BEEF",
                  color: "#141349",
                  opacity: setBillingPeriod.isPending || !startDate || !endDate || startDate > endDate ? 0.5 : 1,
                }}
              >
                {setBillingPeriod.isPending ? "Saving..." : "Save Period"}
              </button>
            </div>
            {setBillingPeriod.isSuccess && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs" style={{ color: "transparent" }}>_</label>
                <span className="text-xs py-1.5" style={{ color: "#00B37A" }}>✓ Saved</span>
              </div>
            )}
          </div>
          {startDate && endDate && startDate > endDate && (
            <p className="text-xs mt-2" style={{ color: "#ED135F" }}>End date must be on or after start date.</p>
          )}
        </div>

        {/* Team members */}
        <div className="rounded-xl p-5 xl:col-span-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "#FAFAFA" }}>Team Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(allUsers as UserRow[]).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: u.role === "admin" ? "rgba(237,19,95,0.2)" : "rgba(0,190,239,0.15)", color: u.role === "admin" ? "#ED135F" : "#00BEEF" }}>
                  {(u.name || u.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate" style={{ color: "#FAFAFA" }}>{u.name || u.email || `User #${u.id}`}</span>
                    {u.role === "admin" && <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(237,19,95,0.15)", color: "#ED135F" }}>ADMIN</span>}
                  </div>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Last active: {new Date(u.lastSignedIn).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
