// One-time manual-curation seed for 3 registry sources marked
// "manual_only" (no scrapable per-listing structure, but real,
// individually verified, live-first-party-checked programs):
// RMHC of Central/Northern Arizona (7 roles — only "Individual House
// Volunteer" has a confirmed numeric minimum age, 16; the other 6 have
// no stated age and are flagged as such in their own description rather
// than guessed), NASA GLOBE Observer (1, virtual/app-based citizen
// science), and Schoolhouse.world (1, virtual peer tutoring — "high
// school students just like you", no exact numeric age published).
//
// Every row lands as review_status "pending", same staging gate every
// automated/bulk-imported source uses — see
// supabase/add_ingestion_source_registry_and_staging.sql. Re-running
// this script is idempotent (external_id-based dedup, same as every
// connector in lib/ingestion/sources/).
import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeListing, findDuplicate, RawListing, ExistingListing } from "../lib/ingestion/normalize";
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

const NO_AGE_STATED_NOTE =
  "This specific role's age requirement is not stated by the organization (their published 16+ minimum applies specifically to their 'Individual House Volunteers' role, not this one) — confirm current eligibility directly with the organization before applying.";

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
  latitude: number | null;
  longitude: number | null;
  deliveryMode: "in_person" | "virtual" | "hybrid";
  applicationUrl: string | null;
  sourceUrl: string;
  externalId: string;
};

const RMHC_ORG = {
  orgName: "Ronald McDonald House Charities of Central and Northern Arizona",
  orgDescription:
    "Nonprofit providing a home-away-from-home for families of seriously ill or injured children receiving medical treatment in the Phoenix area, relying on volunteers for meals, house operations, events, and off-site kit assembly.",
  orgWebsite: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
  orgCity: "Phoenix, AZ",
};

