// Reusable connector for Better Impact "MyImpactPage" animal shelters
// that publish a single SITE-WIDE minimum-age policy (not a per-listing
// or per-title age) — same shape as lib/ingestion/sources/azGameFish.ts,
// which established this pattern first. Config-driven (see
// SITE_WIDE_POLICY_SOURCES below), covering two tenants found during the
// nationwide-expansion pass:
//
//  - Belleville Area Humane Society (Belleville, IL) — org page states,
//    quoted verbatim: "The minimum age to volunteer is 13-15 years old
//    with a parent or legal guardian onsite completing the same task...
//    Volunteers must be at least 16 years of age to be onsite
//    independently of a legal guardian."
//  - Kansas Humane Society (Wichita, KS) — org page states, quoted
//    verbatim: "Volunteers must be at least 16 years of age with a
//    valid photo ID to volunteer on their own. Minors 9-15 are welcome
//    to volunteer but must be accompanied by a parent or guardian at
//    all times."
//
// Both confirmed live before writing this file. Since neither tenant
// tags individual activities with their own age (unlike Multnomah/San
// Mateo/Wisconsin Humane Society, all title-based), every activity on
// each org's page is staged with that org's own uniform floor — this is
// a real, stated site-wide fact, not an inference, same posture
// azGameFish.ts already established for AZGFD's identical shape.
//
// Two different link markups were found across these two tenants'
// activity-list pages (both PublicOrganization, both confirmed live via
// plain curl, no browser needed):
//  - Kansas Humane Society: `<a href=".../Gvi/{guid}/1"
//    class="regularLink">{title}</a>` — title as the link's own text
//    (same shape multnomahCountyLibrary.ts and
//    wisconsinHumaneSocietyGreenBay.ts already parse).
//  - Belleville Area Humane Society: `<a href=".../Gvi/{guid}/1"
//    title="Continue to {title}">Continue...</a>` — title only in the
//    anchor's `title` attribute, link text is just "Continue...". A
//    third distinct markup shape found on this platform this session.
// extractListingsFromHomepage() below tries both patterns and merges
// the (deduplicated) results, so this one connector works for either
// tenant shape without per-tenant code branches.
//
// robots.txt for app.betterimpact.com disallows /Status/, /Application/,
// /Content/, /Images/, /System/ — NOT /PublicOrganization/, the path
// this connector reads (same policy already documented in every sibling
// connector on this platform in this directory).
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

export type SiteWidePolicySourceConfig = {
  sourceSlug: string;
  orgName: string;
  orgDescription: string;
  orgGuid: string;
  address: string;
  zip: string;
  city: string;
  minimumAge: number; // this app's platform-floored minimum, per the org's own stated policy
  policyNote: string; // the org's own policy, quoted, appended to every activity's description
};

export const SITE_WIDE_POLICY_SOURCES: SiteWidePolicySourceConfig[] = [
  {
    sourceSlug: "belleville_area_humane_society",
    orgName: "Belleville Area Humane Society",
    orgDescription:
      "Animal shelter serving the Belleville, IL area — adoption events, animal care, dog walking, fostering, transport, and administrative volunteer roles, coordinated through its own MyImpactPage volunteer portal.",
    orgGuid: "ffb0511b-f49a-489b-98e4-45a2319c25fc",
    address: "1301 S. 11th Street, Belleville, IL 62226",
    zip: "62226",
    city: "Belleville, IL",
    minimumAge: 13,
    policyNote:
      "Belleville Area Humane Society's own site-wide policy, stated plainly: \"The minimum age to volunteer is 13-15 years old with a parent or legal guardian onsite completing the same task. Volunteers must be at least 16 years of age to be onsite independently of a legal guardian.\"",
  },
  {
    sourceSlug: "kansas_humane_society",
    orgName: "Kansas Humane Society",
    orgDescription:
      "Animal shelter serving the Wichita, KS area — animal interactions, housekeeping, special events, clerical, clinic support, and retail store volunteer roles, coordinated through its own MyImpactPage volunteer portal.",
    orgGuid: "c78019a8-0e11-4fdc-a83f-a14b9252ebde",
    address: "3313 N. Hillside, Wichita, KS 67219",
    zip: "67219",
    city: "Wichita, KS",
    minimumAge: 13,
    policyNote:
      "Kansas Humane Society's own site-wide policy, stated plainly: \"Volunteers must be at least 16 years of age with a valid photo ID to volunteer on their own. Minors 9-15 are welcome to volunteer but must be accompanied by a parent or guardian at all times.\" (This app's platform floor of 13 applies — no role here is offered below that age regardless of the org's own lower published floor.)",
  },
];

