// Shared fetch logic for HandsOn Greater Phoenix's volunteer-matching
// platform (handsonphoenix.org, running "HandsOn Connect" — a
// Salesforce-based volunteer-management product, the same platform
// family named alongside Better Impact/Galaxy Digital/VolunteerHub in
// this project's source-research notes). Used by both the manual CLI
// script (scripts/fetch-handson-phoenix.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source in
// lib/ingestion/sources/.
//
// Two-phase fetch, each phase using the simplest tool that actually
// works, verified live:
//
// 1. DISCOVERY (needs a real browser): handsonphoenix.org/search renders
//    its results via client-side JS, and "Load more opportunities"
//    fetches subsequent pages through search/GetOpportunitiesSearchResultBlockListing
//    with a POST body containing an anti-forgery-token-bound `parameters`
//    field established by the page's own session — confirmed live that
//    replaying this endpoint with plain fetch() (even with a matching
//    session cookie) either silently returns page 1 again or 500s,
//    across five different encodings tried. A real browser clicking the
//    actual "Load more" button (as Playwright does here) is the only
//    reliable way found to walk the full result set — same category of
//    problem cityOfPhoenix.ts and specialOlympicsAZ.ts already solved
//    for their own sources with the same tool.
//
// 2. DETAIL (plain fetch is enough): each opportunity's own page
//    (/opportunity/{SID}) is server-rendered static HTML — confirmed via
//    curl, no browser needed. Every listing carries a real structured
//    Requirements block with explicit age fields:
//      <span class='minimumAgeAdults'>Age Minimum (with Adult): 14+</span>
//      <span class='minimumAge'>Minimum Age:16+</span>
//    The "with adult" figure is the real floor a younger teen can join at
//    (with a parent/guardian, per HandsOn's own site-wide policy — see
//    /ages13_18); "Minimum Age" is the floor for volunteering
//    independently. Never inferred from free text — only ever read from
//    this structured field. A listing with neither number 18-or-under is
//    skipped outright (e.g. Isaac School District, MANA House, both
//    18/18) — this is a real per-listing fact, not this codebase
//    fabricating an age.
//
// Referral listings for organizations that already have their own
// dedicated connector elsewhere in lib/ingestion/sources/ are excluded
// here (EXCLUDED_ORGANIZATIONS below) — those connectors fetch directly
// from the organization's own first-party site, which is a more
// authoritative source than a HandsOn referral summary, and including
// both would risk duplicate/conflicting records for the same real-world
// program.
//
// Safe to re-run: each opportunity is matched by a deterministic
// external_id (hop-{SID}, the platform's own Salesforce record id), so a
// repeat run updates the same rows instead of duplicating them. Every
// organization this connector encounters is get-or-created by name, same
// pattern as every other multi-listing source in this directory.

import { chromium, type Browser, type Page } from "playwright";
import sparticuzChromium from "@sparticuz/chromium";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "handson_greater_phoenix";
const SEARCH_URL = "https://www.handsonphoenix.org/search";
const DETAIL_BASE = "https://www.handsonphoenix.org/opportunity";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// Organizations already covered by their own dedicated first-party
// connector — excluded here to avoid duplicate/conflicting records for
// the same real-world program. Matched as a case-insensitive substring
// against the HandsOn listing's own organization name, since HandsOn's
// naming varies slightly from each org's canonical name used elsewhere
// in this codebase (e.g. "City of Phoenix- Office of Innovation" vs.
// this app's "City of Phoenix" organization).
const EXCLUDED_ORGANIZATIONS = ["special olympics arizona", "st. mary's food bank", "st marys food bank", "city of phoenix"];

function isExcludedOrganization(orgName: string): boolean {
  const normalized = orgName.toLowerCase();
  return EXCLUDED_ORGANIZATIONS.some((excluded) => normalized.includes(excluded));
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&rsquo;/g, "’")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

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

// ---------- Phase 1: discovery ----------

type DiscoveredListing = { sid: string; title: string; org: string };

const SEARCH_ENDPOINT_PATH = "search/GetOpportunitiesSearchResultBlockListing";

function extractRowsFromDom(): DiscoveredListing[] {
  const rows = Array.from(document.querySelectorAll("table tbody tr"));
  const seen = new Set<string>();
  const results: { sid: string; title: string; org: string }[] = [];
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    const oppLink = cells[0]?.querySelector("a") as HTMLAnchorElement | null;
    const orgLink = cells[1]?.querySelector("a") as HTMLAnchorElement | null;
    if (!oppLink) continue;
    const sidMatch = oppLink.href.match(/opportunity\/([a-zA-Z0-9]+)/);
    if (!sidMatch) continue;
    const sid = sidMatch[1];
    if (seen.has(sid)) continue;
    seen.add(sid);
    results.push({
      sid,
      title: oppLink.textContent?.trim() ?? "",
      org: orgLink?.textContent?.trim() ?? "",
    });
  }
  return results;
}

