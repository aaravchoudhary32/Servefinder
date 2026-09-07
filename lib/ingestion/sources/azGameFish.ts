// Shared fetch logic for Arizona Game and Fish Department's public
// volunteer portal (volunteer.azgfd.gov), run on Galaxy Digital's "Get
// Connected" platform. Added during the accelerated-catalog-growth
// batch after a targeted technical-suitability audit (see
// ARCHITECTURE.md's "Accelerated catalog growth" section) found this
// was the one source, out of 48 investigated across municipal/library/
// government, national virtual-volunteering, food-bank, animal,
// healthcare, museum, youth-service, and environmental-network
// categories, with a genuinely structured, permissively-accessible,
// high-volume (~48-60 listings across a paginated grid) first-party
// surface — real stable per-opportunity IDs (`need_id`), real dated
// listings, no WAF/bot-block encountered, and a robots.txt that only
// disallows a long list of NAMED SEO/AI-scraper bots, leaving the
// wildcard `User-agent: *` entry fully open (`Disallow:` with nothing
// after it) — confirmed by direct fetch of
// https://volunteer.azgfd.gov/robots.txt before writing this file.
//
// Plain fetch() + regex, same as most sources in this directory: a
// realistic browser User-Agent gets a clean 200 with full server-
// rendered HTML, no Playwright needed (confirmed live — unlike
// cityOfPhoenix.ts or specialOlympicsAZ.ts, neither a JS-rendered SPA
// nor a WAF block was encountered here).
//
// Age policy: confirmed directly from the platform's own
// "New Volunteers Start Here" page (linked from every listing page's
// nav) — quoted verbatim: "Under age 18? A parent or legal guardian
// must be present at all times. Ages 13-17, create an account by
// selecting Sign Up... Federal regulations prohibit children under the
// age of 13 from creating an account." This is a real, confirmed,
// site-wide policy (not inferred, not per-listing) — MINIMUM_AGE below
// reflects it, and PARENT_PRESENCE_NOTE is included verbatim in every
// listing's description, the same "site-wide policy applied uniformly,
// stated plainly" pattern specialOlympicsAZ.ts already established for
// its own age note.
//
// Background checks: the platform's own "Qualifications" filter lists
// real credential types some (not all) listings require, including a
// "Level 1 Fingerprint Clearance Card" — a real background-check
// equivalent. Individual listing pages show their own specific
// qualifications, but the listing GRID (what this fetcher reads,
// avoiding ~50 additional per-listing detail-page requests) does not
// expose which specific listings require which qualifications. Per
// this project's "do not invent/assume" posture,
// backgroundCheckRequired is deliberately left undefined for every
// row here — never claimed present or absent — with a plain-language
// note in the description directing a student to check the specific
// listing's own "Qualifications" section before applying.
//
// Location: each card's own "excerpt" field usually reads as
// "Region N <City>" (AZGFD's own regional offices), but sometimes reads
// as a program name instead (e.g. "Desert Tortoise Adoption Program")
// with no city at all — a real, observed inconsistency in the source
// data, not a parsing bug. Only excerpts matching the "Region N <City>"
// pattern are geocoded; anything else is left ungeocoded (zip/city
// null) rather than guessing a location the source itself didn't state
// clearly enough to parse safely.
//
// Safe to re-run: each listing is matched by its own real `need_id`
// (a stable identifier Galaxy Digital itself assigns, visible in each
// card's detail-page link), used as external_id — a repeat run updates
// the same rows instead of duplicating them, same convention as every
// other source in this directory.
//
// New rows land as review_status: "pending" — see
// supabase/add_ingestion_source_registry_and_staging.sql — same staging
// gate every connector added since that migration already writes
// through.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation, type Coordinates } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "az_game_fish";
const ORG_NAME = "Arizona Game and Fish Department";
const ORG_DESCRIPTION =
  "State agency managing Arizona's wildlife and habitat, coordinating volunteers statewide for conservation projects, wildlife surveys, hatchery support, education programs, and more via its own Get Connected volunteer portal.";
const BASE_URL = "https://volunteer.azgfd.gov/need/";
// Safety cap on pagination, same reasoning as specialOlympicsAZ.ts's
// MAX_PAGES — protects against a config problem reporting an
// implausible page count, not a real expectation of ever needing more
// (the real count seen live was 4-5 pages of 12).
const MAX_PAGES = 15;

