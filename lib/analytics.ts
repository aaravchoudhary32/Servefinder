// Product-usage event logging, read by /admin/user-analytics (aggregate
// stats) and /admin/analytics (matching-quality comparison) —
// supabase/schema.sql / supabase/add_user_analytics.sql's
// analytics_events table. Fire-and-forget — callers never await this,
// and a failure here must never break the user action it's attached to
// (same posture as embedAndAttach in app/org-dashboard/page.tsx, a
// fire-and-forget side effect after the action it's attached to already
// succeeded).
//
// metadata may only ever hold small, structured, non-identifying
// values (match mode, from/to status, broad category, filter type, a
// preset feedback reason, a helpful boolean) — never free text, age,
// city, zip, interests, skills, or email. This is enforced twice: the
// AnalyticsMetadata type below (so a typo'd or removed field fails fast
// at compile time) and, more importantly, a server-side check
// constraint on analytics_events.metadata itself
// (analytics_metadata_is_valid() in supabase/add_user_analytics.sql) —
// the real boundary, since an authenticated user could otherwise POST
// arbitrary jsonb straight to PostgREST, bypassing this file entirely.
// See ARCHITECTURE.md for the full no-PII definition this table is
// built against.

import { supabase } from "./supabaseClient";

export type AnalyticsEventType =
  | "onboarding_started"
  | "onboarding_completed"
  | "match_viewed"
  | "match_saved"
  | "application_started"
  | "application_submitted"
  | "application_status_changed"
  | "opportunity_completed"
  // Manual-source-integration events (see lib/availabilityStatus.ts):
  // external_link_clicked/contact_interest_clicked distinguish a real
  // apply/registration link from a contact-only pathway; tracked
  // separately from application_started/application_submitted since
  // neither implies an actual application was started.
  | "external_link_clicked"
  | "contact_interest_clicked"
  // Fired when an admin manually re-verifies a seasonal/unverified
  // record as currently open (see app/admin/page.tsx).
  | "program_availability_confirmed"
  // Page-view events, deduplicated (see `dedupe` below) so a re-render
  // or a quick back-and-forth navigation doesn't inflate them — these
  // are deliberately EXCLUDED from the "meaningful action" set the
  // admin analytics functions use for active-user counts (a page load
  // alone, same as a homepage visit, shouldn't count as engagement).
  | "dashboard_viewed"
  | "explore_viewed"
  // A deliberate interaction, unlike the page views above — counts
  // toward active-user totals.
  | "search_performed"
  | "filter_used"
  // Expanding a card's "View details" disclosure — a deliberate choice
  // to look closer, distinct from match_viewed (which fires for every
  // ranked result whether or not the student actually looked at it).
  | "opportunity_details_viewed"
  | "opportunity_unsaved"
  // Distinct from the generic application_status_changed so "how many
  // students were accepted" doesn't require unpacking metadata ->
  // toStatus. Only fires from the student's own self-report path
  // (lib/applications.ts) — an org accepting an applicant can't fire an
  // event attributed to that student's own user_id (analytics_events'
  // RLS insert policy requires auth.uid() = user_id, and forging another
  // user's event ownership is exactly what that's meant to prevent), so
  // that path is undercounted here by design; applications.status
  // itself (used for the funnel/snapshot totals, not this event) still
  // reflects it correctly regardless of who advanced it.
  | "opportunity_accepted"
  | "match_feedback_submitted"
  | "general_feedback_submitted";

// The only metadata keys any call site may ever send — mirrors
// analytics_metadata_is_valid()'s allowlist in
// supabase/add_user_analytics.sql exactly. Adding a key here without
// also widening that SQL function's allowlist means the insert will be
// silently rejected by the database (trackEvent swallows the error, per
// its fire-and-forget contract, but see lib/analytics.test.ts for a
// unit test pinning this list against the same one used there).
export type AnalyticsMetadata = {
  matchMode?: "classic" | "semantic";
  fromStatus?: string;
  toStatus?: string;
  category?: string;
  filterType?: string;
  helpful?: boolean;
  reason?: string;
  // Which of several possible link types was clicked for the same
  // event_type — e.g. an organization's own website (see
  // app/organizations/[id]/page.tsx) vs. an opportunity's apply link.
  context?: string;
};

