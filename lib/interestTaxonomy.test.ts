import { describe, it, expect } from "vitest";
import {
  TAXONOMY,
  FOCUS_ALIASES,
  RETIRED_FOCUS_VALUES,
  resolveCanonicalFocus,
  isKnownFocus,
  broadParentOf,
  ALL_VALID_INTEREST_VALUES,
  labelForTag,
  isFocusValue,
  splitInterestTags,
} from "./interestTaxonomy";

const ALL_CANONICAL_FOCUS_VALUES = TAXONOMY.flatMap((c) => c.focuses.map((f) => f.value));
const ALL_BROAD_TAGS = TAXONOMY.map((c) => c.broadTag);

// Every old STEM/Business value from before the canonical-taxonomy
// migration must still resolve to *something* real — either it's still
// a canonical focus itself, or it's a documented alias/retired value.
// Nothing from the pre-migration taxonomy may silently disappear.
const PRE_MIGRATION_STEM_VALUES = [
  "computer_science",
  "software_engineering",
  "artificial_intelligence",
  "data_science",
  "cybersecurity",
  "computer_engineering",
  "electrical_engineering",
  "mechanical_engineering",
  "civil_engineering",
  "aerospace_engineering",
  "robotics",
  "semiconductor_engineering",
  "quantum_computing",
  "general_engineering",
  "stem_leadership",
];
const PRE_MIGRATION_BUSINESS_VALUES = ["entrepreneurship", "finance", "marketing", "social_innovation"];

