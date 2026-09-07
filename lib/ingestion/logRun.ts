// Shared by every source in lib/ingestion/sources/: records one row per
// fetcher execution (manual CLI run or scheduled cron) to ingestion_runs,
// so /admin/ingestion-log can show what happened without grepping Vercel
// function logs. Logging failures are swallowed (and just console.error'd)
// rather than thrown — a broken log write should never mask, or replace,
// the real ingestion result/error.

import type { SupabaseClient } from "@supabase/supabase-js";

export type IngestionRunLog = {
  source: string;
  status: "success" | "error";
  listingsFound: number;
  listingsInserted: number;
  listingsUpdated: number;
  listingsSkippedDuplicate: number;
  errorMessage?: string | null;
};

export async function recordIngestionRun(
  supabase: SupabaseClient,
  run: IngestionRunLog
): Promise<void> {
  const { error } = await supabase.from("ingestion_runs").insert({
    source: run.source,
    status: run.status,
    listings_found: run.listingsFound,
    listings_inserted: run.listingsInserted,
    listings_updated: run.listingsUpdated,
    listings_skipped_duplicate: run.listingsSkippedDuplicate,
    error_message: run.errorMessage ?? null,
  });
  if (error) {
    console.error("Failed to record ingestion run:", error.message);
  }
}
