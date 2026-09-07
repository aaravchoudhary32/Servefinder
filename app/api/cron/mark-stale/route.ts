// Weekly Vercel cron (see vercel.ts) that flags opportunities as stale
// once their last_verified_at is more than STALE_AFTER_DAYS old.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdminClient";
import { markStaleOpportunities, closeExpiredOpportunities } from "@/lib/ingestion/markStale";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { withIngestionLock } from "@/lib/ingestion/withLock";
import { recordError } from "@/lib/errorLog";
import { safeErrorResponse } from "@/lib/apiError";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const lock = await withIngestionLock(supabase, "mark_stale", async () => {
      const stale = await markStaleOpportunities(supabase);
      const expired = await closeExpiredOpportunities(supabase);
      return { ...stale, ...expired };
    });
    if (!lock.ran) {
      return NextResponse.json({ skipped: true, reason: "Another run is already in progress." });
    }
    console.log(
      `Marked ${lock.result.markedStale} opportunities stale (cutoff ${lock.result.cutoff}); closed ${lock.result.closed} with expired deadlines.`
    );
    return NextResponse.json(lock.result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("mark-stale failed:", message);
    await recordError(supabase, { route: "/api/cron/mark-stale", message });
    return safeErrorResponse(500, "Ingestion job failed.");
  }
}
