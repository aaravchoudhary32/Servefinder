// Regression test for the ingestion-infrastructure staging gate: a
// `review_status: 'pending'` opportunity must be invisible to the
// public (anonymous) client and to a real student's session, visible
// to the service role (used by connectors/admin tooling), and must
// become visible to the public the moment it's approved. Also proves
// the specific Special Olympics Arizona duplicate-title pattern
// (multiple real calendar sessions sharing one title) cannot recreate
// itself as a literal (source, external_id) collision on a reseed —
// the actual guarantee that batch's fix depends on.
//
// Real integration test against the live Supabase project, same
// reasoning as orgApplicantIsolation.integration.test.ts: the guarantee
// lives entirely in the "Public can read approved opportunities..." RLS
// policy (supabase/add_ingestion_source_registry_and_staging.sql), not
// in any TypeScript logic — a hand-written reimplementation would test
// a copy, not the real thing. Excluded from `npm test`/CI; run by hand
// with `npm run test:integration`.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findDuplicate, type ExistingListing } from "../../lib/ingestion/normalize";

const FIXTURE_PREFIX = "__test__ staging-visibility";
const PASSWORD = "Integration-Test-Pw-2026!";

let admin: SupabaseClient;
let anon: SupabaseClient;
let studentClient: SupabaseClient;

let studentUserId: string;
let verifiedOrgId: string;
let pendingOppId: string;

const created = { userIds: [] as string[], oppIds: [] as string[] };

async function bestEffortCleanup() {
  for (const oppId of created.oppIds) {
    await admin.from("opportunities").delete().eq("id", oppId).then(
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

  admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  anon = createClient(supabaseUrl, anonKey);

  const stamp = Date.now();
  const email = `${FIXTURE_PREFIX.replace(/\s+/g, "-")}-${stamp}@example.com`;
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr || !userData.user) throw new Error(`createUser: ${userErr?.message}`);
  studentUserId = userData.user.id;
  created.userIds.push(studentUserId);
  await admin.from("user_roles").insert({ user_id: studentUserId, role: "student" });
  await admin.from("profiles").insert({
    user_id: studentUserId,
    age: 16,
    city: "Phoenix",
    zip_code: "85001",
    interests: ["community"],
    skills: [],
    availability: [],
  });

  studentClient = createClient(supabaseUrl, anonKey);
  const { error: signInErr } = await studentClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);

  const { data: org } = await admin.from("organizations").select("id").eq("verified", true).limit(1).single();
  if (!org) throw new Error("No verified organization exists to attach the fixture opportunity to.");
  verifiedOrgId = org.id;
});

