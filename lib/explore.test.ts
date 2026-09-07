import { describe, it, expect } from "vitest";
import { classifyExploreSection, EXPLORE_SECTION_LABELS, DEFAULT_EXPLORE_STATUSES } from "./explore";
import type { AvailabilityStatus } from "./availabilityStatus";

describe("classifyExploreSection", () => {
  it("maps 'open' to its own section", () => {
    expect(classifyExploreSection("open")).toBe("open");
  });

  it("maps 'seasonal' to its own section", () => {
    expect(classifyExploreSection("seasonal")).toBe("seasonal");
  });

  it("groups unverified/paused/waitlisted into one 'watch' section", () => {
    const grouped: AvailabilityStatus[] = ["unverified", "paused", "waitlisted"];
    for (const status of grouped) {
      expect(classifyExploreSection(status)).toBe("watch");
    }
  });

  it("maps 'closed' to its own section, distinct from every other section", () => {
    expect(classifyExploreSection("closed")).toBe("closed");
  });

  it("every section has a display label", () => {
    const allSections = new Set(
      (["open", "seasonal", "unverified", "paused", "waitlisted", "closed"] as AvailabilityStatus[]).map(
        classifyExploreSection
      )
    );
    for (const section of allSections) {
      expect(EXPLORE_SECTION_LABELS[section]).toBeTruthy();
    }
  });
});

describe("DEFAULT_EXPLORE_STATUSES", () => {
  it("defaults to exactly open + seasonal — the safest useful view", () => {
    expect(DEFAULT_EXPLORE_STATUSES.sort()).toEqual(["open", "seasonal"].sort());
  });

  it("does not include 'closed' by default — never show expired records by default", () => {
    expect(DEFAULT_EXPLORE_STATUSES).not.toContain("closed");
  });

  it("does not include the 'watch' statuses by default", () => {
    expect(DEFAULT_EXPLORE_STATUSES).not.toContain("unverified");
    expect(DEFAULT_EXPLORE_STATUSES).not.toContain("paused");
    expect(DEFAULT_EXPLORE_STATUSES).not.toContain("waitlisted");
  });
});
