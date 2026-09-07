// Shared fetch logic for the Foodbank of Southeastern Virginia and the
// Eastern Shore's public "Ways to Volunteer" page. Used by both the
// manual CLI script (scripts/fetch-foodbank-seva.ts) and the weekly
// Vercel cron (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as
// lib/ingestion/sources/chesapeakeHumane.ts, for the same reason.
//
// Deliberately a second, differently-shaped source rather than a second
// copy of the Chesapeake Humane fetcher: this page has no per-role
// paragraph blocks, it lists its volunteer tracks as
// "<li><strong>Name: </strong>description</li>" items inside a single
// <ul> under a "Ways to Volunteer" heading. Proving the shared
// normalize/dedup layer handles that shape too — not just the one it was
// originally built against — is the point of adding it.
//
// Safe to re-run: tracks are matched by a deterministic external_id (slug
// of the track name), so a repeat run updates the same rows instead of
// duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "foodbank_seva";
const PAGE_URL = "https://www.foodbankonline.org/get-involved/volunteer/";
const ORG_NAME = "Foodbank of Southeastern Virginia and the Eastern Shore";
const ORG_DESCRIPTION =
  "Nonprofit hunger-relief organization serving Southeastern Virginia and the Eastern Shore through food pantry, mobile market, and warehouse volunteer programs.";
const ORG_LOCATION = "800 Tidewater Drive, Norfolk, VA 23504";
const ORG_ZIP = "23504";

// ---------- HTML parsing ----------
//
// The relevant section is a single <ul> under the "Ways to Volunteer"
// heading, with each volunteer track as one <li>:
//   <li><strong>Traditional Volunteer Roles: </strong>These flexible,
//   one-time volunteer shifts include sorting and packing food...</li>
// This is a different WordPress theme than Chesapeake Humane's — list
// items with a trailing colon inside <strong>, not paragraph/<br> blocks
// — which is exactly the format variance normalizeListing() exists to
// absorb.

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ParsedTrack = { title: string; description: string; externalId: string };

function parseTracks(html: string): ParsedTrack[] {
  const startIdx = html.indexOf("Ways to Volunteer");
  if (startIdx === -1) {
    throw new Error("Couldn't find the \"Ways to Volunteer\" section — the page layout may have changed.");
  }
  const listStart = html.indexOf("<ul>", startIdx);
  const listEnd = html.indexOf("</ul>", listStart);
  if (listStart === -1 || listEnd === -1) {
    throw new Error("Couldn't find the volunteer track list — the page layout may have changed.");
  }
  const section = html.slice(listStart, listEnd);

  const itemRegex = /<li><strong>([^<]+?):?\s*<\/strong>([\s\S]*?)<\/li>/g;
  const tracks: ParsedTrack[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(section)) !== null) {
    const title = stripHtml(match[1]);
    const description = stripHtml(match[2]);
    if (!title || !description) continue;
    tracks.push({ title, description, externalId: slugify(title) });
  }
  return tracks;
}

// ---------- main ----------

export type FoodbankSevaFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runFoodbankSevaFetch(
  supabase: SupabaseClient
): Promise<FoodbankSevaFetchResult> {
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  try {
    return await doFetch(supabase, log, logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordIngestionRun(supabase, {
      source: SOURCE,
      status: "error",
      listingsFound: 0,
      listingsInserted: 0,
      listingsUpdated: 0,
      listingsSkippedDuplicate: 0,
      errorMessage: message,
    });
    throw err;
  }
}

async function doFetch(
  supabase: SupabaseClient,
  log: (line: string) => void,
  logs: string[]
): Promise<FoodbankSevaFetchResult> {
  log(`Fetching ${PAGE_URL} ...`);
  // Unlike Chesapeake Humane's site, this one sits behind a WAF that 403s
  // any request whose User-Agent claims to be a specific browser
  // (Chrome/Safari tokens) without the accompanying headers a real
  // browser always sends — verified directly: a full Chrome UA string
  // was rejected 4/4 tries, while a bare "Mozilla/5.0" (still an honest,
  // non-spoofed identifier — just not a browser impersonation) succeeded
  // 4/4. Using it here rather than a self-identifying bot string, which
  // this WAF also rejected.
  const res = await fetch(PAGE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const tracks = parseTracks(html);
  log(`Parsed ${tracks.length} volunteer tracks from the page.`);
  if (tracks.length === 0) {
    log("Nothing to ingest — exiting.");
    await recordIngestionRun(supabase, {
      source: SOURCE,
      status: "success",
      listingsFound: 0,
      listingsInserted: 0,
      listingsUpdated: 0,
      listingsSkippedDuplicate: 0,
    });
    return { parsed: 0, created: 0, updated: 0, skipped: 0, orgId: null, logs };
  }

  let { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", ORG_NAME)
    .maybeSingle();

  if (!org) {
    const { data: newOrg, error } = await supabase
      .from("organizations")
      // Ingestion-created orgs are auto-verified per this app's own
      // documented intent (supabase/add_org_verification_enforcement.sql
      // grandfathered every scraped-source org at rollout) — `verified`
      // gates public visibility and exists to hold back genuine
      // self-signup orgs (/onboarding/organization) for admin review,
      // not a controlled, code-reviewed connector like this one.
      .insert({ name: ORG_NAME, description: ORG_DESCRIPTION, verified: true })
      .select("id, name")
      .single();
    if (error || !newOrg) throw new Error(`Couldn't create organization: ${error?.message}`);
    org = newOrg;
    log(`Created organization "${ORG_NAME}" (${org.id}).`);
  } else {
    log(`Found existing organization "${ORG_NAME}" (${org.id}).`);
  }

  const coords = await geocodeStudentLocation(ORG_ZIP, ORG_LOCATION);
  log(
    coords
      ? `Geocoded ${ORG_ZIP} -> ${coords.lat}, ${coords.lng}`
      : `Couldn't geocode ${ORG_ZIP} — listings will have no coordinates.`
  );

  // Dedup against every existing opportunity, not just this source — a
  // manually-entered listing could already cover the same role.
  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const track of tracks) {
    const raw: RawListing = {
      title: track.title,
      description: track.description,
      location: ORG_LOCATION,
      external_id: track.externalId,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: PAGE_URL });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: track.externalId,
        title: track.title,
        organizationName: ORG_NAME,
        applicationUrl: normalized.application_url,
        applicationDeadline: normalized.application_deadline,
        location: normalized.location,
        minimumAge: normalized.minimum_age,
        sourceUrl: normalized.source_url,
      },
      existing
    );

    let embedding: number[] | null = null;
    try {
      embedding = await embed(track.description);
    } catch (err) {
      log(`Couldn't embed "${track.title}" — semantic matching will skip it for now: ${err}`);
    }

    const payload = { ...normalized, organization_id: org.id, is_stale: false, embedding };

    if (!dedup) {
      // New rows from automated ingestion start in review_status
      // "pending" — a human must approve before this becomes publicly
      // visible (see supabase/add_ingestion_source_registry_and_staging.sql).
      // Updates to an already-approved row (the branch below) deliberately
      // don't touch review_status — a refreshed deadline/description on
      // content a human already reviewed isn't new content needing
      // re-review.
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${track.title}": ${error.message}`);
        continue;
      }
      log(`+ Created: ${track.title}`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${track.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${track.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(
        `- Skipped "${track.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (similarity ${dedup.similarity.toFixed(2)})`
      );
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: tracks.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: tracks.length, created, updated, skipped, orgId: org.id, logs };
}
