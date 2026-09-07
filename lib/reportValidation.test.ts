import { describe, it, expect } from "vitest";
import { validateReportSubmission, MAX_REPORT_MESSAGE_LENGTH } from "./reportValidation";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("validateReportSubmission", () => {
  it("accepts a valid inaccurate_listing report", () => {
    const result = validateReportSubmission({
      reportType: "inaccurate_listing",
      message: "The link is broken.",
      opportunityId: VALID_UUID,
    });
    expect(result).toEqual({
      ok: true,
      value: { reportType: "inaccurate_listing", message: "The link is broken.", opportunityId: VALID_UUID },
    });
  });

  it("accepts a valid general_feedback report with no opportunityId", () => {
    const result = validateReportSubmission({ reportType: "general_feedback", message: "Love this app!" });
    expect(result).toEqual({
      ok: true,
      value: { reportType: "general_feedback", message: "Love this app!", opportunityId: null },
    });
  });

  it("trims the message", () => {
    const result = validateReportSubmission({ reportType: "general_feedback", message: "  hello  " });
    expect(result.ok && result.value.message).toBe("hello");
  });

  it("rejects an invalid reportType", () => {
    const result = validateReportSubmission({ reportType: "spam", message: "hi" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing reportType", () => {
    const result = validateReportSubmission({ message: "hi" });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty or whitespace-only message", () => {
    expect(validateReportSubmission({ reportType: "general_feedback", message: "   " }).ok).toBe(false);
    expect(validateReportSubmission({ reportType: "general_feedback", message: "" }).ok).toBe(false);
  });

  it("rejects a message over the length cap", () => {
    const result = validateReportSubmission({
      reportType: "general_feedback",
      message: "a".repeat(MAX_REPORT_MESSAGE_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a message at exactly the length cap", () => {
    const result = validateReportSubmission({
      reportType: "general_feedback",
      message: "a".repeat(MAX_REPORT_MESSAGE_LENGTH),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects inaccurate_listing with no opportunityId (regression: a listing report must reference a listing)", () => {
    const result = validateReportSubmission({ reportType: "inaccurate_listing", message: "It's wrong." });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed opportunityId", () => {
    const result = validateReportSubmission({
      reportType: "inaccurate_listing",
      message: "It's wrong.",
      opportunityId: "not-a-uuid",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-null non-string opportunityId", () => {
    const result = validateReportSubmission({
      reportType: "general_feedback",
      message: "hi",
      opportunityId: 12345,
    });
    expect(result.ok).toBe(false);
  });

  it("handles a null body", () => {
    expect(validateReportSubmission(null).ok).toBe(false);
  });
});
