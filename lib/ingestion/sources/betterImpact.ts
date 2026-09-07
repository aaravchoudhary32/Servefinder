// Reusable connector for any Arizona municipality running its volunteer
// program on the Better Impact "MyImpactPage" platform
// (app.betterimpact.com/PublicEnterprise/{enterpriseGuid}) — discovered
// during the catalog-expansion research pass when both Mesa and Gilbert
// turned out to use the identical platform. This file is intentionally
// config-driven (see BETTER_IMPACT_SOURCES below) rather than one file
// per city: adding a third municipality on this same platform is a new
// config entry, not new code.
//
// Personally verified live (Playwright, headless Chrome) before writing
// this file:
//  - robots.txt for app.betterimpact.com disallows /Status/, /Application/,
//    /Content/, /Images/, /System/ — NOT /PublicEnterprise/, the path
//    this connector reads. Confirmed via direct fetch.
//  - The homepage's opportunity content is loaded client-side (the raw
//    HTML response contains no activity data — confirmed via curl),
//    so this needs a real browser, not a plain fetch()+regex parser
//    (same reasoning cityOfPhoenix.ts and specialOlympicsAZ.ts already
//    documented for their own JS-heavy sources).
//  - Each activity has a stable identifier (activityGuid) exposed in its
//    own EnterpriseActivity URL, and a real per-activity application
//    URL ("Fill in an application" -> /Application/LoggedInApplicationRedirect
//    ?...&ActivityGUID=...), not just a generic contact form.
//
// Teen-eligibility handling — the actual reason this connector exists in
// this specific shape: an activity's minimum age is NEVER inferred from
// free-text descriptions (most say nothing about age at all, and one
// verified example — "Community Engagement Unit - Event Photographer" —
// requires a background investigation AND polygraph, clearly not teen-
// appropriate despite having no stated age floor). Instead, this
// connector reads the platform's OWN structured suitability facets
// (the sidebar search filters, e.g. "Suitable for youth 12-15" / "Youth
// 16 and Over") and only ever ingests an activity that's explicitly
// tagged under a youth facet with a parseable numeric age. An activity
// with no youth facet at all (like the Event Photographer role above)
// is simply never seen by this connector — it doesn't appear in any of
// the youth-filtered search results, so it's correctly excluded by
// construction, not by a judgment call this code has to make.
//
// Facet SEARCH IDs ARE NOT SHARED across cities on this platform —
// verified live: Mesa's "youth 12-15"/"youth 16+" facets are SearchId
// 2657/1327, while Gilbert's differently-worded "Youth 14-16"/"Youth 16
// and Over"/"Youth with Supervision" facets are SearchId 4783/4740/4736.
// So this connector always discovers each org's own facet IDs fresh from
// its homepage sidebar rather than hardcoding any city's numbers —
// required for this to be a genuinely reusable connector, not two
// hardcoded configs pretending to be one.
//
// Status handling: every listing found this way lacks a structured
// "posted"/"last updated" date, and at least one verified example
// (a "Read On Mesa" book drive) contains a plainly expired deadline
// embedded in unstructured prose ("Project deadline: April 1st, 2015")
// while still being live and youth-tagged on the site today — clear
// evidence this platform doesn't reliably retire stale listings. Per
// this app's status rules (open only when a source CONFIRMS a student
// can currently act), every row from this connector is staged with
// availability_status "unverified", never "open" — a human reviewer
// must confirm currency before approval, same posture as any source
// that can't self-report freshness.

