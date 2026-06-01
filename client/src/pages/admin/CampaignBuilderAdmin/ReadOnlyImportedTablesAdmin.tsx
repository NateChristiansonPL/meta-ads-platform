/**
 * ReadOnlyImportedTablesAdmin — Lightweight read-only views of imported
 * campaigns and ad sets for Ads Only mode.
 * Columns are stripped to essentials (no settings/targeting/budget/dates).
 * Matches the same dark spreadsheet styling as the editable tables.
 */

import { Info } from "lucide-react";
import { ImportedMetaCampaign, ImportedMetaAdSet } from "./campaignStoreAdmin";

// ── Info Bar ─────────────────────────────────────────────────────────────────
function ReadOnlyBanner() {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-[11px] font-600 text-muted-foreground select-none"
      style={{
        background: "rgba(0,190,239,0.04)",
        borderLeft: "3px solid rgba(0,190,239,0.5)",
      }}
    >
      <Info size={13} className="text-primary/60 flex-shrink-0" />
      <span className="uppercase tracking-wider">Read-only</span>
      <span className="text-muted-foreground/60">— Imported from Meta</span>
    </div>
  );
}

// ── Shared Th ────────────────────────────────────────────────────────────────
function Th({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[10px] font-700 uppercase tracking-wider border-r border-border last:border-r-0 whitespace-nowrap sticky top-0 bg-surface-2 z-10 ${
        muted ? "text-muted-foreground/50" : "text-muted-foreground"
      }`}
    >
      {children}
    </th>
  );
}

// ── Status Dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const color =
    normalized === "ACTIVE"
      ? "#34d399"
      : normalized === "PAUSED"
      ? "#fbbf24"
      : "#f87171";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span className="text-foreground/80 capitalize text-[11px]">
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ entity }: { entity: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-[12px] text-muted-foreground/60">
      No {entity} imported yet. Click <strong className="mx-1 text-primary">Import Existing</strong> to pull in from Meta.
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// READ-ONLY CAMPAIGNS TABLE
// ══════════════════════════════════════════════════════════════════════════════
export function ReadOnlyCampaignsTable({
  campaigns,
}: {
  campaigns: ImportedMetaCampaign[];
}) {
  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
        <div>
          <h2 className="text-sm font-700 text-foreground">Campaigns</h2>
          <p className="text-[11px] text-muted-foreground">
            Imported campaigns from Meta. These are reference-only — ads will be created under their existing ad sets.
          </p>
        </div>
      </div>

      {/* Info bar */}
      <ReadOnlyBanner />

      {/* Table */}
      {campaigns.length === 0 ? (
        <EmptyState entity="campaigns" />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: "35%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <Th muted>#</Th>
                <Th>Name</Th>
                <Th>Objective</Th>
                <Th>Status</Th>
                <Th muted>Campaign ID</Th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, i) => (
                <tr
                  key={campaign.id}
                  className="border-b border-border hover:bg-surface-2/40 transition-colors"
                >
                  <td className="px-3 py-2.5 text-center text-[10px] text-muted-foreground/50 font-mono border-r border-border">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-foreground font-500 border-r border-border truncate">
                    {campaign.name}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-foreground/70 border-r border-border">
                    {formatObjective(campaign.objective)}
                  </td>
                  <td className="px-3 py-2.5 border-r border-border">
                    <StatusDot status={campaign.status} />
                  </td>
                  <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 font-mono">
                    {campaign.id}
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

// ══════════════════════════════════════════════════════════════════════════════
// READ-ONLY AD SETS TABLE
// ══════════════════════════════════════════════════════════════════════════════
export function ReadOnlyAdSetsTable({
  adSets,
  campaigns,
}: {
  adSets: ImportedMetaAdSet[];
  campaigns: ImportedMetaCampaign[];
}) {
  const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
        <div>
          <h2 className="text-sm font-700 text-foreground">Ad Sets</h2>
          <p className="text-[11px] text-muted-foreground">
            Imported ad sets from Meta. New ads will be created under these existing ad sets.
          </p>
        </div>
      </div>

      {/* Info bar */}
      <ReadOnlyBanner />

      {/* Table */}
      {adSets.length === 0 ? (
        <EmptyState entity="ad sets" />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: "35%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <Th muted>#</Th>
                <Th>Name</Th>
                <Th>Campaign</Th>
                <Th>Status</Th>
                <Th muted>Ad Set ID</Th>
              </tr>
            </thead>
            <tbody>
              {adSets.map((adSet, i) => (
                <tr
                  key={adSet.id}
                  className="border-b border-border hover:bg-surface-2/40 transition-colors"
                >
                  <td className="px-3 py-2.5 text-center text-[10px] text-muted-foreground/50 font-mono border-r border-border">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-foreground font-500 border-r border-border truncate">
                    {adSet.name}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-foreground/60 border-r border-border truncate">
                    {campaignMap.get(adSet.campaignId) || adSet.campaignId}
                  </td>
                  <td className="px-3 py-2.5 border-r border-border">
                    <StatusDot status={adSet.status} />
                  </td>
                  <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 font-mono">
                    {adSet.id}
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatObjective(objective: string): string {
  return objective
    .replace(/^OUTCOME_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
