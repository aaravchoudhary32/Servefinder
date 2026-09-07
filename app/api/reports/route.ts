// Lets a signed-in user submit a listing-accuracy report or general
// product feedback (P0, product-readiness audit — see
// supabase/add_user_reports.sql). A server route rather than a raw
// client-side insert for one reason: user-generated free text is the
// one genuinely spam-prone write surface in this app, so it needs the
// same server-side validation + rate-limit discipline as
// /api/embeddings, not just RLS. Requires authentication — this app
// has no anonymous-write path anywhere, and requiring login is itself
// a meaningful anti-spam measure (an anonymous form would need a much
// heavier abuse-prevention layer, like a CAPTCHA, that this scale
// doesn't justify).
//
// The actual insert runs through a request-scoped client carrying the
// caller's own JWT (same pattern as app/api/account/route.ts,
// app/api/org/applicants/route.ts) — not the service role — so
// user_reports' "Users can submit their own reports" RLS policy is
// the real enforcement boundary, not just this route's own check.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeErrorResponse } from "@/lib/apiError";
import { checkRateLimit, type RateLimitState } from "@/lib/rateLimit";
import { validateReportSubmission } from "@/lib/reportValidation";

// Generous for genuine use (a student reporting a couple of stale
// listings, or leaving one piece of feedback) while bounding a
// scripted spam loop. Same module-scope-Map pattern as this app's
// other rate limiters — see lib/rateLimit.ts's header for what this
// does and doesn't guarantee under concurrent/cold instances.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitStore = new Map<string, RateLimitState>();

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!checkRateLimit(rateLimitStore, user.id, Date.now(), RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)) {
    return NextResponse.json({ error: "Too many reports submitted. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateReportSubmission(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { reportType, message, opportunityId } = validation.value;

  const { error: insertError } = await callerClient.from("user_reports").insert({
    reporter_user_id: user.id,
    opportunity_id: opportunityId,
    report_type: reportType,
    message,
  });

  if (insertError) {
    console.error("user_reports insert failed:", insertError.message);
    return safeErrorResponse(500, "Couldn't submit your report. Please try again.");
  }

  // Analytics-only, and only for general feedback (not a listing-
  // accuracy report, which isn't in the tracked event list) — uses the
  // same caller-scoped client as the insert above, so analytics_events'
  // own RLS (auth.uid() = user_id) is what actually guarantees this can
  // only ever record the real caller's own event. Errors are logged,
  // never surfaced: the report itself already succeeded, and analytics
  // failing here must not turn that into a user-facing error.
  if (reportType === "general_feedback") {
    const { error: analyticsError } = await callerClient
      .from("analytics_events")
      .insert({ event_type: "general_feedback_submitted", user_id: user.id, metadata: {} });
    if (analyticsError) {
      console.error("general_feedback_submitted analytics insert failed:", analyticsError.message);
    }
  }

  return NextResponse.json({ submitted: true }, { status: 201 });
}
