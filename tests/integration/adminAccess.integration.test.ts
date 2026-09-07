// Regression test for the guarantee /admin/* pages and the Admin nav
// link depend on: admin-only actions are enforced by Postgres RLS
// against the `admins` membership table (supabase/schema.sql), never by
// a hardcoded email or role check in application code. Client-side
// checks (NavBar's isAdmin state, each /admin/* page's own "Admin
// access required" screen) are a UX convenience only — this test
// proves the real boundary, the database, independently rejects every
// non-admin caller regardless of what any client renders.
//
// Real integration test against the live Supabase project (RLS lives in
// Postgres, not TypeScript — see orgApplicantIsolation.integration.test.ts's
// header for why a hand-written reimplementation wouldn't test the real
// thing). Excluded from `npm test`/CI; run by hand via `npm run
// test:integration`.
//
// `organizations` is used as the admin-only-write probe (not
// `opportunities`) because org reps also have a legitimate, narrower
// insert/update policy on `opportunities` scoped to their own
// organization_id — updating a THIRD PARTY's `organizations` row has no
// legitimate path for any role except admin, so a rejection here can
// only mean the admin gate is working, not some other unrelated policy
// coincidentally blocking the write. `error_log` (admin-only select) is
// used as the admin-only-read probe for the same reason.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FIXTURE_PREFIX = "__test__ admin-access";
const PASSWORD = "Integration-Test-Pw-2026!";

let admin: SupabaseClient; // service role — fixture setup/teardown only
let adminUserClient: SupabaseClient; // real admins-table member
let studentClient: SupabaseClient;
let orgClient: SupabaseClient;
let unknownRoleClient: SupabaseClient; // session exists, no user_roles row at all
let anonClient: SupabaseClient; // no session

let targetOrgId: string;
let errorLogId: string;

const created = {
  userIds: [] as string[],
  orgIds: [] as string[],
  errorLogIds: [] as string[],
};

async function bestEffortCleanup() {
  for (const id of created.errorLogIds) {
    await admin.from("error_log").delete().eq("id", id).then(
      () => {},
      () => {}
    );
  }
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

  const adminAuthUser = await createUser("admin");
  const studentUser = await createUser("student");
  const orgUser = await createUser("org");
  const unknownRoleUser = await createUser("unknown-role");

  await admin.from("user_roles").insert([
    { user_id: adminAuthUser.id, role: "student" }, // admin status is independent of user_roles — see below
    { user_id: studentUser.id, role: "student" },
    { user_id: orgUser.id, role: "organization" },
    // unknownRoleUser deliberately gets NO user_roles row — this is the
    // "unknown role" case the admin gate must still default to no
    // access for, not error out or fail open on.
  ]);

  // The one and only DB write this test performs: granting a THROWAWAY
  // test account admin membership, exactly the same insert a real admin
  // would make by hand in the SQL editor per supabase/schema.sql's own
  // documented process. Never touches the real admins table's actual
  // production row.
  const { error: grantErr } = await admin.from("admins").insert({ user_id: adminAuthUser.id });
  if (grantErr) throw new Error(`grant test admin: ${grantErr.message}`);

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `${FIXTURE_PREFIX} target org ${stamp}`, description: "Throwaway fixture.", verified: false })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`create target org: ${orgErr?.message}`);
  targetOrgId = org.id;
  created.orgIds.push(targetOrgId);

  const { data: orgAccount, error: orgAccountErr } = await admin
    .from("organizations")
    .insert({ name: `${FIXTURE_PREFIX} org-user's own org ${stamp}`, description: "Throwaway fixture." })
    .select("id")
    .single();
  if (orgAccountErr || !orgAccount) throw new Error(`create org-user's org: ${orgAccountErr?.message}`);
  created.orgIds.push(orgAccount.id);
  await admin.from("organization_accounts").insert({ user_id: orgUser.id, organization_id: orgAccount.id });

  const { data: errorLogRow, error: errorLogErr } = await admin
    .from("error_log")
    .insert({ route: "/test/admin-access-fixture", message: `${FIXTURE_PREFIX} ${stamp}`, context: {} })
    .select("id")
    .single();
  if (errorLogErr || !errorLogRow) throw new Error(`create error_log fixture: ${errorLogErr?.message}`);
  errorLogId = errorLogRow.id;
  created.errorLogIds.push(errorLogId);

  async function signIn(email: string) {
    const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`signIn(${email}): ${error.message}`);
    return client;
  }
  adminUserClient = await signIn(adminAuthUser.email!);
  studentClient = await signIn(studentUser.email!);
  orgClient = await signIn(orgUser.email!);
  unknownRoleClient = await signIn(unknownRoleUser.email!);
  anonClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
});

