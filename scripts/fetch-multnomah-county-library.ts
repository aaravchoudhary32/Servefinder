// Manual, one-shot fetcher for Multnomah County Library's Better Impact
// volunteer portal (Portland, OR). Run with
// `npm run fetch:multnomah-county-library`, or `-- --dry-run` to preview
// without writing anything (required before the first real run — see
// lib/ingestion/sources/multnomahCountyLibrary.ts's header for the full
// source audit).

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runMultnomahCountyLibraryFetch } from "../lib/ingestion/sources/multnomahCountyLibrary";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("=== DRY RUN — no database writes will be performed ===\n");

runMultnomahCountyLibraryFetch(supabase, { dryRun })
  .then((result) => {
    console.log(result.logs.join("\n"));
    if (dryRun) console.log(`\nDry-run summary: ${result.parsed} listings parsed, 0 written (dry run).`);
  })
  .catch((err) => {
    console.error("Fetch failed:", err);
    process.exit(1);
  });
