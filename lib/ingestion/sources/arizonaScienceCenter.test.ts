import { describe, it, expect } from "vitest";
import { slugify, parseRoles } from "./arizonaScienceCenter";

describe("slugify", () => {
  it("lowercases and hyphenates a plain title", () => {
    expect(slugify("Administrative Volunteer")).toBe("administrative-volunteer");
  });

  it("collapses multiple non-alphanumeric characters into one hyphen", () => {
    expect(slugify("Guest Sales and Services Volunteer")).toBe("guest-sales-and-services-volunteer");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  Girls in STEM Mentor  ")).toBe("girls-in-stem-mentor");
  });
});

// A trimmed-down fixture matching the real page's actual Bootstrap
// accordion markup shape (button holding the title, accordion-body
// holding an intro paragraph plus a <ul> of responsibility bullets) — not
// the full page, just enough to exercise the parser's actual assumptions.
function accordionItemHtml(title: string, intro: string, bullets: string[]): string {
  return `
    <div class="accordion-item">
        <h3 class="accordion-header" id="flush-heading-item-x">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                    data-bs-target="#flush-collapse-item-x" aria-expanded="true" aria-controls="flush-collapse-item-x">
                ${title}
            </button>
        </h3>
        <div id="flush-collapse-item-x" class="accordion-collapse collapse" aria-labelledby="flush-heading-item-x">
            <div class="accordion-body">
                <div class="accordion-text mb-4">
                    <p>${intro}</p>
<ul>
${bullets.map((b) => `<li class="odd">${b}</li>`).join("\n")}
</ul>
                </div>
            </div>
        </div>
    </div>`;
}

describe("parseRoles", () => {
  it("extracts every role's title and full description (intro + bullets) from real markup shape", () => {
    const html = `<section class="container accordion-group">${accordionItemHtml(
      "Administrative Volunteer",
      "Are you someone who thrives by organizing data?",
      ["Assist with data entry, research or clerical tasks"]
    )}${accordionItemHtml("Girls in STEM Mentor", "Aims to spark excitement for STEM among girls.", [
      "Facilitate engaging activities.",
      "Speak on your field of expertise.",
    ])}</section>`;

    const roles = parseRoles(html);
    expect(roles).toHaveLength(2);
    expect(roles[0].title).toBe("Administrative Volunteer");
    expect(roles[0].description).toContain("Are you someone who thrives by organizing data?");
    expect(roles[0].description).toContain("Assist with data entry, research or clerical tasks");
    expect(roles[0].externalId).toBe("administrative-volunteer");

    expect(roles[1].title).toBe("Girls in STEM Mentor");
    expect(roles[1].description).toContain("Facilitate engaging activities.");
    expect(roles[1].description).toContain("Speak on your field of expertise.");
  });

  it("decodes numeric and hex HTML entities in titles (real page has &#xAE; for the ® in 'CREATE at Arizona Science Center®')", () => {
    const html = accordionItemHtml("CREATE at Arizona Science Center&#xAE; Volunteer", "Operate laser cutters and 3D printers.", [
      "Greet CREATE Guests and assist with activity zones.",
    ]);
    const roles = parseRoles(html);
    expect(roles).toHaveLength(1);
    expect(roles[0].title).toBe("CREATE at Arizona Science Center® Volunteer");
  });

  it("produces a distinct external_id per role (no collisions across the real 6)", () => {
    const html = [
      "Guest Sales and Services Volunteer",
      "Administrative Volunteer",
      "Amateur Radio Operator Volunteer",
      "CREATE at Arizona Science Center Volunteer",
      "Activity Facilitation Volunteer",
      "Girls in STEM Mentor",
    ]
      .map((title) => accordionItemHtml(title, "Intro text.", ["A bullet."]))
      .join("\n");
    const roles = parseRoles(html);
    expect(roles).toHaveLength(6);
    expect(new Set(roles.map((r) => r.externalId)).size).toBe(6);
  });

  it("returns an empty array (not a crash) when the page layout no longer matches", () => {
    const html = "<p>This page has been redesigned.</p>";
    expect(parseRoles(html)).toEqual([]);
  });
});
