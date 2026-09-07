// Critical-path e2e test for the password-reset flow, mirroring
// student-workflow.spec.ts's shape: a throwaway __test__-prefixed
// account created via the service-role admin client in beforeAll,
// cleaned up in afterAll, driven through the real UI rather than
// asserting against Supabase Auth directly.
//
// A real production bug report drove most of the additions here: a
// recovery email's link landed on the homepage instead of the
// new-password form, and a Next.js dev-mode CSP error appeared in the
// process. The root cause was Supabase Dashboard configuration (the
// production origin's /reset-password wasn't an allowed redirect URL,
// so GoTrue silently fell back to the project's Site URL) plus an
// unrelated, real local-dev CSP gap (see next.config.test.ts) — neither
// of which this suite can exercise directly (no control over the
// Supabase project's dashboard settings, and this suite always runs
// against a real dev server, not a preview/production URL). What IS
// tested here is everything this app's own code is responsible for:
// the request always uses the current origin (not a hardcoded one),
// the update page correctly distinguishes a real recovery visit from a
// direct/expired/reused one, and a successful reset actually forces a
// fresh login rather than silently continuing an old session.
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
const testEmail = `__test__-e2e-reset-${stamp}@example.com`;
const originalPassword = "E2eTest-Original-Pw-2026!";
const newPassword = "E2eTest-NewPw-2026!";

let userId: string | undefined;

test.describe("Password reset", () => {
  // Both tests share one beforeAll-created account. Without this,
  // fullyParallel (playwright.config.ts) can schedule the two tests in
  // this describe onto separate workers, each running its own copy of
  // beforeAll against the same stamped email — observed as a "Database
  // error creating new user" from the resulting duplicate-email race.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const admin = adminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: originalPassword,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Couldn't create test user: ${error?.message}`);
    userId = data.user.id;
  });

  test.afterAll(async () => {
    const admin = adminClient();
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  test("requesting a reset link shows the same confirmation for a real or unknown email", async ({ page }) => {
    await page.goto("/login?mode=login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

    await page.fill("#login-email", testEmail);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/we've sent a link/i)).toBeVisible({ timeout: 10000 });

    // resetPasswordForEmail() never reveals whether an account exists for
    // the address given — the UI must show the identical confirmation
    // for an email with no account, not a different (enumerable) result.
    await page.getByRole("button", { name: "Back to login" }).click();
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.fill("#login-email", `__test__-no-such-account-${stamp}@example.com`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/we've sent a link/i)).toBeVisible({ timeout: 10000 });
  });

  test("uses the current origin as the recovery destination, not a hardcoded one", async ({ page, baseURL }) => {
    // Intercepts the actual network request resetPasswordForEmail()
    // sends (Supabase's own REST endpoint) rather than reading app
    // state, so this proves what's really sent over the wire, not just
    // what a variable in memory happened to hold.
    let capturedRedirectTo: string | null = null;
    await page.route("**/auth/v1/recover*", async (route) => {
      const body = route.request().postDataJSON() as { email?: string };
      const url = new URL(route.request().url());
      capturedRedirectTo = url.searchParams.get("redirect_to");
      void body;
      await route.continue();
    });

    await page.goto("/login?mode=forgot");
    await page.fill("#login-email", testEmail);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/we've sent a link/i)).toBeVisible({ timeout: 10000 });

    expect(capturedRedirectTo).toBe(`${baseURL}/reset-password`);
  });

  test("a real recovery link lets the user set a new password, and forces a fresh login with it", async ({
    page,
  }) => {
    const admin = adminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: testEmail,
      options: { redirectTo: "http://localhost:3000/reset-password" },
    });
    if (error || !data.properties?.action_link) {
      throw new Error(`Couldn't generate recovery link: ${error?.message}`);
    }
    const actionLink = data.properties.action_link;

    // Simulates clicking the link from the actual reset email — this
    // is the real Supabase-hosted verify URL, not a shortcut around it.
    // Supabase-js parses the recovery tokens out of the resulting
    // redirect URL itself; this test never touches a token directly.
    await page.goto(actionLink);
    await page.waitForURL(/\/reset-password/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible({ timeout: 10000 });

    // Mismatch: an accessible error, and no navigation away from the form.
    await page.fill("#reset-password", newPassword);
    await page.fill("#reset-password-confirm", newPassword + "x");
    await page.getByRole("button", { name: "Set new password" }).click();
    // Scoped to a <p> specifically — Next.js's own built-in route-change
    // announcer (__next-route-announcer__) also has role="alert", which
    // would otherwise make getByRole("alert") match two elements.
    await expect(page.locator('p[role="alert"]')).toHaveText("Those passwords don't match.");
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

    await page.fill("#reset-password-confirm", newPassword);
    await page.getByRole("button", { name: "Set new password" }).click();

    // Success ends the recovery session and shows an explicit Login
    // action rather than silently continuing into the dashboard on the
    // temporary recovery session — proof the reset really requires
    // logging back in with the new password, not just that some
    // redirect happened.
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("link", { name: "Go to Login" }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });

    await page.fill("#login-email", testEmail);
    await page.fill("#login-password", originalPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText(/doesn't match an account/i)).toBeVisible({ timeout: 10000 });

    await page.fill("#login-password", newPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });

    // The same link, reused: Supabase's recovery token is single-use, so
    // this exercises the real "already used" rejection this page's
    // error-code detection is meant to catch — not a simulated one.
    await page.context().clearCookies();
    await page.goto(actionLink);
    await expect(page.getByText("This password-reset link is invalid or has expired.")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("link", { name: "Request a new reset email" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to Login" })).toBeVisible();
  });

  test("a direct visit to /reset-password with no recovery token shows the same safe invalid-link message", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await expect(page.getByText("This password-reset link is invalid or has expired.")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toHaveCount(0);

    // Both recovery paths stay reachable from here — the user isn't
    // left stranded on a dead end.
    await expect(page.getByRole("link", { name: "Request a new reset email" })).toHaveAttribute(
      "href",
      "/login?mode=forgot"
    );
    await expect(page.getByRole("link", { name: "Return to Login" })).toHaveAttribute("href", "/login?mode=login");
  });

  test("an ordinary logged-in session visiting /reset-password directly is not treated as a recovery session", async ({
    page,
  }) => {
    await page.goto("/login?mode=login");
    await page.fill("#login-email", testEmail);
    await page.fill("#login-password", newPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });

    // A real, ordinary authenticated session exists at this point — the
    // page must still show the invalid-link state, not the new-password
    // form, since nothing here came from an actual recovery link.
    await page.goto("/reset-password");
    await expect(page.getByText("This password-reset link is invalid or has expired.")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toHaveCount(0);
  });
});
