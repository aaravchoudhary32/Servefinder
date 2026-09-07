// Wraps an ingestion source's fetch call with the ingestion_locks claim
// (see supabase/add_error_log_and_ingestion_locks.sql) so two overlapping
// invocations of the same source — a genuine Vercel cron retry after a
// timeout, or a manual CLI run colliding with the weekly cron — can't
// both run at once. If the lock can't be claimed, the run is skipped
// rather than attempted; the lock is always released afterward via
// `finally`, even if `fn` throws.
//
// Fails open on a broken lock mechanism: if the claim RPC call itself
// errors (not "lock held", an actual failure to reach Postgres), the
// fetch still runs — a broken lock should never be the reason a real
// scheduled ingestion silently stops happening.

import type { SupabaseClient } from "@supabase/supabase-js";

export type LockedRunResult<T> = { ran: true; result: T } | { ran: false };

export async function withIngestionLock<T>(
  supabase: SupabaseClient,
  source: string,
  fn: () => Promise<T>
): Promise<LockedRunResult<T>> {
  const { data: claimed, error } = await supabase.rpc("try_claim_ingestion_lock", {
    source_name: source,
  });

  if (error) {
    console.error(`Failed to claim ingestion lock for "${source}" — proceeding anyway:`, error.message);
    return { ran: true, result: await fn() };
  }

  if (!claimed) {
    return { ran: false };
  }

  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    const { error: releaseError } = await supabase.rpc("release_ingestion_lock", { source_name: source });
    if (releaseError) {
      console.error(`Failed to release ingestion lock for "${source}":`, releaseError.message);
    }
  }
}
