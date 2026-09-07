// Connector for San Mateo County Libraries' Better Impact "MyImpactPage"
// volunteer portal (San Mateo County, CA) — added during the
// nationwide-expansion pass. Same platform brand as
// lib/ingestion/sources/betterImpact.ts (Mesa/Gilbert/Sacramento), but
// yet another structurally different shape: this tenant has NO youth
// SuitabilityClassification facets at all (confirmed live — its "Other
// Factors" sidebar only has "Suitable for Groups" and "Suitable for
// Seniors"), so age eligibility can't be discovered the way Mesa/
// Gilbert/Sacramento are. Instead, like Multnomah County Library
// (lib/ingestion/sources/multnomahCountyLibrary.ts), the real numeric
// age is embedded directly in each activity's own display TITLE — but
// here the org runs the SAME small set of role types (Library Helper,
// Maker Volunteer, Friends of the Library, Adult Programming Volunteer,
// Youth & Family Programming Assistant) at MULTIPLE branch libraries,
// each posted twice per branch: once for "14-15 years old" and once for
// "16 and older" — e.g. "Library Helper (14-15 years old)" and "Library
// Helper (16 and older)" at the same branch are two distinct, separately
// listed and separately applied-to roles, not one role with a range.
//
// Verified live before writing this file:
//  - robots.txt for app.betterimpact.com disallows /Status/,
//    /Application/, /Content/, /Images/, /System/ — NOT
//    /PublicEnterprise/, the path this connector reads (same policy
//    already documented in betterImpact.ts and
//    multnomahCountyLibrary.ts).
//  - Both the enterprise homepage and each branch's EnterpriseSearch
//    results page (?SearchType=Organization&SearchId={n}, one per
//    branch) are plain server-rendered HTML — confirmed via direct
//    curl, no browser needed.
//  - Each activity's own detail page (EnterpriseActivity?...&
//    activityGuid=...) restates the same age floor in a structured
//    "Qualifications Required" field (e.g. "What age category do you
//    belong to? Must be at least 14-15") — corroborating, not
//    contradicting, the title-parsed number.
//  - Each activity has a real per-activity apply link
//    (LoggedInApplicationRedirect?...&ActivityGUID=...), same as Mesa/
//    Gilbert/Sacramento — no shared-portal ambiguity here.
//
// Age parsing: only the trailing parenthetical of a title is trusted
// (e.g. "(14-15 years old)", "(16 and older)", "(14 and 15 years
// old)", "(14-15 year olds)") — a title with no such parenthetical, or
// one that doesn't parse to a number, is never guessed at (e.g. "Adult
// Literacy Tutor" and "FOL Board - Adult" were confirmed live to have
// no age parenthetical at all and are correctly skipped). Same
// platform-floor-of-13 flooring convention as every other connector in
// this directory, though in practice every real age found here (14+)
// is already at or above it.
//
// "Countywide Programs" is a real branch/department in this org's own
// sidebar but has no single physical address (it's the org's
// system-wide programs, not a physical branch) — any activity found
// under it is deliberately left ungeocoded rather than assigned a
// guessed address, same convention as Future Stars AZ in
// lib/manualRecords.ts.
//
// Safe to re-run: each activity is matched by its own real activityGuid
// (from the EnterpriseActivity URL), used as external_id — a repeat
// run updates the same rows instead of duplicating them, same
// convention as every other source in this directory.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "san_mateo_county_libraries";
const ORG_NAME = "San Mateo County Libraries";
const ORG_DESCRIPTION =
  "Public library system serving San Mateo County, CA — coordinating volunteer roles (Library Helper, Maker Volunteer, Friends of the Library, Adult Programming Volunteer, Youth & Family Programming Assistant) across its branch libraries through its own MyImpactPage volunteer portal.";
