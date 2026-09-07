import { describe, it, expect } from "vitest";
import { mmddyyyyToIso, formatEventDateForTitle } from "./specialOlympicsAZ";

describe("mmddyyyyToIso", () => {
  it("converts a valid MM/DD/YYYY date to YYYY-MM-DD", () => {
    expect(mmddyyyyToIso("09/11/2026")).toBe("2026-09-11");
  });

  it("preserves leading zeros in month and day", () => {
    expect(mmddyyyyToIso("01/03/2027")).toBe("2027-01-03");
  });

  it("handles a leap-day date", () => {
    expect(mmddyyyyToIso("02/29/2028")).toBe("2028-02-29");
  });

  it("returns null for a malformed date string", () => {
    expect(mmddyyyyToIso("2026-09-11")).toBeNull();
    expect(mmddyyyyToIso("9/11/2026")).toBeNull();
    expect(mmddyyyyToIso("not a date")).toBeNull();
    expect(mmddyyyyToIso("")).toBeNull();
  });
});

// Title disambiguation fix: the source page lists genuinely distinct
// calendar sessions (different external_id/application_url/deadline,
// confirmed live) under one identical "<Sport> Competition (<Region>)"
// title with no date — a student browsing Explore/Dashboard has no way
// to tell two same-titled cards apart otherwise. See the batch commit
// this shipped in for the full investigation (it was NOT an ingestion
// duplicate bug — findDuplicate() already keeps them as separate rows
// correctly via distinct external_ids; this is a display fix).
describe("formatEventDateForTitle", () => {
  it("formats an ISO date as 'Mon D, YYYY' for appending to a title", () => {
    expect(formatEventDateForTitle("2026-11-05")).toBe("Nov 5, 2026");
    expect(formatEventDateForTitle("2027-01-03")).toBe("Jan 3, 2027");
  });

  it("does not zero-pad the day", () => {
    expect(formatEventDateForTitle("2026-09-01")).toBe("Sep 1, 2026");
  });

  it("returns null for a null or malformed input, never a fabricated date", () => {
    expect(formatEventDateForTitle(null)).toBeNull();
    expect(formatEventDateForTitle("11/05/2026")).toBeNull();
    expect(formatEventDateForTitle("not a date")).toBeNull();
    expect(formatEventDateForTitle("")).toBeNull();
  });

  it("two events sharing a base title become distinguishable once the date is appended", () => {
    const baseTitle = "Bocce Competition (Yuma)";
    const dateA = formatEventDateForTitle(mmddyyyyToIso("11/05/2026"));
    const dateB = formatEventDateForTitle(mmddyyyyToIso("10/03/2026"));
    const titleA = `${baseTitle} — ${dateA}`;
    const titleB = `${baseTitle} — ${dateB}`;
    expect(titleA).not.toBe(titleB);
    expect(titleA).toBe("Bocce Competition (Yuma) — Nov 5, 2026");
    expect(titleB).toBe("Bocce Competition (Yuma) — Oct 3, 2026");
  });
});
