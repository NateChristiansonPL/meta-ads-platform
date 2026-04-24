/**
 * Layout C — "Workbench" (Left Nav + Dominant Center Stage)
 * Design: Narrow left sidebar (64px collapsed / 220px expanded), builder is home/default
 * Typography: Instrument Serif for page titles, Geist for body
 * Color: Slate sidebar (#1C1C1E), off-white builder area, blue-violet primary
 */

import { useState } from "react";
import {
  BarChart2, Zap, RefreshCw, Search, Users,
  ChevronRight, ChevronLeft, Plus, Play,
  Settings, Bell, HelpCircle, Hammer, ChevronDown
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Campaigns" },
  { id: 2, label: "Ad Sets" },
  { id: 3, label: "Creative Library" },
  { id: 4, label: "Ads" },
  { id: 5, label: "Export & Launch" },
];

const SKILLS = [
  { id: "weekly", icon: BarChart2, label: "Weekly Optimization", sub: "Breakdown-level insights", color: "oklch(0.72 0.16 200)" },
  { id: "perf", icon: Zap, label: "Performance Insights", sub: "KPI-anchored analysis", color: "oklch(0.78 0.18 75)" },
  { id: "lifecycle", icon: RefreshCw, label: "Creative Lifecycle", sub: "Fatigue detection", color: "oklch(0.70 0.18 155)" },
  { id: "audit", icon: Search, label: "Structural Audit", sub: "Andromeda account audit", color: "oklch(0.68 0.20 30)" },
  { id: "overlap", icon: Users, label: "Audience Overlap", sub: "Overlap & wasted spend", color: "oklch(0.58 0.22 290)" },
];

const MOCK_ROWS = [
  { id: 1, status: "Active", name: "Brand — Awareness — Q2 2026", objective: "Traffic", cap: "$500", cbo: true },
  { id: 2, status: "Paused", name: "Retargeting — Conversion — Q2 2026", objective: "Conversions", cap: "$200", cbo: false },
];