const ENTERPRISE_GUID = "24469bf8-5f6d-4afd-ab8f-a01d9b0fe9cf";
const BASE = "https://app.betterimpact.com/PublicEnterprise";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// Real, independently-verified branch addresses (2026-08-31) — used only
// for geocoding, never fabricated. "Countywide Programs" deliberately
// has no entry (see this file's header).
const BRANCH_ADDRESSES: Record<string, { address: string; zip: string; city: string }> = {
  Atherton: { address: "2 Dinkelspiel Station Lane, Atherton, CA 94027", zip: "94027", city: "Atherton, CA" },
  Belmont: { address: "1110 Alameda de las Pulgas, Belmont, CA 94002", zip: "94002", city: "Belmont, CA" },
  Brisbane: { address: "163 Visitacion Avenue, Brisbane, CA 94005", zip: "94005", city: "Brisbane, CA" },
  "East Palo Alto": { address: "2415 University Avenue, East Palo Alto, CA 94303", zip: "94303", city: "East Palo Alto, CA" },
  "Foster City": { address: "1000 East Hillsdale Boulevard, Foster City, CA 94404", zip: "94404", city: "Foster City, CA" },
  "Half Moon Bay": { address: "620 Correas Street, Half Moon Bay, CA 94019", zip: "94019", city: "Half Moon Bay, CA" },
  Millbrae: { address: "1 Library Avenue, Millbrae, CA 94030", zip: "94030", city: "Millbrae, CA" },
  "North Fair Oaks": { address: "2510 Middlefield Road, Redwood City, CA 94063", zip: "94063", city: "Redwood City, CA" },
  "Pacifica - Sanchez": { address: "1111 Terra Nova Boulevard, Pacifica, CA 94044", zip: "94044", city: "Pacifica, CA" },
  "Pacifica - Sharp Park": { address: "104 Hilton Way, Pacifica, CA 94044", zip: "94044", city: "Pacifica, CA" },
  "Portola Valley": { address: "765 Portola Road, Portola Valley, CA 94028", zip: "94028", city: "Portola Valley, CA" },
  "San Carlos": { address: "610 Elm Street, San Carlos, CA 94070", zip: "94070", city: "San Carlos, CA" },
  Woodside: { address: "3140 Woodside Road, Woodside, CA 94062", zip: "94062", city: "Woodside, CA" },
};

type Branch = { searchId: string; name: string };

/** Exported for lib/ingestion/sources/sanMateoCountyLibraries.test.ts. */
export function extractBranchesFromHomepage(html: string): Branch[] {
  const pattern = /SearchId=(\d+)" class="searchLink">\s*<div class="searchListItemContainer">\s*<div class="subAccountLinkHolder">([^<]+)<\/div>\s*<div class="countBubbleHolder">\s*<span class="countBubble">(\d+)/g;
  const branches: Branch[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [, searchId, rawName] = match;
    const name = rawName.replace(/&#39;/g, "'").trim();
    // The sidebar also lists non-branch groupings (Focus/Task-type/
    // Other-Factors filters, date-range shortcuts like "This Week")
    // under the same markup shape — only the 13 real physical branches
    // plus "Countywide Programs" are ones this connector recognizes;
    // anything else (a filter facet, not a branch) is skipped by simply
    // not appearing in BRANCH_ADDRESSES/the allowed-name set below.
    if (name !== "Countywide Programs" && !BRANCH_ADDRESSES[name]) continue;
    if (seen.has(searchId)) continue;
    seen.add(searchId);
    branches.push({ searchId, name });
  }
  return branches;
}

type DiscoveredActivity = { activityGuid: string; title: string; branch: string };

/** Exported for lib/ingestion/sources/sanMateoCountyLibraries.test.ts. */
export function extractActivitiesFromBranchPage(html: string, branch: string): DiscoveredActivity[] {
  const pattern = /href="\/PublicEnterprise\/EnterpriseActivity\?enterpriseGuid=[a-f0-9-]+&amp;activityGuid=([a-f0-9-]+)[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/g;
  const results: DiscoveredActivity[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [, activityGuid, rawTitle] = match;
    if (seen.has(activityGuid)) continue;
    seen.add(activityGuid);
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
    results.push({ activityGuid, title, branch });
  }
  return results;
}

/**
 * Exported for lib/ingestion/sources/sanMateoCountyLibraries.test.ts.
 * Parses a numeric age floor from an activity's own trailing title
 * parenthetical — e.g. "(14-15 years old)", "(16 and older)", "(14 and
 * 15 years old)", "(14-15 year olds)". Returns null for a title with
 * no parenthetical, or one with no parseable number (e.g. "Adult
 * Literacy Tutor", "FOL Board - Adult") — never guessed. Floored to
 * this app's platform floor of 13, same convention as every other
 * connector in this directory.
 */
export function parseAgeFromTitle(title: string): number | null {
  const paren = title.match(/\(([^)]*)\)\s*$/);
  if (!paren) return null;
  const inner = paren[1];
  if (!/year|and older|\+/i.test(inner)) return null;
  const numbers = inner.match(/\d{1,2}/g);
  if (!numbers || numbers.length === 0) return null;
  const low = Math.min(...numbers.map(Number));
  return Math.max(13, low);
}

