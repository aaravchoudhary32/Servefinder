// Pure input validation for POST /api/reports, split out from the
// route so it's unit-testable without pulling in @supabase/supabase-js
// or Next's request/response types.
export const MAX_REPORT_MESSAGE_LENGTH = 2000;

export const VALID_REPORT_TYPES = ["inaccurate_listing", "general_feedback"] as const;
export type ReportType = (typeof VALID_REPORT_TYPES)[number];

// Loose UUID shape check — good enough to reject an obviously malformed
// value before it reaches Postgres; the foreign key constraint (and
// RLS on `opportunities`) is what actually guarantees it refers to a
// real, visible opportunity.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReportSubmission = {
  reportType: ReportType;
  message: string;
  opportunityId: string | null;
};

export type ReportValidation = { ok: true; value: ReportSubmission } | { ok: false; error: string };

export function validateReportSubmission(body: unknown): ReportValidation {
  const reportType = (body as Record<string, unknown> | null)?.reportType;
  const message = (body as Record<string, unknown> | null)?.message;
  const opportunityIdRaw = (body as Record<string, unknown> | null)?.opportunityId ?? null;

  if (typeof reportType !== "string" || !(VALID_REPORT_TYPES as readonly string[]).includes(reportType)) {
    return { ok: false, error: "'reportType' must be 'inaccurate_listing' or 'general_feedback'." };
  }
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, error: "Please include a message describing the issue." };
  }
  if (message.length > MAX_REPORT_MESSAGE_LENGTH) {
    return { ok: false, error: `Message must be ${MAX_REPORT_MESSAGE_LENGTH} characters or fewer.` };
  }
  if (reportType === "inaccurate_listing" && typeof opportunityIdRaw !== "string") {
    return { ok: false, error: "Reporting an inaccurate listing requires an opportunity to be specified." };
  }
  if (opportunityIdRaw !== null && (typeof opportunityIdRaw !== "string" || !UUID_PATTERN.test(opportunityIdRaw))) {
    return { ok: false, error: "Invalid opportunity reference." };
  }

  return {
    ok: true,
    value: {
      reportType: reportType as ReportType,
      message: message.trim(),
      opportunityId: (opportunityIdRaw as string | null) ?? null,
    },
  };
}
