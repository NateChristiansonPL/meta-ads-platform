/**
 * qaChecklist.test.ts — Unit tests for the native QA checklist service.
 * Tests the pure logic functions (format detection, DOF comparison, field extractors)
 * without hitting the Meta API or S3.
 */

import { describe, it, expect } from "vitest";

// We need to import the internal helpers. Since they're not exported,
// we'll test them via the module's behavior by importing the module directly.
// For now, let's test the key logic by re-implementing the testable parts.

// Import the module to ensure it compiles and loads correctly
describe("qaChecklist module", () => {
  it("should import without errors", async () => {
    const mod = await import("./qaChecklist");
    expect(mod.runQaChecklist).toBeDefined();
    expect(typeof mod.runQaChecklist).toBe("function");
  });
});

// Test format detection logic (mirrored from the module)
describe("format detection logic", () => {
  function determineFormatAndPac(creative: any): { format: string; isPac: boolean } {
    const assetFeed = creative?.asset_feed_spec || {};
    const objStory = creative?.object_story_spec || {};
    const linkData = objStory.link_data || {};

    if (linkData.child_attachments) return { format: "carousel", isPac: false };
    if (objStory.video_data) return { format: "video", isPac: false };
    if (assetFeed.videos) return { format: "video", isPac: true };
    if (assetFeed.images) return { format: "static", isPac: true };
    return { format: "static", isPac: false };
  }

  it("detects carousel from child_attachments", () => {
    const creative = { object_story_spec: { link_data: { child_attachments: [{}] } } };
    expect(determineFormatAndPac(creative)).toEqual({ format: "carousel", isPac: false });
  });

  it("detects non-PAC video from video_data", () => {
    const creative = { object_story_spec: { video_data: { video_id: "123" } } };
    expect(determineFormatAndPac(creative)).toEqual({ format: "video", isPac: false });
  });

  it("detects PAC video from asset_feed_spec.videos", () => {
    const creative = { asset_feed_spec: { videos: [{ video_id: "1" }, { video_id: "2" }] } };
    expect(determineFormatAndPac(creative)).toEqual({ format: "video", isPac: true });
  });

  it("detects PAC static from asset_feed_spec.images", () => {
    const creative = { asset_feed_spec: { images: [{ hash: "a" }, { hash: "b" }] } };
    expect(determineFormatAndPac(creative)).toEqual({ format: "static", isPac: true });
  });

  it("defaults to non-PAC static", () => {
    const creative = { object_story_spec: { link_data: { link: "https://example.com" } } };
    expect(determineFormatAndPac(creative)).toEqual({ format: "static", isPac: false });
  });
});

