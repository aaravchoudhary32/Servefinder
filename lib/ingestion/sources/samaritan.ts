// Reusable connector for any organization running its volunteer program
// on the Samaritan Technologies platform (samaritan.com, or a
// white-labeled domain pointing at the same backend) — discovered
// during a Phase 2 platform-discovery pass when Samaritan turned out to
// power far more tenants than just the existing cityofphoenix.ts source
// (cop.samaritan.com). This file is intentionally config-driven (see
// SAMARITAN_SOURCES below) rather than one file per tenant: adding a
// new organization on this platform is a new config entry, not new code.
//
// City of Phoenix is deliberately EXCLUDED from this connector's config
// — it already has its own dedicated, working connector
// (cityOfPhoenix.ts, source "cityofphoenix") and this file must never
// duplicate or overwrite those rows.
//
// How this was found and verified: the existing cityOfPhoenix.ts
// connector already called Samaritan's own internal JSON API directly
// (POST to {subdomain}.samaritan.com/custom/sds.php?&er_getOppList,
// with a `recruiterID` identifying the tenant) rather than scraping
// rendered HTML. Personally confirmed via direct fetch (curl) this
// session that the exact same endpoint and field list work unmodified
// against three more Samaritan tenants discovered manually earlier this
// session (Santa Clarita, Prince George's Parks, Metropolitan Library
// System OKC) — only the subdomain and recruiterID differ per tenant.
// This is the same private, undocumented contract cityOfPhoenix.ts's
// own comments already treat it as (not a versioned public API), so
// this connector reads it the same cautious way: no assumption the
// response shape is stable forever, and every field is read
// defensively.
//
// Teen-eligibility handling: Samaritan's own schema returns a
// structured OPP_MINIMUM_AGE integer per listing — set by the
// organization itself for its own opportunity, not text this connector
// has to interpret. This is inherently more reliable than free-text
// scraping (no "teen"/"youth" word-guessing at all). A listing is only
// ever ingested when OPP_MINIMUM_AGE is a real, present integer between
// 1 and 18 inclusive; anything null, non-numeric, or 19+ (adult-only
// roles, e.g. many "Reading to Dogs"-style listings require 21) is
// skipped outright, never defaulted or inferred.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";
import { fetchExistingListings } from "../fetchExistingListings";

export type SamaritanSourceConfig = {
  sourceSlug: string; // e.g. "samaritan_santa_clarita" — used as opportunities.source
  orgName: string;
  orgDescription: string;
  orgAddress: string;
  orgZip: string;
  subdomain: string; // e.g. "volunteer" for volunteer.samaritan.com, or a full white-label host
  recruiterId: string;
  cityLabel: string; // for logging only
  // Opportunity IDs to skip even if teen-eligible — for a listing
  // already staged as its own manual_curated record elsewhere in this
  // app (a same-source-external_id dedup can't catch this on its own,
  // since this connector's sourceSlug always differs from
  // "manual_curated"). Verified live per entry — see each config's own
  // comment for which manual record it corresponds to.
  excludeOpportunityIds?: string[];
  maxAge?: number; // defaults to 18 — the highest minimum-age still worth ingesting
};

