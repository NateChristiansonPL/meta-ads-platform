import { describe, it, expect } from "vitest";
import {
  projectFromSlope,
  classifyVelocity,
  velocityGuidance,
  computeImpact,
  findFirstCrossings,
} from "./decayVelocity";

// ── projectFromSlope ────────────────────────────────────────────────────────

describe("projectFromSlope", () => {
  it("returns empty projection when series has fewer than 3 points", () => {
    const result = projectFromSlope(
      [
        { date: "2025-01-01", fatigueScore: 10 },
        { date: "2025-01-02", fatigueScore: 15 },
      ],
      15,
    );
    expect(result.slope).toBe(0);
    expect(result.rSquared).toBe(0);
    expect(result.daysToPossible).toBeNull();
  });

  it("computes a positive slope for an increasing series", () => {
    const series = [
      { date: "2025-01-01", fatigueScore: 20 },
      { date: "2025-01-02", fatigueScore: 25 },
      { date: "2025-01-03", fatigueScore: 30 },
      { date: "2025-01-04", fatigueScore: 35 },
      { date: "2025-01-05", fatigueScore: 40 },
    ];
    const result = projectFromSlope(series, 40);
    expect(result.slope).toBeGreaterThan(0);
    expect(result.rSquared).toBeGreaterThan(0.9);
    // Score is 40, threshold is 50, slope is 5 → ~2 days
    expect(result.daysToPossible).toBeGreaterThan(0);
    expect(result.projectedPossibleDate).toBeTruthy();
  });

  it("returns null projections when slope is too flat", () => {
    const series = [
      { date: "2025-01-01", fatigueScore: 20 },
      { date: "2025-01-02", fatigueScore: 20 },
      { date: "2025-01-03", fatigueScore: 20 },
      { date: "2025-01-04", fatigueScore: 20.1 },
      { date: "2025-01-05", fatigueScore: 20 },
    ];
    const result = projectFromSlope(series, 20);
    expect(result.projectedPossibleDate).toBeNull();
    expect(result.projectedProbableDate).toBeNull();
  });

  it("returns 0 daysToPossible when current score already exceeds threshold", () => {
    const series = [
      { date: "2025-01-01", fatigueScore: 50 },
      { date: "2025-01-02", fatigueScore: 55 },
      { date: "2025-01-03", fatigueScore: 60 },
      { date: "2025-01-04", fatigueScore: 65 },
      { date: "2025-01-05", fatigueScore: 70 },
    ];
    const result = projectFromSlope(series, 70);
    expect(result.daysToPossible).toBe(0);
    expect(result.daysToProbable).toBe(0);
  });
});

// ── classifyVelocity ────────────────────────────────────────────────────────

describe("classifyVelocity", () => {
  it("returns 'fast' for slope >= 3.0 with good R²", () => {
    expect(
      classifyVelocity({ slope: 4.5, rSquared: 0.8, emergingDate: null, possibleDate: null }),
    ).toBe("fast");
  });

  it("returns 'moderate' for slope between 1.0 and 3.0", () => {
    expect(
      classifyVelocity({ slope: 2.0, rSquared: 0.5, emergingDate: null, possibleDate: null }),
    ).toBe("moderate");
  });

  it("returns 'slow' for slope < 1.0 with good R²", () => {
    expect(
      classifyVelocity({ slope: 0.7, rSquared: 0.4, emergingDate: null, possibleDate: null }),
    ).toBe("slow");
  });

  it("falls back to date gap when R² is too low", () => {
    // 3-day gap → fast
    expect(
      classifyVelocity({
        slope: 0.1,
        rSquared: 0.1,
        emergingDate: "2025-01-01",
        possibleDate: "2025-01-04",
      }),
    ).toBe("fast");
  });

  it("returns 'moderate' for a 7-day gap fallback", () => {
    expect(
      classifyVelocity({
        slope: 0.1,
        rSquared: 0.1,
        emergingDate: "2025-01-01",
        possibleDate: "2025-01-08",
      }),
    ).toBe("moderate");
  });

  it("returns 'slow' for a 14-day gap fallback", () => {
    expect(
      classifyVelocity({
        slope: 0.1,
        rSquared: 0.1,
        emergingDate: "2025-01-01",
        possibleDate: "2025-01-15",
      }),
    ).toBe("slow");
  });

  it("returns null when no signal is available", () => {
    expect(
      classifyVelocity({ slope: 0.1, rSquared: 0.1, emergingDate: null, possibleDate: null }),
    ).toBeNull();
  });
});

// ── velocityGuidance ────────────────────────────────────────────────────────

describe("velocityGuidance", () => {
  it("returns fast-burn guidance for 'fast'", () => {
    const g = velocityGuidance("fast", "URGENT");
    expect(g).toContain("Fast-burn");
  });

  it("returns moderate guidance for 'moderate'", () => {
    const g = velocityGuidance("moderate", "REFRESH");
    expect(g).toContain("Moderate decay");
  });

  it("returns slow-burn guidance for 'slow'", () => {
    const g = velocityGuidance("slow", "MONITOR");
    expect(g).toContain("Slow-burn");
  });

  it("returns null for null velocity", () => {
    expect(velocityGuidance(null, "HEALTHY")).toBeNull();
  });
});

