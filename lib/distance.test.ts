import { describe, it, expect } from "vitest";
import { resolveDistanceMiles, distanceLabel, explorerLocationLabel, isOutsideRadius } from "./distance";

describe("resolveDistanceMiles", () => {
  it("computes a real distance when both student and opportunity coordinates are present", () => {
    const studentCoords = { lat: 33.4484, lng: -112.074 };
    const opp = { latitude: 33.4152, longitude: -111.8315 }; // Mesa, AZ — a real short distance away
    const miles = resolveDistanceMiles(studentCoords, opp);
    expect(miles).not.toBeNull();
    expect(miles).toBeGreaterThan(0);
  });

  it("returns null when the student's location is unresolved", () => {
    const opp = { latitude: 33.4152, longitude: -111.8315 };
    expect(resolveDistanceMiles(null, opp)).toBeNull();
  });

  it("returns null when the opportunity has no coordinates at all — failed geocoding is not treated as virtual", () => {
    const studentCoords = { lat: 33.4484, lng: -112.074 };
    expect(resolveDistanceMiles(studentCoords, { latitude: null, longitude: null })).toBeNull();
    // Partial coordinates (one side present, one missing) must also stay null.
    expect(resolveDistanceMiles(studentCoords, { latitude: 33.4152, longitude: null })).toBeNull();
  });
});

describe("distanceLabel", () => {
  it("shows a real mileage figure for an in_person opportunity with a resolved distance", () => {
    expect(distanceLabel(12, "in_person")).toBe("12 miles away");
  });

  it("defaults to in_person behavior when deliveryMode is omitted", () => {
    expect(distanceLabel(5, undefined)).toBe("5 miles away");
    expect(distanceLabel(5, null)).toBe("5 miles away");
  });

  it("shows 'Distance unavailable' for an in_person opportunity with an unresolved distance — never a fake mileage figure", () => {
    expect(distanceLabel(null, "in_person")).toBe("Distance unavailable");
    expect(distanceLabel(null, undefined)).toBe("Distance unavailable");
  });

  it("shows 'Virtual' regardless of whether coordinates happen to resolve", () => {
    expect(distanceLabel(null, "virtual")).toBe("Virtual");
    expect(distanceLabel(3, "virtual")).toBe("Virtual"); // never a mileage figure even if resolvable
  });

  it("shows a distinct hybrid label, never a mileage figure", () => {
    expect(distanceLabel(null, "hybrid")).toBe("Hybrid — virtual option available");
    expect(distanceLabel(20, "hybrid")).toBe("Hybrid — virtual option available");
  });
});

// /explore-specific: unlike distanceLabel() (only ever called on a
// record that already survived the distance hard filter), /explore shows
// every record regardless of distance, so an unresolved in_person
// location needs its own honest wording.
describe("explorerLocationLabel", () => {
  it("shows a real mileage figure for an in_person record with a resolved distance", () => {
    expect(explorerLocationLabel(12, "in_person")).toBe("12 miles away");
  });

  it("shows 'Location not verified' for an in_person record with no coordinates — never a number, never worded as nearby", () => {
    expect(explorerLocationLabel(null, "in_person")).toBe("Location not verified");
    expect(explorerLocationLabel(null, undefined)).toBe("Location not verified");
  });

  it("shows 'Virtual'/'Hybrid' regardless of resolved distance", () => {
    expect(explorerLocationLabel(500, "virtual")).toBe("Virtual");
    expect(explorerLocationLabel(null, "virtual")).toBe("Virtual");
    expect(explorerLocationLabel(500, "hybrid")).toBe("Hybrid — virtual option available");
  });
});

describe("isOutsideRadius", () => {
  it("is true for an in_person record beyond the student's radius", () => {
    expect(isOutsideRadius(25, "in_person", 20)).toBe(true);
  });

  it("is false for an in_person record within the student's radius", () => {
    expect(isOutsideRadius(10, "in_person", 20)).toBe(false);
  });

  it("is false for an unresolved in_person location — 'unknown' is not 'confirmed far away'", () => {
    expect(isOutsideRadius(null, "in_person", 20)).toBe(false);
  });

  it("is always false for virtual/hybrid, no matter the distance — distance-independent by design", () => {
    expect(isOutsideRadius(500, "virtual", 20)).toBe(false);
    expect(isOutsideRadius(500, "hybrid", 20)).toBe(false);
  });

  it("defaults to in_person behavior when deliveryMode is omitted", () => {
    expect(isOutsideRadius(25, undefined, 20)).toBe(true);
  });
});
