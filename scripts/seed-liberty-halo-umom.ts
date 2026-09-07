// Manual-curation seed for 3 sources personally re-verified live this
// run, each found to have unstructured/no-repeating-markup pages (no
// per-role heading tags, no per-role application URLs) that don't
// justify a fragile dedicated scraper — see this repo's connector
// strategy guidance ("do not force incompatible sources into an unsafe
// generic parser; use a dedicated connector only when yield justifies
// it"). UMOM/VOMO is the one exception with real per-opportunity URLs,
// but only 3 total listings for this one org — still below the bar for
// its own dedicated connector.
//
// Real, important correction found during live re-verification: Liberty
// Wildlife's own "Youth Programs" page states its general volunteer
// roles require 18+ ("Please do not use this application for anyone
// under 18 — instead fill out the online form on our Youth Programs
// page"), with exactly ONE exception (Orphan Care, 16+ seasonal) and one
// separate teen-only program (Teen Guide, 13-17). The earlier Stage 2
// research fork's "11 confirmed teen-accessible roles" estimate was
// inaccurate — it counted the general adult role list without parsing
// this explicit age-gating text. All 9 real Liberty Wildlife roles are
// staged here with their ACTUAL confirmed age per role (2 are under-18
// accessible; 7 require 18, which ServeFinder still serves since student
// profiles run ages 13-19) — never blanket-labeled teen-eligible.
//
// Every row lands as review_status "pending". Idempotent (external_id
// dedup) — safe to re-run.
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
  applicationDeadline?: string | null;
};

const LW_ORG = {
  orgName: "Liberty Wildlife",
  orgDescription:
    "Phoenix-area wildlife rehabilitation and education nonprofit caring for injured, ill, and orphaned native wildlife, relying on volunteers for daily animal care, education, hotline response, and a dedicated Teen Volunteer Program.",
  orgWebsite: "https://libertywildlife.org/support/volunteer/",
  orgCity: "Phoenix, AZ",
};
const LW_LOCATION = "2600 E Elwood St, Phoenix, AZ 85040";

const HALO_ORG = {
  orgName: "HALO Rescue",
  orgDescription: "Phoenix-area animal rescue caring for cats and dogs, relying on volunteers for shelter care, adoption events, fostering, and thrift-store support.",
  orgWebsite: "https://halorescue.org/volunteer/",
  orgCity: "Phoenix, AZ",
};
const HALO_LOCATION = "3227 E Bell Rd Ste D151, Phoenix, AZ 85032";

const UMOM_ORG = {
  orgName: "UMOM New Day Centers",
  orgDescription: "Phoenix's largest homeless services provider, offering emergency shelter, transitional and permanent housing, and family support services for people experiencing homelessness.",
  orgWebsite: "https://umom.vomo.org/org/umom",
  orgCity: "Phoenix, AZ",
};
const UMOM_LOCATION = "3333 E Van Buren St, Phoenix, AZ 85008";

