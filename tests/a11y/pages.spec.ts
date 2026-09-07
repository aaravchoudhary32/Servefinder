// Automated a11y checks across the app's key pages, using the same
// axe-core engine most manual browser a11y audits use. Scoped to
// serious/critical violations only — moderate/minor findings (often
// third-party icon markup, decorative contrast) are noisier than
// actionable at this app's current scale; serious/critical are the ones
// that actually block a screen-reader or keyboard user.
//
// Needs a dev server already running on localhost:3000 (`npm run dev`)
// and SUPABASE_SERVICE_ROLE_KEY in .env.local (tests/global-setup.ts
// creates the throwaway authenticated accounts these specs use).
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";

// Several pages use a ~450ms "fade-in-up"/"fade-in" CSS entrance
// animation (see tailwind.config.ts), which only starts once the page
// has hydrated and its own client-side data fetch (e.g. the admin-check
// query) has resolved — not at the moment page.goto() resolves. A flat
// 600ms wait from goto() was enough most of the time but flaked under
// load (multiple Playwright workers competing for CPU delayed hydration
// past the wait), catching axe mid-animation again — waiting for
// networkidle first, then a fixed margin past the animation's own
// duration, is the actually-correct ordering.
async function assertNoSeriousViolations(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

// axe rates heading-order as "moderate" impact, so assertNoSeriousViolations
// alone never catches it — this is exactly how a real skipped-heading-level
// bug (h1 straight to h3, with each OpportunityCard rendering its own h3
// and no h2 in between on /dashboard and the onboarding preview) shipped
// unnoticed until a broader Lighthouse-driven audit found it. Checked
// separately, at any impact level, specifically for this rule.
async function assertNoHeadingOrderViolations(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page }).withRules(["heading-order"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe("Public pages", () => {
  test("home page", async ({ page }) => {
    await page.goto("/");
    await assertNoSeriousViolations(page);
  });

  // Manual-audit finding: the animate-fade-in-up/animate-fade-in
  // Tailwind utilities (tailwind.config.ts) used across nearly every
  // page had no `prefers-reduced-motion` guard at all — a user with
  // vestibular motion sensitivity who has set this OS-level preference
  // still saw every card/section slide-and-fade in on every page load.
  // Only .opportunity-card's hover transform was previously guarded.
  // Confirms the fix in app/globals.css actually neutralizes the
  // animation (element visible at opacity 1 immediately), not just that
  // the CSS rule exists.
  test("respects prefers-reduced-motion: entrance animations are neutralized, content is immediately visible", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const animated = page.locator(".animate-fade-in-up, .animate-fade-in").first();
    await expect(animated).toHaveCSS("opacity", "1");
    await expect(animated).toHaveCSS("animation-name", "none");
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await assertNoSeriousViolations(page);
  });

  test("about page", async ({ page }) => {
    await page.goto("/about");
    await assertNoSeriousViolations(page);
  });

  test("privacy page", async ({ page }) => {
    await page.goto("/privacy");
    await assertNoSeriousViolations(page);
  });

  test("terms page", async ({ page }) => {
    await page.goto("/terms");
    await assertNoSeriousViolations(page);
  });

  test("contact page", async ({ page }) => {
    await page.goto("/contact");
    await assertNoSeriousViolations(page);
  });

  // No auth needed to reach this page (it's the destination of a
  // password-recovery email link), and a direct visit with no recovery
  // token is exactly the state most real visits to this URL outside a
  // genuine email click will be in — the invalid-link screen, not the
  // password form, so that's what this scans.
  test("reset-password page (invalid-link state)", async ({ page }) => {
    await page.goto("/reset-password");
    await assertNoSeriousViolations(page);
  });
});

test.describe("Authenticated student pages", () => {
  test.use({ storageState: path.join(__dirname, "../.storage-student.json") });

  test("onboarding page", async ({ page }) => {
    await page.goto("/onboarding");
    await assertNoSeriousViolations(page);
    await assertNoHeadingOrderViolations(page);
  });

  test("dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await assertNoSeriousViolations(page);
    await assertNoHeadingOrderViolations(page);
  });

  // Manual-audit finding: the loading skeleton shown while dashboard/
  // explore/applications/organizations fetch their data had no role or
  // aria-live, so a screen-reader user got total silence during the
  // load — no indication the page was working versus just blank. Delays
  // the underlying Supabase fetch to catch the skeleton mid-render
  // rather than racing against how fast the local dev server responds.
  test("loading state announces to screen readers instead of rendering silently", async ({ page }) => {
    await page.route("**/rest/v1/opportunities*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page.goto("/dashboard");
    await expect(page.getByRole("status", { name: "Loading matches" })).toBeVisible();
  });

  // Manual-audit finding: there was no way for a keyboard/screen-reader
  // user to bypass NavBar's links and jump straight to a page's own
  // content (WCAG 2.4.1 Bypass Blocks). NavBar now renders a skip link
  // as its own first child, targeting a real `id="main-content"` on
  // every page that uses NavBar (dashboard, explore, settings, admin,
  // etc.) — checked here once since it's the same shared component
  // everywhere, not per-page markup. Pages with their own lightweight
  // header instead of NavBar (home, login, about, and other public
  // marketing/info pages) don't render this component at all.
  test("skip-to-main-content link is the first tab stop and actually moves focus", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("explore", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    await assertNoSeriousViolations(page);
  });

  // Despite the name, this page requires a logged-in session (any
  // account type — it redirects to /login otherwise, see
  // app/organizations/page.tsx), so it belongs here, not under "Public
  // pages".
  test("organizations directory", async ({ page }) => {
    await page.goto("/organizations");
    await assertNoSeriousViolations(page);
  });

  test("settings page", async ({ page }) => {
    await page.goto("/settings");
    await assertNoSeriousViolations(page);
  });
});

test.describe("Authenticated admin pages (same account, also granted admin)", () => {
  test.use({ storageState: path.join(__dirname, "../.storage-student.json") });

  test("admin page", async ({ page }) => {
    await page.goto("/admin");
    await assertNoSeriousViolations(page);
  });

  test("admin review queue", async ({ page }) => {
    await page.goto("/admin/review-queue");
    await page.waitForLoadState("networkidle");
    await assertNoSeriousViolations(page);
  });

  test("admin catalog dashboard", async ({ page }) => {
    await page.goto("/admin/catalog");
    await page.waitForLoadState("networkidle");
    await assertNoSeriousViolations(page);
  });

  test("admin reports", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.waitForLoadState("networkidle");
    await assertNoSeriousViolations(page);
  });
});

