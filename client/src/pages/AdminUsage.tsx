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

export default function AdminUsage() {
  const { data: userCounts = [] } = trpc.runs.userSuccessCounts.useQuery();
  const { data: skillCounts = [] } = trpc.runs.skillSuccessCounts.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const { data: billingDayData } = trpc.settings.billingCycleStartDay.useQuery();
  const setBillingDay = trpc.settings.setBillingCycleStartDay.useMutation();
  const utils = trpc.useUtils();

  const [billingDayInput, setBillingDayInput] = useState<string>("");
  const currentBillingDay = billingDayData?.day ?? 1;

  const handleSaveBillingDay = async () => {
    const day = parseInt(billingDayInput, 10);
    if (isNaN(day) || day < 1 || day > 28) return;
    await setBillingDay.mutateAsync({ day });
    setBillingDayInput("");
    utils.settings.billingCycleStartDay.invalidate();
    utils.runs.billingPeriodCredits.invalidate();
    utils.runs.dailyCreditsChart.invalidate();
    utils.runs.monthlyCreditsUsed.invalidate();
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

        {/* Billing cycle setting */}
        <div className="rounded-xl p-5 xl:col-span-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "#FAFAFA" }}>Billing Cycle Settings</h3>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Set the day of the month your Manus billing period starts. The credits chart on the Dashboard will show usage from that day forward.
            Manus does not expose a billing API, so this must be set manually.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Current start day:</span>
              <span className="text-sm font-bold" style={{ color: "#00BEEF" }}>{currentBillingDay}</span>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <input
                type="number"
                min={1}
                max={28}
                placeholder="1–28"
                value={billingDayInput}
                onChange={(e) => setBillingDayInput(e.target.value)}
                className="w-20 px-2 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
              />
              <button
                onClick={handleSaveBillingDay}
                disabled={setBillingDay.isPending || !billingDayInput}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
                style={{ background: "#00BEEF", color: "#141349", opacity: setBillingDay.isPending || !billingDayInput ? 0.5 : 1 }}
              >
                {setBillingDay.isPending ? "Saving..." : "Save"}
              </button>
              {setBillingDay.isSuccess && (
                <span className="text-xs" style={{ color: "#00B37A" }}>Saved</span>
              )}
            </div>
          </div>
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
