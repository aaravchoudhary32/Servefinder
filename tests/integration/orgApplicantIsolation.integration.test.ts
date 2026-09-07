// Regression test for the guarantee /org-dashboard's "Applicants"
// section depends on: an organization can read and act on applications
// tied to ITS OWN opportunities only, never another organization's.
//
// This has to be a real integration test against the live Supabase
// project, not a unit test — the entire guarantee lives in Postgres
// (the "Org reps can view applications for their own organization" RLS
// policy for reads, and the org_update_application_status() security
// definer function for writes; see supabase/schema.sql). There is no
// TypeScript authorization logic to extract and unit-test — a
// hand-written reimplementation of that SQL logic would test a copy,
// not the real thing, and could silently drift from schema.sql while
// staying green.
//
// Deliberately exercises the same RLS policy / RPC function the real
// app code paths use (app/api/org/applicants/route.ts,
// app/org-dashboard/page.tsx's handleAdvanceApplicant) via JWT-scoped
// supabase-js clients — not an HTTP call into the Next.js route itself,
// which would need a running dev server. The security boundary being
// tested is the same either way: which Postgres role/policy/function
// evaluates the request, not how the HTTP request got there.
//
// Uses the one shared Supabase project (no separate test project — see
// vitest.integration.setup.ts) with throwaway fixtures prefixed
// `__test__`, created in beforeAll and removed by the last test case
// (with an afterAll safety net in case that test itself fails partway
// through). Excluded from `npm test`/CI — run by hand with
// `npm run test:integration` before a deploy that touches RLS/auth.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FIXTURE_PREFIX = "__test__ org-isolation";
const PASSWORD = "Integration-Test-Pw-2026!";

let admin: SupabaseClient;
let orgAClient: SupabaseClient;
let orgBClient: SupabaseClient;

let orgAUserId: string;
let orgBUserId: string;
let studentUserId: string;
let orgAId: string;
let orgBId: string;
let oppId: string;
let appliedApplicationId: string;
let savedApplicationId: string;

// Tracks what's actually been created so the safety-net afterAll only
// ever tries to delete things that exist, and one failed deletion
// doesn't stop the rest from being attempted.
const created = {
  userIds: [] as string[],
  orgIds: [] as string[],
};

async function bestEffortCleanup() {
  for (const orgId of created.orgIds) {
    await admin.from("organizations").delete().eq("id", orgId).then(
      () => {},
      () => {}
    );
  }
  for (const userId of created.userIds) {
    await admin.auth.admin.deleteUser(userId).then(
      () => {},
      () => {}
    );
  }
}