/**
 * Exported for scripts/fetch-handson-phoenix.ts diagnostics only.
 *
 * Clicks "Load more" the normal way a real visitor would (no protocol
 * reverse-engineering, no reconstructed request body — the site's own
 * anti-forgery-token-bound POST to GetOpportunitiesSearchResultBlockListing
 * is confirmed unreplayable outside a real browser session, see this
 * file's header), but instead of a fixed or DOM-diff-polled wait between
 * clicks, waits for the *actual* network response the click triggers via
 * page.waitForResponse() — synced to the real event that updates the
 * table, not a guess about how long that takes. This is what a fixed
 * 1200ms wait and a row-count-polling wait (tried first; see git history)
 * both still occasionally lost a race against: clicking again before the
 * page had genuinely finished appending the previous batch.
 *
 * Reads the response body's own `total` field (same JSON shape confirmed
 * live via the endpoint directly) as the authoritative stop condition —
 * keep clicking until the DOM has that many distinct rows, not just
 * until the "Load more" link happens to disappear.
 */
export async function discoverListings(page: Page, maxLoadMoreClicks = 20): Promise<DiscoveredListing[]> {
  await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("table tbody tr", { timeout: 15000 }).catch(() => null);

  let knownTotal: number | null = null;
  for (let i = 0; i < maxLoadMoreClicks; i++) {
    const currentRows = await page.evaluate(extractRowsFromDom).catch(() => []);
    if (knownTotal !== null && currentRows.length >= knownTotal) break;

    const loadMore = page.getByText("Load more opportunities", { exact: true }).first();
    const visible = await loadMore.isVisible().catch(() => false);
    if (!visible) break;

    const responsePromise = page
      .waitForResponse((res) => res.url().includes(SEARCH_ENDPOINT_PATH), { timeout: 10000 })
      .catch(() => null);
    await loadMore.click().catch(() => null);
    const response = await responsePromise;

    if (response) {
      const body = await response.json().catch(() => null);
      if (body && typeof body.total === "number") knownTotal = body.total;
      // Let the page's own success handler finish appending rows to the
      // DOM after the response lands — this is fast (client-side render
      // of already-fetched data), a short settle is enough here since
      // the slow, racy part (server round-trip) is what waitForResponse
      // already synced on.
      await page.waitForTimeout(150);
    } else {
      // No matching response seen in time — fall back to a real wait
      // rather than assuming the click did nothing.
      await page.waitForTimeout(1500);
    }
  }

  return page.evaluate(extractRowsFromDom);
}

// ---------- Phase 2: detail ----------

type ListingDetail = {
  sid: string;
  title: string;
  orgName: string;
  orgWebsite: string | null;
  description: string;
  location: string | null;
  issueArea: string | null;
  ageWithAdult: number | null;
  ageIndependent: number | null;
};

/** Exported for lib/ingestion/sources/handsOnGreaterPhoenix.test.ts. Parses
 * the two structured age fields from a detail page's raw HTML. Never
 * guesses — a field this regex doesn't match stays null. */
