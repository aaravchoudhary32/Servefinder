// Recommendation engine for ServeFinder
//
// match_score = 30% interests + 25% availability + 20% distance
//             + 15% skills + 10% commitment
//
// Age eligibility and travel distance are both HARD FILTERS, not scoring
// factors: if the student doesn't meet the minimum age, or the opportunity
// is farther than their max travel distance, it's excluded before scoring
// rather than merely down-weighted. A student's maxDistanceMiles is itself
// capped at MAX_DISTANCE_MILES_CAP (see lib/constants.ts) — roughly an
// hour's drive — for the same reason a hard filter exists at all: an
// opportunity a student realistically can't get to shouldn't be able to
// out-rank one they can, no matter how well it scores on the other factors.
//
// Two interest-fit strategies share everything else in this file (same
// weights, same schedule/distance/skill/commitment math): the baseline
// `scoreOpportunity`/`rankOpportunities` uses exact interest-tag overlap,
// while `scoreOpportunitySemantic`/`rankOpportunitiesSemantic` swaps that
// one factor for embedding cosine similarity, so e.g. "beach cleanup" can
// match a student interested in "environment" without sharing a literal
// tag. See lib/embeddings/ for how the vectors are produced.

import { cosineSimilarity } from "./vectorMath";
import { resolveCanonicalFocus, broadParentOf, labelForTag, isFocusValue } from "./interestTaxonomy";
import type { DeliveryMode } from "./availabilityStatus";

export type StudentProfile = {
  age: number;
  interests: string[]; // e.g. ["STEM", "environment"]
  skills: string[]; // e.g. ["tutoring", "first aid"]
  availability: string[]; // e.g. ["saturday_morning", "weekday_evening"]
  maxDistanceMiles: number;
  commitmentPreference: "one_time" | "recurring" | "either";
};

export type Opportunity = {
  id: string;
  title: string;
  minimumAge: number;
  category: string;
  interestsTags: string[];
  skillsRequired: string[];
  scheduleSlots: string[];
  // null = distance genuinely unknown/not applicable — see
  // lib/distance.ts's resolveDistanceMiles(). For an in_person
  // opportunity (the default) this means "unresolved — exclude" via
  // isWithinRange below, exactly as before this field existed. For
  // virtual/hybrid it's expected and never excludes anything.
  distanceMiles: number | null;
  // Optional, defaults to "in_person" when omitted (requiresInPerson
  // below) — every opportunity that predates the CS/Engineering batch
  // has no delivery_mode column value read into this field at all in
  // existing tests, and must keep behaving exactly as it did before.
  deliveryMode?: DeliveryMode;
  commitmentType: "one_time" | "recurring";
  descriptionEmbedding?: number[] | null; // only used by semantic scoring
};

export type MatchResult = {
  opportunity: Opportunity;
  score: number; // 0-100
  breakdown: {
    interestFit: number;
    scheduleFit: number;
    distanceFit: number;
    skillFit: number;
    commitmentFit: number;
  };
  reasons: string[];
  // Tag-based interest explanation — computed the same way regardless of
  // whether the score itself came from tag overlap (scoreOpportunity) or
  // embeddings (scoreOpportunitySemantic), since interests_tags exists on
  // every opportunity either way. Drives the "why this matches" copy;
  // see InterestMatchExplanation's own comment for what each level means.
  interestMatch: InterestMatchExplanation;
};

const WEIGHTS = {
  interest: 0.3,
  schedule: 0.25,
  distance: 0.2,
  skill: 0.15,
  commitment: 0.1,
};

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map((x) => x.toLowerCase()));
  const hits = a.filter((x) => setB.has(x.toLowerCase())).length;
  return hits / a.length;
}

// Interest fit specifically uses the overlap coefficient (hits / smaller
// set's size) rather than overlapRatio's hits/a.length: a student who picks
// several interests shouldn't have a genuinely perfect match on a narrowly-
// tagged opportunity diluted just because that opportunity doesn't also
// cover their other, unrelated interests. This only changes the result when
// the opportunity has fewer tags than the student has interests — a single-
// interest match against a single-tag opportunity scores the same as before.
//
// Business batch: a hit that only exists because of parent-rollup
// expansion (a broad "business" pick matching an opportunity's specific
// "finance" tag, or vice versa) counts for less than a literal, exact
// tag match on both sides — so a student who picked the exact subtag a
// program is tagged with scores higher than one who only picked the
// broad parent as a fallback. Every existing STEM-only or non-subtag
// scenario is unaffected: whenever a hit is exact on the ORIGINAL
// (unexpanded) tag lists too — which is always true when no subtag is
// involved at all — it still gets full weight, so pre-batch scores are
// unchanged (see the "does not affect ... pre-batch behavior unchanged"
// test in lib/matching.test.ts).
const ROLLUP_ONLY_MATCH_WEIGHT = 0.5;

