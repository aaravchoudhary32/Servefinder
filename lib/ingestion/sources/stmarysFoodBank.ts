// Shared fetch logic for St. Mary's Food Bank's volunteer activities
// page. Used by both the manual CLI script
// (scripts/fetch-stmarys-foodbank.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source
// in lib/ingestion/sources/.
//
// Phoenix-area source: this org's own volunteer page describes the
// opportunities directly (Elementor "call-to-action" widgets — an
// <h4 class="elementor-cta__title">...</h4> followed by a
// <div class="elementor-cta__description">...</div>, repeated per
// activity). Their actual shift-booking system
// (stmarysfoodbank.volunteerhub.com) is a JS single-page app whose
// robots.txt disallows everything except a few account/event paths —
// deliberately not touched here; this fetcher only reads the
// informational activity cards on the org's own WordPress site.
//
// The same elementor-cta widget also renders three "who can volunteer"
// audience cards (Individuals & Families, Corporate Groups,
// Court-Ordered) earlier on the page, and those aren't opportunities —
// scoped out by slicing the HTML to the "Step Into Action: Volunteer
// Activities" section before matching, the same boundary-slice pattern
// the other sources use.
//
// Safe to re-run: each activity is matched by a deterministic
// external_id (slug of the activity title), so a repeat run updates the
// same four rows instead of duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "stmarysfoodbank";
const ORG_NAME = "St. Mary's Food Bank";
const ORG_DESCRIPTION =
  "The nation's first food bank, feeding families across Arizona since 1967. Runs food box packing, distribution, and mobile outreach volunteer shifts open to individuals, families, and teens.";
const ORG_LOCATION = "2831 N 31st Ave, Phoenix, AZ 85009";
const ORG_ZIP = "85009";
const PAGE_URL = "https://www.stmarysfoodbank.org/get-involved/volunteer/";

// A shared age policy sentence, appended to every activity's
// description so normalizeListing's text-based age extraction picks up
// a consistent minimum age across all four — the page states this once,
// not per-activity.
const AGE_POLICY_SENTENCE =
  "Volunteers must be at least 12 years old with an adult, or 16 years old without an adult.";

// ---------- HTML parsing ----------

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

type ParsedActivity = { title: string; description: string };

function parseActivities(html: string): ParsedActivity[] {
  const startIdx = html.indexOf("Step Into Action");
  const endIdx = html.indexOf("What to Know Before You Go");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return [];
  const section = html.slice(startIdx, endIdx);

  const cardRegex =
    /<h4 class="elementor-cta__title[^"]*"[^>]*>\s*([^<]+?)\s*<\/h4>[\s\S]{0,200}?<div class="elementor-cta__description[^"]*"[^>]*>\s*([^<]+?)\s*<\/div>/g;

  const activities: ParsedActivity[] = [];
  const seenTitles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(section)) !== null) {
    const title = stripHtml(match[1]);
    const description = stripHtml(match[2]);
    if (!title || !description || seenTitles.has(title)) continue;
    seenTitles.add(title);
    activities.push({ title, description });
  }
  return activities;
}

// ---------- main ----------

export type StmarysFoodBankFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runStmarysFoodBankFetch(
  supabase: SupabaseClient
): Promise<StmarysFoodBankFetchResult> {
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
): Promise<StmarysFoodBankFetchResult> {
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
  const activities = parseActivities(html);

  log(`Parsed ${activities.length} volunteer activities.`);
  if (activities.length === 0) {
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

  for (const activity of activities) {
    const externalId = slugify(activity.title);
    const description = `${activity.description} ${AGE_POLICY_SENTENCE}`;

    const raw: RawListing = {
      title: activity.title,
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
        title: activity.title,
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
      log(`Couldn't embed "${activity.title}" — semantic matching will skip it for now: ${err}`);
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
        log(`FAILED to insert "${activity.title}": ${error.message}`);
        continue;
      }
      log(`+ Created: ${activity.title}`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${activity.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${activity.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(
        `- Skipped "${activity.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (similarity ${dedup.similarity.toFixed(2)})`
      );
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: activities.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: activities.length, created, updated, skipped, orgId: org.id, logs };
}
