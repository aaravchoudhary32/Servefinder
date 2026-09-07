import { describe, it, expect } from "vitest";
import { extractListingsFromHomepage, SITE_WIDE_POLICY_SOURCES } from "./humaneSocietySiteWidePolicy";

describe("extractListingsFromHomepage", () => {
  const GUID = "ffb0511b-f49a-489b-98e4-45a2319c25fc";

  it("extracts listings from the 'title=Continue to X' markup shape (Belleville)", () => {
    const html = `
      <a href="/PublicOrganization/${GUID}/Gvi/7e08558e-fe54-446b-adbf-75dff12a6f38/1" title="Continue to Adoption Events">Continue...</a>
      <a href="/PublicOrganization/${GUID}/Gvi/aaaaaaaa-fe54-446b-adbf-75dff12a6f38/1" title="Continue to Dog Walker">Continue...</a>
    `;
    const listings = extractListingsFromHomepage(html, GUID);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toEqual({
      activityGuid: "7e08558e-fe54-446b-adbf-75dff12a6f38",
      title: "Adoption Events",
      detailUrl: `https://app.betterimpact.com/PublicOrganization/${GUID}/Gvi/7e08558e-fe54-446b-adbf-75dff12a6f38/1`,
    });
    expect(listings[1].title).toBe("Dog Walker");
  });

  it("extracts listings from the 'class=regularLink' markup shape (Kansas)", () => {
    const html = `
      <a href="/PublicOrganization/${GUID}/Gvi/eaff1801-57e5-44e4-8a0d-2930f18c4e82/1" class="regularLink">Animal Interactions</a>
      <a href="/PublicOrganization/${GUID}/Gvi/52cc664b-6887-478f-8cc6-00c400a9272e/1" class="regularLink">Housekeeping</a>
    `;
    const listings = extractListingsFromHomepage(html, GUID);
    expect(listings).toHaveLength(2);
    expect(listings.map((l) => l.title)).toEqual(["Animal Interactions", "Housekeeping"]);
  });

  it("merges both shapes and dedupes by activityGuid when a page mixes them", () => {
    const html = `
      <a href="/PublicOrganization/${GUID}/Gvi/abc111/1" class="regularLink">Role A</a>
      <a href="/PublicOrganization/${GUID}/Gvi/abc222/1" title="Continue to Role B">Continue...</a>
      <a href="/PublicOrganization/${GUID}/Gvi/abc111/1" class="regularLink">Role A</a>
    `;
    const listings = extractListingsFromHomepage(html, GUID);
    expect(listings).toHaveLength(2);
  });

  it("returns an empty array for a different org's guid — never cross-matches", () => {
    const html = `<a href="/PublicOrganization/some-other-guid/Gvi/abc111/1" class="regularLink">Role A</a>`;
    expect(extractListingsFromHomepage(html, GUID)).toEqual([]);
  });
});

describe("SITE_WIDE_POLICY_SOURCES config", () => {
  it("floors both orgs' minimumAge at this app's platform floor of 13, regardless of the org's own published lower number", () => {
    for (const source of SITE_WIDE_POLICY_SOURCES) {
      expect(source.minimumAge).toBeGreaterThanOrEqual(13);
    }
  });

  it("has a distinct sourceSlug and orgGuid per config entry — no collisions", () => {
    const slugs = SITE_WIDE_POLICY_SOURCES.map((s) => s.sourceSlug);
    const guids = SITE_WIDE_POLICY_SOURCES.map((s) => s.orgGuid);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(guids).size).toBe(guids.length);
  });
});