import type { SupabaseClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright";
import sparticuzChromium from "@sparticuz/chromium";
import { normalizeListing, findDuplicate, extractMinimumAge, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

export type BetterImpactSourceConfig = {
  sourceSlug: string; // e.g. "better_impact_mesa" — used as opportunities.source
  orgName: string;
  orgDescription: string;
  orgAddress: string;
  orgZip: string;
  enterpriseGuid: string;
  cityLabel: string; // for logging only
  // Activity GUIDs to skip even if they're youth-facet-tagged — for a
  // department already covered by its own dedicated connector/manual
  // records elsewhere in this app, reachable through this SAME real
  // activityGuid via a second page structure (confirmed live for City
  // of San José's "King Library - Youth Services" department, whose
  // activities are the identical Better Impact records already staged
  // as manual records under org "San José Public Library — King Library
  // Youth Services" in lib/manualRecords.ts). A same-source-external_id
  // dedup can't catch this on its own, since this connector's own
  // sourceSlug always differs from "manual_curated" — this exclusion is
  // what actually prevents the duplicate, checked before staging.
  excludeActivityGuids?: string[];
};

// New municipalities on this same platform are added here, not as new
// files. Both entries below were personally verified live (real
// robots.txt check, real rendered page, real youth-suitability facets
// with real counts) before being added.
export const BETTER_IMPACT_SOURCES: BetterImpactSourceConfig[] = [
  {
    sourceSlug: "better_impact_mesa",
    orgName: "City of Mesa",
    orgDescription:
      "Official volunteer opportunities across City of Mesa departments — Mesa Arts Center, Mesa Public Library, Arizona Museum of Natural History, Mesa Police and Fire, and more — coordinated through the city's MyImpactPage volunteer portal.",
    orgAddress: "20 E. Main St., Mesa, AZ 85201",
    orgZip: "85201",
    enterpriseGuid: "1927de80-881a-4c5c-ab9c-79ce376d17f7",
    cityLabel: "Mesa",
  },
  {
    sourceSlug: "better_impact_gilbert",
    orgName: "Town of Gilbert",
    orgDescription:
      "Official volunteer opportunities across Town of Gilbert departments — Fire & Rescue, Police, Parks & Recreation, Town Hall, and more — coordinated through the town's MyImpactPage volunteer portal.",
    orgAddress: "50 E. Civic Center Dr., Gilbert, AZ 85296",
    orgZip: "85296",
    enterpriseGuid: "bbe8c32a-b15c-4d80-8d48-f1f3bfe3fed6",
    cityLabel: "Gilbert",
  },
  // First non-Arizona tenant on this platform — added during the
  // nationwide-expansion pass after confirming live (real browser,
  // robots.txt checked) that City of Sacramento runs the identical
  // MyImpactPage platform with the same "Suitable for youth 12-15" /
  // "Suitable for youth 16 and over" SuitabilityClassification facets
  // Mesa/Gilbert already use — same connector code, no adaptation
  // needed. The org's own about-page states plainly: "Some departments
  // can utilize volunteers as young as 12, while others require the
  // volunteer to be at least 21" — corroborating evidence the facets
  // reflect real per-department floors, not a platform default.
  {
    sourceSlug: "better_impact_sacramento",
    orgName: "City of Sacramento",
    orgDescription:
      "Official volunteer opportunities across City of Sacramento departments — Front Street Animal Shelter, Fairytale Town, Sacramento Fire Corps/CERT, Parks & Recreation, One Youth, Volunteers in Parks, and more — coordinated through the city's MyImpactPage volunteer portal.",
    orgAddress: "915 I St., Sacramento, CA 95814",
    orgZip: "95814",
    enterpriseGuid: "1f3410d7-4796-4e43-b4f8-681733dd6d9c",
    cityLabel: "Sacramento",
  },
  // Second Phase-2 addition: City of San José, CA — confirmed live with
  // real "Suitable for youth 13-15" (14) / "Suitable for youth 15+" (25)
  // SuitabilityClassification facets, same shape as Mesa/Gilbert/
  // Sacramento. IMPORTANT: this enterprise's "Library - King Library -
  // Youth Services" department (Organization SearchId 8123) shares the
  // EXACT SAME activityGuids as this app's existing manual San José
  // Public Library records (confirmed live, e.g. activityGuid
  // 434ba341-033f-4592-81da-a71544b61f1b = "Teen Book Reviewer" on both
  // this enterprise search AND the standalone PublicOrganization page
  // those manual records were sourced from) — excludeActivityGuids below
  // lists all 6 of that department's activities (5 already staged as
  // manual records, plus "ChAD 60 Homework Coach", already reviewed and
  // deliberately excluded from the manual batch for its own separate
  // SJSU-enrollment requirement) so this connector never restages them
  // under a second, different source.
  {
    sourceSlug: "better_impact_san_jose",
    orgName: "City of San José",
    orgDescription:
      "Official volunteer opportunities across City of San José departments — Parks & Recreation, Adopt-a-Park/Adopt-a-Trail, community centers, BeautifySJ, and most library branches (excluding King Library Youth Services, already covered by its own dedicated records) — coordinated through the city's MyImpactPage volunteer portal.",
    orgAddress: "200 E. Santa Clara St., San José, CA 95113",
    orgZip: "95113",
    enterpriseGuid: "8370465d-3777-4b73-b24b-3efd11ca6c09",
    cityLabel: "San José",
    excludeActivityGuids: [
      "b723c272-ddd9-4522-a9a3-f4514a9bfca8", // ChAD 60 Homework Coach — SJSU-enrollment requirement, already reviewed and excluded
      "1f239d86-26fc-4004-a6e5-aded08233a89", // Teen Authors Corner — already a manual record
      "4c1b1465-1bcd-4faf-8705-c118551e349d", // Teen Library Volunteer — already a manual record
      "46e9cd7b-a3fd-4df3-95b0-31d537fd644d", // Teens Reach — already a manual record
      "434ba341-033f-4592-81da-a71544b61f1b", // Teen Book Reviewer — already a manual record
      "5f76d72e-9e8f-4326-b2c7-d93d93ff9e91", // San José Youth Advisory Council (YAC) — already a manual record
    ],
  },
  // Third Phase-2 addition: City of Boise, ID — confirmed live (plain
  // curl of the enterprise homepage) with exactly one youth
  // SuitabilityClassification facet: "Suitable for youth 16 and over"
  // (SearchId 1169) — same shape as Mesa/Gilbert/Sacramento/San José, no
  // adaptation needed. Note: Zoo Boise (a sub-org under this same
  // enterprise) separately markets a "Zoo Teen Program (13-17)" with a
  // title-embedded age narrower than this facet's 16+ floor — since it
  // isn't itself tagged under any youth facet, this connector correctly
  // never sees it (excluded by construction, not a judgment call); it
  // would need independent live verification before being added as its
  // own manual record in a future pass.
  {
    sourceSlug: "better_impact_boise",
    orgName: "City of Boise",
    orgDescription:
      "Official volunteer opportunities across City of Boise departments — Boise Parks & Recreation, Community Centers, Open Space Division, The WaterShed, and more — coordinated through the city's MyImpactPage volunteer portal.",
    orgAddress: "150 N. Capitol Blvd., Boise, ID 83702",
    orgZip: "83702",
    enterpriseGuid: "2a2fdaa1-32e5-4ef4-8eef-3cae02a41ce7",
    cityLabel: "Boise",
  },
  // Fourth Phase-2 addition: City of Roseville, CA — confirmed live
  // (plain curl of the enterprise homepage) with two real youth
  // SuitabilityClassification facets: "Suitable for youth 12-15" (12
  // activities) and "Suitable for youth 16 and over" (24 activities) —
  // same shape as Mesa/Gilbert/Sacramento/San José/Boise, no adaptation
  // needed. Highest-yield Better Impact addition since San José.
  {
    sourceSlug: "better_impact_roseville",
    orgName: "City of Roseville Community Volunteer Center",
    orgDescription:
      "Official volunteer opportunities across City of Roseville departments — Parks & Recreation, Library, Utility Exploration Center, and more — coordinated through the city's MyImpactPage volunteer portal.",
    orgAddress: "311 Vernon St., Roseville, CA 95678",
    orgZip: "95678",
    enterpriseGuid: "da97cc19-7bca-416f-b82a-ac6417dbc5e7",
    cityLabel: "Roseville",
  },
  // Fifth Phase-2 addition: Corvallis Parks & Recreation, OR —
  // confirmed live (plain curl of the enterprise homepage) with exactly
  // one youth SuitabilityClassification facet: "Suitable for youth 16
  // and over" (13 activities) — same shape as Boise, no adaptation
  // needed.
  {
    sourceSlug: "better_impact_corvallis",
    orgName: "Corvallis Parks & Recreation",
    orgDescription:
      "Official volunteer opportunities across Corvallis Parks & Recreation department programs — parks operations, forestry and natural areas, aquatic center, and more — coordinated through the city's MyImpactPage volunteer portal.",
    orgAddress: "501 SW Madison Ave, Corvallis, OR 97333",
    orgZip: "97333",
    enterpriseGuid: "2045eae9-4b9e-48e7-a032-b7eaacdde0a7",
    cityLabel: "Corvallis",
  },
];

const BASE = "https://app.betterimpact.com/PublicEnterprise";

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  } catch {
    return await chromium.launch({ headless: true, channel: "chrome" });
  }
}