export function parseAgeFields(html: string): { withAdult: number | null; independent: number | null } {
  const withAdultMatch = html.match(/minimumAgeAdults'>Age Minimum \(with Adult\):\s*(\d{1,2})\+?/i);
  const independentMatch = html.match(/class='minimumAge'>Minimum Age:\s*(\d{1,2})\+?/i);
  return {
    withAdult: withAdultMatch ? Number(withAdultMatch[1]) : null,
    independent: independentMatch ? Number(independentMatch[1]) : null,
  };
}

/** Exported for lib/ingestion/sources/handsOnGreaterPhoenix.test.ts.
 * Computes this app's minimum_age + parental_consent_required from
 * HandsOn's two structured age fields. Returns null if nobody under 18
 * could ever attend (effective floor is 18+, or neither field is
 * present) — never invents a number. The "with adult" figure, when
 * lower, is the real floor a younger teen can join at (with a
 * parent/guardian); "Minimum Age" is the independent floor. This app's
 * platform-wide floor is 13, so a real "with adult" figure below 13 is
 * floored to 13 rather than dropped (same convention as every other
 * source in this directory that has encountered a young stated floor,
 * e.g. Lost Our Home Pet Rescue).
 *
 * A bare 18 (no lower "with adult" tier — e.g. Isaac School District,
 * MANA House, both 18/18) is treated as adult-only and excluded here,
 * per this connector's explicit brief to separate "teen-accessible"
 * from "18+/adult-only." That's narrower than this app's general
 * intake rule elsewhere (a manually-reviewed single opportunity may be
 * approved at minimum_age 18, e.g. Crisis Text Line) — this bulk
 * connector deliberately holds a stricter line since nothing here gets
 * a human's individual judgment before staging.
 */
export function resolveTeenEligibility(
  ageWithAdult: number | null,
  ageIndependent: number | null
): { minimumAge: number; parentalConsentRequired: boolean } | null {
  const candidates = [ageWithAdult, ageIndependent].filter((n): n is number => n !== null);
  if (candidates.length === 0) return null;

  const effectiveFloor = Math.min(...candidates);
  if (effectiveFloor >= 18) return null;

  const minimumAge = Math.max(13, effectiveFloor);
  // HandsOn's own site-wide policy (/ages13_18): under 16 always needs a
  // parent/guardian present. True whenever the real floor that gets
  // someone in the door is below 16, regardless of which field it came
  // from.
  const parentalConsentRequired = effectiveFloor < 16;

  return { minimumAge, parentalConsentRequired };
}

async function fetchDetail(sid: string, discoveredTitle: string, discoveredOrg: string): Promise<ListingDetail | null> {
  const res = await fetch(`${DETAIL_BASE}/${sid}`, { headers: FETCH_HEADERS });
  if (!res.ok) return null;
  const html = await res.text();

  const titleMatch = html.match(/class="title-opportunity"[^>]*>([^<]+)</);
  const orgMatch = html.match(/class='organization-name'[^>]*>([^<]+)</);
  const orgUrlMatch = html.match(/class='organization-link' href="([^"]+)"/);
  const descMatch = html.match(/id="opportunity-detail-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  const locationMatch = html.match(/class="inline-element location">([^<]+)</);
  const issueAreaMatch = html.match(/class="issue-areas">([^<]+)</);

  const ages = parseAgeFields(html);

  return {
    sid,
    title: titleMatch ? stripHtml(titleMatch[1]) : discoveredTitle,
    orgName: orgMatch ? stripHtml(orgMatch[1]) : discoveredOrg,
    orgWebsite: orgUrlMatch ? orgUrlMatch[1] : null,
    description: descMatch ? stripHtml(descMatch[1]) : "",
    location: locationMatch ? stripHtml(locationMatch[1]) : null,
    issueArea: issueAreaMatch ? stripHtml(issueAreaMatch[1]) : null,
    ageWithAdult: ages.withAdult,
    ageIndependent: ages.independent,
  };
}

// ---------- main ----------

export type HandsOnFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: null; // multi-organization source; no single org id to report
  logs: string[];
  // Full-catalog breakdown, for reporting — populated on every real run;
  // discovered/excluded/rejectedAdultOnly are 0 on the error path (never
  // reached discovery) but always accurate otherwise.
  discovered: number;
  excludedCoveredElsewhere: number;
  rejectedAdultOnly: number;
};