describe("admin access is enforced by the database, independent of any client-side role check", () => {
  it("lets the verified admin update a third party's organization row", async () => {
    const { data, error } = await adminUserClient
      .from("organizations")
      .update({ verified: true })
      .eq("id", targetOrgId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: targetOrgId }]);

    const { data: confirmed } = await admin.from("organizations").select("verified").eq("id", targetOrgId).single();
    expect(confirmed?.verified).toBe(true);
  });

  it("lets the verified admin read error_log", async () => {
    const { data, error } = await adminUserClient.from("error_log").select("id").eq("id", errorLogId);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: errorLogId }]);
  });

  it("rejects a student account's attempt to update another organization's row", async () => {
    const { data, error } = await studentClient
      .from("organizations")
      .update({ verified: false })
      .eq("id", targetOrgId)
      .select("id");
    // No permissive UPDATE policy matches a student, so PostgREST
    // reports zero rows matched/changed rather than an explicit error —
    // same convention as opportunities/applications elsewhere in this
    // schema.
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: unchanged } = await admin.from("organizations").select("verified").eq("id", targetOrgId).single();
    expect(unchanged?.verified).toBe(true); // still what the admin set above — the student's write had zero effect
  });

  it("rejects a student account's attempt to read error_log", async () => {
    const { data, error } = await studentClient.from("error_log").select("id").eq("id", errorLogId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects an organization account's attempt to update another organization's row", async () => {
    const { data, error } = await orgClient
      .from("organizations")
      .update({ verified: false })
      .eq("id", targetOrgId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: unchanged } = await admin.from("organizations").select("verified").eq("id", targetOrgId).single();
    expect(unchanged?.verified).toBe(true);
  });

  it("rejects an organization account's attempt to read error_log", async () => {
    const { data, error } = await orgClient.from("error_log").select("id").eq("id", errorLogId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects a logged-in account with no user_roles row at all ('unknown' role)", async () => {
    const { data: writeData, error: writeError } = await unknownRoleClient
      .from("organizations")
      .update({ verified: false })
      .eq("id", targetOrgId)
      .select("id");
    expect(writeError).toBeNull();
    expect(writeData).toEqual([]);

    const { data: readData, error: readError } = await unknownRoleClient
      .from("error_log")
      .select("id")
      .eq("id", errorLogId);
    expect(readError).toBeNull();
    expect(readData).toEqual([]);
  });

  it("rejects a logged-out (anonymous, no session) caller", async () => {
    const { data: writeData, error: writeError } = await anonClient
      .from("organizations")
      .update({ verified: false })
      .eq("id", targetOrgId)
      .select("id");
    expect(writeError).toBeNull();
    expect(writeData).toEqual([]);

    const { data: readData, error: readError } = await anonClient.from("error_log").select("id").eq("id", errorLogId);
    expect(readError).toBeNull();
    expect(readData).toEqual([]);

    const { data: finalState } = await admin.from("organizations").select("verified").eq("id", targetOrgId).single();
    expect(finalState?.verified).toBe(true); // unchanged by any of the rejected attempts above
  });

  it("removes all fixture data, including the throwaway admin grant, and leaves no residue", async () => {
    for (const id of created.errorLogIds) {
      const { error } = await admin.from("error_log").delete().eq("id", id);
      expect(error).toBeNull();
    }
    created.errorLogIds = [];

    for (const orgId of created.orgIds) {
      const { error } = await admin.from("organizations").delete().eq("id", orgId);
      expect(error).toBeNull();
    }
    created.orgIds = [];

    for (const userId of created.userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      expect(error).toBeNull();
    }
    created.userIds = [];

    const { data: orgsLeft } = await admin.from("organizations").select("id").eq("id", targetOrgId);
    const { data: errorsLeft } = await admin.from("error_log").select("id").eq("id", errorLogId);
    expect(orgsLeft).toEqual([]);
    expect(errorsLeft).toEqual([]);
  });
});

afterAll(async () => {
  // Safety net only — the last `it()` above already deletes and
  // verifies everything in the success path.
  await bestEffortCleanup();
});
