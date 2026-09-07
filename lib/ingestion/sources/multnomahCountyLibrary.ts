// Connector for Multnomah County Library's Better Impact "MyImpactPage"
// volunteer portal (Portland, OR) — added during the nationwide-
// expansion pass. Same platform brand as lib/ingestion/sources/
// betterImpact.ts (Mesa/Gilbert/Sacramento), but a structurally
// different page shape: those are "PublicEnterprise" pages with a
// department/facet sidebar search (SearchType=SuitabilityClassification
// links carrying a numeric youth age); this is a flat
// "PublicOrganization" page that just lists every current activity
// directly on its own front page, with the age eligibility embedded
// in each activity's own display TITLE (confirmed live, e.g. "Albina
// Library: Follow the Reader (youth only, age 14-18)", "Northwest
// Library: Teen Space Youth Program Assistant (12-18 years old)") —
// never inferred from the description body, always a real number the
// org itself put in the title bar. A title with no numeric age at all
// (e.g. "Tween Council: Capitol Hill Library (youth only, grades 4-5)")
// is never guessed at — this connector only trusts a parseable numeric
// range, exactly like parseMinimumAgeFromSuitabilityLabel in
// betterImpact.ts.
//
// Verified live before writing this file:
//  - robots.txt for app.betterimpact.com disallows /Status/,
//    /Application/, /Content/, /Images/, /System/ — NOT
//    /PublicOrganization/, the path this connector reads (same
//    confirmed policy betterImpact.ts already documents).
//  - The front page (https://app.betterimpact.com/PublicOrganization/
//    b104d7d3-a313-4052-9a9d-6c685c8857aa) is plain server-rendered
//    HTML — confirmed via direct curl, no browser needed, unlike
//    betterImpact.ts's PublicEnterprise search (which needs a real
//    browser for its facet-driven results).
//  - Each activity has its own stable detail page
//    (/PublicOrganization/{orgGuid}/Gvi/{activityGuid}/1) with a full
//    description, specific address, and its own "Skills &
//    Qualifications" section restating the same age floor found in the
//    title (e.g. "Must be in 8th grade or be 14 or older (up to 18
//    years old)") — corroborating, not contradicting, the title-parsed
//    number.
//  - The site-wide "Fill in an application" button
//    (/Application?OrganizationGuid=...) is the SAME shared URL across
//    every activity (no per-activity ActivityGUID param) — a genuine
//    shared-portal link, not a distinct per-listing apply link like
//    Mesa/Gilbert/Sacramento's LoggedInApplicationRedirect URLs. Using
//    each activity's own distinct detail-page URL as application_url
//    instead avoids the shared-URL dedup ambiguity entirely (same
//    reasoning this file's sibling gives for Arizona Science Center's
//    Volgistics link / Firewheel STEM's Google Form) and is more useful
//    to a family besides — it shows the specific role before the
//    generic apply flow.
//
// Age floor: a bare numeric range with a lower bound below 13 (this
// app's platform-wide floor) is floored to 13, same convention as
// every other connector in this directory (e.g. HandsOn Greater
// Phoenix's resolveTeenEligibility). A range entirely below 13 (e.g.
// "Tween Council: Northwest Library (youth only, age 9-12)") has no
// age 13-18 it could ever cover, so it's excluded outright — never
// floored into a false "13" that the source itself never claimed. A
// bare "(age 18+)"/"(18 años)" listing (adult-only, no lower tier) is
// excluded too, same "18-with-no-lower-tier is adult-only" rule
// handsOnGreaterPhoenix.ts already established.
//
// Safe to re-run: each activity is matched by its own real activityGuid
// (from the Gvi URL), used as external_id — a repeat run updates the
// same rows instead of duplicating them, same convention as every
// other source in this directory.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "multnomah_county_library";
const ORG_NAME = "Multnomah County Library";
const ORG_DESCRIPTION =
  "Portland-area public library system coordinating volunteer roles across its branches — teen/tween reading and tech-help programs, Teen Council and Tween Council branch chapters, and adult programs — through its own MyImpactPage volunteer portal.";