/** Exported for lib/ingestion/sources/betterImpact.test.ts. Parses a
 * minimum age from a Better Impact suitability-facet label. Handles the
 * two real shapes seen live ("youth 12-15", "Youth 16 and Over") — never
 * guesses a number for a label with none (e.g. "Youth with Supervision"). */
export function parseMinimumAgeFromSuitabilityLabel(label: string): number | null {
  const range = label.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (range) return Number(range[1]);
  const plus = label.match(/(\d{1,2})\s*(?:\+|and (?:over|up))/i);
  if (plus) return Number(plus[1]);
  return null;
}

type YouthFacet = { searchId: string; label: string; minimumAge: number | null };

async function discoverYouthFacets(page: Page, enterpriseGuid: string): Promise<YouthFacet[]> {
  await page.goto(`${BASE}/${enterpriseGuid}`, { waitUntil: "networkidle", timeout: 30000 });
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim().replace(/\s+/g, " ") ?? "" }))
      .filter((l) => /SearchType=SuitabilityClassification/i.test(l.href) && /youth/i.test(l.text));
  });
  const facets: YouthFacet[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    const idMatch = l.href.match(/SearchId=(\d+)/);
    if (!idMatch || seen.has(idMatch[1])) continue;
    seen.add(idMatch[1]);
    const label = l.text.replace(/\d+$/, "").trim();
    facets.push({ searchId: idMatch[1], label, minimumAge: parseMinimumAgeFromSuitabilityLabel(label) });
  }
  return facets;
}