// Shared by interestOverlapCoefficient (scoring) and explainInterestMatch
// (the "why this matches" copy) so the two can never disagree about what
// counts as an exact/canonical match versus a rollup-only one.
function computeInterestMatchSets(studentInterests: string[], oppTags: string[]) {
  // "Canonical" folds a legacy alias into its present-day equivalent
  // (lib/interestTaxonomy.ts's FOCUS_ALIASES) — a legacy tag and its
  // replacement represent the identical real-world focus, just a
  // different historical spelling, so a match between them earns full
  // credit, not the lesser rollup-only weight (that's reserved for a
  // genuine specific-focus-vs-broad-category softening, a real
  // hierarchy relationship rather than a renaming).
  const canonicalize = (tags: string[]) => new Set(tags.map((x) => resolveCanonicalFocus(x.toLowerCase())));
  const studentCanonical = canonicalize(studentInterests);
  const oppCanonical = canonicalize(oppTags);
  const expandedStudent = new Set(expandWithTaxonomyParents(studentInterests).map((x) => x.toLowerCase()));
  const expandedOpp = new Set(expandWithTaxonomyParents(oppTags).map((x) => x.toLowerCase()));

  const canonicalMatches = new Set<string>();
  const rollupOnlyMatches = new Set<string>();
  for (const tag of expandedStudent) {
    if (!expandedOpp.has(tag)) continue;
    if (studentCanonical.has(tag) && oppCanonical.has(tag)) canonicalMatches.add(tag);
    else rollupOnlyMatches.add(tag);
  }
  return { canonicalMatches, rollupOnlyMatches };
}

function interestOverlapCoefficient(studentInterests: string[], oppTags: string[]): number {
  if (studentInterests.length === 0 || oppTags.length === 0) return 0;
  const { canonicalMatches, rollupOnlyMatches } = computeInterestMatchSets(studentInterests, oppTags);
  const weightedHits = canonicalMatches.size * 1 + rollupOnlyMatches.size * ROLLUP_ONLY_MATCH_WEIGHT;
  // Capped at 1: a single original tag can contribute both an exact hit
  // and (via its own parent-rollup expansion) a second, lesser hit —
  // without the cap that could push a single-tag-vs-single-tag exact
  // match above 1.0.
  return Math.min(1, weightedHits / Math.min(studentInterests.length, oppTags.length));
}

export type InterestMatchExplanation = {
  // "focus": at least one shared tag is a specific major/career focus
  // (e.g. both sides carry "robotics", or one carries the legacy alias
  // for it) — the strongest, most specific claim this can make.
  // "broad": the exact/canonical shared tag(s) are only broad-category
  // tags (e.g. both carry "stem" directly) — a real, verified match,
  // just not focus-specific.
  // "rollup": no shared canonical tag at all; the only connection is a
  // parent-category inference (student picked a STEM focus, opportunity
  // is tagged with a *different* STEM focus, or only the broad "stem"
  // tag) — deliberately the softest phrasing, since nothing was actually
  // verified in common beyond "same broad field."
  // "none": no interest signal at all — either the student picked no
  // interests (undecided) or there's genuinely no overlap. Never shown
  // as a negative; the UI simply omits an interest-based reason.
  level: "focus" | "broad" | "rollup" | "none";
  labels: string[];
};

// Builds the data behind "why this matches" copy — never claims a
// specific-focus match unless a real focus-level tag is shared, and
// never penalizes or fabricates a reason for a student with no
// interests selected (isKnownFocus/labelForTag both no-op safely on an
// empty or unrecognized tag list).
export function explainInterestMatch(studentInterests: string[], oppTags: string[]): InterestMatchExplanation {
  if (studentInterests.length === 0 || oppTags.length === 0) return { level: "none", labels: [] };

  const { canonicalMatches, rollupOnlyMatches } = computeInterestMatchSets(studentInterests, oppTags);

  const focusMatches = [...canonicalMatches].filter((t) => isFocusValue(t));
  if (focusMatches.length > 0) {
    return { level: "focus", labels: dedupedLabels(focusMatches) };
  }
  if (canonicalMatches.size > 0) {
    return { level: "broad", labels: dedupedLabels([...canonicalMatches]) };
  }
  if (rollupOnlyMatches.size > 0) {
    return { level: "rollup", labels: dedupedLabels([...rollupOnlyMatches]) };
  }
  return { level: "none", labels: [] };
}

