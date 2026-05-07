/**
 * TweaksPanelAdmin — Floating tweaks popover for the Admin Campaign Builder.
 * Opens from the "UI View" button in the header.
 * Controls: density, friendly labels, advanced columns, dark mode.
 * Scoped to admin builder only.
 */
import { useEffect, useRef } from "react";
import { TweakSettings } from "./PillarHubAdmin";
import { SlidersHorizontal, Check } from "lucide-react";

interface TweaksPanelAdminProps {
  tweaks: TweakSettings;
  onChange: (t: TweakSettings) => void;
  onClose: () => void;
}

export default function TweaksPanelAdmin({
  tweaks,
  onChange,
  onClose,
}: TweaksPanelAdminProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const set = <K extends keyof TweakSettings>(k: K, v: TweakSettings[K]) =>
    onChange({ ...tweaks, [k]: v });

  return (
    <div ref={ref} className="tp-panel">
      <style>{TP_STYLES}</style>

      <div className="tp-header">
        <SlidersHorizontal size={13} style={{ color: "var(--pl-cyan)" }} />
        <span>UI Tweaks</span>
      </div>

      {/* Density */}
      <div className="tp-section">
        <div className="tp-section-label">Row Density</div>
        <div className="tp-seg">
          {(["compact", "comfortable"] as const).map((d) => (
            <button
              key={d}
              className={`tp-seg-btn ${tweaks.density === d ? "tp-seg-btn--on" : ""}`}
              onClick={() => set("density", d)}
            >
              {d === "compact" ? "Compact" : "Comfortable"}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="tp-section">
        <div className="tp-section-label">Display Options</div>
        <div className="tp-toggles">
          <ToggleRow
            label="Plain-language labels"
            hint="Replaces technical field names with friendlier descriptions"
            value={tweaks.friendly}
            onChange={(v) => set("friendly", v)}
          />
          <ToggleRow
            label="Show advanced columns"
            hint="Reveals less-common fields like billing event, attribution model, etc."
            value={tweaks.advanced}
            onChange={(v) => set("advanced", v)}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button className="tp-toggle-row" onClick={() => onChange(!value)}>
      <div className="tp-toggle-text">
        <div className="tp-toggle-label">{label}</div>
        <div className="tp-toggle-hint">{hint}</div>
      </div>
      <div className={`tp-toggle-pill ${value ? "tp-toggle-pill--on" : ""}`}>
        {value && <Check size={9} style={{ color: "#141349" }} />}
      </div>
    </button>
  );
}

const TP_STYLES = `
.tp-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 200;
  width: 280px;
  background: rgba(20,19,73,0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  overflow: hidden;
  font-family: 'Montserrat', system-ui, sans-serif;
  font-size: 12px;
  color: rgba(250,250,250,0.9);
  backdrop-filter: blur(16px);
}
.tp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.tp-section {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tp-section:last-child { border-bottom: none; }
.tp-section-label {
  font-size: 10px;
  font-weight: 700;
  color: rgba(250,250,250,0.4);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.tp-seg {
  display: flex;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.tp-seg-btn {
  flex: 1;
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: rgba(250,250,250,0.5);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.tp-seg-btn:hover { background: rgba(255,255,255,0.06); color: rgba(250,250,250,0.8); }
.tp-seg-btn--on { background: rgba(255,255,255,0.12) !important; color: rgba(250,250,250,0.95) !important; }

.tp-toggles { display: flex; flex-direction: column; gap: 2px; }
.tp-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.12s;
}
.tp-toggle-row:hover { background: rgba(255,255,255,0.05); }
.tp-toggle-text { flex: 1; min-width: 0; }
.tp-toggle-label { font-size: 12px; font-weight: 600; color: rgba(250,250,250,0.9); }
.tp-toggle-hint { font-size: 10px; color: rgba(250,250,250,0.4); margin-top: 2px; line-height: 1.3; }
.tp-toggle-pill {
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.18);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;
}
.tp-toggle-pill--on {
  background: var(--pl-cyan) !important;
  border-color: var(--pl-cyan) !important;
}
`;