beforeAll(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();

  async function createUser(label: string) {
    const email = `${FIXTURE_PREFIX.replace(/\s+/g, "-")}-${label}-${stamp}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
    created.userIds.push(data.user.id);
    return data.user;
  }

  const orgAUser = await createUser("org-a");
  const orgBUser = await createUser("org-b");
  const studentUser = await createUser("student");
  orgAUserId = orgAUser.id;
  orgBUserId = orgBUser.id;
  studentUserId = studentUser.id;

  await admin.from("user_roles").insert([
    { user_id: orgAUserId, role: "organization" },
    { user_id: orgBUserId, role: "organization" },
    { user_id: studentUserId, role: "student" },
  ]);

  const { data: orgA, error: orgAErr } = await admin
    .from("organizations")
    .insert({ name: `${FIXTURE_PREFIX} A ${stamp}`, description: "Throwaway fixture for orgApplicantIsolation.integration.test.ts" })
    .select("id")
    .single();
  if (orgAErr || !orgA) throw new Error(`create org A: ${orgAErr?.message}`);
  orgAId = orgA.id;
  created.orgIds.push(orgAId);

  const { data: orgB, error: orgBErr } = await admin
    .from("organizations")
    .insert({ name: `${FIXTURE_PREFIX} B ${stamp}`, description: "Throwaway fixture for orgApplicantIsolation.integration.test.ts" })
    .select("id")
    .single();
  if (orgBErr || !orgB) throw new Error(`create org B: ${orgBErr?.message}`);
  orgBId = orgB.id;
  created.orgIds.push(orgBId);

  await admin.from("organization_accounts").insert([
    { user_id: orgAUserId, organization_id: orgAId },
    { user_id: orgBUserId, organization_id: orgBId },
  ]);

  const { data: opp, error: oppErr } = await admin
    .from("opportunities")
    .insert({
      organization_id: orgAId,
      title: `${FIXTURE_PREFIX} opportunity ${stamp}`,
      description: "Throwaway fixture opportunity.",
      category: "Community Service",
      minimum_age: 13,
      commitment_type: "one_time",
      source: "manual",
    })
    .select("id")
    .single();
  if (oppErr || !opp) throw new Error(`create opportunity: ${oppErr?.message}`);
  oppId = opp.id;

  const { data: appliedRow, error: appliedErr } = await admin
    .from("applications")
    .insert({ user_id: studentUserId, opportunity_id: oppId, status: "applied" })
    .select("id")
    .single();
  if (appliedErr || !appliedRow) throw new Error(`create applied application: ${appliedErr?.message}`);
  appliedApplicationId = appliedRow.id;

  // A second, distinct opportunity so the 'saved' fixture doesn't
  // collide with the applications_user_opportunity_idx unique index
  // (one row per user+opportunity) against the 'applied' one above.
  const { data: opp2, error: opp2Err } = await admin
    .from("opportunities")
    .insert({
      organization_id: orgAId,
      title: `${FIXTURE_PREFIX} opportunity 2 (bookmark-only) ${stamp}`,
      description: "Throwaway fixture opportunity for the 'saved' exclusion case.",
      category: "Community Service",
      minimum_age: 13,
      commitment_type: "one_time",
      source: "manual",
    })
    .select("id")
    .single();
  if (opp2Err || !opp2) throw new Error(`create opportunity 2: ${opp2Err?.message}`);

  const { data: savedRow, error: savedErr } = await admin
    .from("applications")
    .insert({ user_id: studentUserId, opportunity_id: opp2.id, status: "saved" })
    .select("id")
    .single();
  if (savedErr || !savedRow) throw new Error(`create saved application: ${savedErr?.message}`);
  savedApplicationId = savedRow.id;

  async function signIn(email: string) {
    const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`signIn(${email}): ${error.message}`);
    return client;
  }
  orgAClient = await signIn(orgAUser.email!);
  orgBClient = await signIn(orgBUser.email!);
});

describe("org applicant cross-organization isolation", () => {
  it("lets an org read applications for its own opportunities", async () => {
    const { data, error } = await orgAClient
      .from("applications")
      .select("id, status, opportunity_id")
      .eq("opportunity_id", oppId)
      .neq("status", "saved");
    expect(error).toBeNull();
    expect(data).toEqual([expect.objectContaining({ id: appliedApplicationId, status: "applied" })]);
  });

  it("never returns another organization's applicants to the same query", async () => {
    const { data, error } = await orgBClient
      .from("applications")
      .select("id, status, opportunity_id")
      .eq("opportunity_id", oppId)
      .neq("status", "saved");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("excludes 'saved' (bookmark-only) rows even for the applicant's own org", async () => {
    // Same query the app route runs (.neq("status", "saved")) — proves
    // the exclusion, not just that RLS scoping works.
    const { data, error } = await orgAClient
      .from("applications")
      .select("id")
      .eq("id", savedApplicationId)
      .neq("status", "saved");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("returns zero opportunities (and so zero applicants) for an org with none", async () => {
    // Mirrors app/api/org/applicants/route.ts's own early-return path:
    // an org with no opportunities never even reaches the applications
    // query — oppIds.length === 0 short-circuits to { applicants: [] }.
    const { data, error } = await orgBClient
      .from("opportunities")
      .select("id")
      .eq("organization_id", orgBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("lets an org move its own applicant's status forward via the RPC", async () => {
    const { error } = await orgAClient.rpc("org_update_application_status", {
      application_id: appliedApplicationId,
      new_status: "accepted",
    });
    expect(error).toBeNull();

    const { data } = await admin.from("applications").select("status").eq("id", appliedApplicationId).single();
    expect(data?.status).toBe("accepted");
  });

  it("rejects a cross-organization status-update attempt via the RPC", async () => {
    const { error } = await orgBClient.rpc("org_update_application_status", {
      application_id: appliedApplicationId,
      new_status: "completed",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not authorized/i);

    // Confirm the rejected call had zero effect.
    const { data } = await admin.from("applications").select("status").eq("id", appliedApplicationId).single();
    expect(data?.status).toBe("accepted");
  });

  it("has no raw UPDATE policy bypassing the RPC, even for the applicant's own org", async () => {
    const { data } = await orgAClient
      .from("applications")
      .update({ status: "completed" })
      .eq("id", appliedApplicationId)
      .select("id");
    // A permissive UPDATE policy would return the updated row; none
    // exists, so PostgREST reports zero rows matched/changed.
    expect(data).toEqual([]);

    const { data: unchanged } = await admin.from("applications").select("status").eq("id", appliedApplicationId).single();
    expect(unchanged?.status).toBe("accepted");
  });

  it("removes all fixture data and leaves no residue", async () => {
    const { error: oppDeleteErr } = await admin.from("opportunities").delete().eq("organization_id", orgAId);
    expect(oppDeleteErr).toBeNull();

    const { error: orgDeleteErr } = await admin.from("organizations").delete().in("id", [orgAId, orgBId]);
    expect(orgDeleteErr).toBeNull();
    created.orgIds = [];

    for (const userId of [orgAUserId, orgBUserId, studentUserId]) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      expect(error).toBeNull();
    }
    created.userIds = [];

    const { data: orgsLeft } = await admin.from("organizations").select("id").in("id", [orgAId, orgBId]);
    const { data: appsLeft } = await admin
      .from("applications")
      .select("id")
      .in("id", [appliedApplicationId, savedApplicationId]);
    expect(orgsLeft).toEqual([]);
    expect(appsLeft).toEqual([]);
  });
});

afterAll(async () => {
  // Safety net only — the last `it()` above already deletes and
  // verifies everything in the success path. This only does real work
  // if an earlier assertion threw before that test ran to completion.
  await bestEffortCleanup();
});
