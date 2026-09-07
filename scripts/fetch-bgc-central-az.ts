// Manual, one-shot fetcher for the Boys & Girls Club of Central
// Arizona's volunteer page. Run with `npm run fetch:bgc-central-az`.
//
// The actual fetch/normalize/upsert logic lives in
// lib/ingestion/sources/bgcCentralAZ.ts, shared with the weekly Vercel
// cron route at app/api/cron/fetch/bgc-central-az/route.ts (dispatched via lib/ingestion/sourceRegistry.ts) — this file
// is just env loading + a CLI-friendly client + printing.

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runBgcCentralAZFetch } from "../lib/ingestion/sources/bgcCentralAZ";

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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

runBgcCentralAZFetch(supabase)
  .then((result) => {
    console.log(result.logs.join("\n"));
  })
  .catch((err) => {
    console.error("Fetch failed:", err);
    process.exit(1);
  });