describe("interestTaxonomy — structure", () => {
  it("defines exactly 10 broad categories with unique tags", () => {
    expect(TAXONOMY).toHaveLength(10);
    expect(new Set(ALL_BROAD_TAGS).size).toBe(10);
  });

  it("every category has at least one focus and every focus has a distinct, non-empty label within its category", () => {
    for (const category of TAXONOMY) {
      expect(category.focuses.length).toBeGreaterThan(0);
      const labels = category.focuses.map((f) => f.label);
      expect(labels.every((l) => l.trim().length > 0)).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("every canonical focus value across all categories is globally unique", () => {
    expect(new Set(ALL_CANONICAL_FOCUS_VALUES).size).toBe(ALL_CANONICAL_FOCUS_VALUES.length);
  });

  it("no canonical focus value collides with a broad category tag", () => {
    for (const focus of ALL_CANONICAL_FOCUS_VALUES) {
      expect(ALL_BROAD_TAGS).not.toContain(focus);
    }
  });

  it("includes the new Government, Law & Advocacy category", () => {
    const gov = TAXONOMY.find((c) => c.broadTag === "government_law");
    expect(gov).toBeDefined();
    expect(gov!.focuses.length).toBeGreaterThan(0);
  });

  it("excludes Faith-Based Service as a selectable Community Service focus", () => {
    const community = TAXONOMY.find((c) => c.broadTag === "community");
    expect(community!.focuses.map((f) => f.label.toLowerCase())).not.toContain("faith-based service");
  });

  it("excludes STEM Leadership as a selectable STEM focus (retired, not a canonical focus)", () => {
    const stem = TAXONOMY.find((c) => c.broadTag === "stem");
    expect(stem!.focuses.map((f) => f.value)).not.toContain("stem_leadership");
  });
});

describe("interestTaxonomy — backward compatibility (no pre-migration value silently lost)", () => {
  it("every pre-migration STEM value resolves to a real canonical focus, alias target, or retired mapping", () => {
    for (const value of PRE_MIGRATION_STEM_VALUES) {
      const isCanonical = ALL_CANONICAL_FOCUS_VALUES.includes(value);
      const isAlias = value in FOCUS_ALIASES;
      const isRetired = value in RETIRED_FOCUS_VALUES;
      expect(isCanonical || isAlias || isRetired, `"${value}" was dropped without a mapping`).toBe(true);
    }
  });

  it("every pre-migration Business value is still a canonical focus (none were merged)", () => {
    for (const value of PRE_MIGRATION_BUSINESS_VALUES) {
      expect(ALL_CANONICAL_FOCUS_VALUES).toContain(value);
    }
  });

  it("every FOCUS_ALIASES target actually exists as a canonical focus", () => {
    for (const canonical of Object.values(FOCUS_ALIASES)) {
      expect(ALL_CANONICAL_FOCUS_VALUES).toContain(canonical);
    }
  });

  it("every RETIRED_FOCUS_VALUES target is a real broad category tag", () => {
    for (const parent of Object.values(RETIRED_FOCUS_VALUES)) {
      expect(ALL_BROAD_TAGS).toContain(parent);
    }
  });

  it("quantum_computing aliases to Computer Science & Software Engineering, not Physics & Astronomy (evidence-based exception)", () => {
    expect(FOCUS_ALIASES["quantum_computing"]).toBe("cs_software_engineering");
  });

  it("stem_leadership is retired to the broad 'stem' parent, not deleted", () => {
    expect(RETIRED_FOCUS_VALUES["stem_leadership"]).toBe("stem");
  });
});

describe("resolveCanonicalFocus", () => {
  it("resolves a legacy alias to its canonical replacement", () => {
    expect(resolveCanonicalFocus("computer_science")).toBe("cs_software_engineering");
    expect(resolveCanonicalFocus("software_engineering")).toBe("cs_software_engineering");
    expect(resolveCanonicalFocus("data_science")).toBe("data_science_ai");
    expect(resolveCanonicalFocus("artificial_intelligence")).toBe("data_science_ai");
  });

  it("resolves an already-canonical value to itself", () => {
    expect(resolveCanonicalFocus("robotics")).toBe("robotics");
    expect(resolveCanonicalFocus("finance")).toBe("finance");
  });

  it("passes an unrecognized value through unchanged", () => {
    expect(resolveCanonicalFocus("not_a_real_tag")).toBe("not_a_real_tag");
  });

  it("passes a retired value through unchanged (retirement is not the same as aliasing)", () => {
    expect(resolveCanonicalFocus("stem_leadership")).toBe("stem_leadership");
  });
});

describe("broadParentOf / isKnownFocus", () => {
  it("maps every canonical focus to its declared category's broad tag", () => {
    for (const category of TAXONOMY) {
      for (const focus of category.focuses) {
        expect(broadParentOf(focus.value)).toBe(category.broadTag);
      }
    }
  });

  it("maps a legacy alias to the same broad parent as its canonical replacement", () => {
    expect(broadParentOf("computer_science")).toBe("stem");
    expect(broadParentOf("cs_software_engineering")).toBe("stem");
  });

  it("maps a retired value to its broad parent", () => {
    expect(broadParentOf("stem_leadership")).toBe("stem");
  });

  it("isKnownFocus is true for canonical, alias, and retired values, false for broad tags and unknowns", () => {
    expect(isKnownFocus("robotics")).toBe(true);
    expect(isKnownFocus("computer_science")).toBe(true);
    expect(isKnownFocus("stem_leadership")).toBe(true);
    expect(isKnownFocus("stem")).toBe(false);
    expect(isKnownFocus("not_a_real_tag")).toBe(false);
  });
});

describe("ALL_VALID_INTEREST_VALUES", () => {
  it("includes every broad tag, canonical focus, alias, and retired value with no duplicates", () => {
    expect(new Set(ALL_VALID_INTEREST_VALUES).size).toBe(ALL_VALID_INTEREST_VALUES.length);
    for (const tag of ALL_BROAD_TAGS) expect(ALL_VALID_INTEREST_VALUES).toContain(tag);
    for (const focus of ALL_CANONICAL_FOCUS_VALUES) expect(ALL_VALID_INTEREST_VALUES).toContain(focus);
    for (const alias of Object.keys(FOCUS_ALIASES)) expect(ALL_VALID_INTEREST_VALUES).toContain(alias);
    for (const retired of Object.keys(RETIRED_FOCUS_VALUES)) expect(ALL_VALID_INTEREST_VALUES).toContain(retired);
  });

  it("every pre-migration STEM/Business value is included (a legacy profile's stored interests never fail a fresh CHECK constraint)", () => {
    for (const value of [...PRE_MIGRATION_STEM_VALUES, ...PRE_MIGRATION_BUSINESS_VALUES]) {
      expect(ALL_VALID_INTEREST_VALUES).toContain(value);
    }
  });
});

describe("labelForTag", () => {
  it("returns the broad label for a broad tag", () => {
    expect(labelForTag("stem")).toBe("STEM & Technology");
    expect(labelForTag("government_law")).toBe("Government, Law & Advocacy");
  });

  it("returns the focus label for a canonical focus value", () => {
    expect(labelForTag("robotics")).toBe("Robotics");
    expect(labelForTag("cs_software_engineering")).toBe("Computer Science & Software Engineering");
  });

  it("resolves a legacy alias to its canonical focus's label", () => {
    expect(labelForTag("computer_science")).toBe("Computer Science & Software Engineering");
    expect(labelForTag("quantum_computing")).toBe("Computer Science & Software Engineering");
  });

  it("returns undefined for an unrecognized tag (a retired value has no focus label — it rolls up to its broad parent only)", () => {
    expect(labelForTag("not_a_real_tag")).toBeUndefined();
    expect(labelForTag("stem_leadership")).toBeUndefined();
  });
});

describe("isFocusValue", () => {
  it("is true for a canonical focus and for a legacy alias that resolves to one", () => {
    expect(isFocusValue("robotics")).toBe(true);
    expect(isFocusValue("computer_science")).toBe(true);
  });

  it("is false for a broad tag, a retired value, or an unrecognized tag", () => {
    expect(isFocusValue("stem")).toBe(false);
    expect(isFocusValue("stem_leadership")).toBe(false);
    expect(isFocusValue("not_a_real_tag")).toBe(false);
  });
});

describe("splitInterestTags", () => {
  it("separates broad tags, canonical focuses, and unrecognized/retired values", () => {
    const result = splitInterestTags(["stem", "robotics", "stem_leadership"]);
    expect(result.broad).toEqual(["stem"]);
    expect(result.focus).toEqual(["robotics"]);
    expect(result.other).toEqual(["stem_leadership"]);
  });

  it("normalizes a legacy alias to its canonical focus value (upgrades spelling, preserves meaning)", () => {
    const result = splitInterestTags(["computer_science"]);
    expect(result.focus).toEqual(["cs_software_engineering"]);
    expect(result.other).toEqual([]);
  });

  it("dedupes when a legacy alias and its canonical replacement are both present", () => {
    const result = splitInterestTags(["computer_science", "cs_software_engineering"]);
    expect(result.focus).toEqual(["cs_software_engineering"]);
  });

  it("returns empty arrays for an empty or undefined-like input", () => {
    expect(splitInterestTags([])).toEqual({ broad: [], focus: [], other: [] });
  });

  it("preserves a genuinely unrecognized tag verbatim in `other` rather than dropping it", () => {
    const result = splitInterestTags(["totally_made_up_value"]);
    expect(result.other).toEqual(["totally_made_up_value"]);
  });
});