// ── computeImpact ───────────────────────────────────────────────────────────

describe("computeImpact", () => {
  const baseArgs = {
    earlyCpe: 5.0,
    recentCpe: 7.5,
    earlyCpm: 10.0,
    recentCpm: 12.0,
    earlyCtr: 0.02,
    recentCtr: 0.015,
    earlyFrequency: 1.5,
    recentFrequency: 2.2,
    earlyImpressions: 5000,
    recentImpressions: 3000,
    earlyEvents: 50,
    recentEvents: 30,
    recentSpend: 225,
    hasCpe: true,
    fatigueStatus: "URGENT",
    eligible: true,
    reliability: 0.8,
  };

  it("returns impact with CPE, events, CTR, frequency for a fatigued creative", () => {
    const impact = computeImpact(baseArgs);
    expect(impact).not.toBeNull();
    expect(impact!.confidence).toBe("high");
    expect(impact!.cpe).not.toBeNull();
    expect(impact!.cpe!.changePct).toBeGreaterThan(0); // CPE increased (bad)
    expect(impact!.events).not.toBeNull();
    expect(impact!.events!.changePct).toBeLessThan(0); // Fewer events than expected (bad)
    expect(impact!.ctr).not.toBeNull();
    expect(impact!.ctr!.changePct).toBeLessThan(0); // CTR dropped
    expect(impact!.frequency).not.toBeNull();
    expect(impact!.frequency!.changePct).toBeGreaterThan(0); // Frequency increased
  });

  it("returns null for HEALTHY status", () => {
    const impact = computeImpact({ ...baseArgs, fatigueStatus: "HEALTHY" });
    expect(impact).toBeNull();
  });

  it("returns null when not eligible", () => {
    const impact = computeImpact({ ...baseArgs, eligible: false });
    expect(impact).toBeNull();
  });

  it("returns null when recent impressions are too low", () => {
    const impact = computeImpact({ ...baseArgs, recentImpressions: 50 });
    expect(impact).toBeNull();
  });

  it("returns medium confidence for reliability between 0.4 and 0.7", () => {
    const impact = computeImpact({ ...baseArgs, reliability: 0.5 });
    expect(impact!.confidence).toBe("medium");
  });

  it("returns low confidence for reliability below 0.4", () => {
    const impact = computeImpact({ ...baseArgs, reliability: 0.2 });
    expect(impact!.confidence).toBe("low");
  });

  it("returns CPM impact when hasCpe is false (reach/impressions goal)", () => {
    const impact = computeImpact({
      ...baseArgs,
      hasCpe: false,
      earlyCpe: null,
      recentCpe: null,
    });
    expect(impact!.cpe).toBeNull();
    expect(impact!.events).toBeNull();
    expect(impact!.cpm).not.toBeNull();
    expect(impact!.cpm!.changePct).toBeGreaterThan(0); // CPM increased
  });
});

// ── findFirstCrossings ──────────────────────────────────────────────────────

describe("findFirstCrossings", () => {
  it("finds all three thresholds in an ascending series", () => {
    const series = [
      { date: "2025-01-01", fatigueScore: 10 },
      { date: "2025-01-02", fatigueScore: 25 },
      { date: "2025-01-03", fatigueScore: 35 },
      { date: "2025-01-04", fatigueScore: 55 },
      { date: "2025-01-05", fatigueScore: 75 },
    ];
    const result = findFirstCrossings(series);
    expect(result.emerging).toBe("2025-01-03");
    expect(result.possible).toBe("2025-01-04");
    expect(result.probable).toBe("2025-01-05");
  });

  it("returns nulls when no thresholds are crossed", () => {
    const series = [
      { date: "2025-01-01", fatigueScore: 5 },
      { date: "2025-01-02", fatigueScore: 10 },
      { date: "2025-01-03", fatigueScore: 15 },
    ];
    const result = findFirstCrossings(series);
    expect(result.emerging).toBeNull();
    expect(result.possible).toBeNull();
    expect(result.probable).toBeNull();
  });

  it("returns only emerging when score stays below 50", () => {
    const series = [
      { date: "2025-01-01", fatigueScore: 28 },
      { date: "2025-01-02", fatigueScore: 32 },
      { date: "2025-01-03", fatigueScore: 45 },
    ];
    const result = findFirstCrossings(series);
    expect(result.emerging).toBe("2025-01-02");
    expect(result.possible).toBeNull();
    expect(result.probable).toBeNull();
  });

  it("handles empty series gracefully", () => {
    const result = findFirstCrossings([]);
    expect(result.emerging).toBeNull();
    expect(result.possible).toBeNull();
    expect(result.probable).toBeNull();
  });
});
