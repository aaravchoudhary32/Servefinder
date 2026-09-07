// Manual-curation seed for 4 sources verified live via parallel research
// forks during the 90-source-expansion Phase 2, batch 1 (50 candidates
// investigated across animals/environment, human-services/civic, AZ
// municipalities, national-virtual, and STEM/coding clusters — these 4
// were the ones that cleared the full usable-source bar: real org,
// verified URL, >=1 distinct actionable role, published age evidence
// for someone 13-18, real application pathway).
//
// Every row lands as review_status "pending". Idempotent — safe to re-run.
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
  orgCity: string | null;
  title: string;
  description: string;
  category: string;
  minimumAge: number;
  location: string | null;
  deliveryMode: "in_person" | "virtual" | "hybrid";
  applicationUrl: string | null;
  sourceUrl: string;
  externalId: string;
  availabilityStatus: "open" | "seasonal" | "unverified" | "closed";
};

const candidates: Candidate[] = [
  {
    source: "habitat_humanity_central_az",
    orgName: "Habitat for Humanity Central Arizona",
    orgDescription: "Phoenix-area affiliate of Habitat for Humanity, building and repairing homes for families in need and operating ReStore resale locations.",
    orgWebsite: "https://www.habitatcaz.org/volunteer/", orgCity: "Phoenix, AZ",
    title: "ReStore Volunteer", category: "Community Service", minimumAge: 15, location: "Phoenix, AZ", deliveryMode: "in_person",
    description: "Assist with customer service, product testing, organizing donations, and item salvaging at a Habitat for Humanity Central Arizona ReStore location. Confirmed by the organization: minimum age 15 for ReStore roles (construction-site roles require 16+; minors are barred from power tools, ladders, and roofs regardless of age).",
    applicationUrl: "https://habitatcaz.volunteerhub.com/userregistrationwizard/usernamepassword", sourceUrl: "https://www.habitatcaz.org/volunteer/",
    externalId: "habitat-caz-restore-volunteer", availabilityStatus: "unverified",
  },
  {
    source: "crisis_text_line",
    orgName: "Crisis Text Line",
    orgDescription: "National nonprofit providing free, 24/7 text-based crisis support, staffed entirely by trained volunteer Crisis Counselors.",
    orgWebsite: "https://www.crisistextline.org/become-a-volunteer/", orgCity: null,
    title: "Crisis Counselor", category: "Community Service", minimumAge: 18, location: null, deliveryMode: "virtual",
    description: "Complete Crisis Text Line's free 30-hour training and volunteer as a Crisis Counselor, supporting people in crisis over text from anywhere with an internet connection. Confirmed by the organization: 'Accepted applicants must be at least 18 years old.' Real application and training pathway via the organization's own site.",
    applicationUrl: "https://www.crisistextline.org/become-a-volunteer/", sourceUrl: "https://www.crisistextline.org/become-a-volunteer/",
    externalId: "crisis-text-line-crisis-counselor", availabilityStatus: "unverified",
  },
  {
    source: "lost_our_home_pet_rescue",
    orgName: "Lost Our Home Pet Rescue",
    orgDescription: "Phoenix-area pet rescue and shelter, running a family-friendly Youth Volunteer program for younger animal lovers.",
    orgWebsite: "https://www.lostourhome.org/", orgCity: "Phoenix, AZ",
    title: "Youth Volunteer (Family Track)", category: "Animals", minimumAge: 13, location: "Phoenix, AZ", deliveryMode: "in_person",
    description: "Socialize shelter cats or dogs, help collect donations, and assist around the shelter. Confirmed by the organization: 'kids ages 7 to 15, who are accompanied by their parent, can volunteer with our dogs and cats.' A parent/guardian must accompany the volunteer at all times.",
    applicationUrl: "https://www.volgistics.com/ex/portal.dll/ap?ap=1039853442", sourceUrl: "https://www.lostourhome.org/",
    externalId: "lost-our-home-youth-volunteer", availabilityStatus: "unverified",
  },
  {
    source: "phoenix_zoo_zooteens",
    orgName: "Phoenix Zoo",
    orgDescription: "Phoenix's zoological park, running the ZooTeens program for high-school-age volunteers in guest engagement and animal-interaction support.",
    orgWebsite: "https://www.phoenixzoo.org/zooteens-application/", orgCity: "Phoenix, AZ",
    title: "ZooTeens Volunteer", category: "Animals", minimumAge: 14, location: "455 N Galvin Pkwy, Phoenix, AZ 85008", deliveryMode: "in_person",
    description: "Engage and educate zoo guests and support animal interactions at the Phoenix Zoo's farm facilities as part of the ZooTeens program. Confirmed by the organization: applicants must be 'entering grades 9-12' for the upcoming school year. Seasonal program — the 2026-27 cohort's own application cycle was confirmed closed at last check, with a real interest-list pathway open for the next cycle.",
    applicationUrl: "https://www.phoenixzoo.org/zooteens-application/", sourceUrl: "https://www.phoenixzoo.org/zooteens-application/",
    externalId: "phoenix-zoo-zooteens", availabilityStatus: "seasonal",
  },
];

