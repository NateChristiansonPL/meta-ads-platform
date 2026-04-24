/**
 * Campaign Builder — 5-tab spreadsheet-style UI
 * Tabs: Campaigns | Ad Sets | Creative Library | Ads | Export & Launch
 * No backend wiring — UI only
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Key,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  TrendingUp,
  Upload,
  Users,
  Zap,
  X,
  Check,
  AlertTriangle,
  ExternalLink,
  Search,
  Trash2,
  Copy,
  Settings,
  Hammer,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildMode = "full" | "ads-only" | "update";
type TabId = "campaigns" | "ad-sets" | "creative-library" | "ads" | "export";

interface CampaignRow {
  id: string;
  status: "Active" | "Paused";
  name: string;
  objective: string;
  specialAdCategory: string;
  spendCap: string;
  cbo: boolean;
  campaignId: string;
}

interface AdSetRow {
  id: string;
  status: "Active" | "Paused";
  campaign: string;
  name: string;
  budgetType: "Daily" | "Lifetime";
  budget: string;
  start: string;
  end: string;
  optGoal: string;
  convLocation: string;
  placements: string[];
  ageMin: string;
  ageMax: string;
  gender: "All" | "M" | "F";
  location: string;
  audience: string;
}

interface CreativeRow {
  id: string;
  autoId: string;
  assetType: "Static" | "Video";
  dimensions: string[];
  concept: string;
  length: string;
  feedAsset: string;
  storiesAsset: string;
  websiteUrl: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  linkToUtm: string;
}

interface CarouselRow {
  id: string;
  creativeId: string;
  concept: string;
  websiteUrl: string;
  primaryText: string;
  cta: string;
  linkToUtm: string;
  cards: CarouselCard[];
}

interface CarouselCard {
  id: string;
  fileName: string;
  fileHash: string;
  headline: string;
  description: string;
  cardUrl: string;
}

interface AdRow {
  id: string;
  adName: string;
  campaign: string;
  adSet: string;
  creativeId: string;
  status: "Active" | "Paused";
  adId: string;
  previewLink: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function makeCampaign(): CampaignRow {
  return { id: uid(), status: "Paused", name: "", objective: "Traffic", specialAdCategory: "NONE", spendCap: "", cbo: false, campaignId: "" };
}

function makeAdSet(): AdSetRow {
  return { id: uid(), status: "Paused", campaign: "", name: "", budgetType: "Daily", budget: "", start: "", end: "", optGoal: "Landing Page Views", convLocation: "Website", placements: [], ageMin: "18", ageMax: "65", gender: "All", location: "", audience: "" };
}

function makeCreative(): CreativeRow {
  return { id: uid(), autoId: "auto", assetType: "Static", dimensions: ["1:1"], concept: "", length: "", feedAsset: "", storiesAsset: "", websiteUrl: "", headline: "", primaryText: "", description: "", cta: "LEARN MORE", linkToUtm: "" };
}

function makeCarousel(): CarouselRow {
  return { id: uid(), creativeId: `FP-CAROUSEL-${uid().toUpperCase()}`, concept: "", websiteUrl: "", primaryText: "", cta: "LEARN MORE", linkToUtm: "", cards: [makeCard(), makeCard()] };
}

function makeCard(): CarouselCard {
  return { id: uid(), fileName: "", fileHash: "", headline: "", description: "", cardUrl: "" };
}

function makeAd(): AdRow {
  return { id: uid(), adName: "", campaign: "", adSet: "", creativeId: "", status: "Paused", adId: "", previewLink: "" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ value, onChange }: { value: "Active" | "Paused"; onChange: (v: "Active" | "Paused") => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange("Paused")}
        className="px-2 py-0.5 rounded text-xs font-semibold transition-all"
        style={{ background: value === "Paused" ? "rgba(237,19,95,0.15)" : "rgba(255,255,255,0.06)", color: value === "Paused" ? "#ED135F" : "rgba(255,255,255,0.4)", border: `1px solid ${value === "Paused" ? "rgba(237,19,95,0.3)" : "transparent"}` }}
      >
        Paused
      </button>
      <button
        onClick={() => onChange("Active")}
        className="px-2 py-0.5 rounded text-xs font-semibold transition-all"
        style={{ background: value === "Active" ? "rgba(0,179,122,0.15)" : "rgba(255,255,255,0.06)", color: value === "Active" ? "#00B37A" : "rgba(255,255,255,0.4)", border: `1px solid ${value === "Active" ? "rgba(0,179,122,0.3)" : "transparent"}` }}
      >
        Active
      </button>
    </div>
  );
}

function CellInput({ value, onChange, placeholder, mono, readOnly }: { value: string; onChange?: (v: string) => void; placeholder?: string; mono?: boolean; readOnly?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className="w-full bg-transparent text-xs outline-none"
      style={{ color: readOnly ? "rgba(255,255,255,0.3)" : "#FAFAFA", fontFamily: mono ? "'JetBrains Mono', monospace" : "'Montserrat', sans-serif", fontSize: "0.72rem", cursor: readOnly ? "default" : "text" }}
    />
  );
}

function CellSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent text-xs outline-none cursor-pointer"
      style={{ color: "#FAFAFA", fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", background: "transparent" }}
    >
      {options.map((o) => (
        <option key={o} value={o} style={{ background: "#141349", color: "#FAFAFA" }}>{o}</option>
      ))}
    </select>
  );
}

function ColHeader({ label, required, width }: { label: string; required?: boolean; width?: number }) {
  return (
    <th
      className="px-3 py-2 text-left font-bold whitespace-nowrap"
      style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)", borderRight: "1px solid rgba(255,255,255,0.06)", minWidth: width || 120 }}
    >
      {label}{required && <span style={{ color: "#ED135F" }}>*</span>}
    </th>
  );
}

function Cell({ children, width, center }: { children: React.ReactNode; width?: number; center?: boolean }) {
  return (
    <td
      className="px-3 py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.04)", minWidth: width || 120, verticalAlign: "middle", textAlign: center ? "center" : "left" }}
    >
      {children}
    </td>
  );
}

function AddRowBar({ onAdd, onAdd5, filled, total }: { onAdd: () => void; onAdd5: () => void; filled: number; total: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={onAdd} className="flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: "#00BEEF" }}>
        <Plus size={12} /> Add row
      </button>
      <button onClick={onAdd5} className="flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: "#00BEEF" }}>
        <Plus size={12} /> Add 5 rows
      </button>
      <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
        {filled} / {total} rows filled
      </span>
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}>{label}</span>
      {count !== undefined && (
        <span className="text-xs px-1.5 py-0.5 rounded-full font-mono" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>{count}</span>
      )}
    </div>
  );
}

// ─── Tab: Campaigns ───────────────────────────────────────────────────────────

function CampaignsTab({ rows, setRows }: { rows: CampaignRow[]; setRows: React.Dispatch<React.SetStateAction<CampaignRow[]>> }) {
  const update = (id: string, field: keyof CampaignRow, value: unknown) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const addRow = () => setRows((prev) => [...prev, makeCampaign()]);
  const add5 = () => setRows((prev) => [...prev, ...Array.from({ length: 5 }, makeCampaign)]);
  const filled = rows.filter((r) => r.name.trim()).length;

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    const lines = text.trim().split("\n").filter(Boolean);
    if (!lines.length) return;
    e.preventDefault();
    const newRows: CampaignRow[] = lines.map((line) => {
      const cols = line.split("\t");
      return { ...makeCampaign(), status: (cols[0] as "Active" | "Paused") || "Paused", name: cols[1] || "", objective: cols[2] || "Traffic", specialAdCategory: cols[3] || "NONE", spendCap: cols[4] || "", cbo: cols[5] === "true", campaignId: cols[6] || "" };
    });
    setRows((prev) => [...prev, ...newRows]);
  };

  return (
    <div className="flex flex-col h-full" onPaste={handlePaste}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          One row per campaign. Tab to move between cells, Enter to add a row. Paste TSV from spreadsheets.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={12} /> Add Row
          </button>
          <button onClick={add5} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={12} /> Add 5 Rows
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <ColHeader label="#" width={40} />
              <ColHeader label="Status" required width={160} />
              <ColHeader label="Campaign Name" required width={220} />
              <ColHeader label="Objective" required width={140} />
              <ColHeader label="Special Ad Category" width={160} />
              <ColHeader label="Spend Cap ($)" width={120} />
              <ColHeader label="CBO" width={60} />
              <ColHeader label="Campaign ID (Write-back)" width={180} />
              <th style={{ width: 40, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <Cell width={40} center>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</span>
                </Cell>
                <Cell width={160}>
                  <StatusPill value={row.status} onChange={(v) => update(row.id, "status", v)} />
                </Cell>
                <Cell width={220}>
                  <CellInput value={row.name} onChange={(v) => update(row.id, "name", v)} placeholder="e.g. Brand — Awareness — Q2 2026" />
                </Cell>
                <Cell width={140}>
                  <CellSelect value={row.objective} onChange={(v) => update(row.id, "objective", v)} options={["Traffic", "Awareness", "Engagement", "Leads", "App Promotion", "Sales"]} />
                </Cell>
                <Cell width={160}>
                  <CellSelect value={row.specialAdCategory} onChange={(v) => update(row.id, "specialAdCategory", v)} options={["NONE", "HOUSING", "CREDIT", "EMPLOYMENT", "ISSUES_ELECTIONS_POLITICS"]} />
                </Cell>
                <Cell width={120}>
                  <CellInput value={row.spendCap} onChange={(v) => update(row.id, "spendCap", v)} placeholder="—" />
                </Cell>
                <Cell width={60} center>
                  <input type="checkbox" checked={row.cbo} onChange={(e) => update(row.id, "cbo", e.target.checked)} className="cursor-pointer" style={{ accentColor: "#00BEEF" }} />
                </Cell>
                <Cell width={180}>
                  <CellInput value={row.campaignId} placeholder="auto-populated" readOnly mono />
                </Cell>
                <td className="px-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={() => remove(row.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "rgba(255,255,255,0.3)" }} title="Remove row">
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: "rgba(255,255,255,0.2)" }}>
            <Plus size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No campaigns yet. Click "+ Add Row" or paste TSV data.</p>
          </div>
        )}
      </div>

      <AddRowBar onAdd={addRow} onAdd5={add5} filled={filled} total={rows.length} />
    </div>
  );
}

// ─── Tab: Ad Sets ─────────────────────────────────────────────────────────────

function AdSetsTab({ rows, setRows, campaigns }: { rows: AdSetRow[]; setRows: React.Dispatch<React.SetStateAction<AdSetRow[]>>; campaigns: CampaignRow[] }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    placements: false,
    location: false,
    audience: false,
    optional: false,
  });

  const toggleSection = (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const update = (id: string, field: keyof AdSetRow, value: unknown) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const addRow = () => setRows((prev) => [...prev, makeAdSet()]);
  const add5 = () => setRows((prev) => [...prev, ...Array.from({ length: 5 }, makeAdSet)]);
  const filled = rows.filter((r) => r.name.trim()).length;

  const campaignNames = campaigns.map((c) => c.name).filter(Boolean);

  const SectionToggle = ({ sectionKey, label }: { sectionKey: string; label: string }) => (
    <th
      className="px-3 py-2 cursor-pointer select-none"
      style={{ background: expandedSections[sectionKey] ? "rgba(0,190,239,0.08)" : "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)", borderRight: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}
      onClick={() => toggleSection(sectionKey)}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold" style={{ color: expandedSections[sectionKey] ? "#00BEEF" : "rgba(255,255,255,0.5)", fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
        {expandedSections[sectionKey] ? <ChevronDown size={10} style={{ color: "#00BEEF" }} /> : <ChevronRight size={10} style={{ color: "rgba(255,255,255,0.3)" }} />}
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          One row per ad set. Click column section headers to expand targeting fields.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={12} /> Add Ad Set
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <ColHeader label="#" width={40} />
              <ColHeader label="Status" required width={160} />
              <ColHeader label="Campaign" required width={180} />
              <ColHeader label="Ad Set Name" required width={180} />
              <ColHeader label="Budget" required width={140} />
              <ColHeader label="Start" required width={160} />
              <ColHeader label="End" required width={160} />
              <ColHeader label="Opt Goal" required width={160} />
              <ColHeader label="Conv. Location" width={140} />
              <SectionToggle sectionKey="placements" label="Placements ▸" />
              {expandedSections.placements && (
                <>
                  <ColHeader label="Feed" width={100} />
                  <ColHeader label="Stories/Reels" width={120} />
                  <ColHeader label="In-Stream" width={100} />
                  <ColHeader label="Search" width={100} />
                </>
              )}
              <ColHeader label="Age" width={120} />
              <ColHeader label="Gender" width={120} />
              <SectionToggle sectionKey="location" label="Location ▸" />
              {expandedSections.location && (
                <>
                  <ColHeader label="Countries" width={140} />
                  <ColHeader label="Regions" width={140} />
                  <ColHeader label="Cities" width={140} />
                  <ColHeader label="Zip Codes" width={120} />
                </>
              )}
              <SectionToggle sectionKey="audience" label="Audience ▸" />
              {expandedSections.audience && (
                <>
                  <ColHeader label="Custom Audiences" width={160} />
                  <ColHeader label="Lookalike" width={140} />
                  <ColHeader label="Interests" width={160} />
                  <ColHeader label="Behaviors" width={140} />
                </>
              )}
              <SectionToggle sectionKey="optional" label="Optional Fields ▸" />
              {expandedSections.optional && (
                <>
                  <ColHeader label="Bid Strategy" width={140} />
                  <ColHeader label="Bid Cap" width={100} />
                  <ColHeader label="Attribution" width={140} />
                  <ColHeader label="Pixel ID" width={140} />
                </>
              )}
              <th style={{ width: 40, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <Cell width={40} center>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</span>
                </Cell>
                <Cell width={160}>
                  <StatusPill value={row.status} onChange={(v) => update(row.id, "status", v)} />
                </Cell>
                <Cell width={180}>
                  {campaignNames.length > 0 ? (
                    <CellSelect value={row.campaign} onChange={(v) => update(row.id, "campaign", v)} options={["", ...campaignNames]} />
                  ) : (
                    <CellInput value={row.campaign} onChange={(v) => update(row.id, "campaign", v)} placeholder="Select campaign..." />
                  )}
                </Cell>
                <Cell width={180}>
                  <CellInput value={row.name} onChange={(v) => update(row.id, "name", v)} placeholder="Ad Set #1" />
                </Cell>
                <Cell width={140}>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>$</span>
                    <input
                      type="number"
                      value={row.budget}
                      onChange={(e) => update(row.id, "budget", e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-transparent text-xs outline-none"
                      style={{ color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem" }}
                    />
                    <select
                      value={row.budgetType}
                      onChange={(e) => update(row.id, "budgetType", e.target.value as "Daily" | "Lifetime")}
                      className="bg-transparent text-xs outline-none cursor-pointer"
                      style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}
                    >
                      <option value="Daily" style={{ background: "#141349" }}>Daily</option>
                      <option value="Lifetime" style={{ background: "#141349" }}>Lifetime</option>
                    </select>
                  </div>
                </Cell>
                <Cell width={160}>
                  <div className="flex flex-col gap-0.5">
                    <input type="date" value={row.start.split(" ")[0] || ""} onChange={(e) => update(row.id, "start", e.target.value + " 08:00 AM")} className="bg-transparent text-xs outline-none" style={{ color: "#FAFAFA", fontSize: "0.72rem" }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>08:00 AM</span>
                  </div>
                </Cell>
                <Cell width={160}>
                  <div className="flex flex-col gap-0.5">
                    <input type="date" value={row.end.split(" ")[0] || ""} onChange={(e) => update(row.id, "end", e.target.value + " 08:00 PM")} className="bg-transparent text-xs outline-none" style={{ color: "#FAFAFA", fontSize: "0.72rem" }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>08:00 PM</span>
                  </div>
                </Cell>
                <Cell width={160}>
                  <CellSelect value={row.optGoal} onChange={(v) => update(row.id, "optGoal", v)} options={["Landing Page Views", "Link Clicks", "Impressions", "Reach", "Conversions", "Purchase", "Lead"]} />
                </Cell>
                <Cell width={140}>
                  <CellSelect value={row.convLocation} onChange={(v) => update(row.id, "convLocation", v)} options={["Website", "App", "Messenger", "WhatsApp", "Calls"]} />
                </Cell>
                <Cell width={140}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Click to expand</span>
                </Cell>
                {expandedSections.placements && (
                  <>
                    <Cell width={100}><input type="checkbox" defaultChecked style={{ accentColor: "#00BEEF" }} /></Cell>
                    <Cell width={120}><input type="checkbox" defaultChecked style={{ accentColor: "#00BEEF" }} /></Cell>
                    <Cell width={100}><input type="checkbox" style={{ accentColor: "#00BEEF" }} /></Cell>
                    <Cell width={100}><input type="checkbox" style={{ accentColor: "#00BEEF" }} /></Cell>
                  </>
                )}
                <Cell width={120}>
                  <div className="flex items-center gap-1">
                    <input type="number" value={row.ageMin} onChange={(e) => update(row.id, "ageMin", e.target.value)} className="w-10 bg-transparent text-xs outline-none text-center" style={{ color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace" }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>–</span>
                    <input type="number" value={row.ageMax} onChange={(e) => update(row.id, "ageMax", e.target.value)} className="w-10 bg-transparent text-xs outline-none text-center" style={{ color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace" }} />
                  </div>
                </Cell>
                <Cell width={120}>
                  <div className="flex items-center gap-1">
                    {(["All", "M", "F"] as const).map((g) => (
                      <button key={g} onClick={() => update(row.id, "gender", g)} className="px-1.5 py-0.5 rounded text-xs font-semibold transition-all" style={{ background: row.gender === g ? "rgba(0,190,239,0.15)" : "rgba(255,255,255,0.06)", color: row.gender === g ? "#00BEEF" : "rgba(255,255,255,0.4)", border: `1px solid ${row.gender === g ? "rgba(0,190,239,0.3)" : "transparent"}` }}>
                        {g}
                      </button>
                    ))}
                  </div>
                </Cell>
                <Cell width={140}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Click to expand</span>
                </Cell>
                {expandedSections.location && (
                  <>
                    <Cell width={140}><CellInput value="" onChange={() => {}} placeholder="US, CA..." /></Cell>
                    <Cell width={140}><CellInput value="" onChange={() => {}} placeholder="Regions..." /></Cell>
                    <Cell width={140}><CellInput value="" onChange={() => {}} placeholder="Cities..." /></Cell>
                    <Cell width={120}><CellInput value="" onChange={() => {}} placeholder="Zip codes..." /></Cell>
                  </>
                )}
                <Cell width={140}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Click to expand</span>
                </Cell>
                {expandedSections.audience && (
                  <>
                    <Cell width={160}><CellInput value="" onChange={() => {}} placeholder="Custom audiences..." /></Cell>
                    <Cell width={140}><CellInput value="" onChange={() => {}} placeholder="Lookalike..." /></Cell>
                    <Cell width={160}><CellInput value="" onChange={() => {}} placeholder="Interests..." /></Cell>
                    <Cell width={140}><CellInput value="" onChange={() => {}} placeholder="Behaviors..." /></Cell>
                  </>
                )}
                <Cell width={140}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Click to expand</span>
                </Cell>
                {expandedSections.optional && (
                  <>
                    <Cell width={140}><CellSelect value="LOWEST_COST_WITHOUT_CAP" onChange={() => {}} options={["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "MINIMUM_ROAS"]} /></Cell>
                    <Cell width={100}><CellInput value="" onChange={() => {}} placeholder="—" /></Cell>
                    <Cell width={140}><CellSelect value="7d_click" onChange={() => {}} options={["7d_click", "1d_click", "7d_click_1d_view", "1d_click_1d_view"]} /></Cell>
                    <Cell width={140}><CellInput value="" onChange={() => {}} placeholder="Pixel ID..." /></Cell>
                  </>
                )}
                <td className="px-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={() => remove(row.id)} className="p-1 rounded" style={{ color: "rgba(255,255,255,0.3)" }} title="Remove row">
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: "rgba(255,255,255,0.2)" }}>
            <Plus size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No ad sets yet. Click "+ Add Ad Set" to begin.</p>
          </div>
        )}
      </div>

      <AddRowBar onAdd={addRow} onAdd5={add5} filled={filled} total={rows.length} />
    </div>
  );
}

// ─── Tab: Creative Library ────────────────────────────────────────────────────

function AssetDropZone({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="rounded-md p-2 text-center transition-all"
      style={{ border: `1px dashed ${dragging ? "#00BEEF" : "rgba(255,255,255,0.15)"}`, background: dragging ? "rgba(0,190,239,0.05)" : "rgba(255,255,255,0.02)", minHeight: 56 }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) onChange(file.name); }}
    >
      {value ? (
        <div className="flex items-center gap-1 justify-center">
          <span className="text-xs truncate" style={{ color: "#00BEEF", maxWidth: 120 }}>{value}</span>
          <button onClick={() => onChange("")}><X size={10} style={{ color: "rgba(255,255,255,0.4)" }} /></button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Upload size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>Drop or browse</span>
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Drop file or paste URL / hash"}
            className="w-full bg-transparent text-xs outline-none text-center"
            style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}
          />
        </>
      )}
    </div>
  );
}

function DimensionPills({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const dims = ["1:1", "4:5", "9:16"];
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {dims.map((d) => (
        <button key={d} onClick={() => toggle(d)} className="px-1.5 py-0.5 rounded text-xs font-semibold transition-all" style={{ background: value.includes(d) ? "rgba(0,190,239,0.15)" : "rgba(255,255,255,0.06)", color: value.includes(d) ? "#00BEEF" : "rgba(255,255,255,0.4)", border: `1px solid ${value.includes(d) ? "rgba(0,190,239,0.3)" : "transparent"}`, fontSize: "0.65rem" }}>
          {d}
        </button>
      ))}
    </div>
  );
}

function CreativeLibraryTab({ rows, setRows, carousels, setCarousels }: {
  rows: CreativeRow[];
  setRows: React.Dispatch<React.SetStateAction<CreativeRow[]>>;
  carousels: CarouselRow[];
  setCarousels: React.Dispatch<React.SetStateAction<CarouselRow[]>>;
}) {
  const update = (id: string, field: keyof CreativeRow, value: unknown) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const addRow = () => setRows((prev) => [...prev, makeCreative()]);
  const add5 = () => setRows((prev) => [...prev, ...Array.from({ length: 5 }, makeCreative)]);

  const updateCarousel = (id: string, field: keyof CarouselRow, value: unknown) => setCarousels((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  const removeCarousel = (id: string) => setCarousels((prev) => prev.filter((c) => c.id !== id));
  const addCarousel = () => setCarousels((prev) => [...prev, makeCarousel()]);
  const addCard = (carouselId: string) => setCarousels((prev) => prev.map((c) => c.id === carouselId ? { ...c, cards: [...c.cards, makeCard()] } : c));
  const removeCard = (carouselId: string, cardId: string) => setCarousels((prev) => prev.map((c) => c.id === carouselId ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) } : c));
  const updateCard = (carouselId: string, cardId: string, field: keyof CarouselCard, value: string) => setCarousels((prev) => prev.map((c) => c.id === carouselId ? { ...c, cards: c.cards.map((k) => k.id === cardId ? { ...k, [field]: value } : k) } : c));

  const totalCount = rows.length + carousels.length;
  const staticCount = rows.filter((r) => r.assetType === "Static").length;
  const videoCount = rows.filter((r) => r.assetType === "Video").length;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            One row per creative. Paste directly from your client's doc. Multiple dimensions = placement-customized asset.
          </p>
          <div className="flex items-center gap-2">
            {rows.some((r) => r.dimensions.length > 1) && (
              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: "rgba(247,144,30,0.15)", color: "#F7901E", border: "1px solid rgba(247,144,30,0.3)" }}>PLACEMENT CUSTOM</span>
            )}
            <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>{staticCount} static / {videoCount} video</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>{carousels.length} carousel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={12} /> Add Row
          </button>
          <button onClick={add5} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={12} /> Add 5 Rows
          </button>
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{totalCount}</span>
        </div>
      </div>

      {/* Static & Video section */}
      <SectionLabel label="Static & Video Creatives" count={rows.length} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <ColHeader label="#" width={40} />
              <ColHeader label="ID (Auto)" width={100} />
              <ColHeader label="Asset Type" width={140} />
              <ColHeader label="Dimensions" width={160} />
              <ColHeader label="Creative Concept" required width={180} />
              <ColHeader label="Length (s)" width={90} />
              <ColHeader label="Feed Asset" width={180} />
              <ColHeader label="Stories/Reels Asset" width={180} />
              <ColHeader label="Website URL" width={180} />
              <ColHeader label="Headline (40)" width={160} />
              <ColHeader label="Primary Text (125)" width={200} />
              <ColHeader label="Description (30)" width={160} />
              <ColHeader label="CTA" width={140} />
              <ColHeader label="Link to UTM" width={180} />
              <th style={{ width: 40, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <Cell width={40} center>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</span>
                </Cell>
                <Cell width={100}>
                  <CellInput value={row.autoId} readOnly mono placeholder="auto" />
                </Cell>
                <Cell width={140}>
                  <div className="flex items-center gap-1">
                    {(["Static", "Video"] as const).map((t) => (
                      <button key={t} onClick={() => update(row.id, "assetType", t)} className="px-2 py-0.5 rounded text-xs font-semibold transition-all" style={{ background: row.assetType === t ? (t === "Static" ? "rgba(0,190,239,0.15)" : "rgba(167,139,250,0.15)") : "rgba(255,255,255,0.06)", color: row.assetType === t ? (t === "Static" ? "#00BEEF" : "#a78bfa") : "rgba(255,255,255,0.4)", border: `1px solid ${row.assetType === t ? (t === "Static" ? "rgba(0,190,239,0.3)" : "rgba(167,139,250,0.3)") : "transparent"}` }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Cell>
                <Cell width={160}>
                  <DimensionPills value={row.dimensions} onChange={(v) => update(row.id, "dimensions", v)} />
                </Cell>
                <Cell width={180}>
                  <CellInput value={row.concept} onChange={(v) => update(row.id, "concept", v)} placeholder="e.g. Fine Print" />
                </Cell>
                <Cell width={90}>
                  <CellInput value={row.length} onChange={(v) => update(row.id, "length", v)} placeholder="—" mono />
                </Cell>
                <Cell width={180}>
                  <AssetDropZone value={row.feedAsset} onChange={(v) => update(row.id, "feedAsset", v)} />
                </Cell>
                <Cell width={180}>
                  <AssetDropZone value={row.storiesAsset} onChange={(v) => update(row.id, "storiesAsset", v)} />
                </Cell>
                <Cell width={180}>
                  <CellInput value={row.websiteUrl} onChange={(v) => update(row.id, "websiteUrl", v)} placeholder="https://..." />
                </Cell>
                <Cell width={160}>
                  <div>
                    <CellInput value={row.headline} onChange={(v) => update(row.id, "headline", v)} placeholder="Headline" />
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs" style={{ color: row.headline.length > 40 ? "#ED135F" : "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>{row.headline.length}/40</span>
                      <button className="text-xs" style={{ color: "#00BEEF", fontSize: "0.6rem" }}>+ Variants</button>
                    </div>
                  </div>
                </Cell>
                <Cell width={200}>
                  <div>
                    <textarea value={row.primaryText} onChange={(e) => update(row.id, "primaryText", e.target.value)} placeholder="Primary text" rows={2} className="w-full bg-transparent text-xs outline-none resize-none" style={{ color: "#FAFAFA", fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem" }} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: row.primaryText.length > 125 ? "#ED135F" : "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>{row.primaryText.length}/125</span>
                      <button className="text-xs" style={{ color: "#00BEEF", fontSize: "0.6rem" }}>+ Variants</button>
                    </div>
                  </div>
                </Cell>
                <Cell width={160}>
                  <div>
                    <CellInput value={row.description} onChange={(v) => update(row.id, "description", v)} placeholder="Description" />
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs" style={{ color: row.description.length > 30 ? "#ED135F" : "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>{row.description.length}/30</span>
                      <button className="text-xs" style={{ color: "#00BEEF", fontSize: "0.6rem" }}>+ Variants</button>
                    </div>
                  </div>
                </Cell>
                <Cell width={140}>
                  <CellSelect value={row.cta} onChange={(v) => update(row.id, "cta", v)} options={["LEARN MORE", "SHOP NOW", "SIGN UP", "BOOK NOW", "CONTACT US", "DOWNLOAD", "GET OFFER", "WATCH MORE", "APPLY NOW"]} />
                </Cell>
                <Cell width={180}>
                  <CellInput value={row.linkToUtm} onChange={(v) => update(row.id, "linkToUtm", v)} placeholder="utm_source=meta..." mono />
                </Cell>
                <td className="px-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={() => remove(row.id)} className="p-1 rounded" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8" style={{ color: "rgba(255,255,255,0.2)" }}>
            <p className="text-sm">No static/video creatives yet.</p>
          </div>
        )}
      </div>
      <AddRowBar onAdd={addRow} onAdd5={add5} filled={rows.filter((r) => r.concept.trim()).length} total={rows.length} />

      {/* Carousel section */}
      <div className="shrink-0 mt-2">
        <div className="flex items-center justify-between px-4 py-2" style={{ background: "rgba(247,144,30,0.06)", borderTop: "1px solid rgba(247,144,30,0.15)", borderBottom: "1px solid rgba(247,144,30,0.15)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: "#F7901E" }}>🎠 Carousel Creatives</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Each carousel has a parent row (shared fields) + card sub-rows.</span>
          </div>
          <button onClick={addCarousel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(247,144,30,0.1)", color: "#F7901E", border: "1px solid rgba(247,144,30,0.25)" }}>
            <Plus size={12} /> Add Carousel
          </button>
        </div>

        {carousels.map((carousel, ci) => (
          <div key={carousel.id} className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {/* Parent row */}
            <div className="flex items-start gap-3 px-4 py-3" style={{ background: "rgba(247,144,30,0.04)" }}>
              <span className="text-xs font-mono mt-1" style={{ color: "rgba(255,255,255,0.3)", minWidth: 20 }}>{ci + 1}</span>
              <div className="grid gap-3 flex-1" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 120px 1fr" }}>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Creative ID</label>
                  <CellInput value={carousel.creativeId} readOnly mono />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Creative Concept</label>
                  <CellInput value={carousel.concept} onChange={(v) => updateCarousel(carousel.id, "concept", v)} placeholder="Fine Print" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Website URL</label>
                  <CellInput value={carousel.websiteUrl} onChange={(v) => updateCarousel(carousel.id, "websiteUrl", v)} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Primary Text (120)</label>
                  <CellInput value={carousel.primaryText} onChange={(v) => updateCarousel(carousel.id, "primaryText", v)} placeholder="And on the seventh day..." />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", textTransform: "uppercase" }}>CTA</label>
                  <CellSelect value={carousel.cta} onChange={(v) => updateCarousel(carousel.id, "cta", v)} options={["LEARN MORE", "SHOP NOW", "SIGN UP", "BOOK NOW"]} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Link to UTM</label>
                  <CellInput value={carousel.linkToUtm} onChange={(v) => updateCarousel(carousel.id, "linkToUtm", v)} placeholder="utm_source=meta..." mono />
                </div>
              </div>
              <button onClick={() => removeCarousel(carousel.id)} className="p-1 rounded mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                <X size={12} />
              </button>
            </div>

            {/* Cards sub-table */}
            <div className="px-8 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>🃏 Carousel Cards</span>
                <button onClick={() => addCard(carousel.id)} className="flex items-center gap-1 text-xs" style={{ color: "#00BEEF" }}>
                  <Plus size={10} /> Add Card
                </button>
              </div>
              <table className="w-full border-collapse" style={{ background: "rgba(255,255,255,0.01)", borderRadius: 6, overflow: "hidden" }}>
                <thead>
                  <tr>
                    <ColHeader label="Card #" width={60} />
                    <ColHeader label="File Name" width={180} />
                    <ColHeader label="File Hash / Asset" width={200} />
                    <ColHeader label="Headline" width={180} />
                    <ColHeader label="Description" width={180} />
                    <ColHeader label="Card URL" width={180} />
                    <th style={{ width: 40, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
                  </tr>
                </thead>
                <tbody>
                  {carousel.cards.map((card, ki) => (
                    <tr key={card.id}>
                      <Cell width={60} center>
                        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{ki + 1}</span>
                      </Cell>
                      <Cell width={180}>
                        <CellInput value={card.fileName} onChange={(v) => updateCard(carousel.id, card.id, "fileName", v)} placeholder="Hu_Static_4x5_Card1" mono />
                      </Cell>
                      <Cell width={200}>
                        <AssetDropZone value={card.fileHash} onChange={(v) => updateCard(carousel.id, card.id, "fileHash", v)} />
                      </Cell>
                      <Cell width={180}>
                        <CellInput value={card.headline} onChange={(v) => updateCard(carousel.id, card.id, "headline", v)} placeholder="Chocolate is like a carousel" />
                      </Cell>
                      <Cell width={180}>
                        <CellInput value={card.description} onChange={(v) => updateCard(carousel.id, card.id, "description", v)} placeholder="Such good coco..." />
                      </Cell>
                      <Cell width={180}>
                        <CellInput value={card.cardUrl} onChange={(v) => updateCard(carousel.id, card.id, "cardUrl", v)} placeholder="https://..." />
                      </Cell>
                      <td className="px-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <button onClick={() => removeCard(carousel.id, card.id)} className="p-1 rounded" style={{ color: "rgba(255,255,255,0.3)" }}>
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {carousels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8" style={{ color: "rgba(255,255,255,0.2)" }}>
            <p className="text-sm">No carousel creatives yet. Click "+ Add Carousel".</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Ads ─────────────────────────────────────────────────────────────────

function AdsTab({ rows, setRows, campaigns, adSets, creatives }: {
  rows: AdRow[];
  setRows: React.Dispatch<React.SetStateAction<AdRow[]>>;
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
  creatives: CreativeRow[];
}) {
  const update = (id: string, field: keyof AdRow, value: unknown) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const addRow = () => setRows((prev) => [...prev, makeAd()]);

  const campaignNames = campaigns.map((c) => c.name).filter(Boolean);
  const adSetNames = adSets.map((a) => a.name).filter(Boolean);
  const creativeIds = creatives.map((c) => c.autoId || c.concept).filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          {rows.length} ads assembled — review and edit before launch.
        </p>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Search size={12} /> Find & Replace
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Zap size={12} /> Ad Trafficker
          </button>
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={12} /> Add Row
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <LayoutDashboard size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>No ads yet</p>
            <p className="text-xs max-w-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              Use the <span style={{ color: "#00BEEF" }}>Ad Trafficker</span> button to map creatives to ad sets and generate ads, or add a row manually.
            </p>
          </div>
          <button onClick={addRow} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            <Plus size={14} /> Add row manually
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <ColHeader label="#" width={40} />
                <ColHeader label="Status" width={160} />
                <ColHeader label="Ad Name" required width={200} />
                <ColHeader label="Campaign" required width={180} />
                <ColHeader label="Ad Set" required width={180} />
                <ColHeader label="Creative ID" required width={160} />
                <ColHeader label="Ad ID (Write-back)" width={180} />
                <ColHeader label="Preview Link" width={160} />
                <th style={{ width: 40, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <Cell width={40} center>
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                  </Cell>
                  <Cell width={160}>
                    <StatusPill value={row.status} onChange={(v) => update(row.id, "status", v)} />
                  </Cell>
                  <Cell width={200}>
                    <CellInput value={row.adName} onChange={(v) => update(row.id, "adName", v)} placeholder="Ad name..." />
                  </Cell>
                  <Cell width={180}>
                    <CellSelect value={row.campaign} onChange={(v) => update(row.id, "campaign", v)} options={["", ...campaignNames]} />
                  </Cell>
                  <Cell width={180}>
                    <CellSelect value={row.adSet} onChange={(v) => update(row.id, "adSet", v)} options={["", ...adSetNames]} />
                  </Cell>
                  <Cell width={160}>
                    <CellSelect value={row.creativeId} onChange={(v) => update(row.id, "creativeId", v)} options={["", ...creativeIds]} />
                  </Cell>
                  <Cell width={180}>
                    <CellInput value={row.adId} readOnly mono placeholder="auto-populated" />
                  </Cell>
                  <Cell width={160}>
                    {row.previewLink ? (
                      <a href={row.previewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs" style={{ color: "#00BEEF" }}>
                        <ExternalLink size={10} /> Preview
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                    )}
                  </Cell>
                  <td className="px-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <button onClick={() => remove(row.id)} className="p-1 rounded" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Export & Launch ─────────────────────────────────────────────────────

function ExportTab({ campaigns, adSets, creatives, ads }: { campaigns: CampaignRow[]; adSets: AdSetRow[]; creatives: CreativeRow[]; ads: AdRow[] }) {
  const checks = [
    { label: `${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} defined`, pass: campaigns.length > 0, warn: false },
    { label: `${adSets.length} ad set${adSets.length !== 1 ? "s" : ""} defined`, pass: adSets.length > 0, warn: false },
    { label: `${creatives.length} creative${creatives.length !== 1 ? "s" : ""} in library`, pass: creatives.length > 0, warn: false },
    { label: `${ads.length} ad${ads.length !== 1 ? "s" : ""} assembled`, pass: ads.length > 0, warn: false },
    { label: "All ad sets linked to a campaign", pass: adSets.every((a) => a.campaign), warn: adSets.length > 0 && adSets.some((a) => !a.campaign) },
    { label: "All creatives have assets or post IDs", pass: creatives.every((c) => c.feedAsset), warn: creatives.length > 0 && creatives.some((c) => !c.feedAsset) },
    { label: "Ad Account ID configured", pass: false, warn: false },
    { label: "Access Token configured", pass: false, warn: false },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  const warnCount = checks.filter((c) => c.warn).length;
  const failCount = checks.filter((c) => !c.pass && !c.warn).length;

  const [findField, setFindField] = useState("URL Parameters (UTM)");
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Campaigns", count: campaigns.length },
          { label: "Ad Sets", count: adSets.length },
          { label: "Creatives", count: creatives.length },
          { label: "Ads", count: ads.length },
        ].map((item) => (
          <div key={item.label} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-2xl font-bold mb-1" style={{ color: item.count > 0 ? "#00BEEF" : "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{item.count}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Pre-flight checks */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Pre-Flight Checks</span>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span style={{ color: "#00B37A" }}>{passCount} pass</span>
            <span style={{ color: "#F7901E" }}>{warnCount} warn</span>
            <span style={{ color: "#ED135F" }}>{failCount} fail</span>
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {checks.map((check, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {check.pass ? (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,179,122,0.15)" }}>
                    <Check size={10} style={{ color: "#00B37A" }} />
                  </div>
                ) : check.warn ? (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(247,144,30,0.15)" }}>
                    <AlertTriangle size={10} style={{ color: "#F7901E" }} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(237,19,95,0.15)" }}>
                    <X size={10} style={{ color: "#ED135F" }} />
                  </div>
                )}
                <span className="text-sm" style={{ color: check.pass ? "#FAFAFA" : check.warn ? "#F7901E" : "rgba(255,255,255,0.5)" }}>{check.label}</span>
              </div>
              <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Find & Replace */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Search size={14} style={{ color: "rgba(255,255,255,0.5)" }} />
          <span className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Find & Replace</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Bulk-edit ad fields before launch</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.62rem" }}>Field</label>
              <CellSelect value={findField} onChange={setFindField} options={["URL Parameters (UTM)", "Website URL", "Headline", "Primary Text", "Description", "CTA"]} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.62rem" }}>Find</label>
              <input value={findValue} onChange={(e) => setFindValue(e.target.value)} placeholder="e.g. utm_campaign=old_name" className="w-full bg-transparent text-xs outline-none border-b" style={{ color: "#FAFAFA", borderColor: "rgba(255,255,255,0.15)", paddingBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem" }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.62rem" }}>Replace with</label>
              <input value={replaceValue} onChange={(e) => setReplaceValue(e.target.value)} placeholder="e.g. utm_campaign=new_name" className="w-full bg-transparent text-xs outline-none border-b" style={{ color: "#FAFAFA", borderColor: "rgba(255,255,255,0.15)", paddingBottom: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem" }} />
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.25)" }}>
            Preview
          </button>
        </div>
      </div>

      {/* Launch button */}
      <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "rgba(237,19,95,0.06)", border: "1px solid rgba(237,19,95,0.2)" }}>
        <div>
          <p className="text-sm font-bold mb-0.5" style={{ color: "#FAFAFA" }}>Ready to launch?</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Review your build, make final edits, then copy the Manus command to push to Meta.</p>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
          style={{ background: passCount >= 4 ? "#ED135F" : "rgba(255,255,255,0.08)", color: passCount >= 4 ? "#fff" : "rgba(255,255,255,0.3)", cursor: passCount >= 4 ? "pointer" : "not-allowed" }}
          disabled={passCount < 4}
        >
          <Zap size={14} />
          Generate {ads.length} Ad{ads.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CampaignBuilder() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = ["/campaign-builder"];
  const [buildMode, setBuildMode] = useState<BuildMode>("full");
  const [activeTab, setActiveTab] = useState<TabId>("campaigns");

  // State for each tab
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([makeCampaign()]);
  const [adSets, setAdSets] = useState<AdSetRow[]>([makeAdSet()]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([makeCreative()]);
  const [carousels, setCarousels] = useState<CarouselRow[]>([makeCarousel()]);
  const [ads, setAds] = useState<AdRow[]>([]);

  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = me?.role === "admin";

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#141349" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00BEEF", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</span>
        </div>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "campaigns", label: "Campaigns", count: campaigns.filter((c) => c.name).length },
    { id: "ad-sets", label: "Ad Sets", count: adSets.filter((a) => a.name).length },
    { id: "creative-library", label: "Creative Library", count: creatives.filter((c) => c.concept).length + carousels.length },
    { id: "ads", label: "Ads", count: ads.filter((a) => a.adName).length },
    { id: "export", label: "Export & Launch" },
  ];

  const SECTIONS = [
    { id: "campaigns" as TabId, label: "Campaigns", sub: "Define campaigns", count: campaigns.filter((c) => c.name).length },
    { id: "ad-sets" as TabId, label: "Ad Sets", sub: "Targeting & budget", count: adSets.filter((a) => a.name).length },
    { id: "creative-library" as TabId, label: "Creative Library", sub: "Assets & copy", count: creatives.filter((c) => c.concept).length + carousels.length },
    { id: "ads" as TabId, label: "Ads", sub: "Assemble & traffic", count: ads.filter((a) => a.adName).length },
    { id: "export" as TabId, label: "Export & Launch", sub: "Review & push" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#141349", fontFamily: "'Montserrat', sans-serif" }}>
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between shrink-0 px-4" style={{ height: 52, background: "rgba(20,19,73,0.98)", borderBottom: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "#ED135F" }}>
            <Cpu size={14} color="#fff" />
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: "#FAFAFA" }}>
            Pathlabs <span style={{ color: "#00BEEF" }}>Intelligence</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#ED135F", color: "#fff" }}>
              {(me?.name || me?.email || "U").charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{me?.name || me?.email}</span>
          </div>
          <button onClick={() => logout()} className="p-1.5 rounded-md" style={{ color: "rgba(255,255,255,0.4)" }} title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <div className="flex flex-col shrink-0 overflow-y-auto" style={{ width: 168, background: "rgba(14,13,58,0.98)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          {/* App nav links */}
          <div className="px-3 pt-3 pb-2">
            <Link href="/dashboard">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer" style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LayoutDashboard size={11} />
                <span className="text-xs" style={{ fontSize: "0.68rem" }}>← Dashboard</span>
              </div>
            </Link>
          </div>

          <div className="px-3 pb-2">
            <p className="text-xs font-bold px-2 mb-2" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.6rem" }}>Build Mode</p>
            <div className="flex flex-col gap-0.5">
              {([
                { id: "full" as BuildMode, label: "Full Build", sub: "Campaigns + ad sets + ads" },
                { id: "ads-only" as BuildMode, label: "Ads Only", sub: "Add ads to existing ad sets" },
                { id: "update" as BuildMode, label: "Update Ads", sub: "Edit creative on live ads" },
              ] as const).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setBuildMode(mode.id)}
                  className="flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-all w-full"
                  style={{ background: buildMode === mode.id ? "rgba(237,19,95,0.12)" : "transparent", border: `1px solid ${buildMode === mode.id ? "rgba(237,19,95,0.25)" : "transparent"}` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: buildMode === mode.id ? "#ED135F" : "rgba(255,255,255,0.2)" }} />
                  <div>
                    <span className="block text-xs font-semibold" style={{ color: buildMode === mode.id ? "#ED135F" : "rgba(255,255,255,0.6)", fontSize: "0.72rem" }}>{mode.label}</span>
                    <span className="block text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>{mode.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pt-2 pb-4">
            <p className="text-xs font-bold px-2 mb-2" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.6rem" }}>Sections</p>
            <div className="flex flex-col gap-0.5">
              {SECTIONS.map((sec, idx) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className="flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-all w-full"
                  style={{ background: activeTab === sec.id ? "rgba(0,190,239,0.1)" : "transparent", border: `1px solid ${activeTab === sec.id ? "rgba(0,190,239,0.2)" : "transparent"}` }}
                >
                  <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color: activeTab === sec.id ? "#00BEEF" : "rgba(255,255,255,0.25)", fontSize: "0.65rem", minWidth: 12 }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate" style={{ color: activeTab === sec.id ? "#00BEEF" : "rgba(255,255,255,0.6)", fontSize: "0.72rem" }}>{sec.label}</span>
                      {sec.count !== undefined && sec.count > 0 && (
                        <span className="text-xs font-mono px-1 rounded shrink-0" style={{ background: "rgba(0,190,239,0.15)", color: "#00BEEF", fontSize: "0.6rem" }}>{sec.count}</span>
                      )}
                    </div>
                    <span className="block text-xs truncate" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>{sec.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Stage ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb + tab bar */}
          <div className="shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(20,19,73,0.6)" }}>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <Hammer size={12} style={{ color: "#ED135F" }} />
              <span className="text-xs font-semibold" style={{ color: "#ED135F" }}>Campaign Builder</span>
              <ChevronRight size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{TABS.find((t) => t.id === activeTab)?.label}</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(237,19,95,0.15)", color: "#ED135F", border: "1px solid rgba(237,19,95,0.25)" }}>
                  {buildMode === "full" ? "Full Build" : buildMode === "ads-only" ? "Ads Only" : "Update Ads"}
                </span>
              </div>
            </div>
            {/* Tab bar */}
            <div className="flex items-center gap-0 px-4">
              {TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all relative"
                  style={{ color: activeTab === tab.id ? "#00BEEF" : "rgba(255,255,255,0.45)", borderBottom: `2px solid ${activeTab === tab.id ? "#00BEEF" : "transparent"}` }}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: activeTab === tab.id ? "rgba(0,190,239,0.2)" : "rgba(255,255,255,0.08)", color: activeTab === tab.id ? "#00BEEF" : "rgba(255,255,255,0.4)", fontSize: "0.6rem" }}>
                    {i + 1}
                  </span>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="text-xs font-mono px-1 rounded" style={{ background: "rgba(0,190,239,0.15)", color: "#00BEEF", fontSize: "0.6rem" }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "campaigns" && <CampaignsTab rows={campaigns} setRows={setCampaigns} />}
            {activeTab === "ad-sets" && <AdSetsTab rows={adSets} setRows={setAdSets} campaigns={campaigns} />}
            {activeTab === "creative-library" && <CreativeLibraryTab rows={creatives} setRows={setCreatives} carousels={carousels} setCarousels={setCarousels} />}
            {activeTab === "ads" && <AdsTab rows={ads} setRows={setAds} campaigns={campaigns} adSets={adSets} creatives={creatives} />}
            {activeTab === "export" && <ExportTab campaigns={campaigns} adSets={adSets} creatives={creatives} ads={ads} />}
          </div>
        </div>
      </div>
    </div>
  );
}
