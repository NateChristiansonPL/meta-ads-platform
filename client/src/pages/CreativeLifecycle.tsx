import AppShell from "@/components/AppShell";
import SkillRunner from "@/components/SkillRunner";
import { RunHistoryDrawer } from "@/components/RunHistoryDrawer";

const CONFIG = {
  skillId: "creative-lifecycle",
  skillName: "Creative Lifecycle",
  description: "Creative fatigue detection using five complementary methods — CDR with Beta-Binomial significance testing, BOCPD, CUSUM, EWMA, and Frequency-CPM elasticity. Works at any spend level.",
  badge: "pl-creative-lifecycle-v3",
  color: "#00B37A",
  hasDateRange: true,
};

export default function CreativeLifecycle() {
  return (
    <AppShell title="Creative Lifecycle" subtitle="Fatigue detection" badge="pl-creative-lifecycle-v3" headerActions={<RunHistoryDrawer skillId="creative-lifecycle" skillName="Creative Lifecycle" />}>
      <SkillRunner config={CONFIG} />
    </AppShell>
  );
}