export const SAMARITAN_SOURCES: SamaritanSourceConfig[] = [
  {
    sourceSlug: "samaritan_santa_clarita",
    orgName: "City of Santa Clarita (SCV Trail Users)",
    orgDescription:
      "Official volunteer opportunities across City of Santa Clarita departments — Parks & Open Space, Youth Sports, and more — coordinated through the city's Samaritan volunteer portal.",
    orgAddress: "23920 Valencia Blvd, Santa Clarita, CA 91355",
    orgZip: "91355",
    subdomain: "volunteer",
    recruiterId: "526",
    cityLabel: "Santa Clarita",
    // "Bike Park Workdays" (ID 9968) is already staged/approved as a
    // manual_curated record under this same organization — verified
    // live this session before adding this exclusion.
    excludeOpportunityIds: ["9968"],
  },
  {
    sourceSlug: "samaritan_prince_georges_parks",
    orgName: "Prince George's Parks and Recreation",
    orgDescription:
      "Official volunteer opportunities across Prince George's County, Maryland parks — trail stewardship, park hosting, youth sports, and more — coordinated through the county's Samaritan volunteer portal.",
    orgAddress: "6600 Kenilworth Ave, Riverdale, MD 20737",
    orgZip: "20737",
    subdomain: "pgparks",
    recruiterId: "1543",
    cityLabel: "Prince George's County",
  },
  {
    sourceSlug: "samaritan_metro_library_okc",
    orgName: "Metropolitan Library System (Oklahoma City)",
    orgDescription:
      "Official volunteer opportunities across Metropolitan Library System branches in the Oklahoma City metro area, coordinated through the system's Samaritan volunteer portal.",
    orgAddress: "300 Park Ave, Oklahoma City, OK 73102",
    orgZip: "73102",
    subdomain: "ec",
    recruiterId: "1527",
    cityLabel: "Oklahoma City metro",
  },
  {
    sourceSlug: "samaritan_montgomery_parks",
    orgName: "Montgomery Parks",
    orgDescription:
      "Official volunteer opportunities across Montgomery County, Maryland parks — trail cleanups, adaptive sports support, nature centers, and more — coordinated through the department's Samaritan volunteer portal.",
    orgAddress: "9500 Brunett Ave, Silver Spring, MD 20901",
    orgZip: "20901",
    subdomain: "mcp",
    recruiterId: "1491",
    cityLabel: "Montgomery County",
  },
  {
    sourceSlug: "samaritan_east_bay_regional_parks",
    orgName: "East Bay Regional Park District",
    orgDescription:
      "Official volunteer opportunities across East Bay Regional Park District sites in Alameda and Contra Costa Counties, California — trail restoration, litter cleanups, marsh protection, and more — coordinated through the district's Samaritan volunteer portal. Previously flagged needs_follow_up (WAF-blocked on the org's own ebparks.org pages) — resolved this session by finding the org's own samaritan.com subdomain, which isn't blocked.",
    orgAddress: "2950 Peralta Oaks Court, Oakland, CA 94605",
    orgZip: "94605",
    subdomain: "ebrpd",
    recruiterId: "501",
    cityLabel: "East Bay (Alameda/Contra Costa Counties)",
  },
  {
    sourceSlug: "samaritan_city_of_aurora_co",
    orgName: "City of Aurora, Colorado",
    orgDescription:
      "Official volunteer opportunities across City of Aurora, Colorado departments — Open Space & Natural Resources, Parks/Youth Sports, Cultural Arts, Fire Rescue, Court Administration, the History Museum, Animal Shelter, and more — coordinated through the city's Samaritan volunteer portal. Discovered while resolving a pending Aurora Public Library manual record whose original applicationUrl had 404'd; the library's current get_involved page links directly to this same tenant.",
    orgAddress: "15151 E Alameda Pkwy, Aurora, CO 80012",
    orgZip: "80012",
    subdomain: "volunteer",
    recruiterId: "507",
    cityLabel: "Aurora, CO",
    // All 10 "Library-" prefixed listings on this tenant are excluded:
    // Aurora Public Library already has its own approved manual_curated
    // organization/record (general "Library Volunteer", age 13, sourced
    // from the library's own get_involved page) and ingesting these
    // specific-branch/program listings under a *different* organization
    // name ("City of Aurora, Colorado") would read as a confusing
    // near-duplicate of the same underlying age-13 library volunteering,
    // rather than a genuinely distinct offering.
    // 12810 ("Big Sit Style Bioblitz") is also excluded: its full
    // description reads "All adults should register then send an email
    // ... with the number of youth participating" — registration is
    // always adult-driven regardless of a participating teen's age, so
    // it is not an individually-actionable teen role (see the
    // group-only/always-paired exclusion policy applied elsewhere in
    // this app). 14258 ("2026 Google AI U Stipend Supported Student
    // Internship") is excluded because its description reveals it's a
    // PAID ($900-$1,300 stipend) internship for "advanced-level
    // undergraduate and graduate students" — not a volunteer
    // opportunity, and not remotely teen-eligible despite the API's
    // OPP_MINIMUM_AGE of 18. Both found and excluded during this
    // session's independent review pass, after the initial live run had
    // already staged them pending; the corresponding DB rows were
    // separately rejected rather than left pending.
    excludeOpportunityIds: [
      "8312", "11725", "11724", "14229", "11641", "14167", "12498", "13730", "12021", "11498",
      "12810", "14258",
    ],
  },
  {
    sourceSlug: "samaritan_johnson_county_library",
    orgName: "Johnson County Library",
    orgDescription:
      "Official volunteer opportunities across Johnson County, Kansas Library branches and the Johnson County Park & Recreation District (JCPRD) — Friends of the Library book sales/drives, teen programs, special events, and more — coordinated through the library's Samaritan volunteer portal. Discovered via a search for other samaritan.com city/county tenants.",
    orgAddress: "9875 W 87th St, Overland Park, KS 66212",
    orgZip: "66212",
    subdomain: "joco",
    recruiterId: "501",
    cityLabel: "Johnson County, KS",
  },
  {
    sourceSlug: "samaritan_peoria_park_district_il",
    orgName: "Peoria Park District",
    orgDescription:
      "Official volunteer opportunities across Peoria Park District facilities in Peoria, Illinois — trail and garden restoration, special events, youth sports coaching, the PlayHouse Children's Museum, and more — coordinated through the district's Samaritan volunteer portal. Note: distinct from the already-covered Peoria Public Library (Peoria, Arizona) — this is Illinois' Peoria Park District (peoriaparks.org).",
    orgAddress: "1125 W Lake Ave, Peoria, IL 61614",
    orgZip: "61614",
    subdomain: "ec",
    recruiterId: "1562",
    cityLabel: "Peoria, IL",
    // 232268 ("Court Ordered Community Service Volunteer") excluded: for
    // people fulfilling a legal community-service obligation, not a
    // voluntary opportunity a teen would proactively seek — not
    // teen-actionable in the sense this app serves. 235553 ("ICC Student
    // Volunteer for Luthy Botanical Garden") excluded: restricted to
    // enrolled Illinois Central College students fulfilling a specific
    // course's volunteer-hour requirement, not open community
    // volunteering. Both found and excluded during this session's
    // independent review pass, before the live run was ever executed.
    excludeOpportunityIds: ["232268", "235553"],
  },
  {
    sourceSlug: "samaritan_california_fish_wildlife",
    orgName: "California Department of Fish and Wildlife",
    orgDescription:
      "Official volunteer opportunities across California Department of Fish and Wildlife (CDFW) sites statewide — the Back Bay Science Center in Newport Beach, plus other regional sites — coordinated through the department's Samaritan volunteer portal.",
    orgAddress: "715 P St, Sacramento, CA 95814",
    orgZip: "95814",
    subdomain: "ec",
    recruiterId: "1398",
    cityLabel: "California (statewide)",
    // 191853 ("BBSC College Internship") excluded: explicitly "students
    // of other universities and colleges," not open teen volunteering.
    // 191854 ("BBSC Phytoplankton Internship") excluded: same
    // "Internship" framing and government-agency-partnership structure
    // as the college internship above, under the same program — treated
    // the same way out of caution even though its own text doesn't
    // explicitly restrict to college students.
    excludeOpportunityIds: ["191853", "191854"],
  },
  {
    sourceSlug: "samaritan_texas_parks_wildlife",
    orgName: "Texas Parks and Wildlife Department",
    orgDescription:
      "Official volunteer opportunities across Texas Parks and Wildlife Department (TPWD) state parks, natural areas, fish hatcheries, and Sea Center Texas — trail maintenance, interpretive guiding, gardens, wildlife/fisheries programs, and more — coordinated through the department's Samaritan volunteer portal.",
    orgAddress: "4200 Smith School Rd, Austin, TX 78744",
    orgZip: "78744",
    subdomain: "tpwd",
    recruiterId: "1353",
    cityLabel: "Texas (statewide)",
    // 218190 ("Eisenhower State Park - Park Host (Maintenance &
    // Projects)"): API age is 5, but the description seeks "skilled
    // craftsmen" able to "work any shift" — incoherent with that age,
    // almost certainly a data error on a role that is not actually
    // teen-appropriate. 228015 ("Galveston Island State Park - EAGLE
    // SCOUT PROJECT..."): a single Eagle Scout candidate's own assigned
    // project, not an opportunity open to other teens. 170450 ("MDC-
    // Student Volunteer"): "opportunities for college students,"
    // explicitly restricted, and inconsistent with its own age-17
    // field. 168951 ("Sheldon Lake State Park - Service Learning
    // Project"): "for schools, scout troops or corporate groups," not
    // an individually-actionable role. All 4 found during this
    // session's independent review pass before the live run.
    excludeOpportunityIds: ["218190", "228015", "170450", "168951"],
  },
];

