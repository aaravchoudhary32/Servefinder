// Manual-curation seed, batch 3 of nationwide sources individually
// verified live this session (more VSys One hospital campuses). Every
// field was confirmed against a live, first-party page during this
// session. Every row lands as review_status "pending". Idempotent.
import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing, ExistingListing } from "../lib/ingestion/normalize";
import { geocodeStudentLocation } from "../lib/geocode";
import { embed } from "../lib/embeddings/embed";
import { recordIngestionRun } from "../lib/ingestion/logRun";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
loadEnvLocal();

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Candidate = {
  source: string;
  orgName: string;
  orgDescription: string;
  orgWebsite: string;
  orgCity: string;
  title: string;
  description: string;
  category: string;
  minimumAge: number;
  location: string;
  deliveryMode: "in_person" | "virtual" | "hybrid";
  applicationUrl: string;
  sourceUrl: string;
  externalId: string;
  availabilityStatus?: "open" | "seasonal" | "unverified" | "closed" | "paused" | "waitlisted";
  availabilityNote?: string;
};

// Zip is given explicitly (not extracted from `location`) to avoid the
// street-number-mistaken-for-zip bug found and fixed in batch 2 (Trinity
// Health Livonia's "36475 Five Mile Rd" false-matched as a zip).
type CandidateWithZip = Candidate & { zip: string };

const candidates: CandidateWithZip[] = [
  {
    source: "cleveland_clinic_main_campus",
    orgName: "Cleveland Clinic (Main Campus)",
    orgDescription: "Cleveland Clinic's main hospital campus in Cleveland, Ohio, running a year-round teen volunteer program through the system's VSys One volunteer portal. Distinct from Cleveland Clinic Avon Hospital, already a separate ServeFinder listing.",
    orgWebsite: "https://my.clevelandclinic.org", orgCity: "Cleveland, OH",
    title: "Volunteer Program", category: "Healthcare", minimumAge: 15, location: "9500 Euclid Ave, Cleveland, OH 44195", zip: "44195", deliveryMode: "in_person",
    description: "Support hospital operations at Cleveland Clinic's main campus as a teen volunteer. Confirmed directly via the health system's own VSys One application: 'Teenagers 15 and over are eligible to volunteer year-round.' (Some other Cleveland Clinic locations set a higher age floor — e.g. Euclid Hospital requires 18+ — so this record is scoped to the main campus only, where the 15+ policy applies.) Summer volunteering has a May 15 application deadline.",
    applicationUrl: "https://clevelandclinic.vsyslive.com/pages/app/VOLAPP", sourceUrl: "https://clevelandclinic.vsyslive.com/pages/app/VOLAPP",
    externalId: "cleveland-clinic-main-campus-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "endeavor_health_skokie",
    orgName: "Endeavor Health Skokie Hospital",
    orgDescription: "An Endeavor Health hospital campus in Skokie, Illinois, running a teen volunteer program (year-round and a separate summer-only track).",
    orgWebsite: "https://www.endeavorhealth.org/give/volunteer", orgCity: "Skokie, IL",
    title: "Teen Volunteer Program", category: "Healthcare", minimumAge: 16, location: "9600 Gross Point Rd, Skokie, IL 60076", zip: "60076", deliveryMode: "in_person",
    description: "Support hospital operations at Endeavor Health Skokie Hospital as a teen volunteer. Confirmed directly via the organization's own volunteer page: minimum age 16, requiring a 100-hour commitment (4 hours/week) and hospital orientation. A separate Summer Program track (mid-May/early June through mid-to-late August, roughly 8-10 weeks) is also offered, with applications due by May 1.",
    applicationUrl: "https://www.endeavorhealth.org/give/volunteer", sourceUrl: "https://www.endeavorhealth.org/give/volunteer",
    externalId: "endeavor-health-skokie-teen-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "trinity_health_ann_arbor_livingston",
    orgName: "Trinity Health Ann Arbor and Livingston",
    orgDescription: "A Trinity Health hospital system serving Ann Arbor and Livingston County, Michigan, running a Teen Program for high school volunteers.",
    orgWebsite: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/ann-arbor-and-livingston", orgCity: "Ann Arbor, MI",
    title: "Teen Program", category: "Healthcare", minimumAge: 16, location: "5301 E Huron River Dr, Ann Arbor, MI 48106", zip: "48106", deliveryMode: "in_person",
    description: "Enhance patient experience and gain healthcare-setting exposure through Trinity Health Ann Arbor and Livingston's Teen Program. Confirmed directly via the organization's own volunteer page: the program is 'for 16-18-year-old high school students,' developing professional and compassionate skills while supporting patient care areas.",
    applicationUrl: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/ann-arbor-and-livingston/application-requirements", sourceUrl: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/ann-arbor-and-livingston",
    externalId: "trinity-health-ann-arbor-livingston-teen-program",
    availabilityStatus: "open",
  },
  {
    source: "trinity_health_chelsea",
    orgName: "Trinity Health Chelsea Hospital",
    orgDescription: "A Trinity Health hospital campus in Chelsea, Michigan, running a seasonal Summer Teen volunteer program.",
    orgWebsite: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/chelsea", orgCity: "Chelsea, MI",
    title: "Summer Teen Program", category: "Healthcare", minimumAge: 16, location: "775 S Main St, Chelsea, MI 48118", zip: "48118", deliveryMode: "in_person",
    description: "Volunteer at Trinity Health Chelsea Hospital as part of its Summer Teen program. Confirmed directly via the organization's own volunteer page: open to 'teens ages 16-18 attending high school,' requiring a commitment of one day a week for 4 hours, for a minimum of eight consecutive weeks over the summer.",
    applicationUrl: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/chelsea", sourceUrl: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/chelsea",
    externalId: "trinity-health-chelsea-summer-teen",
    availabilityStatus: "seasonal",
    availabilityNote: "Summer-only program (8 consecutive weeks over the summer); check the org's site for the current cycle's application window.",
  },
];