function dedupedLabels(tags: string[]): string[] {
  const labels = tags.map((t) => labelForTag(t)).filter((l): l is string => Boolean(l));
  return [...new Set(labels)];
}

// A tag list that includes a specific focus (e.g. "cybersecurity",
// "finance") also counts as carrying its broad-category parent tag
// ("stem", "business") and its canonical present-day form (if the tag
// is a legacy alias), purely for overlap purposes — this is what lets
// a student who only picked the generic broad category still match an
// opportunity tagged with a specific focus, a student who picked a
// specific focus still match a general parent-only opportunity, *and*
// a legacy-tagged profile/opportunity still match a newly-canonical
// one transparently, with no data rewritten on either side. Display
// never uses this expanded list, only interestOverlapCoefficient's
// inputs do. A no-op for any tag list that's already just broad
// categories with no focus/alias involved, so pre-taxonomy-expansion
// behavior for every such profile/opportunity is unchanged.
function expandWithTaxonomyParents(tags: string[]): string[] {
  const expanded = new Set(tags);
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    const canonical = resolveCanonicalFocus(lower);
    expanded.add(canonical);
    const parent = broadParentOf(canonical);
    if (parent) expanded.add(parent);
  }
  return [...expanded];
}

// True for the default/explicit 'in_person' mode, and for any
// opportunity that predates delivery_mode entirely (deliveryMode
// undefined) — see Opportunity.deliveryMode's own comment.
function requiresInPersonAttendance(opp: Opportunity): boolean {
  return (opp.deliveryMode ?? "in_person") === "in_person";
}

function distanceFit(opp: Opportunity, maxDistanceMiles: number): number {
  // No physical attendance required — there's no travel barrier to
  // score, so this factor contributes full credit rather than 0 (which
  // would wrongly penalize a virtual/hybrid opportunity for something
  // that was never a real constraint) or a number derived from
  // coordinates that don't represent anywhere a student needs to go.
  if (!requiresInPersonAttendance(opp)) return 1;
  // In-person but the location is unresolved (see isWithinRange below —
  // this should already have been excluded before scoring is reached,
  // this is just a safe fallback, never a fabricated distance).
  if (opp.distanceMiles === null) return 0;
  const distanceMiles = opp.distanceMiles;
  if (distanceMiles > maxDistanceMiles) return 0;
  if (maxDistanceMiles <= 0) return 1; // avoid 0/0 when the student's radius is 0 and the opportunity is right there
  // Linear falloff: full score near 0 miles, tapering to 0.5 at the max radius
  const ratio = distanceMiles / maxDistanceMiles;
  return Math.max(0, 1 - ratio * 0.5);
}

function commitmentFit(
  pref: StudentProfile["commitmentPreference"],
  type: Opportunity["commitmentType"]
): number {
  if (pref === "either") return 1;
  return pref === type ? 1 : 0.2; // not a hard filter, just weighted low
}

export function isAgeEligible(student: StudentProfile, opp: Opportunity): boolean {
  return student.age >= opp.minimumAge;
}

export function isWithinRange(student: StudentProfile, opp: Opportunity): boolean {
  // Virtual/hybrid: no physical attendance required, so distance simply
  // doesn't apply — never excluded on this basis. This is the ONLY
  // change this hard filter makes for the CS/Engineering batch; an
  // in_person opportunity (the default, including every opportunity
  // that predates delivery_mode) behaves exactly as before.
  if (!requiresInPersonAttendance(opp)) return true;
  // In-person but the location is genuinely unknown (a failed geocode,
  // or a real address that hasn't been entered) — stays excluded, same
  // safety behavior this hard filter has always had. A missing distance
  // is never treated as "close enough" or "doesn't matter" just because
  // it's absent — only an explicit non-in_person delivery_mode does that.
  if (opp.distanceMiles === null) return false;
  return opp.distanceMiles <= student.maxDistanceMiles;
}

