import { describe, it, expect } from "vitest";
import {
  isAgeEligible,
  isWithinRange,
  scoreOpportunity,
  rankOpportunities,
  scoreOpportunitySemantic,
  rankOpportunitiesSemantic,
  explainInterestMatch,
  type StudentProfile,
  type Opportunity,
} from "./matching";

function makeStudent(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    age: 16,
    interests: ["environment", "stem"],
    skills: ["tutoring"],
    availability: ["saturday_morning"],
    maxDistanceMiles: 10,
    commitmentPreference: "either",
    ...overrides,
  };
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    title: "Beach Cleanup",
    minimumAge: 13,
    category: "Environment",
    interestsTags: ["environment"],
    skillsRequired: [],
    scheduleSlots: ["saturday_morning"],
    distanceMiles: 5,
    commitmentType: "one_time",
    ...overrides,
  };
}

describe("isAgeEligible", () => {
  it("is eligible when student meets the minimum age", () => {
    expect(isAgeEligible(makeStudent({ age: 16 }), makeOpportunity({ minimumAge: 16 }))).toBe(true);
  });

  it("is eligible when student exceeds the minimum age", () => {
    expect(isAgeEligible(makeStudent({ age: 18 }), makeOpportunity({ minimumAge: 13 }))).toBe(true);
  });

  it("is ineligible when student is under the minimum age", () => {
    expect(isAgeEligible(makeStudent({ age: 12 }), makeOpportunity({ minimumAge: 13 }))).toBe(false);
  });
});

describe("scoreOpportunity - age hard filter", () => {
  it("returns null and excludes underage students regardless of otherwise-perfect fit", () => {
    const student = makeStudent({ age: 12 });
    const opp = makeOpportunity({
      minimumAge: 16,
      interestsTags: ["environment", "stem"],
      scheduleSlots: ["saturday_morning"],
      distanceMiles: 0,
    });
    expect(scoreOpportunity(student, opp)).toBeNull();
  });
});

describe("isWithinRange", () => {
  it("is within range when distance is under the student's max", () => {
    expect(isWithinRange(makeStudent({ maxDistanceMiles: 20 }), makeOpportunity({ distanceMiles: 19 }))).toBe(true);
  });

  it("is within range when distance exactly equals the student's max (inclusive boundary)", () => {
    expect(isWithinRange(makeStudent({ maxDistanceMiles: 20 }), makeOpportunity({ distanceMiles: 20 }))).toBe(true);
  });

  it("is out of range when distance exceeds the student's max", () => {
    expect(isWithinRange(makeStudent({ maxDistanceMiles: 20 }), makeOpportunity({ distanceMiles: 1654 }))).toBe(
      false
    );
  });
});

describe("scoreOpportunity - distance hard filter", () => {
  it("returns null by default for an opportunity outside maxDistanceMiles, regardless of otherwise-perfect fit", () => {
    const student = makeStudent({ maxDistanceMiles: 20 });
    const opp = makeOpportunity({
      interestsTags: ["environment", "stem"],
      scheduleSlots: ["saturday_morning"],
      distanceMiles: 1654, // e.g. a real nationwide-sourced listing far from the student
    });
    expect(scoreOpportunity(student, opp)).toBeNull();
  });

  it("does not exclude an opportunity exactly at the max distance", () => {
    const student = makeStudent({ maxDistanceMiles: 20 });
    const opp = makeOpportunity({ distanceMiles: 20 });
    expect(scoreOpportunity(student, opp)).not.toBeNull();
  });

  it("applies the distance hard filter independently of the age hard filter", () => {
    const student = makeStudent({ age: 12, maxDistanceMiles: 20 });
    const opp = makeOpportunity({ minimumAge: 16, distanceMiles: 1654 });
    // underage AND out of range — either alone would exclude it; confirming no crash/interaction bug
    expect(scoreOpportunity(student, opp)).toBeNull();
  });
});

