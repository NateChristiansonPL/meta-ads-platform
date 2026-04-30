import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  ChevronRight,
  Clock,
  Cpu,
  Hammer,
  Key,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { FeedbackModal } from "./FeedbackModal";
import HelpTip from "./HelpTip";

const SKILLS = [
  {
    id: "weekly-optimization",
    label: "Weekly Optimization",
    sub: "Breakdown-level insights",
    icon: TrendingUp,
    color: "#00BEEF",
    path: "/skills/weekly-optimization",
  },
  {
    id: "performance-insights",
    label: "Performance Insights",
    sub: "KPI-anchored analysis",
    icon: BarChart2,
    color: "#F7901E",
    path: "/skills/performance-insights",
  },
  {
    id: "creative-lifecycle",
    label: "Creative Lifecycle",
    sub: "Fatigue detection",
    icon: RefreshCw,
    color: "#00B37A",
    path: "/skills/creative-lifecycle",
  },
  {
    id: "structural-audit",
    label: "Structural Audit",
    sub: "Andromeda account audit",
    icon: Shield,
    color: "#ED135F",
    path: "/skills/structural-audit",
  },
  {
    id: "audience-overlap",
    label: "Audience Overlap",
    sub: "Overlap & wasted spend",
    icon: Users,
    color: "#a78bfa",
    path: "/skills/audience-overlap",
  },
];

const ADMIN_ITEMS = [
  { label: "Token & API Key Vault", icon: Key, path: "/admin/tokens" },
  { label: "Run Logs", icon: Clock, path: "/admin/run-logs" },
  { label: "Team Members", icon: Users, path: "/admin/team-members" },
  { label: "Usage & Tallies", icon: BarChart2, path: "/admin/usage" },
  { label: "Knowledge Base", icon: BookOpen, path: "/admin/knowledge" },
];

/** Returns the set of skillIds that have a currently running task for the logged-in user. */
function useRunningSkills() {
  const { data: runs } = trpc.runs.myRuns.useQuery(
    { limit: 20 },
    { refetchInterval: 10000, staleTime: 8000 }
  );
  if (!runs) return new Set<string>();
  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
  return new Set(
    runs
      .filter((r: { status: string; skillId: string; startedAt: Date | string }) =>
        r.status === "running" && new Date(r.startedAt).getTime() > fourHoursAgo
      )
      .map((r: { skillId: string }) => r.skillId)
  );
}

/** Admin-only notification bell that shows unread feedback count. Persists until clicked. */
function FeedbackNotificationBell() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, navigate] = useLocation();

  const { data, refetch } = trpc.feedback.unreadCount.useQuery(
    undefined,
    {
      enabled: isAdmin,
      refetchInterval: 30_000, // poll every 30s
      staleTime: 20_000,
    }
  );

  const markReadMut = trpc.feedback.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  if (!isAdmin) return null;

  const count = data?.count ?? 0;

  const handleClick = () => {
    markReadMut.mutate();
    // Navigate to admin usage page where feedback is shown
    navigate("/admin/usage");
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-1.5 rounded-md transition-colors"
      style={{ color: count > 0 ? "#F7901E" : "rgba(255,255,255,0.4)" }}
      title={count > 0 ? `${count} new feedback submission${count === 1 ? "" : "s"}` : "No new feedback"}
    >
      <Bell size={16} />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
          style={{
            background: "#ED135F",
            minWidth: 16,
            height: 16,
            fontSize: "0.6rem",
            padding: "0 3px",
            lineHeight: 1,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function CreditsWidget() {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: creditsData, isLoading } = trpc.runs.monthlyCreditsUsed.useQuery(
    undefined,
    { enabled: !!me, refetchInterval: 5 * 60 * 1000, staleTime: 4 * 60 * 1000 }
  );
  const { data: billingPeriod } = trpc.settings.billingPeriod.useQuery(
    undefined,
    { enabled: !!me, staleTime: 5 * 60 * 1000 }
  );

  if (!me) return null;

  const credits = creditsData?.creditsUsed ?? null;

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }}
      >
        <Zap size={12} />
        <span>Loading...</span>
      </div>
    );
  }

  if (credits === null) return null;

  const color = "#00B37A";
  const SEAT_CREDITS = 8000;
  const pctUsed = Math.round((credits / SEAT_CREDITS) * 100);
  const tooltip = `${credits.toLocaleString()} credits used (${pctUsed}% of ${SEAT_CREDITS.toLocaleString()} seat credits)`;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      title={tooltip}
    >
      <Zap size={12} style={{ color }} />
      <span style={{ color }}>{credits.toLocaleString()}</span>
      <span style={{ color: "rgba(255,255,255,0.35)" }}>credits used; {pctUsed}% used</span>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  dateNote?: string;
  headerActions?: React.ReactNode;
}