export function scoreOpportunity(
  student: StudentProfile,
  opp: Opportunity
): MatchResult | null {
  if (!isAgeEligible(student, opp)) return null; // hard filter, excluded entirely
  if (!isWithinRange(student, opp)) return null; // hard filter, excluded entirely

  // Raw tags in, not pre-expanded — interestOverlapCoefficient does its
  // own expansion internally (and needs the *original* lists intact to
  // tell a canonical/alias match from a genuine broad-parent rollup;
  // double-expanding here used to be harmless when expansion only ever
  // added a broad parent, but now that expansion also folds in a tag's
  // canonical form, pre-expanding would feed it back in as if it were
  // one of the student's/opportunity's own original tags).
  const interestFit = interestOverlapCoefficient(student.interests, opp.interestsTags);
  const scheduleFit = overlapRatio(student.availability, opp.scheduleSlots);
  const distFit = distanceFit(opp, student.maxDistanceMiles);
  const skillFit = overlapRatio(student.skills, opp.skillsRequired);
  const commitFit = commitmentFit(student.commitmentPreference, opp.commitmentType);

  const score =
    interestFit * WEIGHTS.interest +
    scheduleFit * WEIGHTS.schedule +
    distFit * WEIGHTS.distance +
    skillFit * WEIGHTS.skill +
    commitFit * WEIGHTS.commitment;

  const reasons: string[] = [];
  if (interestFit >= 0.5) reasons.push("Strong interest match");
  if (scheduleFit >= 0.5) reasons.push("Schedule matches your availability");
  if (!requiresInPersonAttendance(opp)) reasons.push("No travel required — participate virtually");
  else if (distFit >= 0.75) reasons.push("Close to home");
  else if (distFit > 0) reasons.push("Within travel range");
  if (skillFit >= 0.5) reasons.push("Relevant skills or experience");
  if (commitFit === 1) reasons.push("Commitment type matches your preference");

  return {
    opportunity: opp,
    score: Math.round(score * 100),
    breakdown: {
      interestFit: Math.round(interestFit * 100),
      scheduleFit: Math.round(scheduleFit * 100),
      distanceFit: Math.round(distFit * 100),
      skillFit: Math.round(skillFit * 100),
      commitmentFit: Math.round(commitFit * 100),
    },
    reasons,
    interestMatch: explainInterestMatch(student.interests, opp.interestsTags),
  };
}

export function rankOpportunities(
  student: StudentProfile,
  opportunities: Opportunity[]
): MatchResult[] {
  return opportunities
    .map((opp) => scoreOpportunity(student, opp))
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score);
}

// Cosine similarity is mathematically -1..1, but for real short-text
// embeddings from this model it's rare to see meaningfully negative
// values — clamp to 0..1 so it behaves like the other fit scores rather
// than producing a confusing negative "interest fit".
function clampFit(similarity: number): number {
  return Math.max(0, Math.min(1, similarity));
}

export function scoreOpportunitySemantic(
  student: StudentProfile,
  studentEmbedding: number[] | null,
  opp: Opportunity
): MatchResult | null {
  if (!isAgeEligible(student, opp)) return null;
  if (!isWithinRange(student, opp)) return null;

  // No embedding on one side (model not yet run, or a row that predates
  // this feature) degrades to "no signal" rather than crashing or
  // silently falling back to tag-matching — that would make the two
  // modes' scores incomparable in a way that's invisible to the caller.
  const interestFit =
    studentEmbedding && opp.descriptionEmbedding
      ? clampFit(cosineSimilarity(studentEmbedding, opp.descriptionEmbedding))
      : 0;

  const scheduleFit = overlapRatio(student.availability, opp.scheduleSlots);
  const distFit = distanceFit(opp, student.maxDistanceMiles);
  const skillFit = overlapRatio(student.skills, opp.skillsRequired);
  const commitFit = commitmentFit(student.commitmentPreference, opp.commitmentType);

  const score =
    interestFit * WEIGHTS.interest +
    scheduleFit * WEIGHTS.schedule +
    distFit * WEIGHTS.distance +
    skillFit * WEIGHTS.skill +
    commitFit * WEIGHTS.commitment;

  const reasons: string[] = [];
  if (interestFit >= 0.5) reasons.push("Description closely matches your interests");
  if (scheduleFit >= 0.5) reasons.push("Schedule matches your availability");
  if (!requiresInPersonAttendance(opp)) reasons.push("No travel required — participate virtually");
  else if (distFit >= 0.75) reasons.push("Close to home");
  else if (distFit > 0) reasons.push("Within travel range");
  if (skillFit >= 0.5) reasons.push("Relevant skills or experience");
  if (commitFit === 1) reasons.push("Commitment type matches your preference");

  return {
    opportunity: opp,
    score: Math.round(score * 100),
    breakdown: {
      interestFit: Math.round(interestFit * 100),
      scheduleFit: Math.round(scheduleFit * 100),
      distanceFit: Math.round(distFit * 100),
      skillFit: Math.round(skillFit * 100),
      commitmentFit: Math.round(commitFit * 100),
    },
    reasons,
    interestMatch: explainInterestMatch(student.interests, opp.interestsTags),
  };
}

export function rankOpportunitiesSemantic(
  student: StudentProfile,
  studentEmbedding: number[] | null,
  opportunities: Opportunity[]
): MatchResult[] {
  return opportunities
    .map((opp) => scoreOpportunitySemantic(student, studentEmbedding, opp))
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score);
}
