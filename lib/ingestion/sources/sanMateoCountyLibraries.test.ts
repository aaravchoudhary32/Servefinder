import { describe, it, expect } from "vitest";
import {
  parseAgeFromTitle,
  extractBranchesFromHomepage,
  extractActivitiesFromBranchPage,
} from "./sanMateoCountyLibraries";

describe("parseAgeFromTitle", () => {
  it("parses a numeric range in the trailing parenthetical, using the lower bound", () => {
    expect(parseAgeFromTitle("Library Helper (14-15 years old)")).toBe(14);
    expect(parseAgeFromTitle("Friends of the library (14 and 15 years old)")).toBe(14);
    expect(parseAgeFromTitle("Maker Volunteer (14-15 year olds)")).toBe(14);
  });

  it("parses an open-ended 'and older' range", () => {
    expect(parseAgeFromTitle("Library Helper (16 and older)")).toBe(16);
  });

  it("returns null for a title with no parenthetical at all — never guesses", () => {
    expect(parseAgeFromTitle("Adult Literacy Tutor")).toBeNull();
    expect(parseAgeFromTitle("FOL Board - Adult")).toBeNull();
  });

  it("returns null for a parenthetical with no age-like language or number", () => {
    expect(parseAgeFromTitle("English Conversation Club (drop-in)")).toBeNull();
  });
});

describe("extractBranchesFromHomepage", () => {
  const GUID = "24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf";

  it("extracts real branches, skipping filter facets with the same markup shape", () => {
    const html = `
      <li class="">
        <a href="/PublicEnterprise/EnterpriseSearch?EnterpriseGuid=${GUID}&amp;SearchType=Organization&amp;SearchId=25080" class="searchLink">
          <div class="searchListItemContainer">
            <div class="subAccountLinkHolder">Atherton</div>
            <div class="countBubbleHolder">
              <span class="countBubble">6</span>
            </div>
          </div>
        </a>
      </li>
      <li class="">
        <a href="/PublicEnterprise/EnterpriseSearch?EnterpriseGuid=${GUID}&amp;SearchType=Organization&amp;SearchId=24788" class="searchLink">
          <div class="searchListItemContainer">
            <div class="subAccountLinkHolder">Countywide Programs</div>
            <div class="countBubbleHolder">
              <span class="countBubble">4</span>
            </div>
          </div>
        </a>
      </li>
      <li class="">
        <a href="/PublicEnterprise/EnterpriseSearch?EnterpriseGuid=${GUID}&amp;SearchType=Organization&amp;SearchId=3432" class="searchLink">
          <div class="searchListItemContainer">
            <div class="subAccountLinkHolder">Suitable for Groups</div>
            <div class="countBubbleHolder">
              <span class="countBubble">2</span>
            </div>
          </div>
        </a>
      </li>
    `;
    const branches = extractBranchesFromHomepage(html);
    expect(branches).toEqual([
      { searchId: "25080", name: "Atherton" },
      { searchId: "24788", name: "Countywide Programs" },
    ]);
  });
});

describe("extractActivitiesFromBranchPage", () => {
  it("extracts activityGuid + title pairs from real search-results markup", () => {
    const html = `
      <a href="/PublicEnterprise/EnterpriseActivity?enterpriseGuid=24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf&amp;activityGuid=a7b1b068-9666-43b5-8360-ab4c8cd781d1&amp;searchUrl=xyz">
        Library Helper (14-15 years old)
      </a>
      <a href="/PublicEnterprise/EnterpriseActivity?enterpriseGuid=24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf&amp;activityGuid=b155bc1c-d9b2-4cd7-95f4-41bd71c05b2e&amp;searchUrl=xyz">
        Library Helper (16 and older)
      </a>
      <a href="/PublicEnterprise/EnterpriseActivity?enterpriseGuid=24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf&amp;activityGuid=d3e19e8f-c51a-4955-993a-724f11ba4381&amp;searchUrl=xyz">
        Adult Literacy Tutor
      </a>
    `;
    const activities = extractActivitiesFromBranchPage(html, "Woodside");
    expect(activities).toHaveLength(3);
    expect(activities[0]).toEqual({
      activityGuid: "a7b1b068-9666-43b5-8360-ab4c8cd781d1",
      title: "Library Helper (14-15 years old)",
      branch: "Woodside",
    });
    expect(activities[2].title).toBe("Adult Literacy Tutor");
  });

  it("dedupes repeated activity guids", () => {
    const html = `
      <a href="/PublicEnterprise/EnterpriseActivity?enterpriseGuid=24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf&amp;activityGuid=abc123&amp;searchUrl=x">Role A</a>
      <a href="/PublicEnterprise/EnterpriseActivity?enterpriseGuid=24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf&amp;activityGuid=abc123&amp;searchUrl=x">Role A</a>
    `;
    expect(extractActivitiesFromBranchPage(html, "Belmont")).toHaveLength(1);
  });
});
