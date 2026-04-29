import AppShell from "@/components/AppShell";
import SkillRunner from "@/components/SkillRunner";
import { RunHistoryDrawer } from "@/components/RunHistoryDrawer";

const CONFIG = {
  skillId: "weekly-optimization",
  skillName: "Weekly Optimization",
  description: "Breakdown-level Meta Ads performance analysis with statistical significance testing and prioritized, impact-ranked recommendations. Designed for weekly optimization calls.",
  badge: "pl-weekly-optimization",
  color: "#00BEEF",
  hasDateRange: true,
  hasCompare: true,
  dateNote: "Recommend analyzing 7–14 days of data, but also works fine with greater date ranges.",
};

export default function WeeklyOptimization() {
  return (
    <AppShell title="Weekly Optimization" subtitle="Breakdown-level insights" badge="pl-weekly-optimization" dateNote={CONFIG.dateNote} headerActions={<RunHistoryDrawer skillId="weekly-optimization" skillName="Weekly Optimization" />}>
      <SkillRunner config={CONFIG} />
    </AppShell>
  );
}
