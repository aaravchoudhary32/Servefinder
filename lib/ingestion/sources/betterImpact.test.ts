import { describe, it, expect } from "vitest";
import { parseMinimumAgeFromSuitabilityLabel, BETTER_IMPACT_SOURCES } from "./betterImpact";

describe("parseMinimumAgeFromSuitabilityLabel", () => {
  it("parses a numeric range, using the lower bound", () => {
    expect(parseMinimumAgeFromSuitabilityLabel("Suitable for youth 12-15")).toBe(12);
    expect(parseMinimumAgeFromSuitabilityLabel("Youth 14-16")).toBe(14);
  });

  it("parses an 'and over'/'+' style label", () => {
    expect(parseMinimumAgeFromSuitabilityLabel("Suitable for youth 16 and over")).toBe(16);
    expect(parseMinimumAgeFromSuitabilityLabel("Youth 16 and Over")).toBe(16);
    expect(parseMinimumAgeFromSuitabilityLabel("Youth 18+")).toBe(18);
  });

  it("returns null for a label with no parseable number — never guesses", () => {
    expect(parseMinimumAgeFromSuitabilityLabel("Youth with Supervision")).toBeNull();
    expect(parseMinimumAgeFromSuitabilityLabel("Suitable for families")).toBeNull();
    expect(parseMinimumAgeFromSuitabilityLabel("Suitable for adults")).toBeNull();
  });
});

describe("BETTER_IMPACT_SOURCES config", () => {
  it("has a distinct sourceSlug and enterpriseGuid per config entry — no collisions", () => {
    const slugs = BETTER_IMPACT_SOURCES.map((s) => s.sourceSlug);
    const guids = BETTER_IMPACT_SOURCES.map((s) => s.enterpriseGuid);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(guids).size).toBe(guids.length);
  });

  it("San José's excludeActivityGuids covers all 6 King Library Youth Services activities already staged as manual records or previously reviewed", () => {
    const sanJose = BETTER_IMPACT_SOURCES.find((s) => s.sourceSlug === "better_impact_san_jose");
    expect(sanJose?.excludeActivityGuids).toHaveLength(6);
    // Exact guids confirmed live to be shared between this enterprise's
    // King Library - Youth Services department and the standalone
    // manual records in lib/manualRecords.ts — a same-source-external_id
    // dedup can't catch this cross-source collision on its own, only
    // this explicit exclusion list can.
    expect(sanJose?.excludeActivityGuids).toEqual(
      expect.arrayContaining([
        "434ba341-033f-4592-81da-a71544b61f1b", // Teen Book Reviewer
        "5f76d72e-9e8f-4326-b2c7-d93d93ff9e91", // San José YAC
        "1f239d86-26fc-4004-a6e5-aded08233a89", // Teen Authors Corner
        "4c1b1465-1bcd-4faf-8705-c118551e349d", // Teen Library Volunteer
        "46e9cd7b-a3fd-4df3-95b0-31d537fd644d", // Teens Reach
        "b723c272-ddd9-4522-a9a3-f4514a9bfca8", // ChAD 60 Homework Coach
      ])
    );
  });

  it("Mesa/Gilbert/Sacramento/Boise/Roseville/Corvallis have no exclusion list — only San José needs one", () => {
    for (const slug of ["better_impact_mesa", "better_impact_gilbert", "better_impact_sacramento", "better_impact_boise", "better_impact_roseville", "better_impact_corvallis"]) {
      const source = BETTER_IMPACT_SOURCES.find((s) => s.sourceSlug === slug);
      expect(source?.excludeActivityGuids).toBeUndefined();
    }
  });

  it("Corvallis's config matches the enterprise GUID confirmed live to have exactly one youth SuitabilityClassification facet (\"Suitable for youth 16 and over\")", () => {
    const corvallis = BETTER_IMPACT_SOURCES.find((s) => s.sourceSlug === "better_impact_corvallis");
    expect(corvallis?.enterpriseGuid).toBe("2045eae9-4b9e-48e7-a032-b7eaacdde0a7");
    expect(corvallis?.cityLabel).toBe("Corvallis");
  });

  it("Boise's config matches the enterprise GUID confirmed live to have exactly one youth SuitabilityClassification facet (\"Suitable for youth 16 and over\")", () => {
    const boise = BETTER_IMPACT_SOURCES.find((s) => s.sourceSlug === "better_impact_boise");
    expect(boise?.enterpriseGuid).toBe("2a2fdaa1-32e5-4ef4-8eef-3cae02a41ce7");
    expect(boise?.cityLabel).toBe("Boise");
  });

  it("Roseville's config matches the enterprise GUID confirmed live to have two youth SuitabilityClassification facets (12-15, 16+)", () => {
    const roseville = BETTER_IMPACT_SOURCES.find((s) => s.sourceSlug === "better_impact_roseville");
    expect(roseville?.enterpriseGuid).toBe("da97cc19-7bca-416f-b82a-ac6417dbc5e7");
    expect(roseville?.cityLabel).toBe("Roseville");
  });
});