export default function LayoutC() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeView, setActiveView] = useState<"builder" | string>("builder");
  const [activeStep, setActiveStep] = useState(1);

  const activeSkill = activeView !== "builder" ? SKILLS.find(s => s.id === activeView) : null;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Geist', sans-serif", background: "oklch(0.10 0.005 260)" }}
    >
      {/* ── Left Sidebar ── */}
      <div
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-200"
        style={{
          width: sidebarExpanded ? 220 : 60,
          background: "oklch(0.12 0.008 260)",
          borderRight: "1px solid oklch(1 0 0 / 8%)",
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-3 py-3 shrink-0"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)", height: 52 }}
        >
          {sidebarExpanded ? (
            <>
              <div className="flex items-center gap-2">
                <div style={{
                  width: 26, height: 26, borderRadius: "0.375rem",
                  background: "oklch(0.58 0.22 290)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ color: "white", fontSize: "0.65rem", fontWeight: 800 }}>M</span>
                </div>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "oklch(0.93 0.005 65)", letterSpacing: "-0.01em" }}>
                  Meta Ads
                </span>
              </div>
              <button
                onClick={() => setSidebarExpanded(false)}
                style={{ color: "oklch(0.45 0.01 260)", background: "none", border: "none", cursor: "pointer" }}
              >
                <ChevronLeft size={15} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarExpanded(true)}
              style={{
                width: 26, height: 26, borderRadius: "0.375rem",
                background: "oklch(0.58 0.22 290)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", border: "none", margin: "0 auto",
              }}
            >
              <span style={{ color: "white", fontSize: "0.65rem", fontWeight: 800 }}>M</span>
            </button>
          )}
        </div>

        {/* Campaign Builder nav item */}
        <div style={{ padding: sidebarExpanded ? "0.75rem 0.5rem 0.5rem" : "0.75rem 0.25rem 0.5rem" }}>
          <button
            onClick={() => setActiveView("builder")}
            style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              width: "100%", padding: sidebarExpanded ? "0.5rem 0.625rem" : "0.5rem",
              borderRadius: "0.5rem",
              background: activeView === "builder" ? "oklch(0.58 0.22 290 / 15%)" : "transparent",
              border: activeView === "builder" ? "1px solid oklch(0.58 0.22 290 / 30%)" : "1px solid transparent",
              cursor: "pointer", transition: "all 150ms ease",
              justifyContent: sidebarExpanded ? "flex-start" : "center",
            }}
          >
            <Hammer size={16} style={{ color: activeView === "builder" ? "oklch(0.58 0.22 290)" : "oklch(0.60 0.015 260)", flexShrink: 0 }} />
            {sidebarExpanded && (
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: activeView === "builder" ? "oklch(0.93 0.005 65)" : "oklch(0.70 0.015 260)" }}>
                  Campaign Builder
                </div>
                <div style={{ fontSize: "0.62rem", color: "oklch(0.45 0.01 260)", marginTop: 1 }}>
                  Build & launch campaigns
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Divider + Skills section */}
        <div style={{ padding: sidebarExpanded ? "0 0.5rem" : "0 0.25rem" }}>
          {sidebarExpanded ? (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.25rem 0.625rem", marginBottom: "0.25rem",
            }}>
              <div style={{ flex: 1, height: 1, background: "oklch(1 0 0 / 8%)" }} />
              <span style={{ fontSize: "0.58rem", color: "oklch(0.40 0.01 260)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                Skills
              </span>
              <div style={{ flex: 1, height: 1, background: "oklch(1 0 0 / 8%)" }} />
            </div>
          ) : (
            <div style={{ height: 1, background: "oklch(1 0 0 / 8%)", margin: "0.5rem 0.25rem" }} />
          )}

          {SKILLS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setActiveView(skill.id)}
              title={!sidebarExpanded ? skill.label : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                width: "100%", padding: sidebarExpanded ? "0.4rem 0.625rem" : "0.4rem",
                borderRadius: "0.375rem",
                background: activeView === skill.id ? `${skill.color}12` : "transparent",
                border: "1px solid transparent",
                cursor: "pointer", transition: "all 150ms ease",
                justifyContent: sidebarExpanded ? "flex-start" : "center",
                marginBottom: "0.125rem",
              }}
            >
              <skill.icon size={15} style={{ color: activeView === skill.id ? skill.color : "oklch(0.50 0.01 260)", flexShrink: 0 }} />
              {sidebarExpanded && (
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: activeView === skill.id ? 600 : 400, color: activeView === skill.id ? "oklch(0.88 0.005 65)" : "oklch(0.60 0.015 260)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {skill.label}
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "oklch(0.42 0.01 260)", marginTop: 1 }}>
                    {skill.sub}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="mt-auto" style={{ borderTop: "1px solid oklch(1 0 0 / 8%)", padding: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: sidebarExpanded ? "flex-end" : "center", gap: "0.25rem" }}>
            <button style={{ color: "oklch(0.45 0.01 260)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}><Settings size={14} /></button>
            <button style={{ color: "oklch(0.45 0.01 260)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}><Bell size={14} /></button>
            <button style={{ color: "oklch(0.45 0.01 260)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}><HelpCircle size={14} /></button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeView === "builder" ? (
          /* ── Campaign Builder View ── */
          <>
            {/* Step progress bar */}
            <div
              className="flex items-center px-6 py-0 shrink-0"
              style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)", background: "oklch(0.11 0.006 260)", height: 52 }}
            >
              <div className="flex items-center gap-0 flex-1">
                {STEPS.map((step, i) => (
                  <div key={step.id} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? "1" : "0" }}>
                    <button
                      onClick={() => setActiveStep(step.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
                        background: activeStep === step.id ? "oklch(0.58 0.22 290 / 15%)" : "transparent",
                        border: activeStep === step.id ? "1px solid oklch(0.58 0.22 290 / 35%)" : "1px solid transparent",
                        color: activeStep === step.id ? "oklch(0.93 0.005 65)" : "oklch(0.50 0.01 260)",
                        fontSize: "0.75rem", fontWeight: activeStep === step.id ? 600 : 400,
                        cursor: "pointer", transition: "all 150ms ease", whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: 999,
                        background: activeStep === step.id ? "oklch(0.58 0.22 290)" : "oklch(1 0 0 / 8%)",
                        color: activeStep === step.id ? "white" : "oklch(0.45 0.01 260)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.6rem", fontWeight: 700, flexShrink: 0,
                      }}>
                        {step.id}
                      </span>
                      {step.label}
                    </button>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 1, background: "oklch(1 0 0 / 8%)", minWidth: 16 }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div style={{
                  padding: "0.2rem 0.5rem", borderRadius: "0.25rem",
                  background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 8%)",
                  fontSize: "0.65rem", color: "oklch(0.50 0.01 260)",
                }}>
                  Mode: <span style={{ color: "oklch(0.58 0.22 290)", fontWeight: 600 }}>Full Build</span>
                </div>
              </div>
            </div>

            {/* Builder header */}
            <div
              className="flex items-start justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}
            >
              <div>
                <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1.5rem", color: "oklch(0.93 0.005 65)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                  {STEPS[activeStep - 1].label}
                </h1>
                <p style={{ fontSize: "0.72rem", color: "oklch(0.48 0.01 260)", marginTop: 4 }}>
                  One row per campaign. Tab to move between cells. Enter to add a row. Paste TSV from spreadsheets.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.4rem 0.75rem", borderRadius: "0.375rem",
                  background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)",
                  color: "oklch(0.70 0.005 65)", fontSize: "0.75rem", cursor: "pointer",
                }}>
                  <Plus size={13} /> Add Row
                </button>
                <button style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.4rem 0.75rem", borderRadius: "0.375rem",
                  background: "oklch(0.58 0.22 290)", border: "none",
                  color: "white", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
                }}>
                  <Plus size={13} /> Add 5 Rows
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto" style={{ padding: "1rem 1.5rem" }}>
              <table className="cb-table" style={{ minWidth: 750 }}>
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
                        color: "oklch(0.58 0.22 290)", fontSize: "0.72rem",
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
              style={{ borderTop: "1px solid oklch(1 0 0 / 8%)", background: "oklch(0.11 0.006 260)" }}
            >
              <div className="flex items-center gap-5">
                {[{ label: "Campaigns", val: "0" }, { label: "Ad Sets", val: "1" }, { label: "Ads", val: "0" }].map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "oklch(0.93 0.005 65)" }}>{s.val}</span>
                    <span style={{ fontSize: "0.65rem", color: "oklch(0.45 0.01 260)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
              <button style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.4rem 1rem", borderRadius: "0.375rem",
                background: "oklch(0.58 0.22 290)", border: "none",
                color: "white", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
              }}>
                <Play size={12} /> Launch Campaign
              </button>
            </div>
          </>
        ) : activeSkill ? (
          /* ── Skill View ── */
          <div className="flex-1 overflow-auto">
            {/* Skill header */}
            <div
              className="px-8 py-6 shrink-0"
              style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setActiveView("builder")}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.25rem",
                    color: "oklch(0.50 0.01 260)", fontSize: "0.72rem",
                    background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={13} /> Builder
                </button>
                <ChevronRight size={12} style={{ color: "oklch(0.35 0.01 260)" }} />
                <span style={{ fontSize: "0.72rem", color: activeSkill.color }}>{activeSkill.label}</span>
              </div>
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1.75rem", color: "oklch(0.93 0.005 65)", letterSpacing: "-0.01em", marginTop: "0.5rem" }}>
                {activeSkill.label}
              </h1>
              <p style={{ fontSize: "0.75rem", color: "oklch(0.50 0.01 260)", marginTop: "0.375rem", maxWidth: 560, lineHeight: 1.6 }}>
                {activeSkill.sub}
              </p>
            </div>

            {/* Two-column skill layout */}
            <div className="flex gap-0" style={{ padding: "2rem 2rem" }}>
              {/* Left: Config */}
              <div style={{ flex: "0 0 380px", marginRight: "2rem" }}>
                <h2 style={{ fontSize: "0.72rem", fontWeight: 600, color: "oklch(0.50 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                  Account Selection
                </h2>
                {["Business Manager", "Ad Account", "Campaigns"].map((field) => (
                  <div key={field} style={{ marginBottom: "0.875rem" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "oklch(0.65 0.015 260)", marginBottom: "0.375rem", fontWeight: 500 }}>
                      {field}
                    </label>
                    <div style={{
                      padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                      background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 10%)",
                      color: "oklch(0.40 0.01 260)", fontSize: "0.75rem",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span>Select a {field}...</span>
                      <ChevronDown size={13} />
                    </div>
                  </div>
                ))}

                <h2 style={{ fontSize: "0.72rem", fontWeight: 600, color: "oklch(0.50 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", marginTop: "1.5rem" }}>
                  Analysis Period
                </h2>
                <div style={{ marginBottom: "0.875rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "oklch(0.65 0.015 260)", marginBottom: "0.375rem", fontWeight: 500 }}>
                    Date Range
                  </label>
                  <div style={{
                    padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                    background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 10%)",
                    color: "oklch(0.80 0.005 65)", fontSize: "0.75rem",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span>Last 7 Days</span>
                    <ChevronDown size={13} />
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "oklch(0.65 0.015 260)", marginBottom: "0.375rem", fontWeight: 500 }}>
                    Additional Instructions <span style={{ color: "oklch(0.40 0.01 260)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{
                    padding: "0.625rem 0.75rem", borderRadius: "0.375rem",
                    background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 10%)",
                    color: "oklch(0.35 0.01 260)", fontSize: "0.75rem",
                    height: 80,
                  }}>
                    Any extra context or focus areas for this analysis run...
                  </div>
                </div>

                <button style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                  padding: "0.5rem 1.25rem", borderRadius: "0.375rem",
                  background: activeSkill.color, border: "none",
                  color: "oklch(0.10 0.005 260)", fontSize: "0.78rem",
                  cursor: "pointer", fontWeight: 700, width: "100%",
                }}>
                  <Play size={13} /> Run {activeSkill.label}
                </button>
                <p style={{ fontSize: "0.65rem", color: "oklch(0.40 0.01 260)", textAlign: "center", marginTop: "0.5rem" }}>
                  Select an ad account to enable
                </p>
              </div>

              {/* Right: Output placeholder */}
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "0.72rem", fontWeight: 600, color: "oklch(0.50 0.01 260)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                  Output
                </h2>
                <div style={{
                  height: 320, borderRadius: "0.75rem",
                  background: "oklch(1 0 0 / 3%)", border: "1px dashed oklch(1 0 0 / 12%)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem",
                }}>
                  <activeSkill.icon size={28} style={{ color: `${activeSkill.color}50` }} />
                  <p style={{ fontSize: "0.78rem", color: "oklch(0.40 0.01 260)", textAlign: "center", maxWidth: 240, lineHeight: 1.6 }}>
                    Run the analysis to see results here. Output will appear as a structured report.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
