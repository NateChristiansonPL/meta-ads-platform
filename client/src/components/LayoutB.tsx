/**
 * Layout B — "Mission Control" (Top-Bar + Full Canvas)
 * Design: Deep navy bg, Campaign Builder fills entire canvas, Skills as floating panels from top bar
 * Typography: Space Grotesk for UI, JetBrains Mono for data
 * Color: Deep navy (#0A0E1A), cyan accents, green for active states
 */

import { useState } from "react";
import {
  BarChart2, Zap, RefreshCw, Search, Users,
  ChevronRight, Plus, Play, X, Settings, Bell,
  ChevronDown
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Campaigns" },
  { id: 2, label: "Ad Sets" },
  { id: 3, label: "Creative Library" },
  { id: 4, label: "Ads" },
  { id: 5, label: "Export & Launch" },
];

const SKILLS = [
  { id: "weekly", icon: BarChart2, label: "Weekly Opt.", fullLabel: "Weekly Optimization", sub: "Breakdown-level Meta Ads performance analysis with statistical significance testing and impact-ranked recommendations.", badge: 3, color: "oklch(0.72 0.16 200)" },
  { id: "perf", icon: Zap, label: "Perf. Insights", fullLabel: "Performance Insights", sub: "KPI-anchored Meta Ads performance analysis with placement conversion data, budget pacing, and lifecycle enrichment.", badge: 0, color: "oklch(0.78 0.18 75)" },
  { id: "lifecycle", icon: RefreshCw, label: "Creative Lifecycle", fullLabel: "Creative Lifecycle", sub: "Creative fatigue detection using CDR with Beta-Binomial significance testing, BOCPD, CUSUM, EWMA, and Frequency-CPM elasticity.", badge: 1, color: "oklch(0.70 0.18 155)" },
  { id: "audit", icon: Search, label: "Struct. Audit", fullLabel: "Structural Audit", sub: "Andromeda-focused Meta Ads structural audit covering Data Infrastructure, Signal Density, Creative Velocity, and more.", badge: 0, color: "oklch(0.68 0.20 30)" },
  { id: "overlap", icon: Users, label: "Audience Overlap", fullLabel: "Audience Overlap & Wasted Spend", sub: "Pairwise audience overlap analysis using dual-method cross-validation, with KPI-aware wasted spend estimation per ad set.", badge: 0, color: "oklch(0.58 0.22 290)" },
];

const MOCK_ROWS = [
  { id: 1, status: "Active", name: "Brand — Awareness — Q2 2026", objective: "Traffic", cap: "$500", cbo: true },
  { id: 2, status: "Paused", name: "Retargeting — Conversion — Q2 2026", objective: "Conversions", cap: "$200", cbo: false },
  { id: 3, status: "Active", name: "Prospecting — TOFU — Q2 2026", objective: "Reach", cap: "$350", cbo: true },
];

