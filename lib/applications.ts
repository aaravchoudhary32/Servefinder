// Advances an application to its next status (saved -> applied ->
// accepted -> completed). Extracted from app/dashboard/page.tsx's
// advanceStatus and app/applications/page.tsx's advance — identical
// logic duplicated in both places. Pulled out specifically so the
// analytics tracking added alongside it (application_status_changed,
// plus the more specific application_submitted/opportunity_completed)
// lives in exactly one place instead of two copies that could drift.
//
// Mirrors the original behavior exactly: returns null (does nothing
// further) both when there's no next status and when the update fails
// — callers early-return on null the same way the original inline
// functions did, so this isn't a behavior change, just a dedupe.

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextStatus, ApplicationStatus } from "./applicationStatus";
import { trackEvent } from "./analytics";

export async function advanceApplicationStatus(
  supabase: SupabaseClient,
  application: { id: string; status: ApplicationStatus; opportunityId?: string }
): Promise<ApplicationStatus | null> {
  const next = nextStatus(application.status);
  if (!next) return null;

  const { error } = await supabase
    .from("applications")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", application.id);
  if (error) return null;

  trackEvent("application_status_changed", {
    applicationId: application.id,
    opportunityId: application.opportunityId,
    metadata: { fromStatus: application.status, toStatus: next },
  });
  if (next === "applied") {
    trackEvent("application_submitted", {
      applicationId: application.id,
      opportunityId: application.opportunityId,
    });
  }
  if (next === "completed") {
    trackEvent("opportunity_completed", {
      applicationId: application.id,
      opportunityId: application.opportunityId,
    });
  }

  return next;
}
