import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { AlertCircle, BarChart2, ChevronDown, ChevronRight, Clock, Megaphone, RefreshCw, Shield, TrendingUp, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SKILL_META: Record<string, { color: string; Icon: React.ElementType }> = {
  "weekly-optimization": { color: "#00BEEF", Icon: TrendingUp },
  "performance-insights": { color: "#F7901E", Icon: BarChart2 },
  "creative-lifecycle": { color: "#00B37A", Icon: RefreshCw },
  "structural-audit": { color: "#ED135F", Icon: Shield },
  "audience-overlap": { color: "#a78bfa", Icon: Users },
  "campaign-creation": { color: "#F7C948", Icon: Megaphone },
  "campaign-creation-admin": { color: "#F7C948", Icon: Megaphone },
};

/** Map agentProfile slug → human-readable model label */
function formatModel(profile?: string | null): string {
  if (!profile) return "—";
  if (profile.includes("1.6-lite")) return "Manus 1.6 Lite";
  if (profile.includes("1.6")) return "Manus 1.6";
  if (profile.includes("1.5")) return "Manus 1.5";
  return profile.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert milliseconds → "Xm Ys" or "Ys" */
function formatDuration(ms?: number | null): string {
  if (!ms) return "—";
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

type RunRow = {
  id: number;
  skillId: string;
  skillName: string;
  userName?: string | null;
  adAccountName?: string | null;
  adAccountId?: string | null;
  startedAt: Date;
  durationMs?: number | null;
  creditUsage?: number | null;
  agentProfile?: string | null;
  campaignIds?: string[] | null;
  status: string;
  errorMessage?: string | null;
};

const PAGE_SIZE = 50;
const HEADERS = ["Skill", "User", "Ad Account", "Date", "Duration", "Credits", "Model", "Campaigns", "Status"];

export default function AdminRunLogs() {
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allRuns, setAllRuns] = useState<RunRow[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isRefreshing = useRef(false);

  const { data, isLoading, isFetching } = trpc.runs.allRuns.useQuery(
    { limit: PAGE_SIZE, cursor },
    { enabled: true }
  );

  useEffect(() => {
    if (!data) return;
    const items = (data.items ?? []) as RunRow[];
    if (isRefreshing.current) {
      isRefreshing.current = false;
      setAllRuns(items);
    } else {
      setAllRuns((prev) => {
        if (cursor === undefined && prev.length === 0) return items;
        const existingIds = new Set(prev.map((r) => r.id));
        return [...prev, ...items.filter((r) => !existingIds.has(r.id))];
      });
    }
    setHasMore(data.nextCursor != null);
  }, [data]);

  const handleLoadMore = () => {
    if (allRuns.length === 0) return;
    const lastId = allRuns[allRuns.length - 1].id;
    setCursor(lastId);
  };

  const handleRefresh = () => {
    isRefreshing.current = true;
    setAllRuns([]);
    setCursor(undefined);
    setHasMore(true);
  };

  const runs = allRuns;

  return (
    <AppShell title="Run Logs" subtitle="All skill runs across the team" badge="admin-only">
      <div className="max-w-7xl">
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
            <h2 className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {runs.length} runs loaded{hasMore ? " — more available" : " — all loaded"}
            </h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading || isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              cursor: isLoading || isFetching ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={11} className={isLoading || isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {isLoading && runs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
            Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No runs yet.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full text-xs" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {HEADERS.map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-bold whitespace-nowrap"
                        style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.65rem" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r, i) => {
                    const meta = SKILL_META[r.skillId] ?? { color: "#00BEEF", Icon: Clock };
                    const campaignCount = Array.isArray(r.campaignIds) ? r.campaignIds.length : 0;
                    const isExpanded = expandedId === r.id;
                    const hasError = r.status === "error" && !!r.errorMessage;

                    return (
                      <>
                        <tr
                          key={r.id}
                          onClick={() => hasError ? setExpandedId(isExpanded ? null : r.id) : undefined}
                          style={{
                            borderBottom: (!isExpanded && i < runs.length - 1) ? "1px solid rgba(255,255,255,0.05)" : "none",
                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                            cursor: hasError ? "pointer" : "default",
                          }}
                        >
                          {/* Skill */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <meta.Icon size={12} style={{ color: meta.color }} />
                              <span style={{ color: "#FAFAFA" }}>{r.skillName}</span>
                            </div>
                          </td>

                          {/* User */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {r.userName ?? "—"}
                          </td>

                          {/* Ad Account */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {r.adAccountName || r.adAccountId || "—"}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>
                            {new Date(r.startedAt).toLocaleString()}
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>
                            {formatDuration(r.durationMs)}
                          </td>

                          {/* Credits used */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.creditUsage != null ? (
                              <span className="font-semibold" style={{ color: "#00BEEF" }}>
                                {r.creditUsage.toLocaleString()}
                              </span>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>
                            )}
                          </td>

                          {/* Model */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="px-2 py-0.5 rounded font-mono"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                color: "rgba(255,255,255,0.45)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                fontSize: "0.65rem",
                              }}
                            >
                              {formatModel(r.agentProfile)}
                            </span>
                          </td>

                          {/* Campaigns */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {campaignCount > 0 ? (
                              <span className="font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                                {campaignCount}
                              </span>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.25)" }}>All</span>
                            )}
                          </td>

                          {/* Status + expand toggle */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  background:
                                    r.status === "success"
                                      ? "rgba(0,179,122,0.15)"
                                      : r.status === "error"
                                      ? "rgba(237,19,95,0.15)"
                                      : "rgba(247,144,30,0.15)",
                                  color:
                                    r.status === "success"
                                      ? "#00B37A"
                                      : r.status === "error"
                                      ? "#ED135F"
                                      : "#F7901E",
                                }}
                              >
                                {r.status}
                              </span>
                              {hasError && (
                                isExpanded
                                  ? <ChevronDown size={11} style={{ color: "#ED135F" }} />
                                  : <ChevronRight size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Error detail row */}
                        {isExpanded && hasError && (
                          <tr key={`${r.id}-err`} style={{ borderBottom: i < runs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: "rgba(237,19,95,0.04)" }}>
                            <td colSpan={HEADERS.length} className="px-5 py-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle size={12} style={{ color: "#ED135F", marginTop: 1, flexShrink: 0 }} />
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{r.errorMessage}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-center mt-4">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={isFetching}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: isFetching ? "rgba(255,255,255,0.04)" : "rgba(0,190,239,0.1)",
                    border: "1px solid rgba(0,190,239,0.25)",
                    color: isFetching ? "rgba(255,255,255,0.3)" : "#00BEEF",
                    cursor: isFetching ? "not-allowed" : "pointer",
                  }}
                >
                  {isFetching ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
                      Loading…
                    </>
                  ) : (
                    <>Load more runs</>
                  )}
                </button>
              ) : (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>All runs loaded</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
