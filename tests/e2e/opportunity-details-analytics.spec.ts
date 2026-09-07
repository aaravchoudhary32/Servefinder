// Regression test for two bugs found during live verification of
// supabase/add_user_analytics.sql:
//
// 1. trackEvent("opportunity_details_viewed") used to live inside the
//    setExpanded() state-updater callback in both OpportunityCard.tsx
//    and ExploreOpportunityCard.tsx. React Strict Mode (the App
//    Router's dev-mode default — see next.config.js, no
//    reactStrictMode: false override anywhere in this repo)
//    intentionally double-invokes updater functions passed to a state
//    setter to catch exactly this kind of impurity, which was silently
//    doubling this event on every single click in local dev (confirmed
//    live: two opportunity_details_viewed rows, 5ms apart, from one
//    click). The fix moved trackEvent() into the onToggle handler
//    itself, outside the updater.
//
// 2. app/dashboard/page.tsx's unsave() used to pass the just-deleted
//    application's id as trackEvent's applicationId. analytics_events.
//    application_id is a foreign key to applications(id) — by the time
//    that insert ran, the row it pointed to was already gone, so the
//    insert failed its FK constraint (a 409, silently swallowed by
//    trackEvent's own try/catch) on every single unsave, in production,
//    100% of the time. Confirmed live: a real unsave click on the
//    deployed app produced zero opportunity_unsaved rows, traced via
//    the network tab to that exact 409. The fix stopped passing
//    applicationId for this one event.
//
// This test proves one genuine expand click now produces exactly one
// opportunity_details_viewed row, that collapsing never fires a second
// one, that a second genuine expand click still counts as a new view
// (across both card components), and that a save followed by an unsave
// produces exactly the right events with no FK failure. Runs against
// `next dev` (this suite's baseURL), which is exactly where bug #1
// reproduced — not test:e2e's build mode, since that's the whole point
// of the regression; bug #2 reproduces in both.
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
const studentEmail = `__test__-e2e-opp-details-analytics-${stamp}@example.com`;
const studentPassword = "E2eTest-Pw-2026!";
const orgName = `__test__ E2E Opp-Details-Analytics Org ${stamp}`;
const opportunityTitle = `__test__ E2E Opp-Details-Analytics Opportunity ${stamp}`;

let orgId: string;
let opportunityId: string;
let studentUserId: string | undefined;