async function main() {
  for (const item of candidates) {
    console.log(`\n=== ${item.source} ===`);
    let { data: org } = await admin.from("organizations").select("id, name").eq("name", item.orgName).maybeSingle();
    if (!org) {
      const { data: newOrg, error } = await admin
        .from("organizations")
        .insert({ name: item.orgName, description: item.orgDescription, website_url: item.orgWebsite, city: item.orgCity })
        .select("id, name")
        .single();
      if (error || !newOrg) throw new Error(`Couldn't create organization: ${error?.message}`);
      org = newOrg;
      console.log(`Created organization "${item.orgName}" (${org.id}).`);
    } else {
      console.log(`Found existing organization "${item.orgName}" (${org.id}).`);
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

    if (item.location) {
      const zipMatch = item.location.match(/\b(\d{5})\b/);
      const cityMatch = !zipMatch ? item.location.match(/^([A-Za-z .]+),\s*AZ/) : null;
      if (zipMatch) {
        const coords = await geocodeStudentLocation(zipMatch[1], null);
        normalized.latitude = coords?.lat ?? null;
        normalized.longitude = coords?.lng ?? null;
        console.log(coords ? `  Geocoded ${zipMatch[1]} -> ${coords.lat}, ${coords.lng}` : `  Couldn't geocode ${zipMatch[1]}.`);
      } else if (cityMatch) {
        const coords = await geocodeStudentLocation(null, `${cityMatch[1]}, AZ`);
        normalized.latitude = coords?.lat ?? null;
        normalized.longitude = coords?.lng ?? null;
        console.log(coords ? `  Geocoded ${cityMatch[1]} -> ${coords.lat}, ${coords.lng}` : `  Couldn't geocode ${cityMatch[1]}.`);
      }
    }

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
      availability_status: item.availabilityStatus,
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;

    if (!dedup) {
      const { error } = await admin.from("opportunities").insert({ ...payload, review_status: "pending" });
      if (error) {
        console.log(`FAILED to insert "${item.title}": ${error.message}`);
      } else {
        console.log(`+ Staged (pending review): ${item.title} (min age ${item.minimumAge})`);
        created++;
      }
    } else if (dedup.reason === "external_id") {
      const { error } = await admin.from("opportunities").update(payload).eq("id", dedup.existingId);
      if (error) {
        console.log(`FAILED to update "${item.title}": ${error.message}`);
      } else {
        console.log(`~ Updated: ${item.title} (already ingested, refreshed)`);
        updated++;
      }
    } else {
      console.log(`- Skipped "${item.title}" — duplicate of existing ${dedup.existingId} (${dedup.reason})`);
      skipped++;
    }

    await recordIngestionRun(admin, {
      source: item.source,
      status: "success",
      listingsFound: 1,
      listingsInserted: created,
      listingsUpdated: updated,
      listingsSkippedDuplicate: skipped,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