// Facility/program name -> real, verified address, for the "excerpt"
// categories that don't parse as "Region N <City>" (see this file's
// header) but are the department's own named, real facilities or
// programs — personally verified against azgfd.com and independent
// sources this session, not left unresolved. Keyed on the exact
// excerpt string the portal itself uses (embedded verbatim in each
// listing's own description). Anything not listed here still falls
// through to the existing "leave null rather than guess" behavior.
const KNOWN_FACILITY_ADDRESSES: Record<string, { address: string; zip: string }> = {
  "Sterling Springs Hatchery": { address: "13271 N State Rte 89A, Sedona, AZ 86336", zip: "86336" },
  "Verde Valley/Bubbling Ponds Fish Hatchery": { address: "1970 N Page Springs Rd, Cornville, AZ 86325", zip: "86325" },
  "Page Springs Hatchery": { address: "1600 N Page Springs Rd, Cornville, AZ 86325", zip: "86325" },
  "Silver Creek Hatchery": { address: "8800 Hatchery Rd, Show Low, AZ 85901", zip: "85901" },
  "Scholastic Clay Target Program": { address: "5060 W Skeet St, Phoenix, AZ 85086", zip: "85086" },
  "Desert Tortoise Adoption Program": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
  // Genuinely statewide programs with no single fixed site — the
  // department's own headquarters is used as the best-available
  // representative address, the same convention this session's other
  // statewide connectors (California Dept of Fish and Wildlife, Texas
  // Parks and Wildlife) use for their own org-level fallback location.
  "Statewide Shooting Ranges": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
  "National Archery in the Schools Program (NASP)": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
  "Snail Program": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
  "Hunter Education": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
  "Higher Education Students": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
  "Water for Wildlife - Water Development Projects": { address: "5000 W Carefree Hwy, Phoenix, AZ 85086", zip: "85086" },
};

const PARENT_PRESENCE_NOTE =
  "Arizona Game and Fish Department's own policy, stated plainly: volunteers under 18 may participate, but a parent or legal guardian must be present at all times. Ages 13-17 may create their own account (with a parent/guardian co-signing the registration form); federal law prohibits anyone under 13 from creating an account at all. Some listings require additional qualifications (for example, a Level 1 Fingerprint Clearance Card) — check this listing's own \"Qualifications\" section on the application page before applying; this was not confirmed either way for every listing here. Before applying, a minor should review the portal's own policies directly and involve a parent or guardian.";

type ParsedNeed = {
  title: string;
  excerpt: string;
  dateText: string | null;
  needId: string;
  detailUrl: string;
};

