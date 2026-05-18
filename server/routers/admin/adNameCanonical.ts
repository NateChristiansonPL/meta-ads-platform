/**
 * adNameCanonical.ts
 *
 * Four-pass fuzzy ad name canonicalization pipeline.
 * Used as Pass 2 in the hybrid creative grouping system for decay analysis.
 *
 * Purpose: merge ads that are the same creative concept but have different
 * contentFingerprints (e.g. partnership ads where Meta assigns a unique videoId
 * per ad even when the underlying asset is identical).
 *
 * Pipeline (scoped per campaign, mirrors pl-performance-analysis-insights-v3):
 *   Pass 1 — Strip the common campaign prefix shared by all ad names
 *   Pass 2 — Strip per-group audience/geo segment prefixes
 *   Pass 3 — Group by shared trailing suffix (the true creative identifier)
 *   Pass 4 — Fuzzy dedup of remaining concept strings at threshold 94
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DELIMITERS = [" - ", " | "];
const DATE_TOKENS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|\d{4}|'\d{2})/i;
const FORMAT_TOKENS = /^(static|video|carousel|image|gif|reel|story|stories|ugc|cta|v\d+|version\s*\d+)$/i;
const NOISE_TOKENS = new Set(["static", "video", "carousel", "image", "gif", "reel", "story", "stories", "ugc"]);

/** Tokenize an ad name by the first matching delimiter found. */
function tokenize(name: string): string[] {
  for (const delim of DELIMITERS) {
    if (name.includes(delim)) return name.split(delim).map((t) => t.trim()).filter(Boolean);
  }
  return [name.trim()];
}

/** Reassemble tokens with the first delimiter found in the original name, or " - ". */
function rejoin(tokens: string[]): string {
  return tokens.join(" - ");
}

/**
 * Levenshtein-based similarity ratio (0–1), order-sensitive.
 * Mirrors Python's SequenceMatcher ratio and fuzz.ratio().
 */