describe("scoreOpportunity - scoring", () => {
  it("scores 100 for a perfect match on every factor", () => {
    const student = makeStudent({
      interests: ["environment"],
      skills: ["kayaking"],
      availability: ["saturday_morning"],
      maxDistanceMiles: 10,
      commitmentPreference: "one_time",
    });
    const opp = makeOpportunity({
      interestsTags: ["environment"],
      skillsRequired: ["kayaking"],
      scheduleSlots: ["saturday_morning"],
      distanceMiles: 0,
      commitmentType: "one_time",
    });
    const result = scoreOpportunity(student, opp);
    expect(result?.score).toBe(100);
    expect(result?.breakdown).toEqual({
      interestFit: 100,
      scheduleFit: 100,
      distanceFit: 100,
      skillFit: 100,
      commitmentFit: 100,
    });
  });

  it("scores 0 on every soft factor for a complete mismatch, while staying within travel range", () => {
    const student = makeStudent({
      interests: ["stem"],
      skills: ["coding"],
      availability: ["sunday_afternoon"],
      maxDistanceMiles: 5,
      commitmentPreference: "recurring",
    });
    const opp = makeOpportunity({
      interestsTags: ["animals"],
      skillsRequired: ["first_aid"],
      scheduleSlots: ["saturday_morning"],
      distanceMiles: 5, // at the edge of range, not beyond it (that's a hard exclusion, tested separately)
      commitmentType: "one_time",
    });
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.interestFit).toBe(0);
    expect(result?.breakdown.scheduleFit).toBe(0);
    expect(result?.breakdown.distanceFit).toBe(50); // tapers to 0.5 at the max radius, never 0 while in range
    expect(result?.breakdown.skillFit).toBe(0);
    // mismatched commitment is weighted low (0.2), not a hard 0
    expect(result?.breakdown.commitmentFit).toBe(20);
  });

  it("weights interest at 30%, schedule 25%, distance 20%, skill 15%, commitment 10%", () => {
    // Only interest matches; every other factor is a total mismatch, and
    // distance sits right at the max radius (tapered fit, still in range).
    const student = makeStudent({
      interests: ["environment"],
      skills: ["coding"],
      availability: ["sunday_afternoon"],
      maxDistanceMiles: 5,
      commitmentPreference: "recurring",
    });
    const opp = makeOpportunity({
      interestsTags: ["environment"],
      skillsRequired: ["first_aid"],
      scheduleSlots: ["saturday_morning"],
      distanceMiles: 5,
      commitmentType: "one_time",
    });
    const result = scoreOpportunity(student, opp);
    // 1.0 * 0.3 (interest) + 0 (schedule) + 0.5 * 0.2 (distance, tapered at max radius) + 0 (skill) + 0.2 * 0.1 (commitment mismatch)
    expect(result?.score).toBe(Math.round((0.3 + 0.5 * 0.2 + 0.2 * 0.1) * 100));
  });

  it("applies linear distance falloff within the travel radius", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const atOrigin = scoreOpportunity(student, makeOpportunity({ distanceMiles: 0 }));
    const atMax = scoreOpportunity(student, makeOpportunity({ distanceMiles: 10 }));

    expect(atOrigin?.breakdown.distanceFit).toBe(100);
    expect(atMax?.breakdown.distanceFit).toBe(50); // tapers to 0.5 at the max radius
  });

  it("treats 'either' commitment preference as a full match against any type", () => {
    const student = makeStudent({ commitmentPreference: "either" });
    const oneTime = scoreOpportunity(student, makeOpportunity({ commitmentType: "one_time" }));
    const recurring = scoreOpportunity(student, makeOpportunity({ commitmentType: "recurring" }));
    expect(oneTime?.breakdown.commitmentFit).toBe(100);
    expect(recurring?.breakdown.commitmentFit).toBe(100);
  });
});

