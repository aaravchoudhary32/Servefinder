import { describe, it, expect } from "vitest";
import {
  normalizeListing,
  inferCategory,
  extractMinimumAge,
  findDuplicate,
  classifyDuplicate,
  stringSimilarity,
  normalizeDateForCompare,
  type ExistingListing,
} from "./normalize";

describe("inferCategory", () => {
  it("infers a category from keyword matches", () => {
    expect(inferCategory("Join our beach cleanup and trail restoration crew")).toBe("Environment");
    expect(inferCategory("Tutor elementary students in reading")).toBe("Education");
    expect(inferCategory("Help walk dogs at the animal shelter")).toBe("Animals");
  });

  it("falls back to Community Service when nothing matches", () => {
    expect(inferCategory("Lorem ipsum dolor sit amet")).toBe("Community Service");
  });

  it("does not false-positive on substrings inside unrelated words", () => {
    // "cat" inside "education" must not trigger the Animals category
    expect(inferCategory("A general education outreach program")).toBe("Education");
  });

  it("still matches legitimate stemmed/suffixed keywords", () => {
    // "garden" inside "gardens", "recycl" inside "recycling"
    expect(inferCategory("Help maintain our community gardens")).toBe("Environment");
    expect(inferCategory("Sort donations at our recycling center")).toBe("Environment");
  });
});

describe("extractMinimumAge", () => {
  it("extracts ages from a variety of common phrasings", () => {
    expect(extractMinimumAge("Volunteers must be 16+ to participate")).toBe(16);
    expect(extractMinimumAge("Applicants must be at least 15 years old")).toBe(15);
    expect(extractMinimumAge("Minimum age of 18 required")).toBe(18);
    expect(extractMinimumAge("Ages 14 and up welcome")).toBe(14);
    expect(extractMinimumAge("You must be 21+")).toBe(21);
    expect(extractMinimumAge("Must be 13 years of age")).toBe(13);
  });

  it("extracts the lower bound of an explicit age range", () => {
    expect(extractMinimumAge("Designed for males and females aged 15 through 18")).toBe(15);
    expect(extractMinimumAge("This program is for ages 12-15")).toBe(12);
    expect(extractMinimumAge("Open to youth ages 14 to 17")).toBe(14);
  });

  it("falls back to the platform floor (13) when no age is mentioned", () => {
    expect(extractMinimumAge("Come help us out this weekend!")).toBe(13);
  });

  it("falls back to the platform floor when the matched number is implausible", () => {
    // "must be 200 years old" shouldn't be trusted as a real age requirement
    expect(extractMinimumAge("Volunteers must be 200 years old")).toBe(13);
  });
});

