// Reusable connector for Wisconsin Humane Society Better Impact
// "MyImpactPage" campus tenants — generalized during Phase 2 of the
// nationwide-expansion pass after Milwaukee Campus turned out to be a
// SECOND, separate Better Impact tenant using the identical title-
// annotation convention already built for Green Bay Campus (both single-
// location PublicOrganization pages). Config-driven (see
// WISCONSIN_HUMANE_SOCIETY_SOURCES below), same shape betterImpact.ts
// already established for Mesa/Gilbert/Sacramento — adding a third WHS
// campus is a new config entry, not new code.
//
// Every campus combines BOTH age tiers into ONE title rather than two
// separate listings, e.g. "Animal Care Volunteer Dog (13-15-year-olds
// with an adult, 16+ years solo)" — confirmed live on both campuses.
// Some roles instead carry a single "(16+ years)" tier, and a few are
// genuinely adult-only ("(18+ years)"/"(18 years)", e.g. Animal
// Transport Volunteer, Foster) with no lower tier at all — those are
// excluded, same "bare 18-or-higher with no lower tier is adult-only"
// rule handsOnGreaterPhoenix.ts already established. A title with no
// parenthetical at all (e.g. "Youth Programs Volunteer", "Telemundo
// Media Presenter") is never guessed at.
//
// Two different link markups were found across campuses (same two
// shapes lib/ingestion/sources/humaneSocietySiteWidePolicy.ts already
// documented for Belleville vs. Kansas): Green Bay uses
// `class="regularLink"` with the title as the link's own text; Milwaukee
// uses `title="Continue to X"` with the link text just "Continue...".
// extractListingsFromHomepage() below tries both patterns per tenant and
// merges the (deduplicated) results, so one connector works for either
// shape without a per-tenant code branch.
//
// IMPORTANT: Milwaukee Campus (guid 18b8ebe6-8399-4686-8474-3159b09762d3)
// is a DIFFERENT tenant from the main Wisconsin Humane Society org (guid
// 8f91b4b2-a476-43ae-80ea-9dae7bb79fcb), which runs the Wildlife
// Rehabilitation Center specifically and is confirmed 18+-only
// ("Volunteers need to be 18 years old to help in the Wildlife
// Rehabilitation Center") — not teen-eligible, and not read by either
// config entry here.
//
// Verified live before adding each config entry:
//  - robots.txt for app.betterimpact.com disallows /Status/,
//    /Application/, /Content/, /Images/, /System/ — NOT
//    /PublicOrganization/, the path this connector reads (same policy
//    already documented in every sibling connector in this directory).
//  - Each campus's homepage and every activity's own detail page are
//    plain server-rendered HTML — confirmed via direct curl, no browser
//    needed.
//  - Neither campus's detail pages carry a "Location:" field — each is a
//    single physical campus, so every eligible activity there uses the
//    same real, independently-verified street address rather than one
//    parsed per-listing.
//
// Safe to re-run: each activity is matched by its own real activityGuid
// (from the Gvi URL), used as external_id — a repeat run updates the
// same rows instead of duplicating them, same convention as every other
// source in this directory.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

export type WisconsinHumaneSocietySourceConfig = {
  sourceSlug: string;
  orgName: string;
  orgDescription: string;
  orgGuid: string;
  campusAddress: string;
  campusZip: string;
  campusCity: string;
};