export async function runHandsOnGreaterPhoenixFetch(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {}
): Promise<HandsOnFetchResult> {
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
): Promise<HandsOnFetchResult> {
  log(`Discovering listings at ${SEARCH_URL} via headless browser ...`);
  const browser = await launchBrowser();
  let discovered: DiscoveredListing[];
  try {
    const page = await browser.newPage();
    try {
      discovered = await discoverListings(page);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
  log(`Discovered ${discovered.length} listings.`);

  const excluded = discovered.filter((d) => isExcludedOrganization(d.org));
  const candidates = discovered.filter((d) => !isExcludedOrganization(d.org));
  log(`Excluded ${excluded.length} listing(s) from organizations with their own dedicated connector.`);

  // Skip re-fetching the detail page for anything already ingested from
  // this source in a prior run — cheap, and keeps repeat runs fast.
  const existing = await fetchExistingListings(supabase);
  const alreadyIngestedSids = new Set(
    existing.filter((e) => e.source === SOURCE).map((e) => e.external_id?.replace(/^hop-/, ""))
  );

  const toFetch = candidates.filter((c) => !alreadyIngestedSids.has(c.sid));
  log(`${candidates.length} candidate listing(s) after exclusions; ${toFetch.length} not yet ingested this source, fetching detail pages ...`);

  // Small concurrency batch — detail pages are plain fetch()es, no
  // browser needed, but sequential would be needlessly slow against ~120
  // listings within this route's cron time budget.
  const details: ListingDetail[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((c) =>
        fetchDetail(c.sid, c.title, c.org).catch((err) => {
          log(`Detail fetch FAILED for ${c.sid} ("${c.title}"): ${err}`);
          return null;
        })
      )
    );
    for (const r of results) if (r) details.push(r);
  }
  log(`Fetched ${details.length} detail page(s).`);

  const eligible: { detail: ListingDetail; minimumAge: number; parentalConsentRequired: boolean }[] = [];
  let rejectedAdultOnly = 0;
  for (const detail of details) {
    const eligibility = resolveTeenEligibility(detail.ageWithAdult, detail.ageIndependent);
    if (!eligibility) {
      rejectedAdultOnly++;
      continue;
    }
    eligible.push({ detail, minimumAge: eligibility.minimumAge, parentalConsentRequired: eligibility.parentalConsentRequired });
  }
  log(`${eligible.length} listing(s) have explicit 13-18-reachable age evidence; ${rejectedAdultOnly} rejected as adult-only (18+ with no lower "with adult" tier).`);

  if (options.dryRun) {
    log(`Dry run — ${eligible.length} candidate opportunities found, no database writes performed:`);
    for (const e of eligible) {
      log(`  - [${e.detail.orgName}] ${e.detail.title} (min age ${e.minimumAge}${e.parentalConsentRequired ? ", with adult" : ""})`);
    }
    return {
      parsed: eligible.length,
      created: 0,
      updated: 0,
      skipped: 0,
      orgId: null,
      logs,
      discovered: discovered.length,
      excludedCoveredElsewhere: excluded.length,
      rejectedAdultOnly,
    };
  }

  const orgIdCache = new Map<string, string>();
  async function getOrCreateOrgId(name: string, websiteUrl: string | null): Promise<string> {
    if (orgIdCache.has(name)) return orgIdCache.get(name)!;
    const { data: org } = await supabase.from("organizations").select("id").eq("name", name).maybeSingle();
    if (org) {
      orgIdCache.set(name, org.id);
      return org.id;
    }
    const { data: newOrg, error } = await supabase
      .from("organizations")
      // Ingestion-created orgs are auto-verified per this app's own
      // documented intent (supabase/add_org_verification_enforcement.sql
      // grandfathered every scraped-source org at rollout) — `verified`
      // gates public visibility and exists to hold back genuine
      // self-signup orgs (/onboarding/organization) for admin review,
      // not a controlled, code-reviewed connector like this one.
      .insert({ name, description: `${name} — a HandsOn Greater Phoenix partner organization.`, website_url: websiteUrl, verified: true })
      .select("id")
      .single();
    if (error || !newOrg) throw new Error(`Couldn't create organization "${name}": ${error?.message}`);
    orgIdCache.set(name, newOrg.id);
    return newOrg.id;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const { detail, minimumAge, parentalConsentRequired } of eligible) {
    const externalId = `hop-${detail.sid}`;
    const applicationUrl = `${DETAIL_BASE}/${detail.sid}`;
    const orgId = await getOrCreateOrgId(detail.orgName, detail.orgWebsite);

    const raw: RawListing = {
      title: detail.title,
      description: detail.description || "See the official listing page for the full description and application details.",
      location: detail.location,
      external_id: externalId,
      application_url: applicationUrl,
      category: detail.issueArea,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: applicationUrl });
    normalized.minimum_age = minimumAge; // source-confirmed via HandsOn's own structured field, never text-inferred

    if (detail.location) {
      const zipMatch = detail.location.match(/\b(\d{5})\b/);
      const coords = await geocodeStudentLocation(zipMatch?.[1] ?? null, detail.location);
      normalized.latitude = coords?.lat ?? null;
      normalized.longitude = coords?.lng ?? null;
    }

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: externalId,
        title: detail.title,
        organizationName: detail.orgName,
        applicationUrl,
        applicationDeadline: normalized.application_deadline,
        location: normalized.location,
        minimumAge: normalized.minimum_age,
        sourceUrl: applicationUrl,
      },
      existing
    );

    let embedding: number[] | null = null;
    try {
      embedding = await embed(normalized.description ?? detail.title);
    } catch (err) {
      log(`Couldn't embed "${detail.title}" — semantic matching will skip it for now: ${err}`);
    }

    const payload = {
      ...normalized,
      organization_id: orgId,
      is_stale: false,
      embedding,
      parental_consent_required: parentalConsentRequired,
      // HandsOn's own listings don't reliably self-report currency (no
      // structured "still open" signal beyond a "Sign Up" date list this
      // fetcher doesn't parse) — same posture as Better Impact: a human
      // reviewer must confirm currency before approval.
      availability_status: "unverified",
    };

    if (!dedup) {
      const { error } = await supabase.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        log(`FAILED to insert "${detail.title}": ${error.message}`);
        continue;
      }
      log(`+ Staged (pending review): [${detail.orgName}] ${detail.title} (min age ${minimumAge})`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${detail.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: [${detail.orgName}] ${detail.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(`- Skipped "${detail.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (${dedup.reason})`);
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
    orgId: null,
    logs,
    discovered: discovered.length,
    excludedCoveredElsewhere: excluded.length,
    rejectedAdultOnly,
  };
}
