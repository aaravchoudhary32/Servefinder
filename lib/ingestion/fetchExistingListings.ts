// Every connector needs the full set of existing opportunities (or its
// own source's subset) to dedupe against before writing. A plain
// `.select(...)` with no `.range()` is capped at 1000 rows by
// PostgREST — harmless while the table was small, but it started
// silently truncating results once the table crossed that size,
// causing spurious duplicate-key insert failures on a second run of a
// large tenant (see samaritan.ts's own history of this exact bug).
// This helper pages through the full result set explicitly so no
// connector has to remember to do that itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ExistingListing } from "./normalize";

const EXISTING_LISTING_COLUMNS =
  "id, source, external_id, title, application_url, application_deadline, location, minimum_age, source_url, organizations(name)";

const PAGE_SIZE = 1000;

/**
 * Fetches every row needed to build a connector's dedup lookup,
 * optionally scoped to a single source slug. Pages through the full
 * result set so a table (or a single source's rows) larger than 1000
 * is never silently truncated.
 */
export async function fetchExistingListings(
  supabase: SupabaseClient,
  options: { sourceSlug?: string } = {}
): Promise<ExistingListing[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("opportunities").select(EXISTING_LISTING_COLUMNS).range(from, from + PAGE_SIZE - 1);
    if (options.sourceSlug) query = query.eq("source", options.sourceSlug);
    const { data: page, error } = await query;
    if (error) throw new Error(`Failed to page existing opportunities: ${error.message}`);
    if (!page || page.length === 0) break;
    rows.push(...(page as Record<string, unknown>[]));
    if (page.length < PAGE_SIZE) break;
  }
  return rows.map((row) => ({
    id: row.id as string,
    source: row.source as string,
    external_id: row.external_id as string | null,
    title: row.title as string,
    organizationName: (row.organizations as { name: string } | null)?.name ?? null,
    applicationUrl: row.application_url as string | null,
    applicationDeadline: row.application_deadline as string | null,
    location: row.location as string | null,
    minimumAge: row.minimum_age as number | null,
    sourceUrl: row.source_url as string | null,
  }));
}
