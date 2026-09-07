import type { VercelConfig } from "@vercel/config/v1";

// All run weekly, staggered so every fetcher lands before the staleness
// sweep. Times are UTC (Vercel cron is always UTC).
export const config: VercelConfig = {
  // No longer needs a `playwright install` build step: both Playwright
  // sources (fetch-city-of-phoenix, fetch-special-olympics-az) now
  // launch @sparticuz/chromium's own bundled binary instead of
  // Playwright's — see lib/ingestion/sources/cityOfPhoenix.ts and
  // specialOlympicsAZ.ts's launchBrowser() for why (a real missing
  // OS-level shared library on Vercel's runtime, not a bundling gap
  // `playwright install` could fix). That package's Chromium build
  // comes down as part of `npm install` itself, same as any other
  // dependency. The PLAYWRIGHT_BROWSERS_PATH Vercel project env var
  // from that migration is now unused but left in place — harmless,
  // and removing it isn't part of this change.
  buildCommand: "next build",
  // /api/cron/fetch/<source> (app/api/cron/fetch/[source]/route.ts) is one
  // shared dynamic route replacing what used to be 9 separate route files
  // — see lib/ingestion/sourceRegistry.ts and next.config.js's
  // outputFileTracingIncludes comment for why (Vercel's Hobby-plan
  // 12-Serverless-Function cap). Each source still gets its own cron
  // entry/schedule below; Vercel fires each as its own independent
  // request, so per-source isolation and timing are unaffected — only
  // the file path changed (fetch-<source> -> fetch/<source>).
  crons: [
    { path: "/api/cron/fetch/chesapeake-humane", schedule: "0 6 * * 1" }, // Monday 06:00 UTC
    { path: "/api/cron/fetch/foodbank-seva", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/chesapeake-library", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/vbspca", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/stmarys-foodbank", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/phoenix-rescue-mission", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/city-of-phoenix", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/special-olympics-az", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/bgc-central-az", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/firewheel-stem", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/fetch/arizona-science-center", schedule: "0 6 * * 1" }, // Monday 06:00 UTC — independent source, same slot
    { path: "/api/cron/mark-stale", schedule: "0 7 * * 1" }, // Monday 07:00 UTC
  ],
};