async function main() {
  const bySource = new Map<string, CandidateWithZip[]>();
  for (const c of candidates) {
    const key = `${c.source}::${c.orgName}`;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(c);
  }

  for (const [key, items] of bySource) {
    const source = items[0].source;
    console.log(`\n=== ${key} ===`);
    let { data: org } = await admin.from("organizations").select("id, name").eq("name", items[0].orgName).maybeSingle();
    if (!org) {
      const { data: newOrg, error } = await admin
        .from("organizations")
        .insert({
          name: items[0].orgName,
          description: items[0].orgDescription,
          website_url: items[0].orgWebsite,
          city: items[0].orgCity,
          verified: true,
        })
        .select("id, name")
        .single();
      if (error || !newOrg) throw new Error(`Couldn't create organization: ${error?.message}`);
      org = newOrg;
      console.log(`Created organization "${items[0].orgName}" (${org.id}).`);
    } else {
      console.log(`Found existing organization "${items[0].orgName}" (${org.id}).`);
    }

    const { data: existingRows } = await admin
      .from("opportunities")
      .select("id, source, external_id, title, application_url, application_deadline, location, minimum_age, source_url, organizations(name)");
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

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

    for (const item of items) {
      const raw: RawListing = {
        title: item.title,
        description: item.description,
        location: item.location,
        external_id: item.externalId,
        application_url: item.applicationUrl,
      };
      const normalized = normalizeListing(raw, { source: item.source, sourceUrl: item.sourceUrl });
      normalized.category = item.category;
      normalized.minimum_age = item.minimumAge;

      if (!geocodeCache.has(item.zip)) {
        const coords = await geocodeStudentLocation(item.zip, null);
        geocodeCache.set(item.zip, coords);
        console.log(coords ? `  Geocoded ${item.zip} -> ${coords.lat}, ${coords.lng}` : `  Couldn't geocode ${item.zip}.`);
      }
      const coords = geocodeCache.get(item.zip) ?? null;
      normalized.latitude = coords?.lat ?? null;
      normalized.longitude = coords?.lng ?? null;

      const dedup = findDuplicate(
        {
          source: item.source,
          external_id: item.externalId,
          title: item.title,
          organizationName: item.orgName,
          applicationUrl: normalized.application_url,
          applicationDeadline: normalized.application_deadline,
          location: normalized.location,
          minimumAge: normalized.minimum_age,
          sourceUrl: item.sourceUrl,
        },
        existing
      );

      let embedding: number[] | null = null;
      try {
        embedding = await embed(item.description);
      } catch (err) {
        console.log(`Couldn't embed "${item.title}": ${err}`);
      }

      const payload = {
        ...normalized,
        delivery_mode: item.deliveryMode,
        organization_id: org.id,
        is_stale: false,
        embedding,
        availability_status: item.availabilityStatus ?? "unverified",
        availability_note: item.availabilityNote ?? null,
      };

      if (!dedup) {
        const { error } = await admin.from("opportunities").insert({ ...payload, review_status: "pending" });
        if (error) {
          console.log(`FAILED to insert "${item.title}": ${error.message}`);
          continue;
        }
        console.log(`+ Staged (pending review): ${item.title} (min age ${item.minimumAge})`);
        created++;
      } else if (dedup.reason === "external_id") {
        const { error } = await admin.from("opportunities").update(payload).eq("id", dedup.existingId);
        if (error) {
          console.log(`FAILED to update "${item.title}": ${error.message}`);
          continue;
        }
        console.log(`~ Updated: ${item.title} (already ingested, refreshed)`);
        updated++;
      } else {
        console.log(`- Skipped "${item.title}" — duplicate of existing ${dedup.existingId} (${dedup.reason})`);
        skipped++;
      }
    }

    await recordIngestionRun(admin, {
      source,
      status: "success",
      listingsFound: items.length,
      listingsInserted: created,
      listingsUpdated: updated,
      listingsSkippedDuplicate: skipped,
    });
    console.log(`${source}: ${created} created, ${updated} updated, ${skipped} skipped as duplicates.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
