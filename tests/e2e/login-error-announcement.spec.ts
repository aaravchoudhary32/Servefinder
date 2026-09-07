// Manual-audit finding: the login form's error message (and several
// other student-facing forms' error messages — onboarding, settings,
// reset-password, org onboarding) were plain <p> elements with no
// role="alert"/aria-live, so a screen-reader user submitting invalid
// credentials got no announcement that anything went wrong; they'd
// have to manually discover the new text. Confirms the fix actually
// works — an accessible-name/role check, not just that the text is
// visible on screen.
import { test, expect } from "@playwright/test";

test.describe("Login form — error announcement", () => {
  test("an invalid login attempt's error message is exposed as an alert, not just visible text", async ({ page }) => {
    await page.goto("/login?mode=login");
    await page.fill("#login-email", "__test__-nonexistent-login-check@example.com");
    await page.fill("#login-password", "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Scoped to a <p> specifically — Next.js's own built-in route-change
    // announcer (__next-route-announcer__) also has role="alert", which
    // would otherwise make getByRole("alert") match two elements.
    const alert = page.locator('p[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText(/doesn't match an account/i);
  });
});
