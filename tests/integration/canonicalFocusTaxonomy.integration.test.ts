// Regression test for the live database guarantee
// supabase/add_canonical_focus_taxonomy.sql is supposed to have put in
// place: profiles.interests's CHECK constraint must accept every value
// in lib/interestTaxonomy.ts's ALL_VALID_INTEREST_VALUES (new canonical
// broad tags/focuses, legacy aliases, and retired values alike), while
// still rejecting a value that was never part of that taxonomy.
//
// Real integration test against the live Supabase project, same
// reasoning as orgApplicantIsolation.integration.test.ts and
// stagingVisibility.integration.test.ts: the guarantee lives entirely in
// a Postgres CHECK constraint, not in any TypeScript logic — a
// hand-written reimplementation would test a copy, not the real thing,
// and could silently drift from what's actually deployed. Excluded from
// `npm test`/CI; run by hand with `npm run test:integration`.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ALL_VALID_INTEREST_VALUES } from "../../lib/interestTaxonomy";

const FIXTURE_PREFIX = "__test__ canonical-focus-taxonomy";
const PASSWORD = "Integration-Test-Pw-2026!";

let admin: SupabaseClient;
let studentUserId: string;

const created = { userIds: [] as string[] };

async function bestEffortCleanup() {
  for (const userId of created.userIds) {
    await admin.auth.admin.deleteUser(userId).then(
      () => {},
      () => {}
    );
  }
}

beforeAll(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

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
});

describe("profiles.interests CHECK constraint — canonical focus taxonomy", () => {
  it("accepts a profile carrying a new canonical broad tag (government_law) and focus (medicine_physician)", async () => {
    const { error } = await admin.from("profiles").insert({
      user_id: studentUserId,
      age: 16,
      city: "Phoenix",
      zip_code: "85001",
      interests: ["government_law", "medicine_physician", "healthcare"],
      skills: [],
      availability: [],
    });
    expect(error).toBeNull();
  });

  it("accepts every single value in ALL_VALID_INTEREST_VALUES (new canonical, legacy alias, and retired values alike), one update at a time", async () => {
    for (const value of ALL_VALID_INTEREST_VALUES) {
      const { error } = await admin.from("profiles").update({ interests: [value] }).eq("user_id", studentUserId);
      expect(error, `value "${value}" should be accepted by the live CHECK constraint`).toBeNull();
    }
  });

  it("still rejects a value that was never part of the taxonomy (the constraint wasn't accidentally widened to accept anything)", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ interests: ["not_a_real_focus_value_xyz"] })
      .eq("user_id", studentUserId);
    expect(error).not.toBeNull();
  });

  it("removes all fixture data and leaves no residue", async () => {
    const { error } = await admin.auth.admin.deleteUser(studentUserId);
    expect(error).toBeNull();
    created.userIds = [];
  });
});

afterAll(async () => {
  // Safety net only — the last `it()` above already deletes and
  // verifies everything in the success path.
  await bestEffortCleanup();
});
