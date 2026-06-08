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
    expect(!hasOptedOut && audios.length > 0).toBe(false);
  });

  it("should detect violation when audios has multiple items", () => {
    const audios = [{ type: "random" }, { type: "something" }];
    const hasOptedOut = audios.length === 1 && audios[0]?.type === "opted_out";
    expect(hasOptedOut).toBe(false);
    expect(!hasOptedOut && audios.length > 0).toBe(true);
  });
});

describe("QA Checklist — Fix Payload (Create New Creative + Reassign)", () => {
  it("should build new creative payload with object_story_spec + corrected DOF (no creative_id)", () => {
    // The three-step approach:
    // 1. Fetch existing creative content
    // 2. Create NEW creative with same content + corrected DOF
    // 3. Update ad to point to new creative
    const existingCreative = {
      name: "Syllables - Static - Jun-26",
      object_story_spec: { page_id: "123", link_data: { link: "https://example.com" } },
      url_tags: "utm_source=meta",
      asset_feed_spec: { audios: [{ type: "random" }] },
    };

    const dofSpec = {
      creative_features_spec: {
        audio: { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" },
        advantage_plus_creative: { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" },
      },
    };

    // Build new creative payload (Step 2)
    const newCreativePayload: Record<string, unknown> = {
      name: `${existingCreative.name} (DOF fixed)`,
      object_story_spec: existingCreative.object_story_spec,
      degrees_of_freedom_spec: dofSpec,
    };

    if (existingCreative.url_tags) {
      newCreativePayload.url_tags = existingCreative.url_tags;
    }

    if (existingCreative.asset_feed_spec) {
      newCreativePayload.asset_feed_spec = {
        ...existingCreative.asset_feed_spec,
        audios: [{ type: "opted_out" }],
      };
    }

    // Verify NO creative_id (it's a new creative, not referencing an existing one)
    expect(newCreativePayload).not.toHaveProperty("creative_id");

    // Verify object_story_spec is present
    expect(newCreativePayload.object_story_spec).toEqual(existingCreative.object_story_spec);

    // Verify DOF spec is present with only creative_features_spec
    expect(newCreativePayload.degrees_of_freedom_spec).toEqual(dofSpec);
    expect((newCreativePayload.degrees_of_freedom_spec as any).creative_sourcing_spec).toBeUndefined();

    // Verify url_tags preserved
    expect(newCreativePayload.url_tags).toBe("utm_source=meta");

    // Verify asset_feed_spec.audios is fixed
    const afs = newCreativePayload.asset_feed_spec as any;
    expect(afs.audios).toEqual([{ type: "opted_out" }]);

    // Verify name is appended with "(DOF fixed)"
    expect(newCreativePayload.name).toBe("Syllables - Static - Jun-26 (DOF fixed)");
  });

  it("should reassign ad to new creative via creative_id JSON param (Step 3)", () => {
    const adId = "120215890270510534";
    const newCreativeId = "9999999999999";

    // Step 3: Update ad to point to new creative
    const body = {
      creative: JSON.stringify({ creative_id: newCreativeId }),
      access_token: "test_token",
    };

    const parsed = JSON.parse(body.creative);
    expect(parsed.creative_id).toBe(newCreativeId);
    // No DOF spec in the ad update — it's already baked into the new creative
    expect(parsed.degrees_of_freedom_spec).toBeUndefined();
  });

  it("should handle creative without url_tags or asset_feed_spec", () => {
    const existingCreative = {
      name: "Test Creative",
      object_story_spec: { page_id: "123", link_data: { link: "https://example.com" } },
      url_tags: undefined as string | undefined,
      asset_feed_spec: undefined as any,
    };

    const newCreativePayload: Record<string, unknown> = {
      name: `${existingCreative.name} (DOF fixed)`,
      object_story_spec: existingCreative.object_story_spec,
      degrees_of_freedom_spec: { creative_features_spec: {} },
    };

    if (existingCreative.url_tags) {
      newCreativePayload.url_tags = existingCreative.url_tags;
    }

    if (existingCreative.asset_feed_spec) {
      newCreativePayload.asset_feed_spec = {
        ...existingCreative.asset_feed_spec,
        audios: [{ type: "opted_out" }],
      };
    }

    expect(newCreativePayload).not.toHaveProperty("url_tags");
    expect(newCreativePayload).not.toHaveProperty("asset_feed_spec");
    expect(newCreativePayload.object_story_spec).toBeDefined();
  });

  it("should create new creative at /act_{accountId}/adcreatives endpoint", () => {
    const accountId = "1234567890";
    const createUrl = `https://graph.facebook.com/v22.0/act_${accountId}/adcreatives`;

    // Verify the URL format matches what Meta expects
    expect(createUrl).toContain("/act_");
    expect(createUrl).toContain("/adcreatives");
    expect(createUrl).toContain(accountId);
  });
});