const ORG_GUID = "b104d7d3-a313-4052-9a9d-6c685c8857aa";
const BASE = "https://app.betterimpact.com/PublicOrganization";
const LIST_URL = `${BASE}/${ORG_GUID}`;
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// Branch name (as it appears in a listing's own title) -> real,
// verified address, for listings whose Better Impact activity page
// left its own "Location:" field blank or unparseable even though the
// title names a specific branch. Personally verified against the
// library's own multcolib.org domain, not left unresolved when the
// branch is already unambiguous from the title. Anything not listed
// here still falls through to the existing "leave null rather than
// guess" behavior.
const KNOWN_BRANCH_ADDRESSES: Record<string, { address: string; zip: string }> = {
  "East County Library": { address: "475 NW Division St, Gresham, OR 97030", zip: "97030" },
};

function knownBranchAddress(title: string): { address: string; zip: string } | undefined {
  for (const [branch, info] of Object.entries(KNOWN_BRANCH_ADDRESSES)) {
    if (title.includes(branch)) return info;
  }
  return undefined;
}

type DiscoveredListing = { activityGuid: string; title: string; detailUrl: string };

/** Exported for lib/ingestion/sources/multnomahCountyLibrary.test.ts. */
export function extractListingsFromHomepage(html: string): DiscoveredListing[] {
  const results: DiscoveredListing[] = [];
  const seen = new Set<string>();
  const re = new RegExp(
    `<a href="(/PublicOrganization/${ORG_GUID}/Gvi/([a-f0-9-]+)/1)" class="regularLink">([^<]+)</a>`,
    "g"
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const [, path, activityGuid, rawTitle] = match;
    if (seen.has(activityGuid)) continue;
    seen.add(activityGuid);
    const title = rawTitle
      .replace(/&amp;/g, "&")
      .replace(/&#241;/g, "ñ")
      .replace(/&nbsp;/g, " ")
      .trim();
    results.push({ activityGuid, title, detailUrl: `https://app.betterimpact.com${path}` });
  }
  return results;
}

/**
 * Exported for lib/ingestion/sources/multnomahCountyLibrary.test.ts.
 * Parses a numeric age range from an activity's own display title
 * (e.g. "(youth only, age 14-18)", "(12-18 years old)"). Returns null
 * for a title with no parseable numeric range (grade-only labels like
 * "grades 4-6" are never guessed at). Returns null (not a floored
 * number) when the range's upper bound is below this app's platform
 * floor of 13 — that range covers no age this app ever serves, so
 * there's nothing honest to floor it to. Returns null for an "18+"-only
 * range with no lower tier — adult-only, same convention
 * handsOnGreaterPhoenix.ts already established for a bare 18.
 */
export function parseAgeRangeFromTitle(title: string): number | null {
  const rangeMatch = title.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (!rangeMatch) return null;
  const low = Number(rangeMatch[1]);
  const high = Number(rangeMatch[2]);
  if (high < 13) return null; // e.g. "age 9-12" — never covers a 13-18 platform user
  if (low >= 18) return null; // adult-only, no lower tier
  return Math.max(13, low);
}

type ListingDetail = {
  description: string;
  location: string | null;
};

async function fetchDetail(detailUrl: string): Promise<ListingDetail> {
  const res = await fetch(detailUrl, { headers: FETCH_HEADERS });
  if (!res.ok) return { description: "", location: null };
  const html = await res.text();

  const stripHtml = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&#241;/g, "ñ")
      .replace(/\s+/g, " ")
      .trim();

  // The description container runs from just after the activity title
  // (h1) through the "I would like to volunteer" apply button — bounded
  // scan rather than a full DOM parse, same pragmatic approach every
  // other regex-based connector in this directory uses.
  const bodyMatch = html.match(/<div class="standardContainer"[^>]*>([\s\S]*?)I would like to volunteer/);
  const bodyText = bodyMatch ? stripHtml(bodyMatch[1]) : "";
  const description = bodyText;

  // "Location:" and its value are plain sibling text within the same
  // element (no nested tag boundary between label and value, confirmed
  // live — e.g. "...Location: Central Library, 801 SW 10th Avenue,
  // Portland, OR 97205 Time Commitment: ..."), so this reads the value
  // out of the already-stripped body text rather than the raw HTML,
  // bounded by the next known field label (or end of string when a
  // listing has no following field).
  const locationMatch = bodyText.match(/Location:\s*([^:]*?)\s*(?:Time Commitment:|Age Requirement:|Available Shifts:|Tasks\s*&|$)/);
  const location = locationMatch && locationMatch[1].trim() ? locationMatch[1].trim() : null;

  return { description, location };
}

export type MultnomahCountyLibraryFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
  discovered: number;
  rejectedNoNumericAge: number;
};