test.describe("dashboard/explore analytics accuracy: opportunity_details_viewed and save/unsave", () => {
  test.beforeAll(async () => {
    const admin = adminClient();
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: orgName, verified: true })
      .select("id")
      .single();
    if (orgError || !org) throw new Error(`Couldn't seed test org: ${orgError?.message}`);
    orgId = org.id;

    const { data: opp, error: oppError } = await admin
      .from("opportunities")
      .insert({
        organization_id: orgId,
        title: opportunityTitle,
        // A description is what makes ViewDetailsToggle render at all
        // (see the condition guarding it in both card components).
        description: "A seeded opportunity for the opportunity-details-analytics regression test.",
        category: "Community Service",
        minimum_age: 13,
        commitment_type: "one_time",
        interests_tags: ["community"],
        // Same real, confirmed-live coordinates as student-workflow.spec.ts
        // uses for ZIP 85001, so the dashboard's ranked matches actually
        // include this opportunity.
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
      await admin.from("analytics_events").delete().eq("user_id", studentUserId);
      await admin.from("applications").delete().eq("user_id", studentUserId);
      await admin.from("profiles").delete().eq("user_id", studentUserId);
      await admin.auth.admin.deleteUser(studentUserId);
    }
    if (opportunityId) await admin.from("opportunities").delete().eq("id", opportunityId);
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  });

  test("one click expands and records one event; collapsing records none; a second expand records a second event — on both card components", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill("#login-email", studentEmail);
    await page.fill("#login-password", studentPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/onboarding$/, { timeout: 15000 });
    await page.fill("#onboarding-age", "16");
    await page.fill("#onboarding-zip", "85001");
    await page.getByRole("button", { name: "Community Service" }).click();
    await page.getByRole("button", { name: "Find My Matches" }).click();

    await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    const admin = adminClient();
    const { data: users } = await admin.auth.admin.listUsers();
    studentUserId = users.users.find((u) => u.email === studentEmail)?.id;
    expect(studentUserId).toBeTruthy();

    async function detailsViewedCount() {
      const { data, error } = await admin
        .from("analytics_events")
        .select("id")
        .eq("user_id", studentUserId!)
        .eq("opportunity_id", opportunityId)
        .eq("event_type", "opportunity_details_viewed");
      expect(error).toBeNull();
      return (data ?? []).length;
    }

    // --- Dashboard card (components/OpportunityCard.tsx) ---
    const dashboardCard = page.getByRole("article", { name: opportunityTitle });
    await expect(dashboardCard).toBeVisible({ timeout: 15000 });

    const dashboardToggle = dashboardCard.getByRole("button", { name: "View details" });
    await dashboardToggle.click();
    await expect(dashboardCard.getByRole("button", { name: "Show less" })).toBeVisible();
    // Give any errant double-fire time to land before counting.
    await page.waitForTimeout(500);
    expect(await detailsViewedCount()).toBe(1);

    // Collapsing must never record a second event.
    await dashboardCard.getByRole("button", { name: "Show less" }).click();
    await expect(dashboardCard.getByRole("button", { name: "View details" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await detailsViewedCount()).toBe(1);

    // A second genuine expand is a real new view — must record a second event.
    await dashboardCard.getByRole("button", { name: "View details" }).click();
    await expect(dashboardCard.getByRole("button", { name: "Show less" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await detailsViewedCount()).toBe(2);

    // --- Explore card (components/ExploreOpportunityCard.tsx) ---
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    const exploreCard = page.getByRole("article", { name: opportunityTitle });
    await expect(exploreCard).toBeVisible({ timeout: 15000 });

    const exploreToggle = exploreCard.getByRole("button", { name: "View details" });
    await exploreToggle.click();
    await expect(exploreCard.getByRole("button", { name: "Show less" })).toBeVisible();
    await page.waitForTimeout(500);
    // Carries over the 2 events recorded on the dashboard above — this
    // component shares the same event_type/opportunity_id, so the count
    // is cumulative across both cards for this student+opportunity pair.
    expect(await detailsViewedCount()).toBe(3);

    // --- Save / unsave (dashboard card) ---
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const dashboardCardAgain = page.getByRole("article", { name: opportunityTitle });
    await expect(dashboardCardAgain).toBeVisible({ timeout: 15000 });

    await dashboardCardAgain.getByRole("button", { name: "Save" }).click();
    await expect(dashboardCardAgain.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const { data: afterSave, error: afterSaveErr } = await admin
      .from("analytics_events")
      .select("event_type")
      .eq("user_id", studentUserId!)
      .eq("opportunity_id", opportunityId)
      .in("event_type", ["match_saved", "application_started"]);
    expect(afterSaveErr).toBeNull();
    expect((afterSave ?? []).map((r) => r.event_type).sort()).toEqual(["application_started", "match_saved"]);

    await dashboardCardAgain.getByRole("button", { name: "Remove" }).click();
    await expect(dashboardCardAgain.getByRole("button", { name: "Save" })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // The regression: this insert used to fail its FK constraint (the
    // application row it referenced was already deleted) and silently
    // record nothing. Asserting the row exists at all — not just that
    // no error was thrown client-side, which fire-and-forget always
    // looks like regardless — is what actually proves the fix.
    const { data: afterUnsave, error: afterUnsaveErr } = await admin
      .from("analytics_events")
      .select("id, metadata")
      .eq("user_id", studentUserId!)
      .eq("opportunity_id", opportunityId)
      .eq("event_type", "opportunity_unsaved");
    expect(afterUnsaveErr).toBeNull();
    expect((afterUnsave ?? []).length).toBe(1);
    expect(afterUnsave![0].metadata).toEqual({ matchMode: "classic" });
  });
});
