import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, ShieldCheck, ShieldOff, BarChart2, Zap, Clock } from "lucide-react";

type TeamMemberRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  lastSignedIn: Date;
  createdAt: Date;
  totalCredits: number;
  runCount: number;
};

export default function AdminTeamMembers() {
  const {
    data: teamMembers = [],
    refetch: refetchTeamMembers,
    isLoading: teamMembersLoading,
  } = trpc.users.teamMembers.useQuery();

  const setUserRole = trpc.users.setRole.useMutation({
    onSuccess: () => {
      refetchTeamMembers();
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e.message ?? "Failed to update role"),
  });

  return (
    <AppShell title="Team Members" subtitle="All users who have logged into the platform">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Members",
              value: (teamMembers as TeamMemberRow[]).length,
              icon: <Users size={16} style={{ color: "#00BEEF" }} />,
              color: "#00BEEF",
            },
            {
              label: "Admins",
              value: (teamMembers as TeamMemberRow[]).filter((m) => m.role === "admin").length,
              icon: <ShieldCheck size={16} style={{ color: "#ED135F" }} />,
              color: "#ED135F",
            },
            {
              label: "Total Credits Used",
              value: (teamMembers as TeamMemberRow[])
                .reduce((sum, m) => sum + m.totalCredits, 0)
                .toLocaleString(),
              icon: <Zap size={16} style={{ color: "#F7901E" }} />,
              color: "#F7901E",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl px-5 py-4 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {stat.icon}
              <div>
                <div className="font-bold text-lg" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Members table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Table header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <Users size={15} style={{ color: "#00BEEF" }} />
              <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
                Team Members
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(0,190,239,0.12)", color: "#00BEEF" }}
              >
                {(teamMembers as TeamMemberRow[]).length}
              </span>
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              All-time credits &amp; runs
            </span>
          </div>

          {/* Body */}
          {teamMembersLoading ? (
            <div
              className="flex items-center justify-center py-16"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "rgba(0,190,239,0.4)",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          ) : (teamMembers as TeamMemberRow[]).length === 0 ? (
            <div
              className="text-center py-16"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <Users
                size={32}
                style={{ color: "rgba(255,255,255,0.15)", margin: "0 auto 10px" }}
              />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                No team members have logged in yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <th
                      className="px-5 py-2.5 text-left font-bold"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.62rem",
                      }}
                    >
                      Member
                    </th>
                    <th
                      className="px-5 py-2.5 text-left font-bold"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.62rem",
                      }}
                    >
                      Role
                    </th>
                    <th
                      className="px-5 py-2.5 text-left font-bold"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.62rem",
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        Last Sign-In
                      </span>
                    </th>
                    <th
                      className="px-5 py-2.5 text-right font-bold"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.62rem",
                      }}
                    >
                      <span className="flex items-center gap-1 justify-end">
                        <Zap size={10} />
                        Credits
                      </span>
                    </th>
                    <th
                      className="px-5 py-2.5 text-right font-bold"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.62rem",
                      }}
                    >
                      <span className="flex items-center gap-1 justify-end">
                        <BarChart2 size={10} />
                        Runs
                      </span>
                    </th>
                    <th
                      className="px-5 py-2.5 text-right font-bold"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.62rem",
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(teamMembers as TeamMemberRow[]).map((m, i) => {
                    const isLast = i === (teamMembers as TeamMemberRow[]).length - 1;
                    const displayName = m.name || m.email || `User #${m.id}`;
                    const initials = displayName.slice(0, 2).toUpperCase();
                    const isAdmin = m.role === "admin";
                    return (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: isLast
                            ? "none"
                            : "1px solid rgba(255,255,255,0.05)",
                          background:
                            i % 2 === 0
                              ? "transparent"
                              : "rgba(255,255,255,0.01)",
                        }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{
                                background: isAdmin
                                  ? "rgba(237,19,95,0.2)"
                                  : "rgba(0,190,239,0.12)",
                                color: isAdmin ? "#ED135F" : "#00BEEF",
                              }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div
                                className="font-semibold truncate max-w-[200px]"
                                style={{ color: "#FAFAFA" }}
                              >
                                {m.name || `User #${m.id}`}
                              </div>
                              {m.email && (
                                <div
                                  className="truncate max-w-[200px] text-xs"
                                  style={{ color: "rgba(255,255,255,0.35)" }}
                                >
                                  {m.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                            style={{
                              fontSize: "0.65rem",
                              background: isAdmin
                                ? "rgba(237,19,95,0.12)"
                                : "rgba(255,255,255,0.06)",
                              color: isAdmin
                                ? "#ED135F"
                                : "rgba(255,255,255,0.45)",
                            }}
                          >
                            {isAdmin ? (
                              <ShieldCheck size={10} />
                            ) : (
                              <ShieldOff size={10} />
                            )}
                            {isAdmin ? "Admin" : "Member"}
                          </span>
                        </td>
                        <td
                          className="px-5 py-3"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          {new Date(m.lastSignedIn).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </td>
                        <td
                          className="px-5 py-3 text-right font-bold"
                          style={{
                            color:
                              m.totalCredits > 0
                                ? "#F7901E"
                                : "rgba(255,255,255,0.2)",
                          }}
                        >
                          {m.totalCredits > 0
                            ? m.totalCredits.toLocaleString()
                            : "—"}
                        </td>
                        <td
                          className="px-5 py-3 text-right"
                          style={{
                            color:
                              m.runCount > 0
                                ? "rgba(255,255,255,0.7)"
                                : "rgba(255,255,255,0.2)",
                          }}
                        >
                          {m.runCount > 0 ? m.runCount : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() =>
                              setUserRole.mutate({
                                userId: m.id,
                                role: isAdmin ? "user" : "admin",
                              })
                            }
                            disabled={setUserRole.isPending}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all disabled:opacity-40"
                            style={{
                              background: isAdmin
                                ? "rgba(237,19,95,0.1)"
                                : "rgba(0,190,239,0.1)",
                              color: isAdmin ? "#ED135F" : "#00BEEF",
                              border: `1px solid ${
                                isAdmin
                                  ? "rgba(237,19,95,0.25)"
                                  : "rgba(0,190,239,0.25)"
                              }`,
                            }}
                            title={
                              isAdmin
                                ? "Remove admin privileges"
                                : "Grant admin privileges"
                            }
                          >
                            {isAdmin ? "Demote" : "Promote"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
