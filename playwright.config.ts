// Playwright test runner config for the a11y (tests/a11y) and e2e
// (tests/e2e) suites — separate from vitest, which only ever collects
// **/*.test.ts (see vitest.config.mts) and can't drive a real browser
// against real pages. Both suites need a running dev server (`npm run
// dev`), so — same reasoning as test:integration needing a live
// Supabase project — they're kept out of the default `npm test`/CI and
// run by hand via `npm run test:a11y` / `npm run test:e2e`.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Playwright's own bundled Chromium build has no mac13-arm64
      // binary (same limitation this project's cityOfPhoenix fetcher
      // already works around, see lib/ingestion/sources/cityOfPhoenix.ts)
      // — fall back to the locally installed Google Chrome. Vercel's own
      // CI environment isn't affected either way, since these suites
      // never run there (see the file header).
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  // Not started automatically: these suites assume a dev server you
  // already have running, the same assumption every ad hoc live-
  // verification script this session has made. Left unset rather than
  // wired to `webServer` so a suite run never accidentally starts a
  // second server or points at the wrong one.
});
