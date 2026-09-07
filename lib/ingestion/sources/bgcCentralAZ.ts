// Shared fetch logic for the Boys & Girls Club of Central Arizona's
// volunteer page (bgccaz.org/volunteer/). Used by both the manual CLI
// script (scripts/fetch-bgc-central-az.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source
// in lib/ingestion/sources/.
//
// Plain fetch() + regex, not Playwright: checked live before writing
// any parsing code (same discipline as Special Olympics AZ, which
// needed Playwright for the opposite reason) — robots.txt only
// disallows /wp-admin/, and a plain fetch() with our bot User-Agent
// gets a clean 200 with the full page. No WAF, no bot-blocking, no
// login wall. (robots.txt also requests a 10s crawl-delay between
// requests — this fetcher only ever makes the one request below per
// run, so there's nothing to space out.) The application itself is a
// static downloadable PDF form (emailed or dropped off in person) —
// that PDF is linked as application_url on every row, not something
// this fetcher parses or re-hosts.
//
// The real finding here, worth being explicit about: unlike every other
// source, this page has no discrete, structurally-delimited listings to
// discover. The entire "types of volunteers" content is one flat,
// unstructured <p> with <br/> line breaks — no headings, no per-category
// markup, no per-category link. There is no structural signal
// distinguishing a top-level category ("Character and Leadership") from
// its sub-items ("Mentoring Teens", "Service Projects") — that grouping
// below is a hand-read judgment call, not something a parser discovers.
// verifyCategoriesPresent() is the safeguard against that going stale
// silently: it fails loudly (a recorded ingestion_runs error, not a
// quietly-wrong result) if any expected category title disappears from
// the live page, which is the closest thing possible to a structural
// change alert on unstructured content.
//
// Safe to re-run: each category is matched by a deterministic
// external_id (slug of the category title), so a repeat run updates the
// same 7 rows instead of duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "bgc_central_az";
const PAGE_URL = "https://bgccaz.org/volunteer/";
const APPLICATION_FORM_URL = "https://bgccaz.org/wp-content/uploads/2024/02/BGCCAZ-Volunteer-Form.pdf";
const ORG_NAME = "Boys & Girls Club of Central Arizona";
const ORG_DESCRIPTION =
  "501(c)(3) nonprofit providing affordable after-school and summer programs for youth ages 6-17 in Prescott and Prescott Valley, focused on academic support, healthy lifestyles, character and citizenship, recreation, arts, and STEM.";
// Administrative offices + the Prescott Clubhouse; the Prescott Valley
// Clubhouse (8201 E Loos Dr, Prescott Valley, AZ 86314) hosts the exact
// same volunteer categories, per the page's own "Stop by either the
// Prescott or Prescott Valley Clubs" — one representative address for
// geocoding, same convention chesapeakeLibrary.ts uses for its own
// multi-branch system.
const ORG_LOCATION = "335 East Aubrey St., Prescott, AZ 86303";
const ORG_ZIP = "86303";
const LISTING_LOCATION = "Prescott & Prescott Valley, AZ";

type CategoryDef = {
  title: string;
  subItems: string[];
  // Set only where normalizeListing()'s shared inferCategory() can't be
  // trusted to land correctly — see the "The Arts" entry below for the
  // real case that motivated this, found live during verification, not
  // assumed up front.
  categoryOverride?: string;
};

