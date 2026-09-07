import { describe, it, expect } from "vitest";
import { isContactOnlyLink, applicationLinkLabel, PROGRAM_TYPE_LABELS, canApplyNow, AvailabilityStatus } from "./availabilityStatus";

describe("isContactOnlyLink", () => {
  it("treats a mailto: link as contact-only", () => {
    expect(isContactOnlyLink("mailto:volunteer@example.org")).toBe(true);
  });

  it("is case-insensitive on the mailto: scheme", () => {
    expect(isContactOnlyLink("MAILTO:volunteer@example.org")).toBe(true);
  });

  it("treats a real URL as not contact-only", () => {
    expect(isContactOnlyLink("https://example.org/apply")).toBe(false);
  });

  it("treats null/undefined/empty as not contact-only", () => {
    expect(isContactOnlyLink(null)).toBe(false);
    expect(isContactOnlyLink(undefined)).toBe(false);
    expect(isContactOnlyLink("")).toBe(false);
  });
});

describe("applicationLinkLabel", () => {
  it("labels a mailto: link as 'Contact organization'", () => {
    expect(applicationLinkLabel("mailto:volunteer@example.org")).toBe("Contact organization");
  });

  it("labels a real URL as 'External application'", () => {
    expect(applicationLinkLabel("https://example.org/apply")).toBe("External application");
  });

  it("returns null when there's no application_url at all", () => {
    expect(applicationLinkLabel(null)).toBeNull();
    expect(applicationLinkLabel(undefined)).toBeNull();
  });
});

// CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology batch: a
// judged/ranked/scored/award-based event (Congressional App Challenge,
// CyberPatriot, NASA challenges, robotics competitions) is its own
// ProgramType, deliberately distinct from career_exploration_program —
// never labeled as volunteering.
describe("PROGRAM_TYPE_LABELS", () => {
  it("labels 'competition' distinctly from every other program type", () => {
    expect(PROGRAM_TYPE_LABELS.competition).toBe("Competition");
    expect(new Set(Object.values(PROGRAM_TYPE_LABELS)).size).toBe(Object.keys(PROGRAM_TYPE_LABELS).length);
  });

  it("never labels competition the same as volunteering", () => {
    expect(PROGRAM_TYPE_LABELS.competition).not.toBe(PROGRAM_TYPE_LABELS.volunteering);
  });
});

// /explore: the one place "can a student apply right now" is decided.
describe("canApplyNow", () => {
  it("is true only for 'open'", () => {
    expect(canApplyNow("open")).toBe(true);
  });

  it("is false for every other status — seasonal, unverified, closed, paused, waitlisted", () => {
    const nonOpen: AvailabilityStatus[] = ["seasonal", "unverified", "closed", "paused", "waitlisted"];
    for (const status of nonOpen) {
      expect(canApplyNow(status)).toBe(false);
    }
  });
});