const candidates: Candidate[] = [
  // ---- Liberty Wildlife: 2 genuinely under-18 roles ----
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Teen Guide", category: "Animals", minimumAge: 13, location: LW_LOCATION, deliveryMode: "in_person",
    description:
      "Teens volunteer during Liberty Wildlife's Open Hours (every other Saturday or Sunday) alongside other teen volunteers and a teen leader: setting up/breaking down education \"booths,\" presenting educational information to the public, and developing public speaking skills. Commitment runs end of September through end of April; a final project (fall semester presentation, spring semester public event support) is required. Cost: $250 per participant. Parental waivers required. Confirmed by the organization: ages 13-17 (18+ required to work directly with raptors, which this role does not involve).",
    applicationUrl: "https://libertywildlife.org/education/youth-programs/", sourceUrl: "https://libertywildlife.org/education/youth-programs/",
    externalId: "liberty-wildlife-teen-guide",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Orphan Care Volunteer (Seasonal)", category: "Animals", minimumAge: 16, location: LW_LOCATION, deliveryMode: "in_person",
    description:
      "Feed and care for orphan songbirds brought in by the public during spring and summer (April-September). Four-hour shifts, once a week, between 7 AM and 7 PM; training provided. Confirmed by the organization: volunteers must be at least 16 years old for this seasonal role (most other roles require 18+; this is the one seasonal exception).",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/",
    externalId: "liberty-wildlife-orphan-care",
  },
  // ---- Liberty Wildlife: 7 confirmed 18+ roles (real, distinct, accurately aged — not teen-eligible but within ServeFinder's 13-19 served range) ----
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Daily Care Volunteer", category: "Animals", minimumAge: 18, location: LW_LOCATION, deliveryMode: "in_person",
    description: "Feed and water rehabilitating animals during a morning shift (typically 6/7 AM-10/11 AM), one four-hour shift per week with a minimum 6-month commitment; 9 weeks of mentored training provided. Confirmed by the organization: must be 18 or older (the general volunteer application explicitly excludes anyone under 18, who must instead apply to the separate Teen Volunteer Program).",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-daily-care",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Hotline Volunteer", category: "Animals", minimumAge: 18, location: null, deliveryMode: "virtual",
    description: "Answer the wildlife emergency hotline (8 AM-8:30 PM daily) from home by phone, helping callers with injured, ill, or orphaned wildlife and arranging rescue/transport. One shift per week (2-3 hours), minimum 6-month commitment; training provided. Confirmed by the organization: must be 18 or older (general volunteer application excludes under-18 applicants).",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-hotline",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Intake Window Volunteer", category: "Animals", minimumAge: 18, location: LW_LOCATION, deliveryMode: "in_person",
    description: "Staff the intake window where the public brings in orphaned, ill, or injured wildlife: greet visitors, complete intake forms, and identify species. One shift per week (8 AM-12 PM, 12 PM-3 PM, or 3 PM-6 PM), minimum 6-month commitment. Confirmed by the organization: must be 18 or older.",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-intake-window",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Interpretive Guide", category: "Animals", minimumAge: 18, location: LW_LOCATION, deliveryMode: "in_person",
    description: "Greet the public during Open Hours, talk with visitors about the Interactive Room and Liberty Wildlife's mission, and occasionally lead private tours or help with field trips. One four-hour shift per week, minimum 6-month commitment; training provided. Confirmed by the organization: must be 18 or older.",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-interpretive-guide",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Owl Team Volunteer", category: "Animals", minimumAge: 18, location: LW_LOCATION, deliveryMode: "in_person",
    description: "Feed and care for rehabilitating owls during an afternoon shift (typically 3/4 PM-6 PM), one 3-hour shift per week, minimum 6-month commitment. Confirmed by the organization: must be 18 or older.",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-owl-team",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Rescue and Transport Volunteer", category: "Animals", minimumAge: 18, location: LW_LOCATION, deliveryMode: "in_person",
    description: "Drive into the field to rescue and transport injured wildlife to Liberty Wildlife, using your own vehicle (proof of insurance and current driver's license required). Schedule based on your own availability; a 4-hour on-site training class is required. Confirmed by the organization: must be 18 or older.",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-rescue-transport",
  },
  {
    source: "liberty_wildlife", ...LW_ORG,
    title: "Wildlife Guardian (Fundraising Volunteer)", category: "Animals", minimumAge: 18, location: LW_LOCATION, deliveryMode: "in_person",
    description: "Support Liberty Wildlife's annual Wishes for Wildlife benefit and other fundraising events: attend monthly Guardian meetings, help procure auction items, and assist at events. No prior fundraising experience required. Confirmed by the organization: must be 18 or older (part of the general volunteer application, which excludes under-18 applicants).",
    applicationUrl: "https://libertywildlife.org/support/volunteer/", sourceUrl: "https://libertywildlife.org/support/volunteer/", externalId: "liberty-wildlife-wildlife-guardian",
  },

  // ---- HALO Rescue: 9 roles, all confirmed 16+ ----
  { source: "halo_rescue", ...HALO_ORG, title: "Morning Cleaning and Animal Care", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Assist with morning shelter cleaning and hands-on animal care at HALO's main shelter. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first. No minimum or maximum hour commitment.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-morning-cleaning" },
  { source: "halo_rescue", ...HALO_ORG, title: "Walking Dogs and Cleaning Kennels", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Walk shelter dogs and clean kennels at HALO's main shelter. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-walking-dogs" },
  { source: "halo_rescue", ...HALO_ORG, title: "Cuddle Kitties (Cat Care & Socialization)", category: "Animals", minimumAge: 16, location: "HALO Main Shelter, PetSmart, and Petco locations, Phoenix, AZ", deliveryMode: "in_person",
    description: "Assist with cat care and socialization at HALO's main location or partner PetSmart/Petco adoption locations. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-cuddle-kitties" },
  { source: "halo_rescue", ...HALO_ORG, title: "Adoption Counseling", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Help potential adopters find their right pet match at HALO adoption events and the main shelter. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-adoption-counseling" },
  { source: "halo_rescue", ...HALO_ORG, title: "Laundry and Dishes", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Help with shelter laundry and dishes at HALO's main shelter. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-laundry-dishes" },
  { source: "halo_rescue", ...HALO_ORG, title: "Pet Photography", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Photograph shelter pets to help them get adopted. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-pet-photography" },
  { source: "halo_rescue", ...HALO_ORG, title: "Event Volunteer", category: "Animals", minimumAge: 16, location: "Adoption events across the Phoenix Valley, AZ", deliveryMode: "in_person",
    description: "Assist at HALO adoption and community events to promote the rescue and engage with the public. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-event-volunteer" },
  { source: "halo_rescue", ...HALO_ORG, title: "Thrift Boutique Volunteer", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Support HALO's Thrift Boutique with daily tasks that help fund the rescue's operations. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-thrift-boutique" },
  { source: "halo_rescue", ...HALO_ORG, title: "Foster Volunteer", category: "Animals", minimumAge: 16, location: HALO_LOCATION, deliveryMode: "in_person",
    description: "Foster a shelter cat or dog in your own home. See HALO's Foster page for details. Confirmed by the organization: must be at least 16 years old; complete the online volunteer orientation first.",
    applicationUrl: "https://halorescue.org/volunteer/", sourceUrl: "https://halorescue.org/volunteer/", externalId: "halo-rescue-foster" },

  // ---- UMOM/VOMO: 3 real, dated, per-listing-ID opportunities ----
  { source: "umom_new_day_centers", ...UMOM_ORG, title: "Queen of Hearts Casino Royale Gala Prep", category: "Community Service", minimumAge: 15, location: UMOM_LOCATION, deliveryMode: "in_person",
    description: "Help prepare for UMOM's Queen of Hearts Casino Royale Gala fundraiser. Confirmed by the organization: minimum age 15+.",
    applicationUrl: "https://umom.vomo.org/opportunity/6a626c60d3dcc", sourceUrl: "https://umom.vomo.org/opportunity/6a626c60d3dcc", externalId: "umom-vomo-6a626c60d3dcc",
    applicationDeadline: "2026-09-30" },
  { source: "umom_new_day_centers", ...UMOM_ORG, title: "Residential Dining Volunteer", category: "Community Service", minimumAge: 15, location: UMOM_LOCATION, deliveryMode: "in_person",
    description: "Recurring shift helping serve meals to residential guest families at UMOM New Day Centers. Confirmed by the organization: minimum age 15+.",
    applicationUrl: "https://umom.vomo.org/opportunity/diningvolunteer", sourceUrl: "https://umom.vomo.org/opportunity/diningvolunteer", externalId: "umom-vomo-diningvolunteer" },
  { source: "umom_new_day_centers", ...UMOM_ORG, title: "Clothing Closet Restock", category: "Community Service", minimumAge: 8, location: UMOM_LOCATION, deliveryMode: "in_person",
    description: "Recurring shift sorting and restocking UMOM's clothing closet for resident families. Confirmed by the organization: minimum age 8+.",
    applicationUrl: "https://umom.vomo.org/opportunity/clothingcloset2", sourceUrl: "https://umom.vomo.org/opportunity/clothingcloset2", externalId: "umom-vomo-clothingcloset2" },
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
        application_deadline: item.applicationDeadline ?? null,
      };
      const normalized = normalizeListing(raw, { source: item.source, sourceUrl: item.sourceUrl });
      normalized.category = item.category;
      normalized.minimum_age = item.minimumAge;

      // Geocode real street addresses so in-person records aren't
      // silently invisible to distance-based matching (a null
      // lat/lng hard-excludes an in-person row regardless of a
      // student's radius — see lib/matching.ts's distanceFit()).
      // Only geocode when the location string looks like a real,
      // specific street address (contains a 5-digit ZIP) — generic
      // strings like "Adoption events across the Phoenix Valley, AZ"
      // have no single real coordinate and are correctly left
      // ungeocoded rather than guessed.
      if (item.location) {
        const zipMatch = item.location.match(/\b(\d{5})\b/);
        if (zipMatch) {
          const zip = zipMatch[1];
          if (!geocodeCache.has(zip)) {
            const coords = await geocodeStudentLocation(zip, null);
            geocodeCache.set(zip, coords);
            console.log(coords ? `  Geocoded ${zip} -> ${coords.lat}, ${coords.lng}` : `  Couldn't geocode ${zip}.`);
          }
          const coords = geocodeCache.get(zip) ?? null;
          normalized.latitude = coords?.lat ?? null;
          normalized.longitude = coords?.lng ?? null;
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
        availability_status: "unverified",
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
        // Update in place (e.g. refreshed geocoding) — never touches
        // review_status, so an already-approved row stays approved.
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
