import { describe, it, expect } from "vitest";
import { parseAgeRangeFromTitle, extractListingsFromHomepage } from "./multnomahCountyLibrary";

describe("parseAgeRangeFromTitle", () => {
  it("parses a numeric range embedded in the title, using the lower bound", () => {
    expect(parseAgeRangeFromTitle("Albina Library: Follow the Reader (youth only, age 14-18)")).toBe(14);
    expect(parseAgeRangeFromTitle("Northwest Library: Teen Space Youth Program Assistant (12-18 years old)")).toBe(13);
    expect(parseAgeRangeFromTitle("Teen Council: East County Library (youth only,  age 12-18)")).toBe(13);
  });

  it("floors a lower bound below this app's platform floor of 13", () => {
    expect(parseAgeRangeFromTitle("Some role (age 10-16)")).toBe(13);
  });

  it("returns null for a range entirely below 13 — never floors a range that covers no 13-18 age", () => {
    expect(parseAgeRangeFromTitle("Tween Council: Northwest Library (youth only, age 9-12)")).toBeNull();
  });

  it("returns null for an adult-only 18+ listing with no lower tier", () => {
    expect(parseAgeRangeFromTitle("Central Library: Mandarin Bilingual Tech Help (age 18+)")).toBeNull();
  });

  it("returns null for a grade-only label with no parseable number — never guesses", () => {
    expect(parseAgeRangeFromTitle("Tween Council: Capitol Hill Library (youth only, grades 4-5)")).toBeNull();
    expect(parseAgeRangeFromTitle("Teen Council: Midland Library (youth only, grades 6-12)")).toBeNull();
  });
});

describe("extractListingsFromHomepage", () => {
  const ORG_GUID = "b104d7d3-a313-4052-9a9d-6c685c8857aa";

  it("extracts activity guid, title, and detail URL from real listing markup", () => {
    const html = `
      <ul class="fancy gviList">
        <li>
          <a href="/PublicOrganization/${ORG_GUID}/Gvi/a4cc9522-722b-48b9-88aa-d2beccf9ed1b/1" class="regularLink">Albina Library: Follow the Reader (youth only, age 14-18)</a>
        </li>
        <li>
          <a href="/PublicOrganization/${ORG_GUID}/Gvi/88c2ac69-aff6-4fab-8396-76a41375f0e4/1" class="regularLink">Central Library: Mandarin Bilingual Tech Help (age 18+)</a>
        </li>
      </ul>
    `;
    const listings = extractListingsFromHomepage(html);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toEqual({
      activityGuid: "a4cc9522-722b-48b9-88aa-d2beccf9ed1b",
      title: "Albina Library: Follow the Reader (youth only, age 14-18)",
      detailUrl: `https://app.betterimpact.com/PublicOrganization/${ORG_GUID}/Gvi/a4cc9522-722b-48b9-88aa-d2beccf9ed1b/1`,
    });
  });

  it("dedupes repeated activity guids and decodes HTML entities in titles", () => {
    const html = `
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/bb24ab45-c8b9-4df7-92b6-276869efb1cc/1" class="regularLink">Midland Library: Tutor de GED (18 a&#241;os)</a>
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/bb24ab45-c8b9-4df7-92b6-276869efb1cc/1" class="regularLink">Midland Library: Tutor de GED (18 a&#241;os)</a>
      <a href="/PublicOrganization/${ORG_GUID}/Gvi/137ba774-421f-4084-92c8-9c06446b5588/1" class="regularLink">Midland Library: Dungeon Master for Tween and Teen D&amp;D Clubs (age 18+)</a>
    `;
    const listings = extractListingsFromHomepage(html);
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe("Midland Library: Tutor de GED (18 años)");
    expect(listings[1].title).toBe("Midland Library: Dungeon Master for Tween and Teen D&D Clubs (age 18+)");
  });

  it("returns an empty array for a page with no matching listings", () => {
    expect(extractListingsFromHomepage("<html><body>No listings here</body></html>")).toEqual([]);
  });
});
