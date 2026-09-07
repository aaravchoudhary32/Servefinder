// Seeds the manually curated / non-scraped organization and opportunity
// records defined in lib/manualRecords.ts. Run by hand with
// `npm run seed:manual-records` whenever a record is added or
// re-verified — NOT wired into the weekly cron (vercel.ts), since there's
// no page to fetch and nothing to automatically re-check; re-verifying a
// manual record is a human act, not a scheduled one.
//
// Safe to re-run: each opportunity is matched by
// (source: "manual_curated", external_id: "<org-slug>-<suffix>"), so a
// repeat run updates the same rows instead of duplicating them, same
// dedup convention every automated source uses. Each organization also
// gets last_verified_at bumped to the run time, and one ingestion_runs
// row per organization tagged source: "manual:<org-slug>" — the
// manual-review audit trail, reusing the existing table rather than
// adding a new one (shows up in /admin/ingestion-log automatically,
// same as every automated source and CSV import).
//
// `-- --dry-run` previews every record this run would touch (org
// create/refresh, opportunity create/update/skip) with zero writes —
// added during the nationwide-expansion pass specifically because this
// script, unlike every fetch-*.ts connector script, had no dry-run mode
// at all; per this project's own safety rule ("never assume a script
// supports --dry-run"), one was added and tested before this script was
// ever run for real again.
//
// `-- --only=slug-one,slug-two` restricts the run to specific
// MANUAL_RECORDS[].slug values — added for the same pass, so that
// adding a handful of brand-new organizations doesn't also re-touch
// (bump last_verified_at on) every one of the ~100+ pre-existing
// organizations already in this file. Omit it to run the full file,
// exactly as before this flag existed.

import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { MANUAL_RECORDS } from "../lib/manualRecords";
import { findDuplicate, ExistingListing } from "../lib/ingestion/normalize";
import { geocodeStudentLocation } from "../lib/geocode";
import { embed } from "../lib/embeddings/embed";
import { recordIngestionRun } from "../lib/ingestion/logRun";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE = "manual_curated";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("=== DRY RUN — no database writes will be performed ===\n");

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySlugs = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim())) : null;
if (onlySlugs) console.log(`Restricting this run to slugs: ${[...onlySlugs].join(", ")}\n`);

