/**
 * AppLayouts — 3 app layout mockup options (skills-first)
 * Pathlabs brand: Montserrat font, #141349 dark blue base, #ED135F pink, #00BEEF cyan
 *
 * Layout A — "Dashboard Grid": Top nav + hero skills grid, Campaign Builder as a locked card at bottom
 * Layout B — "Left Rail + Stage": Narrow left nav (skills list) + large content stage, builder in sidebar footer
 * Layout C — "Command Hub": Skills as top-level tabs in a wide nav, builder as a "Coming Soon" tab
 */

import { useState } from "react";
import {
  BarChart2, Zap, RefreshCw, Search, Users,
  Hammer, ChevronRight, Lock, Play, Settings,
  Bell, ChevronDown, LayoutGrid, List, Activity,
  TrendingUp, AlertCircle, CheckCircle, Clock,
  ArrowRight, Menu, X
} from "lucide-react";

/* ── Shared data ─────────────────────────────────────────────────────────── */
const SKILLS = [
  {
    id: "weekly",
    icon: BarChart2,
    label: "Weekly Optimization",
    subtitle: "Breakdown-level insights",
    desc: "Statistical significance testing with prioritized, impact-ranked recommendations for weekly optimization calls.",
    color: "#00BEEF",
    badge: "Active",
    badgeColor: "#00BEEF",
    stat: "Last run: 2h ago",
  },
  {
    id: "performance",
    icon: Zap,
    label: "Performance Insights",
    subtitle: "KPI-anchored analysis",
    desc: "Placement conversion data, budget pacing, lifecycle enrichment, and structured signals with Meta delivery mechanics.",
    color: "#F7901E",
    badge: "Active",
    badgeColor: "#F7901E",
    stat: "Last run: 4h ago",
  },
  {
    id: "lifecycle",
    icon: RefreshCw,
    label: "Creative Lifecycle",
    subtitle: "Fatigue detection",
    desc: "CDR with Beta-Binomial significance, BOCPD, CUSUM, EWMA, and Frequency-CPM elasticity. Works at any spend level.",
    color: "#00B37A",
    badge: "Active",
    badgeColor: "#00B37A",
    stat: "Last run: 1d ago",
  },
  {
    id: "audit",
    icon: Search,
    label: "Structural Audit",
    subtitle: "Andromeda account audit",
    desc: "Data Infrastructure, Signal Density, Creative Velocity, Liquidity Consolidation, Budget Liquidity, and more.",
    color: "#ED135F",
    badge: "Active",
    badgeColor: "#ED135F",
    stat: "Last run: 3d ago",
  },
  {
    id: "overlap",
    icon: Users,
    label: "Audience Overlap",
    subtitle: "Overlap & wasted spend",
    desc: "Pairwise audience overlap with KPI-aware wasted spend estimation per ad set. Active ad sets only.",
    color: "#A855F7",
    badge: "Active",
    badgeColor: "#A855F7",
    stat: "Last run: 5d ago",
  },
];

const BUILDER = {
  icon: Hammer,
  label: "Campaign Builder",
  subtitle: "Create & launch campaigns",
  desc: "Full campaign, ad set, and ad creation with Creative Library. Coming soon.",
  color: "#40405E",
};

/* ── Shared sub-components ───────────────────────────────────────────────── */
function SkillBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "0.1rem 0.5rem", borderRadius: 999,
      fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

function BuilderLockedBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "0.1rem 0.5rem", borderRadius: 999,
      fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
      background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)",
      border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <Lock size={8} /> Coming Soon
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Layout A — Dashboard Grid                                                  */
/* ────────────────────────────────────────────────────────────────────────── */
function LayoutA() {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full" style={{ background: "#141349", overflow: "hidden" }}>
      {/* Top nav */}
      <div style={{
        height: 56, flexShrink: 0,
        background: "#0E0D3A",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1.5rem",
      }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 30, height: 30, borderRadius: "0.4rem",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontSize: "0.65rem", fontWeight: 900 }}>PL</span>
          </div>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
            Pathlabs <span style={{ color: "#00BEEF" }}>Intelligence</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
            <Bell size={16} />
          </button>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.65rem", fontWeight: 800, color: "white",
          }}>
            JD
          </div>
        </div>
      </div>

      {/* Page header */}
      <div style={{ padding: "1.5rem 1.5rem 0.75rem", flexShrink: 0 }}>
        <div className="flex items-end justify-between">
          <div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#ED135F", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
              Intelligence Suite
            </p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              Analysis Skills
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.4rem 0.875rem", borderRadius: "0.375rem",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", fontWeight: 600,
              fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
            }}>
              <LayoutGrid size={13} /> Grid
            </button>
            <button style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.4rem 0.875rem", borderRadius: "0.375rem",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", fontWeight: 500,
              fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
            }}>
              <List size={13} /> List
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "auto", padding: "0.75rem 1.5rem 1.5rem" }}>
        {/* Skills grid — 2×3 or 3×2 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.875rem", marginBottom: "1rem" }}>
          {SKILLS.map((skill) => (
            <div
              key={skill.id}
              className="skill-card"
              onClick={() => setActiveSkill(activeSkill === skill.id ? null : skill.id)}
              style={{
                background: activeSkill === skill.id ? `${skill.color}0D` : "rgba(255,255,255,0.04)",
                borderColor: activeSkill === skill.id ? `${skill.color}50` : "rgba(255,255,255,0.08)",
              }}
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div style={{
                  width: 36, height: 36, borderRadius: "0.5rem",
                  background: `${skill.color}18`,
                  border: `1px solid ${skill.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <skill.icon size={17} style={{ color: skill.color }} />
                </div>
                <SkillBadge label={skill.badge} color={skill.badgeColor} />
              </div>

              <h3 style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FFFFFF", marginBottom: "0.2rem", letterSpacing: "-0.01em" }}>
                {skill.label}
              </h3>
              <p style={{ fontSize: "0.68rem", fontWeight: 600, color: skill.color, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {skill.subtitle}
              </p>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.55, fontWeight: 400, marginBottom: "1rem" }}>
                {skill.desc}
              </p>

              <div className="flex items-center justify-between">
                <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                  {skill.stat}
                </span>
                <button style={{
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  padding: "0.3rem 0.75rem", borderRadius: 999,
                  background: skill.color, color: "#141349",
                  fontSize: "0.65rem", fontWeight: 800,
                  fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer",
                  letterSpacing: "0.04em",
                }}>
                  <Play size={9} /> Run
                </button>
              </div>

              {/* Expanded config panel */}
              {activeSkill === skill.id && (
                <div style={{
                  marginTop: "1rem", paddingTop: "1rem",
                  borderTop: `1px solid ${skill.color}25`,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.25rem" }}>
                        Ad Account
                      </label>
                      <div className="pl-select">
                        <span>Select a Business Manager...</span>
                        <ChevronDown size={12} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.25rem" }}>
                        Date Range
                      </label>
                      <div className="pl-select">
                        <span>Last 7 Days</span>
                        <ChevronDown size={12} />
                      </div>
                    </div>
                    <button style={{
                      width: "100%", padding: "0.5rem",
                      borderRadius: "0.375rem",
                      background: skill.color, color: "#141349",
                      fontSize: "0.72rem", fontWeight: 800,
                      fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                    }}>
                      <Play size={11} /> Run {skill.label}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Campaign Builder — locked card */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.12)",
          borderRadius: "1rem",
          padding: "1.25rem 1.5rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: "0.625rem",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Hammer size={18} style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "rgba(255,255,255,0.5)" }}>
                  Campaign Builder
                </h3>
                <BuilderLockedBadge />
              </div>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                Full campaign creation — ad sets, creative library, and launch. In development.
              </p>
            </div>
          </div>
          <button style={{
            padding: "0.4rem 1rem", borderRadius: 999,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", fontWeight: 600,
            fontFamily: "'Montserrat', sans-serif", cursor: "not-allowed",
            display: "flex", alignItems: "center", gap: "0.375rem",
          }}>
            <Lock size={11} /> Locked
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Layout B — Left Rail + Stage                                               */
/* ────────────────────────────────────────────────────────────────────────── */
function LayoutB() {
  const [activeSkill, setActiveSkill] = useState(SKILLS[0].id);
  const skill = SKILLS.find((s) => s.id === activeSkill)!;

  return (
    <div className="flex h-full" style={{ background: "#141349", overflow: "hidden" }}>
      {/* Left rail */}
      <div style={{
        width: 240, flexShrink: 0,
        background: "#0E0D3A",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{ padding: "1.125rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: "0.375rem",
              background: "linear-gradient(135deg, #ED135F, #F7901E)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontSize: "0.6rem", fontWeight: 900 }}>PL</span>
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Pathlabs</div>
              <div style={{ fontSize: "0.55rem", fontWeight: 700, color: "#00BEEF", textTransform: "uppercase", letterSpacing: "0.1em" }}>Intelligence</div>
            </div>
          </div>
        </div>

        {/* Skills section */}
        <div style={{ flex: 1, overflow: "auto", padding: "0.75rem 0.625rem" }}>
          <p style={{ fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
            Skills
          </p>
          {SKILLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSkill(s.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.5rem 0.625rem", borderRadius: "0.5rem",
                background: activeSkill === s.id ? `${s.color}15` : "transparent",
                border: activeSkill === s.id ? `1px solid ${s.color}30` : "1px solid transparent",
                cursor: "pointer", marginBottom: "0.125rem",
                transition: "all 150ms ease",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "0.375rem",
                background: activeSkill === s.id ? `${s.color}20` : "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <s.icon size={13} style={{ color: activeSkill === s.id ? s.color : "rgba(255,255,255,0.4)" }} />
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: activeSkill === s.id ? "#FFFFFF" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "0.58rem", color: activeSkill === s.id ? s.color : "rgba(255,255,255,0.3)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Builder locked footer */}
        <div style={{
          padding: "0.75rem 0.625rem",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <p style={{ fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
            Coming Soon
          </p>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.5rem 0.625rem", borderRadius: "0.5rem",
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.08)",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "0.375rem",
              background: "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Hammer size={13} style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>Campaign Builder</div>
              <div className="flex items-center gap-1">
                <Lock size={8} style={{ color: "rgba(255,255,255,0.2)" }} />
                <span style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>In development</span>
              </div>
            </div>
          </div>
        </div>

        {/* User */}
        <div style={{
          padding: "0.75rem 0.625rem",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: "0.625rem",
          flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", fontWeight: 800, color: "white", flexShrink: 0,
          }}>
            JD
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Jane Doe
            </div>
            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Media Strategist</div>
          </div>
          <Settings size={13} style={{ color: "rgba(255,255,255,0.25)", marginLeft: "auto", flexShrink: 0 }} />
        </div>
      </div>

      {/* Main stage */}
      <div className="flex flex-col flex-1" style={{ overflow: "hidden" }}>
        {/* Stage header */}
        <div style={{
          height: 56, flexShrink: 0,
          background: "rgba(14,13,58,0.7)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1.5rem",
        }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: "0.375rem",
              background: `${skill.color}18`,
              border: `1px solid ${skill.color}25`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <skill.icon size={14} style={{ color: skill.color }} />
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF" }}>{skill.label}</span>
            <SkillBadge label="Active" color={skill.color} />
          </div>
          <div className="flex items-center gap-3">
            <CreditsWidget />
            <Bell size={15} style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        </div>

        {/* Stage content */}
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          {/* Skill hero */}
          <div style={{
            background: `linear-gradient(135deg, ${skill.color}12 0%, rgba(20,19,73,0.5) 100%)`,
            border: `1px solid ${skill.color}25`,
            borderRadius: "1rem",
            padding: "1.5rem",
            marginBottom: "1.25rem",
          }}>
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: "0.62rem", fontWeight: 700, color: skill.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.375rem" }}>
                  {skill.subtitle}
                </p>
                <h2 style={{ fontSize: "1.375rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
                  {skill.label}
                </h2>
                <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.65, maxWidth: 520, fontWeight: 400 }}>
                  {skill.desc}
                </p>
              </div>
            </div>
          </div>

          {/* Two-column: config + output */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {/* Config panel */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.875rem",
              padding: "1.25rem",
            }}>
              <h4 style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                Configuration
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <div>
                  <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>
                    Business Manager
                  </label>
                  <div className="pl-select"><span>Select a Business Manager...</span><ChevronDown size={12} /></div>
                </div>
                <div>
                  <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>
                    Ad Account
                  </label>
                  <div className="pl-select"><span>Select a BM first</span><ChevronDown size={12} /></div>
                </div>
                <div>
                  <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>
                    Date Range
                  </label>
                  <div className="pl-select"><span>Last 7 Days</span><ChevronDown size={12} /></div>
                </div>
                <div>
                  <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>
                    Additional Instructions <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400, textTransform: "none" }}>(optional)</span>
                  </label>
                  <textarea
                    placeholder="Any extra context or focus areas..."
                    className="pl-input"
                    style={{ resize: "none", height: 72 }}
                  />
                </div>
                <button style={{
                  width: "100%", padding: "0.625rem",
                  borderRadius: "0.5rem",
                  background: skill.color, color: "#141349",
                  fontSize: "0.75rem", fontWeight: 800,
                  fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                }}>
                  <Play size={12} /> Run {skill.label}
                </button>
              </div>
            </div>

            {/* Output / recent runs */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.875rem",
              padding: "1.25rem",
            }}>
              <h4 style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                Recent Runs
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {[
                  { label: "Account #1 · Last 7d", time: "2h ago", status: "complete" },
                  { label: "Account #2 · Last 30d", time: "1d ago", status: "complete" },
                  { label: "Account #1 · Last 14d", time: "3d ago", status: "complete" },
                ].map((run, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.625rem 0.75rem",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "0.5rem",
                  }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={13} style={{ color: "#00B37A", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{run.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>{run.time}</span>
                      <button style={{
                        padding: "0.2rem 0.5rem", borderRadius: 999,
                        background: "rgba(255,255,255,0.06)", border: "none",
                        color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", fontWeight: 600,
                        fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
                      }}>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Layout C — Command Hub (Tab Nav)                                           */
/* ────────────────────────────────────────────────────────────────────────── */
function LayoutC() {
  const [activeTab, setActiveTab] = useState("weekly");

  const ALL_TABS = [
    ...SKILLS,
    { id: "builder", icon: Hammer, label: "Campaign Builder", subtitle: "Coming soon", desc: "", color: "#40405E", badge: "Coming Soon", badgeColor: "#40405E", stat: "" },
  ];

  const isBuilder = activeTab === "builder";
  const skill = isBuilder ? null : SKILLS.find((s) => s.id === activeTab);

  return (
    <div className="flex flex-col h-full" style={{ background: "#141349", overflow: "hidden" }}>
      {/* Top header */}
      <div style={{
        background: "#0E0D3A",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        {/* Brand row */}
        <div style={{
          height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 30, height: 30, borderRadius: "0.4rem",
              background: "linear-gradient(135deg, #ED135F, #F7901E)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontSize: "0.65rem", fontWeight: 900 }}>PL</span>
            </div>
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
              Pathlabs <span style={{ color: "#00BEEF" }}>Intelligence</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.25rem 0.75rem", borderRadius: 999,
              background: "rgba(0,179,122,0.12)", border: "1px solid rgba(0,179,122,0.25)",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00B37A" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#00B37A" }}>Connected</span>
            </div>
            <Bell size={15} style={{ color: "rgba(255,255,255,0.35)" }} />
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #ED135F, #F7901E)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6rem", fontWeight: 800, color: "white",
            }}>
              JD
            </div>
          </div>
        </div>

        {/* Tab row */}
        <div style={{ display: "flex", alignItems: "flex-end", padding: "0 1.5rem", gap: "0.125rem", overflowX: "auto" }}>
          {ALL_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isLocked = tab.id === "builder";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.625rem 1rem",
                  borderRadius: "0.5rem 0.5rem 0 0",
                  background: isActive ? "#141349" : "transparent",
                  borderTop: isActive ? `2px solid ${isLocked ? "rgba(255,255,255,0.15)" : tab.color}` : "2px solid transparent",
                  borderLeft: isActive ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
                  borderRight: isActive ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
                  borderBottom: "none",
                  cursor: "pointer",
                  fontFamily: "'Montserrat', sans-serif",
                  whiteSpace: "nowrap",
                  transition: "all 150ms ease",
                  opacity: isLocked && !isActive ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {isLocked
                  ? <Lock size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                  : <tab.icon size={12} style={{ color: isActive ? tab.color : "rgba(255,255,255,0.4)" }} />
                }
                <span style={{
                  fontSize: "0.72rem", fontWeight: isActive ? 800 : 600,
                  color: isActive ? (isLocked ? "rgba(255,255,255,0.4)" : "#FFFFFF") : "rgba(255,255,255,0.45)",
                }}>
                  {tab.label}
                </span>
                {isLocked && (
                  <span style={{
                    fontSize: "0.55rem", fontWeight: 700, color: "rgba(255,255,255,0.25)",
                    background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.4rem", borderRadius: 999,
                  }}>
                    SOON
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isBuilder ? (
          /* Builder locked state */
          <div className="flex flex-col items-center justify-center h-full" style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "1.25rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "1.5rem",
            }}>
              <Hammer size={32} style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "rgba(255,255,255,0.5)", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
              Campaign Builder
            </h2>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", maxWidth: 380, lineHeight: 1.7, fontWeight: 400, marginBottom: "1.5rem" }}>
              Full campaign creation with ad sets, creative library, and one-click launch is currently in development. Skills are available now.
            </p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1.25rem", borderRadius: 999,
              background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", fontWeight: 600,
            }}>
              <Clock size={13} /> Coming Soon
            </div>
          </div>
        ) : skill ? (
          /* Skill content */
          <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
            {/* Hero */}
            <div style={{
              background: `linear-gradient(135deg, ${skill.color}10 0%, rgba(14,13,58,0.6) 100%)`,
              border: `1px solid ${skill.color}22`,
              borderRadius: "1rem",
              padding: "1.5rem 2rem",
              marginBottom: "1.5rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{
                    width: 40, height: 40, borderRadius: "0.625rem",
                    background: `${skill.color}18`, border: `1px solid ${skill.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <skill.icon size={20} style={{ color: skill.color }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{skill.label}</h2>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, color: skill.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{skill.subtitle}</p>
                  </div>
                </div>
                <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 500, fontWeight: 400 }}>
                  {skill.desc}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "1.5rem" }}>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" }}>{skill.stat}</div>
                <button style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.625rem 1.25rem", borderRadius: 999,
                  background: skill.color, color: "#141349",
                  fontSize: "0.75rem", fontWeight: 800,
                  fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer",
                }}>
                  <Play size={13} /> Run Now
                </button>
              </div>
            </div>

            {/* Config + Runs */}
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem" }}>
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "0.875rem",
                padding: "1.25rem",
              }}>
                <h4 style={{ fontSize: "0.7rem", fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                  Account Selection
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {["Business Manager", "Ad Account", "Date Range"].map((label) => (
                    <div key={label}>
                      <label style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.25rem" }}>
                        {label}
                      </label>
                      <div className="pl-select">
                        <span>{label === "Date Range" ? "Last 7 Days" : `Select a ${label === "Business Manager" ? "BM" : "BM first"}...`}</span>
                        <ChevronDown size={12} />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.25rem" }}>
                      Additional Instructions <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
                    </label>
                    <textarea
                      placeholder="Any extra context..."
                      className="pl-input"
                      style={{ resize: "none", height: 64 }}
                    />
                  </div>
                  <button style={{
                    width: "100%", padding: "0.625rem",
                    borderRadius: "0.5rem",
                    background: skill.color, color: "#141349",
                    fontSize: "0.75rem", fontWeight: 800,
                    fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                  }}>
                    <Play size={12} /> Run {skill.label}
                  </button>
                </div>
              </div>

              {/* Activity feed */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "0.875rem",
                padding: "1.25rem",
              }}>
                <h4 style={{ fontSize: "0.7rem", fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                  Run History
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    { account: "Acme Corp · Account #1", range: "Last 7 Days", time: "2 hours ago", status: "complete" },
                    { account: "Acme Corp · Account #2", range: "Last 30 Days", time: "1 day ago", status: "complete" },
                    { account: "Acme Corp · Account #1", range: "Last 14 Days", time: "3 days ago", status: "complete" },
                    { account: "Beta Brand · Account #3", range: "Last 7 Days", time: "5 days ago", status: "complete" },
                  ].map((run, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.75rem 0.875rem",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.055)",
                      borderRadius: "0.5rem",
                    }}>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle size={14} style={{ color: "#00B37A", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{run.account}</div>
                          <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{run.range} · {run.time}</div>
                        </div>
                      </div>
                      <button style={{
                        padding: "0.25rem 0.625rem", borderRadius: 999,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.25rem",
                      }}>
                        View <ArrowRight size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Shared: Manus Credits Widget                                               */
/* ────────────────────────────────────────────────────────────────────────── */
function CreditsWidget() {
  const used = 1240;
  const total = 2000;
  const pct = Math.round((used / total) * 100);
  const remaining = total - used;
  const color = pct > 80 ? "#ED135F" : pct > 60 ? "#F7901E" : "#00B37A";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.3rem 0.75rem",
      borderRadius: 999,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.09)",
      cursor: "pointer",
    }}>
      {/* Arc/bar */}
      <div style={{ position: "relative", width: 28, height: 14, flexShrink: 0 }}>
        <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
          <path d="M2 13 A12 12 0 0 1 26 13" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path
            d="M2 13 A12 12 0 0 1 26 13"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${(pct / 100) * 37.7} 37.7`}
          />
        </svg>
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
          {remaining.toLocaleString()}
          <span style={{ fontSize: "0.55rem", fontWeight: 500, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>left</span>
        </div>
        <div style={{ fontSize: "0.55rem", fontWeight: 500, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Manus credits</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Layout D — Builder Unlocked (Left Rail + Stage with Campaign Builder)      */
/* ────────────────────────────────────────────────────────────────────────── */
type NavItem = "skills" | "builder";
type BuilderStep = 1 | 2 | 3;

const BUILDER_STEPS = [
  { id: 1, label: "Campaigns", sublabel: "Define campaigns", icon: Activity },
  { id: 2, label: "Ad Sets", sublabel: "Targeting & budget", icon: TrendingUp },
  { id: 3, label: "Creative Library", sublabel: "Assets & copy", icon: LayoutGrid },
];

function BuilderStepCampaigns() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Mode selector */}
      <div style={{ display: "flex", gap: "0.625rem" }}>
        {["Full Build", "Ads Only", "Update Ads"].map((mode, i) => (
          <button key={mode} style={{
            flex: 1, padding: "0.625rem", borderRadius: "0.625rem",
            background: i === 0 ? "rgba(237,19,95,0.12)" : "rgba(255,255,255,0.04)",
            border: i === 0 ? "1px solid rgba(237,19,95,0.35)" : "1px solid rgba(255,255,255,0.08)",
            color: i === 0 ? "#ED135F" : "rgba(255,255,255,0.5)",
            fontSize: "0.72rem", fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
          }}>{mode}</button>
        ))}
      </div>

      {/* Spreadsheet table */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "0.875rem",
        overflow: "hidden",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "32px 90px 1fr 110px 80px 80px 140px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 0.75rem",
        }}>
          {["#", "STATUS", "CAMPAIGN NAME", "OBJECTIVE", "SPEND CAP", "CBO", "CAMPAIGN ID"].map((h) => (
            <div key={h} style={{ padding: "0.5rem 0.375rem", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
          ))}
        </div>
        {/* Row 1 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "32px 90px 1fr 110px 80px 80px 140px",
          padding: "0 0.75rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          alignItems: "center",
        }}>
          <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>1</div>
          <div style={{ padding: "0.5rem 0.375rem" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, background: "rgba(0,179,122,0.15)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.3)" }}>Active</span>
          </div>
          <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Brand — Awareness — Q2 2026</div>
          <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.5)" }}>Traffic</div>
          <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.5)" }}>—</div>
          <div style={{ padding: "0.5rem 0.375rem" }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }} />
          </div>
          <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>auto-populated</div>
        </div>
        {/* Empty row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "32px 90px 1fr 110px 80px 80px 140px",
          padding: "0 0.75rem",
          alignItems: "center",
          opacity: 0.4,
        }}>
          <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>2</div>
          {["STATUS", "Campaign name...", "Objective", "$—", "", ""].map((v, i) => (
            <div key={i} style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", fontStyle: i === 1 ? "italic" : "normal" }}>{v}</div>
          ))}
        </div>
        {/* Add row */}
        <div style={{ padding: "0.5rem 1rem", display: "flex", gap: "0.75rem" }}>
          <button style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.4)",
            background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
          }}>
            + Add Row
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.4)",
            background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
          }}>
            + Add 5 Rows
          </button>
        </div>
      </div>

      {/* Footer stats */}
      <div style={{ display: "flex", gap: "1.5rem" }}>
        {[{ n: "0", l: "Campaigns" }, { n: "1", l: "Ad Sets" }, { n: "0", l: "Ads" }].map((s) => (
          <div key={s.l}>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{s.n}</div>
            <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuilderStepAdSets() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "0.875rem",
        overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "32px 90px 1fr 120px 90px 90px 110px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 0.75rem",
        }}>
          {["#", "STATUS", "AD SET NAME", "CAMPAIGN", "BUDGET", "TARGETING", "AD SET ID"].map((h) => (
            <div key={h} style={{ padding: "0.5rem 0.375rem", fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
          ))}
        </div>
        {[
          { status: "Active", name: "Brand — 25-44 — US — Feed", campaign: "Brand Q2 2026", budget: "$150/day", targeting: "Broad", id: "auto" },
          { status: "Paused", name: "Brand — 18-24 — US — Reels", campaign: "Brand Q2 2026", budget: "$75/day", targeting: "Interest", id: "auto" },
        ].map((row, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "32px 90px 1fr 120px 90px 90px 110px",
            padding: "0 0.75rem",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            alignItems: "center",
          }}>
            <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>{i + 1}</div>
            <div style={{ padding: "0.5rem 0.375rem" }}>
              <span style={{
                fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999,
                background: row.status === "Active" ? "rgba(0,179,122,0.15)" : "rgba(247,144,30,0.15)",
                color: row.status === "Active" ? "#00B37A" : "#F7901E",
                border: `1px solid ${row.status === "Active" ? "rgba(0,179,122,0.3)" : "rgba(247,144,30,0.3)"}`,
              }}>{row.status}</span>
            </div>
            <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{row.name}</div>
            <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.45)" }}>{row.campaign}</div>
            <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.5)" }}>{row.budget}</div>
            <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.68rem", color: "rgba(255,255,255,0.5)" }}>{row.targeting}</div>
            <div style={{ padding: "0.5rem 0.375rem", fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>auto-populated</div>
          </div>
        ))}
        <div style={{ padding: "0.5rem 1rem" }}>
          <button style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>+ Add Row</button>
        </div>
      </div>
    </div>
  );
}

function BuilderStepCreativeLibrary() {
  const assets = [
    { name: "Hero_Static_Feed_1200x628", type: "Static", size: "1200×628", tag: "Feed" },
    { name: "Hero_Static_Story_1080x1920", type: "Static", size: "1080×1920", tag: "Story" },
    { name: "Product_Video_Feed_15s", type: "Video", size: "1200×628", tag: "Feed" },
    { name: "Carousel_Card_01_1080x1080", type: "Carousel", size: "1080×1080", tag: "Feed" },
    { name: "Carousel_Card_02_1080x1080", type: "Carousel", size: "1080×1080", tag: "Feed" },
    { name: "Reels_Video_9x16_30s", type: "Video", size: "1080×1920", tag: "Reels" },
  ];
  const typeColor: Record<string, string> = { Static: "#00BEEF", Video: "#F7901E", Carousel: "#A855F7" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Upload bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1rem",
        background: "rgba(255,255,255,0.03)",
        border: "1px dashed rgba(255,255,255,0.12)",
        borderRadius: "0.75rem",
      }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 28, height: 28, borderRadius: "0.375rem", background: "rgba(0,190,239,0.12)", border: "1px solid rgba(0,190,239,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={13} style={{ color: "#00BEEF", transform: "rotate(-90deg)" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Drop assets here or click to upload</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>PNG, JPG, MP4 · Max 4GB per file</div>
          </div>
        </div>
        <button style={{
          padding: "0.4rem 1rem", borderRadius: 999,
          background: "#00BEEF", color: "#141349",
          fontSize: "0.68rem", fontWeight: 800,
          fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer",
        }}>Upload</button>
      </div>

      {/* Asset grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        {assets.map((a) => (
          <div key={a.name} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "0.75rem",
            padding: "0.875rem",
            cursor: "pointer",
            transition: "all 150ms ease",
          }}>
            {/* Preview placeholder */}
            <div style={{
              width: "100%", aspectRatio: "16/9",
              background: `linear-gradient(135deg, ${typeColor[a.type]}15, rgba(255,255,255,0.03))`,
              border: `1px solid ${typeColor[a.type]}20`,
              borderRadius: "0.5rem",
              marginBottom: "0.625rem",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: `${typeColor[a.type]}80`, textTransform: "uppercase", letterSpacing: "0.1em" }}>{a.type}</span>
            </div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: "0.58rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 999, background: `${typeColor[a.type]}15`, color: typeColor[a.type], border: `1px solid ${typeColor[a.type]}25` }}>{a.type}</span>
              <span style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)" }}>{a.size}</span>
              <span style={{ fontSize: "0.58rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>{a.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LayoutD() {
  const [activeNav, setActiveNav] = useState<NavItem>("builder");
  const [activeSkill, setActiveSkill] = useState(SKILLS[0].id);
  const [builderStep, setBuilderStep] = useState<BuilderStep>(1);

  const skill = SKILLS.find((s) => s.id === activeSkill)!;
  const isBuilder = activeNav === "builder";

  return (
    <div className="flex h-full" style={{ background: "#141349", overflow: "hidden" }}>
      {/* ── Left rail (identical width/structure to LayoutB) ── */}
      <div style={{
        width: 240, flexShrink: 0,
        background: "#0E0D3A",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{ padding: "1.125rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: "0.375rem",
              background: "linear-gradient(135deg, #ED135F, #F7901E)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontSize: "0.6rem", fontWeight: 900 }}>PL</span>
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Pathlabs</div>
              <div style={{ fontSize: "0.55rem", fontWeight: 700, color: "#00BEEF", textTransform: "uppercase", letterSpacing: "0.1em" }}>Intelligence</div>
            </div>
          </div>
        </div>

        {/* Skills section */}
        <div style={{ flex: 1, overflow: "auto", padding: "0.75rem 0.625rem" }}>
          <p style={{ fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>Skills</p>
          {SKILLS.map((s) => {
            const isActive = activeNav === "skills" && activeSkill === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setActiveNav("skills"); setActiveSkill(s.id); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
                  padding: "0.5rem 0.625rem", borderRadius: "0.5rem",
                  background: isActive ? `${s.color}15` : "transparent",
                  border: isActive ? `1px solid ${s.color}30` : "1px solid transparent",
                  cursor: "pointer", marginBottom: "0.125rem",
                  transition: "all 150ms ease",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "0.375rem",
                  background: isActive ? `${s.color}20` : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <s.icon size={13} style={{ color: isActive ? s.color : "rgba(255,255,255,0.4)" }} />
                </div>
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                  <div style={{ fontSize: "0.58rem", color: isActive ? s.color : "rgba(255,255,255,0.3)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.subtitle}</div>
                </div>
              </button>
            );
          })}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0.625rem 0.5rem" }} />

          {/* Campaign Builder — ACTIVE (same size as skills) */}
          <p style={{ fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>Tools</p>
          <button
            onClick={() => setActiveNav("builder")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.5rem 0.625rem", borderRadius: "0.5rem",
              background: isBuilder ? "rgba(237,19,95,0.12)" : "transparent",
              border: isBuilder ? "1px solid rgba(237,19,95,0.3)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms ease",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: "0.375rem",
              background: isBuilder ? "rgba(237,19,95,0.2)" : "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Hammer size={13} style={{ color: isBuilder ? "#ED135F" : "rgba(255,255,255,0.4)" }} />
            </div>
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: isBuilder ? "#FFFFFF" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Campaign Builder</div>
              <div style={{ fontSize: "0.58rem", color: isBuilder ? "#ED135F" : "rgba(255,255,255,0.3)", fontWeight: 500 }}>Create & launch</div>
            </div>
          </button>
        </div>

        {/* User footer */}
        <div style={{
          padding: "0.75rem 0.625rem",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: "0.625rem",
          flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #ED135F, #F7901E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", fontWeight: 800, color: "white", flexShrink: 0,
          }}>JD</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Jane Doe</div>
            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Media Strategist</div>
          </div>
          <Settings size={13} style={{ color: "rgba(255,255,255,0.25)", marginLeft: "auto", flexShrink: 0 }} />
        </div>
      </div>

      {/* ── Main stage ── */}
      <div className="flex flex-col flex-1" style={{ overflow: "hidden" }}>
        {/* Stage header */}
        <div style={{
          height: 56, flexShrink: 0,
          background: "rgba(14,13,58,0.7)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1.5rem",
        }}>
          <div className="flex items-center gap-2">
            {isBuilder ? (
              <>
                <div style={{ width: 28, height: 28, borderRadius: "0.375rem", background: "rgba(237,19,95,0.15)", border: "1px solid rgba(237,19,95,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Hammer size={14} style={{ color: "#ED135F" }} />
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF" }}>Campaign Builder</span>
                <SkillBadge label="Beta" color="#ED135F" />
              </>
            ) : (
              <>
                <div style={{ width: 28, height: 28, borderRadius: "0.375rem", background: `${skill.color}18`, border: `1px solid ${skill.color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <skill.icon size={14} style={{ color: skill.color }} />
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF" }}>{skill.label}</span>
                <SkillBadge label="Active" color={skill.color} />
              </>
            )}
          </div>
          {/* Credits widget — always visible top right */}
          <div className="flex items-center gap-3">
            <CreditsWidget />
            <Bell size={15} style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        </div>

        {/* Stage content */}
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          {isBuilder ? (
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              {/* Step progress bar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 0,
                marginBottom: "1.5rem",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "0.875rem",
                padding: "0.875rem 1.25rem",
              }}>
                {BUILDER_STEPS.map((step, i) => {
                  const done = builderStep > step.id;
                  const active = builderStep === step.id;
                  return (
                    <>
                      <button
                        key={step.id}
                        onClick={() => setBuilderStep(step.id as BuilderStep)}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.625rem",
                          padding: "0.5rem 0.875rem", borderRadius: "0.625rem",
                          background: active ? "rgba(237,19,95,0.12)" : done ? "rgba(0,179,122,0.08)" : "transparent",
                          border: active ? "1px solid rgba(237,19,95,0.3)" : done ? "1px solid rgba(0,179,122,0.2)" : "1px solid transparent",
                          cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
                          transition: "all 150ms ease",
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: active ? "#ED135F" : done ? "#00B37A" : "rgba(255,255,255,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.6rem", fontWeight: 900, color: active || done ? "#141349" : "rgba(255,255,255,0.4)",
                          flexShrink: 0,
                        }}>
                          {done ? "✓" : step.id}
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: active ? "#FFFFFF" : done ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)" }}>{step.label}</div>
                          <div style={{ fontSize: "0.58rem", color: active ? "#ED135F" : done ? "#00B37A" : "rgba(255,255,255,0.25)", fontWeight: 500 }}>{step.sublabel}</div>
                        </div>
                      </button>
                      {i < BUILDER_STEPS.length - 1 && (
                        <div key={`sep-${i}`} style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", margin: "0 0.25rem" }} />
                      )}
                    </>
                  );
                })}
              </div>

              {/* Step content */}
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "1rem",
                padding: "1.5rem",
                marginBottom: "1rem",
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "1.25rem" }}>
                  <div>
                    <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#ED135F", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>Step {builderStep} of 3</p>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                      {builderStep === 1 ? "Define Campaigns" : builderStep === 2 ? "Configure Ad Sets" : "Creative Library"}
                    </h2>
                    <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", marginTop: "0.25rem", fontWeight: 400 }}>
                      {builderStep === 1 ? "One row per campaign. Tab to move between cells. Paste TSV from spreadsheets." : builderStep === 2 ? "Define targeting, budget, and placement for each ad set." : "Upload and organize your creative assets and copy."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {builderStep > 1 && (
                      <button
                        onClick={() => setBuilderStep((builderStep - 1) as BuilderStep)}
                        style={{
                          padding: "0.5rem 1rem", borderRadius: "0.5rem",
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", fontWeight: 700,
                          fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
                        }}
                      >← Back</button>
                    )}
                    {builderStep < 3 && (
                      <button
                        onClick={() => setBuilderStep((builderStep + 1) as BuilderStep)}
                        style={{
                          padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                          background: "#ED135F", border: "none",
                          color: "#FFFFFF", fontSize: "0.72rem", fontWeight: 800,
                          fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "0.375rem",
                        }}
                      >Next: {BUILDER_STEPS[builderStep].label} →</button>
                    )}
                    {builderStep === 3 && (
                      <button style={{
                        padding: "0.5rem 1.25rem", borderRadius: "0.5rem",
                        background: "#00B37A", border: "none",
                        color: "#141349", fontSize: "0.72rem", fontWeight: 800,
                        fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.375rem",
                      }}><Play size={12} /> Export & Launch</button>
                    )}
                  </div>
                </div>
                {builderStep === 1 && <BuilderStepCampaigns />}
                {builderStep === 2 && <BuilderStepAdSets />}
                {builderStep === 3 && <BuilderStepCreativeLibrary />}
              </div>
            </div>
          ) : (
            /* Skill stage — same as LayoutB */
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div style={{
                background: `linear-gradient(135deg, ${skill.color}12 0%, rgba(20,19,73,0.5) 100%)`,
                border: `1px solid ${skill.color}25`,
                borderRadius: "1rem",
                padding: "1.5rem",
                marginBottom: "1.25rem",
              }}>
                <p style={{ fontSize: "0.62rem", fontWeight: 700, color: skill.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.375rem" }}>{skill.subtitle}</p>
                <h2 style={{ fontSize: "1.375rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>{skill.label}</h2>
                <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.65, maxWidth: 520, fontWeight: 400 }}>{skill.desc}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.875rem", padding: "1.25rem" }}>
                  <h4 style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>Configuration</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {["Business Manager", "Ad Account", "Date Range"].map((lbl) => (
                      <div key={lbl}>
                        <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>{lbl}</label>
                        <div className="pl-select"><span>{lbl === "Date Range" ? "Last 7 Days" : `Select a ${lbl === "Business Manager" ? "BM" : "BM first"}...`}</span><ChevronDown size={12} /></div>
                      </div>
                    ))}
                    <button style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", background: skill.color, color: "#141349", fontSize: "0.75rem", fontWeight: 800, fontFamily: "'Montserrat', sans-serif", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
                      <Play size={12} /> Run {skill.label}
                    </button>
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.875rem", padding: "1.25rem" }}>
                  <h4 style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>Recent Runs</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {["Account #1 · Last 7d", "Account #2 · Last 30d", "Account #1 · Last 14d"].map((label, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.5rem" }}>
                        <div className="flex items-center gap-2">
                          <CheckCircle size={13} style={{ color: "#00B37A", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{label}</span>
                        </div>
                        <button style={{ padding: "0.2rem 0.5rem", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", fontWeight: 600, fontFamily: "'Montserrat', sans-serif", cursor: "pointer" }}>View</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Selector wrapper ────────────────────────────────────────────────────── */
const LAYOUT_OPTIONS = [
  { id: "A", label: "Dashboard Grid", desc: "Skills as cards, builder locked at bottom" },
  { id: "B", label: "Left Rail + Stage", desc: "Sidebar nav, builder in footer" },
  { id: "C", label: "Command Hub", desc: "Tab nav, builder as locked tab" },
  { id: "D", label: "Builder Unlocked", desc: "Left rail + stage, builder active with 3-step wizard" },
];

export default function AppLayouts() {
  const [active, setActive] = useState("A");

  return (
    <div className="flex flex-col h-full">
      {/* Option selector */}
      <div style={{
        background: "rgba(14,13,58,0.9)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0.5rem 1.25rem",
        display: "flex", alignItems: "center", gap: "0.625rem",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginRight: "0.25rem" }}>
          App Layout:
        </span>
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setActive(opt.id)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.3rem 0.875rem", borderRadius: 999,
              background: active === opt.id ? "rgba(237,19,95,0.15)" : "rgba(255,255,255,0.04)",
              border: active === opt.id ? "1px solid rgba(237,19,95,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: active === opt.id ? "#ED135F" : "rgba(255,255,255,0.45)",
              fontSize: "0.72rem", fontWeight: active === opt.id ? 700 : 500,
              fontFamily: "'Montserrat', sans-serif",
              cursor: "pointer", transition: "all 150ms ease",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              background: active === opt.id ? "#ED135F" : "rgba(255,255,255,0.1)",
              color: active === opt.id ? "#FFFFFF" : "rgba(255,255,255,0.4)",
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

      {/* Active layout */}
      <div className="flex-1 overflow-hidden">
        {active === "A" && <LayoutA />}
        {active === "B" && <LayoutB />}
        {active === "C" && <LayoutC />}
        {active === "D" && <LayoutD />}
      </div>
    </div>
  );
}