const candidates: Candidate[] = [
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Dinnertime Heroes & Brunch Buddies",
    description:
      "Prepare a home-cooked meal at one of three Valley Ronald McDonald House locations to support guest families after their children's medical appointments. Contact: Jen Donnelly, jdonnelly@ronaldmcdonaldhousecnaz.org. " +
      NO_AGE_STATED_NOTE,
    category: "Community Service",
    minimumAge: 13,
    location: "Phoenix, AZ",
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/meals/",
    externalId: "rmhc-cnaz-dinnertime-heroes",
  },
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Baked With Love",
    description:
      "Bring your own casserole recipe and ingredients to prepare on-site at a Ronald McDonald House, providing a nourishing meal for families. Contact: jdonnelly@ronaldmcdonaldhousecnaz.org. " + NO_AGE_STATED_NOTE,
    category: "Community Service",
    minimumAge: 13,
    location: "Phoenix, AZ",
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
    externalId: "rmhc-cnaz-baked-with-love",
  },
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Individual House Volunteer",
    description:
      "Assist with day-to-day house operations: answering phones, greeting families at check-in, gardening, sorting, organizing, and clerical tasks. Contact: Jen Donnelly, jdonnelly@ronaldmcdonaldhousecnaz.org. Confirmed by the organization: individuals must be at least 16 years old to become a House Volunteer.",
    category: "Community Service",
    minimumAge: 16,
    location: "Phoenix, AZ",
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
    externalId: "rmhc-cnaz-individual-house-volunteer",
  },
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Event Volunteer",
    description:
      "Support signature fundraising events like the Heart of the House Gala with setup, raffle sales, and other event-day tasks. Contact: jdonnelly@ronaldmcdonaldhousecnaz.org. " + NO_AGE_STATED_NOTE,
    category: "Community Service",
    minimumAge: 13,
    location: "Phoenix, AZ",
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
    externalId: "rmhc-cnaz-event-volunteer",
  },
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Seasonal Decor Volunteer",
    description:
      "Decorate common spaces, windows, and doors at a Ronald McDonald House for different holidays and seasons. Contact: jdonnelly@ronaldmcdonaldhousecnaz.org. " + NO_AGE_STATED_NOTE,
    category: "Community Service",
    minimumAge: 13,
    location: "Phoenix, AZ",
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
    externalId: "rmhc-cnaz-seasonal-decor",
  },
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Sweet Treat Baker",
    description:
      "Bake a favorite family recipe in the fully-equipped kitchens at a Ronald McDonald House for families staying there. Contact: jdonnelly@ronaldmcdonaldhousecnaz.org. " + NO_AGE_STATED_NOTE,
    category: "Community Service",
    minimumAge: 13,
    location: "Phoenix, AZ",
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
    externalId: "rmhc-cnaz-sweet-treat-baker",
  },
  {
    source: "rmhc_central_northern_az",
    ...RMHC_ORG,
    title: "Off-Site Kit Creator",
    description:
      "Assemble hygiene kits, birthday kits, snack kits, welcome bags, busy bags, or newborn kits for Ronald McDonald House families — done off-site, a good fit for group/team projects. Contact: jdonnelly@ronaldmcdonaldhousecnaz.org. " +
      NO_AGE_STATED_NOTE,
    category: "Community Service",
    minimumAge: 13,
    location: null,
    latitude: null,
    longitude: null,
    deliveryMode: "in_person",
    applicationUrl: null,
    sourceUrl: "https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/",
    externalId: "rmhc-cnaz-off-site-kit-creator",
  },
  {
    source: "nasa_globe_observer",
    orgName: "NASA GLOBE Observer",
    orgDescription:
      "NASA citizen-science program (Global Learning and Observations to Benefit the Environment) — volunteers use a free mobile app to record real-world environmental observations (clouds, mosquito habitats, land cover, trees) that support NASA Earth-science research.",
    orgWebsite: "https://observer.globe.gov/",
    orgCity: null,
    title: "GLOBE Observer Citizen Science Volunteer",
    description:
      "Download the free GLOBE Observer app and record environmental observations from wherever you are — cloud cover, mosquito habitat mapping, land cover classification, or tree measurements — contributing real data to NASA Earth-science research. Requires a smartphone and going outdoors to make observations; not a scheduled shift at a fixed location. No minimum age is stated by NASA for this program.",
    category: "Environment",
    minimumAge: 13,
    location: null,
    latitude: null,
    longitude: null,
    deliveryMode: "virtual",
    applicationUrl: "https://observer.globe.gov/get-the-app",
    sourceUrl: "https://observer.globe.gov/",
    externalId: "nasa-globe-observer-citizen-science",
  },
  {
    source: "schoolhouse_world",
    orgName: "Schoolhouse.world",
    orgDescription:
      "Free, nonprofit peer-tutoring platform (founded by Sal Khan) where trained volunteer tutors lead live Zoom sessions in math, SAT prep, and other high-school subjects.",
    orgWebsite: "https://schoolhouse.world/",
    orgCity: null,
    title: "Peer Tutor",
    description:
      "Get certified in a subject, complete training, and host live Zoom tutoring sessions for students worldwide in high-school math, SAT prep, and more. The organization states tutors are 'high school students just like you' — no exact numeric minimum age is published, so this reflects high-school-age eligibility by the program's own description, not a confirmed specific number. Tutoring builds a verified Schoolhouse portfolio and counts toward volunteer hours.",
    category: "Education",
    minimumAge: 13,
    location: null,
    latitude: null,
    longitude: null,
    deliveryMode: "virtual",
    applicationUrl: "https://schoolhouse.world/tutors",
    sourceUrl: "https://schoolhouse.world/tutors",
    externalId: "schoolhouse-world-peer-tutor",
  },
];

async function main() {
  const bySource = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!bySource.has(c.source)) bySource.set(c.source, []);
    bySource.get(c.source)!.push(c);
  }

  for (const [source, items] of bySource) {
    console.log(`\n=== ${source} ===`);
    let { data: org } = await admin.from("organizations").select("id, name").eq("name", items[0].orgName).maybeSingle();
    if (!org) {
      const { data: newOrg, error } = await admin
        .from("organizations")
        .insert({ name: items[0].orgName, description: items[0].orgDescription, website_url: items[0].orgWebsite, city: items[0].orgCity })
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
    let skipped = 0;

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
      normalized.latitude = item.latitude;
      normalized.longitude = item.longitude;

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
        availability_status: "unverified",
      };

      if (!dedup) {
        const { error } = await admin.from("opportunities").insert({ ...payload, review_status: "pending" });
        if (error) {
          console.log(`FAILED to insert "${item.title}": ${error.message}`);
          continue;
        }
        console.log(`+ Staged (pending review): ${item.title}`);
        created++;
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
      listingsUpdated: 0,
      listingsSkippedDuplicate: skipped,
    });
    console.log(`${source}: ${created} created, ${skipped} skipped as duplicates.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