describe("scoreOpportunity - empty/edge-case inputs", () => {
  it("scores 0 interest fit when the student has no interests", () => {
    const student = makeStudent({ interests: [] });
    const opp = makeOpportunity({ interestsTags: ["environment"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(0);
  });

  it("scores 0 interest fit when the opportunity has no interest tags", () => {
    const student = makeStudent({ interests: ["environment"] });
    const opp = makeOpportunity({ interestsTags: [] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(0);
  });

  it("scores 0 interest fit when both sides have no interests/tags", () => {
    const student = makeStudent({ interests: [] });
    const opp = makeOpportunity({ interestsTags: [] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(0);
  });

  it("does not divide by zero when maxDistanceMiles is 0 and distance is also 0", () => {
    const student = makeStudent({ maxDistanceMiles: 0 });
    const opp = makeOpportunity({ distanceMiles: 0 });
    const result = scoreOpportunity(student, opp);
    expect(Number.isNaN(result?.breakdown.distanceFit)).toBe(false);
    expect(result?.breakdown.distanceFit).toBe(100);
  });

  it("matches interest tags case-insensitively", () => {
    const student = makeStudent({ interests: ["Environment"] });
    const opp = makeOpportunity({ interestsTags: ["environment"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(100);
  });

  it("produces a 'Strong interest match' reason only when interest fit is at least 50%", () => {
    // Interest fit is hits / min(student interests, opportunity tags) — a
    // student matching an opportunity's only tag is a perfect fit on that
    // opportunity regardless of how many other, unrelated interests they
    // also picked, so both of these score 100% and both count as strong.
    const perfectFitFewInterests = scoreOpportunity(
      makeStudent({ interests: ["environment", "stem"] }),
      makeOpportunity({ interestsTags: ["environment"] })
    );
    const perfectFitManyInterests = scoreOpportunity(
      makeStudent({ interests: ["environment", "stem", "animals", "arts"] }),
      makeOpportunity({ interestsTags: ["environment"] })
    );
    expect(perfectFitFewInterests?.reasons).toContain("Strong interest match");
    expect(perfectFitManyInterests?.reasons).toContain("Strong interest match");

    // A genuinely weak fit: only 1 of 3 mutual "slots" (min(4 student
    // interests, 3 opportunity tags)) overlaps, so this stays below 50%
    // regardless of which side's length the ratio is taken against.
    const weak = scoreOpportunity(
      makeStudent({ interests: ["environment", "stem", "animals", "arts"] }),
      makeOpportunity({ interestsTags: ["environment", "healthcare", "community"] })
    );
    expect(weak?.reasons).not.toContain("Strong interest match");
  });
});

describe("rankOpportunities", () => {
  it("excludes ineligible opportunities and sorts the rest by descending score", () => {
    const student = makeStudent({ age: 15, interests: ["environment"], maxDistanceMiles: 20 });
    const opportunities: Opportunity[] = [
      makeOpportunity({ id: "low", interestsTags: [], distanceMiles: 19 }),
      makeOpportunity({ id: "underage", minimumAge: 18 }),
      makeOpportunity({ id: "high", interestsTags: ["environment"], distanceMiles: 0 }),
    ];

    const ranked = rankOpportunities(student, opportunities);

    expect(ranked.map((r) => r.opportunity.id)).toEqual(["high", "low"]);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("returns an empty array when given no opportunities", () => {
    expect(rankOpportunities(makeStudent(), [])).toEqual([]);
  });

  it("excludes out-of-range opportunities entirely, regardless of how well they'd otherwise score", () => {
    const student = makeStudent({ maxDistanceMiles: 20 });
    const opportunities: Opportunity[] = [
      makeOpportunity({ id: "near", distanceMiles: 5 }),
      makeOpportunity({ id: "far", distanceMiles: 1654 }),
    ];

    const ranked = rankOpportunities(student, opportunities);
    expect(ranked.map((r) => r.opportunity.id)).toEqual(["near"]);
  });

  it("is deterministic: identical inputs produce identical output on repeated calls", () => {
    const student = makeStudent();
    const opportunities: Opportunity[] = [
      makeOpportunity({ id: "a", interestsTags: ["environment"] }),
      makeOpportunity({ id: "b", interestsTags: ["stem"], distanceMiles: 3 }),
      makeOpportunity({ id: "c", skillsRequired: ["tutoring"], scheduleSlots: ["saturday_morning"] }),
    ];
    const first = rankOpportunities(student, opportunities);
    const second = rankOpportunities(student, opportunities);
    expect(second).toEqual(first);
  });

  it("preserves input order for tied scores (JS's stable sort, not an arbitrary tiebreaker)", () => {
    const student = makeStudent({ interests: [], maxDistanceMiles: 10 });
    // All three score identically (0 interest fit, same distance/schedule/
    // skill/commitment) — nothing here breaks the tie except input order.
    const opportunities: Opportunity[] = [
      makeOpportunity({ id: "first", distanceMiles: 5 }),
      makeOpportunity({ id: "second", distanceMiles: 5 }),
      makeOpportunity({ id: "third", distanceMiles: 5 }),
    ];
    const ranked = rankOpportunities(student, opportunities);
    expect(ranked.map((r) => r.score)).toEqual([ranked[0].score, ranked[0].score, ranked[0].score]);
    expect(ranked.map((r) => r.opportunity.id)).toEqual(["first", "second", "third"]);
  });
});

describe("scoreOpportunitySemantic", () => {
  it("applies the same age hard filter as the tag-based scorer", () => {
    const student = makeStudent({ age: 10 });
    const opp = makeOpportunity({ minimumAge: 16 });
    expect(scoreOpportunitySemantic(student, [1, 0, 0], opp)).toBeNull();
  });

  it("applies the same distance hard filter as the tag-based scorer", () => {
    const student = makeStudent({ maxDistanceMiles: 20 });
    const opp = makeOpportunity({ distanceMiles: 1654 });
    expect(scoreOpportunitySemantic(student, [1, 0, 0], opp)).toBeNull();
  });

  it("degrades interest fit to 0 (not a crash or a fallback to tag matching) when the student has no embedding", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ descriptionEmbedding: [1, 0, 0] });
    const result = scoreOpportunitySemantic(student, null, opp);
    expect(result?.breakdown.interestFit).toBe(0);
  });

  it("degrades interest fit to 0 when the opportunity has no embedding", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ descriptionEmbedding: null });
    const result = scoreOpportunitySemantic(student, [1, 0, 0], opp);
    expect(result?.breakdown.interestFit).toBe(0);
  });

  it("scores interest fit near 100 for identical embeddings", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ descriptionEmbedding: [1, 0, 0] });
    const result = scoreOpportunitySemantic(student, [1, 0, 0], opp);
    expect(result?.breakdown.interestFit).toBe(100);
  });

  it("scores interest fit at 0 for orthogonal embeddings (clamped, not negative)", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ descriptionEmbedding: [0, 1, 0] });
    const result = scoreOpportunitySemantic(student, [1, 0, 0], opp);
    expect(result?.breakdown.interestFit).toBe(0);
  });

  it("clamps negative cosine similarity (opposite-direction embeddings) to 0, not a negative score", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ descriptionEmbedding: [-1, 0, 0] });
    const result = scoreOpportunitySemantic(student, [1, 0, 0], opp);
    expect(result?.breakdown.interestFit).toBe(0);
  });

  it("does not crash on mismatched-dimension embeddings and scores interest fit as 0", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ descriptionEmbedding: [1, 0] });
    const result = scoreOpportunitySemantic(student, [1, 0, 0], opp);
    expect(result?.breakdown.interestFit).toBe(0);
  });

  it("still uses exact-overlap scoring for schedule/distance/skill/commitment", () => {
    const student = makeStudent({
      availability: ["saturday_morning"],
      skills: ["kayaking"],
      maxDistanceMiles: 10,
      commitmentPreference: "one_time",
    });
    const opp = makeOpportunity({
      descriptionEmbedding: [1, 0, 0],
      scheduleSlots: ["saturday_morning"],
      skillsRequired: ["kayaking"],
      distanceMiles: 0,
      commitmentType: "one_time",
    });
    const result = scoreOpportunitySemantic(student, [1, 0, 0], opp);
    expect(result?.breakdown).toEqual({
      interestFit: 100,
      scheduleFit: 100,
      distanceFit: 100,
      skillFit: 100,
      commitmentFit: 100,
    });
  });
});

