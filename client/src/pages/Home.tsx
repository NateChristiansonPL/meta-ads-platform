import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { BarChart2, Cpu, RefreshCw, Shield, TrendingUp, Users, Zap } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const SKILLS = [
  { icon: TrendingUp, label: "Weekly Optimization", color: "#00BEEF" },
  { icon: BarChart2, label: "Performance Insights", color: "#F7901E" },
  { icon: RefreshCw, label: "Creative Lifecycle", color: "#00B37A" },
  { icon: Shield, label: "Structural Audit", color: "#ED135F" },
  { icon: Users, label: "Audience Overlap", color: "#a78bfa" },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#141349" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: "#141349", fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* ── Left brand panel ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden"
        style={{ width: "45%", background: "#0e0d3a" }}
      >
        {/* Topo texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cpath d='M0 200 Q100 150 200 200 T400 200' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 220 Q100 170 200 220 T400 220' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 240 Q100 190 200 240 T400 240' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 180 Q100 130 200 180 T400 180' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 160 Q100 110 200 160 T400 160' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 260 Q100 210 200 260 T400 260' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 280 Q100 230 200 280 T400 280' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3Cpath d='M0 140 Q100 90 200 140 T400 140' stroke='%2300BEEF' fill='none' stroke-width='1'/%3E%3C/svg%3E\")", backgroundSize: "400px 400px" }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#ED135F" }}>
            <Cpu size={18} color="#fff" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight" style={{ color: "#FAFAFA" }}>Pathlabs</div>
            <div className="text-xs font-semibold" style={{ color: "#00BEEF" }}>Intelligence Platform</div>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <h1 className="text-3xl font-black leading-tight mb-4" style={{ color: "#FAFAFA" }}>
            Meta Ads Intelligence,<br />
            <span style={{ color: "#ED135F" }}>Built for Teams.</span>
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
            Five AI-powered skills for Meta Ads analysis — weekly optimization, performance insights, creative lifecycle, structural audits, and audience overlap — all in one platform.
          </p>

          {/* Skill pills */}
          <div className="flex flex-col gap-2">
            {SKILLS.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: `${s.color}20` }}>
                  <s.icon size={11} style={{ color: s.color }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Powered by <span style={{ color: "#00BEEF" }}>Manus AI</span> · Pathlabs © 2025
          </div>
        </div>
      </div>

      {/* ── Right login panel ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#ED135F" }}>
            <Cpu size={16} color="#fff" />
          </div>
          <span className="font-bold text-sm" style={{ color: "#FAFAFA" }}>Pathlabs Intelligence</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {/* Shield icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(0,190,239,0.12)", border: "1px solid rgba(0,190,239,0.25)" }}>
              <Zap size={26} style={{ color: "#00BEEF" }} />
            </div>

            <h2 className="text-xl font-black text-center mb-1.5" style={{ color: "#FAFAFA" }}>
              Welcome back
            </h2>
            <p className="text-xs text-center mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
              Sign in with your Manus account to access the platform
            </p>

            {/* SSO Button */}
            <a
              href={getLoginUrl()}
              className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-bold text-sm transition-all"
              style={{
                background: "#00BEEF",
                color: "#141349",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#00d4f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#00BEEF")}
            >
              <Cpu size={16} />
              Continue with Manus
            </a>

            <div className="mt-4 text-center">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                Access is managed by your team admin.
                <br />Contact your admin if you need an invite.
              </p>
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <Shield size={11} style={{ color: "rgba(255,255,255,0.2)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              Secured by Manus OAuth · Team plan
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
