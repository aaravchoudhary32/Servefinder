import { describe, it, expect } from "vitest";
import { computeContentFingerprint, contentChanged, type FingerprintInput } from "./fingerprint";

const base: FingerprintInput = {
  title: "Teen Volunteer Program",
  description: "A real description of the program.",
  location: "Phoenix, AZ",
  minimum_age: 15,
  application_url: "https://example.org/apply",
  application_deadline: "2026-12-01",
};

describe("computeContentFingerprint", () => {
  it("is deterministic for identical input", () => {
    expect(computeContentFingerprint(base)).toBe(computeContentFingerprint({ ...base }));
  });

  it("is case-insensitive on text fields (whitespace/casing shouldn't count as a real content change)", () => {
    expect(computeContentFingerprint(base)).toBe(
      computeContentFingerprint({ ...base, title: "  TEEN volunteer PROGRAM  ", location: "PHOENIX, az" })
    );
  });

  it("changes when the description changes", () => {
    expect(computeContentFingerprint(base)).not.toBe(
      computeContentFingerprint({ ...base, description: "A materially different description." })
    );
  });

  it("changes when minimum_age changes", () => {
    expect(computeContentFingerprint(base)).not.toBe(computeContentFingerprint({ ...base, minimum_age: 16 }));
  });

  it("changes when application_deadline changes", () => {
    expect(computeContentFingerprint(base)).not.toBe(
      computeContentFingerprint({ ...base, application_deadline: "2027-01-01" })
    );
  });

  it("treats null and empty-string description the same (both normalize to empty)", () => {
    expect(computeContentFingerprint({ ...base, description: null })).toBe(
      computeContentFingerprint({ ...base, description: "" })
    );
  });

  it("produces a fixed-shape 8-character hex string", () => {
    expect(computeContentFingerprint(base)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("contentChanged", () => {
  it("returns true when there's no previous fingerprint stored yet", () => {
    expect(contentChanged(null, base)).toBe(true);
  });

  it("returns false when content is identical to what the fingerprint represents", () => {
    const fp = computeContentFingerprint(base);
    expect(contentChanged(fp, base)).toBe(false);
  });

  it("returns true when content has genuinely changed", () => {
    const fp = computeContentFingerprint(base);
    expect(contentChanged(fp, { ...base, application_deadline: "2027-06-01" })).toBe(true);
  });
});