describe("Staging visibility (opportunities.review_status)", () => {
  it("creates a pending opportunity under a real, verified org", async () => {
    const { data, error } = await admin
      .from("opportunities")
      .insert({
        organization_id: verifiedOrgId,
        title: `${FIXTURE_PREFIX} pending probe`,
        description: "Throwaway row proving the staging RLS gate.",
        category: "Community Service",
        minimum_age: 13,
        commitment_type: "one_time",
        source: "manual",
        review_status: "pending",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    pendingOppId = data!.id;
    created.oppIds.push(pendingOppId);
  });

  it("is invisible to an anonymous (public) client", async () => {
    const { data } = await anon.from("opportunities").select("id").eq("id", pendingOppId);
    expect(data).toEqual([]);
  });

  it("is invisible to a real logged-in student's own session", async () => {
    const { data } = await studentClient.from("opportunities").select("id").eq("id", pendingOppId);
    expect(data).toEqual([]);
  });

  it("is visible to the service role (what connectors/admin tooling use)", async () => {
    const { data } = await admin.from("opportunities").select("id, review_status").eq("id", pendingOppId).single();
    expect(data?.review_status).toBe("pending");
  });

  it("becomes visible to the public the moment it's approved, with no other field required to change", async () => {
    const { error } = await admin.from("opportunities").update({ review_status: "approved" }).eq("id", pendingOppId);
    expect(error).toBeNull();

    const { data: anonSees } = await anon.from("opportunities").select("id").eq("id", pendingOppId);
    expect(anonSees).toHaveLength(1);

    const { data: studentSees } = await studentClient.from("opportunities").select("id").eq("id", pendingOppId);
    expect(studentSees).toHaveLength(1);
  });

  it("goes invisible again if rejected after having been approved", async () => {
    const { error } = await admin.from("opportunities").update({ review_status: "rejected" }).eq("id", pendingOppId);
    expect(error).toBeNull();

    const { data: anonSees } = await anon.from("opportunities").select("id").eq("id", pendingOppId);
    expect(anonSees).toEqual([]);
  });
});

describe("Duplicate-prevention regression (Special Olympics Arizona pattern)", () => {
  // Two fixes landed for this pattern, in two batches: the ingestion-
  // infrastructure batch gave every session a distinguishable,
  // date-suffixed title (a display fix); the accelerated-catalog-growth
  // batch fixed the underlying dedup mechanism itself, so a genuinely
  // new session is no longer at risk of being incorrectly fuzzy-matched
  // against an existing different-date session in the first place. This
  // suite proves both properties hold: two sessions with the same base
  // title but different dates are NOT flagged as duplicates of each
  // other, and the live catalog has zero true (source, external_id)
  // collisions anywhere.
  // FIXED (accelerated-catalog-growth batch): findDuplicate() now also
  // takes applicationDeadline/location/applicationUrl into account —
  // when a candidate's external_id doesn't match anything in `existing`
  // (a genuinely new session), a real, differing date on both sides now
  // vetoes the fuzzy title match instead of letting title similarity
  // alone decide. See lib/ingestion/normalize.test.ts's "material-
  // difference dedup fix" suite for the full unit-level coverage; this
  // integration test exists specifically to prove the fix holds against
  // the real, live data shape (real ExistingListing rows carrying real
  // applicationDeadline values from the actual Special Olympics Arizona
  // catalog), not just a hand-built fixture.
  it("a genuinely new session is NOT incorrectly matched against an existing different-date session, now that dates are compared", async () => {
    const { data: existingRows } = await admin
      .from("opportunities")
      .select("id, source, external_id, title, application_url, application_deadline, location, organizations(name)")
      .eq("source", "special_olympics_az");
    const existing: ExistingListing[] = (existingRows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      source: row.source as string,
      external_id: row.external_id as string | null,
      title: row.title as string,
      organizationName: (row.organizations as { name: string } | null)?.name ?? null,
      applicationUrl: row.application_url as string | null,
      applicationDeadline: row.application_deadline as string | null,
      location: row.location as string | null,
    }));
    expect(existing.length).toBeGreaterThan(0); // sanity check the real catalog has this source's rows

    // A brand-new "Bocce Competition (Yuma)" session on a date none of
    // the real existing rows carry, with a genuinely new external_id.
    const candidate = {
      source: "special_olympics_az",
      external_id: `__test__-genuinely-new-${Date.now()}`,
      title: "Bocce Competition (Yuma) — Dec 25, 2026",
      organizationName: "Special Olympics Arizona",
      applicationDeadline: "2026-12-25",
      location: "Yuma",
    };
    const match = findDuplicate(candidate, existing);
    expect(match).toBeNull();
  });

  it("the same external_id IS correctly treated as a duplicate (update path, not a new row)", () => {
    const existing: ExistingListing[] = [
      { id: "existing-1", source: "special_olympics_az", external_id: "guid-a", title: "Bocce Competition (Yuma) — Oct 3, 2026", organizationName: "Special Olympics Arizona" },
    ];
    const candidate = {
      source: "special_olympics_az",
      external_id: "guid-a",
      title: "Bocce Competition (Yuma) — Oct 3, 2026",
      organizationName: "Special Olympics Arizona",
    };
    const match = findDuplicate(candidate, existing);
    expect(match?.reason).toBe("external_id");
    expect(match?.existingId).toBe("existing-1");
  });

  it("the live catalog has zero true (source, external_id) collisions anywhere — the dedup guarantee actually holds in production, not just in a unit test", async () => {
    const { data } = await admin.from("opportunities").select("source, external_id").not("external_id", "is", null);
    const seen = new Map<string, number>();
    for (const row of data ?? []) {
      const key = `${row.source}::${row.external_id}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const collisions = [...seen.entries()].filter(([, count]) => count > 1);
    expect(collisions).toEqual([]);
  });

  it("removes all fixture data and leaves no residue", async () => {
    const { error: oppErr } = await admin.from("opportunities").delete().in("id", created.oppIds);
    expect(oppErr).toBeNull();
    created.oppIds = [];

    for (const userId of created.userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      expect(error).toBeNull();
    }
    created.userIds = [];
  });
});

afterAll(async () => {
  // Safety net only — the last `it()` above already deletes and
  // verifies everything in the success path.
  await bestEffortCleanup();
});
