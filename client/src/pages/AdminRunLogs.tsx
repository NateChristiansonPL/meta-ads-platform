import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { BarChart2, Clock, RefreshCw, Shield, TrendingUp, Users } from "lucide-react";

const SKILL_META: Record<string, { color: string; Icon: React.ElementType }> = {
  "weekly-optimization": { color: "#00BEEF", Icon: TrendingUp },
  "performance-insights": { color: "#F7901E", Icon: BarChart2 },
  "creative-lifecycle": { color: "#00B37A", Icon: RefreshCw },
  "structural-audit": { color: "#ED135F", Icon: Shield },
  "audience-overlap": { color: "#a78bfa", Icon: Users },
};

type RunRow = {
  id: number;
  skillId: string;
  skillName: string;
  userName?: string | null;
  adAccountName?: string | null;
  adAccountId?: string | null;
  startedAt: Date;
  durationMs?: number | null;
  status: string;
};

export default function AdminRunLogs() {
  const { data: runs = [], isLoading } = trpc.runs.allRuns.useQuery({ limit: 100 });

  return (
    <AppShell title="Run Logs" subtitle="All skill runs across the team" badge="admin-only">
      <div className="max-w-5xl">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
          <h2 className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {runs.length} runs logged
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
            Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No runs yet.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Skill", "User", "Ad Account", "Date", "Duration", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-bold" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.65rem" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(runs as RunRow[]).map((r, i) => {
                  const meta = SKILL_META[r.skillId] ?? { color: "#00BEEF", Icon: Clock };
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: i < runs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <meta.Icon size={12} style={{ color: meta.color }} />
                          <span style={{ color: "#FAFAFA" }}>{r.skillName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.6)" }}>{r.userName ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.6)" }}>{r.adAccountName || r.adAccountId || "—"}</td>
                      <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{new Date(r.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: r.status === "success" ? "rgba(0,179,122,0.15)" : r.status === "error" ? "rgba(237,19,95,0.15)" : "rgba(247,144,30,0.15)",
                            color: r.status === "success" ? "#00B37A" : r.status === "error" ? "#ED135F" : "#F7901E",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
