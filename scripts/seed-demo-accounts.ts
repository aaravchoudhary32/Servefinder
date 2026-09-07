// Creates two demo accounts — a student and an org rep — in YOUR OWN
// Supabase project, for local development or your own deployment. Run
// with `npm run seed:demo-accounts`, AFTER supabase/seed.sql (the demo
// org rep is linked to "Downtown Public Library", one of seed.sql's
// seeded organizations).
//
// Idempotent: safe to re-run. If a demo account already exists, its
// password is reset to whatever DEMO_STUDENT_PASSWORD/DEMO_ORG_PASSWORD
// currently say (in case it was ever changed) rather than erroring, and
// the profile/org-link steps are skipped if already in place.
//
// Passwords are read from your own .env.local, never hardcoded here —
// choose your own values, and don't publish them anywhere either.

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const studentPassword = process.env.DEMO_STUDENT_PASSWORD;
const orgPassword = process.env.DEMO_ORG_PASSWORD;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!studentPassword || !orgPassword) {
  console.error(
    "Missing DEMO_STUDENT_PASSWORD / DEMO_ORG_PASSWORD in .env.local — choose your own values " +
      "(these become the login passwords for the two demo accounts this script creates in your " +
      "own Supabase project) and add them there before running this script."
  );
  process.exit(1);
}

export const DEMO_STUDENT_EMAIL = "demo-student@servefinder.dev";
export const DEMO_ORG_EMAIL = "demo-org@servefinder.dev";
const DEMO_ORG_NAME = "Downtown Public Library"; // seeded by supabase/seed.sql

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUserByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`Couldn't list users: ${error.message}`);
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(email: string, password: string): Promise<string> {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(`Couldn't reset password for ${email}: ${error.message}`);
    console.log(`Demo user ${email} already exists — password reset to the configured value.`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Couldn't create ${email}: ${error?.message}`);
  console.log(`Created demo user ${email}.`);
  return data.user.id;
}

async function main() {
  // Student
  const studentId = await ensureUser(DEMO_STUDENT_EMAIL, studentPassword!);
  await supabase.from("user_roles").upsert({ user_id: studentId, role: "student" });
  await supabase.from("profiles").upsert({
    user_id: studentId,
    age: 16,
    city: "Columbus",
    zip_code: "43215",
    max_distance_miles: 15,
    interests: ["stem", "environment", "community", "animals"],
    skills: ["tutoring"],
    availability: ["saturday_morning", "weekday_afternoon"],
    commitment_preference: "either",
  });
  console.log("Demo student profile ready.");

  // Org rep — linked to one of seed.sql's organizations so the demo
  // account has real opportunities to manage/review applicants for.
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", DEMO_ORG_NAME)
    .maybeSingle();
  if (orgError || !org) {
    throw new Error(
      `Couldn't find organization "${DEMO_ORG_NAME}" — run supabase/seed.sql first, then re-run this script.`
    );
  }

  const orgUserId = await ensureUser(DEMO_ORG_EMAIL, orgPassword!);
  await supabase.from("user_roles").upsert({ user_id: orgUserId, role: "organization" });
  await supabase.from("organization_accounts").upsert({ user_id: orgUserId, organization_id: org.id });
  console.log(`Demo org rep linked to "${DEMO_ORG_NAME}".`);

  console.log("\nDemo accounts ready:");
  console.log(`  Student: ${DEMO_STUDENT_EMAIL}`);
  console.log(`  Organization: ${DEMO_ORG_EMAIL}`);
}

main().catch((err) => {
  console.error("Demo account seeding failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
