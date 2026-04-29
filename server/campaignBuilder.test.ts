/**
 * Campaign Builder Round 3 — unit tests
 * Tests for: ad name convention, targeting spec, creative data carry-over
 */
import { describe, it, expect } from 'vitest';

// ── Ad name convention ─────────────────────────────────────────────────────────
// Mirrors the buildAdName function in AdsMatrix.tsx
function buildAdName(
  _adSetName: string,
  concept: string,
  adType: string,
  assetLength: string,
  _dimensions: string[],
  launchDate?: string,
): string {
  const parts: string[] = [concept || 'Untitled'];
  if (adType === 'video') {
    parts.push('Video');
    if (assetLength) parts.push(`${assetLength}s`);
  } else if (adType === 'carousel') {
    parts.push('Carousel');
  } else {
    parts.push('Static');
  }
  if (launchDate) parts.push(launchDate);
  return parts.join(' - ');
}

// Mirrors parseLaunchDate in AdsMatrix.tsx
function parseLaunchDate(startDate: string): string {
  if (!startDate) return '';
  try {
    const d = new Date(startDate + 'T12:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mo = months[d.getMonth()];
    const yr = String(d.getFullYear()).slice(2);
    return `${mo}-${yr}`;
  } catch { return ''; }
}

describe('Ad name convention', () => {
  it('formats static ad name correctly', () => {
    const name = buildAdName('Ad Set 1', 'Summer Sale', 'static', '', [], 'May-26');
    expect(name).toBe('Summer Sale - Static - May-26');
  });

  it('formats video ad name with length', () => {
    const name = buildAdName('Ad Set 1', 'Brand Story', 'video', '15', [], 'Jun-26');
    expect(name).toBe('Brand Story - Video - 15s - Jun-26');
  });

  it('formats video ad name without length', () => {
    const name = buildAdName('Ad Set 1', 'Brand Story', 'video', '', [], 'Jun-26');
    expect(name).toBe('Brand Story - Video - Jun-26');
  });

  it('formats carousel ad name correctly', () => {
    const name = buildAdName('Ad Set 1', 'Product Showcase', 'carousel', '', [], 'Apr-26');
    expect(name).toBe('Product Showcase - Carousel - Apr-26');
  });

  it('uses Untitled when concept is empty', () => {
    const name = buildAdName('Ad Set 1', '', 'static', '', [], 'May-26');
    expect(name).toBe('Untitled - Static - May-26');
  });

  it('omits date when launchDate is not provided', () => {
    const name = buildAdName('Ad Set 1', 'Test', 'static', '', []);
    expect(name).toBe('Test - Static');
  });

  it('does not include brackets in the name', () => {
    const name = buildAdName('Ad Set 1', 'Test', 'video', '30', [], 'May-26');
    expect(name).not.toMatch(/[\[\]]/);
  });

  it('does not include Placement Custom in the name', () => {
    const name = buildAdName('Ad Set 1', 'Test', 'video', '30', ['Feed', 'Stories'], 'May-26');
    expect(name).not.toContain('Placement Custom');
  });
});

describe('parseLaunchDate', () => {
  it('parses a date string to Mon-YY format', () => {
    expect(parseLaunchDate('2026-05-15')).toBe('May-26');
  });

  it('returns empty string for empty input', () => {
    expect(parseLaunchDate('')).toBe('');
  });

  it('parses April correctly', () => {
    expect(parseLaunchDate('2026-04-01')).toBe('Apr-26');
  });
});

// ── Targeting spec: no threads, proper flexible_spec ──────────────────────────
// Mirrors the buildTargetingSpec logic in BuilderReachOverlapPanel.tsx
function buildTargetingSpec(params: {
  geoLocationObjects?: Array<{ key: string; type: string; name: string }>;
  geoLocations?: string;
  ageMin?: number;
  ageMax?: number;
  genders?: string;
  detailedInterests?: string;
  narrowInterests?: string;
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
  audienceNetworkPositions?: string[];
}) {
  const spec: Record<string, unknown> = {};

  // Geo
  if (params.geoLocationObjects && params.geoLocationObjects.length > 0) {
    const countries: string[] = [];
    const regions: Array<{ key: string }> = [];
    const cities: Array<{ key: string }> = [];
    for (const loc of params.geoLocationObjects) {
      if (loc.type === 'country') countries.push(loc.key);
      else if (loc.type === 'region') regions.push({ key: loc.key });
      else cities.push({ key: loc.key });
    }
    spec.geo_locations = {
      ...(countries.length > 0 ? { countries } : {}),
      ...(regions.length > 0 ? { regions } : {}),
      ...(cities.length > 0 ? { cities } : {}),
    };
  }

  // Age
  if (params.ageMin) spec.age_min = params.ageMin;
  if (params.ageMax) spec.age_max = params.ageMax;

  // Gender
  if (params.genders === 'male') spec.genders = [1];
  else if (params.genders === 'female') spec.genders = [2];

  // Publisher platforms — exclude 'threads'
  const validPlatforms = ['facebook', 'instagram', 'audience_network', 'messenger'];
  const platforms = (params.publisherPlatforms || []).filter(p => validPlatforms.includes(p));
  if (platforms.length > 0) spec.publisher_platforms = platforms;

  // Flexible spec — only include non-empty arrays
  const flexibleSpec: Array<Record<string, unknown>> = [];
  if (params.detailedInterests) {
    const interests = params.detailedInterests.split('\n').filter(Boolean).map(i => {
      const parts = i.split('|');
      return { id: String(parts[1]?.trim() || parts[0]?.trim()), name: parts[0]?.trim() };
    });
    if (interests.length > 0) {
      flexibleSpec.push({ interests });
    }
  }
  if (flexibleSpec.length > 0) spec.flexible_spec = flexibleSpec;

  return spec;
}

describe('buildTargetingSpec', () => {
  it('excludes threads from publisher_platforms', () => {
    const spec = buildTargetingSpec({
      publisherPlatforms: ['facebook', 'instagram', 'threads'],
    });
    expect(spec.publisher_platforms).toEqual(['facebook', 'instagram']);
    expect((spec.publisher_platforms as string[]).includes('threads')).toBe(false);
  });

  it('does not include empty flexible_spec arrays', () => {
    const spec = buildTargetingSpec({
      geoLocationObjects: [{ key: 'US', type: 'country', name: 'United States' }],
    });
    expect(spec.flexible_spec).toBeUndefined();
  });

  it('includes flexible_spec when interests are provided', () => {
    const spec = buildTargetingSpec({
      detailedInterests: 'Fitness | 6003107902433',
    });
    expect(spec.flexible_spec).toBeDefined();
    expect((spec.flexible_spec as Array<Record<string, unknown>>).length).toBe(1);
  });

  it('ensures interest IDs are strings', () => {
    const spec = buildTargetingSpec({
      detailedInterests: 'Fitness | 6003107902433',
    });
    const flexSpec = spec.flexible_spec as Array<{ interests: Array<{ id: string }> }>;
    expect(typeof flexSpec[0].interests[0].id).toBe('string');
  });

  it('handles all-valid publisher platforms', () => {
    const spec = buildTargetingSpec({
      publisherPlatforms: ['facebook', 'instagram', 'audience_network', 'messenger'],
    });
    expect(spec.publisher_platforms).toEqual(['facebook', 'instagram', 'audience_network', 'messenger']);
  });
});
