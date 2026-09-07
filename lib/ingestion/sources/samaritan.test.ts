import { describe, it, expect } from "vitest";
import { parseApiOpportunities, isTeenEligible, SAMARITAN_SOURCES } from "./samaritan";

describe("isTeenEligible — age-policy filter", () => {
  it("accepts a real integer age within 1-18", () => {
    expect(isTeenEligible(14, 18)).toBe(true);
    expect(isTeenEligible(1, 18)).toBe(true);
    expect(isTeenEligible(18, 18)).toBe(true);
  });

  it("rejects adult-only ages above the configured maxAge", () => {
    expect(isTeenEligible(19, 18)).toBe(false);
    expect(isTeenEligible(21, 18)).toBe(false);
  });

  it("rejects null, undefined, empty string, and non-numeric values — never infers or defaults", () => {
    expect(isTeenEligible(null, 18)).toBe(false);
    expect(isTeenEligible(undefined, 18)).toBe(false);
    expect(isTeenEligible("", 18)).toBe(false);
    expect(isTeenEligible("14", 18)).toBe(false); // string "14", not a number — Samaritan's own API returns this shape for unset ages
    expect(isTeenEligible(NaN, 18)).toBe(false);
  });

  it("rejects 0 — not a real minimum age, distinct from 'no requirement'", () => {
    expect(isTeenEligible(0, 18)).toBe(false);
  });

  it("respects a per-config custom maxAge override", () => {
    expect(isTeenEligible(16, 15)).toBe(false);
    expect(isTeenEligible(15, 15)).toBe(true);
  });
});

describe("parseApiOpportunities — fixture-based response parsing", () => {
  it("parses a real-shaped response (captured live from a Samaritan tenant this session)", () => {
    const fixture = {
      data: [
        { ID: 196313, OPP_TITLE: "Active Aging Week Kick-Off Event", OPP_LOC_CITY: "Rockville", OPP_LOC_STATE: "MD", OPP_MINIMUM_AGE: 14 },
        { ID: 196904, OPP_TITLE: "Adaptive Kayaking Support Paddler", OPP_LOC_CITY: "Poolesville", OPP_LOC_STATE: "MD", OPP_MINIMUM_AGE: 18 },
        // Samaritan's own API returns an empty string, not null, for an
        // opportunity with no minimum age set — confirmed live this
        // session (Montgomery Parks, "Environmental Projects / Park
        // Cleanups / Trails / Weed Warriors"). isTeenEligible must
        // reject this, not coerce it.
        { ID: 196817, OPP_TITLE: "Environmental Projects / Park Cleanups / Trails / Weed Warriors", OPP_LOC_STATE: "MD", OPP_MINIMUM_AGE: "" },
      ],
    };
    const parsed = parseApiOpportunities(fixture);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].OPP_TITLE).toBe("Active Aging Week Kick-Off Event");
    expect(isTeenEligible(parsed[0].OPP_MINIMUM_AGE, 18)).toBe(true);
    expect(isTeenEligible(parsed[1].OPP_MINIMUM_AGE, 18)).toBe(true);
    expect(isTeenEligible(parsed[2].OPP_MINIMUM_AGE, 18)).toBe(false);
  });

  it("throws rather than silently returning an empty list when the response shape changes — a real endpoint-drift signal shouldn't look like 'no opportunities'", () => {
    expect(() => parseApiOpportunities({ status: "failure", error: "functionName is empty" })).toThrow();
    expect(() => parseApiOpportunities(null)).toThrow();
    expect(() => parseApiOpportunities({ data: "not an array" })).toThrow();
  });

  it("parses an empty data array without throwing (a tenant with zero current listings is valid, not an error)", () => {
    expect(parseApiOpportunities({ data: [] })).toEqual([]);
  });
});

describe("SAMARITAN_SOURCES config", () => {
  it("has a distinct sourceSlug, subdomain+recruiterId pair per config entry — no collisions", () => {
    const slugs = SAMARITAN_SOURCES.map((s) => s.sourceSlug);
    const tenantKeys = SAMARITAN_SOURCES.map((s) => `${s.subdomain}:${s.recruiterId}`);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(tenantKeys).size).toBe(tenantKeys.length);
  });

  it("never configures City of Phoenix — it already has its own dedicated cityOfPhoenix.ts connector and must not be duplicated here", () => {
    const names = SAMARITAN_SOURCES.map((s) => s.orgName.toLowerCase());
    const slugs = SAMARITAN_SOURCES.map((s) => s.sourceSlug);
    expect(names.some((n) => n.includes("phoenix"))).toBe(false);
    expect(slugs).not.toContain("cityofphoenix");
  });

  it("Santa Clarita excludes opportunity 9968 — already staged as a manual_curated record (Bike Park Workdays)", () => {
    const santaClarita = SAMARITAN_SOURCES.find((s) => s.sourceSlug === "samaritan_santa_clarita");
    expect(santaClarita?.excludeOpportunityIds).toEqual(["9968"]);
  });

  it("Prince George's Parks, Metro Library OKC, and Montgomery Parks have no exclusion list — their manual_curated records used different opportunity IDs or a general-page synthesis, not one specific API id", () => {
    for (const slug of ["samaritan_prince_georges_parks", "samaritan_metro_library_okc", "samaritan_montgomery_parks"]) {
      const source = SAMARITAN_SOURCES.find((s) => s.sourceSlug === slug);
      expect(source?.excludeOpportunityIds).toBeUndefined();
    }
  });

  it("City of Aurora, CO excludes all 10 'Library-' prefixed listings — already covered by the approved Aurora Public Library manual_curated record — plus 2 found during independent review (an always-adult-registers family event, and a paid stipend internship mislabeled as volunteering)", () => {
    const aurora = SAMARITAN_SOURCES.find((s) => s.sourceSlug === "samaritan_city_of_aurora_co");
    expect(aurora?.excludeOpportunityIds).toEqual(
      ["8312", "11725", "11724", "14229", "11641", "14167", "12498", "13730", "12021", "11498", "12810", "14258"]
    );
  });

  it("Peoria Park District (IL) excludes a court-ordered-community-service listing and a college-course-restricted listing, found during independent review before any live run", () => {
    const peoria = SAMARITAN_SOURCES.find((s) => s.sourceSlug === "samaritan_peoria_park_district_il");
    expect(peoria?.excludeOpportunityIds).toEqual(["232268", "235553"]);
  });

  it("California Department of Fish and Wildlife excludes both 'Internship'-titled BBSC listings — one explicitly college-restricted, the other treated the same way out of caution", () => {
    const cdfw = SAMARITAN_SOURCES.find((s) => s.sourceSlug === "samaritan_california_fish_wildlife");
    expect(cdfw?.excludeOpportunityIds).toEqual(["191853", "191854"]);
  });

  it("Texas Parks and Wildlife excludes an age/skill-mismatched listing, a single Eagle Scout's own project, a college-student-restricted listing, and a groups-only listing", () => {
    const tpwd = SAMARITAN_SOURCES.find((s) => s.sourceSlug === "samaritan_texas_parks_wildlife");
    expect(tpwd?.excludeOpportunityIds).toEqual(["218190", "228015", "170450", "168951"]);
  });
});