function similarityRatio(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;
  const m = la.length;
  const n = lb.length;
  if (m === 0 || n === 0) return 0;
  // DP edit distance
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        la[i - 1] === lb[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
}

/** Normalize a concept string for fuzzy comparison: lowercase, strip trailing dates/formats/durations. */
function normalizeForFuzzy(s: string): string {
  return tokenize(s.toLowerCase())
    .filter((t) => !DATE_TOKENS.test(t) && !FORMAT_TOKENS.test(t))
    .join(" - ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Return true if a token is "meaningful" (not a noise/format/date token). */
function isMeaningfulToken(t: string): boolean {
  return !DATE_TOKENS.test(t) && !NOISE_TOKENS.has(t.toLowerCase());
}

// ---------------------------------------------------------------------------
// Pass 1 — Strip common campaign prefix
// ---------------------------------------------------------------------------

/**
 * Find the longest leading token sequence that is fuzzily shared across ALL
 * names in the group (SequenceMatcher ratio ≥ 0.82). Strip it from every name.
 */
function stripCommonPrefix(names: string[]): string[] {
  if (names.length === 0) return names;
  const tokenized = names.map(tokenize);
  const minLen = Math.min(...tokenized.map((t) => t.length));
  let prefixLen = 0;
  for (let i = 0; i < minLen; i++) {
    const pivot = tokenized[0][i];
    const allMatch = tokenized.every((t) => similarityRatio(t[i], pivot) >= 0.82);
    if (allMatch) prefixLen = i + 1;
    else break;
  }
  // Only strip if the prefix is not the entire name
  return tokenized.map((t) =>
    prefixLen > 0 && t.length > prefixLen ? rejoin(t.slice(prefixLen)) : rejoin(t),
  );
}

// ---------------------------------------------------------------------------
// Pass 2 — Strip per-group audience/geo segment prefixes
// ---------------------------------------------------------------------------

/**
 * Within a set of stripped names, cluster by their first token.
 * If a subset (≥ 2 but not all) shares a similar leading block, strip it
 * from that subset only.
 */
function stripAudienceSegments(names: string[]): string[] {
  if (names.length <= 1) return names;
  const tokenized = names.map(tokenize);
  // Group indices by their first token (fuzzy bucket)
  const buckets: Map<number, number[]> = new Map();
  const assigned = new Array(names.length).fill(-1);
  for (let i = 0; i < tokenized.length; i++) {
    const pivot = tokenized[i][0];
    let found = -1;
    for (const [rep] of Array.from(buckets)) {
      if (similarityRatio(tokenized[rep][0], pivot) >= 0.82) {
        found = rep;
        break;
      }
    }
    if (found === -1) {
      buckets.set(i, [i]);
      assigned[i] = i;
    } else {
      buckets.get(found)!.push(i);
      assigned[i] = found;
    }
  }
  const result = [...names];
  for (const [, indices] of Array.from(buckets)) {
    // Only strip if it's a subset (not all names) and has ≥ 2 members
    if (indices.length >= 2 && indices.length < names.length) {
      for (const idx of indices) {
        const t = tokenized[idx];
        if (t.length > 1) result[idx] = rejoin(t.slice(1));
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pass 3 — Group by shared trailing suffix
// ---------------------------------------------------------------------------

/**
 * For names that still differ in leading tokens but share a meaningful trailing
 * suffix, group them by that suffix. Returns a map from suffix → original indices.
 */
function groupBySuffix(names: string[]): Map<string, number[]> {
  const tokenized = names.map(tokenize);
  const suffixGroups = new Map<string, number[]>();
  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i];
      const b = tokenized[j];
      // Find longest shared suffix
      let suffixLen = 0;
      const minLen = Math.min(a.length, b.length);
      for (let k = 1; k <= minLen; k++) {
        if (similarityRatio(a[a.length - k], b[b.length - k]) >= 0.82) suffixLen = k;
        else break;
      }
      if (suffixLen === 0) continue;
      const suffixTokens = a.slice(a.length - suffixLen);
      // Suffix must contain at least one meaningful token
      if (!suffixTokens.some(isMeaningfulToken)) continue;
      const suffixKey = rejoin(suffixTokens).toLowerCase();
      if (!suffixGroups.has(suffixKey)) suffixGroups.set(suffixKey, []);
      const group = suffixGroups.get(suffixKey)!;
      if (!group.includes(i)) group.push(i);
      if (!group.includes(j)) group.push(j);
    }
  }
  return suffixGroups;
}

// ---------------------------------------------------------------------------
// Pass 4 — Fuzzy canonical dedup
// ---------------------------------------------------------------------------

/**
 * Cluster concept strings using edit-distance similarity at threshold 94/100.
 * Within each cluster, choose the most frequent variant as the canonical label
 * (ties broken by shortest string, then alphabetical).
 */
function fuzzyDedup(
  concepts: string[],
  threshold = 0.94,
): Map<number, string> {
  // Map from original index → canonical label
  const canonical = new Map<number, string>();
  const clusters: number[][] = [];
  const clusterRep: string[] = [];

  for (let i = 0; i < concepts.length; i++) {
    const norm = normalizeForFuzzy(concepts[i]);
    let placed = false;
    for (let c = 0; c < clusterRep.length; c++) {
      if (similarityRatio(norm, clusterRep[c]) >= threshold) {
        clusters[c].push(i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([i]);
      clusterRep.push(norm);
    }
  }

  for (const cluster of Array.from(clusters)) {
    // Pick most frequent (here all are unique strings, so pick shortest then alpha)
    const variants = cluster.map((idx) => concepts[idx]);
    const freq = new Map<string, number>();
    for (const v of variants) freq.set(v, (freq.get(v) ?? 0) + 1);
    const maxFreq = Math.max(...Array.from(freq.values()));
    const candidates = variants.filter((v) => freq.get(v) === maxFreq);
    candidates.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const label = candidates[0];
    for (const idx of cluster) canonical.set(idx, label);
  }

  return canonical;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given an array of raw ad names that belong to the same creative group,
 * return the best single display label by running the four-pass pipeline
 * and picking the shortest / most-concept-like result.
 *
 * Falls back to the first name if the array is empty.
 */
export function deriveCanonicalAdName(adNames: string[]): string {
  if (adNames.length === 0) return "";
  const deduped = Array.from(new Set(adNames));
  if (deduped.length === 1) return deduped[0];
  // Pass 1: strip common campaign prefix
  const pass1 = stripCommonPrefix(deduped);
  // Pass 2: strip audience/geo segment prefixes
  const pass2 = stripAudienceSegments(pass1);
  // Pass 3: find shared trailing suffix
  const suffixGroups = groupBySuffix(pass2);
  const conceptForIndex: string[] = [...pass2];
  for (const [suffix, indices] of Array.from(suffixGroups)) {
    for (const idx of indices) conceptForIndex[idx] = suffix;
  }
  // Pass 4: fuzzy dedup — collect unique canonical labels
  const canonicalMap = fuzzyDedup(conceptForIndex);
  const labels = Array.from(new Set(Array.from(canonicalMap.values())));
  labels.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return labels[0] ?? pass2[0] ?? adNames[0];
}

export interface CanonicalGroup {
  /** The canonical creative concept label. */
  canonicalName: string;
  /** Original group keys (campaignId::fingerprint) that were merged. */
  groupKeys: string[];
}

/**
 * Given a map of groupKey → adNames[], compute canonical creative names
 * for each group using the four-pass pipeline.
 *
 * Returns a list of CanonicalGroup entries. Groups that could not be merged
 * appear as singletons. Groups that were merged share the same canonicalName.
 *
 * All grouping is scoped per campaign (groupKeys share the same campaignId prefix).
 */
export function computeCanonicalGroups(
  groups: Map<string, string[]>, // groupKey → representative ad names
): CanonicalGroup[] {
  // Bucket groups by campaignId (prefix before "::")
  const byCampaign = new Map<string, string[]>(); // campaignId → groupKeys
  for (const key of Array.from(groups.keys())) {
    const sep = key.indexOf("::");
    const campaignId = sep !== -1 ? key.slice(0, sep) : "unknown";
    if (!byCampaign.has(campaignId)) byCampaign.set(campaignId, []);
    byCampaign.get(campaignId)!.push(key);
  }

  const result: CanonicalGroup[] = [];

  for (const [, campaignKeys] of Array.from(byCampaign)) {
    if (campaignKeys.length === 1) {
      // Only one group in this campaign — no merging possible
      const key = campaignKeys[0];
      const repName = groups.get(key)?.[0] ?? key;
      result.push({ canonicalName: repName, groupKeys: [key] });
      continue;
    }

    // Pick one representative ad name per group (the most common name in the group)
    const repNames: string[] = campaignKeys.map((gk: string) => {
      const names = groups.get(gk) ?? [];
      if (names.length === 0) return gk;
      const freq = new Map<string, number>();
      for (const n of names) freq.set(n, (freq.get(n) ?? 0) + 1);
      const best = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0];
      return best[0];
    });

    // Pass 1: strip common campaign prefix
    const pass1 = stripCommonPrefix(repNames);
    // Pass 2: strip audience segment prefixes
    const pass2 = stripAudienceSegments(pass1);

    // Pass 3: build suffix groups (map suffix → indices)
    const suffixGroups = groupBySuffix(pass2);

    // Assign each index to its suffix group (if any), otherwise use pass2 name
    const conceptForIndex: string[] = [...pass2];
    for (const [suffix, indices] of Array.from(suffixGroups)) {
      for (const idx of indices) {
        conceptForIndex[idx] = suffix;
      }
    }

    // Pass 4: fuzzy dedup
    const canonicalMap = fuzzyDedup(conceptForIndex);

    // Build output: group keys that share the same canonical label get merged
    const mergeMap = new Map<string, string[]>(); // canonicalLabel → groupKeys
    for (let i = 0; i < campaignKeys.length; i++) {
      const label = canonicalMap.get(i) ?? conceptForIndex[i];
      if (!mergeMap.has(label)) mergeMap.set(label, []);
      mergeMap.get(label)!.push(campaignKeys[i]);
    }

    for (const [label, keys] of Array.from(mergeMap)) {
      result.push({ canonicalName: label, groupKeys: keys });
    }
  }

  return result;
}
