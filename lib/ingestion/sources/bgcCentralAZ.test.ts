import { describe, it, expect } from "vitest";
import { slugify, verifyCategoriesPresent, CATEGORIES } from "./bgcCentralAZ";

describe("slugify", () => {
  it("lowercases and hyphenates a plain title", () => {
    expect(slugify("Sports & Recreation")).toBe("sports-recreation");
  });

  it("collapses multiple non-alphanumeric characters into one hyphen", () => {
    expect(slugify("Character and Leadership")).toBe("character-and-leadership");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  STEM  ")).toBe("stem");
  });

  it("produces a distinct slug for every real category (no collisions)", () => {
    const slugs = CATEGORIES.map((c) => slugify(c.title));
    expect(new Set(slugs).size).toBe(CATEGORIES.length);
  });
});

// A trimmed-down fixture matching the real page's actual markup shape
// (a single <p> with <br/>-separated category names) — not the full
// page, just enough to exercise the parser's actual assumptions.
function fixtureHtml(categoryTitles: string[]): string {
  return `<div class="fusion-text"><p>Types of Volunteers within BGCCAZ:<br />
${categoryTitles.join("<br />\n")}</p>
<p>Download the application form below.</p></div>`;
}

describe("verifyCategoriesPresent", () => {
  it("passes when every real category title is present", () => {
    const html = fixtureHtml(CATEGORIES.flatMap((c) => [c.title, ...c.subItems]));
    expect(() => verifyCategoriesPresent(html)).not.toThrow();
  });

  it("throws when the 'Types of Volunteers' section itself is missing", () => {
    const html = "<p>This page has been redesigned.</p>";
    expect(() => verifyCategoriesPresent(html)).toThrow(/Types of Volunteers/i);
  });

  it("throws when a real category has been removed from the page (drift detection)", () => {
    const titlesMinusOne = CATEGORIES.filter((c) => c.title !== "STEM").map((c) => c.title);
    const html = fixtureHtml(titlesMinusOne);
    expect(() => verifyCategoriesPresent(html)).toThrow(/STEM/);
  });

  it("does not false-pass on a category name mentioned outside the categories paragraph", () => {
    // "STEM" appears elsewhere on the page, but not inside the "Types of
    // Volunteers" section itself — should still fail for STEM.
    const titlesMinusOne = CATEGORIES.filter((c) => c.title !== "STEM").map((c) => c.title);
    const html = `<p>Ask us about our STEM lab tour.</p>${fixtureHtml(titlesMinusOne)}`;
    expect(() => verifyCategoriesPresent(html)).toThrow(/STEM/);
  });
});