const BASE = "https://app.betterimpact.com/PublicOrganization";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

type DiscoveredListing = { activityGuid: string; title: string; detailUrl: string };

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#160;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exported for lib/ingestion/sources/humaneSocietySiteWidePolicy.test.ts. */
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
  const lines = stripped.slice(startIdx, endIdx).split("\n").filter(Boolean);
  return lines.slice(2).join(" ").replace(/\s+/g, " ").trim();
}

export type SiteWidePolicyFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
  discovered: number;
};

export async function runSiteWidePolicyFetch(
  supabase: SupabaseClient,
  config: SiteWidePolicySourceConfig,
  options: { dryRun?: boolean } = {}
): Promise<SiteWidePolicyFetchResult> {
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
  config: SiteWidePolicySourceConfig,
  log: (line: string) => void,
  logs: string[],
  options: { dryRun?: boolean }
): Promise<SiteWidePolicyFetchResult> {
  const listUrl = `${BASE}/${config.orgGuid}/1`;
  log(`Fetching ${listUrl} ...`);
  const res = await fetch(listUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Homepage fetch failed: HTTP ${res.status}`);
  const html = await res.text();

  const discovered = extractListingsFromHomepage(html, config.orgGuid);
  log(`Discovered ${discovered.length} current listings — all staged at this org's uniform site-wide minimum age of ${config.minimumAge}.`);

  if (options.dryRun) {
    log(`Dry run — ${discovered.length} candidate opportunities found, no database writes performed:`);
    for (const d of discovered) log(`  - ${d.title}`);
    return { parsed: discovered.length, created: 0, updated: 0, skipped: 0, orgId: null, logs, discovered: discovered.length };
  }

  if (discovered.length === 0) {
    log("Nothing to ingest — no listings found (or page layout changed).");
    await recordIngestionRun(supabase, {
      source: config.sourceSlug,
      status: "success",
      listingsFound: 0,
      listingsInserted: 0,
      listingsUpdated: 0,
      listingsSkippedDuplicate: 0,
    });
    return { parsed: 0, created: 0, updated: 0, skipped: 0, orgId: null, logs, discovered: 0 };
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

  const coords = await geocodeStudentLocation(config.zip, config.city);
  log(coords ? `Geocoded ${config.zip} -> ${coords.lat}, ${coords.lng}` : `Couldn't geocode ${config.zip} — listings will have no coordinates.`);

  const existing = await fetchExistingListings(supabase, { sourceSlug: config.sourceSlug });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const listing of discovered) {
    const description = await fetchDescription(listing.detailUrl);

    const raw: RawListing = {
      title: listing.title,
      description: [description || "See the official listing page for the full description and application details.", config.policyNote].join(" "),
      location: config.address,
      external_id: listing.activityGuid,
      application_url: listing.detailUrl,
    };

    const normalized = normalizeListing(raw, { source: config.sourceSlug, sourceUrl: listing.detailUrl });
    normalized.minimum_age = config.minimumAge; // source-confirmed via the org's own stated site-wide policy, never text-inferred
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
      parental_consent_required: true, // every activity here sits under an org-wide policy requiring a parent/guardian below the org's own independent-volunteering floor
      availability_status: "unverified",
    };

    if (!dedup) {
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${listing.title}": ${error.message}`);
        continue;
      }
      log(`+ Staged (pending review): ${listing.title}`);
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

  return { parsed: discovered.length, created, updated, skipped, orgId: org.id, logs, discovered: discovered.length };
}

export async function runBellevilleAreaHumaneSocietyFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSiteWidePolicyFetch(supabase, SITE_WIDE_POLICY_SOURCES[0], options);
}

export async function runKansasHumaneSocietyFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSiteWidePolicyFetch(supabase, SITE_WIDE_POLICY_SOURCES[1], options);
}
