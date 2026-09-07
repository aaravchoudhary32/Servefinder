// Shared fetch logic for the Virginia Beach SPCA's volunteer program
// pages. Used by both the manual CLI script (scripts/fetch-vbspca.ts)
// and the weekly Vercel cron (app/api/cron/fetch/[source]/route.ts,
// dispatched via lib/ingestion/sourceRegistry.ts) — same split as the
// other three sources in lib/ingestion/sources/.
//
// Structurally different from all three existing sources in two ways:
// it's a Divi-theme WordPress site (accordion "toggle" modules —
// <h5 class="et_pb_toggle_title">Heading</h5><div class="et_pb_toggle_content">
// ...</div> — not paragraph blocks, a <ul><li> list, or <h2>+<p> pairs),
// and it's one opportunity per PAGE rather than several roles on one
// page, so this fetcher hits two URLs instead of parsing one. The
// normalizer still needed zero changes — same proof as the second and
// third sources.
//
// Deliberately excludes VBSPCA's third volunteer category, "Court
// Ordered Community Service" — a legal-mandate pathway, not the kind of
// opportunity this app is meant to surface.
//
// Safe to re-run: each page is matched by a deterministic external_id
// (slug of the program title), so a repeat run updates the same two
// rows instead of duplicating them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing } from "../normalize";
import { fetchExistingListings } from "../fetchExistingListings";
import { geocodeStudentLocation } from "../../geocode";
import { embed } from "../../embeddings/embed";
import { recordIngestionRun } from "../logRun";

const SOURCE = "vbspca";
const ORG_NAME = "Virginia Beach SPCA";
const ORG_DESCRIPTION =
  "Animal shelter and adoption center serving Virginia Beach, VA, running adult and teen (ages 14+) volunteer programs including shelter care, dog walking, and community outreach.";
const ORG_LOCATION = "3040 Holland Rd, Virginia Beach, VA 23453";
const ORG_ZIP = "23453";

const PAGES: { title: string; url: string }[] = [
  { title: "Adult Volunteers", url: "https://vbspca.com/adult-volunteers/" },
  { title: "Junior Volunteers", url: "https://vbspca.com/junior-volunteers/" },
];

// ---------- HTML parsing ----------
//
// Each page is a series of Divi accordion "toggle" modules — a heading
// plus a content div containing a plain <ul><li> list (no nested divs
// in the content itself, which is what makes matching up to the first
// closing </div> after the content div opens safe). There's no shared
// "volunteer roles" section boundary to slice out like the other three
// sources use, because each page IS one role — every toggle section on
// the page describes facets of that same single opportunity (what
// you'll do, requirements, who should apply), so they're all folded
// into one composed description rather than treated as separate roles.

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseToggleSections(html: string): { heading: string; items: string[] }[] {
  const sectionRegex =
    /<h5 class="et_pb_toggle_title">([^<]+)<\/h5>\s*<div class="et_pb_toggle_content clearfix">([\s\S]*?)<\/div>/g;
  const sections: { heading: string; items: string[] }[] = [];
  // Divi (this theme) sometimes renders a duplicate copy of the same
  // toggle module elsewhere in the page — verified directly against the
  // live junior-volunteers page, which has each of its two sections
  // appear twice, ~5KB apart, byte-for-byte identical. Deduping by
  // heading keeps only the first occurrence rather than doubling every
  // description.
  const seenHeadings = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(html)) !== null) {
    const heading = stripHtml(match[1]);
    if (!heading || seenHeadings.has(heading)) continue;
    const items = [...match[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map((m) => stripHtml(m[1]))
      .filter(Boolean);
    if (items.length === 0) continue;
    seenHeadings.add(heading);
    sections.push({ heading, items });
  }
  return sections;
}

function composeDescription(sections: { heading: string; items: string[] }[]): string {
  return sections.map((s) => `${s.heading}: ${s.items.join(", ")}`).join(". ");
}

// ---------- main ----------

export type VbspcaFetchResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export async function runVbspcaFetch(supabase: SupabaseClient): Promise<VbspcaFetchResult> {
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
): Promise<VbspcaFetchResult> {
  type ParsedRole = { title: string; description: string; externalId: string; sourceUrl: string };
  const roles: ParsedRole[] = [];

  for (const page of PAGES) {
    log(`Fetching ${page.url} ...`);
    const res = await fetch(page.url, {
      headers: {
        "User-Agent": "ServeFinderBot/1.0 (+manual research script, single run, not scheduled)",
      },
    });
    if (!res.ok) {
      throw new Error(`Fetch failed for ${page.url}: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    const sections = parseToggleSections(html);
    const description = composeDescription(sections);
    if (!description) {
      log(`Couldn't find any content sections on ${page.url} — the page layout may have changed.`);
      continue;
    }
    roles.push({
      title: page.title,
      description,
      externalId: slugify(page.title),
      sourceUrl: page.url,
    });
  }

  log(`Parsed ${roles.length} volunteer roles across ${PAGES.length} pages.`);
  if (roles.length === 0) {
    log("Nothing to ingest — exiting.");
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

  const coords = await geocodeStudentLocation(ORG_ZIP, ORG_LOCATION);
  log(
    coords
      ? `Geocoded ${ORG_ZIP} -> ${coords.lat}, ${coords.lng}`
      : `Couldn't geocode ${ORG_ZIP} — listings will have no coordinates.`
  );

  // Dedup against every existing opportunity, not just this source — a
  // manually-entered listing could already cover the same role.
  const existing = await fetchExistingListings(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const role of roles) {
    const raw: RawListing = {
      title: role.title,
      description: role.description,
      location: ORG_LOCATION,
      external_id: role.externalId,
    };

    const normalized = normalizeListing(raw, { source: SOURCE, sourceUrl: role.sourceUrl });
    normalized.latitude = coords?.lat ?? null;
    normalized.longitude = coords?.lng ?? null;

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