describe("normalizeListing", () => {
  it("maps a well-formed listing using canonical field names", () => {
    const result = normalizeListing(
      {
        title: "Beach Cleanup Crew",
        description: "Help clean the shoreline every Saturday morning, weekly. Volunteers must be 14+.",
        location: "Annapolis, MD",
        application_url: "https://example.org/apply",
        external_id: "abc-123",
      },
      { source: "idealist", sourceUrl: "https://example.org/listing" }
    );

    expect(result.title).toBe("Beach Cleanup Crew");
    expect(result.category).toBe("Environment");
    expect(result.minimum_age).toBe(14);
    expect(result.location).toBe("Annapolis, MD");
    expect(result.application_url).toBe("https://example.org/apply");
    expect(result.external_id).toBe("abc-123");
    expect(result.source).toBe("idealist");
    expect(result.source_url).toBe("https://example.org/listing");
    expect(result.schedule_slots).toContain("saturday_morning");
    expect(result.commitment_type).toBe("recurring");
  });

  it("resolves inconsistent field naming (camelCase, snake_case, arbitrary labels) to the same result", () => {
    const canonical = normalizeListing({
      title: "Food Bank Sorting",
      description: "One-time event, no recurring commitment.",
    });
    const alt = normalizeListing({
      Name: "Food Bank Sorting",
      Details: "One-time event, no recurring commitment.",
    });
    expect(alt.title).toBe(canonical.title);
    expect(alt.category).toBe(canonical.category);
    expect(alt.commitment_type).toBe(canonical.commitment_type);
  });

  it("falls back to sane defaults when fields are missing entirely", () => {
    const result = normalizeListing({});
    expect(result.title).toBe("Untitled opportunity");
    expect(result.description).toBeNull();
    expect(result.category).toBe("Community Service");
    expect(result.minimum_age).toBe(13);
    expect(result.location).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.schedule_slots).toEqual([]);
    expect(result.skills_required).toEqual([]);
    expect(result.application_url).toBeNull();
    expect(result.application_deadline).toBeNull();
    expect(result.external_id).toBeNull();
    expect(result.source).toBe("unknown");
  });

  it("normalizes inconsistent deadline formats to YYYY-MM-DD", () => {
    const result = normalizeListing({ title: "X", applyBy: "December 1, 2026" });
    expect(result.application_deadline).toBe("2026-12-01");
  });

  it("ignores an unparseable deadline rather than throwing", () => {
    const result = normalizeListing({ title: "X", deadline: "not a real date" });
    expect(result.application_deadline).toBeNull();
  });

  it("prefers an explicit category field when it matches a known category", () => {
    const result = normalizeListing({ title: "X", description: "no keywords here", category: "STEM" });
    expect(result.category).toBe("STEM");
  });

  it("falls back to keyword inference when the explicit category is unrecognized", () => {
    const result = normalizeListing({ title: "X", description: "walk shelter dogs", category: "Not A Real Category" });
    expect(result.category).toBe("Animals");
  });

  it("uses an explicit interests_tags array when provided instead of inferring", () => {
    const result = normalizeListing({ title: "X", description: "irrelevant text", interests_tags: ["custom_tag"] });
    expect(result.interests_tags).toEqual(["custom_tag"]);
  });

  it("uses the provided now() clock for last_verified_at", () => {
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const result = normalizeListing({ title: "X" }, { now: () => fixed });
    expect(result.last_verified_at).toBe(fixed.toISOString());
  });
});

describe("stringSimilarity", () => {
  it("is 1 for identical strings", () => {
    expect(stringSimilarity("beach cleanup", "beach cleanup")).toBe(1);
  });

  it("is 1 for two empty strings", () => {
    expect(stringSimilarity("", "")).toBe(1);
  });

  it("is 0 when one side is empty and the other is not", () => {
    expect(stringSimilarity("beach cleanup", "")).toBe(0);
  });

  it("is lower for more different strings", () => {
    const close = stringSimilarity("beach cleanup", "beach cleanup crew");
    const far = stringSimilarity("beach cleanup", "food bank sorting");
    expect(close).toBeGreaterThan(far);
  });
});

describe("findDuplicate", () => {
  const existing: ExistingListing[] = [
    { id: "1", source: "idealist", external_id: "ext-1", title: "Beach Cleanup Crew", organizationName: "Ocean Trust" },
    { id: "2", source: "manual", external_id: null, title: "Food Bank Sorting", organizationName: "Community Pantry" },
  ];

  it("matches on exact (source, external_id) even if the title differs", () => {
    const match = findDuplicate(
      { source: "idealist", external_id: "ext-1", title: "Completely Different Title" },
      existing
    );
    expect(match).toEqual({ existingId: "1", reason: "external_id", similarity: 1 });
  });

  it("does not match external_id across different sources", () => {
    const match = findDuplicate(
      { source: "org_website", external_id: "ext-1", title: "Beach Cleanup Crew" },
      existing
    );
    expect(match?.reason).not.toBe("external_id");
  });

  it("catches the same listing posted twice via fuzzy title + org match", () => {
    const match = findDuplicate(
      { source: "org_website", external_id: null, title: "Beach Cleanup Crew!", organizationName: "Ocean Trust" },
      existing
    );
    expect(match?.existingId).toBe("1");
    expect(match?.reason).toBe("fuzzy_match");
  });

  it("requires a much closer title match when no organization name is available to disambiguate", () => {
    const looseMatch = findDuplicate(
      { source: "org_website", external_id: null, title: "Beach Cleanup Crew Weekend" },
      existing
    );
    // Not close enough to satisfy the stricter no-org threshold
    expect(looseMatch).toBeNull();
  });

  it("does not match unrelated listings with different organizations even if titles are similar", () => {
    const match = findDuplicate(
      { source: "org_website", external_id: null, title: "Food Bank Sorting", organizationName: "Unrelated Nonprofit" },
      existing
    );
    expect(match).toBeNull();
  });

  it("returns null when there is no existing data at all", () => {
    expect(findDuplicate({ source: "manual", external_id: null, title: "Anything" }, [])).toBeNull();
  });
});

