// Critical-path e2e test: org signup -> onboarding -> post an
// opportunity -> review and accept an applicant. The "applicant" is
// seeded directly via the service role (a throwaway student account with
// an 'applied' application row) rather than driven through a second full
// browser session — the student side of this flow is already covered end
// to end by student-workflow.spec.ts, so this test's job is proving the
// org-side review/accept path, not re-proving how an application gets
// created.
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../loadEnv";

loadEnvLocal();

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const stamp = Date.now();
const orgUserEmail = `__test__-e2e-org-${stamp}@example.com`;
const orgUserPassword = "E2eTest-Pw-2026!";
const orgName = `__test__ E2E Org-Flow Org ${stamp}`;
const opportunityTitle = `__test__ E2E Org-Flow Opportunity ${stamp}`;
const applicantEmail = `__test__-e2e-applicant-${stamp}@example.com`;

let orgUserId: string | undefined;
let orgId: string | undefined;
let opportunityId: string | undefined;
let applicantUserId: string | undefined;
let applicationId: string | undefined;

test.describe("Organization critical workflow", () => {
  test.afterAll(async () => {
    const admin = adminClient();
    if (applicationId) await admin.from("applications").delete().eq("id", applicationId);
    if (applicantUserId) await admin.auth.admin.deleteUser(applicantUserId);
    if (opportunityId) await admin.from("opportunities").delete().eq("id", opportunityId);
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    if (orgUserId) await admin.auth.admin.deleteUser(orgUserId);
  });

  test("signup, onboarding, post an opportunity, review and accept an applicant", async ({ page }) => {
    // Signup as an organization
    await page.goto("/login");
    await page.getByRole("button", { name: "Organization" }).click();
    await page.fill("#login-email", orgUserEmail);
    await page.fill("#login-password", orgUserPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/onboarding\/organization$/, { timeout: 15000 });

    // Organization onboarding
    await page.fill("#org-onboarding-name", orgName);
    await page.fill("#org-onboarding-description", "A seeded org for the e2e org workflow test.");
    await page.getByRole("button", { name: "Create organization" }).click();

    await page.waitForURL(/\/org-dashboard$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    const admin = adminClient();
    const { data: users } = await admin.auth.admin.listUsers();
    orgUserId = users.users.find((u) => u.email === orgUserEmail)?.id;
    expect(orgUserId).toBeTruthy();

    const { data: org } = await admin.from("organizations").select("id").eq("name", orgName).single();
    orgId = org?.id;
    expect(orgId).toBeTruthy();

    // Post an opportunity via the real form
    await page.fill("#org-dashboard-opp-title", opportunityTitle);
    await page.fill("#org-dashboard-opp-description", "A seeded opportunity for the e2e org workflow test.");
    await page.fill("#org-dashboard-opp-min-age", "13");
    await page.getByRole("button", { name: "Add opportunity" }).click();
    await expect(page.getByText("Opportunity added!")).toBeVisible({ timeout: 10000 });

    const { data: opp } = await admin
      .from("opportunities")
      .select("id")
      .eq("organization_id", orgId!)
      .eq("title", opportunityTitle)
      .single();
    opportunityId = opp?.id;
    expect(opportunityId).toBeTruthy();

    // Seed an applicant directly — the student side of applying is
    // already covered by student-workflow.spec.ts
    const { data: applicant, error: applicantErr } = await admin.auth.admin.createUser({
      email: applicantEmail,
      password: "E2eTest-Pw-2026!",
      email_confirm: true,
    });
    if (applicantErr || !applicant.user) throw new Error(`Couldn't create test applicant: ${applicantErr?.message}`);
    applicantUserId = applicant.user.id;
    await admin.from("user_roles").insert({ user_id: applicantUserId, role: "student" });

    const { data: application, error: applicationErr } = await admin
      .from("applications")
      .insert({ user_id: applicantUserId, opportunity_id: opportunityId!, status: "applied" })
      .select("id")
      .single();
    if (applicationErr || !application) throw new Error(`Couldn't seed test application: ${applicationErr?.message}`);
    applicationId = application.id;

    // Review and accept the applicant
    await page.reload();
    await page.waitForLoadState("networkidle");

    const applicantRow = page.locator("div.p-4.flex.flex-col.gap-2", { hasText: opportunityTitle });
    await expect(applicantRow).toBeVisible({ timeout: 10000 });
    await expect(applicantRow.getByText(applicantEmail)).toBeVisible();

    await applicantRow.getByRole("button", { name: "Mark as Accepted" }).click();
    await expect(applicantRow.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 10000 });

    const { data: updatedApplication } = await admin
      .from("applications")
      .select("status")
      .eq("id", applicationId)
      .single();
    expect(updatedApplication?.status).toBe("accepted");
  });
});