export default function AppShell({ children, title, subtitle, badge, dateNote, headerActions }: AppShellProps) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = useLocation();
  const [adminOpen, setAdminOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const runningSkills = useRunningSkills();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (ADMIN_ITEMS.some((a) => location.startsWith(a.path))) setAdminOpen(true);
  }, [location]);

  if (loading || !isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center topo-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</span>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#141349", fontFamily: "'Montserrat', sans-serif" }}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between shrink-0 px-4"
        style={{
          height: 52,
          background: "rgba(20,19,73,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          zIndex: 50,
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "#ED135F" }}>
            <Cpu size={14} color="#fff" />
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: "#FAFAFA" }}>
            Pathlabs <span style={{ color: "#00BEEF" }}>Intelligence</span>
          </span>
          {/* Beta badge */}
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: "rgba(247,144,30,0.15)",
              color: "#F7901E",
              border: "1px solid rgba(247,144,30,0.35)",
              fontSize: "0.6rem",
              letterSpacing: "0.05em",
            }}
          >
            BETA
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <CreditsWidget />
            <HelpTip
              content="Credits are consumed each time you run a skill. One credit ≈ one Manus agent action (API call, script execution, etc.). Your billing period resets on the configured cycle. Contact your admin if you need your limit adjusted."
              side="bottom"
              size={12}
            />
          </div>
          <FeedbackNotificationBell />
          <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#ED135F", color: "#fff" }}>
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              {user?.name || user?.email}
            </span>
            {isAdmin && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(237,19,95,0.2)", color: "#ED135F", border: "1px solid rgba(237,19,95,0.3)" }}>
                ADMIN
              </span>
            )}
          </div>
          <button
            onClick={async () => { await logout(); window.location.href = "/login"; }}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Rail ───────────────────────────────────────────────────── */}
        <nav
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{
            width: 220,
            background: "rgba(14,13,58,0.95)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Dashboard */}
          <div className="px-3 pt-4 pb-2">
            <NavItem
              icon={LayoutDashboard}
              label="Dashboard"
              path="/dashboard"
              active={location === "/dashboard"}
              color="#00BEEF"
              running={false}
            />
          </div>

          {/* Skills section */}
          <div className="px-3 pt-3">
            <div className="flex items-center gap-1.5 mb-2 px-2">
              <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Skills
              </p>
              <HelpTip
                content="Skills are AI-powered analysis tools. Each skill runs a Manus agent against your Meta ad account data and returns a structured report. Select a skill, choose your account and date range, then click Run."
                side="right"
                size={11}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              {SKILLS.map((s) => (
                <NavItem
                  key={s.id}
                  icon={s.icon}
                  label={s.label}
                  sub={s.sub}
                  path={s.path}
                  active={location === s.path}
                  color={s.color}
                  running={runningSkills.has(s.id)}
                />
              ))}
            </div>
          </div>

          {/* Coming Soon section */}
          <div className="px-3 pt-4">
            <div className="flex items-center gap-1.5 mb-2 px-2">
              <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Coming Soon
              </p>
              <HelpTip
                content="Campaign Builder lets you build and launch campaigns directly from the platform. Additional automation tools are in development."
                side="right"
                size={11}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              {/* Campaign Builder */}
              <NavItem
                icon={Hammer}
                label="Campaign Builder"
                sub="Create & launch"
                color="#ED135F"
                path="/campaign-builder"
                active={location === "/campaign-builder"}
                running={false}
              />

              {/* Early Detection sub-section */}
              <div className="flex items-center gap-1.5 mt-3 mb-1 px-2">
                <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.6rem" }}>
                  Early Detection
                </p>
              </div>

              {/* Placeholder: Creative Decay */}
              <button
                onClick={() => toast.info("Feature coming soon")}
                className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-left transition-all"
                style={{ background: "transparent", border: "none", cursor: "pointer", opacity: 0.5 }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Zap size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.4)" }}>Creative Decay</p>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.65rem" }}>Coming soon</p>
                </div>
              </button>
              {/* Placeholder: Audience Saturation */}
              <button
                onClick={() => toast.info("Feature coming soon")}
                className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-left transition-all"
                style={{ background: "transparent", border: "none", cursor: "pointer", opacity: 0.5 }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Users size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.4)" }}>Audience Saturation</p>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.65rem" }}>Coming soon</p>
                </div>
              </button>
              {/* Placeholder: Allocation Drift */}
              <button
                onClick={() => toast.info("Feature coming soon")}
                className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-left transition-all"
                style={{ background: "transparent", border: "none", cursor: "pointer", opacity: 0.5 }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <TrendingUp size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.4)" }}>Allocation Drift</p>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.65rem" }}>Coming soon</p>
                </div>
              </button>
              <NavItem
                icon={BookOpen}
                label="Knowledge Base"
                sub="Platform docs"
                path="/knowledge"
                active={location === "/knowledge"}
                color="#A78BFA"
                running={false}
              />
            </div>
          </div>

          {/* Feedback button — below Manus AI, centered with standout styling */}
          <div className="px-3 pt-3">
            <button
              onClick={() => setFeedbackOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: "#ED135F",
                color: "#fff",
                border: "none",
                letterSpacing: "0.04em",
                boxShadow: "0 2px 12px rgba(237,19,95,0.35)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#c8104f"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ED135F"; }}
            >
              <MessageSquarePlus size={13} />
              <span>Provide Feedback</span>
            </button>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div className="px-3 pt-4 pb-4 mt-auto">
              <button
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-md mb-1"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onClick={() => setAdminOpen((o) => !o)}
              >
                <span className="text-xs font-bold" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Admin
                </span>
                <ChevronRight size={12} className={`transition-transform ${adminOpen ? "rotate-90" : ""}`} />
              </button>
              {adminOpen && (
                <div className="flex flex-col gap-0.5">
                  {ADMIN_ITEMS.map((a) => (
                    <NavItem
                      key={a.path}
                      icon={a.icon}
                      label={a.label}
                      path={a.path}
                      active={location === a.path}
                      color="#ED135F"
                      small
                      running={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── Stage ───────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Stage header */}
          <div
            className="flex items-center justify-between px-6 shrink-0"
            style={{
              height: 56,
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(20,19,73,0.6)",
            }}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                {badge && (
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              {/* Center: date note */}
              {dateNote && (
                <span
                  className="hidden md:inline-block text-sm font-bold px-3 py-1 rounded"
                  style={{ background: "#FBBF24", color: "#000000", lineHeight: 1.4, maxWidth: 400, textAlign: "center" }}
                >
                  {dateNote}
                </span>
              )}
              {headerActions && (
                <div className="flex items-center gap-2">
                  {headerActions}
                </div>
              )}
            </div>
          </div>

          {/* Stage content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  sub?: string;
  path: string;
  active: boolean;
  color: string;
  small?: boolean;
  running?: boolean;
}

function NavItem({ icon: Icon, label, sub, path, active, color, small, running }: NavItemProps) {
  return (
    <Link href={path}>
      <div
        className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-all"
        style={{
          background: active ? `${color}18` : "transparent",
          border: active ? `1px solid ${color}30` : "1px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        <div
          className="rounded flex items-center justify-center shrink-0"
          style={{
            width: small ? 22 : 26,
            height: small ? 22 : 26,
            background: active ? `${color}25` : "rgba(255,255,255,0.06)",
          }}
        >
          <Icon size={small ? 11 : 13} style={{ color: active ? color : "rgba(255,255,255,0.45)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="block text-xs font-semibold truncate"
            style={{ color: active ? color : "rgba(255,255,255,0.7)", fontSize: small ? "0.7rem" : "0.75rem" }}
          >
            {label}
          </span>
          {sub && (
            <span className="block truncate" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}>
              {sub}
            </span>
          )}
        </div>
        {/* Running indicator — pulsing dot */}
        {running && (
          <span
            className="shrink-0 w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#F7901E", boxShadow: "0 0 6px rgba(247,144,30,0.7)" }}
            title="Analysis in progress"
          />
        )}
        {active && !running && <div className="w-1 h-1 rounded-full shrink-0" style={{ background: color }} />}
      </div>
    </Link>
  );
}

/** Clickable nav item with a small "Coming Soon" badge pinned to the bottom-right corner */
function NavItemWithBadge({
  icon: Icon,
  label,
  sub,
  color,
  path,
  active,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  color: string;
  path: string;
  active: boolean;
}) {
  return (
    <div className="relative">
      <Link href={path}>
        <div
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all cursor-pointer"
          style={{
            background: active ? `${color}18` : "transparent",
            border: `1px solid ${active ? color + "40" : "transparent"}`,
          }}
        >
          <div
            className="rounded flex items-center justify-center shrink-0"
            style={{
              width: 26,
              height: 26,
              background: active ? `${color}22` : "rgba(255,255,255,0.06)",
            }}
          >
            <Icon size={13} style={{ color: active ? color : "rgba(255,255,255,0.45)" }} />
          </div>
          <div className="flex-1 min-w-0 pr-10">
            <span
              className="block text-xs font-semibold truncate"
              style={{ color: active ? "#FAFAFA" : "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}
            >
              {label}
            </span>
            {sub && (
              <span className="block truncate" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}>
                {sub}
              </span>
            )}
          </div>
        </div>
      </Link>
      {/* Coming Soon badge — bottom-right corner, outside the text flow */}
      <div className="absolute bottom-1 right-2 pointer-events-none">
        <span
          style={{
            background: "rgba(237,19,95,0.20)",
            color: "#ED135F",
            border: "1px solid rgba(237,19,95,0.40)",
            fontSize: "0.52rem",
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "1px 5px",
            borderRadius: 4,
            lineHeight: 1.6,
            display: "inline-block",
          }}
        >
          COMING SOON
        </span>
      </div>
    </div>
  );
}
