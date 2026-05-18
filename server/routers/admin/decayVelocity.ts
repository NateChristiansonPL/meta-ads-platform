/**
 * decayVelocity.ts
 *
 * Shared helpers for creative decay enrichments:
 *   - projectFromSlope()     — OLS-based score trajectory projection (Enrichment 3)
 *   - classifyVelocity()     — fast/moderate/slow classification (Enrichment 4)
 *   - velocityGuidance()     — action language per velocity class (Enrichment 4)
 *   - computeImpact()        — expected vs actual performance comparison (Enrichment 2)
 */

// ── Enrichment 3: Score-Trajectory Projection ────────────────────────────────

export type TrendPoint = { date: string; fatigueScore: number };

export type SlopeProjection = {
  /** Daily change in fatigue score, points per day. Positive = decaying. */
  slope: number;
  /** R² of the linear fit, 0–1. Used to decide whether to trust the slope. */
  rSquared: number;
  /** Days until score reaches the threshold, or null if slope is too flat/noisy. */
  daysToPossible: number | null;
  daysToProbable: number | null;
  /** Projected calendar dates (null when daysTo* is null). */
  projectedPossibleDate: string | null;
  projectedProbableDate: string | null;
};

const POSSIBLE_THRESHOLD = 50;
const PROBABLE_THRESHOLD = 70;
const MIN_R_SQUARED = 0.25;
const MIN_SLOPE = 0.5;
const MAX_PROJECTION_DAYS = 60;

/** Ordinary least squares fit on the last `window` days of the trend series. */
export function projectFromSlope(
  series: TrendPoint[],
  currentScore: number,
  window = 7,
): SlopeProjection {
  const tail = series.slice(-window).filter((p) => Number.isFinite(p.fatigueScore));
  if (tail.length < 3) {
    return emptyProjection();
  }

  const n = tail.length;
  const xs = tail.map((_, i) => i);
  const ys = tail.map((p) => p.fatigueScore);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const slope = denX === 0 ? 0 : num / denX;
  const rSquared = denX === 0 || denY === 0 ? 0 : (num * num) / (denX * denY);

  if (slope < MIN_SLOPE || rSquared < MIN_R_SQUARED) {
    return {
      slope,
      rSquared,
      daysToPossible: null,
      daysToProbable: null,
      projectedPossibleDate: null,
      projectedProbableDate: null,
    };
  }

  const daysToPossible =
    currentScore >= POSSIBLE_THRESHOLD
      ? 0
      : Math.min(MAX_PROJECTION_DAYS, Math.ceil((POSSIBLE_THRESHOLD - currentScore) / slope));
  const daysToProbable =
    currentScore >= PROBABLE_THRESHOLD
      ? 0
      : Math.min(MAX_PROJECTION_DAYS, Math.ceil((PROBABLE_THRESHOLD - currentScore) / slope));

  const today = new Date();
  const addDays = (d: number) => {
    const out = new Date(today);
    out.setDate(out.getDate() + d);
    return out.toISOString().slice(0, 10);
  };

  return {
    slope,
    rSquared,
    daysToPossible,
    daysToProbable,
    projectedPossibleDate: daysToPossible > 0 ? addDays(daysToPossible) : null,
    projectedProbableDate: daysToProbable > 0 ? addDays(daysToProbable) : null,
  };
}

function emptyProjection(): SlopeProjection {
  return {
    slope: 0,
    rSquared: 0,
    daysToPossible: null,
    daysToProbable: null,
    projectedPossibleDate: null,
    projectedProbableDate: null,
  };
}

// ── Enrichment 4: Decay Velocity Classification ──────────────────────────────

export type DecayVelocity = "fast" | "moderate" | "slow" | null;