describe("normalizeDateForCompare", () => {
  it("passes an ISO date through unchanged", () => {
    expect(normalizeDateForCompare("2026-11-05")).toBe("2026-11-05");
  });

  it("normalizes a US slash date, padding single digits", () => {
    expect(normalizeDateForCompare("11/5/2026")).toBe("2026-11-05");
    expect(normalizeDateForCompare("1/3/2027")).toBe("2027-01-03");
  });

  it("normalizes the 'Mon D, YYYY' style specialOlympicsAZ.ts's title fix produces", () => {
    expect(normalizeDateForCompare("Nov 5, 2026")).toBe("2026-11-05");
    expect(normalizeDateForCompare("Jan 3, 2027")).toBe("2027-01-03");
  });

  it("returns null for missing or unparseable input, never a guess", () => {
    expect(normalizeDateForCompare(null)).toBeNull();
    expect(normalizeDateForCompare(undefined)).toBeNull();
    expect(normalizeDateForCompare("")).toBeNull();
    expect(normalizeDateForCompare("sometime next month")).toBeNull();
  });
});

// Accelerated-catalog-growth batch: the dedup fix that lets a real
// external ID / canonical application URL win outright, and treats a
// genuinely different date, location, or application URL as evidence
// two similarly-titled records are actually distinct — rather than
// letting title similarity alone decide. Each `it()` below is one of
// the 8 required regression scenarios, named to match.
describe("findDuplicate — material-difference dedup fix", () => {
  it("[1] same title, same event date -> matches (fuzzy, date confirms rather than contradicts)", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "special_olympics_az",
        external_id: "guid-a",
        title: "Bocce Competition (Yuma)",
        organizationName: "Special Olympics Arizona",
        applicationDeadline: "2026-11-05",
      },
    ];
    const match = findDuplicate(
      {
        source: "special_olympics_az",
        external_id: "guid-b",
        title: "Bocce Competition (Yuma)",
        organizationName: "Special Olympics Arizona",
        applicationDeadline: "2026-11-05",
      },
      existing
    );
    expect(match?.reason).toBe("fuzzy_match");
    expect(match?.existingId).toBe("1");
  });

  it("[2] same title, different event dates -> NOT a match, even though titles are identical", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "special_olympics_az",
        external_id: "guid-a",
        title: "Bocce Competition (Yuma)",
        organizationName: "Special Olympics Arizona",
        applicationDeadline: "2026-10-03",
      },
    ];
    const match = findDuplicate(
      {
        source: "special_olympics_az",
        external_id: "guid-b",
        title: "Bocce Competition (Yuma)",
        organizationName: "Special Olympics Arizona",
        applicationDeadline: "2026-11-05",
      },
      existing
    );
    expect(match).toBeNull();
  });

  it("[3] similar (not identical) titles, different dates -> NOT a match — this is the exact Special Olympics Arizona shape", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "special_olympics_az",
        external_id: "guid-a",
        title: "Bocce Competition (Yuma) — Oct 3, 2026",
        organizationName: "Special Olympics Arizona",
        applicationDeadline: "2026-10-03",
      },
    ];
    const match = findDuplicate(
      {
        source: "special_olympics_az",
        external_id: "guid-b",
        title: "Bocce Competition (Yuma) — Nov 5, 2026",
        organizationName: "Special Olympics Arizona",
        applicationDeadline: "2026-11-05",
      },
      existing
    );
    expect(match).toBeNull();
  });

  it("[4] same external ID, changed title -> still matches — the ID is authoritative, not the title", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "cityofphoenix", external_id: "ext-99", title: "Old Title", organizationName: "City of Phoenix" },
    ];
    const match = findDuplicate(
      {
        source: "cityofphoenix",
        external_id: "ext-99",
        title: "Completely Rewritten Title",
        organizationName: "City of Phoenix",
        applicationDeadline: "2027-01-01", // even a materially different date never overrides an external_id match
      },
      existing
    );
    expect(match).toEqual({ existingId: "1", reason: "external_id", similarity: 1 });
  });

  it("[5] different external IDs, similar titles, no other distinguishing info -> still matches via fuzzy title (preserves useful matching for sources without reliable dates)", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "org_website", external_id: "ext-1", title: "Weekend Trail Cleanup Crew", organizationName: "Riverside Conservancy" },
    ];
    const match = findDuplicate(
      { source: "org_website", external_id: "ext-2", title: "Weekend Trail Cleanup Crew!", organizationName: "Riverside Conservancy" },
      existing
    );
    expect(match?.reason).toBe("fuzzy_match");
    expect(match?.existingId).toBe("1");
  });

  it("[6] missing external IDs on both sides -> falls back to fuzzy title matching as before", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "manual", external_id: null, title: "Food Bank Sorting", organizationName: "Community Pantry" },
    ];
    const match = findDuplicate(
      { source: "manual", external_id: null, title: "Food Bank Sorting", organizationName: "Community Pantry" },
      existing
    );
    expect(match?.reason).toBe("fuzzy_match");
    const noMatch = findDuplicate(
      { source: "manual", external_id: null, title: "Something Entirely Unrelated", organizationName: "Community Pantry" },
      existing
    );
    expect(noMatch).toBeNull();
  });

  it("[7] cross-source copies of the same opportunity -> matched via identical canonical application URL, even with different source strings and no shared external_id scheme", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "manual_curated",
        external_id: "some-org-role",
        title: "Teen Volunteer Program",
        organizationName: "Some Museum",
        applicationUrl: "https://www.volgistics.com/appform/12345",
      },
    ];
    const match = findDuplicate(
      {
        source: "some_museum_scraper", // a totally different source string
        external_id: "scraper-internal-id-999", // a totally different ID scheme
        title: "Volunteer at Some Museum — Teens", // a differently-worded title
        applicationUrl: "https://www.volgistics.com/appform/12345/", // same URL, trailing slash
      },
      existing
    );
    expect(match).toEqual({ existingId: "1", reason: "application_url", similarity: 1 });
  });

  it("[7b] application URL match ignores tracking query params but not a genuinely different path", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "a", external_id: null, title: "X", organizationName: null, applicationUrl: "https://example.org/apply?utm_source=newsletter" },
    ];
    expect(
      findDuplicate({ source: "b", external_id: null, title: "Y", applicationUrl: "https://example.org/apply" }, existing)?.reason
    ).toBe("application_url");
    expect(
      findDuplicate({ source: "b", external_id: null, title: "Y", applicationUrl: "https://example.org/apply/step-2" }, existing)
    ).toBeNull();
  });

  it("[8] distinct recurring events at the same location -> never treated as duplicates of each other (3-way Bowling Competition (Tucson) case)", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "special_olympics_az", external_id: "guid-a", title: "Bowling Competition (Tucson) — Oct 29, 2026", organizationName: null, applicationDeadline: "2026-10-29" },
      { id: "2", source: "special_olympics_az", external_id: "guid-b", title: "Bowling Competition (Tucson) — Nov 2, 2026", organizationName: null, applicationDeadline: "2026-11-02" },
    ];
    const thirdSession = findDuplicate(
      { source: "special_olympics_az", external_id: "guid-c", title: "Bowling Competition (Tucson) — Nov 5, 2026", applicationDeadline: "2026-11-05" },
      existing
    );
    expect(thirdSession).toBeNull();
  });

  it("a genuinely different location vetoes a fuzzy title match the same way a different date does", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "org_website", external_id: null, title: "Community Cleanup Day", organizationName: "Green Alliance", location: "Phoenix, AZ" },
    ];
    const match = findDuplicate(
      { source: "org_website", external_id: null, title: "Community Cleanup Day", organizationName: "Green Alliance", location: "Tucson, AZ" },
      existing
    );
    expect(match).toBeNull();
  });

  it("a missing date/location/URL on either side is inconclusive, not treated as a difference (fuzzy title match still applies)", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "org_website", external_id: null, title: "Community Cleanup Day", organizationName: "Green Alliance", location: "Phoenix, AZ" },
    ];
    // Candidate has no location at all — should NOT veto the match.
    const match = findDuplicate(
      { source: "org_website", external_id: null, title: "Community Cleanup Day", organizationName: "Green Alliance" },
      existing
    );
    expect(match?.reason).toBe("fuzzy_match");
  });

  it("removing a date from a title does not, by itself, make two records identical — the underlying data must actually agree", () => {
    // Two genuinely different events whose titles just happen to
    // collapse to the same string once a naive date-strip is applied
    // would still be correctly kept apart here, because the *real*
    // dates (not a title substring) still disagree.
    const existing: ExistingListing[] = [
      { id: "1", source: "org_website", external_id: "a", title: "Spring Gala", organizationName: null, applicationDeadline: "2026-04-01", location: "Phoenix, AZ" },
    ];
    const match = findDuplicate(
      { source: "org_website", external_id: "b", title: "Spring Gala", applicationDeadline: "2027-04-01", location: "Tucson, AZ" },
      existing
    );
    expect(match).toBeNull();
  });
});

