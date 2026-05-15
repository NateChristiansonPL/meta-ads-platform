/**
 * fatigueEscalation.ts
 *
 * Shared utilities for building fatigue escalation timelines and projecting
 * when a creative is likely to reach the next level of fatigue.
 *
 * Projection methodology:
 *   - If the creative has escalated at least once (e.g., Emerging → Possible),
 *     use the observed days-per-level as the velocity for the next projection.
 *   - If the creative has only one level detected, fall back to the median
 *     escalation velocity across all other records in the same analysis run.
 *   - If no peer data is available, fall back to a conservative 7-day default.
 *   - Projections are labeled as estimates and capped at 60 days out.
 */

export type FirstDetectedAt = {
  emerging?: string | null;
  possible?: string | null;
  probable?: string | null;
};

export type EscalationTimeline = {
  /** Ordered list of level transitions with their dates */
  steps: Array<{ level: "emerging" | "possible" | "probable"; date: Date }>;
  /** Projected date for the next level (null if already at probable or no data) */
  projectedNextLevel: "possible" | "probable" | null;
  projectedNextDate: Date | null;
  /** Days used for the projection velocity */
  projectedVelocityDays: number | null;
  /** Whether the projection used peer data (true) or own history (false) */
  projectedFromPeers: boolean;
};

const LEVEL_ORDER: Array<"emerging" | "possible" | "probable"> = [
  "emerging",
  "possible",
  "probable",
];

function nextLevel(
  current: "emerging" | "possible" | "probable",
): "possible" | "probable" | null {
  if (current === "emerging") return "possible";
  if (current === "possible") return "probable";
  return null;
}

/**
 * Build the escalation timeline for a single creative.
 *
 * @param firstDetectedAt  The firstDetectedAt object from the analysis record.
 * @param currentStatus    The creative's current fatigueStatus (URGENT | REFRESH | MONITOR).
 * @param peerVelocities   Optional array of observed days-per-escalation from peer creatives
 *                         in the same run (used as fallback when own history is too short).
 */
export function buildEscalationTimeline(
  firstDetectedAt: FirstDetectedAt | null | undefined,
  currentStatus: string,
  peerVelocities: number[] = [],
): EscalationTimeline {
  const fda = firstDetectedAt ?? {};

  // Build the ordered steps that have actual dates
  const steps: EscalationTimeline["steps"] = [];
  for (const level of LEVEL_ORDER) {
    const raw = fda[level];
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) steps.push({ level, date: d });
    }
  }

  // Determine current level from fatigueStatus
  const currentLevel: "emerging" | "possible" | "probable" | null =
    currentStatus === "URGENT"
      ? "probable"
      : currentStatus === "REFRESH"
        ? "possible"
        : currentStatus === "MONITOR"
          ? "emerging"
          : null;

  if (!currentLevel || steps.length === 0) {
    return {
      steps,
      projectedNextLevel: null,
      projectedNextDate: null,
      projectedVelocityDays: null,
      projectedFromPeers: false,
    };
  }

  const next = nextLevel(currentLevel);
  if (!next) {
    // Already at probable — no further escalation to project
    return {
      steps,
      projectedNextLevel: null,
      projectedNextDate: null,
      projectedVelocityDays: null,
      projectedFromPeers: false,
    };
  }

  // If the next level already has a date, no projection needed
  if (fda[next]) {
    return {
      steps,
      projectedNextLevel: null,
      projectedNextDate: null,
      projectedVelocityDays: null,
      projectedFromPeers: false,
    };
  }

  // Try to derive velocity from own escalation history
  let velocityDays: number | null = null;
  let fromPeers = false;

  if (steps.length >= 2) {
    // Use the most recent observed escalation gap
    const gaps: number[] = [];
    for (let i = 1; i < steps.length; i++) {
      const gap = Math.round(
        (steps[i].date.getTime() - steps[i - 1].date.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length > 0) {
      // Use the most recent gap as the best predictor
      velocityDays = gaps[gaps.length - 1];
    }
  }

  // Fall back to peer median if own history is insufficient
  if (velocityDays === null && peerVelocities.length > 0) {
    const sorted = [...peerVelocities].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    velocityDays =
      sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
    fromPeers = true;
  }

  // Hard fallback: 7 days
  if (velocityDays === null) {
    velocityDays = 7;
    fromPeers = true;
  }

  // Cap at 60 days to avoid absurd projections
  velocityDays = Math.min(velocityDays, 60);

  // Project from the most recent detected level's date
  const anchorStep = steps[steps.length - 1];
  const projectedDate = new Date(anchorStep.date);
  projectedDate.setDate(projectedDate.getDate() + velocityDays);

  return {
    steps,
    projectedNextLevel: next,
    projectedNextDate: projectedDate,
    projectedVelocityDays: velocityDays,
    projectedFromPeers: fromPeers,
  };
}

/**
 * Compute peer escalation velocities from a set of analysis records.
 * Returns an array of observed days-per-escalation across all records
 * that have at least two detected levels.
 */
export function computePeerVelocities(
  records: Array<{ firstDetectedAt?: FirstDetectedAt | null }>,
): number[] {
  const velocities: number[] = [];
  for (const r of records) {
    const fda = r.firstDetectedAt ?? {};
    const dates: Date[] = [];
    for (const level of LEVEL_ORDER) {
      const raw = fda[level];
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) dates.push(d);
      }
    }
    for (let i = 1; i < dates.length; i++) {
      const gap = Math.round(
        (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24),
      );
      if (gap > 0) velocities.push(gap);
    }
  }
  return velocities;
}

/**
 * Format a short date string: "May 15" or "May 15, 2025" (year only if not current year).
 */
export function fmtDate(date: Date): string {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() !== now.getFullYear()
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", opts);
}

/**
 * Build a compact plain-text escalation timeline string for Slack.
 * Example: "Emerging: May 3  →  Possible: May 9  →  Probable: May 15"
 */
export function formatTimelineText(timeline: EscalationTimeline): string {
  const LABELS: Record<string, string> = {
    emerging: "Emerging",
    possible: "Possible",
    probable: "Probable",
  };
  const parts = timeline.steps.map(
    (s) => `${LABELS[s.level]}: ${fmtDate(s.date)}`,
  );
  return parts.join("  →  ");
}

/**
 * Build a projection line for Slack.
 * Example: "⏱ Est. Probable: ~May 22 (based on 7-day escalation rate)"
 */
export function formatProjectionText(timeline: EscalationTimeline): string | null {
  if (!timeline.projectedNextLevel || !timeline.projectedNextDate) return null;
  const LABELS: Record<string, string> = {
    possible: "Possible",
    probable: "Probable",
  };
  const label = LABELS[timeline.projectedNextLevel];
  const dateStr = fmtDate(timeline.projectedNextDate);
  const basis = timeline.projectedFromPeers
    ? "est. from peer avg"
    : `${timeline.projectedVelocityDays}d escalation rate`;
  return `⏱ Est. ${label}: ~${dateStr} (${basis})`;
}
