import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, MessageSquarePlus, Star, Users, Clock, Zap, BarChart2 } from "lucide-react";

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
type CreditsByUserRow = {
  userId: number;
  userName: string | null;
  userEmail: string | null;
  totalCredits: number;
  runCount: number;
  avgCredits: number;
};
type FeedbackRow = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  category: string;
  skillId: string | null;
  skillName: string | null;
  message: string;
  rating: number | null;
  createdAt: Date;
};

const FEEDBACK_CATEGORIES = [
  { id: "skill" as const, label: "Skill Feedback", color: "#00BEEF", icon: "📊" },
  { id: "suggestion" as const, label: "Skill Suggestions", color: "#F7901E", icon: "💡" },
  { id: "general" as const, label: "General Feedback", color: "#00B37A", icon: "💬" },
];

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

  const { data: allFeedback = [], refetch: refetchFeedback, isLoading: feedbackLoading } = trpc.feedback.list.useQuery({});
  const deleteFeedback = trpc.feedback.delete.useMutation({
    onSuccess: () => { refetchFeedback(); toast.success("Feedback deleted"); },
    onError: () => toast.error("Failed to delete feedback"),
  });
  const [activeFeedbackTab, setActiveFeedbackTab] = useState<"skill" | "suggestion" | "general">("skill");

  const maxSkill = Math.max(1, ...(skillCounts as SkillCount[]).map((s) => s.count));
  const maxUser = Math.max(1, ...(userCounts as UserCount[]).map((u) => u.count));

  const grandTotal = (creditsByUser as CreditsByUserRow[]).reduce((s, r) => s + (r.totalCredits ?? 0), 0);
  const CREDITS_PER_SEAT = 8000;

  const filteredFeedback = (allFeedback as FeedbackRow[]).filter((f) => f.category === activeFeedbackTab);

  return (
    <AppShell title="Usage & Tallies" subtitle="Team-wide skill usage statistics" badge="admin-only">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">

        {/* ── Skill tallies ─────────────────────────────────────────────── */}
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

        {/* ── User tallies ──────────────────────────────────────────────── */}
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

        {/* ── Credits used by user ──────────────────────────────────────── */}
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
                  {["User", "Total Credits Used", "% of 8k Seat", "Runs", "Avg Credits / Run"].map((h) => (
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
                  // % used is based on 8,000 credits per individual seat (not share of team total)
                  const sharePct = Math.min(100, Math.round(((row.totalCredits ?? 0) / CREDITS_PER_SEAT) * 100));
                  return (
                    <tr
                      key={row.userId}
                      style={{
                        borderBottom: i < creditsByUser.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      }}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(0,190,239,0.15)", color: "#00BEEF" }}>
                            {initial}
                          </div>
                          <span className="font-semibold" style={{ color: "#FAFAFA" }}>{displayName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-sm" style={{ color: "#00BEEF" }}>{(row.totalCredits ?? 0).toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", minWidth: 60, maxWidth: 120 }}>
                            <div className="h-full rounded-full" style={{ width: `${sharePct}%`, background: sharePct >= 90 ? "#ED135F" : sharePct >= 70 ? "#FFB400" : "#00BEEF" }} />
                          </div>
                          <span style={{ color: sharePct >= 90 ? "#ED135F" : sharePct >= 70 ? "#FFB400" : "rgba(255,255,255,0.5)", fontSize: "0.65rem", fontWeight: 600 }}>{sharePct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>{row.runCount}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{Math.round(row.avgCredits ?? 0).toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {creditsByUser.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                    <td className="px-5 py-3 text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Team Total</td>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: "#00BEEF" }}>{grandTotal.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {(creditsByUser as CreditsByUserRow[]).length} seats × 8,000 = {((creditsByUser as CreditsByUserRow[]).length * CREDITS_PER_SEAT).toLocaleString()} total
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {(creditsByUser as CreditsByUserRow[]).reduce((s, r) => s + r.runCount, 0)} runs
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* ── Billing Cycle Settings ────────────────────────────────────── */}
        <div className="rounded-xl p-5 xl:col-span-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "#FAFAFA" }}>Billing Cycle Settings</h3>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Set the start and end dates of your Manus billing period. The credits chart on the Dashboard and all credit counters will reflect usage within this window. Manus does not expose a billing API, so this must be set manually.
          </p>
          {currentStart && currentEnd && (
            <div className="mb-4 px-3 py-2 rounded-lg inline-flex items-center gap-2" style={{ background: "rgba(0,190,239,0.08)", border: "1px solid rgba(0,190,239,0.2)" }}>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Current period:</span>
              <span className="text-xs font-bold" style={{ color: "#00BEEF" }}>
                {new Date(currentStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" – "}
                {new Date(currentEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none", colorScheme: "dark" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none", colorScheme: "dark" }}
              />
            </div>
            <button
              onClick={handleSaveBillingPeriod}
              disabled={!startDate || !endDate || startDate > endDate || setBillingPeriod.isPending}
              className="px-4 py-2 rounded-lg text-xs font-bold transition-opacity disabled:opacity-40"
              style={{ background: "#00BEEF", color: "#141349" }}
            >
              {setBillingPeriod.isPending ? "Saving…" : "Save Period"}
            </button>
          </div>
          {startDate && endDate && startDate > endDate && (
            <p className="text-xs mt-2" style={{ color: "#ED135F" }}>End date must be on or after start date.</p>
          )}
        </div>

        {/* ── Feedback Section ──────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden xl:col-span-2" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,190,239,0.12)" }}>
              <MessageSquarePlus size={14} style={{ color: "#00BEEF" }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>User Feedback</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>All feedback submitted by team members, organized by category.</p>
            </div>
            <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="text-xs font-bold" style={{ color: "#00BEEF" }}>{(allFeedback as FeedbackRow[]).length}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>total</span>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
            {FEEDBACK_CATEGORIES.map((cat) => {
              const count = (allFeedback as FeedbackRow[]).filter((f) => f.category === cat.id).length;
              const active = activeFeedbackTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveFeedbackTab(cat.id)}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors relative"
                  style={{
                    color: active ? cat.color : "rgba(255,255,255,0.4)",
                    borderBottom: active ? `2px solid ${cat.color}` : "2px solid transparent",
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: active ? `${cat.color}22` : "rgba(255,255,255,0.06)",
                      color: active ? cat.color : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback entries */}
          <div className="divide-y divide-white/5">
            {feedbackLoading ? (
              <div className="px-5 py-8 flex items-center justify-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
                <span className="text-xs">Loading feedback…</span>
              </div>
            ) : filteredFeedback.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-2xl mb-2">{FEEDBACK_CATEGORIES.find((c) => c.id === activeFeedbackTab)?.icon}</div>
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                  No {FEEDBACK_CATEGORIES.find((c) => c.id === activeFeedbackTab)?.label.toLowerCase()} yet.
                </div>
              </div>
            ) : (
              filteredFeedback.map((fb) => (
                <div key={fb.id} className="px-5 py-4 flex gap-4" style={{ background: "rgba(255,255,255,0.01)" }}>
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: "rgba(0,190,239,0.12)", color: "#00BEEF" }}>
                    {(fb.userName || fb.userEmail || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold" style={{ color: "#FAFAFA" }}>
                        {fb.userName || fb.userEmail || `User #${fb.userId}`}
                      </span>
                      {fb.skillName && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF" }}>
                          {fb.skillName}
                        </span>
                      )}
                      {fb.rating && (
                        <span className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              size={10}
                              fill={n <= fb.rating! ? "#F59E0B" : "none"}
                              style={{ color: n <= fb.rating! ? "#F59E0B" : "rgba(255,255,255,0.2)" }}
                            />
                          ))}
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {new Date(fb.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", whiteSpace: "pre-wrap" }}>
                      {fb.message}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteFeedback.mutate({ id: fb.id })}
                    className="shrink-0 p-1.5 rounded-lg transition-colors mt-0.5"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#ED135F";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,19,95,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.2)";
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                    title="Delete feedback"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Team Members link card ─────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden xl:col-span-2" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="px-5 py-5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-3">
              <Users size={18} style={{ color: "#00BEEF" }} />
              <div>
                <div className="font-bold text-sm" style={{ color: "#FAFAFA" }}>Team Members</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Manage roles and view per-member usage</div>
              </div>
            </div>
            <a
              href="/admin/team-members"
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)", textDecoration: "none" }}
            >
              View Team Members →
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}