type ActivityRef = { activityGuid: string; title: string };

async function activitiesForFacet(page: Page, enterpriseGuid: string, searchId: string): Promise<ActivityRef[]> {
  await page.goto(`${BASE}/EnterpriseSearch?EnterpriseGuid=${enterpriseGuid}&SearchType=SuitabilityClassification&SearchId=${searchId}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  return page.evaluate(() => {
    const seen = new Set<string>();
    const results: { activityGuid: string; title: string }[] = [];
    for (const a of Array.from(document.querySelectorAll('a[href*="EnterpriseActivity"]'))) {
      const href = (a as HTMLAnchorElement).href;
      const idMatch = href.match(/activityGuid=([a-f0-9-]+)/i);
      if (!idMatch || seen.has(idMatch[1])) continue;
      seen.add(idMatch[1]);
      results.push({ activityGuid: idMatch[1], title: a.textContent?.trim() ?? "" });
    }
    return results;
  });
}

type ActivityDetail = {
  description: string;
  department: string | null;
  applicationUrl: string | null;
};

async function fetchActivityDetail(page: Page, enterpriseGuid: string, activityGuid: string): Promise<ActivityDetail> {
  await page.goto(`${BASE}/EnterpriseActivity?enterpriseGuid=${enterpriseGuid}&activityGuid=${activityGuid}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  return page.evaluate(() => {
    const applyLink = Array.from(document.querySelectorAll("a[href]")).find((a) =>
      /LoggedInApplicationRedirect/i.test((a as HTMLAnchorElement).href)
    ) as HTMLAnchorElement | undefined;

    const lines = document.body.innerText.split("\n").map((l) => l.trim()).filter(Boolean);
    // First line is the owning department/org (e.g. "Mayor's Office");
    // strip the leading "Back to Search Home Log in..." nav row and the
    // trailing share/social/apply boilerplate for a cleaner description.
    const department = lines[0] ?? null;
    const stopMarkers = ["I would like to volunteer", "Already use MyImpactPage.com", "Get Social", "MyImpactPage.com"];
    let endIdx = lines.length;
    for (const marker of stopMarkers) {
      const idx = lines.findIndex((l) => l.includes(marker));
      if (idx !== -1) endIdx = Math.min(endIdx, idx);
    }
    const description = lines.slice(2, endIdx).join(" ").replace(/\s+/g, " ").trim();

    return { description, department, applicationUrl: applyLink?.href ?? null };
  });
}

export type BetterImpactFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runBetterImpactFetch(
  supabase: SupabaseClient,
  config: BetterImpactSourceConfig,
  options: { dryRun?: boolean } = {}
): Promise<BetterImpactFetchResult> {
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
  config: BetterImpactSourceConfig,
  log: (line: string) => void,
  logs: string[],
  options: { dryRun?: boolean }
): Promise<BetterImpactFetchResult> {
  const browser = await launchBrowser();
  // activityGuid -> best-known info, accumulated across every youth
  // facet it appears under (an activity can be tagged under more than
  // one facet, e.g. both "youth 12-15" and "youth 16+" — the minimum
  // parseable age across all of them wins, since that's the true floor).
  const byActivity = new Map<string, { title: string; ages: number[] }>();

  try {
    const page = await browser.newPage();
    try {
      log(`Discovering youth-suitability facets for ${config.cityLabel} ...`);
      const facets = await discoverYouthFacets(page, config.enterpriseGuid);
      log(`Found ${facets.length} youth-labeled facet(s): ${facets.map((f) => `"${f.label}" (age=${f.minimumAge ?? "unparseable"})`).join(", ")}`);

      for (const facet of facets) {
        if (facet.minimumAge === null) {
          log(`Skipping facet "${facet.label}" — no parseable numeric age, never guessing one.`);
          continue;
        }
        const activities = await activitiesForFacet(page, config.enterpriseGuid, facet.searchId);
        log(`Facet "${facet.label}": ${activities.length} activities.`);
        for (const a of activities) {
          const existing = byActivity.get(a.activityGuid);
          if (existing) {
            existing.ages.push(facet.minimumAge);
          } else {
            byActivity.set(a.activityGuid, { title: a.title, ages: [facet.minimumAge] });
          }
        }
      }

      log(`${byActivity.size} distinct youth-eligible activities found across all facets.`);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (config.excludeActivityGuids?.length) {
    let excludedCount = 0;
    for (const guid of config.excludeActivityGuids) {
      if (byActivity.delete(guid)) excludedCount++;
    }
    if (excludedCount > 0) {
      log(`Excluded ${excludedCount} activity(ies) already covered by a dedicated connector/manual record elsewhere (see this config's excludeActivityGuids).`);
    }
  }

  if (byActivity.size === 0) {
    log("Nothing to ingest — no youth-tagged activities found (or page layout changed).");
    if (!options.dryRun) {
      await recordIngestionRun(supabase, {
        source: config.sourceSlug,
        status: "success",
        listingsFound: 0,
        listingsInserted: 0,
        listingsUpdated: 0,
        listingsSkippedDuplicate: 0,
      });
    }
    return { parsed: 0, created: 0, updated: 0, skipped: 0, orgId: null, logs };
  }

  if (options.dryRun) {
    log(`Dry run — ${byActivity.size} candidate activities found, no database writes performed:`);
    for (const [, info] of byActivity) {
      log(`  - ${info.title} (min age ${Math.min(...info.ages)})`);
    }
    return { parsed: byActivity.size, created: 0, updated: 0, skipped: 0, orgId: null, logs };
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

  const coords = await geocodeStudentLocation(config.orgZip, null);
  log(
    coords
      ? `Geocoded ${config.orgZip} -> ${coords.lat}, ${coords.lng}`
      : `Couldn't geocode ${config.orgZip} — listings will have no coordinates.`
  );

  const existing = await fetchExistingListings(supabase, { sourceSlug: config.sourceSlug });

  const browser2 = await launchBrowser();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const page = await browser2.newPage();
    try {
      for (const [activityGuid, info] of byActivity) {
        const facetMinimumAge = Math.min(...info.ages);
        const detail = await fetchActivityDetail(page, config.enterpriseGuid, activityGuid);
        const detailUrl = `${BASE}/EnterpriseActivity?enterpriseGuid=${config.enterpriseGuid}&activityGuid=${activityGuid}`;

        // Safety check, not a formality: the platform's own suitability
        // facets can be wrong for a specific listing — verified live, a
        // Mesa activity tagged "youth 16 and over" has a description
        // explicitly stating "Must be 18 years of age or older... valid
        // AZ driver's license... background check including
        // fingerprinting." Never let a broad facet tag override an
        // explicit, higher stated age in the listing's own text — only
        // ever raise the age (extractMinimumAge()'s own 13-floor default
        // when it finds nothing stated is never treated as evidence of
        // anything, only a real matched pattern is).
        const textStatedAge = extractMinimumAge(detail.description);
        const textFoundExplicitAge = new RegExp(
          "(?:volunteers? must be|must be)\\s*(?:at least\\s*)?\\d|minimum age|at least\\s*\\d+\\s*years?|ages?\\s*\\d+\\s*(?:and up|or older)|age[sd]?\\s*\\d+\\s*(?:through|to|-)\\s*\\d+|\\d+\\s*\\+|\\d+\\s*years?\\s*(?:old|of age)",
          "i"
        ).test(detail.description);
        const minimumAge = textFoundExplicitAge ? Math.max(facetMinimumAge, textStatedAge) : facetMinimumAge;
        if (textFoundExplicitAge && textStatedAge > facetMinimumAge) {
          log(`  NOTE: "${info.title}" tagged as youth ${facetMinimumAge}+ by the site's own facet, but its description explicitly states a minimum age of ${textStatedAge} — using ${textStatedAge}, the stricter/more accurate figure.`);
        }

        const raw: RawListing = {
          title: info.title,
          description: [detail.department ? `${detail.department}.` : null, detail.description || "See the official listing page for the full description and application details."]
            .filter(Boolean)
            .join(" "),
          location: config.orgAddress,
          external_id: activityGuid,
          application_url: detail.applicationUrl,
        };

        const normalized = normalizeListing(raw, { source: config.sourceSlug, sourceUrl: detailUrl });
        // Source-confirmed via the platform's own suitability facet, not
        // inferred from free text — see this file's header.
        normalized.minimum_age = minimumAge;
        normalized.latitude = coords?.lat ?? null;
        normalized.longitude = coords?.lng ?? null;

        const dedup = findDuplicate(
          {
            source: config.sourceSlug,
            external_id: activityGuid,
            title: info.title,
            organizationName: config.orgName,
            applicationUrl: normalized.application_url,
            applicationDeadline: normalized.application_deadline,
            location: normalized.location,
            minimumAge: normalized.minimum_age,
            sourceUrl: detailUrl,
          },
          existing
        );

        let embedding: number[] | null = null;
        try {
          embedding = await embed(normalized.description ?? info.title);
        } catch (err) {
          log(`Couldn't embed "${info.title}" — semantic matching will skip it for now: ${err}`);
        }

        const payload = {
          ...normalized,
          organization_id: org.id,
          is_stale: false,
          embedding,
          // Never confirmed "currently open" by this source — see this
          // file's header on stale/undated listings.
          availability_status: "unverified",
        };

        if (!dedup) {
          const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
          if (error) {
            log(`FAILED to insert "${info.title}": ${error.message}`);
            continue;
          }
          log(`+ Staged (pending review): ${info.title} (min age ${minimumAge})`);
          created++;
        } else if (dedup.reason === "external_id") {
          const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
          if (error) {
            log(`FAILED to update "${info.title}": ${error.message}`);
            continue;
          }
          log(`~ Updated: ${info.title} (already ingested, refreshed)`);
          updated++;
        } else {
          log(`- Skipped "${info.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (${dedup.reason})`);
          skipped++;
        }
      }
    } finally {
      await page.close();
    }
  } finally {
    await browser2.close();
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: config.sourceSlug,
    status: "success",
    listingsFound: byActivity.size,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: byActivity.size, created, updated, skipped, orgId: org.id, logs };
}

export async function runBetterImpactMesaFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[0], options);
}

export async function runBetterImpactGilbertFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[1], options);
}

export async function runBetterImpactSacramentoFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[2], options);
}

export async function runBetterImpactSanJoseFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[3], options);
}

export async function runBetterImpactBoiseFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[4], options);
}

export async function runBetterImpactRosevilleFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[5], options);
}

export async function runBetterImpactCorvallisFetch(supabase: SupabaseClient, options: { dryRun?: boolean } = {}) {
  return runBetterImpactFetch(supabase, BETTER_IMPACT_SOURCES[6], options);
}
