import { describe, it, expect } from "vitest";
import { parseAgeFields, resolveTeenEligibility } from "./handsOnGreaterPhoenix";

describe("parseAgeFields", () => {
  it("parses both structured age fields from a real listing's HTML", () => {
    const html = `<p class="requirements"><span class='minimumAgeAdults'>Age Minimum (with Adult): 16+</span>, <span class='minimumAge'>Minimum Age:16+</span></p>`;
    expect(parseAgeFields(html)).toEqual({ withAdult: 16, independent: 16 });
  });

  it("parses a two-tier listing where the with-adult floor is lower", () => {
    const html = `<span class='minimumAgeAdults'>Age Minimum (with Adult): 14+</span>, <span class='minimumAge'>Minimum Age:16+</span>`;
    expect(parseAgeFields(html)).toEqual({ withAdult: 14, independent: 16 });
  });

  it("returns nulls when neither field is present — never guesses", () => {
    expect(parseAgeFields("<p>no age info here</p>")).toEqual({ withAdult: null, independent: null });
  });
});

describe("resolveTeenEligibility", () => {
  it("uses the single number when both fields match (independent-only listing)", () => {
    expect(resolveTeenEligibility(16, 16)).toEqual({ minimumAge: 16, parentalConsentRequired: false });
  });

  it("uses the lower with-adult floor and flags parental consent under 16", () => {
    expect(resolveTeenEligibility(14, 18)).toEqual({ minimumAge: 14, parentalConsentRequired: true });
  });

  it("floors a real sub-13 with-adult figure to this app's 13+ platform minimum", () => {
    expect(resolveTeenEligibility(7, 16)).toEqual({ minimumAge: 13, parentalConsentRequired: true });
    expect(resolveTeenEligibility(12, 18)).toEqual({ minimumAge: 13, parentalConsentRequired: true });
  });

  it("does not require parental consent once the real floor reaches 16", () => {
    expect(resolveTeenEligibility(16, 18)).toEqual({ minimumAge: 16, parentalConsentRequired: false });
  });

  it("rejects adult-only listings (both fields above 18) — never invents eligibility", () => {
    expect(resolveTeenEligibility(18, 18)).toBeNull();
    expect(resolveTeenEligibility(21, 21)).toBeNull();
  });

  it("rejects when neither field was found at all", () => {
    expect(resolveTeenEligibility(null, null)).toBeNull();
  });

  it("still qualifies from a single present field", () => {
    expect(resolveTeenEligibility(null, 14)).toEqual({ minimumAge: 14, parentalConsentRequired: true });
    expect(resolveTeenEligibility(13, null)).toEqual({ minimumAge: 13, parentalConsentRequired: true });
  });
});