// New campuses go here, not as new files — see this file's header.
export const WISCONSIN_HUMANE_SOCIETY_SOURCES: WisconsinHumaneSocietySourceConfig[] = [
  {
    sourceSlug: "wisconsin_humane_society_green_bay",
    orgName: "Wisconsin Humane Society — Green Bay Campus",
    orgDescription:
      "Animal shelter serving the Green Bay, WI area — animal care, dog walking, adoption, foster, and event volunteer roles, coordinated through its own MyImpactPage volunteer portal. A separate Better Impact tenant from the main Wisconsin Humane Society org, which runs an 18+-only Wildlife Rehabilitation Center program not covered here.",
    orgGuid: "ef99b4e4-595b-4d31-b202-ea252a122159",
    campusAddress: "1830 Radisson St, Green Bay, WI 54302",
    campusZip: "54302",
    campusCity: "Green Bay, WI",
  },
  {
    sourceSlug: "wisconsin_humane_society_milwaukee",
    orgName: "Wisconsin Humane Society — Milwaukee Campus",
    orgDescription:
      "Animal shelter serving the Milwaukee, WI area — animal care, dog walking, adoption, spay/neuter clinic support, and outreach volunteer roles, coordinated through its own MyImpactPage volunteer portal. A separate Better Impact tenant from the main Wisconsin Humane Society org, which runs an 18+-only Wildlife Rehabilitation Center program not covered here.",
    orgGuid: "18b8ebe6-8399-4686-8474-3159b09762d3",
    campusAddress: "4500 W. Wisconsin Ave, Milwaukee, WI 53208",
    campusZip: "53208",
    campusCity: "Milwaukee, WI",
  },
  // Phase 2 continuation: 3 more WHS campuses, confirmed live with the
  // identical title-embedded age pattern — addresses confirmed directly
  // via the org's own wihumane.org/about-us/hours-locations page.
  {
    sourceSlug: "wisconsin_humane_society_ozaukee",
    orgName: "Wisconsin Humane Society — Ozaukee Campus",
    orgDescription:
      "Animal shelter serving the Ozaukee County, WI area — animal care, dog walking, adoption, and youth leadership volunteer roles, coordinated through its own MyImpactPage volunteer portal. A separate Better Impact tenant from the main Wisconsin Humane Society org.",
    orgGuid: "67e4fe3e-5e5c-4000-bcf2-c7106a462751",
    campusAddress: "630 West Dekora St, Saukville, WI 53080",
    campusZip: "53080",
    campusCity: "Saukville, WI",
  },
  {
    sourceSlug: "wisconsin_humane_society_door_county",
    orgName: "Wisconsin Humane Society — Door County Campus",
    orgDescription:
      "Animal shelter serving the Door County, WI area — animal care, dog walking, adoption, and transport volunteer roles, coordinated through its own MyImpactPage volunteer portal. A separate Better Impact tenant from the main Wisconsin Humane Society org.",
    orgGuid: "3748295f-4c2b-43c0-805d-9b76022cfea0",
    campusAddress: "3475 Park Dr, Sturgeon Bay, WI 54235",
    campusZip: "54235",
    campusCity: "Sturgeon Bay, WI",
  },
  {
    sourceSlug: "wisconsin_humane_society_kenosha",
    orgName: "Wisconsin Humane Society — Kenosha Campus",
    orgDescription:
      "Animal shelter serving the Kenosha, WI area — animal care, dog walking, adoption, and enrichment volunteer roles, coordinated through its own MyImpactPage volunteer portal. A separate Better Impact tenant from the main Wisconsin Humane Society org.",
    orgGuid: "efa8fe2b-132f-4f5e-bcc3-bf32b2ed69a1",
    campusAddress: "7811 60th Ave, Kenosha, WI 53142",
    campusZip: "53142",
    campusCity: "Kenosha, WI",
  },
];

const BASE = "https://app.betterimpact.com/PublicOrganization";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

type DiscoveredListing = { activityGuid: string; title: string; detailUrl: string };

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#160;/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Exported for lib/ingestion/sources/wisconsinHumaneSocietyGreenBay.test.ts. */
export function extractListingsFromHomepage(html: string, orgGuid: string): DiscoveredListing[] {
  const results: DiscoveredListing[] = [];
  const seen = new Set<string>();

  const linkTextPattern = new RegExp(`<a href="(/PublicOrganization/${orgGuid}/Gvi/([a-f0-9-]+)/1)" class="regularLink">([^<]+)</a>`, "g");
  let match: RegExpExecArray | null;
  while ((match = linkTextPattern.exec(html))) {
    const [, path, activityGuid, rawTitle] = match;
    if (seen.has(activityGuid)) continue;
    seen.add(activityGuid);
    results.push({ activityGuid, title: decodeEntities(rawTitle), detailUrl: `https://app.betterimpact.com${path}` });
  }

  const titleAttrPattern = new RegExp(`<a href="(/PublicOrganization/${orgGuid}/Gvi/([a-f0-9-]+)/1)" title="Continue to ([^"]+)">Continue\\.\\.\\.</a>`, "g");
  while ((match = titleAttrPattern.exec(html))) {
    const [, path, activityGuid, rawTitle] = match;
    if (seen.has(activityGuid)) continue;
    seen.add(activityGuid);
    results.push({ activityGuid, title: decodeEntities(rawTitle), detailUrl: `https://app.betterimpact.com${path}` });
  }

  return results;
}

/**
 * Exported for lib/ingestion/sources/wisconsinHumaneSocietyGreenBay.test.ts.
 * Parses a numeric age floor from an activity's own trailing title
 * parenthetical. Handles both shapes found live: a combined two-tier
 * phrasing ("13-15-year-olds with an adult, 16+ years solo" — the
 * lowest number found, 13, is the real floor), and a single-tier
 * phrasing ("16+ years"). Returns null for no parenthetical or no
 * parseable number, and null (not a floored number) for a bare 18-or-
 * higher floor with no lower tier ("18+ years"/"18 years") — adult-only,
 * same convention handsOnGreaterPhoenix.ts already established for a
 * bare 18.
 */
export function parseAgeFromTitle(title: string): number | null {
  const paren = title.match(/\(([^)]*)\)\s*$/);
  if (!paren) return null;
  const inner = paren[1];
  if (!/year|\+/i.test(inner)) return null;
  const numbers = inner.match(/\d{1,2}/g);
  if (!numbers || numbers.length === 0) return null;
  const low = Math.min(...numbers.map(Number));
  if (low >= 18) return null; // adult-only, no lower tier
  return Math.max(13, low);
}

