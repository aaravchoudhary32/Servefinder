// Self-service data export (GET) and account deletion (DELETE) for the
// calling user's own account. Used by /settings.
//
// Export needs no service role at all — every table read here is
// already reachable by the caller's own RLS ("Users manage their own
// profile/applications/match feedback", "Users can check their own
// organization membership"), so a request-scoped client authenticated
// as the caller is enough, same reasoning app/api/org/applicants/route.ts
// uses for the org-scoped parts of its own query.
//
// Deletion needs the service role for exactly one thing RLS can't do:
// `auth.admin.deleteUser()`. Every user-owned table (profiles,
// applications, analytics_events, match_feedback, user_reports,
// admins, user_roles, organization_accounts) cascades automatically on
// that delete (`on delete cascade`, see supabase/schema.sql) — nothing
// else needs an explicit delete call. (`saved_opportunities` used to be
// listed here too, but nothing in this app reads or writes that table
// any more — superseded by `applications.status = 'saved'` — so it's
// not a real exception, just a stale reference removed.) The one real
// exception: an org
// rep's `organizations` row has no FK back to auth.users at all, and
// opportunities.organization_id is `on delete set null`, not cascade —
// left alone, deleting the user would silently orphan their
// organization's opportunities as permanently-public, ownerless listings
// (organization_id is null is treated as always-public by the
// verification-enforcement policy). So for an org rep, this explicitly
// deletes their organization's opportunities and the organization
// itself first, before deleting the user.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdminClient";
import { recordError } from "@/lib/errorLog";
import { safeErrorResponse } from "@/lib/apiError";
import { checkRateLimit, type RateLimitState } from "@/lib/rateLimit";

// Security audit finding (Medium): this route had no rate limit at all.
// DELETE is a destructive, irreversible action — a low per-user
// ceiling is plenty for any legitimate retry (a real failure, a
// double-click) while bounding a scripted retry loop. Same module-
// scope-Map pattern and honest "best-effort, not distributed" caveat
// as lib/rateLimit.ts's other caller (app/api/embeddings/route.ts).
const DELETE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DELETE_RATE_LIMIT_MAX_REQUESTS = 5;
const deleteRateLimitStore = new Map<string, RateLimitState>();

function callerClientFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const callerClient = callerClientFromRequest(request);
  if (!callerClient) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [profile, applications, matchFeedback, analyticsEvents, userReports, orgAccount] = await Promise.all([
    callerClient.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    callerClient
      .from("applications")
      .select("id, status, updated_at, opportunity_id, opportunities(title)")
      .eq("user_id", user.id),
    callerClient.from("match_feedback").select("*").eq("user_id", user.id),
    callerClient.from("analytics_events").select("*").eq("user_id", user.id),
    callerClient
      .from("user_reports")
      .select("id, report_type, message, status, opportunity_id, created_at")
      .eq("reporter_user_id", user.id),
    callerClient
      .from("organization_accounts")
      .select("organization_id, organizations(name, description, contact_email, verified)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data ?? null,
    applications: applications.data ?? [],
    matchFeedback: matchFeedback.data ?? [],
    analyticsEvents: analyticsEvents.data ?? [],
    reports: userReports.data ?? [],
    organization: orgAccount.data ?? null,
  });
}

export async function DELETE(request: NextRequest) {
  const callerClient = callerClientFromRequest(request);
  if (!callerClient) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!checkRateLimit(deleteRateLimitStore, user.id, Date.now(), DELETE_RATE_LIMIT_WINDOW_MS, DELETE_RATE_LIMIT_MAX_REQUESTS)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const admin = getSupabaseAdmin();

  const { data: orgAccount } = await callerClient
    .from("organization_accounts")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (orgAccount) {
    const { error: oppError } = await admin
      .from("opportunities")
      .delete()
      .eq("organization_id", orgAccount.organization_id);
    if (oppError) {
      await recordError(admin, {
        route: "/api/account",
        message: `Failed to delete opportunities for organization ${orgAccount.organization_id} during account deletion: ${oppError.message}`,
      });
      return safeErrorResponse(500, "Couldn't delete your organization's listings.");
    }

    const { error: orgError } = await admin.from("organizations").delete().eq("id", orgAccount.organization_id);
    if (orgError) {
      await recordError(admin, {
        route: "/api/account",
        message: `Failed to delete organization ${orgAccount.organization_id} during account deletion: ${orgError.message}`,
      });
      return safeErrorResponse(500, "Couldn't delete your organization.");
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    await recordError(admin, {
      route: "/api/account",
      message: `Failed to delete user ${user.id}: ${deleteUserError.message}`,
    });
    return safeErrorResponse(500, "Couldn't delete your account.");
  }

  return NextResponse.json({ deleted: true });
}
