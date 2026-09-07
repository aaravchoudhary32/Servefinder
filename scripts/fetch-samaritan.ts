// Manual, one-shot fetcher for any Samaritan-platform tenant configured
// in lib/ingestion/sources/samaritan.ts. Run with
// `npm run fetch:samaritan -- --tenant=samaritan_santa_clarita`, or add
// `--dry-run` to preview without writing anything (required before the
// first real run of any new tenant — see samaritan.ts's header for the
// full source audit). Omit --tenant to run every configured tenant.

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runSamaritanFetch, SAMARITAN_SOURCES } from "../lib/ingestion/sources/samaritan";

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
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
const tenantSlug = tenantArg ? tenantArg.slice("--tenant=".length) : null;

const configs = tenantSlug ? SAMARITAN_SOURCES.filter((c) => c.sourceSlug === tenantSlug) : SAMARITAN_SOURCES;
if (tenantSlug && configs.length === 0) {
  console.error(`No Samaritan config found for --tenant=${tenantSlug}. Known: ${SAMARITAN_SOURCES.map((c) => c.sourceSlug).join(", ")}`);
  process.exit(1);
}

if (dryRun) console.log("=== DRY RUN — no database writes will be performed ===\n");

async function main() {
  for (const config of configs) {
    console.log(`\n=== ${config.orgName} (${config.sourceSlug}) ===`);
    const result = await runSamaritanFetch(supabase, config, { dryRun });
    console.log(result.logs.join("\n"));
    if (dryRun) console.log(`Dry-run summary: ${result.parsed} teen-eligible listings parsed, 0 written.`);
  }
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