function extractNeeds(html: string): ParsedNeed[] {
  const results: ParsedNeed[] = [];
  const cardRe = /<div class="need\s*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  // The grid markup nests several closing </div> tags at different
  // depths depending on optional blocks (icon wrap, date, etc.) — a
  // single regex over the whole card is fragile, so instead this scans
  // for each detail-page anchor (which reliably carries need_id) and
  // looks at a bounded window of HTML around it for the title/date/
  // excerpt fields, rather than trying to precisely balance divs.
  const linkRe = /href="(https:\/\/volunteer\.azgfd\.gov\/need\/detail\/\?need_id=(\d+))"/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = linkRe.exec(html))) {
    const [, detailUrl, needId] = match;
    if (seen.has(needId)) continue;
    seen.add(needId);
    const windowEnd = html.indexOf('<div class="need ', match.index + 1);
    const chunk = html.slice(match.index, windowEnd > 0 ? windowEnd : match.index + 3000);

    const titleMatch = chunk.match(/<div class="title"\s*>\s*([\s\S]*?)\s*<\/div>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    const dateMatch = chunk.match(/<div class="date">[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
    const dateText = dateMatch ? dateMatch[1].trim() : null;

    const excerptMatch = chunk.match(/<div class="excerpt">([\s\S]*?)<\/div>/);
    const excerpt = excerptMatch ? excerptMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    if (title) {
      results.push({ title, excerpt, dateText, needId, detailUrl });
    }
  }
  return results;
}

function readLastPage(html: string): number {
  const lastMatch = html.match(/href='\/need\/index\/(\d+)'>Last<\/a>/);
  if (!lastMatch) return 1;
  const lastOffset = Number(lastMatch[1]);
  // Offsets are 0/12/24/... (page size 12) — convert to a page count.
  return Number.isFinite(lastOffset) && lastOffset > 0 ? Math.floor(lastOffset / 12) + 1 : 1;
}

/** Exported for lib/ingestion/sources/azGameFish.test.ts. Only excerpts
 * that clearly read as "Region N <City>" are treated as a real,
 * geocodable location — anything else (a program name, empty string)
 * returns null rather than guessing. */
export function parseRegionCity(excerpt: string): string | null {
  const match = excerpt.match(/^Region\s+\d+\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Exported for tests. Converts the portal's own "MMM D, YYYY[ through MMM D, YYYY]"
 * date text to an ISO deadline (the END date, i.e. the last day the
 * opportunity is still active — closest fit to this app's single
 * application_deadline field), or null if unparseable. Never guesses a
 * date the source didn't actually state. */
export function parseNeedDateRange(dateText: string | null): string | null {
  if (!dateText) return null;
  const parts = dateText.split(/\s+through\s+/i);
  const last = parts[parts.length - 1].trim();
  const match = last.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const monthIndex = months[match[1].slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) return null;
  const yyyy = match[3];
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = match[2].padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type AZGameFishFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runAZGameFishFetch(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {}
): Promise<AZGameFishFetchResult> {
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  try {
    return await doFetch(supabase, log, options, logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!options.dryRun) {
      await recordIngestionRun(supabase, {
        source: SOURCE,
        status: "error",
        listingsFound: 0,
        listingsInserted: 0,
        listingsUpdated: 0,
        listingsSkippedDuplicate: 0,
        errorMessage: message,
      });
    }
    throw err;
  }
}

async function doFetch(
  supabase: SupabaseClient,
  log: (line: string) => void,
  options: { dryRun?: boolean },
  logs: string[]
): Promise<AZGameFishFetchResult> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  };

  log(`Fetching ${BASE_URL} ...`);
  const firstRes = await fetch(BASE_URL, { headers });
  if (!firstRes.ok) throw new Error(`AZGFD listing page returned HTTP ${firstRes.status}`);
  const firstHtml = await firstRes.text();

  const allNeeds = extractNeeds(firstHtml);
  const totalPages = Math.min(readLastPage(firstHtml), MAX_PAGES);
  log(`Site reports ${totalPages} page(s) of results.`);

  for (let page = 1; page < totalPages; page++) {
    const offset = page * 12;
    const url = `${BASE_URL}index/${offset}`;
    log(`Fetching ${url} ...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      log(`Page at offset ${offset} returned HTTP ${res.status} — stopping pagination here.`);
      break;
    }
    const html = await res.text();
    allNeeds.push(...extractNeeds(html));
  }

  log(`Parsed ${allNeeds.length} listings across all pages.`);

  if (options.dryRun) {
    log("Dry run — no database writes performed.");
    return {
      parsed: allNeeds.length,
      created: 0,
      updated: 0,
      skipped: 0,
      orgId: null,
      logs,
    };
  }

  if (allNeeds.length === 0) {
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

  let { data: org } = await supabase.from("organizations").select("id, name").eq("name", ORG_NAME).maybeSingle();
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

  const coordsCache = new Map<string, Coordinates | null>();
  async function coordsForCity(city: string): Promise<Coordinates | null> {
    if (coordsCache.has(city)) return coordsCache.get(city) ?? null;
    const coords = await geocodeStudentLocation(null, `${city}, AZ`);
    coordsCache.set(city, coords);
    return coords;
  }

  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const need of allNeeds) {
    const city = parseRegionCity(need.excerpt);
    const knownFacility = !city ? KNOWN_FACILITY_ADDRESSES[need.excerpt] : undefined;
    const isoDeadline = parseNeedDateRange(need.dateText);

    const description = [
      `${need.excerpt || "Statewide"} volunteer opportunity with the Arizona Game and Fish Department.`,
      need.dateText ? `Scheduled: ${need.dateText}.` : null,
      "See the official listing page for the full description, exact meeting location, and any specific qualifications required.",
      PARENT_PRESENCE_NOTE,
    ]
      .filter(Boolean)
      .join(" ");

    const raw: RawListing = {
      title: need.title,
      description,
      location: city ?? knownFacility?.address ?? null,
      external_id: need.needId,
      application_url: need.detailUrl,
      application_deadline: isoDeadline,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: BASE_URL });
    // Site-wide policy override, not left to normalizeListing()'s
    // regex-based inference over free text — same reasoning as
    // specialOlympicsAZ.ts's own MINIMUM_AGE override: the real,
    // confirmed rule ("13-17 with a parent/guardian present, under-13
    // cannot even create an account") isn't a plain "X+" pattern.
    normalized.minimum_age = 13;
    normalized.commitment_type = "one_time";

    if (city) {
      const coords = await coordsForCity(city);
      normalized.latitude = coords?.lat ?? null;
      normalized.longitude = coords?.lng ?? null;
    } else if (knownFacility) {
      const coords = await geocodeStudentLocation(knownFacility.zip, knownFacility.address);
      normalized.latitude = coords?.lat ?? null;
      normalized.longitude = coords?.lng ?? null;
    }

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: need.needId,
        title: need.title,
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
      log(`Couldn't embed "${need.title}" — semantic matching will skip it for now: ${err}`);
    }

    const payload = {
      ...normalized,
      organization_id: org.id,
      is_stale: false,
      embedding,
      // Confirmed directly from the portal's own policy (see this
      // file's header) — a parent/guardian must be present at all
      // times for any volunteer under 18, not merely a one-time
      // consent form. Set explicitly, same convention as the
      // Education batch's NFTE/ENGin records: a real, confirmed
      // requirement, not left ambiguous.
      parental_consent_required: true,
    };

    if (!dedup) {
      // New rows from automated ingestion start in review_status
      // "pending" — a human must approve before this becomes publicly
      // visible (see supabase/add_ingestion_source_registry_and_staging.sql).
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${need.title}": ${error.message}`);
        continue;
      }
      log(`+ Staged (pending review): ${need.title} (${need.excerpt || "no region"})`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${need.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${need.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(
        `- Skipped "${need.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (${dedup.reason}, similarity ${dedup.similarity.toFixed(2)})`
      );
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: allNeeds.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: allNeeds.length, created, updated, skipped, orgId: org.id, logs };
}