export function classifyVelocity(args: {
  slope: number;
  rSquared: number;
  emergingDate: string | null;
  possibleDate: string | null;
}): DecayVelocity {
  const { slope, rSquared, emergingDate, possibleDate } = args;

  // Prefer slope-based classification when the fit is trustworthy.
  if (rSquared >= 0.25 && slope > 0) {
    if (slope >= 3.0) return "fast";
    if (slope >= 1.0) return "moderate";
    return "slow";
  }

  // Fallback: use observed Emerging → Possible gap.
  if (emergingDate && possibleDate) {
    const gap = Math.round(
      (new Date(possibleDate).getTime() - new Date(emergingDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (gap <= 4) return "fast";
    if (gap <= 10) return "moderate";
    return "slow";
  }

  return null;
}

/** Suggested action language for each velocity class. */
export function velocityGuidance(velocity: DecayVelocity, _status: string): string | null {
  if (!velocity) return null;
  if (velocity === "fast") {
    return "Fast-burn — likely hook fatigue or audience exhaustion. Refresh creative; frequency capping alone unlikely to help.";
  }
  if (velocity === "moderate") {
    return "Moderate decay — consider audience expansion or A/B testing a variant before full refresh.";
  }
  return "Slow-burn — gradual ad-blindness. Frequency capping or audience refresh may extend useful life.";
}

// ── Enrichment 2: Performance Impact ─────────────────────────────────────────

export type ImpactMetric = {
  expected: number;
  actual: number;
  changePct: number;
};

export type Impact = {
  cpe: ImpactMetric | null;
  events: ImpactMetric | null;
  cpm: ImpactMetric | null;
  ctr: ImpactMetric | null;
  frequency: ImpactMetric | null;
  confidence: "high" | "medium" | "low";
};

export function computeImpact(args: {
  earlyCpe: number | null;
  recentCpe: number | null;
  earlyCpm: number;
  recentCpm: number;
  earlyCtr: number;
  recentCtr: number;
  earlyFrequency: number;
  recentFrequency: number;
  earlyImpressions: number;
  recentImpressions: number;
  earlyEvents: number;
  recentEvents: number;
  recentSpend: number;
  hasCpe: boolean;
  fatigueStatus: string;
  eligible: boolean;
  reliability: number;
}): Impact | null {
  const fatigued = ["MONITOR", "REFRESH", "URGENT"].includes(args.fatigueStatus);
  if (!fatigued || !args.eligible || args.recentImpressions < 100) {
    return null;
  }

  const pctChange = (expected: number, actual: number) =>
    expected === 0 ? 0 : ((actual - expected) / expected) * 100;

  // CPE — only for goals with a CPE signal
  let cpe: ImpactMetric | null = null;
  if (args.hasCpe && args.earlyCpe && args.recentCpe && args.earlyEvents >= 1) {
    cpe = {
      expected: args.earlyCpe,
      actual: args.recentCpe,
      changePct: pctChange(args.earlyCpe, args.recentCpe),
    };
  }

  // Events — counterfactual: how many events the recent spend WOULD have
  // purchased at the early-half CPE.
  let events: ImpactMetric | null = null;
  if (args.hasCpe && args.earlyCpe && args.earlyCpe > 0 && args.earlyEvents >= 1) {
    const expectedEvents = args.recentSpend / args.earlyCpe;
    events = {
      expected: expectedEvents,
      actual: args.recentEvents,
      changePct: pctChange(expectedEvents, args.recentEvents),
    };
  }

  // CPM — only for REACH / IMPRESSIONS goals.
  let cpm: ImpactMetric | null = null;
  if (!args.hasCpe && args.earlyCpm > 0 && args.recentCpm > 0) {
    cpm = {
      expected: args.earlyCpm,
      actual: args.recentCpm,
      changePct: pctChange(args.earlyCpm, args.recentCpm),
    };
  }

  // CTR — universal.
  let ctr: ImpactMetric | null = null;
  if (args.earlyCtr > 0 && args.recentImpressions > 0) {
    ctr = {
      expected: args.earlyCtr * 100,
      actual: args.recentCtr * 100,
      changePct: pctChange(args.earlyCtr, args.recentCtr),
    };
  }

  // Frequency — universal.
  let frequency: ImpactMetric | null = null;
  if (args.earlyFrequency > 0) {
    frequency = {
      expected: args.earlyFrequency,
      actual: args.recentFrequency,
      changePct: pctChange(args.earlyFrequency, args.recentFrequency),
    };
  }

  const confidence: Impact["confidence"] =
    args.reliability >= 0.7 ? "high" : args.reliability >= 0.4 ? "medium" : "low";

  return { cpe, events, cpm, ctr, frequency, confidence };
}

// ── Enrichment 1 helper: Find first threshold crossing ───────────────────────

/**
 * Walk a daily fatigue score series chronologically and find the first date
 * on which the score crossed each threshold.
 */
export function findFirstCrossings(
  series: TrendPoint[],
): { emerging: string | null; possible: string | null; probable: string | null } {
  let emerging: string | null = null;
  let possible: string | null = null;
  let probable: string | null = null;

  for (const point of series) {
    if (!emerging && point.fatigueScore >= 30) emerging = point.date;
    if (!possible && point.fatigueScore >= 50) possible = point.date;
    if (!probable && point.fatigueScore >= 70) probable = point.date;
  }

  return { emerging, possible, probable };
}
