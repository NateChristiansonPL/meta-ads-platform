import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, ShieldCheck, ShieldOff, BarChart2, Zap, Clock, UserPlus, Mail, X, CheckCircle2, AlertCircle, Trash2, Globe } from "lucide-react";
import { useState } from "react";

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

type InviteRow = {
  id: number;
  email: string;
  name: string | null;
  inviteToken: string;
  invitedByUserId: number;
  acceptedAt: Date | null;
  acceptedUserId: number | null;
  createdAt: Date;
};

export default function AdminTeamMembers() {
  const {
    data: teamMembers = [],
    refetch: refetchTeamMembers,
    isLoading: teamMembersLoading,
  } = trpc.users.teamMembers.useQuery();

  const {
    data: invites = [],
    refetch: refetchInvites,
    isLoading: invitesLoading,
  } = trpc.users.listInvites.useQuery();

  const setUserRole = trpc.users.setRole.useMutation({
    onSuccess: () => { refetchTeamMembers(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message ?? "Failed to update role"),
  });

  const sendInvite = trpc.users.sendInvite.useMutation({
    onSuccess: (data) => {
      refetchInvites();
      toast.success(`Invite created for ${inviteEmail}`);
      // Show the invite link so admin can copy/send it manually
      const fullLink = `${window.location.origin}${data.inviteLink}`;
      setGeneratedLink(fullLink);
      setInviteEmail("");
      setInviteName("");
    },
    onError: (e) => toast.error(e.message ?? "Failed to send invite"),
  });

  const revokeInvite = trpc.users.revokeInvite.useMutation({
    onSuccess: () => { refetchInvites(); toast.success("Invite revoked"); },
    onError: (e) => toast.error(e.message ?? "Failed to revoke invite"),
  });

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Fix: coerce to number before summing — MySQL returns aggregate values as strings
  const totalCredits = (teamMembers as TeamMemberRow[])
    .reduce((sum, m) => sum + Number(m.totalCredits), 0);

  const pendingInvites = (invites as InviteRow[]).filter((i) => !i.acceptedAt);
  const acceptedInvites = (invites as InviteRow[]).filter((i) => !!i.acceptedAt);

  return (
    <AppShell title="Team Members & Users" subtitle="Manage team members and invited platform users">
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
              value: totalCredits.toLocaleString(),
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

        {/* ── Team Members table ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <Users size={15} style={{ color: "#00BEEF" }} />
              <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Team Members</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(0,190,239,0.12)", color: "#00BEEF" }}>
                {(teamMembers as TeamMemberRow[]).length}
              </span>
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>All-time credits &amp; runs</span>
          </div>

          {teamMembersLoading ? (
            <div className="flex items-center justify-center py-16" style={{ background: "rgba(255,255,255,0.01)" }}>
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(0,190,239,0.4)", borderTopColor: "transparent" }} />
            </div>
          ) : (teamMembers as TeamMemberRow[]).length === 0 ? (
            <div className="text-center py-16" style={{ background: "rgba(255,255,255,0.01)" }}>
              <Users size={32} style={{ color: "rgba(255,255,255,0.15)", margin: "0 auto 10px" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No team members have logged in yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Member", "Role", "Last Sign-In", "Credits", "Runs", "Action"].map((h, hi) => (
                      <th
                        key={h}
                        className={`px-5 py-2.5 font-bold ${hi >= 3 ? "text-right" : "text-left"}`}
                        style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.62rem" }}
                      >
                        {h === "Credits" ? <span className="flex items-center gap-1 justify-end"><Zap size={10} />Credits</span>
                          : h === "Runs" ? <span className="flex items-center gap-1 justify-end"><BarChart2 size={10} />Runs</span>
                          : h === "Last Sign-In" ? <span className="flex items-center gap-1"><Clock size={10} />Last Sign-In</span>
                          : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(teamMembers as TeamMemberRow[]).map((m, i) => {
                    const isLast = i === (teamMembers as TeamMemberRow[]).length - 1;
                    const displayName = m.name || m.email || `User #${m.id}`;
                    const initials = displayName.slice(0, 2).toUpperCase();
                    const isAdmin = m.role === "admin";
                    const credits = Number(m.totalCredits);
                    const runs = Number(m.runCount);
                    return (
                      <tr key={m.id} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: isAdmin ? "rgba(237,19,95,0.2)" : "rgba(0,190,239,0.12)", color: isAdmin ? "#ED135F" : "#00BEEF" }}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate max-w-[200px]" style={{ color: "#FAFAFA" }}>{m.name || `User #${m.id}`}</div>
                              {m.email && <div className="truncate max-w-[200px] text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{m.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: "0.65rem", background: isAdmin ? "rgba(237,19,95,0.12)" : "rgba(255,255,255,0.06)", color: isAdmin ? "#ED135F" : "rgba(255,255,255,0.45)" }}>
                            {isAdmin ? <ShieldCheck size={10} /> : <ShieldOff size={10} />}
                            {isAdmin ? "Admin" : "Member"}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {new Date(m.lastSignedIn).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 text-right font-bold" style={{ color: credits > 0 ? "#F7901E" : "rgba(255,255,255,0.2)" }}>
                          {credits > 0 ? credits.toLocaleString() : "—"}
                        </td>
                        <td className="px-5 py-3 text-right" style={{ color: runs > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}>
                          {runs > 0 ? runs : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setUserRole.mutate({ userId: m.id, role: isAdmin ? "user" : "admin" })}
                            disabled={setUserRole.isPending}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all disabled:opacity-40"
                            style={{ background: isAdmin ? "rgba(237,19,95,0.1)" : "rgba(0,190,239,0.1)", color: isAdmin ? "#ED135F" : "#00BEEF", border: `1px solid ${isAdmin ? "rgba(237,19,95,0.25)" : "rgba(0,190,239,0.25)"}` }}
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

        {/* ── Invited Users table ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <Globe size={15} style={{ color: "#a78bfa" }} />
              <h3 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Invited Users</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                {(invites as InviteRow[]).length}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>View-only access · Google sign-in</span>
            </div>
            <button
              onClick={() => { setShowInviteModal(true); setGeneratedLink(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
              style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(167,139,250,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(167,139,250,0.12)"; }}
            >
              <UserPlus size={12} />
              Invite User
            </button>
          </div>

          {invitesLoading ? (
            <div className="flex items-center justify-center py-12" style={{ background: "rgba(255,255,255,0.01)" }}>
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(167,139,250,0.4)", borderTopColor: "transparent" }} />
            </div>
          ) : (invites as InviteRow[]).length === 0 ? (
            <div className="text-center py-12" style={{ background: "rgba(255,255,255,0.01)" }}>
              <UserPlus size={28} style={{ color: "rgba(255,255,255,0.1)", margin: "0 auto 8px" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No invites sent yet. Click "Invite User" to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Invitee", "Status", "Invited", "Invite Link", "Action"].map((h, hi) => (
                      <th key={h} className={`px-5 py-2.5 font-bold ${hi >= 3 ? "text-right" : "text-left"}`} style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.62rem" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(invites as InviteRow[]).map((inv, i) => {
                    const isLast = i === (invites as InviteRow[]).length - 1;
                    const accepted = !!inv.acceptedAt;
                    const fullLink = `${window.location.origin}/api/invite/accept?token=${inv.inviteToken}`;
                    return (
                      <tr key={inv.id} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                              {(inv.name || inv.email).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              {inv.name && <div className="font-semibold" style={{ color: "#FAFAFA" }}>{inv.name}</div>}
                              <div style={{ color: "rgba(255,255,255,0.45)" }}>{inv.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: "0.65rem", background: accepted ? "rgba(0,179,122,0.12)" : "rgba(247,144,30,0.12)", color: accepted ? "#00B37A" : "#F7901E" }}>
                            {accepted ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                            {accepted ? "Accepted" : "Pending"}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {new Date(inv.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!accepted && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(fullLink); toast.success("Invite link copied!"); }}
                              className="text-xs px-2 py-1 rounded font-semibold transition-all"
                              style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}
                            >
                              Copy Link
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => revokeInvite.mutate({ id: inv.id })}
                            disabled={revokeInvite.isPending}
                            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
                            style={{ color: "rgba(237,19,95,0.5)" }}
                            title="Revoke invite"
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ED135F")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(237,19,95,0.5)")}
                          >
                            <Trash2 size={13} />
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

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowInviteModal(false); setGeneratedLink(null); } }}
        >
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#1a1940", border: "1px solid rgba(255,255,255,0.12)", fontFamily: "'Montserrat', sans-serif" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(167,139,250,0.12)" }}>
                  <UserPlus size={15} style={{ color: "#a78bfa" }} />
                </div>
                <div>
                  <h3 className="text-sm font-black" style={{ color: "#FAFAFA" }}>Invite User</h3>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>View-only access · Google sign-in</p>
                </div>
              </div>
              <button onClick={() => { setShowInviteModal(false); setGeneratedLink(null); }} style={{ color: "rgba(255,255,255,0.4)", background: "transparent", border: "none", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            {generatedLink ? (
              <>
                <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(0,179,122,0.08)", border: "1px solid rgba(0,179,122,0.2)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} style={{ color: "#00B37A" }} />
                    <span className="text-xs font-bold" style={{ color: "#00B37A" }}>Invite created</span>
                  </div>
                  <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Copy and send this link to the invitee. They'll be prompted to sign in with Google.</p>
                  <div className="rounded-lg p-2.5 text-xs break-all mb-3" style={{ background: "rgba(0,0,0,0.3)", color: "#a78bfa", fontFamily: "monospace" }}>
                    {generatedLink}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success("Link copied!"); }}
                    className="w-full py-2 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
                  >
                    Copy Link
                  </button>
                </div>
                <button onClick={() => { setGeneratedLink(null); setInviteEmail(""); setInviteName(""); }} className="w-full py-2 rounded-lg text-xs font-semibold" style={{ background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                  Invite Another
                </button>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>Email Address *</label>
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <Mail size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="flex-1 bg-transparent text-xs outline-none"
                        style={{ color: "#FAFAFA", fontFamily: "'Montserrat', sans-serif" }}
                        onKeyDown={(e) => { if (e.key === "Enter" && inviteEmail) sendInvite.mutate({ email: inviteEmail, name: inviteName || undefined }); }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>Name (optional)</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full rounded-lg px-3 py-2.5 text-xs outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFAFA", fontFamily: "'Montserrat', sans-serif" }}
                    />
                  </div>
                </div>

                <div className="rounded-xl p-3 mb-5" style={{ background: "rgba(247,144,30,0.06)", border: "1px solid rgba(247,144,30,0.15)" }}>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    An invite link will be generated. Copy and send it to the user — they'll sign in with Google and get view-only access to the platform. Skill analyses will be disabled for invited users.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 rounded-lg text-xs font-semibold" style={{ background: "transparent", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => { if (inviteEmail) sendInvite.mutate({ email: inviteEmail, name: inviteName || undefined }); }}
                    disabled={!inviteEmail || sendInvite.isPending}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                    style={{ background: "#a78bfa", color: "#141349", cursor: inviteEmail ? "pointer" : "not-allowed" }}
                  >
                    {sendInvite.isPending ? "Creating…" : "Create Invite"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