// The runtime twin of AnalyticsMetadata's keys above — a TS type alone
// only helps at compile time, so this is what ANALYTICS_METADATA_KEYS-
// filtering below actually checks against at runtime, and what
// lib/analytics.test.ts pins against supabase/add_user_analytics.sql's
// analytics_metadata_is_valid() allowlist to keep both lists in sync.
export const ANALYTICS_METADATA_KEYS = [
  "matchMode",
  "fromStatus",
  "toStatus",
  "category",
  "filterType",
  "helpful",
  "reason",
  "context",
] as const satisfies readonly (keyof AnalyticsMetadata)[];

export type AnalyticsEventOptions = {
  opportunityId?: string;
  applicationId?: string;
  metadata?: AnalyticsMetadata;
  // Set for page-view-style events only: skips the insert if the same
  // event type was already recorded within the dedupe window (see
  // DEDUPE_WINDOW_MS), scoped per browser tab via sessionStorage — a
  // React re-render, Next.js prefetch, or quick back-and-forth
  // navigation shouldn't multiply "dashboard viewed" counts, but a
  // genuine later visit (after the window elapses, or in a new tab)
  // still counts.
  dedupe?: boolean;
};

export const DEDUPE_WINDOW_MS = 30_000;

// Exported for lib/analytics.test.ts — both of these are pure enough
// (sessionStorage aside) to test directly without mocking the supabase
// client trackEvent() itself needs, matching this codebase's existing
// preference for testing logic units in isolation over mocking a
// network client just to exercise a few lines around it.
export function isDuplicateWithinWindow(eventType: AnalyticsEventType): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = `analytics_dedupe:${eventType}`;
    const last = window.sessionStorage.getItem(key);
    const now = Date.now();
    if (last && now - Number(last) < DEDUPE_WINDOW_MS) return true;
    window.sessionStorage.setItem(key, String(now));
    return false;
  } catch {
    // Private-browsing mode or storage disabled — fail open (track it)
    // rather than silently losing every page-view event for that
    // session; a rare over-count here is far cheaper than an
    // under-count that looks like nobody uses the app.
    return false;
  }
}

// Drops any key not in ANALYTICS_METADATA_KEYS and any value that isn't
// a short (<=40 char) string or a boolean — a runtime mirror of
// analytics_metadata_is_valid()'s SQL check, so a caller that
// constructs metadata dynamically (or bypasses the AnalyticsMetadata
// type with an `as` cast) still can't smuggle an unexpected key or an
// oversized value through this file. The database constraint remains
// the real boundary either way (this file's own code isn't what stops
// a direct PostgREST call), but there's no reason to rely on it alone
// when this app's own client can just as easily never send it.
export function sanitizeMetadata(metadata: AnalyticsMetadata | undefined): AnalyticsMetadata {
  if (!metadata) return {};
  const clean: Record<string, unknown> = {};
  for (const key of ANALYTICS_METADATA_KEYS) {
    const value = metadata[key];
    if (value === undefined) continue;
    if (typeof value === "boolean") {
      clean[key] = value;
    } else if (typeof value === "string" && value.length <= 40) {
      clean[key] = value;
    }
    // Anything else (a too-long string, or some other type entirely) is
    // silently dropped rather than sent — same "fail closed, don't
    // block the caller" posture as the rest of this function.
  }
  return clean as AnalyticsMetadata;
}

export async function trackEvent(
  eventType: AnalyticsEventType,
  opts: AnalyticsEventOptions = {}
): Promise<void> {
  try {
    if (opts.dedupe && isDuplicateWithinWindow(eventType)) return;

    // getSession() reads the locally cached session — no network round
    // trip, unlike getUser() (which revalidates against the server on
    // every call). Matters here: match_viewed can fire many times per
    // dashboard load.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("analytics_events").insert({
      event_type: eventType,
      user_id: session.user.id,
      opportunity_id: opts.opportunityId ?? null,
      application_id: opts.applicationId ?? null,
      metadata: sanitizeMetadata(opts.metadata),
    });
    if (error) throw error;
  } catch (err) {
    console.error("Failed to record analytics event", eventType, err);
  }
}
