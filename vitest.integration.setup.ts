// Loads .env.local before any integration test runs, the same
// hand-rolled way scripts/fetch-*.ts and scripts/backfill-embeddings.ts
// already do (vitest doesn't load .env.local on its own). Integration
// tests hit the real, shared Supabase project with the service role
// key — there's no separate test project (see supabase/schema.sql's
// migration-file convention and README for why: this app has no linked
// Supabase CLI / DATABASE_URL, so there's nowhere else for these
// credentials to come from). Missing credentials fail loudly here
// rather than letting tests silently skip and falsely look green.
import { existsSync, readFileSync } from "fs";

function loadEnvLocal() {
  const path = new URL("./.env.local", import.meta.url);
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

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Integration tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local " +
      "(same keys the CLI fetch scripts use — see README's 'To run the ingestion fetchers' section). " +
      "These tests hit the real Supabase project directly and are deliberately excluded from `npm test`/CI " +
      "for that reason; run them by hand with `npm run test:integration`."
  );
}