// Hand-read from the page's own flat category list (see file header for
// why this can't be discovered structurally). Order and grouping match
// the live page as of the date this was written — verifyCategoriesPresent()
// below checks every title is still present on each run.
// Exported for lib/ingestion/sources/bgcCentralAZ.test.ts, so tests
// verify against the real list rather than a hand-duplicated copy that
// could drift from it.
export const CATEGORIES: CategoryDef[] = [
  { title: "Character and Leadership", subItems: ["Mentoring Teens", "Service Projects"] },
  { title: "Life Skills", subItems: ["Health and Wellness", "Yoga", "Healthy Eating", "Movement/exercise classes"] },
  { title: "Academic Enrichment", subItems: ["Tutoring/homework help", "Helping children read or reading to them"] },
  { title: "Sports & Recreation", subItems: ["Sports coach", "Assisting or leading games"] },
  { title: "STEM", subItems: ["Science projects", "Technology projects", "Engineering projects"] },
  {
    title: "The Arts",
    subItems: ["Performance Arts", "Instrument instruction", "Voice/singing coach", "Any art medium to teach", "Multimedia/technology"],
    // Caught live: inferCategory() scores this text a 1-1 tie between
    // "Arts & Culture" (from "art") and "STEM" (from "Multimedia/
    // technology"'s "technology") — ties go to whichever category is
    // earlier in CATEGORY_OPTIONS, and STEM sits before Arts & Culture
    // there, so this silently landed as STEM without an override.
    categoryOverride: "Arts & Culture",
  },
  { title: "Other Opportunities", subItems: ["Assisting administration", "Special events"] },
];

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

/** Exported for lib/ingestion/sources/bgcCentralAZ.test.ts. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Fails loudly rather than silently ingesting a stale hardcoded list —
 * see file header. Scoped to the "Types of Volunteers" paragraph
 * specifically (not the whole page) so a category name mentioned
 * elsewhere on the page can't produce a false pass. Exported for
 * lib/ingestion/sources/bgcCentralAZ.test.ts.
 */
export function verifyCategoriesPresent(html: string): void {
  const startIdx = html.indexOf("Types of Volunteers");
  if (startIdx === -1) {
    throw new Error("Couldn't find the \"Types of Volunteers\" section — the page layout may have changed.");
  }
  const endIdx = html.indexOf("</p>", startIdx);
  const section = html.slice(startIdx, endIdx === -1 ? startIdx + 4000 : endIdx);
  const plainText = stripHtml(section);

  for (const category of CATEGORIES) {
    if (!plainText.includes(category.title)) {
      throw new Error(
        `Expected category "${category.title}" not found on the page — the category list may have changed and this fetcher's hardcoded grouping needs review.`
      );
    }
  }
}

// ---------- main ----------

export type BgcCentralAZFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runBgcCentralAZFetch(supabase: SupabaseClient): Promise<BgcCentralAZFetchResult> {
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
): Promise<BgcCentralAZFetchResult> {
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

  verifyCategoriesPresent(html);
  log(`Verified all ${CATEGORIES.length} expected categories are still present on the page.`);

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

  for (const category of CATEGORIES) {
    const externalId = slugify(category.title);
    const description = `${category.title} volunteer opportunities at the Boys & Girls Club of Central Arizona. Includes: ${category.subItems.join(
      ", "
    )}. Ongoing club-based volunteering at the Prescott or Prescott Valley clubhouse — download and submit the volunteer application form to apply.`;

    const raw: RawListing = {
      title: category.title,
      description,
      location: LISTING_LOCATION,
      external_id: externalId,
      application_url: APPLICATION_FORM_URL,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: PAGE_URL });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;
    // Explicit override, not left to inferCommitmentType()'s keyword
    // regex: these are standing club volunteer roles (an ongoing
    // commitment to the club), not a dated one-time event, and the
    // description text has no reliable "recurring"/"weekly" keyword for
    // the regex to catch on its own — same reasoning as Special Olympics
    // AZ's explicit minimum_age override (ARCHITECTURE.md).
    normalized.commitment_type = "recurring";
    if (category.categoryOverride) {
      normalized.category = category.categoryOverride;
    }

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: externalId,
        title: category.title,
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
      log(`Couldn't embed "${category.title}" — semantic matching will skip it for now: ${err}`);
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
        log(`FAILED to insert "${category.title}": ${error.message}`);
        continue;
      }
      log(`+ Created: ${category.title}`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${category.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${category.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(
        `- Skipped "${category.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (similarity ${dedup.similarity.toFixed(2)})`
      );
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: CATEGORIES.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: CATEGORIES.length, created, updated, skipped, orgId: org.id, logs };
}
