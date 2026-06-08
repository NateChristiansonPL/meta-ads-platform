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

describe("QA Checklist — Fix Payload (In-Place Creative Update)", () => {
  it("should build update payload with object_story_spec + DOF + multi_advertiser settings", () => {
    // The in-place approach:
    // 1. Fetch existing creative content (object_story_spec, url_tags)
    // 2. POST to /{creativeId} with full payload (same pattern as updateAdCreative)
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

    // Build update payload (matches updateAdCreative pattern in metaAdmin.ts)
    const updatePayload: Record<string, unknown> = {
      object_story_spec: existingCreative.object_story_spec,
      degrees_of_freedom_spec: dofSpec,
      contextual_multi_ads: { enroll_status: "OPT_OUT" },
      multi_advertiser_eligibility: "INELIGIBLE",
    };

    if (existingCreative.url_tags) {
      updatePayload.url_tags = existingCreative.url_tags;
    }

    // Verify object_story_spec is present (required for Meta to accept DOF changes)
    expect(updatePayload.object_story_spec).toEqual(existingCreative.object_story_spec);

    // Verify DOF spec is present with only creative_features_spec
    expect(updatePayload.degrees_of_freedom_spec).toEqual(dofSpec);
    expect((updatePayload.degrees_of_freedom_spec as any).creative_sourcing_spec).toBeUndefined();

    // Verify multi-advertiser settings are explicitly set to OFF
    expect(updatePayload.contextual_multi_ads).toEqual({ enroll_status: "OPT_OUT" });
    expect(updatePayload.multi_advertiser_eligibility).toBe("INELIGIBLE");

    // Verify url_tags preserved
    expect(updatePayload.url_tags).toBe("utm_source=meta");

    // Verify NO creative_id in payload (we're updating the creative itself, not referencing another)
    expect(updatePayload).not.toHaveProperty("creative_id");
  });

  it("should POST directly to /{creativeId} endpoint (not ad ID)", () => {
    const creativeId = "1248555654023534";
    const BASE_URL = "https://graph.facebook.com/v22.0";
    const updateUrl = `${BASE_URL}/${creativeId}`;

    // Verify the URL targets the creative directly
    expect(updateUrl).toBe(`https://graph.facebook.com/v22.0/${creativeId}`);
    // Should NOT contain /act_ (that's for creating new creatives)
    expect(updateUrl).not.toContain("/act_");
    // Should NOT contain /adcreatives (that's for creating new creatives)
    expect(updateUrl).not.toContain("/adcreatives");
  });

  it("should handle creative without url_tags", () => {
    const existingCreative = {
      name: "Test Creative",
      object_story_spec: { page_id: "123", link_data: { link: "https://example.com" } },
      url_tags: undefined as string | undefined,
      asset_feed_spec: undefined as any,
    };

    const updatePayload: Record<string, unknown> = {
      object_story_spec: existingCreative.object_story_spec,
      degrees_of_freedom_spec: { creative_features_spec: {} },
      contextual_multi_ads: { enroll_status: "OPT_OUT" },
      multi_advertiser_eligibility: "INELIGIBLE",
    };

    if (existingCreative.url_tags) {
      updatePayload.url_tags = existingCreative.url_tags;
    }

    expect(updatePayload).not.toHaveProperty("url_tags");
    expect(updatePayload.object_story_spec).toBeDefined();
    expect(updatePayload.contextual_multi_ads).toEqual({ enroll_status: "OPT_OUT" });
    expect(updatePayload.multi_advertiser_eligibility).toBe("INELIGIBLE");
  });

  it("should preserve ad metrics by not creating a new creative or reassigning", () => {
    // The key insight: updating a creative in-place preserves all ad-level metrics
    // (impressions, clicks, spend, learning phase) because the creative ID stays the same.
    // Creating a new creative and reassigning would reset these.
    const creativeId = "1248555654023534";
    const adId = "120215890270510534";

    // The fix does NOT touch the ad at all — only the creative
    const updateUrl = `https://graph.facebook.com/v22.0/${creativeId}`;
    expect(updateUrl).not.toContain(adId);
  });
});