export default function LayoutB() {
  const [activeStep, setActiveStep] = useState(1);
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const toggleSkill = (id: string) => {
    setOpenSkill(prev => prev === id ? null : id);
    setAccountOpen(false);
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontFamily: "'Space Grotesk', sans-serif", background: "oklch(0.09 0.008 255)" }}
    >
      {/* ── Top Bar (48px) ── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: 48,
          background: "oklch(0.12 0.01 255)",
          borderBottom: "1px solid oklch(1 0 0 / 8%)",
          position: "relative",
          zIndex: 50,
        }}
      >
        {/* Left: Logo + breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: "0.375rem",
              background: "oklch(0.55 0.22 264)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontSize: "0.7rem", fontWeight: 800 }}>M</span>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "oklch(0.93 0.005 65)", letterSpacing: "-0.01em" }}>
              Meta Ads
            </span>
          </div>
          <ChevronRight size={13} style={{ color: "oklch(0.35 0.01 260)" }} />
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "oklch(0.72 0.16 200)" }}>
            Campaign Builder
          </span>
        </div>

        {/* Center: Step breadcrumb */}
        <div className="flex items-center gap-1" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveStep(step.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  padding: "0.2rem 0.6rem", borderRadius: "999px",
                  background: activeStep === step.id ? "oklch(0.72 0.16 200 / 15%)" : "transparent",
                  border: activeStep === step.id ? "1px solid oklch(0.72 0.16 200 / 40%)" : "1px solid transparent",
                  color: activeStep === step.id ? "oklch(0.72 0.16 200)" : "oklch(0.50 0.01 260)",
                  fontSize: "0.7rem", fontWeight: activeStep === step.id ? 600 : 400,
                  cursor: "pointer", transition: "all 150ms ease",
                }}
              >
                <span style={{ opacity: 0.6, fontSize: "0.6rem" }}>{step.id}</span>
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <div style={{ width: 16, height: 1, background: "oklch(1 0 0 / 10%)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Right: Account selector + Skill icons */}
        <div className="flex items-center gap-1">
          {/* Account selector */}
          <button
            onClick={() => { setAccountOpen(!accountOpen); setOpenSkill(null); }}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.25rem 0.625rem", borderRadius: "0.375rem",
              background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.65 0.015 260)", fontSize: "0.72rem", cursor: "pointer",
              marginRight: "0.5rem",
            }}
          >
            Select account <ChevronDown size={12} />
          </button>

          {/* Skill icon buttons */}
          {SKILLS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => toggleSkill(skill.id)}
              title={skill.fullLabel}
              style={{
                position: "relative",
                width: 32, height: 32, borderRadius: "0.375rem",
                background: openSkill === skill.id ? `${skill.color}20` : "transparent",
                border: openSkill === skill.id ? `1px solid ${skill.color}50` : "1px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 150ms ease",
              }}
            >
              <skill.icon size={15} style={{ color: openSkill === skill.id ? skill.color : "oklch(0.55 0.015 260)" }} />
              {skill.badge > 0 && (
                <span style={{
                  position: "absolute", top: 2, right: 2,
                  width: 8, height: 8, borderRadius: 999,
                  background: "oklch(0.78 0.18 75)",
                  border: "1px solid oklch(0.09 0.008 255)",
                }} />
              )}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: "oklch(1 0 0 / 10%)", margin: "0 0.25rem" }} />
          <button style={{ color: "oklch(0.50 0.01 260)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}><Settings size={15} /></button>
          <button style={{ color: "oklch(0.50 0.01 260)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}><Bell size={15} /></button>
        </div>
      </div>

      {/* ── Floating Skill Panels ── */}
      {openSkill && (() => {
        const skill = SKILLS.find(s => s.id === openSkill)!;
        return (
          <div
            style={{
              position: "fixed", top: 56, right: 16, width: 380,
              background: "oklch(0.14 0.01 255)",
              border: `1px solid ${skill.color}30`,
              borderRadius: "0.75rem",
              boxShadow: `0 20px 60px oklch(0 0 0 / 60%), 0 0 0 1px ${skill.color}15`,
              backdropFilter: "blur(20px)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div style={{
              padding: "1rem 1.25rem 0.875rem",
              borderBottom: `1px solid ${skill.color}20`,
              background: `${skill.color}08`,
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div style={{
                    width: 32, height: 32, borderRadius: "0.5rem",
                    background: `${skill.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <skill.icon size={16} style={{ color: skill.color }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "oklch(0.93 0.005 65)" }}>
                      {skill.fullLabel}
                    </h3>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "0.25rem",
                      background: "oklch(1 0 0 / 6%)", padding: "0.1rem 0.4rem",
                      borderRadius: "0.25rem", marginTop: 2,
                    }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "oklch(0.50 0.01 260)" }}>
                        pl-{skill.id}-v3
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpenSkill(null)}
                  style={{ color: "oklch(0.45 0.01 260)", background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "oklch(0.50 0.01 260)", marginTop: "0.625rem", lineHeight: 1.6 }}>
                {skill.sub}
              </p>
            </div>

            {/* Panel body */}
            <div style={{ padding: "1rem 1.25rem" }}>
              {/* Account Selection */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "oklch(0.45 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                  Account Selection
                </div>
                {["Business Manager", "Ad Account"].map((field) => (
                  <div key={field} style={{ marginBottom: "0.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "oklch(0.65 0.015 260)", marginBottom: "0.25rem" }}>
                      {field}
                    </label>
                    <div style={{
                      padding: "0.4rem 0.625rem", borderRadius: "0.375rem",
                      background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 10%)",
                      color: "oklch(0.40 0.01 260)", fontSize: "0.72rem",
                      fontFamily: "'JetBrains Mono', monospace",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span>Select a {field}...</span>
                      <ChevronDown size={12} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Analysis Period */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "oklch(0.45 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                  Analysis Period
                </div>
                <div style={{
                  padding: "0.4rem 0.625rem", borderRadius: "0.375rem",
                  background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 10%)",
                  color: "oklch(0.80 0.005 65)", fontSize: "0.72rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>Last 7 Days</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              <button
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                  padding: "0.5rem 1rem", borderRadius: "0.375rem",
                  background: skill.color, border: "none",
                  color: "oklch(0.10 0.005 260)", fontSize: "0.78rem",
                  fontFamily: "'Space Grotesk', sans-serif",
                  cursor: "pointer", fontWeight: 700, width: "100%",
                }}
              >
                <Play size={13} /> Run {skill.fullLabel}
              </button>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", color: "oklch(0.40 0.01 260)", textAlign: "center", marginTop: "0.5rem" }}>
                Select an ad account to enable
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Campaign Builder Full Canvas ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Builder sub-header */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)", background: "oklch(0.10 0.008 255)" }}
        >
          <div>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "oklch(0.93 0.005 65)", letterSpacing: "-0.02em" }}>
              {STEPS[activeStep - 1].label}
            </h1>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "oklch(0.45 0.01 260)", marginTop: 2 }}>
              One row per campaign · Tab to move between cells · Enter to add a row
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.25rem 0.75rem", borderRadius: "0.375rem",
              background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 8%)",
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "oklch(0.50 0.01 260)" }}>Mode:</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "oklch(0.72 0.16 200)", fontWeight: 600 }}>Full Build</span>
            </div>
            <button style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
              background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.75 0.005 65)", fontSize: "0.75rem", cursor: "pointer",
            }}>
              <Plus size={13} /> Add Row
            </button>
            <button style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
              background: "oklch(0.72 0.16 200)", border: "none",
              color: "oklch(0.09 0.008 255)", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700,
            }}>
              <Plus size={13} /> Add 5 Rows
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto" style={{ padding: "1.25rem 1.5rem" }}>
          <table className="cb-table" style={{ minWidth: 800, fontFamily: "'JetBrains Mono', monospace" }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>STATUS</th>
                <th>CAMPAIGN NAME *</th>
                <th>OBJECTIVE *</th>
                <th>SPECIAL AD CATEGORY</th>
                <th>SPEND CAP ($)</th>
                <th>CBO</th>
                <th>CAMPAIGN ID (WRITE-BACK)</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ROWS.map((row) => (
                <tr key={row.id}>
                  <td style={{ color: "oklch(0.40 0.01 260)", fontSize: "0.7rem" }}>{row.id}</td>
                  <td>
                    <span className={row.status === "Active" ? "badge-active" : "badge-paused"}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.72rem", color: "oklch(0.80 0.005 65)" }}>{row.name}</td>
                  <td>
                    <div style={{
                      padding: "0.2rem 0.5rem", borderRadius: "0.25rem",
                      background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 8%)",
                      fontSize: "0.72rem", color: "oklch(0.80 0.005 65)", display: "inline-block",
                    }}>
                      {row.objective}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.72rem", color: "oklch(0.45 0.01 260)" }}>NONE</td>
                  <td style={{ fontSize: "0.72rem", color: "oklch(0.80 0.005 65)" }}>{row.cap}</td>
                  <td>
                    <div style={{
                      width: 28, height: 16, borderRadius: 999,
                      background: row.cbo ? "oklch(0.70 0.18 155)" : "oklch(1 0 0 / 15%)",
                      position: "relative",
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: 999, background: "white",
                        position: "absolute", top: 2, left: row.cbo ? 14 : 2,
                      }} />
                    </div>
                  </td>
                  <td style={{ fontSize: "0.65rem", color: "oklch(0.40 0.01 260)", fontStyle: "italic" }}>
                    auto-populated
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={8}>
                  <button style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    color: "oklch(0.72 0.16 200)", fontSize: "0.72rem",
                    background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0",
                  }}>
                    <Plus size={12} /> Add row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div
          className="flex items-center justify-between px-6 py-2 shrink-0"
          style={{ borderTop: "1px solid oklch(1 0 0 / 6%)", background: "oklch(0.10 0.008 255)" }}
        >
          <div className="flex items-center gap-5">
            {[{ label: "Campaigns", val: "0" }, { label: "Ad Sets", val: "1" }, { label: "Ads", val: "0" }].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.875rem", fontWeight: 700, color: "oklch(0.93 0.005 65)" }}>{s.val}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "oklch(0.45 0.01 260)" }}>{s.label}</span>
              </div>
            ))}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "oklch(0.40 0.01 260)" }}>
              0 / 1 rows filled
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.875rem", borderRadius: "0.375rem",
              background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.65 0.015 260)", fontSize: "0.75rem", cursor: "pointer",
            }}>
              Sessions
            </button>
            <button style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.875rem", borderRadius: "0.375rem",
              background: "oklch(0.72 0.16 200)", border: "none",
              color: "oklch(0.09 0.008 255)", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700,
            }}>
              <Play size={12} /> Launch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
