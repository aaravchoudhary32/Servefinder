// Shared fetch logic for Firewheel STEM Institute's volunteer page
// (firewheel.org/volunteer). Used by both the manual CLI script
// (scripts/fetch-firewheel-stem.ts) and the weekly Vercel cron
// (app/api/cron/fetch/[source]/route.ts, dispatched via
// lib/ingestion/sourceRegistry.ts) — same split as every other source
// in lib/ingestion/sources/.
//
// Added specifically to diversify STEM's single-location clustering: all
// 3 pre-existing STEM-tagged opportunities in the database come from one
// source (City of Phoenix) and sit at the same downtown building, Burton
// Barr Central Library — confirmed via real haversine distance that a
// student more than ~15-20 miles from that one location got zero STEM
// matches regardless of area density. This source is a real, physically
// distinct location (Chandler, east valley) with structured, individually
// listed roles — see ARCHITECTURE.md §1 and "Known trade-offs" for the
// research trail (Arizona Science Center, Mesa Public Library, and
// Challenger Space Center of Arizona were investigated and rejected
// first: same downtown zip, access-blocked, and dead content respectively).
//
// Plain fetch() + regex, not Playwright: checked live before writing any
// parsing code (same discipline as every other source). The site is
// Wix-built, but the actual role content is present in the initial
// server-rendered HTML — confirmed by grepping the raw fetch() response
// for every role name before assuming otherwise. No login wall, no WAF,
// no bot-blocking observed.
//
// Structurally closer to bgcCentralAZ.ts than specialOlympicsAZ.ts:
// there's no discrete, per-role markup to discover (the whole page is one
// long Wix rich-text blob — deeply nested wrapper divs with hashed class
// names, no per-role heading or card). What *is* structurally stable is
// three named sections (Event Volunteer / Program Mentor / Staff Support,
// each with its own anchor id: eventvolunteer/programmentor/staffsupport)
// and, within each, a flat <ul><li> bullet per named role. The page states
// one blanket age requirement per section, not per role — 16+ for Event
// Volunteer, 18+ (plus background check) for both Program Mentor and
// Staff Support — hand-read into ROLES below, same reasoning as BGC's
// hand-read category grouping: there's no structural signal a parser
// could use to discover this on its own. verifyRolesPresent() is the
// safeguard against that going stale silently.
//
// All 10 roles share one application path: a single Google Form
// ("please click the link below to fill out an interest form"), linked
// as application_url on every row — not a per-role form. Distinct from
// the unrelated "General Waiver" form link elsewhere on the page, which
// this fetcher deliberately does not use.
//
// Safe to re-run: each role is matched by a slug of its title as
// external_id, so a repeat run updates the same 10 rows instead of
// duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "firewheel_stem";
const PAGE_URL = "https://www.firewheel.org/volunteer";
const APPLICATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeb6HJ4G7gwIcTfdM_jm47z06kshZ48JX6aqJomrZr3ynXhKw/viewform";
const ORG_NAME = "Firewheel STEM Institute";
const ORG_DESCRIPTION =
  "501(c)(3) nonprofit STEM Center in Chandler sponsoring FIRST robotics teams and an underwater robotics competition, and running community STEM outreach — relying on event volunteers, program mentors, and staff support volunteers to operate.";
const ORG_LOCATION = "3225 N. Washington St., Chandler, AZ 85225";
const ORG_ZIP = "85225";
const LISTING_LOCATION = "Firewheel STEM Center, Chandler, AZ";

type SectionName = "Event Volunteer" | "Program Mentor" | "Staff Support";

type RoleDef = {
  title: string;
  section: SectionName;
  description: string;
  minimumAge: number;
  commitmentType: "one_time" | "recurring";
  // A short, distinctive substring confirmed present verbatim in the raw
  // page text — used by verifyRolesPresent(), kept separate from `title`
  // since a couple of titles are lightly cleaned up from the page's own
  // lowercase "...team" phrasing.
  verifyText: string;
};

