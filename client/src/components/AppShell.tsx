import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BarChart2,
  BookOpen,
  Bot,
  ChevronRight,
  Clock,
  Cpu,
  Hammer,
  Key,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

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
  { label: "Token Vault", icon: Key, path: "/admin/tokens" },
  { label: "Run Logs", icon: Clock, path: "/admin/run-logs" },
  { label: "Usage & Tallies", icon: BarChart2, path: "/admin/usage" },
  { label: "Knowledge Base", icon: BookOpen, path: "/admin/knowledge" },
];

function CreditsWidget() {
  const { data: me } = trpc.auth.me.useQuery();
  const [credits] = useState(850);
  const max = 1000;
  const pct = Math.round((credits / max) * 100);
  const color = pct > 50 ? "#00B37A" : pct > 20 ? "#F7901E" : "#ED135F";

  if (!me) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      title={`${credits} / ${max} Manus credits remaining this month`}
    >
      <Zap size={12} style={{ color }} />
      <span style={{ color }}>{credits.toLocaleString()}</span>
      <span style={{ color: "rgba(255,255,255,0.35)" }}>/ {max.toLocaleString()} credits</span>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}

export default function AppShell({ children, title, subtitle, badge }: AppShellProps) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = useLocation();
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Always redirect to the web app login page, not the Manus OAuth URL directly
      window.location.href = "/";
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
        </Link>

        <div className="flex items-center gap-3">
          <CreditsWidget />
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
            onClick={async () => { await logout(); window.location.href = "/"; }}
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
            />
          </div>

          {/* Skills section */}
          <div className="px-3 pt-3">
            <p className="text-xs font-bold mb-2 px-2" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Skills
            </p>
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
                />
              ))}
            </div>
          </div>

          {/* Tools section */}
          <div className="px-3 pt-4">
            <p className="text-xs font-bold mb-2 px-2" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Tools
            </p>
            <div className="flex flex-col gap-0.5">
              <NavItem
                icon={Hammer}
                label="Campaign Builder"
                sub="Create & launch"
                path="/campaign-builder"
                active={location === "/campaign-builder"}
                color="#ED135F"
              />
              <NavItem
                icon={Bot}
                label="Manus AI"
                sub="Ask anything"
                path="/manus-ai"
                active={location === "/manus-ai"}
                color="#00BEEF"
              />
            </div>
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
}

function NavItem({ icon: Icon, label, sub, path, active, color, small }: NavItemProps) {
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
        {active && <div className="w-1 h-1 rounded-full shrink-0" style={{ background: color }} />}
      </div>
    </Link>
  );
}
