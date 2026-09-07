// Public, unauthenticated health/status endpoint. Returns no secrets —
// just whether the DB is reachable and, per ingestion source, how long
// it's been since that source last succeeded. The second part is the
// actual point: "the fetcher for source X hasn't succeeded in 3 weeks"
// is a machine-readable fact here instead of something someone has to
// think to go check /admin/ingestion-log for.
//
// Uses the plain anon-key client, not the service role — ingestion_runs
// is public-read already (see supabase/schema.sql), and a health check
// has no reason to need an elevated client.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Without `dynamic`, Next.js statically optimizes this route at build
// time (it saw no headers()/cookies() call to infer dynamic rendering
// from) — meaning every request after deploy would get the same frozen
// response from build time. `dynamic` alone turned out not to be
// enough, though: found live, not assumed — after adding a new
// ingestion source, this route kept reporting it as never-run in
// production (but correctly in a fresh local dev server) across
// several redeploys. Root cause was Vercel's build cache persisting
// Next.js's Data Cache for the underlying fetch() call supabase-js
// makes internally across deployments — `dynamic = "force-dynamic"`
// is documented to imply no caching, but empirically didn't stop this
// specific stale entry from surviving multiple production redeploys.
// `fetchCache = "force-no-store"` is the more explicit, authoritative
// route segment config for exactly this — it disables Next's fetch
// cache for every fetch in this route regardless of how any call
// (including ones made inside a third-party library like supabase-js)
// is invoked.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Every source with a scheduled cron job (see vercel.ts) — "manual" (the
// /admin form) is deliberately excluded, since it has no schedule to be
// "overdue" against.
const KNOWN_SOURCES = [
  "chesapeake_humane",
  "foodbank_seva",
  "chesapeake_public_library",
  "vbspca",
  "stmarysfoodbank",
  "phoenixrescuemission",
  "cityofphoenix",
  "special_olympics_az",
  "bgc_central_az",
] as const;

// Vercel sets this automatically for every deployment connected to Git
// — no configuration needed, and it's not a secret (it's the same SHA
// visible in the dashboard and in `git log`). Included so "the health
// check returns 200" can never again be mistaken for "the latest
// commit is actually deployed" — this session lost hours to exactly
// that gap when the Vercel project's Git integration was silently
// disconnected and every push kept succeeding against GitHub while
// production quietly kept serving a build from days earlier. Falls
// back to "unknown" for a non-Vercel environment (e.g. `next start`
// locally) rather than throwing.
const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";

export async function GET() {
  const { data, error } = await supabase
    .from("ingestion_runs")
    .select("source, run_at, status")
    .order("run_at", { ascending: false })
    .limit(500);

  if (error) {
    // This route is public/unauthenticated — the raw Supabase error
    // text (which can include schema/column hints) must never reach an
    // anonymous caller. Logged server-side; the public body only ever
    // says the DB is unreachable.
    console.error("health check: ingestion_runs query failed:", error.message);
    return NextResponse.json(
      { status: "error", database: "unreachable", deployedCommit },
      { status: 503 }
    );
  }

  const lastSuccessBySource: Record<string, string | null> = {};
  for (const source of KNOWN_SOURCES) lastSuccessBySource[source] = null;
  for (const row of data ?? []) {
    if (row.status === "success" && row.source in lastSuccessBySource && !lastSuccessBySource[row.source]) {
      lastSuccessBySource[row.source] = row.run_at;
    }
  }

  return NextResponse.json({
    status: "ok",
    database: "reachable",
    deployedCommit,
    sources: lastSuccessBySource,
    checkedAt: new Date().toISOString(),
  });
}
