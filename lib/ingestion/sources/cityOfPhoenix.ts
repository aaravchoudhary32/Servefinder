// Shared fetch logic for the City of Phoenix's volunteer portal
// (cop.samaritan.com, a third-party "Samaritan" platform the city
// contracts for volunteer management). Used by both the manual CLI
// script (scripts/fetch-city-of-phoenix.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source
// in lib/ingestion/sources/.
//
// Was a headless-browser source (Playwright) until this rewrite — see
// ARCHITECTURE.md's "headless-browser fetchers" section for the full
// history (why Playwright was needed originally, the libnspr4.so /
// @sparticuz/chromium detour, and why this ended up as a direct API
// call instead). Short version: the portal's AngularJS search page
// fetches its own data from an internal JSON API
// (custom/sds.php?&er_getOppList), discovered via browser network
// inspection. Calling that directly is faster, more reliable, and
// gives better data (real numeric ages, real coordinates) than
// scraping the rendered DOM ever did — see ARCHITECTURE.md for why
// this is treated as a private, undocumented contract with this one
// endpoint rather than a real API integration.
//
// Unlike every other source, this one spans many different city
// departments (Parks & Rec, the Library Dept, S'edav Va'aki Museum, Sky
// Harbor Airport, Human Services, ...) under one municipal portal
// rather than one org with a few roles — modeled as a single "City of
// Phoenix" organization (matching this app's one-org-per-source data
// model) with each opportunity's department folded into its
// description rather than split into per-department orgs.
//
// Safe to re-run: each opportunity is matched by a deterministic
// external_id (the portal's own numeric opp id), so a repeat run
// updates the same rows instead of duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "cityofphoenix";
const ORG_NAME = "City of Phoenix";
const ORG_DESCRIPTION =
  "Official volunteer opportunities across City of Phoenix departments — parks, libraries, museums, public safety, and more — coordinated through the city's volunteer portal.";
const ORG_LOCATION = "200 W. Washington Street, Phoenix, AZ 85003";
const ORG_ZIP = "85003";
const DETAILS_BASE = "https://cop.samaritan.com/custom/501/opp_details";

// The portal's own AngularJS client calls this same endpoint with this
// same request body (captured via browser network inspection — this
// is not a documented/versioned API, see ARCHITECTURE.md). Field list
// mirrors what the client actually requests; recruiterID=501 is City
// of Phoenix's own id in Samaritan's platform, not something we chose.
const OPP_LIST_URL = "https://cop.samaritan.com/custom/sds.php?&er_getOppList";
const OPP_LIST_BODY =
  "postData%5BcacheParams%5D=&postData%5BfunctionName%5D=er_getOppList&postData%5BfunctionParams%5D%5B1%5D=&postData%5BfunctionParams%5D%5B2%5D=&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_TITLE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_ORGANIZATION&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_ORGANIZATION_ID&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_VOLUNTEERS_NEEDED&postData%5BfunctionParams%5D%5B3%5D%5B%5D=ATTACHMENTS&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_AVAIL_POSITION&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_HAS_SS&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_DESCRIPTION&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_URGENCY&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_MODIFY_DATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_MINIMUM_AGE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_PLACED_VOL&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_ADDRESS_1&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_ADDRESS_2&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CITY&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_STATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_POSTAL_CODE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_ADDRESS_1&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_ADDRESS_2&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_CITY&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_STATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_POSTAL_CODE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_PHONE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_HOW_TO_FIND&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%2314&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%2315&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%237&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%234&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%235&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%236&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%2320&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%2316&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%23501&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%2321&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%2313&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT%238&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_URL&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_SIGNUP_ACTION&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_PREREQUISITE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_AVAILABILITY&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_LATITUDE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_LONGITUDE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_LOC_INFO_TYPE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT_LATITUDE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT_LONGITUDE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_CONTACT_INFO_TYPE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=CUSTOM_ATTRIBUTE%231940&postData%5BfunctionParams%5D%5B3%5D%5B%5D=CUSTOM_ATTRIBUTE%233214&postData%5BfunctionParams%5D%5B3%5D%5B%5D=CUSTOM_ATTRIBUTE%233215&postData%5BfunctionParams%5D%5B3%5D%5B%5D=CUSTOM_ATTRIBUTE%233375&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_PUBLISH_DATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_EXPIRATION_DATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_STARTING_DATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_DISPLAY_BEGIN_DATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_DISPLAY_END_DATE&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_HIDE_FOR_NOT_ELIGIBLE_VOLS&postData%5BfunctionParams%5D%5B3%5D%5B%5D=OPP_HAS_ANY_SS&postData%5BfunctionParams%5D%5B3%5D%5B%5D=IN_BIN&postData%5BfunctionParams%5D%5B4%5D=&postData%5BfunctionParams%5D%5B5%5D=&postData%5BfunctionParams%5D%5B6%5D=false&postData%5BfunctionParams%5D%5B7%5D=false&postData%5BfunctionParams%5D%5B8%5D=&postData%5BfunctionParams%5D%5B9%5D=&recruiterID=501";

