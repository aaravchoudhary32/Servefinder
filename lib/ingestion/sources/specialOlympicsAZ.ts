// Shared fetch logic for Special Olympics Arizona's volunteer page
// (specialolympicsarizona.org/volunteer/). Used by both the manual CLI
// script (scripts/fetch-special-olympics-az.ts) and the weekly Vercel
// cron (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source
// in lib/ingestion/sources/.
//
// The second headless-browser source, but for a different reason than
// cityOfPhoenix.ts: this page's HTML *is* server-rendered (no client-side
// framework rendering the listings), but the site sits behind a WAF that
// returns a 403 "Forbidden" block page to any non-browser HTTP client —
// confirmed live, both curl and Node's own fetch() (with a full
// browser-realistic header set, not just a spoofed User-Agent) get
// blocked identically; a real headless Chromium gets a clean 200 with
// the full page. So this needs Playwright to get past the WAF, then
// parses real static HTML once it's through — not a JS-rendered SPA
// like City of Phoenix's portal.
//
// The page has two different kinds of content, confirmed by inspecting
// the rendered HTML directly: (1) a paginated grid of ~35 dated,
// region-tagged one-time events (Swim/Bocce/Golf/Bowling/Soccer/Softball
// competitions, fundraisers, state games), each with a title, region,
// date, and a signup link to a third-party registration portal
// (portals.specialolympics.org) but no description text of its own; and
// (2) a separate "Volunteer Roles" FAQ section describing generic,
// ongoing role types (Coach, Unified Partner, Head of Delegation, ...)
// with real Commitment/Role/Requirements text, but no date, region, or
// individual signup link. Only (1) is ingested here — it maps cleanly to
// this app's opportunity model (a place, a date, a way to sign up); the
// FAQ roles don't have enough of their own identity (no location, no
// specific application link) to be individual browsable opportunities,
// so instead one of them — the "Event Volunteer" blurb, which is what
// showing up to any of these dated events actually involves — is reused
// as the shared description template below.
//
// No login wall to browse the page or its event list. No robots.txt
// disallow (the site's robots.txt itself 403s the same way the rest of
// the domain does under a non-browser client, but a real browser can
// read it and it has no relevant Disallow rules). Not a paid third-party
// platform — this is the org's own site; portals.specialolympics.org
// (where "Volunteer" actually links to) is a separate registration
// system deliberately not scraped, same posture as St. Mary's/Phoenix
// Rescue Mission's own booking systems.
//
// Safe to re-run: each event is matched by the GUID in its signup
// link's ?id= query param (a stable identifier the site itself assigns),
// used as external_id — a repeat run updates the same rows instead of
// duplicating them.

import { chromium, type Browser, type Page } from "playwright";
import sparticuzChromium from "@sparticuz/chromium";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation, type Coordinates } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "special_olympics_az";
const ORG_NAME = "Special Olympics Arizona";
const ORG_DESCRIPTION =
  "Statewide chapter of Special Olympics coordinating sports competitions and events for athletes with intellectual disabilities across Arizona, relying on volunteers for event-day support, coaching, and season-long team roles.";
const BASE_URL = "https://specialolympicsarizona.org/volunteer/";
// Safety cap on pagination — protects against a config problem on the
// site's end reporting an implausible page count, not a real expectation
// of ever needing this many (the real count seen live was 4).
const MAX_PAGES = 20;

// Region filter slugs -> a representative city/ZIP for geocoding and a
// human-readable label. Events are tagged by region on the page, not a
// street address — the closest a regional event can get to a real
// location without one to geocode directly. The live filter list has 8
// regions, not the 6 originally assumed — Prescott & Chino Valley and
// Sedona & Cottonwood both exist and have real scheduled events.
const REGIONS: Record<string, { label: string; zip: string; city: string }> = {
  "flagstaff": { label: "Flagstaff", zip: "86001", city: "Flagstaff, AZ" },
  "kingman-bullhead-city": { label: "Kingman & Bullhead City", zip: "86401", city: "Kingman, AZ" },
  "lake-havasu": { label: "Lake Havasu", zip: "86403", city: "Lake Havasu City, AZ" },
  "phoenix-valley": { label: "Phoenix Valley", zip: "85003", city: "Phoenix, AZ" },
  "prescott-chino-valley": { label: "Prescott & Chino Valley", zip: "86301", city: "Prescott, AZ" },
  "sedona-cottonwood": { label: "Sedona & Cottonwood", zip: "86336", city: "Sedona, AZ" },
  tucson: { label: "Tucson", zip: "85701", city: "Tucson, AZ" },
  yuma: { label: "Yuma", zip: "85364", city: "Yuma, AZ" },
};

