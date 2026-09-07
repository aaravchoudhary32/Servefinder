// Maps raw listing data from an arbitrary external source (varying field
// names, missing fields, inconsistent formats) into this app's
// opportunities schema. Field lookup is case/punctuation-insensitive so
// "Application Deadline", "application_deadline", and "applyBy" all
// resolve the same way.

import { CATEGORY_OPTIONS, CATEGORY_TAG_MAP } from "@/lib/constants";

export type RawListing = Record<string, unknown>;

export type NormalizedOpportunity = {
  title: string;
  description: string | null;
  category: string;
  minimum_age: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  schedule_slots: string[];
  skills_required: string[];
  interests_tags: string[];
  commitment_type: "one_time" | "recurring";
  application_url: string | null;
  application_deadline: string | null; // YYYY-MM-DD
  source: string;
  source_url: string | null;
  external_id: string | null;
  last_verified_at: string; // ISO timestamp
};

const DEFAULT_CATEGORY = "Community Service";
const DEFAULT_MINIMUM_AGE = 13;
const PLAUSIBLE_AGE_RANGE: [number, number] = [5, 25];

// ---------- Flexible field lookup ----------

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildLookup(raw: RawListing): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) {
    map.set(canonicalKey(key), value);
  }
  return map;
}

function pickString(lookup: Map<string, unknown>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const value = lookup.get(canonicalKey(candidate));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(lookup: Map<string, unknown>, candidates: string[]): number | null {
  for (const candidate of candidates) {
    const value = lookup.get(canonicalKey(candidate));
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function pickStringArray(lookup: Map<string, unknown>, candidates: string[]): string[] | null {
  for (const candidate of candidates) {
    const value = lookup.get(canonicalKey(candidate));
    if (Array.isArray(value)) {
      const strings = value.filter((v): v is string => typeof v === "string");
      if (strings.length) return strings;
    }
  }
  return null;
}

// ---------- Category inference ----------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  STEM: ["stem", "coding", "programming", "computer", "science", "math", "engineering", "robotics", "tech lab", "technology"],
  Environment: ["environment", "conservation", "trail", "clean up", "cleanup", "wildlife habitat", "sustainability", "recycl", "garden", "restoration"],
  Healthcare: ["hospital", "health", "medical", "clinic", "nursing", "patient", "healthcare"],
  Education: ["tutor", "teach", "mentor", "literacy", "school", "homework", "reading buddy", "esl", "education"],
  Animals: ["animal", "shelter", "dog", "cat", "wildlife rescue", "humane society", "pet"],
  "Arts & Culture": ["art", "mural", "museum", "theater", "theatre", "music", "culture", "paint"],
  "Community Service": ["food bank", "community service", "soup kitchen", "donation drive", "outreach", "volunteer center"],
  "Sports & Rec": ["sports", "soccer", "coach", "recreation", "athletic", "basketball", "baseball", "youth league"],
};

// Leading word-boundary only (not a full \bword\b match) — blocks
// mid-word false positives like "cat" inside "edu-cat-ion", while still
// matching legitimate suffixed forms of intentional stems like "garden"
// in "gardens" or "recycl" in "recycling".
function containsKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`, "i").test(text);
}

/** Simple keyword-count matching against the platform's category list. */
export function inferCategory(text: string): string {
  let bestCategory = DEFAULT_CATEGORY;
  let bestScore = 0;

  for (const category of CATEGORY_OPTIONS) {
    const keywords = CATEGORY_KEYWORDS[category] ?? [];
    const score = keywords.reduce((count, kw) => count + (containsKeyword(text, kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function resolveCategory(explicit: string | null, text: string): string {
  if (explicit) {
    const matched = CATEGORY_OPTIONS.find((c) => c.toLowerCase() === explicit.toLowerCase());
    if (matched) return matched;
  }
  return inferCategory(text);
}

function inferInterestTags(text: string, primaryCategory: string): string[] {
  const tags = new Set<string>();

  for (const category of CATEGORY_OPTIONS) {
    const keywords = CATEGORY_KEYWORDS[category] ?? [];
    if (keywords.some((kw) => containsKeyword(text, kw))) {
      tags.add(CATEGORY_TAG_MAP[category]);
    }
  }
  tags.add(CATEGORY_TAG_MAP[primaryCategory]);

  return [...tags];
}

// ---------- Minimum age extraction ----------

// Tried in order; the first pattern that matches AND falls within a
// plausible age range wins. Handles phrasings like "volunteers must be
// 16+", "must be at least 16", "minimum age of 16", "ages 16 and up".
// \d{1,3} (not {1,2}) so a stray 3-digit number isn't silently truncated
// into a plausible-looking wrong age (e.g. "200" -> "20"); the
// PLAUSIBLE_AGE_RANGE check below rejects it outright instead.
const AGE_PATTERNS: RegExp[] = [
  /(?:volunteers? must be|must be)\s*(?:at least\s*)?(\d{1,3})/i,
  /minimum age(?:\s*(?:of|is|:))?\s*(\d{1,3})/i,
  /at least\s*(\d{1,3})\s*years?/i,
  /ages?\s*(\d{1,3})\s*(?:and up|or older)/i,
  // "ages 15 through 18" / "ages 15-18" / "aged 15 to 18" — the lower
  // bound of an explicit range is the minimum age; added after a real
  // Better Impact listing ("designed for males and females aged 15
  // through 18") was found with a facet-derived age materially lower
  // than what its own description actually stated.
  /age[sd]?\s*(\d{1,3})\s*(?:through|to|-)\s*\d{1,3}/i,
  /(\d{1,3})\s*\+/,
  /(\d{1,3})\s*years?\s*(?:old|of age)/i,
];

/** Extracts a minimum age from free text; falls back to the platform floor (13). */
export function extractMinimumAge(text: string): number {
  for (const pattern of AGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const age = Number(match[1]);
      if (age >= PLAUSIBLE_AGE_RANGE[0] && age <= PLAUSIBLE_AGE_RANGE[1]) {
        return age;
      }
    }
  }
  return DEFAULT_MINIMUM_AGE;
}

// ---------- Commitment type + schedule inference ----------

function inferCommitmentType(text: string): "one_time" | "recurring" {
  const normalized = text.toLowerCase();
  if (/(recurring|ongoing|weekly|regular basis|repeat(?:s|ing)?|every week)/.test(normalized)) {
    return "recurring";
  }
  return "one_time";
}

const SCHEDULE_PATTERNS: { slot: string; pattern: RegExp }[] = [
  { slot: "saturday_morning", pattern: /saturday(?:s)?.{0,15}morning|morning.{0,15}saturday/i },
  { slot: "saturday_afternoon", pattern: /saturday(?:s)?.{0,15}afternoon|afternoon.{0,15}saturday/i },
  { slot: "sunday_morning", pattern: /sunday(?:s)?.{0,15}morning|morning.{0,15}sunday/i },
  { slot: "sunday_afternoon", pattern: /sunday(?:s)?.{0,15}afternoon|afternoon.{0,15}sunday/i },
  {
    slot: "weekday_morning",
    pattern: /weekday(?:s)?.{0,15}morning|(monday|tuesday|wednesday|thursday|friday).{0,15}morning/i,
  },
  {
    slot: "weekday_afternoon",
    pattern: /weekday(?:s)?.{0,15}afternoon|(monday|tuesday|wednesday|thursday|friday).{0,15}afternoon/i,
  },
  {
    slot: "weekday_evening",
    pattern: /weekday(?:s)?.{0,15}evening|(monday|tuesday|wednesday|thursday|friday).{0,15}evening/i,
  },
];

/** Best-effort keyword matching against this app's schedule-slot vocabulary. */
function inferScheduleSlots(text: string): string[] {
  const slots = new Set<string>();
  for (const { slot, pattern } of SCHEDULE_PATTERNS) {
    if (pattern.test(text)) slots.add(slot);
  }
  return [...slots];
}

// ---------- Date normalization ----------

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// ---------- Main entry point ----------

export function normalizeListing(
  raw: RawListing,
  opts: { source?: string; sourceUrl?: string; now?: () => Date } = {}
): NormalizedOpportunity {
  const lookup = buildLookup(raw);
  const now = opts.now ?? (() => new Date());

  const title =
    pickString(lookup, ["title", "name", "position", "role", "opportunity_title", "job_title"]) ??
    "Untitled opportunity";
  const description = pickString(lookup, ["description", "desc", "details", "summary", "body", "overview"]);
  const location = pickString(lookup, ["location", "city", "address", "venue", "site"]);
  const latitude = pickNumber(lookup, ["latitude", "lat"]);
  const longitude = pickNumber(lookup, ["longitude", "lng", "lon", "long"]);
  const applicationUrl = pickString(lookup, ["application_url", "apply_url", "url", "link", "apply_link"]);
  const externalId = pickString(lookup, ["external_id", "id", "listing_id", "guid", "uid"]);
  const deadlineRaw = pickString(lookup, [
    "application_deadline",
    "deadline",
    "apply_by",
    "closing_date",
    "close_date",
  ]);

  const combinedText = [title, description].filter(Boolean).join(" \n ");

  const explicitCategory = pickString(lookup, ["category", "type", "tag"]);
  const category = resolveCategory(explicitCategory, combinedText);

  const ageText = pickString(lookup, ["minimum_age", "min_age", "age_requirement", "eligibility"]) ?? combinedText;
  const minimumAge = extractMinimumAge(ageText);

  const commitmentText = pickString(lookup, ["commitment_type", "commitment", "frequency"]) ?? combinedText;
  const commitmentType = inferCommitmentType(commitmentText);

  const scheduleText = pickString(lookup, ["schedule", "availability", "days", "time_commitment"]) ?? combinedText;
  const scheduleSlots = inferScheduleSlots(scheduleText);

  const interestsTags =
    pickStringArray(lookup, ["interests_tags", "tags", "interests"]) ?? inferInterestTags(combinedText, category);

  const skillsRequired = pickStringArray(lookup, ["skills_required", "skills"]) ?? [];

  return {
    title,
    description,
    category,
    minimum_age: minimumAge,
    location,
    latitude,
    longitude,
    schedule_slots: scheduleSlots,
    skills_required: skillsRequired,
    interests_tags: interestsTags,
    commitment_type: commitmentType,
    application_url: applicationUrl,
    application_deadline: normalizeDate(deadlineRaw),
    source: opts.source ?? "unknown",
    source_url: opts.sourceUrl ?? pickString(lookup, ["source_url", "listing_url", "page_url"]),
    external_id: externalId,
    last_verified_at: now().toISOString(),
  };
}

// ---------- Dedup ----------

export type ExistingListing = {
  id: string;
  source: string;
  external_id: string | null;
  title: string;
  organizationName: string | null;
  // Added for the accelerated-catalog-growth dedup fix: all optional so
  // every existing call site (12 connectors, seed-manual-records.ts,
  // CsvImportPanel.tsx) keeps compiling and behaving exactly as before
  // if it doesn't pass them — the material-difference checks below
  // simply skip whenever either side lacks the field being compared.
  // See findDuplicate()'s own comment for why these specifically.
  applicationUrl?: string | null;
  applicationDeadline?: string | null; // any parseable date string; normalizeDateForCompare() handles the format
  location?: string | null;
  // Added for the shared-application-portal dedup fix (see
  // classifyDuplicate()): a source-declared minimum age is real,
  // comparable eligibility evidence, and a per-listing source_url is one
  // more corroborating signal an application_url match points at the
  // same real listing rather than a shared org-wide portal.
  minimumAge?: number | null;
  sourceUrl?: string | null;
};

export type DedupMatch = {
  existingId: string;
  reason: "external_id" | "application_url" | "fuzzy_match";
  similarity: number; // 1 for an external_id or application_url match
};

// ---------- Structured duplicate classification ----------

/**
 * Four-way outcome for a candidate/existing-row comparison, richer than
 * DedupMatch's binary match-or-null:
 *  - "exact_duplicate": conclusive — same source+external_id, or an
 *    application_url match corroborated by title/org/eligibility (or, for
 *    a URL with no history of being reused across distinct titles and no
 *    org/eligibility context to doubt it, the URL alone), or a strong
 *    fuzzy title+org match.
 *  - "probable_duplicate": real evidence on both sides (title
 *    similarity, a shared portal) but also some countervailing evidence
 *    (a different source-declared external_id, age, date, or location) —
 *    genuinely uncertain, meant for a human to look at, never silently
 *    merged or dropped.
 *  - "shared_portal_distinct_role": an application_url matches, but the
 *    surrounding evidence (materially different title, a different
 *    source-declared external_id/age/date/location, or an established
 *    pattern of this same URL already serving several distinctly-titled
 *    listings) indicates this is one organization's shared application
 *    portal serving genuinely different roles, not a duplicate.
 *  - "no_duplicate": nothing matched at all.
 */
export type DuplicateVerdict =
  | "exact_duplicate"
  | "probable_duplicate"
  | "shared_portal_distinct_role"
  | "no_duplicate";

export type DuplicateAnalysis = {
  verdict: DuplicateVerdict;
  /** Which underlying signal produced this verdict, when applicable — null for "no_duplicate". */
  matchTier: "external_id" | "application_url" | "fuzzy_match" | null;
  /** 0-1: estimated likelihood this candidate is the same real-world opportunity as candidateId. */
  confidence: number;
  /** Human-readable evidence strings, meant for an admin review UI and ingestion logs. */
  evidence: string[];
  candidateId: string | null;
};

export type DuplicateCandidateInput = {
  source: string;
  external_id: string | null;
  title: string;
  organizationName?: string | null;
  applicationUrl?: string | null;
  applicationDeadline?: string | null;
  location?: string | null;
  minimumAge?: number | null;
  sourceUrl?: string | null;
};

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** 1 = identical, 0 = completely different. */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** Strips a trailing slash and common tracking query params, lowercases,
 * trims — enough to treat "https://x.org/apply/" and "https://x.org/apply"
 * (or the same link with a `?utm_source=...` appended) as the same
 * canonical URL, without attempting a full URL-normalization library for
 * what's ultimately a dedup heuristic, not a routing decision. */
function normalizeUrlForCompare(url: string): string {
  try {
    const parsed = new URL(url.trim());
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|^ref$|^fbclid$|^gclid$/i.test(key)) parsed.searchParams.delete(key);
    }
    const search = parsed.searchParams.toString();
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.toLowerCase()}${path.toLowerCase()}${search ? `?${search}` : ""}`;
  } catch {
    // Not a real URL (a mailto:, a malformed string) — compare it
    // as-is rather than throwing; normalizeForCompare's caller already
    // treats a non-match here as "inconclusive," not "different."
    return url.trim().toLowerCase();
  }
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Normalizes a date string in any of this pipeline's real formats
 * (ISO "2026-11-05", US slash "11/05/2026", or the "Nov 5, 2026" style
 * lib/ingestion/sources/specialOlympicsAZ.ts's formatEventDateForTitle()
 * produces) to a canonical YYYY-MM-DD, or null if it can't be parsed —
 * never a guess. Dedup's date comparisons only ever treat two dates as
 * "materially different" when BOTH sides parse successfully and
 * genuinely disagree; an unparseable or missing date is inconclusive,
 * not evidence of anything.
 */
export function normalizeDateForCompare(date: string | null | undefined): string | null {
  if (!date) return null;
  const trimmed = date.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const named = trimmed.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const monthIndex = MONTH_NAME_TO_INDEX[named[1].slice(0, 3).toLowerCase()];
    if (monthIndex !== undefined) {
      return `${named[3]}-${String(monthIndex + 1).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Checks a candidate listing against already-ingested ones and returns a
 * full, structured classification — the general fix for the shared-
 * application-portal false positive (one organization legitimately
 * routing many distinct roles through a single application form/portal
 * URL, e.g. Arizona Science Center's Volgistics link or Firewheel STEM
 * Institute's Google Form): an exact application_url match is strong
 * evidence, but it is only ever treated as CONCLUSIVE (verdict
 * "exact_duplicate") on its own when nothing suggests it might be a
 * shared portal. In descending order of confidence:
 *
 * 1. Exact (source, external_id) match — same as the DB's unique index.
 *    The strongest possible signal, and unconditional: neither a
 *    changed title nor a changed date ever overrides it (see the "same
 *    external ID with changed title/date" regression tests) — a
 *    recurring role's own next shift date changing on refresh must
 *    update the same row, not spawn a new one ("repeated shifts of one
 *    role do not inflate the catalog").
 *
 * 2. Exact canonical application_url match. What makes this conclusive
 *    vs. merely a "shared portal, distinct role" or "probable duplicate"
 *    signal is whether anything suggests the URL is reused across
 *    multiple distinct listings rather than pointing at one specific
 *    one:
 *      - If the candidate and matched row share the same organization
 *        (context that makes "this org runs one shared portal" a live
 *        possibility), OR this exact URL is already used by 2+ OTHER
 *        existing rows with genuinely different titles (an empirically
 *        established shared-portal pattern), title similarity (and any
 *        available eligibility/date/location match) is REQUIRED to
 *        still call it conclusive.
 *      - A same-source external_id that's present and DIFFERENT on both
 *        sides, a different minimum_age, a different application
 *        deadline, or a different location are all treated as direct
 *        counter-evidence — a source-declared signal disagreeing is
 *        stronger than a shared URL, so this caps the verdict at
 *        "probable_duplicate" at best, never "exact", regardless of
 *        title similarity.
 *      - Otherwise (no organization context, no established shared-
 *        portal pattern, no counter-evidence) the URL is presumed to be
 *        a specific, per-listing link — exactly as before this fix —
 *        and stays conclusive regardless of title wording, preserving
 *        the original cross-source-copy protection (a manually-curated
 *        record and a scraper's record, worded completely differently,
 *        both pointing at the identical real application page).
 *
 * 3. Fuzzy title matching, gated by the same material-difference veto
 *    as before (a genuinely different date, location, application URL,
 *    or minimum_age on both sides excludes a row from matching no
 *    matter how similar the titles are — a field missing on either side
 *    is inconclusive, never a difference) — this is what keeps distinct
 *    calendar sessions of the same recurring event (identical titles,
 *    different dates) from being treated as duplicates.
 *
 * Nothing here is Arizona-Science-Center- or Firewheel-specific: the
 * decision only ever looks at organization name, title, external_id,
 * minimum_age, application_deadline, location, and how many existing
 * rows already share a given URL — the same general signals for any
 * organization using a shared portal.
 */
export function classifyDuplicate(
  candidate: DuplicateCandidateInput,
  existing: ExistingListing[],
  options: { titleThreshold?: number; strictTitleThreshold?: number; orgThreshold?: number } = {}
): DuplicateAnalysis {
  const titleThreshold = options.titleThreshold ?? 0.85;
  const strictTitleThreshold = options.strictTitleThreshold ?? 0.92;
  const orgThreshold = options.orgThreshold ?? 0.8;

  // ---- Tier 1: exact (source, external_id) — unconditional. ----
  if (candidate.external_id) {
    const exact = existing.find((e) => e.source === candidate.source && e.external_id === candidate.external_id);
    if (exact) {
      return {
        verdict: "exact_duplicate",
        matchTier: "external_id",
        confidence: 1,
        evidence: [`same source ("${candidate.source}") and external_id ("${candidate.external_id}")`],
        candidateId: exact.id,
      };
    }
  }

  const candidateTitle = normalizeForCompare(candidate.title);
  const candidateOrg = candidate.organizationName ? normalizeForCompare(candidate.organizationName) : null;
  const candidateDate = normalizeDateForCompare(candidate.applicationDeadline);
  const candidateLocation = candidate.location ? normalizeForCompare(candidate.location) : null;
  const candidateUrl = candidate.applicationUrl ? normalizeUrlForCompare(candidate.applicationUrl) : null;
  const candidateSourceUrl = candidate.sourceUrl ? normalizeUrlForCompare(candidate.sourceUrl) : null;

  function sameOrg(existingOrgName: string | null): boolean {
    if (!candidateOrg || !existingOrgName) return false;
    return stringSimilarity(candidateOrg, normalizeForCompare(existingOrgName)) >= orgThreshold;
  }

  // ---- Tier 2: application_url match(es). ----
  if (candidateUrl) {
    const urlMatches = existing.filter((e) => e.applicationUrl && normalizeUrlForCompare(e.applicationUrl) === candidateUrl);

    if (urlMatches.length > 0) {
      const distinctTitlesAtUrl = new Set(urlMatches.map((e) => normalizeForCompare(e.title)));
      // Empirical evidence this URL is a shared, organization-wide
      // portal rather than a per-listing link: it's already serving 2+
      // other, genuinely differently-titled rows.
      const isEstablishedSharedPortal = urlMatches.length >= 2 && distinctTitlesAtUrl.size >= 2;

      let bestExact: { row: ExistingListing; titleSim: number } | null = null;
      let bestProbable: { row: ExistingListing; titleSim: number; evidence: string[] } | null = null;
      const distinctRoleEvidence: string[] = [];
      let sawDistinctRoleSignal = false;

      for (const e of urlMatches) {
        const titleSim = stringSimilarity(candidateTitle, normalizeForCompare(e.title));
        const sameSourceDistinctId = Boolean(
          candidate.external_id && e.external_id && candidate.source === e.source && candidate.external_id !== e.external_id
        );
        const ageDiffers = Boolean(
          candidate.minimumAge != null && e.minimumAge != null && candidate.minimumAge !== e.minimumAge
        );
        const existingDate = normalizeDateForCompare(e.applicationDeadline);
        const dateDiffers = Boolean(candidateDate && existingDate && candidateDate !== existingDate);
        const existingLocation = e.location ? normalizeForCompare(e.location) : null;
        const locationDiffers = Boolean(candidateLocation && existingLocation && candidateLocation !== existingLocation);
        const hasCounterEvidence = sameSourceDistinctId || ageDiffers || dateDiffers || locationDiffers;

        const requiresCorroboration = hasCounterEvidence || isEstablishedSharedPortal || sameOrg(e.organizationName);

        if (!requiresCorroboration) {
          // No organization context, no established shared-portal
          // pattern, no counter-evidence — presumed a specific,
          // per-listing URL. Stays conclusive regardless of title
          // wording, same as before this fix (preserves the
          // cross-source-copy protection).
          const evidence = [`identical application_url ("${candidate.applicationUrl}")`];
          if (candidateSourceUrl && e.sourceUrl && normalizeUrlForCompare(e.sourceUrl) === candidateSourceUrl) {
            evidence.push("identical source_url");
          }
          return { verdict: "exact_duplicate", matchTier: "application_url", confidence: 1, evidence, candidateId: e.id };
        }

        if (hasCounterEvidence) {
          sawDistinctRoleSignal = true;
          const reasons: string[] = [];
          if (sameSourceDistinctId) reasons.push(`distinct external_id under the same source ("${candidate.external_id}" vs "${e.external_id}")`);
          if (ageDiffers) reasons.push(`different minimum_age (${candidate.minimumAge} vs ${e.minimumAge})`);
          if (dateDiffers) reasons.push(`different application_deadline (${candidateDate} vs ${existingDate})`);
          if (locationDiffers) reasons.push(`different location ("${candidate.location}" vs "${e.location}")`);
          distinctRoleEvidence.push(...reasons);

          // Explicit counter-evidence caps this at "probable" at best,
          // even with a high title score — a source-declared signal
          // actively disagreeing outweighs a shared URL.
          if (titleSim >= titleThreshold && (!bestProbable || titleSim > bestProbable.titleSim)) {
            bestProbable = { row: e, titleSim, evidence: reasons };
          }
          continue;
        }

        // requiresCorroboration via isEstablishedSharedPortal / sameOrg,
        // with no direct counter-evidence — title similarity decides.
        if (titleSim >= strictTitleThreshold) {
          if (!bestExact || titleSim > bestExact.titleSim) bestExact = { row: e, titleSim };
        } else if (titleSim >= titleThreshold) {
          if (!bestProbable || titleSim > bestProbable.titleSim) {
            bestProbable = {
              row: e,
              titleSim,
              evidence: [`title similarity ${titleSim.toFixed(2)} is above the review threshold but below the confident-match threshold`],
            };
          }
        } else {
          sawDistinctRoleSignal = true;
        }
      }

      if (bestExact) {
        return {
          verdict: "exact_duplicate",
          matchTier: "application_url",
          confidence: bestExact.titleSim,
          evidence: [`identical application_url ("${candidate.applicationUrl}")`, `title similarity ${bestExact.titleSim.toFixed(2)}`],
          candidateId: bestExact.row.id,
        };
      }

      if (bestProbable) {
        return {
          verdict: "probable_duplicate",
          matchTier: "application_url",
          confidence: Math.min(0.75, bestProbable.titleSim),
          evidence: [`shares application_url with an existing listing`, ...bestProbable.evidence],
          candidateId: bestProbable.row.id,
        };
      }

      if (isEstablishedSharedPortal || sawDistinctRoleSignal) {
        return {
          verdict: "shared_portal_distinct_role",
          matchTier: "application_url",
          confidence: 0.1,
          evidence: [
            isEstablishedSharedPortal
              ? `this application_url is already used by ${distinctTitlesAtUrl.size} other distinct listing(s) — a shared organization-wide portal, not a per-listing link`
              : `shares application_url with an existing listing, but the surrounding evidence indicates a different role`,
            ...distinctRoleEvidence,
          ],
          candidateId: null,
        };
      }

      // A single coincidental URL match, materially different title,
      // and otherwise zero corroborating or contradicting evidence —
      // genuinely ambiguous. Never silently merged or dropped.
      return {
        verdict: "probable_duplicate",
        matchTier: "application_url",
        confidence: 0.3,
        evidence: [
          "shares application_url with an existing listing",
          "title is dissimilar enough that this may be a distinct role sharing the same organization's portal — needs human review",
        ],
        candidateId: urlMatches[0].id,
      };
    }
  }

  // ---- Tier 3: fuzzy title matching, gated by the material-difference veto. ----
  let best: { row: ExistingListing; titleSim: number } | null = null;

  for (const e of existing) {
    const existingTitle = normalizeForCompare(e.title);
    const existingOrg = e.organizationName ? normalizeForCompare(e.organizationName) : null;
    const bothHaveOrg = Boolean(candidateOrg && existingOrg);

    if (bothHaveOrg && stringSimilarity(candidateOrg as string, existingOrg as string) < orgThreshold) {
      continue;
    }

    // Material-difference veto: a date, location, application URL, or
    // minimum_age that's present and genuinely different on both sides
    // is treated as real evidence these are distinct records — a title
    // alone, however similar, doesn't override it. Any one signal is
    // enough to veto; this deliberately doesn't require all of them to
    // disagree, since sources often only reliably provide one.
    const existingDate = normalizeDateForCompare(e.applicationDeadline);
    if (candidateDate && existingDate && candidateDate !== existingDate) continue;

    const existingLocation = e.location ? normalizeForCompare(e.location) : null;
    if (candidateLocation && existingLocation && candidateLocation !== existingLocation) continue;

    const existingUrl = e.applicationUrl ? normalizeUrlForCompare(e.applicationUrl) : null;
    if (candidateUrl && existingUrl && candidateUrl !== existingUrl) continue;

    if (candidate.minimumAge != null && e.minimumAge != null && candidate.minimumAge !== e.minimumAge) continue;

    const titleSim = stringSimilarity(candidateTitle, existingTitle);
    const threshold = bothHaveOrg ? titleThreshold : strictTitleThreshold;

    if (titleSim >= threshold && (!best || titleSim > best.titleSim)) {
      best = { row: e, titleSim };
    }
  }

  if (best) {
    return {
      verdict: "exact_duplicate",
      matchTier: "fuzzy_match",
      confidence: best.titleSim,
      evidence: [`title similarity ${best.titleSim.toFixed(2)}`, candidateOrg ? "organization matches" : "no organization to compare"],
      candidateId: best.row.id,
    };
  }

  return { verdict: "no_duplicate", matchTier: null, confidence: 0, evidence: [], candidateId: null };
}

/**
 * Backward-compatible adapter over classifyDuplicate() for the many
 * existing call sites (12 connectors, CsvImportPanel.tsx) built around a
 * simple "is this a duplicate I should skip/update, or not" binary: only
 * an "exact_duplicate" verdict returns non-null. "probable_duplicate"
 * and "shared_portal_distinct_role" both return null — meaning the
 * candidate is inserted as a new `pending` row rather than silently
 * skipped, so an uncertain case reaches a human via the normal
 * review-queue flow instead of vanishing. See classifyDuplicate() for
 * the full reasoning and app/admin/review-queue/page.tsx for the surface
 * that shows the richer verdict/evidence for exactly that review.
 */
export function findDuplicate(
  candidate: DuplicateCandidateInput,
  existing: ExistingListing[],
  options: { titleThreshold?: number; strictTitleThreshold?: number; orgThreshold?: number } = {}
): DedupMatch | null {
  const result = classifyDuplicate(candidate, existing, options);
  if (result.verdict !== "exact_duplicate" || !result.candidateId || !result.matchTier) return null;
  return { existingId: result.candidateId, reason: result.matchTier, similarity: result.confidence };
}
