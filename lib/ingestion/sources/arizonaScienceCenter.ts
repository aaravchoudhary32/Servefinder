// Shared fetch logic for Arizona Science Center's volunteer opportunities
// page (azscience.org/support/volunteer-opportunities/). Used by both the
// manual CLI script (scripts/fetch-arizona-science-center.ts) and the
// weekly Vercel cron (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source in
// lib/ingestion/sources/.
//
// Added for content variety at an existing location, NOT geographic
// diversification: this address (600 E. Washington St, Phoenix, AZ 85004)
// is the same downtown Phoenix zip as the existing City of Phoenix STEM
// cluster (Burton Barr Central Library) — see ARCHITECTURE.md's "Known
// trade-offs" for the full research trail. It was investigated and
// initially set aside for exactly that reason when researching sources to
// fix STEM's single-location geography problem (Firewheel STEM Institute,
// in Chandler, was added for that instead) — this source is a separate,
// deliberate follow-up once the geography goal was already met elsewhere,
// picked up because its own content is real and well-structured.
//
// Plain fetch() + regex, not Playwright: checked live before writing any
// parsing code (same discipline as every other source) — a plain fetch()
// with our bot User-Agent gets a clean 200 with the full page, no login
// wall, no bot-blocking observed.
//
// Structurally closer to chesapeakeHumane.ts than to bgcCentralAZ.ts or
// firewheelStem.ts: the page is a genuinely discoverable Bootstrap
// accordion (<div class="accordion-item"> per role, a <button> holding the
// title, an <div class="accordion-body"> holding a real description plus
// a bulleted list of responsibilities) — parseRoles() below discovers the
// 6 roles from the markup itself rather than needing a hand-read,
// hardcoded list. Each role's public content (a real intro paragraph plus
// 1-3 concrete responsibility bullets) is detailed enough to stand on its
// own as an opportunity listing — confirmed by reading the actual parsed
// output before deciding this source didn't need to reach into the
// application system for more detail (see below).
//
// Applications route through a third-party Volgistics portal, same
// deliberate-exclusion posture as St. Mary's/Phoenix Rescue Mission's own
// booking systems: this fetcher only reads the org's own informational
// page, never that system. APPLICATION_URL below is the real Volgistics
// destination, hand-decoded once from the page's own link (which wraps it
// in a Google Docs redirect — `https://www.google.com/url?q=<real-url>&...`
// — not something worth parsing dynamically for one stable link, same
// reasoning as BGC's hardcoded PDF form URL).
//
// Age eligibility (15+) is a single site-wide statement in the page's own
// intro paragraph, above the accordion — not per-role — so it's applied
// uniformly to all 6 roles via MINIMUM_AGE, not left to
// extractMinimumAge()'s per-role inference.
//
// Safe to re-run: each role is matched by a deterministic external_id
// (slug of the role title), so a repeat run updates the same 6 rows
// instead of duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "arizona_science_center";
const PAGE_URL = "https://www.azscience.org/support/volunteer-opportunities/";
// Decoded once from the page's own Google-redirect-wrapped link (see file
// header) — the real Volgistics application portal, not scraped further.
const APPLICATION_URL = "https://www.volgistics.com/ex/portal.dll/ap?ap=2020407567";
const ORG_NAME = "Arizona Science Center";
const ORG_DESCRIPTION =
  "Hands-on science museum in downtown Phoenix relying on volunteers for guest services, administrative support, amateur radio and maker-space (CREATE) activity facilitation, and the Girls in STEM mentoring initiative.";
const ORG_LOCATION = "600 E. Washington St., Phoenix, AZ 85004";
const ORG_ZIP = "85004";
// Site-wide statement in the page's own intro paragraph ("If you are 15
// years or older... we would love to have you!"), not stated per role.
const MINIMUM_AGE = 15;

// ---------- HTML parsing ----------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exported for lib/ingestion/sources/arizonaScienceCenter.test.ts. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ParsedRole = { title: string; description: string; externalId: string };

// Matches each Bootstrap accordion item: the <button> holding the role
// title, then its <div class="accordion-body"> content (an intro
// paragraph plus a <ul> of responsibility bullets). Confirmed live against
// the real page before trusting this shape — 6 clean matches, no
// hand-read grouping needed (unlike bgcCentralAZ.ts/firewheelStem.ts).
// Exported for lib/ingestion/sources/arizonaScienceCenter.test.ts.
export function parseRoles(html: string): ParsedRole[] {
  const itemRegex =
    /accordion-button collapsed"\s+type="button"[^>]*>\s*([^<]+?)\s*<\/button>[\s\S]*?accordion-body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  const roles: ParsedRole[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html)) !== null) {
    const title = stripHtml(match[1]);
    const description = stripHtml(match[2]);
    if (!title || !description) continue;
    roles.push({ title, description, externalId: slugify(title) });
  }
  return roles;
}

// ---------- main ----------

export type ArizonaScienceCenterFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runArizonaScienceCenterFetch(
  supabase: SupabaseClient
): Promise<ArizonaScienceCenterFetchResult> {
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
): Promise<ArizonaScienceCenterFetchResult> {
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
    const raw: RawListing = {
      title: role.title,
      description: role.description,
      location: ORG_LOCATION,
      external_id: role.externalId,
      application_url: APPLICATION_URL,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: PAGE_URL });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;
    normalized.category = "STEM";
    // Explicit override, not left to extractMinimumAge()'s per-role
    // inference — see file header: this is a single site-wide statement
    // above the accordion, not phrased per role, so the regex has nothing
    // reliable to catch in any individual role's own description text.
    normalized.minimum_age = MINIMUM_AGE;

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