// The site's own "Event Volunteer" role description (from the
// "Volunteer Roles" FAQ section), reused verbatim as the shared
// description for every dated event, since individual event cards carry
// no description of their own — just title/region/date/signup link.
// Hand-copied from the live page rather than parsed out of the FAQ
// accordion at fetch time: it's stable, generic boilerplate that rarely
// changes, and parsing it dynamically would add a second, fragile parse
// path for four sentences of copy.
const EVENT_VOLUNTEER_BLURB =
  "Assist in a variety of roles to help make the event a success! Many shifts consist of measuring, timing, or score keeping. Volunteers are always encouraged to cheer the athletes on. One approximately 4-hour shift (or as many shifts as you'd like). Sign the volunteer waiver on-site; advance registration is preferred but not required.";

// Site-wide eligibility policy (an FAQ answer, not a per-event field) —
// see the minimum_age override below for why the enforced age is 14,
// not 8, despite younger volunteers being allowed to attend accompanied.
const AGE_NOTE =
  "Volunteers must be 14 or older to volunteer independently. Youth ages 8-13 may volunteer if accompanied by an adult volunteer (one adult per 4 youth).";

// @sparticuz/chromium ships a Linux x64 Chromium build with the shared
// libraries (libnspr4.so and friends) statically bundled alongside it —
// Vercel's function runtime doesn't otherwise provide them, which is
// what actually broke this fetcher after the cron-route consolidation
// (confirmed live on lib/ingestion/sources/cityOfPhoenix.ts, the other
// Playwright source: chrome-headless-shell failed with "libnspr4.so:
// cannot open shared object file", not a bundling/tracing gap this
// time — a real missing OS-level dependency). See next.config.js's
// outputFileTracingIncludes for the matching trace entry this binary
// needs.
//
// It has no macOS/Windows build at all, so local dev (this file's own
// CLI script, scripts/fetch-special-olympics-az.ts) still needs a
// fallback to the machine's real installed Chrome via Playwright's own
// "chrome" channel — same fallback shape as before, just behind the
// new primary path instead of Playwright's own bundled Chromium.
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

// ---------- page parsing ----------

type ParsedEvent = {
  title: string;
  region: string; // slug, e.g. "tucson"
  date: string; // MM/DD/YYYY as shown on the page
  externalId: string;
  sourceUrl: string;
};

async function extractEventsFromPage(page: Page): Promise<ParsedEvent[]> {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[data-elementor-type="loop-item"]'));
    const results: { title: string; region: string; date: string; externalId: string; sourceUrl: string }[] = [];

    for (const item of items) {
      const regionClass = Array.from(item.classList).find((c) => c.startsWith("region-"));
      const region = regionClass ? regionClass.replace("region-", "") : null;

      const titleEl = item.querySelector("h4.elementor-heading-title");
      const title = titleEl?.textContent?.trim() ?? null;

      const dateEl = Array.from(item.querySelectorAll(".elementor-icon-list-text")).find((el) =>
        /^\d{2}\/\d{2}\/\d{4}$/.test(el.textContent?.trim() ?? "")
      );
      const date = dateEl?.textContent?.trim() ?? null;

      const link = item.querySelector('a[href*="portals.specialolympics.org/event-details"]');
      const href = link?.getAttribute("href") ?? null;
      const idMatch = href?.match(/[?&]id=([a-f0-9-]+)/);
      const externalId = idMatch ? idMatch[1] : null;

      if (region && title && date && href && externalId) {
        results.push({ title, region, date, externalId, sourceUrl: href });
      }
    }
    return results;
  });
}

