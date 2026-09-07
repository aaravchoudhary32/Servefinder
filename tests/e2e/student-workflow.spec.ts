// Critical-path e2e test: signup -> onboarding -> view/save/apply.
// Formalizes the ad hoc Playwright verification scripts used throughout
// this project's development into a real, committed, repeatable test
// instead of a throwaway .mjs file. Creates and cleans up its own
// throwaway account and seed data — does not reuse tests/global-setup.ts's
// fixture accounts, since the point here is proving the real signup +
// onboarding UI flow works end to end, not skipping past it.
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
const studentEmail = `__test__-e2e-student-${stamp}@example.com`;
const studentPassword = "E2eTest-Pw-2026!";
const orgName = `__test__ E2E Student-Flow Org ${stamp}`;
const opportunityTitle = `__test__ E2E Opportunity ${stamp}`;

let orgId: string;
let opportunityId: string;
let studentUserId: string | undefined;

test.describe("Student critical workflow", () => {
  test.beforeAll(async () => {
    const admin = adminClient();
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: orgName, verified: true }) // orgs default to unverified (Phase 6) and unverified orgs' opportunities aren't publicly visible — this test needs the student to actually see it
      .select("id")
      .single();
    if (orgError || !org) throw new Error(`Couldn't seed test org: ${orgError?.message}`);
    orgId = org.id;

    const { data: opp, error: oppError } = await admin
      .from("opportunities")
      .insert({
        organization_id: orgId,
        title: opportunityTitle,
        description: "A seeded opportunity for the student e2e workflow test.",
        category: "Community Service",
        minimum_age: 13,
        commitment_type: "one_time",
        interests_tags: ["community"],
        // Real coordinates matching what api.zippopotam.us actually
        // resolves ZIP 85001 to (confirmed live: 33.704, -112.3518 —
        // notably NOT the same as "downtown Phoenix," which is ~24
        // miles away and outside the default 10-mile max_distance_miles
        // radius, and was this test's original bug). An in_person
        // opportunity (the default delivery_mode) with no coordinates
        // is correctly excluded from ranked matching (see
        // lib/matching.ts's isWithinRange), so this test needs a
        // genuinely locatable, in-range opportunity to represent a
        // realistic "student sees a nearby opportunity" scenario.
        latitude: 33.704,
        longitude: -112.3518,
      })
      .select("id")
      .single();
    if (oppError || !opp) throw new Error(`Couldn't seed test opportunity: ${oppError?.message}`);
    opportunityId = opp.id;
  });

  test.afterAll(async () => {
    const admin = adminClient();
    if (studentUserId) {
      await admin.from("applications").delete().eq("user_id", studentUserId);
      await admin.from("profiles").delete().eq("user_id", studentUserId);
      await admin.auth.admin.deleteUser(studentUserId);
    }
    if (opportunityId) await admin.from("opportunities").delete().eq("id", opportunityId);
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  });

  test("signup, onboarding, view, save, and apply", async ({ page }) => {
    // Signup (default mode is already "signup", default account type "student")
    await page.goto("/login");
    await page.fill("#login-email", studentEmail);
    await page.fill("#login-password", studentPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/onboarding$/, { timeout: 15000 });

    // Onboarding
    await page.fill("#onboarding-age", "16");
    await page.fill("#onboarding-zip", "85001");
    await page.getByRole("button", { name: "Community Service" }).click();
    await page.getByRole("button", { name: "Find My Matches" }).click();

    await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Look up the student's user id now that the account exists, for cleanup
    const admin = adminClient();
    const { data: users } = await admin.auth.admin.listUsers();
    studentUserId = users.users.find((u) => u.email === studentEmail)?.id;
    expect(studentUserId).toBeTruthy();

    // View: the seeded opportunity should be ranked and visible. Located
    // by role/accessible name (the card is a real <article
    // aria-labelledby> in components/OpportunityCard.tsx), not a
    // specific utility-class combination — resilient to the card's own
    // internal layout changing, which is exactly what happened when the
    // dashboard moved from a 3-column card grid to a single-column list
    // of wider horizontal cards.
    const card = page.getByRole("article", { name: opportunityTitle });
    await expect(card).toBeVisible({ timeout: 15000 });

    // Report an issue: real keyboard/focus behavior, not just an axe
    // scan — proves components/Modal.tsx's focus trap and restore
    // actually work, and that a real submission reaches the database.
    const reportTrigger = card.getByRole("button", { name: "Report an issue" });
    await reportTrigger.focus();
    await reportTrigger.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Report inaccurate listing" });
    await expect(dialog).toBeVisible();
    // Focus moves into the dialog on open — the textarea is the first
    // focusable element.
    await expect(dialog.locator("#report-message")).toBeFocused();

    // Escape closes the dialog and restores focus to the trigger that
    // opened it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(reportTrigger).toBeFocused();

    // Re-open and submit for real.
    await reportTrigger.click();
    await expect(dialog).toBeVisible();
    const reportMessage = `__test__ e2e report ${Date.now()}`;
    await dialog.locator("#report-message").fill(reportMessage);
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(dialog.getByText(/an admin will review this/i)).toBeVisible({ timeout: 10000 });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    const { data: submittedReport } = await admin
      .from("user_reports")
      .select("id, reporter_user_id, opportunity_id, report_type, message, status")
      .eq("message", reportMessage)
      .single();
    expect(submittedReport?.reporter_user_id).toBe(studentUserId);
    expect(submittedReport?.opportunity_id).toBe(opportunityId);
    expect(submittedReport?.report_type).toBe("inaccurate_listing");
    expect(submittedReport?.status).toBe("received");
    if (submittedReport?.id) {
      await admin.from("user_reports").delete().eq("id", submittedReport.id);
    }

    // Save
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("button", { name: /Mark as Applied/ })).toBeVisible({ timeout: 10000 });

    let { data: savedApp } = await admin
      .from("applications")
      .select("id, status")
      .eq("user_id", studentUserId!)
      .eq("opportunity_id", opportunityId)
      .single();
    expect(savedApp?.status).toBe("saved");

    // Apply (advance saved -> applied)
    await card.getByRole("button", { name: /Mark as Applied/ }).click();
    await expect(card.getByText("Applied", { exact: true })).toBeVisible({ timeout: 10000 });

    const { data: appliedApp } = await admin
      .from("applications")
      .select("id, status")
      .eq("id", savedApp!.id)
      .single();
    expect(appliedApp?.status).toBe("applied");
  });
});
