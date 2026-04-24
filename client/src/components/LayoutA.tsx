/**
 * Layout A — "Command Center" (Split-Stage)
 * Design: Industrial dark UI, Campaign Builder 70% left, Skills collapsible right-rail 30%
 * Typography: IBM Plex Mono for data, IBM Plex Sans for headings
 * Color: Near-black bg, electric blue accents, amber for skill alerts
 */

import { useState } from "react";
import {
  BarChart2, Zap, RefreshCw, Search, Users,
  ChevronRight, ChevronLeft, Plus, Play,
  ArrowRight, Settings, Bell, HelpCircle
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Campaigns" },
  { id: 2, label: "Ad Sets" },
  { id: 3, label: "Creative Library" },
  { id: 4, label: "Ads" },
  { id: 5, label: "Export & Launch" },
];

const SKILLS = [
  {
    id: "weekly",
    icon: BarChart2,
    label: "Weekly Optimization",
    sub: "Breakdown-level insights",
    badge: "3",
    color: "oklch(0.72 0.16 200)",
  },
  {
    id: "perf",
    icon: Zap,
    label: "Performance Insights",
    sub: "KPI-anchored analysis",
    badge: null,
    color: "oklch(0.78 0.18 75)",
  },
  {
    id: "lifecycle",
    icon: RefreshCw,
    label: "Creative Lifecycle",
    sub: "Fatigue detection",
    badge: "1",
    color: "oklch(0.70 0.18 155)",
  },
  {
    id: "audit",
    icon: Search,
    label: "Structural Audit",
    sub: "Andromeda account audit",
    badge: null,
    color: "oklch(0.68 0.20 30)",
  },
  {
    id: "overlap",
    icon: Users,
    label: "Audience Overlap",
    sub: "Overlap & wasted spend",
    badge: null,
    color: "oklch(0.58 0.22 290)",
  },
];

const MOCK_ROWS = [
  { id: 1, status: "Active", name: "Brand — Awareness — Q2 2026", objective: "Traffic", cap: "$500", cbo: true },
  { id: 2, status: "Paused", name: "Retargeting — Conversion — Q2 2026", objective: "Conversions", cap: "$200", cbo: false },
];