/** Exported for lib/ingestion/sources/specialOlympicsAZ.test.ts — the one piece of this file's logic that's a pure function worth testing directly, same reasoning as csvImport.ts's exported helpers. */
export function mmddyyyyToIso(date: string): string | null {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Exported for the same reason as mmddyyyyToIso above. Formats an ISO
 * (YYYY-MM-DD) date for appending to an event title — "Nov 5, 2026" —
 * used to disambiguate multiple same-titled sessions of one recurring
 * event type (see the title-construction comment where this is called). */
export function formatEventDateForTitle(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const monthIndex = Number(mm) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${MONTH_ABBREV[monthIndex]} ${Number(dd)}, ${yyyy}`;
}

async function readMaxPage(page: Page): Promise<number> {
  const maxPage = await page.evaluate(() => {
    const anchor = document.querySelector(".e-load-more-anchor");
    const raw = anchor?.getAttribute("data-max-page");
    return raw ? Number(raw) : 1;
  });
  return Number.isFinite(maxPage) && maxPage > 0 ? Math.min(maxPage, MAX_PAGES) : 1;
}

// ---------- main ----------

export type SpecialOlympicsAZFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runSpecialOlympicsAZFetch(supabase: SupabaseClient): Promise<SpecialOlympicsAZFetchResult> {
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
): Promise<SpecialOlympicsAZFetchResult> {
  const browser = await launchBrowser();
  const events: ParsedEvent[] = [];

  try {
    const page = await browser.newPage();
    try {
      log(`Fetching ${BASE_URL} ...`);
      await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
      events.push(...(await extractEventsFromPage(page)));

      const maxPage = await readMaxPage(page);
      log(`Site reports ${maxPage} page(s) of results.`);

      for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
        const url = `${BASE_URL}${pageNum}/`;
        log(`Fetching ${url} ...`);
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        events.push(...(await extractEventsFromPage(page)));
      }
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }

  log(`Parsed ${events.length} dated events across all pages.`);
  if (events.length === 0) {
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

  // One geocode lookup per region, cached — at most 8 calls regardless
  // of how many events are on the page.
  const regionCoords = new Map<string, Coordinates | null>();
  async function coordsForRegion(regionSlug: string): Promise<Coordinates | null> {
    if (regionCoords.has(regionSlug)) return regionCoords.get(regionSlug) ?? null;
    const region = REGIONS[regionSlug];
    const coords = region ? await geocodeStudentLocation(region.zip, region.city) : null;
    regionCoords.set(regionSlug, coords);
    return coords;
  }

  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    const region = REGIONS[event.region];
    const regionLabel = region?.label ?? event.region;
    const isoDate = mmddyyyyToIso(event.date);

    const description = `One-time volunteer opportunity in ${regionLabel} on ${event.date}. ${EVENT_VOLUNTEER_BLURB} ${AGE_NOTE}`;

    // The site's own event titles are just "<Sport> Competition
    // (<Region>)" with no date — genuinely different calendar sessions
    // of the same recurring event type (each with its own real
    // external_id/application_url/deadline, confirmed live) end up
    // sharing an identical title otherwise. That's not a duplicate —
    // findDuplicate() correctly keeps them as separate rows via
    // external_id — but a student browsing Explore/Dashboard has no way
    // to tell two "Bocce Competition (Yuma)" cards apart, and neither
    // does a naive (org, title) duplicate scan. Appending the formatted
    // date makes every title unique whenever there's more than one
    // session, without changing anything for the (far more common)
    // case of a single session per title.
    const displayDate = formatEventDateForTitle(isoDate);
    const title = displayDate ? `${event.title} — ${displayDate}` : event.title;

    const raw: RawListing = {
      title,
      description,
      location: regionLabel,
      external_id: event.externalId,
      application_url: event.sourceUrl,
      application_deadline: isoDate,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: BASE_URL });
    // Explicit overrides, not left to normalizeListing()'s regex-based
    // inference over free text — same reasoning as the CSV importer's
    // field overrides (ARCHITECTURE.md §9): the real eligibility rule
    // ("14 to volunteer independently, 8-13 with an adult") isn't a
    // plain "X+" extractMinimumAge()'s patterns would reliably catch,
    // and every event here is confirmed to be a single dated occurrence
    // (the page's own commitment-type distinction — one-time events vs.
    // season-long roles — is what separated the two content types this
    // adapter chose between in the first place; see the file header).
    normalized.minimum_age = 14;
    normalized.commitment_type = "one_time";

    const coords = await coordsForRegion(event.region);
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: event.externalId,
        title: event.title,
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
      log(`Couldn't embed "${event.title}" — semantic matching will skip it for now: ${err}`);
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
        log(`FAILED to insert "${event.title}": ${error.message}`);
        continue;
      }
      log(`+ Created: ${event.title} (${regionLabel}, ${event.date})`);
      created++;
    } else if (dedup.reason === "external_id") {
      const { error } = await supabase.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        log(`FAILED to update "${event.title}": ${error.message}`);
        continue;
      }
      log(`~ Updated: ${event.title} (already ingested, refreshed)`);
      updated++;
    } else {
      log(
        `- Skipped "${event.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (similarity ${dedup.similarity.toFixed(2)})`
      );
      skipped++;
    }
  }

  log(`Done. ${created} created, ${updated} updated, ${skipped} skipped as likely duplicates.`);

  await recordIngestionRun(supabase, {
    source: SOURCE,
    status: "success",
    listingsFound: events.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: events.length, created, updated, skipped, orgId: org.id, logs };
}
