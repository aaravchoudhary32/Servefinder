// Shared fetch logic for the Chesapeake Public Library's public volunteer
// page. Used by both the manual CLI script
// (scripts/fetch-chesapeake-library.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as the other two
// sources in lib/ingestion/sources/.
//
// A third, differently-shaped source on purpose: this is a CivicPlus
// government CMS (not WordPress, unlike the other two), rendering each
// volunteer role as an "<h2 class="subhead1">Role</h2><p>description</p>"
// pair rather than paragraph/<br> blocks or a <ul><li> list. Onboarding it
// required zero changes to lib/ingestion/normalize.ts, same as the second
// source — the normalizer's field-name-agnostic design keeps holding up.
//
// Safe to re-run: roles are matched by a deterministic external_id (slug
// of the role title), so a repeat run updates the same rows instead of
// duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "chesapeake_public_library";
const PAGE_URL = "https://www.chesapeakelibrary.org/volunteer";
const ORG_NAME = "Chesapeake Public Library";
const ORG_DESCRIPTION =
  "Public library system serving Chesapeake, VA across seven branch locations, running events/outreach, tutoring, teen, and studio (photography/video/sewing) volunteer programs.";
// The library system spans seven branches (each role notes its own
// branch in its description); geocoded to the system's Central Library,
// same convention as the other sources' single representative address.
const ORG_LOCATION = "298 Cedar Road, Chesapeake, VA 23322";
const ORG_ZIP = "23322";

// ---------- HTML parsing ----------
//
// The relevant section runs from the "Help us where we need it most!"
// intro through the start of the "Team up with Our Partners" CTA (a
// non-role section using the same <h2 class="subhead1"> heading style,
// which is why it has to be excluded by the end boundary rather than
// just matching every heading on the page). Each role is a heading
// immediately followed by its description paragraph; a few roles have a
// second "Applications Accepted: ..." paragraph after that, which the
// regex leaves alone since it only captures the first <p> after each <h2>.

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

type ParsedRole = { title: string; description: string; externalId: string };

function parseRoles(html: string): ParsedRole[] {
  const startIdx = html.indexOf("Help us where we need it most");
  const endIdx = html.indexOf("Team up with Our Partners", startIdx);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Couldn't find the volunteer roles section — the page layout may have changed.");
  }
  const section = html.slice(startIdx, endIdx);

  const roleRegex = /<h2 class="subhead1">([^<]+)<\/h2><p>([\s\S]*?)<\/p>/g;
  const roles: ParsedRole[] = [];
  let match: RegExpExecArray | null;
  while ((match = roleRegex.exec(section)) !== null) {
    const title = stripHtml(match[1]);
    const description = stripHtml(match[2]);
    if (!title || !description) continue;
    roles.push({ title, description, externalId: slugify(title) });
  }
  return roles;
}

// ---------- main ----------

export type ChesapeakeLibraryFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runChesapeakeLibraryFetch(
  supabase: SupabaseClient
): Promise<ChesapeakeLibraryFetchResult> {
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
): Promise<ChesapeakeLibraryFetchResult> {
  log(`Fetching ${PAGE_URL} ...`);
  const res = await fetch(PAGE_URL, {
    headers: {
      "User-Agent": "ServeFinderBot/1.0 (+manual research script, single run, not scheduled)",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const roles = parseRoles(html);
  log(`Parsed ${roles.length} volunteer roles from the page.`);
  if (roles.length === 0) {
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

  for (const role of roles) {
    const raw: RawListing = {
      title: role.title,
      description: role.description,
      location: ORG_LOCATION,
      external_id: role.externalId,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: PAGE_URL });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: role.externalId,
        title: role.title,
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
      embedding = await embed(role.description);
    } catch (err) {
      log(`Couldn't embed "${role.title}" — semantic matching will skip it for now: ${err}`);
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
        log(`FAILED to insert "${role.title}": ${error.message}`);
        continue;
      }
      log(`+ Created: ${role.title}`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${role.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${role.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(
        `- Skipped "${role.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (similarity ${dedup.similarity.toFixed(2)})`
      );
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: roles.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: roles.length, created, updated, skipped, orgId: org.id, logs };
}
