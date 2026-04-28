import AppShell from "@/components/AppShell";
import SkillRunner from "@/components/SkillRunner";
import { RunHistoryDrawer } from "@/components/RunHistoryDrawer";

const CONFIG = {
  skillId: "audience-overlap",
  skillName: "Audience Overlap & Wasted Spend",
  description: "Pairwise audience overlap analysis using dual-method cross-validated methodology, with KPI-aware wasted spend estimation per ad set. Active ad sets only, within-campaign comparisons.",
  badge: "pl-audience-overlap-spend",
  color: "#a78bfa",
  hasDateRange: true,
  dateNote: "Recommend analyzing at least 21+ days of data.",
};

export default function AudienceOverlap() {
  return (
    <AppShell title="Audience Overlap & Wasted Spend" subtitle="Overlap & wasted spend" badge="pl-audience-overlap-spend" headerActions={<RunHistoryDrawer skillId="audience-overlap" skillName="Audience Overlap & Wasted Spend" />}>
      <SkillRunner config={CONFIG} />
    </AppShell>
  );
}