export async function runMultnomahCountyLibraryFetch(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {}
): Promise<MultnomahCountyLibraryFetchResult> {
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  try {
    return await doFetch(supabase, log, logs, options);
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
  logs: string[],
  options: { dryRun?: boolean }
): Promise<MultnomahCountyLibraryFetchResult> {
  log(`Fetching ${LIST_URL} ...`);
  const res = await fetch(LIST_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Homepage fetch failed: HTTP ${res.status}`);
  const html = await res.text();

  const discovered = extractListingsFromHomepage(html);
  log(`Discovered ${discovered.length} current listings.`);

  const eligible: { listing: DiscoveredListing; minimumAge: number }[] = [];
  let rejectedNoNumericAge = 0;
  for (const listing of discovered) {
    const minimumAge = parseAgeRangeFromTitle(listing.title);
    if (minimumAge === null) {
      rejectedNoNumericAge++;
      continue;
    }
    eligible.push({ listing, minimumAge });
  }
  log(`${eligible.length} listing(s) have an explicit numeric age range reaching 13-18; ${rejectedNoNumericAge} rejected (no parseable number, entirely under 13, or adult-only 18+).`);

  if (options.dryRun) {
    log(`Dry run — ${eligible.length} candidate opportunities found, no database writes performed:`);
    for (const e of eligible) log(`  - ${e.listing.title} (min age ${e.minimumAge})`);
    return {
      parsed: eligible.length,
      created: 0,
      updated: 0,
      skipped: 0,
      orgId: null,
      logs,
      discovered: discovered.length,
      rejectedNoNumericAge,
    };
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

  const existing = await fetchExistingListings(supabase, { sourceSlug: SOURCE });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const { listing, minimumAge } of eligible) {
    const detail = await fetchDetail(listing.detailUrl);
    const knownBranch = !detail.location ? knownBranchAddress(listing.title) : undefined;

    const raw: RawListing = {
      title: listing.title,
      description: detail.description || "See the official listing page for the full description and application details.",
      location: detail.location ?? knownBranch?.address ?? null,
      external_id: listing.activityGuid,
      application_url: listing.detailUrl,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: listing.detailUrl });
    normalized.minimum_age = minimumAge; // source-confirmed via the listing's own title, never text-inferred

    if (detail.location) {
      const zipMatch = detail.location.match(/\b(\d{5})\b/);
      const coords = await geocodeStudentLocation(zipMatch?.[1] ?? null, detail.location);
      normalized.latitude = coords?.lat ?? null;
      normalized.longitude = coords?.lng ?? null;
    } else if (knownBranch) {
      const coords = await geocodeStudentLocation(knownBranch.zip, knownBranch.address);
      normalized.latitude = coords?.lat ?? null;
      normalized.longitude = coords?.lng ?? null;
    }

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: listing.activityGuid,
        title: listing.title,
        organizationName: ORG_NAME,
        applicationUrl: listing.detailUrl,
        applicationDeadline: normalized.application_deadline,
        location: normalized.location,
        minimumAge: normalized.minimum_age,
        sourceUrl: listing.detailUrl,
      },
      existing
    );

    let embedding: number[] | null = null;
    try {
      embedding = await embed(normalized.description ?? listing.title);
    } catch (err) {
      log(`Couldn't embed "${listing.title}" — semantic matching will skip it for now: ${err}`);
    }

    const payload = {
      ...normalized,
      organization_id: org.id,
      is_stale: false,
      embedding,
      // Each listing's own detail page states its current dates (e.g. a
      // specific fall/spring session) but not a sitewide "still
      // recruiting" signal this connector parses — same posture as
      // every other bulk connector in this directory: a human reviewer
      // confirms currency before approval.
      availability_status: "unverified",
    };

    if (!dedup) {
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${listing.title}": ${error.message}`);
        continue;
      }
      log(`+ Staged (pending review): ${listing.title} (min age ${minimumAge})`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${listing.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${listing.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(`- Skipped "${listing.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (${dedup.reason})`);
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: discovered.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return {
    parsed: eligible.length,
    created,
    updated,
    skipped,
    orgId: org.id,
    logs,
    discovered: discovered.length,
    rejectedNoNumericAge,
  };
}
