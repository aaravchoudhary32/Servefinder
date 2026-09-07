// Shared fetch logic for Phoenix Rescue Mission's volunteer roles page.
// Used by both the manual CLI script
// (scripts/fetch-phoenix-rescue-mission.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source
// in lib/ingestion/sources/.
//
// Phoenix-area source: a Kadence-block WordPress page where each role is
// an <h2 class="kt-adv-heading...">Title</h2> (title sometimes wrapped
// in one to three nested <strong> tags — stripped rather than matched
// literally) immediately followed by a
// <p class="has-text-align-center wp-block-paragraph">Description</p>.
// Their actual shift-booking system (prm.volunteerhub.com) is a JS
// single-page app whose robots.txt disallows everything except a few
// account/event paths — deliberately not touched here; this fetcher
// only reads the informational role cards on the org's own site.
//
// The same heading+paragraph pattern also wraps the page's intro blurb
// and a trailing "Other / contact us" card — scoped out by slicing the
// HTML between the first role heading and the "Other" card before
// matching, the same boundary-slice pattern the other sources use.
//
// The page states two different minimum ages in one shared FAQ blurb
// (12 for the Food Bank specifically, 14 for "any type of food
// service") rather than per-role — ROLE_MIN_AGE below maps each parsed
// role to the age that FAQ text implies for it, and that sentence is
// appended to the role's description so normalizeListing's text-based
// age extraction picks up the right number per role.
//
// Safe to re-run: each role is matched by a deterministic external_id
// (slug of the role title), so a repeat run updates the same four rows
// instead of duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "phoenixrescuemission";
const ORG_NAME = "Phoenix Rescue Mission";
const ORG_DESCRIPTION =
  "Faith-based organization serving people experiencing homelessness, addiction, and food insecurity across the Phoenix metro area. Volunteer roles include food bank, mobile pantry, and community event service, open to minors with a signed youth authorization and an accompanying adult.";
// Hope for Hunger Food Bank — the org's own FAQ calls this "the most
// common volunteer role," so it's the best single anchor point for
// geocoding all four (multi-site) roles.
const ORG_LOCATION = "5605 N 55th Ave, Glendale, AZ 85301";
const ORG_ZIP = "85301";
const PAGE_URL = "https://phoenixrescuemission.org/get-involved/volunteer/";

const ROLE_MIN_AGE: Record<string, number> = {
  "Volunteer at Our Food Bank": 12,
  "Volunteer at Our Mobile Pantries": 14,
  "Serve Clients in our Recovery Programs": 14,
  "Volunteer at Our Community Events": 14,
};
const DEFAULT_ROLE_MIN_AGE = 14;

function ageSentenceFor(title: string): string {
  const age = ROLE_MIN_AGE[title] ?? DEFAULT_ROLE_MIN_AGE;
  return `Minimum age ${age} to volunteer; minors must have a signed Youth Volunteer Authorization and be accompanied by an adult.`;
}

// ---------- HTML parsing ----------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
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

type ParsedRole = { title: string; description: string };

function parseRoles(html: string): ParsedRole[] {
  const startIdx = html.indexOf("Volunteer at Our Food Bank");
  const endIdx = html.indexOf(">Other<");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return [];
  const section = html.slice(Math.max(0, startIdx - 200), endIdx);

  const cardRegex =
    /<h2 class="kt-adv-heading[^"]*"[^>]*>([\s\S]*?)<\/h2>\s*<p class="has-text-align-center wp-block-paragraph">([\s\S]*?)<\/p>/g;

  const roles: ParsedRole[] = [];
  const seenTitles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(section)) !== null) {
    const title = stripHtml(match[1]);
    const description = stripHtml(match[2]);
    if (!title || !description || title === "Other" || seenTitles.has(title)) continue;
    seenTitles.add(title);
    roles.push({ title, description });
  }
  return roles;
}

// ---------- main ----------

export type PhoenixRescueMissionFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runPhoenixRescueMissionFetch(
  supabase: SupabaseClient
): Promise<PhoenixRescueMissionFetchResult> {
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
): Promise<PhoenixRescueMissionFetchResult> {
  log(`Fetching ${PAGE_URL} ...`);
  const res = await fetch(PAGE_URL, {
    headers: {
      "User-Agent": "ServeFinderBot/1.0 (+manual research script, single run, not scheduled)",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed for ${PAGE_URL}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const roles = parseRoles(html);

  log(`Parsed ${roles.length} volunteer roles.`);
  if (roles.length === 0) {
    log("Nothing to ingest — the page layout may have changed.");
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

  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const role of roles) {
    const externalId = slugify(role.title);
    const description = `${role.description} ${ageSentenceFor(role.title)}`;

    const raw: RawListing = {
      title: role.title,
      description,
      location: ORG_LOCATION,
      external_id: externalId,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: PAGE_URL });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: externalId,
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
      embedding = await embed(description);
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
