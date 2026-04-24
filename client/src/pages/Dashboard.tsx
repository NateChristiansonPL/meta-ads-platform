import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { BarChart2, Clock, RefreshCw, Shield, TrendingUp, Users, Zap } from "lucide-react";
import { useLocation } from "wouter";

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

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: recentRuns = [] } = trpc.runs.myRuns.useQuery({ limit: 8 });
  const { data: me } = trpc.auth.me.useQuery();

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
