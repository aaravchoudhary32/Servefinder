// Keeps `ingestion_sources` (see
// supabase/add_ingestion_source_registry_and_staging.sql) in sync with
// what actually happened on the most recent run — the timestamps/status
// fields that only make sense as runtime state, which is why they live
// in a table rather than sourceRegistry.ts's static dispatch map.
//
// Best-effort: a failure to update source health should never fail (or
// even be visible in) the actual ingestion run it's describing — same
// posture as recordIngestionRun()/recordError() elsewhere in this
// pipeline. `source_name` not existing in ingestion_sources yet (a new
// connector added without a corresponding registry row) is a real gap
// worth knowing about, so that one case does surface via console.error.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordSourceAttempt(supabase: SupabaseClient, sourceName: string): Promise<void> {
  try {
    await supabase
      .from("ingestion_sources")
      .update({ last_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("source_name", sourceName);
  } catch {
    // best-effort, never blocks the actual fetch
  }
}

export async function recordSourceSuccess(supabase: SupabaseClient, sourceName: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("ingestion_sources")
      .update({ last_successful_at: now, status: "active", last_error_message: null, updated_at: now })
      .eq("source_name", sourceName)
      .select("id");
    if (!error && (data?.length ?? 0) === 0) {
      console.error(`ingestion_sources has no row for source_name "${sourceName}" — add one to the registry migration.`);
    }
  } catch {
    // best-effort
  }
}

export async function recordSourceError(supabase: SupabaseClient, sourceName: string, message: string): Promise<void> {
  try {
    await supabase
      .from("ingestion_sources")
      .update({ status: "error", last_error_message: message, updated_at: new Date().toISOString() })
      .eq("source_name", sourceName);
  } catch {
    // best-effort
  }
}