/**
 * Hand-read from the page's own three sections (see file header for why
 * this can't be discovered structurally). Exported for
 * lib/ingestion/sources/firewheelStem.test.ts, so tests verify against
 * the real list rather than a hand-duplicated copy that could drift.
 */
export const ROLES: RoleDef[] = [
  // ---- Event Volunteer (16+, some positions may require an older minimum age) ----
  {
    title: "FIRST Lego League (FLL) December Tournament",
    section: "Event Volunteer",
    description:
      "Event Volunteer role: Firewheel, in partnership with Microchip Technology, hosts a 1-day FIRST Lego League (FLL) tournament each December in Chandler. Volunteer positions include queuers, check-in table, support table, game referees, judges, practice table supervision, game field resetters, and general support. No experience needed, although some positions require training or an overview prior to the event.",
    minimumAge: 16,
    commitmentType: "one_time",
    verifyText: "FIRST Lego League (FLL) December Tournament",
  },
  {
    title: "National Underwater Robotics Challenge (NURC)",
    section: "Event Volunteer",
    description:
      "Event Volunteer role: Firewheel holds a 3-day underwater robotics competition (NURC) at the ASU Polytechnic campus pool each summer. Volunteer positions include queuers, check-in table, judges, pool referees (requires SCUBA certification), and general support. No experience needed, although some positions require training or an overview prior to the event. See nurc.us for more information.",
    minimumAge: 16,
    commitmentType: "one_time",
    verifyText: "National Underwater Robotics Challenge (NURC)",
  },
  {
    title: "Mobile STEM Center",
    section: "Event Volunteer",
    description:
      "Event Volunteer role: Firewheel built a custom trailer to take STEM outreach on the road, teaching STEM concepts to students from 1st grade through high school. Volunteers help design and/or teach STEM curriculum; experience designing school curriculum or teaching (formally or informally) is preferred.",
    minimumAge: 16,
    commitmentType: "recurring",
    verifyText: "Mobile STEM Center",
  },
  // ---- Program Mentor (18+, background check required) ----
  {
    title: "Desert WAVE Underwater Autonomous Vehicle (AUV) Team",
    section: "Program Mentor",
    description:
      "Program Mentor role: Desert WAVE is an all-women's collegiate underwater robotics team competing in the international RoboSub competition. Mentors with experience in electronics, underwater robotics, acoustic communications, computer vision, artificial intelligence, or programming are sought. The team meets year-round, more frequently January-August, leading up to the RoboSub competition in August.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Desert WAVE",
  },
  {
    title: "Degrees of Freedom (FIRST Robotics Competition) Team",
    section: "Program Mentor",
    description:
      "Program Mentor role: Degrees of Freedom is a high school robotics team competing in the FIRST Robotics Competition (FRC). No robotics experience needed — mentors are sought across electronics/electrical engineering, mechanical engineering, CAD, manufacturing, programming, project management, and more. Main build season is January-April, with key competitions in March and April.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Degrees of Freedom",
  },
  {
    title: "Binary Bots (FIRST Tech Challenge) Team",
    section: "Program Mentor",
    description:
      "Program Mentor role: Binary Bots is a team of 6th-9th grade students competing in the FIRST Tech Challenge (FTC). No robotics experience needed. The team meets year-round, with its main build season September-February.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Binary Bots",
  },
  // ---- Staff Support (18+, background check required) ----
  {
    title: "Video Studio Administrator",
    section: "Staff Support",
    description:
      "Staff Support role: set up the studio for video recording/broadcasting and editing, facilitate the creation of one video broadcast/segment every 1-2 months, train other mentors or students on the equipment, and enable mobile broadcasting/recording at events or competitions.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Video Studio Administrator",
  },
  {
    title: "Human Resources Administrator",
    section: "Staff Support",
    description:
      "Staff Support role: develop and implement HR policies and procedures for a nonprofit, maintain HR records, lead onboarding for new volunteers/mentors/employees, help facilitate performance reviews, and own the Employee, Volunteer/Mentor, and Student handbooks.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Human Resources Administrator",
  },
  {
    title: "Strategy / Marketing",
    section: "Staff Support",
    description:
      "Staff Support role: develop a social media plan, review and recommend improvements to existing STEM programs, create and update marketing materials and branding, and help plan for the STEM Center's future growth and daytime utilization.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Strategy / Marketing",
  },
  {
    title: "Jeep Hack Coordinator",
    section: "Staff Support",
    description:
      "Staff Support role: plan, organize, and coordinate the annual Jeep Hack event and secure materials, working with Magical Motors to match kids in need with a jeep to modify.",
    minimumAge: 18,
    commitmentType: "recurring",
    verifyText: "Jeep Hack Coordinator",
  },
];

