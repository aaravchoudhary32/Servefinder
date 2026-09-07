import { describe, it, expect } from "vitest";
import {
  parseAgeFromTitle,
  extractListingsFromHomepage,
  WISCONSIN_HUMANE_SOCIETY_SOURCES,
} from "./wisconsinHumaneSocietyGreenBay";

describe("parseAgeFromTitle", () => {
  it("parses the combined two-tier phrasing, using the lowest number found", () => {
    expect(parseAgeFromTitle("Animal Care Volunteer Dog (13-15-year-olds with an adult, 16+ years solo)")).toBe(13);
    expect(parseAgeFromTitle("Shelter Crew: Laundry and Cleaning (13-15-year-olds with an adult, 16+years solo)")).toBe(13);
  });

  it("parses a single-tier '16+ years' phrasing", () => {
    expect(parseAgeFromTitle("Adoption Greeter (16+ years)")).toBe(16);
    expect(parseAgeFromTitle("Volunteer Adoption Counselor (16+ years)")).toBe(16);
  });

  it("returns null for a bare 18-or-higher floor with no lower tier — adult-only", () => {
    expect(parseAgeFromTitle("PetSmart Animal Transport Volunteer (18+ years)")).toBeNull();
    expect(parseAgeFromTitle("Animal Transport Volunteer (18+ years)")).toBeNull();
    expect(parseAgeFromTitle("Foster (18 years)")).toBeNull();
  });

  it("returns null for a title with no parenthetical at all", () => {
    expect(parseAgeFromTitle("General Volunteer")).toBeNull();
  });

  it("returns null for a parenthetical with no age-like language", () => {
    expect(parseAgeFromTitle("Some Role (drop-in)")).toBeNull();
  });
});

describe("extractListingsFromHomepage", () => {
  const ORG_GUID = "ef99b4e4-595b-4d31-b202-ea252a122159";

  it("extracts activity guid, title, and detail URL, decoding &#160; as a space", () => {
    const html = `
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/367449cd-1a25-4d9c-9e83-3a2824451d3c/1" class="regularLink">Animal Care Volunteer Dog (13-15-year-olds with an adult, 16+ years solo)</a>
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/e38fcc5a-34fc-40e3-82d8-d7050dd0a9fa/1" class="regularLink">Animal Care Volunteer Cat &#160;(13-15-year-olds with an adult, 16+ years solo)</a>
    `;
    const listings = extractListingsFromHomepage(html, ORG_GUID);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toEqual({
      activityGuid: "367449cd-1a25-4d9c-9e83-3a2824451d3c",
      title: "Animal Care Volunteer Dog (13-15-year-olds with an adult, 16+ years solo)",
      detailUrl: `https://app.betterimpact.com/PublicOrganization/${ORG_GUID}/Gvi/367449cd-1a25-4d9c-9e83-3a2824451d3c/1`,
    });
    expect(listings[1].title).toBe("Animal Care Volunteer Cat (13-15-year-olds with an adult, 16+ years solo)");
  });

  it("dedupes repeated activity guids", () => {
    const html = `
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/abc123/1" class="regularLink">Role A (16+ years)</a>
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/abc123/1" class="regularLink">Role A (16+ years)</a>
    `;
    expect(extractListingsFromHomepage(html, ORG_GUID)).toHaveLength(1);
  });

  it("extracts listings from Milwaukee's 'title=Continue to X' markup shape", () => {
    const MKE_GUID = "18b8ebe6-8399-4686-8474-3159b09762d3";
    const html = `
      <a href="/PublicOrganization/${MKE_GUID}/Gvi/0d61d098-d61a-4a55-81ea-e8870b18a523/1" title="Continue to Animal Care Volunteer Dog (13-15-year-olds with an adult, 16+ years solo)">Continue...</a>
      <a href="/PublicOrganization/${MKE_GUID}/Gvi/1111aaaa-d61a-4a55-81ea-e8870b18a523/1" title="Continue to Adoption Greeter (16+ years)">Continue...</a>
    `;
    const listings = extractListingsFromHomepage(html, MKE_GUID);
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe("Animal Care Volunteer Dog (13-15-year-olds with an adult, 16+ years solo)");
    expect(listings[1].title).toBe("Adoption Greeter (16+ years)");
  });

  it("never cross-matches a different tenant's guid", () => {
    const html = `<a href="/PublicOrganization/some-other-guid/Gvi/abc123/1" class="regularLink">Role A</a>`;
    expect(extractListingsFromHomepage(html, ORG_GUID)).toEqual([]);
  });
});

describe("WISCONSIN_HUMANE_SOCIETY_SOURCES config", () => {
  it("has a distinct sourceSlug and orgGuid per config entry — no collisions", () => {
    const slugs = WISCONSIN_HUMANE_SOCIETY_SOURCES.map((s) => s.sourceSlug);
    const guids = WISCONSIN_HUMANE_SOCIETY_SOURCES.map((s) => s.orgGuid);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(guids).size).toBe(guids.length);
  });

  it("keeps Green Bay's existing source slug stable — must never change once records are shipped under it", () => {
    expect(WISCONSIN_HUMANE_SOCIETY_SOURCES[0].sourceSlug).toBe("wisconsin_humane_society_green_bay");
    expect(WISCONSIN_HUMANE_SOCIETY_SOURCES[0].orgGuid).toBe("ef99b4e4-595b-4d31-b202-ea252a122159");
  });
});