const OPP_LIST_PATH = "/custom/sds.php?&er_getOppList";

// Field list mirrors cityOfPhoenix.ts's own request — this is the same
// private endpoint contract, just parameterized by tenant.
function buildRequestBody(recruiterId: string): string {
  const fields = [
    "OPP_TITLE",
    "OPP_ORGANIZATION",
    "OPP_DESCRIPTION",
    "OPP_MINIMUM_AGE",
    "OPP_ADDRESS_1",
    "OPP_ADDRESS_2",
    "OPP_CITY",
    "OPP_STATE",
    "OPP_POSTAL_CODE",
    "OPP_LOC_ADDRESS_1",
    "OPP_LOC_ADDRESS_2",
    "OPP_LOC_CITY",
    "OPP_LOC_STATE",
    "OPP_LOC_POSTAL_CODE",
    "OPP_LOC_LATITUDE",
    "OPP_LOC_LONGITUDE",
    "OPP_URL",
    "OPP_EXPIRATION_DATE",
  ];
  const params = new URLSearchParams();
  params.set("postData[cacheParams]", "");
  params.set("postData[functionName]", "er_getOppList");
  // functionParams[1] and [2] must be present (even empty) for some
  // tenants' backends to parse the positional argument list correctly —
  // discovered when joco.samaritan.com (Johnson County Library) silently
  // fell back to returning only {ID, OPP_SCHEDULE_SLOT} per row without
  // them, while other tenants tolerated their absence. Matches
  // cityOfPhoenix.ts's own request shape, which always included them.
  params.set("postData[functionParams][1]", "");
  params.set("postData[functionParams][2]", "");
  for (const f of fields) params.append("postData[functionParams][3][]", f);
  params.set("postData[functionParams][6]", "false");
  params.set("postData[functionParams][7]", "false");
  params.set("recruiterID", recruiterId);
  return params.toString();
}