// A handful of opportunities are logging-only entries for an existing
// program's members (e.g. "Cadet Volunteer Hours" — active cadets
// only) rather than something a new teen volunteer could apply to.
// Excluded by id since there's no reliable text signal to detect this
// from the data itself.
const EXCLUDED_IDS = new Set(["1264"]);

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- API response shape ----------
//
// Only the fields this fetcher actually uses — the real response has
// many more (contact info, custom attributes, attachments, ...) that
// aren't relevant to what this app stores.
type ApiOpportunity = {
  ID: number;
  OPP_TITLE: string;
  OPP_DESCRIPTION: string;
  OPP_ORGANIZATION: string | null;
  OPP_MINIMUM_AGE: number | null;
  OPP_LOC_ADDRESS_1: string | null;
  OPP_LOC_ADDRESS_2: string | null;
  OPP_LOC_CITY: string | null;
  OPP_LOC_STATE: string | null;
  OPP_LOC_POSTAL_CODE: string | null;
  OPP_LOC_LATITUDE: number | null;
  OPP_LOC_LONGITUDE: number | null;
  OPP_CONTACT_LATITUDE: number | null;
  OPP_CONTACT_LONGITUDE: number | null;
};

async function fetchOppList(): Promise<ApiOpportunity[]> {
  const res = await fetch(OPP_LIST_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: OPP_LIST_BODY,
  });
  if (!res.ok) {
    throw new Error(`er_getOppList returned ${res.status}`);
  }
  const json = await res.json();
  if (!Array.isArray(json?.data)) {
    throw new Error("er_getOppList response had no 'data' array — the endpoint's shape may have changed.");
  }
  return json.data;
}

function formatAddress(opp: ApiOpportunity): string | null {
  const parts = [opp.OPP_LOC_ADDRESS_1, opp.OPP_LOC_ADDRESS_2].filter(Boolean).join(" ").trim();
  const cityStateZip = [opp.OPP_LOC_CITY, opp.OPP_LOC_STATE].filter(Boolean).join(", ");
  const full = [parts, [cityStateZip, opp.OPP_LOC_POSTAL_CODE].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return full || null;
}

function extractCoords(opp: ApiOpportunity): { lat: number; lng: number } | null {
  if (typeof opp.OPP_LOC_LATITUDE === "number" && typeof opp.OPP_LOC_LONGITUDE === "number") {
    return { lat: opp.OPP_LOC_LATITUDE, lng: opp.OPP_LOC_LONGITUDE };
  }
  if (typeof opp.OPP_CONTACT_LATITUDE === "number" && typeof opp.OPP_CONTACT_LONGITUDE === "number") {
    return { lat: opp.OPP_CONTACT_LATITUDE, lng: opp.OPP_CONTACT_LONGITUDE };
  }
  return null;
}

// ---------- main ----------

export type CityOfPhoenixFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runCityOfPhoenixFetch(supabase: SupabaseClient): Promise<CityOfPhoenixFetchResult> {
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
): Promise<CityOfPhoenixFetchResult> {
  type ParsedRole = {
    title: string;
    description: string;
    externalId: string;
    sourceUrl: string;
    location: string | null;
    coords: { lat: number; lng: number } | null;
    minimumAge: number | null;
  };

  log(`Fetching ${OPP_LIST_URL} ...`);
  const apiOpps = (await fetchOppList()).filter((o) => !EXCLUDED_IDS.has(String(o.ID)));
  log(`Found ${apiOpps.length} opportunities.`);

  const roles: ParsedRole[] = [];
  for (const opp of apiOpps) {
    const title = opp.OPP_TITLE?.trim();
    const description = stripHtml(opp.OPP_DESCRIPTION ?? "");
    if (!title || !description) {
      log(`Opportunity ${opp.ID}: no usable content — skipping.`);
      continue;
    }
    const descriptionParts = [description];
    if (opp.OPP_ORGANIZATION) descriptionParts.push(`Department: ${opp.OPP_ORGANIZATION}.`);

    roles.push({
      title,
      description: descriptionParts.join(" "),
      externalId: String(opp.ID),
      sourceUrl: `${DETAILS_BASE}/${opp.ID}`,
      location: formatAddress(opp),
      coords: extractCoords(opp),
      minimumAge:
        typeof opp.OPP_MINIMUM_AGE === "number" && Number.isFinite(opp.OPP_MINIMUM_AGE)
          ? opp.OPP_MINIMUM_AGE
          : null,
    });
  }

  log(`Parsed ${roles.length} usable volunteer opportunities.`);
  if (roles.length === 0) {
    log("Nothing to ingest — the API's response shape may have changed.");
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

  const orgCoords = await geocodeStudentLocation(ORG_ZIP, ORG_LOCATION);

  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const role of roles) {
    const raw: RawListing = {
      title: role.title,
      description: role.description,
      location: role.location ?? ORG_LOCATION,
      external_id: role.externalId,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: role.sourceUrl });

    // Prefer the exact coordinates and age the API itself returns for
    // this opportunity; only fall back to zip/city geocoding (shared
    // with every other source) or normalizeListing's own text-based
    // age extraction when the API didn't have them.
    if (role.coords) {
      normalized.latitude = role.coords.lat;
      normalized.longitude = role.coords.lng;
    } else if (role.location) {
      const zipMatch = role.location.match(/\b(\d{5})\b/);
      const coords = await geocodeStudentLocation(zipMatch?.[1] ?? null, role.location);
      normalized.latitude = coords?.lat ?? orgCoords?.lat ?? null;
      normalized.longitude = coords?.lng ?? orgCoords?.lng ?? null;
    } else {
      normalized.latitude = orgCoords?.lat ?? null;
      normalized.longitude = orgCoords?.lng ?? null;
    }
    if (role.minimumAge !== null) {
      normalized.minimum_age = role.minimumAge;
    }

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