// geocodeStudentLocation() falls back to Nominatim for any zip-less
// lookup, which is rate-limited to ~1 request/second (see lib/geocode.ts)
// — a real problem here since several records share the same city
// (e.g. two SARSEF roles and 4-H all resolve to "Tucson, AZ" with no
// zip) and this script calls geocode in a tight loop across records.
// Caching by the exact (zip, city) pair, plus a small delay before each
// real network call, avoids hammering Nominatim and getting throttled.
const geocodeCache = new Map<string, Awaited<ReturnType<typeof geocodeStudentLocation>>>();
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function geocodeCached(zip: string | null, city: string | null) {
  const key = `${zip ?? ""}|${city ?? ""}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  await sleep(1100);
  const coords = await geocodeStudentLocation(zip, city);
  geocodeCache.set(key, coords);
  return coords;
}

async function main() {
  const nowIso = new Date().toISOString();

  const { data: existingRows } = await supabase
    .from("opportunities")
    .select(
      "id, source, external_id, title, organizations(name), application_url, application_deadline, location, minimum_age, source_url"
    );
  const existing: ExistingListing[] = (existingRows ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    source: row.source as string,
    external_id: row.external_id as string | null,
    title: row.title as string,
    organizationName: (row.organizations as { name: string } | null)?.name ?? null,
    applicationUrl: row.application_url as string | null,
    applicationDeadline: row.application_deadline as string | null,
    location: row.location as string | null,
    minimumAge: row.minimum_age as number | null,
    sourceUrl: row.source_url as string | null,
  }));

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const record of MANUAL_RECORDS) {
    if (onlySlugs && !onlySlugs.has(record.slug)) continue;
    console.log(`\n=== ${record.name} (${record.slug}) ===`);

    let { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("name", record.name)
      .maybeSingle();

    if (dryRun) {
      console.log(org ? `  Would refresh existing organization (${org.id}).` : "  Would create new organization.");
      for (const opp of record.opportunities) {
        const externalId = `${record.slug}-${opp.externalIdSuffix}`;
        const alreadyExists = existing.some((e) => e.source === SOURCE && e.external_id === externalId);
        console.log(
          alreadyExists
            ? `  ~ Would update: ${opp.title} (external_id ${externalId} already exists)`
            : `  + Would create (pending review): ${opp.title} (min age ${opp.minimumAge}, ${opp.availabilityStatus})`
        );
      }
      continue;
    }

    if (!org) {
      const { data: newOrg, error } = await supabase
        .from("organizations")
        .insert({
          name: record.name,
          description: record.description,
          website_url: record.websiteUrl,
          city: record.city,
          contact_email: record.contactEmail,
          last_verified_at: nowIso,
          // organizations.verified gates public read access to its
          // opportunities (see supabase/schema.sql's RLS policy) — every
          // new org otherwise defaults to false, same as a fresh org
          // self-signup or a first ingestion run, which would leave
          // these opportunities invisible to real students until someone
          // manually flipped this in /admin. A manual record only ever
          // exists because a human already researched and verified it
          // against a live, first-party source (see
          // lib/manualRecords.ts) — that research *is* the verification,
          // so it's set true here rather than requiring a redundant
          // manual approval step for every record added this way.
          verified: true,
        })
        .select("id, name")
        .single();
      if (error || !newOrg) {
        console.error(`FAILED to create organization "${record.name}": ${error?.message}`);
        continue;
      }
      org = newOrg;
      console.log(`Created organization (${org.id}).`);
    } else {
      const { error } = await supabase
        .from("organizations")
        .update({
          description: record.description,
          website_url: record.websiteUrl,
          city: record.city,
          contact_email: record.contactEmail,
          last_verified_at: nowIso,
        })
        .eq("id", org.id);
      if (error) console.error(`FAILED to update organization "${record.name}": ${error.message}`);
      else console.log(`Found existing organization (${org.id}), refreshed.`);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const opp of record.opportunities) {
      const externalId = `${record.slug}-${opp.externalIdSuffix}`;

      let latitude: number | null = null;
      let longitude: number | null = null;
      if (opp.zip || opp.geocodeCity) {
        const coords = await geocodeCached(opp.zip, opp.geocodeCity);
        latitude = coords?.lat ?? null;
        longitude = coords?.lng ?? null;
        console.log(
          coords
            ? `  Geocoded "${opp.title}" -> ${coords.lat}, ${coords.lng}`
            : `  Couldn't geocode "${opp.title}" — no coordinates.`
        );
      } else {
        console.log(`  "${opp.title}": deliberately not geocoded (no real address published).`);
      }

      const payload = {
        title: opp.title,
        description: opp.description,
        category: opp.category,
        minimum_age: opp.minimumAge,
        location: opp.location,
        latitude,
        longitude,
        schedule_slots: [],
        skills_required: [],
        interests_tags: opp.interestsTags,
        commitment_type: opp.commitmentType,
        application_url: opp.applicationUrl,
        application_deadline: opp.applicationDeadline,
        availability_status: opp.availabilityStatus,
        source: SOURCE,
        source_url: record.websiteUrl,
        external_id: externalId,
        last_verified_at: nowIso,
        organization_id: org.id,
        is_stale: false,
        // Biomedical-batch fields — all optional in ManualOpportunity, so
        // undefined (not present on the STEM batch's older records)
        // becomes null here, same "not specified" meaning either way.
        availability_note: opp.availabilityNote ?? null,
        program_type: opp.programType ?? null,
        compensation: opp.compensation ?? "not_specified",
        cost: opp.cost ?? null,
        financial_aid_available: opp.financialAidAvailable ?? null,
        eligible_grades: opp.eligibleGrades ?? null,
        arizona_residency_required: opp.arizonaResidencyRequired ?? null,
        parental_consent_required: opp.parentalConsentRequired ?? null,
        health_screening_required: opp.healthScreeningRequired ?? null,
        background_check_required: opp.backgroundCheckRequired ?? null,
        direct_patient_contact: opp.directPatientContact ?? null,
        research_component: opp.researchComponent ?? null,
        shadowing_component: opp.shadowingComponent ?? null,
        application_open_date: opp.applicationOpenDate ?? null,
        time_commitment: opp.timeCommitment ?? null,
        program_focus_tags: opp.programFocusTags ?? [],
        delivery_mode: opp.deliveryMode ?? "in_person",
      };

      const dedup = findDuplicate(
        {
          source: SOURCE,
          external_id: externalId,
          title: opp.title,
          organizationName: record.name,
          applicationUrl: opp.applicationUrl,
          applicationDeadline: opp.applicationDeadline,
          location: opp.location,
          minimumAge: opp.minimumAge,
          sourceUrl: record.websiteUrl,
        },
        existing
      );

      let embedding: number[] | null = null;
      try {
        embedding = await embed(opp.description);
      } catch (err) {
        console.log(`  Couldn't embed "${opp.title}" — semantic matching will skip it for now: ${err}`);
      }

      const fullPayload = { ...payload, embedding };

      if (!dedup) {
        // review_status only set on insert, never on the update branch
        // below — a re-run of this script must never flip an
        // already-approved record's status back to pending.
        const { error } = await supabase
          .from("opportunities")
          .insert({ ...fullPayload, review_status: opp.reviewStatus ?? "approved" });
        if (error) {
          console.error(`  FAILED to insert "${opp.title}": ${error.message}`);
          continue;
        }
        console.log(`  + Created: ${opp.title} (${opp.availabilityStatus})`);
        created++;
      } else if (dedup.reason === "external_id") {
        const { error } = await supabase.from("opportunities").update(fullPayload).eq("id", dedup.existingId);
        if (error) {
          console.error(`  FAILED to update "${opp.title}": ${error.message}`);
          continue;
        }
        console.log(`  ~ Updated: ${opp.title} (already ingested, refreshed)`);
        updated++;
      } else {
        console.log(
          `  - Skipped "${opp.title}" — looks like a duplicate of existing opportunity ${dedup.existingId} (similarity ${dedup.similarity.toFixed(2)})`
        );
        skipped++;
      }
    }

    if (record.opportunities.length === 0) {
      console.log("  (Directory-only record — no opportunities.)");
    }

    await recordIngestionRun(supabase, {
      source: `manual:${record.slug}`,
      status: "success",
      listingsFound: record.opportunities.length,
      listingsInserted: created,
      listingsUpdated: updated,
      listingsSkippedDuplicate: skipped,
    });

    totalCreated += created;
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log(
    `\nDone. ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped as likely duplicates, across ${MANUAL_RECORDS.length} organizations.`
  );
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
