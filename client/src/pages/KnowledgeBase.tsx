import AppShell from "@/components/AppShell";
import { useState } from "react";
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Hammer,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Bot,
  Key,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  entries: DocEntry[];
}

interface DocEntry {
  title: string;
  body: React.ReactNode;
}

// ── Content ────────────────────────────────────────────────────────────────────

const SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    color: "#00BEEF",
    entries: [
      {
        title: "What is Pathlabs Intelligence?",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Pathlabs Intelligence is an AI-powered Meta Ads analysis platform. It connects to your Meta Business Manager accounts and runs structured analysis agents — called <strong style={{ color: "#FAFAFA" }}>Skills</strong> — that produce actionable reports on campaign performance, creative fatigue, audience overlap, and more.
            </p>
            <p>
              Each skill is a pre-built Manus agent workflow. When you run a skill, the platform dispatches an agent that pulls data directly from the Meta Graph API, runs statistical analysis, and returns a structured Markdown report with prioritized recommendations.
            </p>
            <p>
              The platform is designed for media buyers and strategists who want deep, data-driven insights without manually pulling reports or building custom scripts.
            </p>
          </div>
        ),
      },
      {
        title: "How to run your first skill",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <ol className="list-decimal list-inside space-y-2">
              <li>Select a skill from the left sidebar (e.g., <strong style={{ color: "#FAFAFA" }}>Weekly Optimization</strong>).</li>
              <li>Under <strong style={{ color: "#FAFAFA" }}>Account Selection</strong>, choose the Business Manager token that has access to your ad account, then select the specific ad account.</li>
              <li>Set the <strong style={{ color: "#FAFAFA" }}>Analysis Period</strong> — most users start with "Last 7 Days".</li>
              <li>Optionally select specific campaigns, toggle modules on/off, or add additional instructions.</li>
              <li>Click <strong style={{ color: "#FAFAFA" }}>Run Analysis</strong>. The agent will start and the live status panel will update as it progresses.</li>
              <li>When the run completes, the report appears on the right side of the screen. You can download it as a Markdown file or view it inline.</li>
            </ol>
            <p className="mt-2">
              The most recent run for each skill persists on the page until you run it again — so you can navigate away and come back without losing your last report.
            </p>
          </div>
        ),
      },
      {
        title: "Credits explained",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Credits are consumed each time you run a skill. One credit corresponds roughly to one agent action — an API call, a script execution, or a data processing step. More complex skills (e.g., Performance Insights with all modules enabled) consume more credits than simpler ones.
            </p>
            <p>
              Your credit usage is shown in the top-right corner of the platform. The counter resets at the start of each billing period. If you need your limit adjusted, contact your platform administrator.
            </p>
            <p>
              To reduce credit usage: disable analysis modules you don't need, narrow the date range, or select specific campaigns instead of running across all active campaigns.
            </p>
          </div>
        ),
      },
      {
        title: "Live status and run monitoring",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              While a skill is running, the <strong style={{ color: "#FAFAFA" }}>Live Status</strong> panel shows real-time updates from the agent — including what it's currently doing, any errors it encountered, and how long it has been running.
            </p>
            <p>
              If a run is taking longer than expected, click the <strong style={{ color: "#FAFAFA" }}>Request Update</strong> button. This sends a message to the running agent asking it to report its current status. The response will appear in the live status feed within a few seconds.
            </p>
            <p>
              If a run fails, the error message is shown in the status panel. You can click <strong style={{ color: "#FAFAFA" }}>Retry</strong> to re-run the skill with the same settings, or <strong style={{ color: "#FAFAFA" }}>Re-fetch Report</strong> if the run completed but the report wasn't delivered (this attempts to retrieve the output files from the completed Manus task).
            </p>
            <p>
              You can also click <strong style={{ color: "#FAFAFA" }}>View on Manus</strong> to open the full agent run in the Manus interface and see every step the agent took.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "weekly-optimization",
    title: "Weekly Optimization",
    icon: TrendingUp,
    color: "#00BEEF",
    entries: [
      {
        title: "What it does",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Weekly Optimization delivers breakdown-level performance insights across your Meta campaigns. It analyzes performance by demographics, placement, time of day, creative, and action type, then applies statistical significance testing to surface only the findings that are meaningful — not just noise.
            </p>
            <p>
              The output is a prioritized list of recommendations ranked by estimated impact, with supporting data for each recommendation.
            </p>
          </div>
        ),
      },
      {
        title: "When to use it",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Run this skill once a week as part of your standard optimization workflow. It's designed for weekly optimization calls — concise, actionable, and to the point. The recommended date range is "Last 7 Days" with the "Compare to prior period" toggle enabled.
            </p>
          </div>
        ),
      },
      {
        title: "Key outputs",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <ul className="list-disc list-inside space-y-1">
              <li>Breakdown performance by age, gender, placement, device, and time</li>
              <li>Creative performance ranking with statistical significance flags</li>
              <li>Budget pacing analysis (over/under-pacing ad sets)</li>
              <li>Prioritized recommendations with estimated impact</li>
            </ul>
          </div>
        ),
      },
    ],
  },
  {
    id: "performance-insights",
    title: "Performance Insights",
    icon: BarChart2,
    color: "#F7901E",
    entries: [
      {
        title: "What it does",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Performance Insights is the most comprehensive analysis skill on the platform. It runs a KPI-anchored analysis anchored to each ad set's actual optimization event, incorporates Meta delivery system mechanics (auction dynamics, learning phase, pacing), and produces placement-level conversion data.
            </p>
            <p>
              The analysis is modular — you can enable or disable individual analysis components (timing, saturation, lifecycle, etc.) to control depth and credit usage.
            </p>
          </div>
        ),
      },
      {
        title: "Analysis modules",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>Each module runs a focused analysis on a specific dimension of performance:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong style={{ color: "#FAFAFA" }}>Performance</strong> — Core KPI analysis anchored to the optimization event</li>
              <li><strong style={{ color: "#FAFAFA" }}>Placement</strong> — Conversion rates and CPMs by placement (Feed, Stories, Reels, etc.)</li>
              <li><strong style={{ color: "#FAFAFA" }}>Timing</strong> — Hour-of-day and day-of-week performance patterns</li>
              <li><strong style={{ color: "#FAFAFA" }}>Saturation</strong> — Frequency and CPM elasticity analysis</li>
              <li><strong style={{ color: "#FAFAFA" }}>Lifecycle</strong> — Campaign age and delivery trend analysis</li>
              <li><strong style={{ color: "#FAFAFA" }}>Creative</strong> — Creative performance ranking and fatigue signals</li>
            </ul>
          </div>
        ),
      },
      {
        title: "Enrichment with prior runs",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Performance Insights can be enriched with data from recent Audience Overlap and Creative Lifecycle runs for the same ad account. When you select prior runs in the <strong style={{ color: "#FAFAFA" }}>Enrich Analysis</strong> section, the agent will cross-reference those findings — for example, flagging creatives that are both fatigued (from Creative Lifecycle) and running in overlapping audiences (from Audience Overlap).
            </p>
            <p>
              Only runs for the same ad account from the last 30 days are shown. The enrichment data is injected into the agent's prompt and does not require re-running those skills.
            </p>
          </div>
        ),
      },
      {
        title: "When to use it",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Use Performance Insights for deep-dive analysis — monthly reviews, pre/post campaign evaluations, or when you need to understand the root cause of a performance shift. For weekly check-ins, Weekly Optimization is faster and more concise.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "creative-lifecycle",
    title: "Creative Lifecycle",
    icon: RefreshCw,
    color: "#00B37A",
    entries: [
      {
        title: "What it does",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Creative Lifecycle detects creative fatigue using five complementary statistical methods: CDR (Click-Through Rate Decay Ratio) with Beta-Binomial significance testing, BOCPD (Bayesian Online Change Point Detection), CUSUM, EWMA, and Frequency-CPM elasticity with R-squared filtering.
            </p>
            <p>
              All five methods are triangulated into a composite fatigue assessment for each creative, with a data-blocked fallback for campaigns that haven't accumulated enough impressions for statistical significance.
            </p>
          </div>
        ),
      },
      {
        title: "Key outputs",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <ul className="list-disc list-inside space-y-1">
              <li>Per-creative fatigue score and composite assessment</li>
              <li>Change point detection (when did performance start declining?)</li>
              <li>Frequency-CPM elasticity (how much does CPM rise as frequency increases?)</li>
              <li>Recommended action per creative: keep, monitor, or replace</li>
            </ul>
          </div>
        ),
      },
      {
        title: "When to use it",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Run Creative Lifecycle when you're planning a creative refresh or want to prioritize which creatives to replace first. It's also useful as enrichment data for Performance Insights runs.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "structural-audit",
    title: "Structural Audit",
    icon: Shield,
    color: "#ED135F",
    entries: [
      {
        title: "What it does",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Structural Audit runs a fixed set of nine Andromeda-framework checks against your account structure. These checks evaluate the health of your account's data infrastructure, signal density, creative velocity, budget liquidity, and learning phase risk.
            </p>
            <p>
              The audit is deterministic — the same nine checks run every time, in the same order, with the same scoring methodology. This makes it easy to track structural health over time.
            </p>
          </div>
        ),
      },
      {
        title: "The nine checks",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <ol className="list-decimal list-inside space-y-1">
              <li>Data Infrastructure &amp; EMQ (Event Match Quality)</li>
              <li>Signal Density</li>
              <li>Creative Velocity &amp; Format Diversity</li>
              <li>Liquidity Consolidation Index</li>
              <li>Budget Liquidity Ratio</li>
              <li>Late-Stage Funnel Signal Velocity</li>
              <li>Creative Fatigue Index</li>
              <li>ASC Adoption Rate</li>
              <li>Learning Phase &amp; Reset Risk</li>
            </ol>
          </div>
        ),
      },
      {
        title: "When to use it",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Run Structural Audit monthly or when onboarding a new account. It gives a high-level health score that helps prioritize structural fixes before running deeper performance analysis.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "audience-overlap",
    title: "Audience Overlap",
    icon: Users,
    color: "#A78BFA",
    entries: [
      {
        title: "What it does",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Audience Overlap computes pairwise audience overlap between all active ad sets in your account using a dual-method cross-validated methodology. It then estimates wasted spend from self-competition in Meta's auction using a per-ad-set overlap-based CPM model with objective-aware frequency decay.
            </p>
          </div>
        ),
      },
      {
        title: "Key outputs",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <ul className="list-disc list-inside space-y-1">
              <li>Pairwise overlap matrix for all active ad sets</li>
              <li>Estimated wasted spend per ad set from self-competition</li>
              <li>Recommended consolidation opportunities</li>
            </ul>
          </div>
        ),
      },
      {
        title: "When to use it",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Run Audience Overlap when you suspect your ad sets are competing against each other in Meta's auction, or when CPMs are rising without a clear external explanation. The output can also be used to enrich Performance Insights runs.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    icon: Hammer,
    color: "#F7901E",
    entries: [
      {
        title: "Campaign Builder (In Development)",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Campaign Builder is a structured campaign creation tool that lets you build and launch Meta campaigns directly from the platform. It is currently in active development and not yet ready for production use.
            </p>
            <p>
              When available, it will support campaign, ad set, and ad creation with a spreadsheet-style interface, direct Meta API integration, and session-based draft saving.
            </p>
          </div>
        ),
      },
      {
        title: "Manus AI",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Manus AI is a free-form AI assistant available directly in the platform. Use it for ad strategy questions, copywriting, audience research, or anything else you'd ask a knowledgeable media buying assistant.
            </p>
            <p>
              Unlike the skills, Manus AI does not have direct access to your Meta account data. It works from your prompts and general knowledge. For data-grounded analysis, use the skills.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "concepts",
    title: "Key Concepts",
    icon: Info,
    color: "#00B37A",
    entries: [
      {
        title: "Business Manager Tokens",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              A Business Manager (BM) token is a Meta API access token scoped to a specific Business Manager. It grants the platform permission to read your ad account data via the Meta Graph API.
            </p>
            <p>
              Tokens are managed by your platform administrator in the Token Vault (Admin → Token Vault). Each token is associated with a Business Manager name and can be assigned to specific skills. If you don't see your ad account in the dropdown, ask your admin to add the corresponding BM token.
            </p>
            <p>
              Tokens expire periodically and must be refreshed by the admin. If a skill fails with an authentication error, the token may need to be renewed.
            </p>
          </div>
        ),
      },
      {
        title: "Ad Account Selection",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Each skill requires you to select an ad account. The available accounts are loaded from the Business Manager associated with the selected token. If you manage multiple accounts under different BMs, switch the token first.
            </p>
            <p>
              The ad account ID (in the format <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: 3 }}>act_XXXXXXXXXX</code>) is passed directly to the Meta Graph API. The platform never stores your ad data — it fetches it fresh on each run.
            </p>
          </div>
        ),
      },
      {
        title: "Run History",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>
              Every skill run is saved to your account history. You can access past runs by clicking the <strong style={{ color: "#FAFAFA" }}>Run History</strong> button at the top of each skill page. History is stored per-user and per-skill, and includes the report output, attachments, credit usage, and run metadata.
            </p>
            <p>
              The most recent run for each skill persists on the page until you run it again — so you can navigate away and come back without losing your last report.
            </p>
          </div>
        ),
      },
      {
        title: "Metric abbreviations used in reports",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <p>Reports use standard industry abbreviations:</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs">
              {[
                ["CPM", "Cost per 1,000 impressions"],
                ["CPC", "Cost per click"],
                ["CTR", "Click-through rate"],
                ["CPA", "Cost per acquisition"],
                ["CPL", "Cost per lead"],
                ["CPLV", "Cost per landing page view"],
                ["CPVV", "Cost per video view"],
                ["CPVR", "Cost per video completion"],
                ["Unique CPC", "Cost per unique click"],
                ["EMQ", "Event Match Quality"],
                ["ASC", "Advantage+ Shopping Campaign"],
                ["CDR", "Click-through rate decay ratio"],
              ].map(([abbr, def]) => (
                <div key={abbr} className="flex gap-2">
                  <span className="font-bold shrink-0" style={{ color: "#FAFAFA", minWidth: 80 }}>{abbr}</span>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>{def}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Skill run statuses",
        body: (
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            <div className="space-y-2">
              {[
                { icon: <Zap size={13} style={{ color: "#00BEEF" }} />, label: "Running", desc: "The agent is actively processing. Check the Live Status panel for real-time updates." },
                { icon: <CheckCircle2 size={13} style={{ color: "#00B37A" }} />, label: "Completed", desc: "The run finished successfully and the report is available." },
                { icon: <AlertCircle size={13} style={{ color: "#ED135F" }} />, label: "Failed", desc: "The run encountered an error. Check the error message and use Retry or Re-fetch Report." },
                { icon: <Clock size={13} style={{ color: "rgba(255,255,255,0.4)" }} />, label: "Aborted", desc: "The run was manually stopped by the user." },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div>
                    <span className="font-semibold text-xs" style={{ color: "#FAFAFA" }}>{label} — </span>
                    <span className="text-xs">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const [openEntries, setOpenEntries] = useState<Set<string>>(new Set([`${SECTIONS[0].id}-0`]));

  const toggleEntry = (key: string) => {
    setOpenEntries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const currentSection = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <AppShell title="Knowledge Base" subtitle="Platform documentation and guides" badge="docs">
      <div className="flex gap-6 h-full min-h-0" style={{ maxWidth: 1100 }}>
        {/* ── Left nav ── */}
        <div
          className="flex flex-col gap-1 shrink-0"
          style={{ width: 220 }}
        >
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === activeSection;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all"
                style={{
                  background: active ? `${s.color}18` : "transparent",
                  border: active ? `1px solid ${s.color}30` : "1px solid transparent",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <div
                  className="rounded flex items-center justify-center shrink-0"
                  style={{ width: 26, height: 26, background: active ? `${s.color}25` : "rgba(255,255,255,0.06)" }}
                >
                  <Icon size={13} style={{ color: active ? s.color : "rgba(255,255,255,0.45)" }} />
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: active ? s.color : "rgba(255,255,255,0.7)" }}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="rounded-lg flex items-center justify-center shrink-0"
              style={{ width: 36, height: 36, background: `${currentSection.color}20` }}
            >
              <currentSection.icon size={18} style={{ color: currentSection.color }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#FAFAFA" }}>{currentSection.title}</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {currentSection.entries.length} {currentSection.entries.length === 1 ? "topic" : "topics"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {currentSection.entries.map((entry, i) => {
              const key = `${currentSection.id}-${i}`;
              const open = openEntries.has(key);
              return (
                <div
                  key={key}
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                >
                  <button
                    onClick={() => toggleEntry(key)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors"
                    style={{ background: open ? "rgba(255,255,255,0.04)" : "transparent" }}
                    onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>{entry.title}</span>
                    {open
                      ? <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                      : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                    }
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1">
                      {entry.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