// Shared-application-portal dedup fix: Arizona Science Center and
// Firewheel STEM Institute each route many genuinely distinct volunteer
// roles through one organization-wide application_url (a Volgistics
// portal link / a single Google Form respectively). The old Tier-2
// exact-application_url match treated ANY shared URL as automatically
// conclusive, which would have silently rejected a legitimate new role
// at either organization on a future ingestion run. classifyDuplicate()
// requires title/eligibility corroboration once there's organization
// context or an established pattern of the same URL already serving
// several distinctly-titled rows; findDuplicate() (the pre-existing
// binary wrapper every connector calls) now returns null — not skip —
// for anything less than a fully conclusive match, so an uncertain
// candidate is inserted as pending for human review instead of vanishing.
describe("classifyDuplicate / findDuplicate — shared-application-portal fix", () => {
  it("same source and same external_id -> exact duplicate (Tier 1 unconditional)", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "arizona_science_center", external_id: "administrative-volunteer", title: "Administrative Volunteer", organizationName: "Arizona Science Center" },
    ];
    const result = classifyDuplicate(
      { source: "arizona_science_center", external_id: "administrative-volunteer", title: "Administrative Volunteer", organizationName: "Arizona Science Center" },
      existing
    );
    expect(result.verdict).toBe("exact_duplicate");
    expect(result.matchTier).toBe("external_id");
    expect(result.candidateId).toBe("1");
  });

  it("same organization, same title, same application URL -> exact duplicate", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "org_website",
        external_id: "role-a",
        title: "Guest Services Volunteer",
        organizationName: "Riverside Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=999",
      },
    ];
    const result = classifyDuplicate(
      {
        source: "org_website",
        external_id: null,
        title: "Guest Services Volunteer",
        organizationName: "Riverside Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=999",
      },
      existing
    );
    expect(result.verdict).toBe("exact_duplicate");
    expect(result.matchTier).toBe("application_url");
    expect(result.candidateId).toBe("1");
  });

  it("same organization, slightly normalized title variation, same substantive content -> exact duplicate", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "org_website",
        external_id: null,
        title: "Guest Services Volunteer",
        organizationName: "Riverside Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=999",
      },
    ];
    const result = classifyDuplicate(
      {
        source: "org_website",
        external_id: null,
        title: "Guest Services  Volunteer!!",
        organizationName: "Riverside Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=999",
      },
      existing
    );
    expect(result.verdict).toBe("exact_duplicate");
  });

  it("same organization and application URL but clearly different roles -> not an exact duplicate", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "org_website",
        external_id: "guest-services",
        title: "Guest Services Volunteer",
        organizationName: "Riverside Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=999",
      },
    ];
    const result = classifyDuplicate(
      {
        source: "org_website",
        external_id: "collections-care",
        title: "Collections Care Assistant",
        organizationName: "Riverside Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=999",
      },
      existing
    );
    expect(result.verdict).not.toBe("exact_duplicate");
    expect(["shared_portal_distinct_role", "probable_duplicate"]).toContain(result.verdict);
  });

  it("same organization and shared portal but different age requirements/responsibilities -> distinct roles", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "firewheel_stem",
        external_id: "video-studio-administrator",
        title: "Video Studio Administrator",
        organizationName: "Firewheel STEM Institute",
        applicationUrl: "https://docs.google.com/forms/d/e/example/viewform",
        minimumAge: 18,
      },
    ];
    const result = classifyDuplicate(
      {
        source: "firewheel_stem",
        external_id: "mobile-stem-center",
        title: "Mobile STEM Center",
        organizationName: "Firewheel STEM Institute",
        applicationUrl: "https://docs.google.com/forms/d/e/example/viewform",
        minimumAge: 16,
      },
      existing
    );
    expect(result.verdict).toBe("shared_portal_distinct_role");
    expect(result.evidence.some((e) => e.includes("minimum_age"))).toBe(true);
  });

  it("same role appearing from two sources -> cross-source probable or exact duplicate, never silently dropped as distinct", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "manual_curated",
        external_id: "some-org-role",
        title: "Teen Docent Program",
        organizationName: "City History Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=1234",
      },
    ];
    // Same real program, same org, same portal URL, worded slightly
    // differently by an independent scraper with its own ID scheme.
    const result = classifyDuplicate(
      {
        source: "city_history_museum_scraper",
        external_id: "scraper-id-42",
        title: "Teen Docent Program!",
        organizationName: "City History Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=1234",
      },
      existing
    );
    expect(["exact_duplicate", "probable_duplicate"]).toContain(result.verdict);
    expect(result.candidateId).toBe("1");
  });

  it("same organization and shared portal with a materially different title -> distinct role, not silently treated as a duplicate candidate", () => {
    // This is the general shape of the actual bug: a same-org, shared-
    // portal, dissimilarly-titled candidate is the COMMON case for a
    // legitimate new role at an org like Arizona Science Center or
    // Firewheel -- it must resolve to "distinct role" (verdict !=
    // exact/probable duplicate), not linger as an uncertain "probable"
    // that would need review on every single new role.
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "manual_curated",
        external_id: "some-org-role",
        title: "Teen Docent Program",
        organizationName: "City History Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=1234",
      },
    ];
    const result = classifyDuplicate(
      {
        source: "city_history_museum_scraper",
        external_id: "scraper-id-42",
        title: "Collections Storage Assistant",
        organizationName: "City History Museum",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=1234",
      },
      existing
    );
    expect(result.verdict).not.toBe("exact_duplicate");
    expect(result.verdict).not.toBe("probable_duplicate");
  });

  it("same-location events on different dates remain distinct (still true after the shared-portal fix)", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "special_olympics_az",
        external_id: "guid-a",
        title: "Bowling Competition (Tucson) — Oct 29, 2026",
        organizationName: "Special Olympics Arizona",
        location: "Tucson, AZ",
        applicationDeadline: "2026-10-29",
      },
    ];
    const result = classifyDuplicate(
      {
        source: "special_olympics_az",
        external_id: "guid-b",
        title: "Bowling Competition (Tucson) — Nov 5, 2026",
        organizationName: "Special Olympics Arizona",
        location: "Tucson, AZ",
        applicationDeadline: "2026-11-05",
      },
      existing
    );
    expect(result.verdict).toBe("no_duplicate");
  });

  it("repeated shifts or dates of one role do not inflate the catalog -- external_id still wins even when the shift date changes", () => {
    const existing: ExistingListing[] = [
      {
        id: "1",
        source: "org_website",
        external_id: "weekly-shelving-shift",
        title: "Saturday Shelving Shift",
        organizationName: "Public Library",
        applicationDeadline: "2026-09-05",
      },
    ];
    const result = classifyDuplicate(
      {
        source: "org_website",
        external_id: "weekly-shelving-shift",
        title: "Saturday Shelving Shift",
        organizationName: "Public Library",
        applicationDeadline: "2026-09-12", // next week's shift date
      },
      existing
    );
    expect(result.verdict).toBe("exact_duplicate");
    expect(result.matchTier).toBe("external_id");
    expect(result.candidateId).toBe("1");
  });

  it("existing Arizona Science Center records are no longer falsely flagged against each other", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "arizona_science_center", external_id: "activity-facilitation-volunteer", title: "Activity Facilitation Volunteer", organizationName: "Arizona Science Center", applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567", minimumAge: 15 },
      { id: "2", source: "arizona_science_center", external_id: "administrative-volunteer", title: "Administrative Volunteer", organizationName: "Arizona Science Center", applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567", minimumAge: 15 },
      { id: "3", source: "arizona_science_center", external_id: "amateur-radio-operator-volunteer", title: "Amateur Radio Operator Volunteer", organizationName: "Arizona Science Center", applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567", minimumAge: 15 },
      { id: "4", source: "arizona_science_center", external_id: "create-at-arizona-science-center-volunteer", title: "CREATE at Arizona Science Center® Volunteer", organizationName: "Arizona Science Center", applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567", minimumAge: 15 },
      { id: "5", source: "arizona_science_center", external_id: "girls-in-stem-mentor", title: "Girls in STEM Mentor", organizationName: "Arizona Science Center", applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567", minimumAge: 15 },
    ];
    // A genuinely new 6th role, sharing the same portal URL, being
    // ingested for the first time (its own external_id doesn't match
    // anything already in the catalog).
    const result = classifyDuplicate(
      {
        source: "arizona_science_center",
        external_id: "guest-sales-and-services-volunteer",
        title: "Guest Sales and Services Volunteer",
        organizationName: "Arizona Science Center",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567",
        minimumAge: 15,
      },
      existing
    );
    expect(result.verdict).toBe("shared_portal_distinct_role");
    expect(findDuplicate(
      {
        source: "arizona_science_center",
        external_id: "guest-sales-and-services-volunteer",
        title: "Guest Sales and Services Volunteer",
        organizationName: "Arizona Science Center",
        applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567",
        minimumAge: 15,
      },
      existing
    )).toBeNull(); // inserted as pending, never silently skipped
  });

  it("existing Firewheel STEM Institute records are no longer falsely flagged against each other", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "firewheel_stem", external_id: "binary-bots-first-tech-challenge-team", title: "Binary Bots (FIRST Tech Challenge) Team", organizationName: "Firewheel STEM Institute", applicationUrl: "https://docs.google.com/forms/d/e/example/viewform", minimumAge: 18 },
      { id: "2", source: "firewheel_stem", external_id: "first-lego-league-fll-december-tournament", title: "FIRST Lego League (FLL) December Tournament", organizationName: "Firewheel STEM Institute", applicationUrl: "https://docs.google.com/forms/d/e/example/viewform", minimumAge: 16 },
      { id: "3", source: "firewheel_stem", external_id: "human-resources-administrator", title: "Human Resources Administrator", organizationName: "Firewheel STEM Institute", applicationUrl: "https://docs.google.com/forms/d/e/example/viewform", minimumAge: 18 },
    ];
    for (const candidate of existing) {
      const others = existing.filter((e) => e.id !== candidate.id);
      const result = classifyDuplicate(
        {
          source: candidate.source,
          external_id: `${candidate.external_id}-resubmitted`, // a genuinely new id, not a re-run of the same row
          title: candidate.title,
          organizationName: candidate.organizationName,
          applicationUrl: candidate.applicationUrl,
          minimumAge: candidate.minimumAge,
        },
        others
      );
      expect(result.verdict).not.toBe("exact_duplicate");
    }
  });

  it("existing legitimate duplicate protections remain intact: external_id precedence, date veto, and cross-source URL matching all still hold", () => {
    const existing: ExistingListing[] = [
      { id: "1", source: "cityofphoenix", external_id: "ext-99", title: "Old Title", organizationName: "City of Phoenix" },
      { id: "2", source: "special_olympics_az", external_id: "guid-a", title: "Bocce Competition (Yuma)", organizationName: "Special Olympics Arizona", applicationDeadline: "2026-10-03" },
      { id: "3", source: "manual_curated", external_id: "role-x", title: "Teen Volunteer Program", organizationName: "Some Museum", applicationUrl: "https://www.volgistics.com/appform/55555" },
    ];
    // external_id still wins over a changed title
    expect(findDuplicate({ source: "cityofphoenix", external_id: "ext-99", title: "New Title" }, existing)?.reason).toBe("external_id");
    // a different date still vetoes an identical title
    expect(
      findDuplicate(
        { source: "special_olympics_az", external_id: "guid-b", title: "Bocce Competition (Yuma)", organizationName: "Special Olympics Arizona", applicationDeadline: "2026-11-05" },
        existing
      )
    ).toBeNull();
    // a cross-source URL match with no org context still stands
    expect(
      findDuplicate(
        { source: "some_museum_scraper", external_id: "scraper-999", title: "Totally Different Wording", applicationUrl: "https://www.volgistics.com/appform/55555/" },
        existing
      )?.reason
    ).toBe("application_url");
  });
});