async function fetchDescription(detailUrl: string): Promise<string> {
  const res = await fetch(detailUrl, { headers: FETCH_HEADERS });
  if (!res.ok) return "";
  const html = await res.text();
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#160;/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  const startIdx = stripped.indexOf("Back to Activity List");
  const endIdx = stripped.indexOf("I would like to volunteer");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return "";
  // Skip the first line after the marker (repeats the activity's own
  // title, already captured elsewhere).
  const lines = stripped.slice(startIdx, endIdx).split("\n").filter(Boolean);
  return lines.slice(2).join(" ").replace(/\s+/g, " ").trim();
}

export type WisconsinHumaneSocietyFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
  discovered: number;
  rejectedNoNumericAge: number;
};

export async function runWisconsinHumaneSocietyFetch(
  supabase: SupabaseClient,
  config: WisconsinHumaneSocietySourceConfig,
  options: { dryRun?: boolean } = {}
): Promise<WisconsinHumaneSocietyFetchResult> {
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  try {
    return await doFetch(supabase, config, log, logs, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!options.dryRun) {
      await recordIngestionRun(supabase, {
        source: config.sourceSlug,
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
  config: WisconsinHumaneSocietySourceConfig,
  log: (line: string) => void,
  logs: string[],
  options: { dryRun?: boolean }
): Promise<WisconsinHumaneSocietyFetchResult> {
  const listUrl = `${BASE}/${config.orgGuid}/1`;
  log(`Fetching ${listUrl} ...`);
  const res = await fetch(listUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Homepage fetch failed: HTTP ${res.status}`);
  const html = await res.text();

  const discovered = extractListingsFromHomepage(html, config.orgGuid);
  log(`Discovered ${discovered.length} current listings.`);

  const eligible: { listing: DiscoveredListing; minimumAge: number }[] = [];
  let rejectedNoNumericAge = 0;
  for (const listing of discovered) {
    const minimumAge = parseAgeFromTitle(listing.title);
    if (minimumAge === null) {
      rejectedNoNumericAge++;
      continue;
    }
    eligible.push({ listing, minimumAge });
  }
  log(`${eligible.length} listing(s) have an explicit numeric age reaching 13-18; ${rejectedNoNumericAge} rejected (no parseable age, or adult-only 18+ with no lower tier).`);

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

  let { data: org } = await supabase.from("organizations").select("id, name").eq("name", config.orgName).maybeSingle();
  if (!org) {
    const { data: newOrg, error } = await supabase
      .from("organizations")
      // Ingestion-created orgs are auto-verified per this app's own
      // documented intent (supabase/add_org_verification_enforcement.sql
      // grandfathered every scraped-source org at rollout) — `verified`
      // gates public visibility and exists to hold back genuine
      // self-signup orgs (/onboarding/organization) for admin review,
      // not a controlled, code-reviewed connector like this one.
      .insert({ name: config.orgName, description: config.orgDescription, verified: true })
      .select("id, name")
      .single();
    if (error || !newOrg) throw new Error(`Couldn't create organization: ${error?.message}`);
    org = newOrg;
    log(`Created organization "${config.orgName}" (${org.id}).`);
  } else {
    log(`Found existing organization "${config.orgName}" (${org.id}).`);
  }

  const coords = await geocodeStudentLocation(config.campusZip, config.campusCity);
  log(coords ? `Geocoded ${config.campusZip} -> ${coords.lat}, ${coords.lng}` : `Couldn't geocode ${config.campusZip} — listings will have no coordinates.`);

  const existing = await fetchExistingListings(supabase, { sourceSlug: config.sourceSlug });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const { listing, minimumAge } of eligible) {
    const description = await fetchDescription(listing.detailUrl);

    const raw: RawListing = {
      title: listing.title,
      description: description || "See the official listing page for the full description and application details.",
      location: config.campusAddress,
      external_id: listing.activityGuid,
      application_url: listing.detailUrl,
    };

    const normalized = normalizeListing(raw, { source: config.sourceSlug, sourceUrl: listing.detailUrl });
    normalized.minimum_age = minimumAge; // source-confirmed via the listing's own title, never text-inferred
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

    const dedup = findDuplicate(
      {
        source: config.sourceSlug,
        external_id: listing.activityGuid,
        title: listing.title,
        organizationName: config.orgName,
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
    source: config.sourceSlug,
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

export async function runWisconsinHumaneSocietyGreenBayFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runWisconsinHumaneSocietyFetch(supabase, WISCONSIN_HUMANE_SOCIETY_SOURCES[0], options);
}

export async function runWisconsinHumaneSocietyMilwaukeeFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runWisconsinHumaneSocietyFetch(supabase, WISCONSIN_HUMANE_SOCIETY_SOURCES[1], options);
}

export async function runWisconsinHumaneSocietyOzaukeeFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runWisconsinHumaneSocietyFetch(supabase, WISCONSIN_HUMANE_SOCIETY_SOURCES[2], options);
}

export async function runWisconsinHumaneSocietyDoorCountyFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runWisconsinHumaneSocietyFetch(supabase, WISCONSIN_HUMANE_SOCIETY_SOURCES[3], options);
}

export async function runWisconsinHumaneSocietyKenoshaFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runWisconsinHumaneSocietyFetch(supabase, WISCONSIN_HUMANE_SOCIETY_SOURCES[4], options);
}
