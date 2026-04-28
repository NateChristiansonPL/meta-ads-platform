import AppShell from "@/components/AppShell";
import SkillRunner from "@/components/SkillRunner";
import { RunHistoryDrawer } from "@/components/RunHistoryDrawer";

const MODULES = [
  { id: "creative", label: "Creative", sub: "Ad-level CPM, KPI, relevance diagnostics, fatigue signals" },
  { id: "audience", label: "Audience", sub: "Ad set CPM, frequency, saturation, overlap estimation" },
  { id: "placement", label: "Placement", sub: "Platform/position CPM with Breakdown Effect caveats" },
  { id: "budget", label: "Budget & Bidding", sub: "Bid strategy, pacing, CBO distribution, underspend" },
  { id: "timing", label: "Timing", sub: "Hourly CPM patterns with pacing context" },
  { id: "funnel", label: "Funnel", sub: "Dynamic funnel stages, bottleneck identification" },
];

const CONFIG = {
  skillId: "performance-insights",
  skillName: "Performance Insights",
  description: "KPI-anchored Meta Ads performance analysis with placement conversion data, budget pacing, lifecycle enrichment, and structured signals.",
  badge: "pl-performance-analysis-insights-v3",
  color: "#F7901E",
  hasDateRange: true,
  hasModules: true,
  modules: MODULES,
  hasEnrichment: true,
};

export default function PerformanceInsights() {
  return (
    <AppShell title="Performance Insights" subtitle="KPI-anchored analysis" badge="pl-performance-analysis-insights-v3" headerActions={<RunHistoryDrawer skillId="performance-insights" skillName="Performance Insights" />}>
      <SkillRunner config={CONFIG} />
    </AppShell>
  );
}
