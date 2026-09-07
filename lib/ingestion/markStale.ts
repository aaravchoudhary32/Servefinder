// Flags opportunities as stale once they haven't been re-verified by an
// ingestion job in a while. Only touches rows that actually went through
// ingestion (last_verified_at is set) — manually admin-entered
// opportunities have no last_verified_at and are never auto-staled,
// since there's no re-verification job tracking them.
//
// The reverse (is_stale -> false) isn't handled here: a fetcher already
// sets is_stale: false whenever it successfully re-verifies a listing
// (see lib/ingestion/sources/chesapeakeHumane.ts), so this only ever
// needs to move in one direction.

import type { SupabaseClient } from "@supabase/supabase-js";

export const STALE_AFTER_DAYS = 30;

export async function markStaleOpportunities(
  supabase: SupabaseClient
): Promise<{ markedStale: number; cutoff: string }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS);
  const cutoffIso = cutoff.toISOString();

  const { data, error } = await supabase
    .from("opportunities")
    .update({ is_stale: true })
    .lt("last_verified_at", cutoffIso)
    .not("last_verified_at", "is", null)
    .eq("is_stale", false)
    .select("id");

  if (error) throw new Error(error.message);

  return { markedStale: data?.length ?? 0, cutoff: cutoffIso };
}

// Flips availability_status to 'closed' once an opportunity's own
// application_deadline has passed — the "automatically suppress expired
// deadlines" rule from the manual-source-integration spec. Reuses this
// same weekly job rather than a new cron entry: only ever moves 'open'
// rows to 'closed' (never touches seasonal/unverified, which don't claim
// to be currently accepting in the first place), and only rows that
// actually have a deadline — most automated sources never set one.
export async function closeExpiredOpportunities(
  supabase: SupabaseClient
): Promise<{ closed: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("opportunities")
    .update({ availability_status: "closed" })
    .lt("application_deadline", today)
    .eq("availability_status", "open")
    .select("id");

  if (error) throw new Error(error.message);

  return { closed: data?.length ?? 0 };
}
