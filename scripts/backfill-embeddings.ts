// One-time (or re-run-anytime) backfill: embeds every opportunity that
// doesn't have an `embedding` yet — the seed data and anything ingested
// before this feature existed. Run with `npm run embed:backfill`.
//
// First run downloads the local embedding model (~90MB, cached after)
// and can take a while; each embedding after that is fast.

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/embeddings/embed";

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
// The service role key, not the anon key: this writes opportunities.embedding
// for every opportunity in the table, not just ones this session's admin
// user owns, and opportunities writes are RLS-gated to admin users now
// (supabase/schema.sql). Get it from Supabase → Settings → API → service_role
// secret key.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: rows, error } = await supabase
    .from("opportunities")
    .select("id, title, description")
    .is("embedding", null);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    console.log("Nothing to backfill — every opportunity already has an embedding.");
    return;
  }

  console.log(`Embedding ${rows.length} opportunit${rows.length === 1 ? "y" : "ies"}...`);

  let done = 0;
  let failed = 0;

  for (const row of rows) {
    const text = row.description?.trim() || row.title;
    try {
      const embedding = await embed(text);
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({ embedding })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      done++;
      console.log(`+ ${row.title}`);
    } catch (err) {
      failed++;
      console.error(`FAILED "${row.title}": ${err}`);
    }
  }

  console.log(`\nDone. ${done} embedded, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
