// Runs once before either the a11y or e2e Playwright suite. Creates two
// throwaway accounts — a student (also granted admin, so /admin doesn't
// need a third account) and an org rep — via the service role, the same
// __test__-prefixed pattern every live-verification script this project
// has used, then logs each into the real UI once and saves the resulting
// storageState so individual specs can start already authenticated
// instead of each re-running the login flow. global-teardown.ts deletes
// everything created here.
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import path from "path";
import { loadEnvLocal } from "./loadEnv";

const PASSWORD = "PlaywrightTest-Pw-2026!";

export default async function globalSetup() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local — the a11y/e2e suites need the service role key to create and clean up throwaway test accounts, same as npm run test:integration."
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();

  const { data: student, error: studentErr } = await admin.auth.admin.createUser({
    email: `__test__-a11y-student-${stamp}@example.com`,
    password: PASSWORD,
    email_confirm: true,
  });
  if (studentErr || !student.user) throw new Error(`Couldn't create test student: ${studentErr?.message}`);
  await admin.from("user_roles").insert({ user_id: student.user.id, role: "student" });
  await admin.from("profiles").insert({
    user_id: student.user.id,
    age: 16,
    city: "Phoenix",
    zip_code: "85001",
    interests: ["community"],
    skills: [],
    availability: [],
  });
  await admin.from("admins").insert({ user_id: student.user.id });

  const { data: orgUser, error: orgUserErr } = await admin.auth.admin.createUser({
    email: `__test__-a11y-org-${stamp}@example.com`,
    password: PASSWORD,
    email_confirm: true,
  });
  if (orgUserErr || !orgUser.user) throw new Error(`Couldn't create test org user: ${orgUserErr?.message}`);
  await admin.from("user_roles").insert({ user_id: orgUser.user.id, role: "organization" });
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `__test__ Playwright Org ${stamp}` })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`Couldn't create test organization: ${orgErr?.message}`);
  await admin.from("organization_accounts").insert({ user_id: orgUser.user.id, organization_id: org.id });

  const fixturePath = path.join(process.cwd(), "tests/.a11y-fixture.json");
  writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        stamp,
        studentUserId: student.user.id,
        studentEmail: student.user.email,
        orgUserId: orgUser.user.id,
        orgId: org.id,
        orgEmail: orgUser.user.email,
      },
      null,
      2
    )
  );

  const baseURL = "http://localhost:3000";
  // Same mac13-arm64 fallback as playwright.config.ts's project — see
  // lib/ingestion/sources/cityOfPhoenix.ts for the same pattern.
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());

  async function loginAndSaveState(email: string, storagePath: string) {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/login`);
    await page.click("text=Already have an account? Log in");
    await page.fill("#login-email", email);
    await page.fill("#login-password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
    await page.context().storageState({ path: path.join(process.cwd(), storagePath) });
    await page.close();
  }

  await loginAndSaveState(student.user.email!, "tests/.storage-student.json");
  await loginAndSaveState(orgUser.user.email!, "tests/.storage-org.json");

  await browser.close();
}