type ApiOpportunity = {
  ID: number;
  OPP_TITLE?: string;
  OPP_DESCRIPTION?: string;
  OPP_ORGANIZATION?: string | null;
  OPP_MINIMUM_AGE?: number | null;
  OPP_ADDRESS_1?: string | null;
  OPP_ADDRESS_2?: string | null;
  OPP_CITY?: string | null;
  OPP_STATE?: string | null;
  OPP_POSTAL_CODE?: string | null;
  OPP_LOC_ADDRESS_1?: string | null;
  OPP_LOC_ADDRESS_2?: string | null;
  OPP_LOC_CITY?: string | null;
  OPP_LOC_STATE?: string | null;
  OPP_LOC_POSTAL_CODE?: string | null;
  OPP_LOC_LATITUDE?: number | null;
  OPP_LOC_LONGITUDE?: number | null;
  OPP_URL?: string | null;
  OPP_EXPIRATION_DATE?: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAddress(opp: ApiOpportunity): string | null {
  const addr1 = opp.OPP_LOC_ADDRESS_1 || opp.OPP_ADDRESS_1;
  const addr2 = opp.OPP_LOC_ADDRESS_2 || opp.OPP_ADDRESS_2;
  const city = opp.OPP_LOC_CITY || opp.OPP_CITY;
  const state = opp.OPP_LOC_STATE || opp.OPP_STATE;
  const zip = opp.OPP_LOC_POSTAL_CODE || opp.OPP_POSTAL_CODE;
  const parts = [addr1, addr2].filter(Boolean).join(" ").trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  const full = [parts, [cityState, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return full || null;
}

/** Pure parsing — exported for fixture-based unit testing without network access. */
export function parseApiOpportunities(json: unknown): ApiOpportunity[] {
  if (typeof json !== "object" || json === null || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error("er_getOppList response had no 'data' array — the endpoint's shape may have changed.");
  }
  return (json as { data: ApiOpportunity[] }).data;
}

/**
 * Age-policy filter, isolated for unit testing: only a real, present,
 * teen-plausible integer age passes. Never infers, never defaults.
 */
export function isTeenEligible(minimumAge: unknown, maxAge: number): boolean {
  return typeof minimumAge === "number" && Number.isFinite(minimumAge) && minimumAge >= 1 && minimumAge <= maxAge;
}

async function fetchOppList(subdomain: string, recruiterId: string): Promise<ApiOpportunity[]> {
  const url = `https://${subdomain}.samaritan.com${OPP_LIST_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: buildRequestBody(recruiterId),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`er_getOppList returned ${res.status} for ${url}`);
  return parseApiOpportunities(await res.json());
}

export type SamaritanFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  ageFiltered: number;
  orgId: string | null;
  logs: string[];
};

export async function runSamaritanFetch(
  supabase: SupabaseClient,
  config: SamaritanSourceConfig,
  options: { dryRun?: boolean } = {}
): Promise<SamaritanFetchResult> {
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
  config: SamaritanSourceConfig,
  log: (line: string) => void,
  logs: string[],
  options: { dryRun?: boolean }
): Promise<SamaritanFetchResult> {
  const maxAge = config.maxAge ?? 18;
  log(`Fetching https://${config.subdomain}.samaritan.com${OPP_LIST_PATH} (recruiterID=${config.recruiterId}) ...`);
  const apiOpps = await fetchOppList(config.subdomain, config.recruiterId);
  log(`Found ${apiOpps.length} total opportunities for ${config.cityLabel}.`);

  const excludeSet = new Set(config.excludeOpportunityIds ?? []);
  let ageFiltered = 0;

  type ParsedRole = {
    title: string;
    description: string;
    externalId: string;
    sourceUrl: string;
    location: string | null;
    coords: { lat: number; lng: number } | null;
    minimumAge: number;
  };
  const roles: ParsedRole[] = [];

  for (const opp of apiOpps) {
    if (excludeSet.has(String(opp.ID))) {
      log(`Opportunity ${opp.ID}: excluded (already covered by a manual_curated record).`);
      continue;
    }
    if (!isTeenEligible(opp.OPP_MINIMUM_AGE, maxAge)) {
      ageFiltered++;
      continue;
    }
    const title = opp.OPP_TITLE?.trim();
    const description = stripHtml(opp.OPP_DESCRIPTION ?? "");
    if (!title || !description) {
      log(`Opportunity ${opp.ID}: no usable title/description — skipping.`);
      continue;
    }
    const descriptionParts = [description];
    if (opp.OPP_ORGANIZATION) descriptionParts.push(`Department/location: ${opp.OPP_ORGANIZATION}.`);
    descriptionParts.push(
      `Minimum age confirmed directly via ${config.cityLabel}'s own Samaritan volunteer platform: ${opp.OPP_MINIMUM_AGE}.`
    );

    roles.push({
      title,
      description: descriptionParts.join(" "),
      externalId: String(opp.ID),
      sourceUrl: opp.OPP_URL?.trim() || `https://${config.subdomain}.samaritan.com`,
      location: formatAddress(opp),
      coords:
        typeof opp.OPP_LOC_LATITUDE === "number" && typeof opp.OPP_LOC_LONGITUDE === "number"
          ? { lat: opp.OPP_LOC_LATITUDE, lng: opp.OPP_LOC_LONGITUDE }
          : null,
      minimumAge: opp.OPP_MINIMUM_AGE as number,
    });
  }

  log(`${roles.length} teen-eligible (age 1-${maxAge}) opportunities after filtering (${ageFiltered} skipped for no/adult-only age, ${excludeSet.size} excluded as already-covered).`);

  if (options.dryRun) {
    log(`Dry run — no database writes performed. Sample:`);
    for (const r of roles.slice(0, 20)) log(`  - ${r.title} (min age ${r.minimumAge}) [${r.externalId}]`);
    if (roles.length > 20) log(`  ... and ${roles.length - 20} more`);
    return { parsed: roles.length, created: 0, updated: 0, skipped: 0, ageFiltered, orgId: null, logs };
  }

  if (roles.length === 0) {
    await recordIngestionRun(supabase, {
      source: config.sourceSlug,
      status: "success",
      listingsFound: apiOpps.length,
      listingsInserted: 0,
      listingsUpdated: 0,
      listingsSkippedDuplicate: 0,
    });
    return { parsed: 0, created: 0, updated: 0, skipped: 0, ageFiltered, orgId: null, logs };
  }

  let { data: org } = await supabase.from("organizations").select("id, name").eq("name", config.orgName).maybeSingle();
  if (!org) {
    const { data: newOrg, error } = await supabase
      .from("organizations")
      .insert({ name: config.orgName, description: config.orgDescription, verified: true })
      .select("id, name")
      .single();
    if (error || !newOrg) throw new Error(`Couldn't create organization: ${error?.message}`);
    org = newOrg;
    log(`Created organization "${config.orgName}" (${org.id}).`);
  } else {
    log(`Found existing organization "${config.orgName}" (${org.id}).`);
  }

  const orgCoords = await geocodeStudentLocation(config.orgZip, config.orgAddress);

  // Deliberately not scoped by source: this connector's own dedup also
  // needs to see other sources' rows (e.g. manual_curated records) to
  // avoid re-staging something already covered elsewhere. See
  // fetchExistingListings' own comment for why this pages explicitly
  // rather than relying on a single select's 1000-row cap.
  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const role of roles) {
    const raw: RawListing = {
      title: role.title,
      description: role.description,
      location: role.location ?? config.orgAddress,
      external_id: role.externalId,
      application_url: role.sourceUrl,
    };
    const normalized = normalizeListing(raw, { source: config.sourceSlug, sourceUrl: role.sourceUrl });
    normalized.minimum_age = role.minimumAge;

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

    const dedup = findDuplicate(
      {
        source: config.sourceSlug,
        external_id: role.externalId,
        title: role.title,
        organizationName: config.orgName,
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

    const payload = { ...normalized, organization_id: org.id, is_stale: false, embedding, availability_status: "unverified" as const };

    if (!dedup) {
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${role.title}": ${error.message}`);
        continue;
      }
      log(`+ Created (pending review): ${role.title} (min age ${role.minimumAge})`);
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
      log(`- Skipped "${role.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (${dedup.reason}, similarity ${dedup.similarity.toFixed(2)})`);
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);
  await recordIngestionRun(supabase, {
    source: config.sourceSlug,
    status: "success",
    listingsFound: roles.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });
  return { parsed: roles.length, created, updated, skipped, ageFiltered, orgId: org.id, logs };
}

export async function runSamaritanSantaClaritaFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[0], options);
}
export async function runSamaritanPrinceGeorgesParksFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[1], options);
}
export async function runSamaritanMetroLibraryOkcFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[2], options);
}
export async function runSamaritanMontgomeryParksFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[3], options);
}
export async function runSamaritanEastBayRegionalParksFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[4], options);
}
export async function runSamaritanCityOfAuroraCoFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[5], options);
}
export async function runSamaritanJohnsonCountyLibraryFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[6], options);
}
export async function runSamaritanPeoriaParkDistrictIlFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[7], options);
}
export async function runSamaritanCaliforniaFishWildlifeFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[8], options);
}
export async function runSamaritanTexasParksWildlifeFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runSamaritanFetch(supabase, SAMARITAN_SOURCES[9], options);
}
