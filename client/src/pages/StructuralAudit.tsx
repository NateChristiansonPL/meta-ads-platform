import AppShell from "@/components/AppShell";
import SkillRunner from "@/components/SkillRunner";
import { RunHistoryDrawer } from "@/components/RunHistoryDrawer";

const CONFIG = {
  skillId: "structural-audit",
  skillName: "Structural Audit",
  description: "Andromeda-focused Meta Ads structural audit covering Data Infrastructure, Signal Density, Creative Velocity, Liquidity Consolidation, Budget Liquidity, Late-Stage Funnel Signals, Creative Fatigue Index, ASC Adoption, and Learning Phase risk.",
  badge: "meta-ads-structural-audit",
  color: "#ED135F",
  hasDateRange: true,
  dateNote: "Recommend analyzing at least 14+ days of data.",
};

export default function StructuralAudit() {
  return (
    <AppShell title="Structural Audit" subtitle="Andromeda account audit" badge="meta-ads-structural-audit" headerActions={<RunHistoryDrawer skillId="structural-audit" skillName="Structural Audit" />}>
      <SkillRunner config={CONFIG} />
    </AppShell>
  );
}