describe("rankOpportunitiesSemantic", () => {
  it("excludes ineligible opportunities and sorts by descending semantic score", () => {
    const student = makeStudent({ age: 15, maxDistanceMiles: 20 });
    const opportunities: Opportunity[] = [
      makeOpportunity({ id: "no-match", descriptionEmbedding: [0, 1, 0], distanceMiles: 19 }),
      makeOpportunity({ id: "underage", minimumAge: 18 }),
      makeOpportunity({ id: "close-match", descriptionEmbedding: [1, 0, 0], distanceMiles: 0 }),
    ];

    const ranked = rankOpportunitiesSemantic(student, [1, 0, 0], opportunities);

    expect(ranked.map((r) => r.opportunity.id)).toEqual(["close-match", "no-match"]);
  });

  it("returns an empty array when given no opportunities", () => {
    expect(rankOpportunitiesSemantic(makeStudent(), [1, 0, 0], [])).toEqual([]);
  });
});

// CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology batch: a
// STEM subtag (e.g. "cybersecurity") should also credit the broad "stem"
// tag for interest-fit overlap, in both directions — see
// lib/interestTaxonomy.ts and expandWithStemParent() in matching.ts.
describe("scoreOpportunity - STEM subtag parent-rollup", () => {
  it("matches a student who only picked broad 'stem' against an opportunity tagged with a specific subtag", () => {
    const student = makeStudent({ interests: ["stem"] });
    const opp = makeOpportunity({ interestsTags: ["robotics"] });
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("matches a student who picked a specific subtag against an opportunity tagged only with broad 'stem'", () => {
    const student = makeStudent({ interests: ["cybersecurity"] });
    const opp = makeOpportunity({ interestsTags: ["stem"] });
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("gives a stronger interest fit for an exact subtag-to-subtag match than a subtag-to-broad-stem fallback match", () => {
    const exactStudent = makeStudent({ interests: ["robotics"] });
    const fallbackStudent = makeStudent({ interests: ["cybersecurity"] });
    const opp = makeOpportunity({ interestsTags: ["robotics"] });

    const exactResult = scoreOpportunity(exactStudent, opp);
    const fallbackResult = scoreOpportunity(fallbackStudent, opp);

    expect(exactResult?.breakdown.interestFit).toBeGreaterThan(fallbackResult?.breakdown.interestFit ?? 0);
  });

  it("does not affect students/opportunities with no STEM subtags at all (pre-batch behavior unchanged)", () => {
    const student = makeStudent({ interests: ["environment"] });
    const opp = makeOpportunity({ interestsTags: ["environment"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(100);
  });

  it("does not credit an unrelated non-STEM interest just because the student also has a STEM subtag", () => {
    const student = makeStudent({ interests: ["cybersecurity", "animals"] });
    const opp = makeOpportunity({ interestsTags: ["environment"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(0);
  });

  it("is deterministic across repeated calls with identical inputs", () => {
    const student = makeStudent({ interests: ["cybersecurity"] });
    const opp = makeOpportunity({ interestsTags: ["stem"] });
    const first = scoreOpportunity(student, opp);
    const second = scoreOpportunity(student, opp);
    expect(first).toEqual(second);
  });
});

// Business/Entrepreneurship/Finance/Marketing/Social Innovation batch —
// mirrors the STEM subtag parent-rollup coverage above exactly, since
// expandWithTaxonomyParents() now handles both taxonomies via the same
// mechanism. See lib/interestTaxonomy.ts's BUSINESS_SUBTAG_OPTIONS.
describe("scoreOpportunity - Business subtag parent-rollup", () => {
  it("matches a student who only picked broad 'business' against an opportunity tagged with a specific subtag", () => {
    const student = makeStudent({ interests: ["business"] });
    const opp = makeOpportunity({ interestsTags: ["finance"] });
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("matches a student who picked a specific subtag against an opportunity tagged only with broad 'business'", () => {
    const student = makeStudent({ interests: ["entrepreneurship"] });
    const opp = makeOpportunity({ interestsTags: ["business"] });
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("gives a stronger interest fit for an exact subtag-to-subtag match than a subtag-to-broad-business fallback match", () => {
    const exactStudent = makeStudent({ interests: ["marketing"] });
    const fallbackStudent = makeStudent({ interests: ["finance"] });
    const opp = makeOpportunity({ interestsTags: ["marketing"] });

    const exactResult = scoreOpportunity(exactStudent, opp);
    const fallbackResult = scoreOpportunity(fallbackStudent, opp);

    expect(exactResult?.breakdown.interestFit).toBeGreaterThan(fallbackResult?.breakdown.interestFit ?? 0);
  });

  it("gives a broad-interest student full credit against a broad-only opportunity (exact match at the parent level)", () => {
    const student = makeStudent({ interests: ["business"] });
    const opp = makeOpportunity({ interestsTags: ["business"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(100);
  });

  it("does not affect students/opportunities with no Business tags at all (pre-batch behavior unchanged)", () => {
    const student = makeStudent({ interests: ["environment"] });
    const opp = makeOpportunity({ interestsTags: ["environment"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(100);
  });

  it("does not credit an unrelated non-Business interest just because the student also has a Business subtag", () => {
    const student = makeStudent({ interests: ["finance", "animals"] });
    const opp = makeOpportunity({ interestsTags: ["environment"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(0);
  });

  it("does not cross-credit a STEM subtag against a Business opportunity, or vice versa — the two taxonomies stay isolated", () => {
    const stemStudent = makeStudent({ interests: ["cybersecurity"] });
    const businessOpp = makeOpportunity({ interestsTags: ["finance"] });
    expect(scoreOpportunity(stemStudent, businessOpp)?.breakdown.interestFit).toBe(0);

    const businessStudent = makeStudent({ interests: ["marketing"] });
    const stemOpp = makeOpportunity({ interestsTags: ["robotics"] });
    expect(scoreOpportunity(businessStudent, stemOpp)?.breakdown.interestFit).toBe(0);
  });

  it("a student who picks both a STEM subtag and a Business subtag still gets full credit for a broad-'stem'-only opportunity (STEM rollup unaffected by the new taxonomy sharing the same expansion function)", () => {
    const student = makeStudent({ interests: ["robotics", "finance"] });
    const opp = makeOpportunity({ interestsTags: ["stem"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("is deterministic across repeated calls with identical inputs", () => {
    const student = makeStudent({ interests: ["finance"] });
    const opp = makeOpportunity({ interestsTags: ["business"] });
    const first = scoreOpportunity(student, opp);
    const second = scoreOpportunity(student, opp);
    expect(first).toEqual(second);
  });
});

// Canonical taxonomy batch (10 categories, alias mapping) — required
// coverage: exact focus match, broad-interest fallback, multiple
// focuses, undecided/no-focus neutrality, and legacy-alias equivalence
// in a category that had no subtags at all before this batch.
describe("scoreOpportunity - canonical taxonomy (10-category generalization)", () => {
  it("exact focus match in a newly-added category (Healthcare) works the same as the original STEM/Business pattern", () => {
    const student = makeStudent({ interests: ["nursing"] });
    const opp = makeOpportunity({ interestsTags: ["nursing"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(100);
  });

  it("broad-interest fallback works in a newly-added category: broad 'healthcare' matches a specific 'nursing'-tagged opportunity", () => {
    const student = makeStudent({ interests: ["healthcare"] });
    const opp = makeOpportunity({ interestsTags: ["nursing"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("a student with multiple focuses across different categories still gets credit for either", () => {
    const student = makeStudent({ interests: ["nursing", "robotics"] });
    const nursingOpp = makeOpportunity({ interestsTags: ["nursing"] });
    const roboticsOpp = makeOpportunity({ interestsTags: ["robotics"] });
    expect(scoreOpportunity(student, nursingOpp)?.breakdown.interestFit).toBeGreaterThan(0);
    expect(scoreOpportunity(student, roboticsOpp)?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("an undecided student (broad category only, no focus picked) is not penalized relative to a focus-picking student against a broad-only opportunity", () => {
    const undecided = makeStudent({ interests: ["healthcare"] });
    const focused = makeStudent({ interests: ["nursing"] });
    const broadOpp = makeOpportunity({ interestsTags: ["healthcare"] });
    // Undecided gets full credit (exact match at the broad level); the
    // focus-picker gets the lesser rollup weight here, since *they*
    // picked something more specific than what this particular
    // opportunity offers — neither is penalized below what an exact
    // match at whatever level they specified would give.
    expect(scoreOpportunity(undecided, broadOpp)?.breakdown.interestFit).toBe(100);
    expect(scoreOpportunity(focused, broadOpp)?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("a student with no interests at all is not crashed or penalized below zero (neutral floor)", () => {
    const student = makeStudent({ interests: [] });
    const opp = makeOpportunity({ interestsTags: ["nursing"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBe(0);
  });

  it("a legacy alias earns full credit against its new canonical replacement, not the lesser rollup weight (identity, not hierarchy)", () => {
    const legacyStudent = makeStudent({ interests: ["computer_science"] });
    const canonicalOpp = makeOpportunity({ interestsTags: ["cs_software_engineering"] });
    expect(scoreOpportunity(legacyStudent, canonicalOpp)?.breakdown.interestFit).toBe(100);

    // Compare against a genuine hierarchy relationship (specific focus
    // vs. its broad parent), which should score lower than the alias
    // case above.
    const broadOpp = makeOpportunity({ interestsTags: ["stem"] });
    expect(scoreOpportunity(legacyStudent, broadOpp)?.breakdown.interestFit).toBeLessThan(100);
  });

  it("a retired value (stem_leadership) still rolls up to its broad category for matching", () => {
    const student = makeStudent({ interests: ["stem_leadership"] });
    const opp = makeOpportunity({ interestsTags: ["stem"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBeGreaterThan(0);
  });

  it("quantum_computing aliases to Computer Science & Software Engineering (evidence-based exception): full credit for an exact CS match, only the lesser same-broad-category rollup credit for a Physics & Astronomy opportunity (both are STEM, but not the same focus)", () => {
    const student = makeStudent({ interests: ["quantum_computing"] });
    const csOpp = makeOpportunity({ interestsTags: ["cs_software_engineering"] });
    const physicsOpp = makeOpportunity({ interestsTags: ["physics_astronomy"] });
    const csScore = scoreOpportunity(student, csOpp)?.breakdown.interestFit ?? 0;
    const physicsScore = scoreOpportunity(student, physicsOpp)?.breakdown.interestFit ?? 0;
    expect(csScore).toBe(100);
    expect(physicsScore).toBeGreaterThan(0);
    expect(physicsScore).toBeLessThan(csScore);
  });

  it("the new Government, Law & Advocacy category matches like any other", () => {
    const student = makeStudent({ interests: ["government_law"] });
    const opp = makeOpportunity({ interestsTags: ["civic_engagement"] });
    expect(scoreOpportunity(student, opp)?.breakdown.interestFit).toBeGreaterThan(0);
  });
});

// CS/Engineering batch: delivery_mode. See lib/availabilityStatus.ts's
// DeliveryMode header for the full reasoning — this section verifies the
// hard-filter/scoring behavior it drives in lib/matching.ts.
describe("isWithinRange / distanceFit — delivery mode", () => {
  it("includes a virtual opportunity with null coordinates (distanceMiles: null)", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const opp = makeOpportunity({ deliveryMode: "virtual", distanceMiles: null });
    expect(isWithinRange(student, opp)).toBe(true);
    const result = scoreOpportunity(student, opp);
    expect(result).not.toBeNull();
  });

  it("includes an in-person opportunity with coordinates inside the student's radius", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const opp = makeOpportunity({ deliveryMode: "in_person", distanceMiles: 5 });
    expect(isWithinRange(student, opp)).toBe(true);
    expect(scoreOpportunity(student, opp)).not.toBeNull();
  });

  it("excludes an in-person opportunity with coordinates outside the student's radius", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const opp = makeOpportunity({ deliveryMode: "in_person", distanceMiles: 25 });
    expect(isWithinRange(student, opp)).toBe(false);
    expect(scoreOpportunity(student, opp)).toBeNull();
  });

  it("excludes an in-person opportunity with null coordinates (unresolved location) — the pre-batch safety behavior, unchanged", () => {
    const student = makeStudent({ maxDistanceMiles: 50 });
    const opp = makeOpportunity({ deliveryMode: "in_person", distanceMiles: null });
    expect(isWithinRange(student, opp)).toBe(false);
    expect(scoreOpportunity(student, opp)).toBeNull();
  });

  it("failed geocoding does not imply virtual — a null distance on an in_person opportunity is excluded, not treated as no-distance-required", () => {
    const student = makeStudent({ maxDistanceMiles: 50 });
    // deliveryMode omitted entirely (undefined), matching a real
    // pre-batch opportunity row whose distance failed to resolve.
    const opp = makeOpportunity({ distanceMiles: null });
    expect(opp.deliveryMode).toBeUndefined();
    expect(isWithinRange(student, opp)).toBe(false);
  });

  it("hybrid opportunity: bypasses the distance hard filter the same way virtual does", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const opp = makeOpportunity({ deliveryMode: "hybrid", distanceMiles: null });
    expect(isWithinRange(student, opp)).toBe(true);
    expect(scoreOpportunity(student, opp)).not.toBeNull();
  });

  it("hybrid opportunity is also included even when it happens to have coordinates far outside the radius — remote participation makes the physical distance irrelevant", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const opp = makeOpportunity({ deliveryMode: "hybrid", distanceMiles: 500 });
    expect(isWithinRange(student, opp)).toBe(true);
  });

  it("existing records (deliveryMode omitted entirely) default safely to in_person behavior", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const nearby = makeOpportunity({ distanceMiles: 5 });
    const farAway = makeOpportunity({ distanceMiles: 25 });
    expect(nearby.deliveryMode).toBeUndefined();
    expect(isWithinRange(student, nearby)).toBe(true);
    expect(isWithinRange(student, farAway)).toBe(false);
  });

  it("a virtual opportunity still respects the age hard filter", () => {
    const student = makeStudent({ age: 13 });
    const opp = makeOpportunity({ deliveryMode: "virtual", distanceMiles: null, minimumAge: 16 });
    expect(scoreOpportunity(student, opp)).toBeNull();
  });

  it("a virtual opportunity still scores schedule/availability overlap normally — the delivery-mode bypass only touches distance", () => {
    const student = makeStudent({ availability: ["saturday_morning"] });
    const matching = makeOpportunity({ deliveryMode: "virtual", distanceMiles: null, scheduleSlots: ["saturday_morning"] });
    const nonMatching = makeOpportunity({ deliveryMode: "virtual", distanceMiles: null, scheduleSlots: ["sunday_afternoon"] });
    expect(scoreOpportunity(student, matching)?.breakdown.scheduleFit).toBe(100);
    expect(scoreOpportunity(student, nonMatching)?.breakdown.scheduleFit).toBe(0);
  });

  it("a virtual opportunity gets full distance-fit credit and a distinct 'no travel required' reason, never 'Close to home'", () => {
    const student = makeStudent();
    const opp = makeOpportunity({ deliveryMode: "virtual", distanceMiles: null });
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.distanceFit).toBe(100);
    expect(result?.reasons).toContain("No travel required — participate virtually");
    expect(result?.reasons).not.toContain("Close to home");
  });

  it("does not regress existing in-person matching: identical scores for an unchanged in-person opportunity before and after this batch's changes", () => {
    const student = makeStudent({ maxDistanceMiles: 10 });
    const opp = makeOpportunity({ distanceMiles: 5 }); // no deliveryMode set, exactly like every pre-batch call site
    const result = scoreOpportunity(student, opp);
    expect(result?.breakdown.distanceFit).toBe(75); // 1 - (5/10)*0.5 = 0.75 — same formula as before this batch
  });
});

describe("explainInterestMatch — 'why this matches' copy accuracy", () => {
  it("returns level 'focus' with the focus's own label when both sides share a specific focus tag", () => {
    const result = explainInterestMatch(["robotics"], ["robotics"]);
    expect(result.level).toBe("focus");
    expect(result.labels).toEqual(["Robotics"]);
  });

  it("resolves a legacy alias to the same canonical focus and still reports level 'focus'", () => {
    // Student picked the pre-migration spelling; opportunity carries the
    // new canonical value — same real-world focus, not a lesser match.
    const result = explainInterestMatch(["computer_science"], ["cs_software_engineering"]);
    expect(result.level).toBe("focus");
    expect(result.labels).toEqual(["Computer Science & Software Engineering"]);
  });

  it("returns level 'broad' when the exact shared tag is only a broad-category tag", () => {
    const result = explainInterestMatch(["stem"], ["stem"]);
    expect(result.level).toBe("broad");
    expect(result.labels).toEqual(["STEM & Technology"]);
  });

  it("returns level 'rollup' — never 'focus' — when the only connection is a shared broad parent with no literal tag in common", () => {
    // Student wants cybersecurity; opportunity is tagged with a
    // different STEM focus. They share the "stem" broad parent only —
    // never claim these two specific focuses matched each other.
    const result = explainInterestMatch(["cybersecurity"], ["robotics"]);
    expect(result.level).toBe("rollup");
    expect(result.labels).toEqual(["STEM & Technology"]);
  });

  it("returns level 'rollup' when a specific focus rolls up to an opportunity tagged only with the broad category", () => {
    const result = explainInterestMatch(["robotics"], ["stem"]);
    expect(result.level).toBe("rollup");
    expect(result.labels).toEqual(["STEM & Technology"]);
  });

  it("returns level 'none' for a student with no interests selected (undecided) — never fabricates or penalizes", () => {
    const result = explainInterestMatch([], ["stem", "robotics"]);
    expect(result.level).toBe("none");
    expect(result.labels).toEqual([]);
  });

  it("returns level 'none' when there is genuinely no overlap at all", () => {
    const result = explainInterestMatch(["animals"], ["stem"]);
    expect(result.level).toBe("none");
    expect(result.labels).toEqual([]);
  });

  it("prefers a focus-level label over a broad-level one when a student matches on both", () => {
    const result = explainInterestMatch(["stem", "robotics"], ["stem", "robotics"]);
    expect(result.level).toBe("focus");
    expect(result.labels).toEqual(["Robotics"]);
  });

  it("is exposed on scoreOpportunity's result for real ranked matches, not just as a standalone helper", () => {
    const student = makeStudent({ interests: ["robotics"] });
    const opp = makeOpportunity({ interestsTags: ["robotics"] });
    const result = scoreOpportunity(student, opp);
    expect(result?.interestMatch.level).toBe("focus");
    expect(result?.interestMatch.labels).toEqual(["Robotics"]);
  });

  it("is exposed on scoreOpportunitySemantic's result too, independent of the embedding-based score", () => {
    const student = makeStudent({ interests: ["robotics"] });
    const opp = makeOpportunity({ interestsTags: ["robotics"], descriptionEmbedding: null });
    const result = scoreOpportunitySemantic(student, null, opp);
    expect(result?.interestMatch.level).toBe("focus");
  });
});
