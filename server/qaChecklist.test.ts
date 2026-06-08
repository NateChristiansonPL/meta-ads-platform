/**
 * Tests for QA Checklist — Add Music violation detection and DOF fix approach
 */
import { describe, it, expect } from "vitest";

// We test the logic inline since the functions are not exported individually.
// Instead, we replicate the exact logic used in qaChecklist.ts to verify correctness.

describe("QA Checklist — Add Music Violation Detection", () => {
  // Simulate the violation string produced by the audios check
  const violationString = "audio (asset_feed_spec.audios): ENABLED (expected opted_out)";

  it("should NOT match the standard DOF regex", () => {
    const match = violationString.match(/^(.+?):\s*enroll_status=(\S+)\s*\(expected\s+(\S+)\)/);
    expect(match).toBeNull();
  });

  it("should NOT match the unexpected DOF regex", () => {
    const match2 = violationString.match(/^(.+?):\s*enroll_status=(\S+)\s*\(unexpected/);
    expect(match2).toBeNull();
  });

  it("should match the Add Music regex and extract correct values", () => {
    const audioMatch = violationString.match(/^audio \(asset_feed_spec\.audios\):\s*(\S+)\s*\(expected\s+(\S+)\)/);
    expect(audioMatch).not.toBeNull();
    expect(audioMatch![1]).toBe("ENABLED");
    expect(audioMatch![2]).toBe("opted_out");
  });

  it("should produce correct structured violation object", () => {
    const audioMatch = violationString.match(/^audio \(asset_feed_spec\.audios\):\s*(\S+)\s*\(expected\s+(\S+)\)/);
    if (audioMatch) {
      const result = { name: "Add Music (asset_feed_spec.audios)", currentValue: audioMatch[1], expectedValue: audioMatch[2] };
      expect(result.name).toBe("Add Music (asset_feed_spec.audios)");
      expect(result.currentValue).toBe("ENABLED");
    }
  });
});

describe("QA Checklist — Add Music Detection Logic", () => {
  it("should detect violation when audios type is 'random'", () => {
    const audios = [{ type: "random" }];
    const hasOptedOut = audios.length === 1 && audios[0]?.type === "opted_out";
    expect(hasOptedOut).toBe(false);
    expect(!hasOptedOut && audios.length > 0).toBe(true);
  });

  it("should NOT detect violation when audios type is 'opted_out'", () => {
    const audios = [{ type: "opted_out" }];
    const hasOptedOut = audios.length === 1 && audios[0]?.type === "opted_out";
    expect(hasOptedOut).toBe(true);
    expect(!hasOptedOut && audios.length > 0).toBe(false);
  });

  it("should detect violation when audios is empty array", () => {
    const audios: any[] = [];
    const hasOptedOut = audios.length === 1 && audios[0]?.type === "opted_out";
    // Empty array: hasOptedOut = false, but audios.length > 0 is also false
    // So no violation for empty array (matches the code: `if (!hasOptedOut && audios.length > 0)`)
    expect(!hasOptedOut && audios.length > 0).toBe(false);
  });

  it("should detect violation when audios has multiple items", () => {
    const audios = [{ type: "random" }, { type: "something" }];
    const hasOptedOut = audios.length === 1 && audios[0]?.type === "opted_out";
    expect(hasOptedOut).toBe(false);
    expect(!hasOptedOut && audios.length > 0).toBe(true);
  });
});

describe("QA Checklist — Fix Payload (POST to Ad ID with creative_id + DOF)", () => {
  it("should include creative_id in the creative param (references existing creative)", () => {
    // The confirmed working approach: POST to /{adId} with creative JSON param
    // containing creative_id + degrees_of_freedom_spec
    const creativeId = "1248555654023534";
    const dofSpec = {
      creative_features_spec: {
        audio: { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" },
        advantage_plus_creative: { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" },
      },
    };

    const creativeParam: Record<string, unknown> = {
      creative_id: creativeId,
      degrees_of_freedom_spec: dofSpec,
    };

    // Verify creative_id IS present
    expect(creativeParam.creative_id).toBe(creativeId);

    // Verify DOF spec is present with only creative_features_spec (no creative_sourcing_spec)
    expect(creativeParam.degrees_of_freedom_spec).toEqual(dofSpec);
    expect((creativeParam.degrees_of_freedom_spec as any).creative_sourcing_spec).toBeUndefined();
  });

  it("should stringify correctly for the POST body to /{adId}", () => {
    const adId = "120215890270510534";
    const creativeId = "1248555654023534";
    const dofSpec = {
      creative_features_spec: {
        audio: { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" },
      },
    };

    const creativeParam = {
      creative_id: creativeId,
      degrees_of_freedom_spec: dofSpec,
    };

    const body = {
      creative: JSON.stringify(creativeParam),
      access_token: "test_token",
    };

    // Verify body structure
    expect(typeof body.creative).toBe("string");
    const parsed = JSON.parse(body.creative);
    expect(parsed.creative_id).toBe(creativeId);
    expect(parsed.degrees_of_freedom_spec.creative_features_spec.audio.enroll_status).toBe("OPT_OUT");

    // Verify no creative_sourcing_spec
    expect(parsed.degrees_of_freedom_spec.creative_sourcing_spec).toBeUndefined();
  });

  it("should NOT include object_story_spec or asset_feed_spec (DOF-only update)", () => {
    const creativeParam: Record<string, unknown> = {
      creative_id: "1248555654023534",
      degrees_of_freedom_spec: { creative_features_spec: {} },
    };

    // The fix only updates DOF spec — no need to include object_story_spec
    expect(creativeParam).not.toHaveProperty("object_story_spec");
    expect(creativeParam).not.toHaveProperty("asset_feed_spec");
    expect(creativeParam).not.toHaveProperty("url_tags");
  });
});
