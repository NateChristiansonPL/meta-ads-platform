/**
 * LoginScreens — 3 login screen mockup options
 * Pathlabs brand: Montserrat font, #141349 dark blue base, #ED135F pink, #00BEEF cyan
 *
 * Option 1 — "Full Bleed Hero": Dark blue full-screen with topographic pattern, centered card
 * Option 2 — "Split Panel": Left brand panel + right login form
 * Option 3 — "Minimal Dark": Ultra-minimal, dark with floating card and pink accent line
 */

import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Zap, BarChart2, RefreshCw, Search, Users, Shield, ExternalLink } from "lucide-react";

const SKILLS_PREVIEW = [
  { icon: BarChart2, label: "Weekly Optimization", color: "#00BEEF" },
  { icon: Zap, label: "Performance Insights", color: "#F7901E" },
  { icon: RefreshCw, label: "Creative Lifecycle", color: "#00B37A" },
  { icon: Search, label: "Structural Audit", color: "#ED135F" },
  { icon: Users, label: "Audience Overlap", color: "#00BEEF" },
];

function PasswordInput({ placeholder }: { placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className="pl-input"
        style={{ paddingRight: "2.5rem" }}
      />
      <button
        onClick={() => setShow(!show)}
        style={{
          position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer",
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

/* ── Option 1: Full Bleed Hero ───────────────────────────────────────────── */
function LoginOption1() {
  return (
    <div
      className="flex items-center justify-center h-full topo-bg"
      style={{ background: "#141349", position: "relative", overflow: "hidden" }}
    >
      {/* Gradient orbs */}
      <div style={{
        position: "absolute", top: "-20%", right: "-10%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(237,19,95,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,190,239,0.10) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div style={{
        width: 420,
        background: "rgba(28,26,94,0.85)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "1.25rem",
        padding: "2.5rem",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        position: "relative",
        zIndex: 10,
      }}>
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div style={{
            width: 36, height: 36, borderRadius: "0.5rem",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "-0.02em" }}>PL</span>
          </div>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Pathlabs</div>
            <div style={{ fontSize: "0.6rem", fontWeight: 600, color: "#00BEEF", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: -1 }}>Intelligence</div>
          </div>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#FFFFFF", marginBottom: "0.375rem", letterSpacing: "-0.02em" }}>
          Welcome back.
        </h1>
        <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginBottom: "1.75rem", fontWeight: 400 }}>
          Sign in to your Pathlabs workspace
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Email
            </label>
            <input type="email" placeholder="you@agency.com" className="pl-input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Password
            </label>
            <PasswordInput placeholder="••••••••" />
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: "-0.25rem" }}>
            <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
              <input type="checkbox" style={{ accentColor: "#00BEEF" }} />
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Remember me</span>
            </label>
            <button style={{ fontSize: "0.72rem", color: "#00BEEF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Montserrat', sans-serif" }}>
              Forgot password?
            </button>
          </div>
          <button className="pl-btn-primary" style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem" }}>
            Sign In with Manus <ArrowRight size={15} />
          </button>
        </div>

        <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
            Access restricted to Pathlabs team members
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Option 2: Split Panel ───────────────────────────────────────────────── */
function LoginOption2() {
  return (
    <div className="flex h-full">
      {/* Left brand panel */}
      <div
        className="flex flex-col justify-between topo-bg"
        style={{
          flex: "0 0 52%",
          background: "linear-gradient(145deg, #141349 0%, #1C1A5E 60%, #0E0D3A 100%)",
          padding: "3rem",
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Pink accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 4, background: "linear-gradient(90deg, #ED135F, #F7901E)" }} />

        {/* Gradient orb */}
        <div style={{
          position: "absolute", bottom: "-15%", right: "-15%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,190,239,0.12) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* Top: Logo */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 40, height: 40, borderRadius: "0.625rem",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontSize: "0.85rem", fontWeight: 900 }}>PL</span>
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Pathlabs</div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#00BEEF", textTransform: "uppercase", letterSpacing: "0.12em" }}>Intelligence Platform</div>
          </div>
        </div>

        {/* Middle: Hero copy */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-block", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#ED135F", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              AI-Powered Meta Ads
            </span>
          </div>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 900, color: "#FFFFFF", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: "1rem" }}>
            Your Media<br />
            Intelligence<br />
            <span style={{ color: "#00BEEF" }}>Suite.</span>
          </h1>
          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.7, fontWeight: 400, maxWidth: 340 }}>
            Five powerful analysis skills to optimize your Meta Ads campaigns — from creative fatigue detection to structural audits.
          </p>

          {/* Skills preview list */}
          <div style={{ marginTop: "1.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {SKILLS_PREVIEW.map((skill) => (
              <div key={skill.label} className="flex items-center gap-2.5">
                <div style={{
                  width: 28, height: 28, borderRadius: "0.375rem",
                  background: `${skill.color}18`,
                  border: `1px solid ${skill.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <skill.icon size={13} style={{ color: skill.color }} />
                </div>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
                  {skill.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: tagline */}
        <div>
          <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
            © 2026 Pathlabs · An MiQ Company
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div
        className="flex items-center justify-center flex-1"
        style={{ background: "#FAFAFA", padding: "3rem" }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 900, color: "#141349", marginBottom: "0.375rem", letterSpacing: "-0.02em" }}>
            Sign in
          </h2>
          <p style={{ fontSize: "0.8rem", color: "#40405E", marginBottom: "2rem", fontWeight: 400 }}>
            Use your Manus credentials to access the platform
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#40405E", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@agency.com"
                style={{
                  width: "100%", padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  background: "#FFFFFF",
                  border: "1.5px solid #E0E0E8",
                  color: "#141349",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "0.85rem", fontWeight: 500,
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#40405E", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  placeholder="••••••••"
                  style={{
                    width: "100%", padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    background: "#FFFFFF",
                    border: "1.5px solid #E0E0E8",
                    color: "#141349",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "0.85rem", fontWeight: 500,
                    outline: "none",
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" style={{ accentColor: "#141349" }} />
                <span style={{ fontSize: "0.72rem", color: "#40405E", fontWeight: 500 }}>Keep me signed in</span>
              </label>
              <button style={{ fontSize: "0.72rem", color: "#ED135F", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
                Forgot password?
              </button>
            </div>
            <button
              style={{
                width: "100%", padding: "0.875rem",
                borderRadius: "0.5rem",
                background: "#141349",
                color: "#FFFFFF",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800, fontSize: "0.85rem",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                transition: "all 180ms ease",
                letterSpacing: "0.02em",
              }}
            >
              Sign In <ArrowRight size={16} />
            </button>
          </div>

          <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "0.625rem", background: "rgba(0,190,239,0.08)", border: "1px solid rgba(0,190,239,0.2)" }}>
            <p style={{ fontSize: "0.7rem", color: "#40405E", fontWeight: 500, lineHeight: 1.6 }}>
              <span style={{ color: "#00BEEF", fontWeight: 700 }}>Manus SSO</span> — This platform authenticates via Manus. Contact your admin if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Option 4: Manus SSO Only ───────────────────────────────────────────── */
function LoginOption4() {
  return (
    <div
      className="flex h-full"
      style={{ background: "#0E0D3A", position: "relative", overflow: "hidden" }}
    >
      {/* Animated gradient background */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(237,19,95,0.12) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 60% 50% at 80% 100%, rgba(0,190,239,0.10) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Left: Brand story panel */}
      <div
        className="flex flex-col justify-between topo-bg"
        style={{
          flex: "0 0 45%",
          padding: "3rem",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          position: "relative",
        }}
      >
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #ED135F 0%, #F7901E 40%, #00BEEF 100%)" }} />

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 44, height: 44, borderRadius: "0.75rem",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(237,19,95,0.3)",
          }}>
            <span style={{ color: "white", fontSize: "0.9rem", fontWeight: 900 }}>PL</span>
          </div>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Pathlabs</div>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#00BEEF", textTransform: "uppercase", letterSpacing: "0.12em" }}>Intelligence Platform</div>
          </div>
        </div>

        {/* Hero */}
        <div>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#ED135F", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.875rem" }}>
            AI-Powered Meta Ads
          </p>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 900, color: "#FFFFFF", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
            Five Skills.<br />
            <span style={{ color: "#00BEEF" }}>One Platform.</span>
          </h1>
          <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, fontWeight: 400, maxWidth: 320 }}>
            Weekly optimization, performance insights, creative lifecycle, structural audits, and audience overlap — all in one place.
          </p>

          {/* Skill dots */}
          <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {SKILLS_PREVIEW.map((skill, i) => (
              <div key={skill.label} className="flex items-center gap-3">
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: skill.color,
                  boxShadow: `0 0 8px ${skill.color}80`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{skill.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>© 2026 Pathlabs · An MiQ Company</p>
      </div>

      {/* Right: SSO-only login */}
      <div
        className="flex items-center justify-center flex-1"
        style={{ padding: "3rem" }}
      >
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* SSO card */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "1.5rem",
            padding: "2.5rem",
            backdropFilter: "blur(20px)",
          }}>
            {/* Shield icon */}
            <div style={{
              width: 56, height: 56, borderRadius: "1rem",
              background: "rgba(0,190,239,0.12)",
              border: "1px solid rgba(0,190,239,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "1.5rem",
            }}>
              <Shield size={26} style={{ color: "#00BEEF" }} />
            </div>

            <h2 style={{ fontSize: "1.375rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em", marginBottom: "0.375rem" }}>
              Secure Sign In
            </h2>
            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: "2rem", lineHeight: 1.6, fontWeight: 400 }}>
              This platform uses Manus SSO. Sign in with your Manus account to access the Pathlabs Intelligence Suite.
            </p>

            {/* Primary SSO button */}
            <button
              className="pl-btn-primary"
              style={{ width: "100%", padding: "0.875rem", borderRadius: "0.75rem", fontSize: "0.85rem", marginBottom: "1rem" }}
            >
              <ExternalLink size={15} />
              Continue with Manus
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Email fallback */}
            <div style={{ marginBottom: "0.75rem" }}>
              <input type="email" placeholder="your@email.com" className="pl-input" style={{ fontSize: "0.82rem" }} />
            </div>
            <button style={{
              width: "100%", padding: "0.75rem",
              borderRadius: "0.625rem",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "0.8rem", fontWeight: 600,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            }}>
              Send Magic Link
            </button>
          </div>

          {/* Footer note */}
          <p style={{ marginTop: "1.25rem", textAlign: "center", fontSize: "0.68rem", color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
            Access restricted to Pathlabs team members.<br />
            <button style={{ color: "#00BEEF", background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 600 }}>
              Request access →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Option 3: Minimal Dark ──────────────────────────────────────────────── */
function LoginOption3() {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ background: "#0E0D3A", position: "relative", overflow: "hidden" }}
    >
      {/* Subtle grid lines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* Pink top accent */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 200, height: 3,
        background: "linear-gradient(90deg, transparent, #ED135F, transparent)",
      }} />

      {/* Glow */}
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 400, height: 300, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(237,19,95,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 10, width: 380, textAlign: "center" }}>
        {/* Logo mark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "1rem",
            background: "linear-gradient(135deg, #ED135F 0%, #F7901E 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 16px 40px rgba(237,19,95,0.35)",
          }}>
            <span style={{ color: "white", fontSize: "1rem", fontWeight: 900 }}>PL</span>
          </div>
        </div>

        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>
          Pathlabs Intelligence
        </h1>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "2.25rem", fontWeight: 400 }}>
          Sign in to continue
        </p>

        {/* Login card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1.25rem",
          padding: "2rem",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", textAlign: "left" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Email
              </label>
              <input type="email" placeholder="you@pathlabs.com" className="pl-input" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Password
              </label>
              <PasswordInput placeholder="••••••••" />
            </div>

            <button
              className="pl-btn-pink"
              style={{ width: "100%", padding: "0.75rem", marginTop: "0.25rem", borderRadius: "0.625rem" }}
            >
              Sign In <ArrowRight size={15} />
            </button>
          </div>

          <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
              Forgot password?
            </button>
            <button style={{ fontSize: "0.68rem", color: "#00BEEF", background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
              Request Access →
            </button>
          </div>
        </div>

        {/* SSO note */}
        <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", fontWeight: 500, whiteSpace: "nowrap" }}>
            Powered by Manus SSO
          </span>
          <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>

        <p style={{ marginTop: "1.5rem", fontSize: "0.65rem", color: "rgba(255,255,255,0.2)" }}>
          © 2026 Pathlabs · An MiQ Company
        </p>
      </div>
    </div>
  );
}

/* ── Selector wrapper ────────────────────────────────────────────────────── */
const OPTIONS = [
  { id: 1, label: "Full Bleed Hero", desc: "Centered card on dark topo background" },
  { id: 2, label: "Split Panel", desc: "Brand left + form right (light)" },
  { id: 3, label: "Minimal Dark", desc: "Grid bg, pink accent, floating card" },
  { id: 4, label: "Manus SSO", desc: "Brand left + SSO-only right panel" },
];

export default function LoginScreens() {
  const [active, setActive] = useState(1);

  return (
    <div className="flex flex-col h-full">
      {/* Option selector */}
      <div style={{
        background: "rgba(14,13,58,0.9)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0.5rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginRight: "0.25rem" }}>
          Login Option:
        </span>
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setActive(opt.id)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.3rem 0.875rem",
              borderRadius: "999px",
              background: active === opt.id ? "rgba(0,190,239,0.15)" : "rgba(255,255,255,0.04)",
              border: active === opt.id ? "1px solid rgba(0,190,239,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: active === opt.id ? "#00BEEF" : "rgba(255,255,255,0.45)",
              fontSize: "0.72rem", fontWeight: active === opt.id ? 700 : 500,
              fontFamily: "'Montserrat', sans-serif",
              cursor: "pointer", transition: "all 150ms ease",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              background: active === opt.id ? "#00BEEF" : "rgba(255,255,255,0.1)",
              color: active === opt.id ? "#141349" : "rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6rem", fontWeight: 800, flexShrink: 0,
            }}>
              {opt.id}
            </span>
            {opt.label}
            <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
              — {opt.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Active login screen */}
      <div className="flex-1 overflow-hidden">
        {active === 1 && <LoginOption1 />}
        {active === 2 && <LoginOption2 />}
        {active === 3 && <LoginOption3 />}
        {active === 4 && <LoginOption4 />}
      </div>
    </div>
  );
}
