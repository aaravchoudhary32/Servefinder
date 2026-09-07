// Structured server-side error log, admin-only read (/admin/error-log).
// Mirrors lib/ingestion/logRun.ts's recordIngestionRun in shape and
// posture: writing to this table is itself a side effect that should
// never mask or replace the real error — failures here are swallowed
// and console.error'd, not thrown. Always call with a service-role
// client (getSupabaseAdmin()) — error_log has no insert policy for
// anon/authenticated, only the service role can write to it.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordError(
  supabase: SupabaseClient,
  entry: { route: string; message: string; context?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase.from("error_log").insert({
    route: entry.route,
    message: entry.message,
    context: entry.context ?? {},
  });
  if (error) {
    console.error("Failed to record error_log entry:", error.message);
  }
}