export default function LayoutA() {
  const [activeStep, setActiveStep] = useState(1);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "oklch(0.10 0.005 260)" }}
    >
      {/* ── Campaign Builder (main stage) ── */}
      <div
        className="flex flex-col overflow-hidden transition-all duration-300"
        style={{ flex: skillsOpen ? "0 0 68%" : "1 1 100%", borderRight: "1px solid oklch(1 0 0 / 8%)" }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)", background: "oklch(0.12 0.006 260)", zIndex: 10 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1 rounded"
              style={{ background: "oklch(0.55 0.22 264 / 15%)", border: "1px solid oklch(0.55 0.22 264 / 30%)" }}
            >
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "oklch(0.55 0.22 264)", fontWeight: 600 }}>
                CAMPAIGN BUILDER
              </span>
            </div>
            <ChevronRight size={14} style={{ color: "oklch(0.45 0.01 260)" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "oklch(0.65 0.015 260)" }}>
              Meta Ads
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.65 0.015 260)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem" }}
            >
              MODE: <span style={{ color: "oklch(0.55 0.22 264)", marginLeft: 4 }}>FULL BUILD</span>
            </div>
            <button style={{ color: "oklch(0.55 0.015 260)", padding: "0.25rem" }}><Settings size={15} /></button>
            <button style={{ color: "oklch(0.55 0.015 260)", padding: "0.25rem" }}><Bell size={15} /></button>
            <button style={{ color: "oklch(0.55 0.015 260)", padding: "0.25rem" }}><HelpCircle size={15} /></button>
          </div>
        </div>

        {/* Step navigation */}
        <div
          className="flex items-center gap-1 px-5 py-3 shrink-0 overflow-x-auto"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
        >
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveStep(step.id)}
                className="step-pill"
                style={{
                  background: activeStep === step.id ? "oklch(0.55 0.22 264)" : "oklch(1 0 0 / 6%)",
                  color: activeStep === step.id ? "white" : "oklch(0.58 0.015 260)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "0.7rem",
                  padding: "0.25rem 0.625rem",
                  borderRadius: "999px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <span style={{ opacity: 0.6, fontSize: "0.6rem" }}>{step.id}</span>
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight size={12} style={{ color: "oklch(0.35 0.01 260)" }} />
              )}
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "oklch(0.45 0.01 260)" }}>
              0 / 1 rows filled
            </span>
          </div>
        </div>

        {/* Builder mode sub-nav */}
        <div
          className="flex items-start gap-0 flex-1 overflow-hidden"
          style={{ borderBottom: "none" }}
        >
          <div style={{ width: 180, borderRight: "1px solid oklch(1 0 0 / 8%)", padding: "0.75rem 0", overflowY: "auto" }}>
            <div style={{ padding: "0.25rem 1rem", marginBottom: "0.25rem" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "oklch(0.40 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Build Mode
              </span>
            </div>
            {[
              { label: "Full Build", sub: "Campaigns + ad sets + ads" },
              { label: "Ads Only", sub: "Add ads to existing ad sets" },
              { label: "Update Ads", sub: "Edit creative on live ads" },
            ].map((m, i) => (
              <button
                key={m.label}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.4rem 1rem",
                  background: i === 0 ? "oklch(0.55 0.22 264 / 12%)" : "transparent",
                  borderLeft: i === 0 ? "2px solid oklch(0.55 0.22 264)" : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "0.75rem", color: i === 0 ? "oklch(0.93 0.005 65)" : "oklch(0.60 0.015 260)", fontWeight: i === 0 ? 600 : 400 }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "oklch(0.45 0.01 260)", marginTop: 1 }}>
                  {m.sub}
                </div>
              </button>
            ))}
          </div>

          {/* Sections list */}
          <div style={{ width: 200, borderRight: "1px solid oklch(1 0 0 / 8%)", padding: "0.75rem 0", overflowY: "auto" }}>
            <div style={{ padding: "0.25rem 1rem", marginBottom: "0.25rem" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "oklch(0.40 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Sections
              </span>
            </div>
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.4rem 1rem",
                  background: activeStep === step.id ? "oklch(0.55 0.22 264 / 12%)" : "transparent",
                  borderLeft: activeStep === step.id ? "2px solid oklch(0.55 0.22 264)" : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "oklch(0.40 0.01 260)", width: 12 }}>{step.id}</span>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "0.75rem", color: activeStep === step.id ? "oklch(0.93 0.005 65)" : "oklch(0.65 0.015 260)", fontWeight: activeStep === step.id ? 600 : 400 }}>
                    {step.label}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Main table area */}
          <div className="flex-1 overflow-auto" style={{ padding: "1rem", minWidth: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "0.875rem", fontWeight: 700, color: "oklch(0.93 0.005 65)" }}>
                  {STEPS[activeStep - 1].label}
                </h2>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "oklch(0.50 0.01 260)", marginTop: 2 }}>
                  One row per campaign. Tab to move between cells.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
                    background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)",
                    color: "oklch(0.75 0.005 65)", fontSize: "0.75rem", fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={13} /> Add Row
                </button>
                <button
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
                    background: "oklch(0.55 0.22 264)", border: "none",
                    color: "white", fontSize: "0.75rem", fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: "pointer", fontWeight: 600,
                  }}
                >
                  <Plus size={13} /> Add 5 Rows
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="cb-table" style={{ minWidth: 700 }}>
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
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", color: "oklch(0.40 0.01 260)", fontSize: "0.7rem" }}>{row.id}</td>
                      <td>
                        <span className={row.status === "Active" ? "badge-active" : "badge-paused"}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "oklch(0.80 0.005 65)" }}>
                        {row.name}
                      </td>
                      <td>
                        <div style={{
                          padding: "0.2rem 0.5rem", borderRadius: "0.25rem",
                          background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 8%)",
                          fontSize: "0.72rem", fontFamily: "'IBM Plex Mono', monospace",
                          color: "oklch(0.80 0.005 65)", display: "inline-block",
                        }}>
                          {row.objective}
                        </div>
                      </td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "oklch(0.45 0.01 260)" }}>NONE</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "oklch(0.80 0.005 65)" }}>{row.cap}</td>
                      <td>
                        <div style={{
                          width: 28, height: 16, borderRadius: 999,
                          background: row.cbo ? "oklch(0.70 0.18 155)" : "oklch(1 0 0 / 15%)",
                          position: "relative", cursor: "pointer",
                        }}>
                          <div style={{
                            width: 12, height: 12, borderRadius: 999, background: "white",
                            position: "absolute", top: 2, left: row.cbo ? 14 : 2,
                            transition: "left 150ms ease",
                          }} />
                        </div>
                      </td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "oklch(0.40 0.01 260)", fontStyle: "italic" }}>
                        auto-populated
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8}>
                      <button
                        style={{
                          display: "flex", alignItems: "center", gap: "0.375rem",
                          color: "oklch(0.55 0.22 264)", fontSize: "0.72rem",
                          fontFamily: "'IBM Plex Sans', sans-serif", background: "none", border: "none",
                          cursor: "pointer", padding: "0.25rem 0",
                        }}
                      >
                        <Plus size={12} /> Add row
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div
          className="flex items-center justify-between px-5 py-2 mt-auto shrink-0"
          style={{ borderTop: "1px solid oklch(1 0 0 / 8%)", background: "oklch(0.12 0.006 260)" }}
        >
          <div className="flex items-center gap-4">
            {[
              { label: "Campaigns", val: "0" },
              { label: "Ad Sets", val: "1" },
              { label: "Ads", val: "0" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem", fontWeight: 700, color: "oklch(0.93 0.005 65)" }}>{s.val}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "oklch(0.45 0.01 260)" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <button
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 1rem", borderRadius: "0.375rem",
              background: "oklch(0.55 0.22 264)", border: "none",
              color: "white", fontSize: "0.75rem", fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            <Play size={12} /> Launch Campaign
          </button>
        </div>
      </div>

      {/* ── Skills Right Rail ── */}
      {skillsOpen && (
        <div
          className="flex flex-col overflow-hidden"
          style={{ flex: "0 0 32%", background: "oklch(0.11 0.005 260)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "oklch(0.45 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Skills
            </span>
            <button
              onClick={() => setSkillsOpen(false)}
              style={{ color: "oklch(0.45 0.01 260)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem" }}
            >
              <ChevronRight size={14} /> Collapse
            </button>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ padding: "0.75rem" }}>
            {activeSkill ? (
              <div>
                <button
                  onClick={() => setActiveSkill(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    color: "oklch(0.55 0.22 264)", fontSize: "0.72rem",
                    fontFamily: "'IBM Plex Sans', sans-serif", background: "none", border: "none",
                    cursor: "pointer", marginBottom: "1rem",
                  }}
                >
                  <ChevronLeft size={13} /> Back to Skills
                </button>
                {(() => {
                  const skill = SKILLS.find(s => s.id === activeSkill)!;
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <skill.icon size={16} style={{ color: skill.color }} />
                        <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "0.875rem", fontWeight: 700, color: "oklch(0.93 0.005 65)" }}>
                          {skill.label}
                        </h3>
                      </div>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "oklch(0.50 0.01 260)", marginBottom: "1rem", lineHeight: 1.6 }}>
                        {skill.sub}
                      </p>
                      {/* Mock form fields */}
                      {["Business Manager", "Ad Account", "Date Range"].map((field) => (
                        <div key={field} style={{ marginBottom: "0.75rem" }}>
                          <label style={{ display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "oklch(0.50 0.01 260)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>
                            {field}
                          </label>
                          <div style={{
                            padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                            background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 10%)",
                            color: "oklch(0.45 0.01 260)", fontSize: "0.72rem",
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}>
                            {field === "Date Range" ? "Last 7 Days" : `Select a ${field}...`}
                          </div>
                        </div>
                      ))}
                      <button
                        style={{
                          display: "flex", alignItems: "center", gap: "0.375rem",
                          padding: "0.5rem 1rem", borderRadius: "0.375rem",
                          background: skill.color, border: "none",
                          color: "oklch(0.10 0.005 260)", fontSize: "0.75rem",
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          cursor: "pointer", fontWeight: 700, width: "100%", justifyContent: "center",
                        }}
                      >
                        <Play size={12} /> Run {skill.label}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {SKILLS.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => setActiveSkill(skill.id)}
                    className="skill-card"
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      textAlign: "left", width: "100%", cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: "0.375rem",
                      background: `${skill.color}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <skill.icon size={15} style={{ color: skill.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "oklch(0.88 0.005 65)" }}>
                        {skill.label}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "oklch(0.50 0.01 260)", marginTop: 1 }}>
                        {skill.sub}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {skill.badge && (
                        <span style={{
                          background: "oklch(0.78 0.18 75 / 20%)", color: "oklch(0.78 0.18 75)",
                          border: "1px solid oklch(0.78 0.18 75 / 30%)",
                          padding: "0.1rem 0.4rem", borderRadius: 999,
                          fontSize: "0.6rem", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                        }}>
                          {skill.badge}
                        </span>
                      )}
                      <ArrowRight size={12} style={{ color: "oklch(0.40 0.01 260)" }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed skills toggle */}
      {!skillsOpen && (
        <button
          onClick={() => setSkillsOpen(true)}
          style={{
            position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)",
            background: "oklch(0.18 0.008 260)", border: "1px solid oklch(1 0 0 / 10%)",
            borderRight: "none", borderRadius: "0.5rem 0 0 0.5rem",
            padding: "0.75rem 0.5rem", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
          }}
        >
          <ChevronLeft size={14} style={{ color: "oklch(0.55 0.22 264)" }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem",
            color: "oklch(0.55 0.22 264)", writingMode: "vertical-rl",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Skills
          </span>
        </button>
      )}
    </div>
  );
}
