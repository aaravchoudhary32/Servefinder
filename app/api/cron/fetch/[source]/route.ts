// Weekly Vercel cron (see vercel.ts) that re-runs one ingestion source's
// fetch, chosen by the [source] URL segment via lib/ingestion/sourceRegistry.ts.
// Replaces what used to be 9 separate app/api/cron/fetch-<source>/route.ts
// files — same per-source logic (auth check, ingestion_locks claim,
// error_log write on failure), just dispatched from one file so Next.js
// deploys 1 Serverless Function instead of 9 (see next.config.js).
//
// Vercel still fires one independent HTTP request per source per its own
// cron entry in vercel.ts — this file being shared doesn't change that.
// One source throwing only ever affects its own request/response; it
// can't block or fail the other 8, since each is a separate invocation.
//
// Explicit Node.js runtime + a shared maxDuration: two of the 9 sources
// (city-of-phoenix, special-olympics-az) launch a headless browser via
// Playwright and need real Node APIs plus more time than Vercel's
// smaller defaults; since maxDuration is a route-level export (can't
// vary per request), all 9 sources get the same generous 120s ceiling.
// The other 7 finish in well under a minute per their own source files'
// comments — this is headroom, not a new requirement for them.
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdminClient";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { withIngestionLock } from "@/lib/ingestion/withLock";
import { recordError } from "@/lib/errorLog";
import { safeErrorResponse } from "@/lib/apiError";
import { INGESTION_SOURCES } from "@/lib/ingestion/sourceRegistry";
import { recordSourceAttempt, recordSourceSuccess, recordSourceError } from "@/lib/ingestion/updateSourceHealth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ source: string }> }
) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await context.params;
  const entry = INGESTION_SOURCES[source];
  if (!entry) {
    return NextResponse.json({ error: `Unknown ingestion source "${source}".` }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  await recordSourceAttempt(supabase, entry.lockKey);
  try {
    const lock = await withIngestionLock(supabase, entry.lockKey, () => entry.run(supabase));
    if (!lock.ran) {
      return NextResponse.json({ skipped: true, reason: "Another run is already in progress for this source." });
    }
    console.log(lock.result.logs.join("\n"));
    await recordSourceSuccess(supabase, entry.lockKey);
    return NextResponse.json(lock.result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`${source} fetch failed:`, message);
    await recordError(supabase, { route: `/api/cron/fetch/${source}`, message });
    await recordSourceError(supabase, entry.lockKey, message);
    return safeErrorResponse(500, "Ingestion job failed.");
  }
}