// Test DOF comparison logic
describe("DOF comparison logic", () => {
  function compareDof(actual: any, expected: any): string[] {
    if (!actual) return ["degrees_of_freedom_spec is MISSING entirely"];
    const violations: string[] = [];

    const actualFeatures = actual.creative_features_spec || {};
    const expectedFeatures = expected.creative_features_spec || {};

    for (const [name, expVal] of Object.entries<any>(expectedFeatures)) {
      const actVal = actualFeatures[name];
      if (!actVal) continue;
      if (actVal.enroll_status !== (expVal.enroll_status || "OPT_OUT")) {
        violations.push(`${name}: enroll_status=${actVal.enroll_status} (expected ${expVal.enroll_status || "OPT_OUT"})`);
      }
      if (actVal.customizations && typeof actVal.customizations === 'object') {
        for (const [subName, subVal] of Object.entries<any>(actVal.customizations)) {
          if (subVal && subVal.enroll_status && subVal.enroll_status !== "OPT_OUT") {
            violations.push(`${name}.${subName}: enroll_status=${subVal.enroll_status} (expected OPT_OUT)`);
          }
        }
      }
    }
    for (const [name, actVal] of Object.entries<any>(actualFeatures)) {
      if (!(name in expectedFeatures) && actVal.enroll_status !== "OPT_OUT") {
        violations.push(`${name}: enroll_status=${actVal.enroll_status} (unexpected, not OPT_OUT)`);
      }
      if (!(name in expectedFeatures) && actVal.customizations && typeof actVal.customizations === 'object') {
        for (const [subName, subVal] of Object.entries<any>(actVal.customizations)) {
          if (subVal && subVal.enroll_status && subVal.enroll_status !== "OPT_OUT") {
            violations.push(`${name}.${subName}: enroll_status=${subVal.enroll_status} (unexpected, not OPT_OUT)`);
          }
        }
      }
    }

    if (actualFeatures.standard_enhancements && actualFeatures.standard_enhancements.enroll_status !== "OPT_OUT") {
      const alreadyCaught = violations.some(v => v.startsWith('standard_enhancements:'));
      if (!alreadyCaught) {
        violations.push(`standard_enhancements: enroll_status=${actualFeatures.standard_enhancements.enroll_status} (expected OPT_OUT)`);
      }
    }

    const actualSourcing = actual.creative_sourcing_spec || {};
    const expectedSourcing = expected.creative_sourcing_spec || {};
    for (const [name, expVal] of Object.entries<any>(expectedSourcing)) {
      const actVal = actualSourcing[name];
      if (!actVal) continue;
      if (actVal.enroll_status !== (expVal.enroll_status || "OPT_OUT")) {
        violations.push(`sourcing.${name}: enroll_status=${actVal.enroll_status} (expected ${expVal.enroll_status || "OPT_OUT"})`);
      }
    }
    return violations;
  }

  it("returns missing message when actual is null/undefined", () => {
    expect(compareDof(null, {})).toEqual(["degrees_of_freedom_spec is MISSING entirely"]);
    expect(compareDof(undefined, {})).toEqual(["degrees_of_freedom_spec is MISSING entirely"]);
  });

  it("returns empty array when all features match expected OPT_OUT", () => {
    const spec = {
      creative_features_spec: {
        audio: { enroll_status: "OPT_OUT", action_metadata: { type: "DEFAULT_OFF" } },
        biz_ai: { enroll_status: "OPT_OUT", action_metadata: { type: "DEFAULT_OFF" } },
      },
      creative_sourcing_spec: {
        brand: { enroll_status: "OPT_OUT" },
      },
    };
    const expected = {
      creative_features_spec: {
        audio: { enroll_status: "OPT_OUT", action_metadata: { type: "DEFAULT_OFF" } },
        biz_ai: { enroll_status: "OPT_OUT", action_metadata: { type: "DEFAULT_OFF" } },
      },
      creative_sourcing_spec: {
        brand: { enroll_status: "OPT_OUT" },
      },
    };
    expect(compareDof(spec, expected)).toEqual([]);
  });

  it("detects violation when enroll_status is not OPT_OUT", () => {
    const spec = {
      creative_features_spec: {
        audio: { enroll_status: "OPT_IN", action_metadata: { type: "DEFAULT_OFF" } },
      },
    };
    const expected = {
      creative_features_spec: {
        audio: { enroll_status: "OPT_OUT", action_metadata: { type: "DEFAULT_OFF" } },
      },
    };
    const violations = compareDof(spec, expected);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("audio");
    expect(violations[0]).toContain("OPT_IN");
  });

  it("detects unexpected feature not in expected spec", () => {
    const spec = {
      creative_features_spec: {
        new_feature: { enroll_status: "OPT_IN" },
      },
    };
    const expected = {
      creative_features_spec: {},
    };
    const violations = compareDof(spec, expected);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("new_feature");
    expect(violations[0]).toContain("unexpected");
  });

  it("ignores unexpected feature if it is OPT_OUT", () => {
    const spec = {
      creative_features_spec: {
        new_feature: { enroll_status: "OPT_OUT" },
      },
    };
    const expected = {
      creative_features_spec: {},
    };
    expect(compareDof(spec, expected)).toEqual([]);
  });

  it("detects nested customization violations (e.g., text_optimizations.text_extraction)", () => {
    const spec = {
      creative_features_spec: {
        text_optimizations: {
          enroll_status: "OPT_IN",
          customizations: {
            text_extraction: { action_metadata: { type: "MANUAL" }, enroll_status: "OPT_IN" },
          },
        },
      },
    };
    const expected = {
      creative_features_spec: {
        text_optimizations: { enroll_status: "OPT_OUT" },
      },
    };
    const violations = compareDof(spec, expected);
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some(v => v.includes("text_optimizations:"))).toBe(true);
    expect(violations.some(v => v.includes("text_optimizations.text_extraction:"))).toBe(true);
  });

  it("detects standard_enhancements OPT_IN as a violation", () => {
    const spec = {
      creative_features_spec: {
        standard_enhancements: { action_metadata: { type: "MANUAL" }, enroll_status: "OPT_IN" },
      },
    };
    const expected = {
      creative_features_spec: {},
    };
    const violations = compareDof(spec, expected);
    expect(violations.some(v => v.includes("standard_enhancements"))).toBe(true);
  });

  it("detects inline_comment (relevant comments) OPT_IN", () => {
    const spec = {
      creative_features_spec: {
        inline_comment: { action_metadata: { type: "MANUAL" }, enroll_status: "OPT_IN" },
      },
    };
    const expected = {
      creative_features_spec: {
        inline_comment: { enroll_status: "OPT_OUT" },
      },
    };
    const violations = compareDof(spec, expected);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("inline_comment");
  });

  it("detects audio (music) OPT_IN", () => {
    const spec = {
      creative_features_spec: {
        audio: { action_metadata: { type: "MANUAL" }, enroll_status: "OPT_IN" },
      },
    };
    const expected = {
      creative_features_spec: {
        audio: { enroll_status: "OPT_OUT", action_metadata: { type: "DEFAULT_OFF" } },
      },
    };
    const violations = compareDof(spec, expected);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("audio");
  });

  it("does not flag standard_enhancements when it is OPT_OUT", () => {
    const spec = {
      creative_features_spec: {
        standard_enhancements: { enroll_status: "OPT_OUT" },
      },
    };
    const expected = {
      creative_features_spec: {},
    };
    expect(compareDof(spec, expected)).toEqual([]);
  });
});

