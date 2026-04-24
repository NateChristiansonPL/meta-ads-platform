/**
 * Home — Pathlabs Intelligence Platform Mockup
 * Routes between: Login screens (3 options) and App layouts (3 options)
 * Font: Montserrat | Colors: Pathlabs brand palette
 */

import { useState } from "react";
import LoginScreens from "@/components/LoginScreens";
import AppLayouts from "@/components/AppLayouts";

export type View = "login" | "app";

export default function Home() {
  const [view, setView] = useState<View>("login");

  return (
    <div className="h-screen overflow-hidden" style={{ fontFamily: "'Montserrat', sans-serif", background: "#141349" }}>
      {/* ── Top switcher ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "rgba(14,13,58,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 1.25rem",
          height: 48,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Mockup Mode
          </span>
        </div>

        <div className="flex items-center gap-1" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "0.2rem" }}>
          {[
            { id: "login" as View, label: "Login Screens" },
            { id: "app" as View, label: "App Layouts" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              style={{
                padding: "0.3rem 1rem",
                borderRadius: 999,
                fontSize: "0.72rem",
                fontWeight: 700,
                fontFamily: "'Montserrat', sans-serif",
                background: view === tab.id ? "#00BEEF" : "transparent",
                color: view === tab.id ? "#141349" : "rgba(255,255,255,0.5)",
                border: "none",
                cursor: "pointer",
                transition: "all 150ms ease",
                letterSpacing: "0.02em",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
          Components not functional
        </div>
      </div>

      {/* ── Content (offset for fixed top bar) ── */}
      <div style={{ paddingTop: 48, height: "100%" }}>
        {view === "login" ? <LoginScreens /> : <AppLayouts />}
      </div>
    </div>
  );
}
