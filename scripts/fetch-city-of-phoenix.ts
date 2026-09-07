// Manual, one-shot fetcher for the City of Phoenix's volunteer portal.
// Run with `npm run fetch:city-of-phoenix`.
//
// The actual fetch/normalize/upsert logic lives in
// lib/ingestion/sources/cityOfPhoenix.ts, shared with the weekly Vercel
// cron route at app/api/cron/fetch/city-of-phoenix/route.ts (dispatched via lib/ingestion/sourceRegistry.ts) — this file
// is just env loading + a CLI-friendly client + printing.

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runCityOfPhoenixFetch } from "../lib/ingestion/sources/cityOfPhoenix";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // `vercel env pull` wraps every value in double quotes; strip a
    // single matching layer so downstream code (e.g. new URL(...)) gets
    // the raw value instead of a string with literal quote characters.
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The service role key, not the anon key: opportunities/organizations
// writes are RLS-gated to admin users now (supabase/schema.sql), and
// this script isn't a logged-in user — it needs the key that bypasses
// RLS. Get it from Supabase → Settings → API → service_role secret key.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

runCityOfPhoenixFetch(supabase)
  .then((result) => {
    console.log(result.logs.join("\n"));
  })
  .catch((err) => {
    console.error("Fetch failed:", err);
    process.exit(1);
  });