// ---------- HTML parsing ----------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exported for lib/ingestion/sources/firewheelStem.test.ts. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Fails loudly rather than silently ingesting a stale hardcoded list —
 * see file header. Checks both the three section anchors (a stable
 * structural signal, since the page has real ids for them) and every
 * individual role's distinctive text. Exported for
 * lib/ingestion/sources/firewheelStem.test.ts.
 */
export function verifyRolesPresent(html: string): void {
  for (const anchor of ["eventvolunteer", "programmentor", "staffsupport"]) {
    if (!html.includes(`id="${anchor}"`)) {
      throw new Error(
        `Expected section anchor "${anchor}" not found — the page layout may have changed.`
      );
    }
  }

  const plainText = stripHtml(html);
  for (const role of ROLES) {
    if (!plainText.includes(role.verifyText)) {
      throw new Error(
        `Expected role "${role.title}" (looking for "${role.verifyText}") not found on the page — the role list may have changed and this fetcher's hardcoded roles need review.`
      );
    }
  }
}

// ---------- main ----------

export type FirewheelStemFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runFirewheelStemFetch(supabase: SupabaseClient): Promise<FirewheelStemFetchResult> {
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
): Promise<FirewheelStemFetchResult> {
  log(`Fetching ${PAGE_URL} ...`);
  const res = await fetch(PAGE_URL, {
    headers: {
      "User-Agent": "ServeFinderBot/1.0 (+manual research script, single run, not scheduled)",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  verifyRolesPresent(html);
  log(`Verified all ${ROLES.length} expected roles are still present on the page.`);

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

  const coords = await geocodeStudentLocation(ORG_ZIP, ORG_LOCATION);
  log(
    coords
      ? `Geocoded ${ORG_ZIP} -> ${coords.lat}, ${coords.lng}`
      : `Couldn't geocode ${ORG_ZIP} — listings will have no coordinates.`
  );

  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const role of ROLES) {
    const externalId = slugify(role.title);
    const description = `${role.description} Apply by filling out Firewheel's volunteer interest form.`;

    const raw: RawListing = {
      title: role.title,
      description,
      location: LISTING_LOCATION,
      external_id: externalId,
      application_url: APPLICATION_FORM_URL,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: PAGE_URL });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;
    // Explicit overrides, not left to normalizeListing()'s regex-based
    // inference over free text — same reasoning as Special Olympics AZ's
    // and BGC's own overrides. Age in particular must not be flattened to
    // one value across the source: the page states 16+ for Event
    // Volunteer roles and 18+ for Program Mentor/Staff Support roles, and
    // extractMinimumAge() would have no way to know which section a given
    // role's description came from even if it caught a number correctly.
    normalized.category = "STEM";
    normalized.minimum_age = role.minimumAge;
    normalized.commitment_type = role.commitmentType;

    const dedup = findDuplicate(
      {
        source: SOURCE,
        external_id: externalId,
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
      embedding = await embed(description);
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
      log(`+ Created: ${role.title} (${role.section}, age ${role.minimumAge}+)`);
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
    listingsFound: ROLES.length,
    listingsInserted: created,
    listingsUpdated: updated,
    listingsSkippedDuplicate: skipped,
  });

  return { parsed: ROLES.length, created, updated, skipped, orgId: org.id, logs };
}
