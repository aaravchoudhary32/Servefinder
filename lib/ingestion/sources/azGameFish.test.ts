import { describe, it, expect } from "vitest";
import { parseRegionCity, parseNeedDateRange } from "./azGameFish";

describe("parseRegionCity", () => {
  it("extracts the city from a real 'Region N <City>' excerpt", () => {
    expect(parseRegionCity("Region 2 Flagstaff")).toBe("Flagstaff");
    expect(parseRegionCity("Region 4 Yuma")).toBe("Yuma");
    expect(parseRegionCity("Region 1 Pinetop")).toBe("Pinetop");
  });

  it("handles a multi-word city name", () => {
    expect(parseRegionCity("Region 3 Kingman")).toBe("Kingman");
  });

  it("returns null for a program-name excerpt with no region/city — never guesses a location", () => {
    expect(parseRegionCity("Desert Tortoise Adoption Program")).toBeNull();
    expect(parseRegionCity("Silver Creek Hatchery")).toBeNull();
  });

  it("returns null for an empty excerpt", () => {
    expect(parseRegionCity("")).toBeNull();
  });
});

describe("parseNeedDateRange", () => {
  it("parses a single date", () => {
    expect(parseNeedDateRange("Sep 12, 2026")).toBe("2026-09-12");
  });

  it("parses a date range, using the end date as the deadline", () => {
    expect(parseNeedDateRange("Aug 28, 2026 through Sep 12, 2026")).toBe("2026-09-12");
  });

  it("returns null for missing input, never a guess", () => {
    expect(parseNeedDateRange(null)).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseNeedDateRange("Ongoing")).toBeNull();
    expect(parseNeedDateRange("")).toBeNull();
  });
});
