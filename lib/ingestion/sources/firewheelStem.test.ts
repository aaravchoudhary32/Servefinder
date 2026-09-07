import { describe, it, expect } from "vitest";
import { slugify, verifyRolesPresent, ROLES } from "./firewheelStem";

describe("slugify", () => {
  it("lowercases and hyphenates a plain title", () => {
    expect(slugify("Mobile STEM Center")).toBe("mobile-stem-center");
  });

  it("collapses multiple non-alphanumeric characters into one hyphen", () => {
    expect(slugify("National Underwater Robotics Challenge (NURC)")).toBe(
      "national-underwater-robotics-challenge-nurc"
    );
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  Jeep Hack Coordinator  ")).toBe("jeep-hack-coordinator");
  });

  it("produces a distinct slug for every real role (no collisions)", () => {
    const slugs = ROLES.map((r) => slugify(r.title));
    expect(new Set(slugs).size).toBe(ROLES.length);
  });
});

describe("ROLES age requirements", () => {
  it("does not flatten age into one value across the source", () => {
    const ages = new Set(ROLES.map((r) => r.minimumAge));
    expect(ages.size).toBeGreaterThan(1);
  });

  it("every Event Volunteer role is 16+, matching the page's stated floor", () => {
    const eventVolunteerRoles = ROLES.filter((r) => r.section === "Event Volunteer");
    expect(eventVolunteerRoles.length).toBeGreaterThan(0);
    for (const role of eventVolunteerRoles) expect(role.minimumAge).toBe(16);
  });

  it("every Program Mentor and Staff Support role is 18+, matching the page's stated floor", () => {
    const olderRoles = ROLES.filter((r) => r.section === "Program Mentor" || r.section === "Staff Support");
    expect(olderRoles.length).toBeGreaterThan(0);
    for (const role of olderRoles) expect(role.minimumAge).toBe(18);
  });
});

// A trimmed-down fixture matching the real page's actual markup shape
// (section anchor divs + <ul><li> bullets under Wix's rich-text
// wrapper), not the full page — just enough to exercise the parser's
// actual assumptions.
function fixtureHtml(roleTexts: string[]): string {
  return `
    <div id="comp-x"><div id="eventvolunteer"></div><span>Event Volunteer</span></div>
    <div id="comp-y"><div id="programmentor"></div><span>Program Mentor</span></div>
    <div id="comp-z"><div id="staffsupport"></div><span>Staff Support</span></div>
    <ul><li><p>${roleTexts.join("</p></li><li><p>")}</p></li></ul>
  `;
}

describe("verifyRolesPresent", () => {
  it("passes when every real role's distinctive text and all 3 section anchors are present", () => {
    const html = fixtureHtml(ROLES.map((r) => r.verifyText));
    expect(() => verifyRolesPresent(html)).not.toThrow();
  });

  it("throws when a section anchor is missing (e.g. the page was restructured)", () => {
    const html = fixtureHtml(ROLES.map((r) => r.verifyText)).replace('id="programmentor"', "");
    expect(() => verifyRolesPresent(html)).toThrow(/programmentor/);
  });

  it("throws when a real role has been removed from the page (drift detection)", () => {
    const rolesMinusOne = ROLES.filter((r) => r.title !== "Jeep Hack Coordinator");
    const html = fixtureHtml(rolesMinusOne.map((r) => r.verifyText));
    expect(() => verifyRolesPresent(html)).toThrow(/Jeep Hack Coordinator/);
  });
});