test.describe("Authenticated org pages", () => {
  test.use({ storageState: path.join(__dirname, "../.storage-org.json") });

  test("org-dashboard", async ({ page }) => {
    await page.goto("/org-dashboard");
    await page.waitForLoadState("networkidle");
    await assertNoSeriousViolations(page);
  });
});

// A narrow phone viewport (iPhone SE — the smallest width still in
// common use, so anything that reflows correctly here reflows
// correctly on everything wider) had never actually been tested: the
// desktop-viewport runs above don't catch a horizontal-scroll,
// overlapping-content, or off-screen-control regression that only
// shows up once the layout actually has to reflow narrower than a
// laptop. axe's own checks (contrast, labels, landmarks) are
// viewport-independent and already covered above; this block adds the
// one thing that isn't: does the page's layout itself stay usable at
// this width, with no horizontal overflow.
test.describe("Mobile viewport (375x667)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  async function assertNoHorizontalOverflow(page: Page) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `document is ${scrollWidth - clientWidth}px wider than the viewport`).toBeLessThanOrEqual(
      clientWidth
    );
  }

  test("home page", async ({ page }) => {
    await page.goto("/");
    await assertNoSeriousViolations(page);
    await assertNoHorizontalOverflow(page);
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await assertNoSeriousViolations(page);
    await assertNoHorizontalOverflow(page);
  });

  test.describe("authenticated student pages", () => {
    test.use({ storageState: path.join(__dirname, "../.storage-student.json") });

    test("dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      await assertNoSeriousViolations(page);
      await assertNoHorizontalOverflow(page);
    });

    test("onboarding page", async ({ page }) => {
      await page.goto("/onboarding");
      await assertNoSeriousViolations(page);
      await assertNoHorizontalOverflow(page);
    });

    // Manual-audit finding: every TagSelect option button (broad
    // interests, focuses, skills, availability — used throughout
    // onboarding and Settings) measured 34px tall on a 375px mobile
    // viewport, under WCAG 2.5.5's 44px touch-target minimum. Fixed by
    // increasing the button's vertical padding in components/
    // TagSelect.tsx; this checks the real rendered size, not just that
    // the CSS class changed.
    test("TagSelect buttons meet the 44px minimum touch-target size", async ({ page }) => {
      await page.goto("/onboarding");
      const box = await page.getByRole("button", { name: "STEM & Technology", exact: true }).boundingBox();
      expect(box?.height, "TagSelect button height").toBeGreaterThanOrEqual(44);
    });

    // Settings' interests editor renders up to 10 broad-interest buttons
    // plus a search box (TagSelect's search threshold is 8 options) and,
    // once a category is picked, a second focus-picker with its own
    // search box — the two widest, most button-dense sections in the
    // app, and exactly what a narrow viewport would overflow on first.
    test("settings page", async ({ page }) => {
      await page.goto("/settings");
      await assertNoSeriousViolations(page);
      await assertNoHorizontalOverflow(page);
    });
  });

  test.describe("authenticated org pages", () => {
    test.use({ storageState: path.join(__dirname, "../.storage-org.json") });

    test("org-dashboard", async ({ page }) => {
      await page.goto("/org-dashboard");
      await page.waitForLoadState("networkidle");
      await assertNoSeriousViolations(page);
      await assertNoHorizontalOverflow(page);
    });
  });
});
