/**
 * Home — Layout Mockup Selector
 * Presents 3 layout options as switchable tabs.
 * Each layout renders full-screen below the selector bar.
 */

import { useState } from "react";
import LayoutA from "@/components/LayoutA";
import LayoutB from "@/components/LayoutB";
import LayoutC from "@/components/LayoutC";

const LAYOUTS = [
  {
    id: "A",
    label: "Option A",
    name: "Command Center",
    desc: "70/30 split — Builder left, Skills collapsible right-rail",
    tag: "Split-Stage",
    tagColor: "oklch(0.55 0.22 264)",
  },
  {
    id: "B",
    label: "Option B",
    name: "Mission Control",
    desc: "Full-canvas Builder — Skills as floating panels from top bar",
    tag: "Top-Bar Float",
    tagColor: "oklch(0.72 0.16 200)",
  },
  {
    id: "C",
    label: "Option C",
    name: "Workbench",
    desc: "Left nav with Builder as home — Skills as sub-pages below divider",
    tag: "Left Nav",
    tagColor: "oklch(0.58 0.22 290)",
  },
];

export default function Home() {
  const [active, setActive] = useState<"A" | "B" | "C">("A");

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "oklch(0.08 0.005 260)" }}>
      {/* ── Layout Selector Bar ── */}
      <div
        style={{
          background: "oklch(0.11 0.008 260)",
          borderBottom: "1px solid oklch(1 0 0 / 10%)",
          padding: "0.625rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexShrink: 0,
          zIndex: 200,
        }}
      >
        <div style={{ marginRight: "0.5rem" }}>
          <span style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "oklch(0.40 0.01 260)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}>
            Layout Options
          </span>
        </div>

        {LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            onClick={() => setActive(layout.id as "A" | "B" | "C")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.375rem 0.875rem",
              borderRadius: "0.5rem",
              background: active === layout.id ? "oklch(1 0 0 / 8%)" : "transparent",
              border: active === layout.id
                ? `1px solid ${layout.tagColor}40`
                : "1px solid oklch(1 0 0 / 6%)",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: "0.25rem",
              background: active === layout.id ? layout.tagColor : "oklch(1 0 0 / 8%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 800,
              color: active === layout.id ? "white" : "oklch(0.50 0.01 260)",
              flexShrink: 0,
              transition: "all 150ms ease",
            }}>
              {layout.id}
            </span>
            <div style={{ textAlign: "left" }}>
              <div style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: active === layout.id ? "oklch(0.93 0.005 65)" : "oklch(0.60 0.015 260)",
                transition: "color 150ms ease",
              }}>
                {layout.name}
              </div>
              <div style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: "0.62rem",
                color: "oklch(0.42 0.01 260)",
                marginTop: 1,
              }}>
                {layout.desc}
              </div>
            </div>
            <span style={{
              marginLeft: "0.25rem",
              padding: "0.1rem 0.4rem",
              borderRadius: 999,
              fontSize: "0.58rem",
              fontWeight: 700,
              background: `${layout.tagColor}18`,
              color: layout.tagColor,
              border: `1px solid ${layout.tagColor}30`,
              whiteSpace: "nowrap",
            }}>
              {layout.tag}
            </span>
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "0.65rem",
            color: "oklch(0.38 0.01 260)",
            fontStyle: "italic",
          }}>
            Layout mockup — components not functional
          </span>
        </div>
      </div>

      {/* ── Active Layout ── */}
      <div className="flex-1 overflow-hidden">
        {active === "A" && <LayoutA />}
        {active === "B" && <LayoutB />}
        {active === "C" && <LayoutC />}
      </div>
    </div>
  );
}
