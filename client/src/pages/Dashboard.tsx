import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { BarChart2, Clock, RefreshCw, Shield, TrendingUp, Users, Zap } from "lucide-react";
import { useLocation } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SKILLS = [
  {
    id: "weekly-optimization",
    label: "Weekly Optimization",
    sub: "Breakdown-level Meta Ads performance analysis with statistical significance testing and prioritized, impact-ranked recommendations.",
    icon: TrendingUp,
    color: "#00BEEF",
    badge: "pl-weekly-optimization",
    path: "/skills/weekly-optimization",
  },
  {
    id: "performance-insights",
    label: "Performance Insights",
    sub: "KPI-anchored Meta Ads performance analysis with placement conversion data, budget pacing, and lifecycle enrichment.",
    icon: BarChart2,
    color: "#F7901E",
    badge: "pl-performance-analysis-insights-v3",
    path: "/skills/performance-insights",
  },
  {
    id: "creative-lifecycle",
    label: "Creative Lifecycle",
    sub: "Creative fatigue detection using five complementary methods — CDR, BOCPD, CUSUM, EWMA, and Frequency-CPM elasticity.",
    icon: RefreshCw,
    color: "#00B37A",
    badge: "pl-creative-lifecycle-v3",
    path: "/skills/creative-lifecycle",
  },
  {
    id: "structural-audit",
    label: "Structural Audit",
    sub: "Andromeda-focused Meta Ads structural audit covering Data Infrastructure, Signal Density, Creative Velocity, and more.",
    icon: Shield,
    color: "#ED135F",
    badge: "meta-ads-structural-audit",
    path: "/skills/structural-audit",
  },
  {
    id: "audience-overlap",
    label: "Audience Overlap",
    sub: "Pairwise audience overlap analysis with KPI-aware wasted spend estimation per ad set.",
    icon: Users,
    color: "#a78bfa",
    badge: "pl-audience-overlap-spend",
    path: "/skills/audience-overlap",
  },
];

/** Format a YYYY-MM-DD date string as "Apr 27" */
function fmtDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

/** Custom tooltip for the credits bar chart */
function CreditsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: "#1a1a3e", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA" }}
    >
      <div className="font-semibold mb-0.5">{label ? fmtDay(label) : ""}</div>
      <div style={{ color: "#00BEEF" }}>{payload[0].value.toLocaleString()} credits</div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: recentRuns = [] } = trpc.runs.myRuns.useQuery({ limit: 8 });
  const { data: me } = trpc.auth.me.useQuery();
  const { data: chartData } = trpc.runs.dailyCreditsChart.useQuery();
  const { data: billingCredits } = trpc.runs.billingPeriodCredits.useQuery();

  const days = chartData?.days ?? [];
  const totalCredits = billingCredits?.creditsUsed ?? 0;
  const periodStart = billingCredits?.periodStart
    ? new Date(billingCredits.periodStart)
    : null;
  const periodEnd = billingCredits?.periodEnd
    ? new Date(billingCredits.periodEnd)
    : null;

  // Format the billing period label
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const periodLabel = periodStart && periodEnd
    ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
    : "This Billing Period";

  return (
    <AppShell title="Dashboard" subtitle="Pathlabs Intelligence Platform">
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="text-lg font-black" style={{ color: "#FAFAFA" }}>
          Welcome back{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Select a skill to run an analysis on your Meta Ads account.
        </p>
      </div>

      {/* Skill cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {SKILLS.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(s.path)}
            className="text-left rounded-xl p-5 transition-all group"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${s.color}0d`;
              (e.currentTarget as HTMLElement).style.borderColor = `${s.color}30`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}
              >
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {s.badge}
              </span>
            </div>
            <h3 className="text-sm font-bold mb-1.5" style={{ color: "#FAFAFA" }}>{s.label}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{s.sub}</p>
            <div className="mt-4 flex items-center gap-1.5">
              <span className="text-xs font-semibold" style={{ color: s.color }}>Run Analysis</span>
              <span className="text-xs" style={{ color: s.color }}>→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Credits chart */}
      <div
        className="rounded-xl p-5 mb-8"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: "#00BEEF" }} />
              <h3 className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Credits Used
              </h3>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {periodLabel}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{ color: "#00BEEF" }}>
              {totalCredits != null ? totalCredits.toLocaleString() : "—"}
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>total credits</div>
          </div>
        </div>

        {days.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<CreditsTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="credits" fill="#00BEEF" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-24" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
            No credit data available for this billing period.
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
          <h3 className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Recent Runs
          </h3>
        </div>
        {recentRuns.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Zap size={20} className="mx-auto mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No runs yet — select a skill above to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentRuns.map((run) => {
              const skill = SKILLS.find((s) => s.id === run.skillId);
              return (
                <div
                  key={run.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${skill?.color ?? "#00BEEF"}18` }}
                  >
                    {skill ? <skill.icon size={13} style={{ color: skill.color }} /> : <Zap size={13} style={{ color: "#00BEEF" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: "#FAFAFA" }}>{run.skillName}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                        style={{
                          background: run.status === "success" ? "rgba(0,179,122,0.15)" : run.status === "error" ? "rgba(237,19,95,0.15)" : "rgba(247,144,30,0.15)",
                          color: run.status === "success" ? "#00B37A" : run.status === "error" ? "#ED135F" : "#F7901E",
                        }}
                      >
                        {run.status}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {run.adAccountName || run.adAccountId} · {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