type ActivityDetail = { description: string; applicationUrl: string | null };

async function fetchActivityDetail(activityGuid: string): Promise<ActivityDetail> {
  const url = `${BASE}/EnterpriseActivity?enterpriseGuid=${ENTERPRISE_GUID}&activityGuid=${activityGuid}`;
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) return { description: "", applicationUrl: null };
  const html = await res.text();

  const applyMatch = html.match(/href="([^"]*LoggedInApplicationRedirect[^"]*)"/);
  const applicationUrl = applyMatch ? `https://app.betterimpact.com${applyMatch[1].replace(/&amp;/g, "&")}` : null;

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  const startIdx = stripped.indexOf("Log in to your account");
  const endIdx = stripped.indexOf("Qualifications Required");
  let description = "";
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Skip the first line after the marker (repeats "{department} -
    // {title}", already captured as this row's own title elsewhere).
    const lines = stripped.slice(startIdx, endIdx).split("\n").filter(Boolean);
    description = lines.slice(2).join(" ").replace(/\s+/g, " ").trim();
  }

  return { description, applicationUrl };
}

export type SanMateoCountyLibrariesFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
  discovered: number;
  rejectedNoNumericAge: number;
};

export async function runSanMateoCountyLibrariesFetch(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {}
): Promise<SanMateoCountyLibrariesFetchResult> {
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
): Promise<SanMateoCountyLibrariesFetchResult> {
  log(`Fetching ${BASE}/${ENTERPRISE_GUID} ...`);
  const homeRes = await fetch(`${BASE}/${ENTERPRISE_GUID}`, { headers: FETCH_HEADERS });
  if (!homeRes.ok) throw new Error(`Homepage fetch failed: HTTP ${homeRes.status}`);
  const homeHtml = await homeRes.text();

  const branches = extractBranchesFromHomepage(homeHtml);
  log(`Discovered ${branches.length} branches.`);

  // Two different SearchIds can both display under the same branch name
  // (confirmed live: Foster City has both 25085 and a second, empty
  // legacy SearchId 9735) — a global dedupe by activityGuid, not just
  // the per-page dedupe already inside extractActivitiesFromBranchPage,
  // is what actually prevents a real double-insert if a future refresh
  // ever has both IDs return overlapping activities.
  const allActivities: DiscoveredActivity[] = [];
  const seenActivityGuids = new Set<string>();
  for (const branch of branches) {
    const res = await fetch(`${BASE}/EnterpriseSearch?EnterpriseGuid=${ENTERPRISE_GUID}&SearchType=Organization&SearchId=${branch.searchId}`, {
      headers: FETCH_HEADERS,
    });
    if (!res.ok) {
      log(`  Couldn't fetch branch "${branch.name}": HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    const activities = extractActivitiesFromBranchPage(html, branch.name).filter((a) => {
      if (seenActivityGuids.has(a.activityGuid)) return false;
      seenActivityGuids.add(a.activityGuid);
      return true;
    });
    allActivities.push(...activities);
  }
  log(`Discovered ${allActivities.length} total activities across ${branches.length} branches.`);

  const eligible: { activity: DiscoveredActivity; minimumAge: number }[] = [];
  let rejectedNoNumericAge = 0;
  for (const activity of allActivities) {
    const minimumAge = parseAgeFromTitle(activity.title);
    if (minimumAge === null) {
      rejectedNoNumericAge++;
      continue;
    }
    eligible.push({ activity, minimumAge });
  }
  log(`${eligible.length} activities have an explicit numeric age in their own title; ${rejectedNoNumericAge} rejected (no parseable age parenthetical).`);

  if (options.dryRun) {
    log(`Dry run — ${eligible.length} candidate opportunities found, no database writes performed:`);
    for (const e of eligible) log(`  - [${e.activity.branch}] ${e.activity.title} (min age ${e.minimumAge})`);
    return {
      parsed: eligible.length,
      created: 0,
      updated: 0,
      skipped: 0,
      orgId: null,
      logs,
      discovered: allActivities.length,
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

  // Geocode once per branch (13 real addresses), not once per activity —
  // avoids hammering the geocoder for what's really only 13 distinct
  // physical locations.
  const geoCache = new Map<string, { lat: number; lng: number } | null>();
  async function geocodeBranch(branchName: string) {
    const info = BRANCH_ADDRESSES[branchName];
    if (!info) return null; // "Countywide Programs" — no physical address, deliberately ungeocoded
    if (geoCache.has(branchName)) return geoCache.get(branchName)!;
    const coords = await geocodeStudentLocation(info.zip, info.city);
    geoCache.set(branchName, coords ?? null);
    return coords ?? null;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const { activity, minimumAge } of eligible) {
    const detail = await fetchActivityDetail(activity.activityGuid);
    const branchInfo = BRANCH_ADDRESSES[activity.branch];
    const sourceUrl = `${BASE}/EnterpriseActivity?enterpriseGuid=${ENTERPRISE_GUID}&activityGuid=${activity.activityGuid}`;

    const title = `${activity.branch}: ${activity.title}`;
    const applicationUrl = detail.applicationUrl ?? sourceUrl;
    const raw: RawListing = {
      title,
      description: detail.description || "See the official listing page for the full description and application details.",
      location: branchInfo?.address ?? null,
      external_id: activity.activityGuid,
      application_url: applicationUrl,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl });
    normalized.minimum_age = minimumAge; // source-confirmed via the activity's own title, never text-inferred

    const coords = await geocodeBranch(activity.branch);
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: activity.activityGuid,
        title,
        organizationName: ORG_NAME,
        applicationUrl,
        applicationDeadline: normalized.application_deadline,
        location: normalized.location,
        minimumAge: normalized.minimum_age,
        sourceUrl,
      },
      existing
    );

    let embedding: number[] | null = null;
    try {
      embedding = await embed(normalized.description ?? title);
    } catch (err) {
      log(`Couldn't embed "${title}" — semantic matching will skip it for now: ${err}`);
    }

    const payload = {
      ...normalized,
      organization_id: org.id,
      is_stale: false,
      embedding,
      // Each activity's detail page states its own current qualifications
      // but not a sitewide "still recruiting" signal this connector
      // parses — same posture as every other bulk connector in this
      // directory: a human reviewer confirms currency before approval.
      availability_status: "unverified",
    };

    if (!dedup) {
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${title}": ${error.message}`);
        continue;
      }
      log(`+ Staged (pending review): ${title} (min age ${minimumAge})`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(`- Skipped "${title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (${dedup.reason})`);
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: allActivities.length,
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
    discovered: allActivities.length,
    rejectedNoNumericAge,
  };
}
