// Returns the applicant list (application status + student email) for
// the calling organization rep's own opportunities. Used by
// /org-dashboard.
//
// This has to be a server route rather than a plain client-side
// Supabase query for one reason: an applicant's email lives in
// `auth.users`, which PostgREST never exposes (RLS or no RLS — it's not
// in the `public` schema at all), so reading it requires the service
// role's `auth.admin` API (see lib/supabaseAdminClient.ts). Everything
// else here (which applications belong to this org) is deliberately
// still resolved through a request-scoped client authenticated as the
// *caller*, not the service role — so the existing `applications` RLS
// policy ("Org reps can view applications for their own organization",
// supabase/schema.sql) does the actual org-scoping, the same way it
// would for a normal client-side query. The service role only ever
// looks up emails for user_ids that query already proved belong to this
// org's applicants; it's never used to query `applications` directly,
// which would bypass that scoping entirely.
//
// Explicit Node runtime: supabase-js's admin API isn't edge-safe here
// (same reasoning as the embeddings route).
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdminClient";
import { recordError } from "@/lib/errorLog";
import { safeErrorResponse } from "@/lib/apiError";
import { checkRateLimit, type RateLimitState } from "@/lib/rateLimit";

// Security audit finding (Medium): this route had no rate limit despite
// fanning out one auth.admin.getUserById() call per unique applicant on
// every request — real, avoidable admin-API load with zero cost to the
// caller. 60 per 5 minutes is generous for normal dashboard polling
// (org-dashboard's own refresh cadence is far below this) while
// bounding a scripted repeat-hit. Same module-scope-Map pattern and
// honest "best-effort, not distributed" caveat as lib/rateLimit.ts's
// other callers.
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitStore = new Map<string, RateLimitState>();

type ApplicantRow = {
  id: string;
  status: "applied" | "accepted" | "completed";
  updated_at: string;
  user_id: string;
  opportunity_id: string;
  opportunities: { id: string; title: string } | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  // A per-request client carrying the caller's own JWT, not the anon
  // key alone — every query below runs as that specific authenticated
  // user, so RLS evaluates auth.uid() as them, exactly like a
  // client-side query from their own browser session would.
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
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { data: account } = await callerClient
    .from("organization_accounts")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "This account isn't linked to an organization." }, { status: 403 });
  }

  const { data: opps } = await callerClient
    .from("opportunities")
    .select("id, title")
    .eq("organization_id", account.organization_id);
  const oppIds = (opps ?? []).map((o) => o.id);
  if (oppIds.length === 0) {
    return NextResponse.json({ applicants: [] });
  }

  // 'saved' rows are a student's private bookmark, not a submitted
  // application — excluded so an org never sees that a named student
  // merely looked at a listing without applying.
  const { data: apps, error: appsError } = await callerClient
    .from("applications")
    .select("id, status, updated_at, user_id, opportunity_id, opportunities(id, title)")
    .in("opportunity_id", oppIds)
    .neq("status", "saved")
    .order("updated_at", { ascending: false });

  if (appsError) {
    await recordError(getSupabaseAdmin(), { route: "/api/org/applicants", message: appsError.message });
    return safeErrorResponse(500, "Couldn't load applicants.");
  }

  const rows = (apps ?? []) as unknown as ApplicantRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const emailById = new Map<string, string | null>();
  const admin = getSupabaseAdmin();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        emailById.set(id, error ? null : data.user?.email ?? null);
      } catch {
        emailById.set(id, null);
      }
    })
  );

  const applicants = rows.map((r) => ({
    id: r.id,
    status: r.status,
    updated_at: r.updated_at,
    opportunity: r.opportunities,
    applicantEmail: emailById.get(r.user_id) ?? null,
  }));

  return NextResponse.json({ applicants });
}