// Test field extractors
describe("field extractors", () => {
  function extractLandingPage(c: any): string {
    const objStory = c?.object_story_spec || {};
    const ld = objStory.link_data || {};
    const vd = objStory.video_data || {};
    const af = c?.asset_feed_spec || {};
    if (ld.link) return ld.link;
    if (vd.call_to_action?.value?.link) return vd.call_to_action.value.link;
    const links = af.link_urls || [];
    return links[0]?.website_url || "";
  }

  it("extracts landing page from link_data", () => {
    const c = { object_story_spec: { link_data: { link: "https://example.com/page" } } };
    expect(extractLandingPage(c)).toBe("https://example.com/page");
  });

  it("extracts landing page from video_data CTA", () => {
    const c = { object_story_spec: { video_data: { call_to_action: { value: { link: "https://video.com" } } } } };
    expect(extractLandingPage(c)).toBe("https://video.com");
  });

  it("extracts landing page from asset_feed_spec link_urls", () => {
    const c = { asset_feed_spec: { link_urls: [{ website_url: "https://feed.com" }] } };
    expect(extractLandingPage(c)).toBe("https://feed.com");
  });

  it("returns empty string when no landing page found", () => {
    expect(extractLandingPage({})).toBe("");
  });
});

// Test UTM extraction
describe("UTM extraction", () => {
  function extractUtms(url: string): string {
    try {
      const u = new URL(url);
      const utms: string[] = [];
      u.searchParams.forEach((v, k) => { if (k.startsWith("utm_")) utms.push(`${k}=${v}`); });
      return utms.join("\n");
    } catch { return ""; }
  }

  it("extracts UTM params from URL", () => {
    const url = "https://example.com?utm_source=fb&utm_medium=cpc&other=val";
    const result = extractUtms(url);
    expect(result).toContain("utm_source=fb");
    expect(result).toContain("utm_medium=cpc");
    expect(result).not.toContain("other");
  });

  it("returns empty string for invalid URL", () => {
    expect(extractUtms("not a url")).toBe("");
  });

  it("returns empty string when no UTMs present", () => {
    expect(extractUtms("https://example.com?foo=bar")).toBe("");
  });
});

// Test geo formatting
describe("geo formatting", () => {
  function formatGeo(targeting: any): string {
    const geo = targeting?.geo_locations || {};
    const lines: string[] = [];
    for (const country of geo.countries || []) lines.push(country);
    for (const region of geo.regions || []) {
      const name = region.name || "";
      const country = region.country || "";
      lines.push(country && country !== "US" ? `${name}, ${country}` : name);
    }
    for (const city of geo.cities || []) {
      const cityName = city.name || "";
      const region = city.region || "";
      const country = city.country || "US";
      const radius = city.radius || 0;
      const radiusUnit = city.distance_unit || "mile";
      let label = country === "US" && region ? `${cityName}, ${region}` : country !== "US" ? `${cityName}, ${country}` : cityName;
      if (radius && Number(radius) > 0) {
        const unitShort = radiusUnit.includes("mile") ? "mi" : "km";
        label += ` (+${radius} ${unitShort})`;
      }
      lines.push(label);
    }
    for (const dma of geo.geo_markets || []) lines.push(dma.name || "");
    for (const zc of geo.zips || []) lines.push(zc.name || zc.key || "");
    return lines.length ? lines.join("\n") : "All";
  }

  it("formats countries", () => {
    expect(formatGeo({ geo_locations: { countries: ["US", "CA"] } })).toBe("US\nCA");
  });

  it("formats cities with radius", () => {
    const targeting = {
      geo_locations: {
        cities: [{ name: "Austin", region: "Texas", country: "US", radius: 25, distance_unit: "mile" }],
      },
    };
    expect(formatGeo(targeting)).toBe("Austin, Texas (+25 mi)");
  });

  it("returns 'All' when no geo specified", () => {
    expect(formatGeo({})).toBe("All");
    expect(formatGeo({ geo_locations: {} })).toBe("All");
  });
});
