// Manual-curation seed for 9 sources already individually verified live
// during earlier research this session (Stage 2 fork reports + a fresh
// spot-check of Maricopa County Parks this run) but never written as
// staged records -- each needed exactly one evidence-backed record to
// satisfy the 90-source usable-source definition (a registered
// "manual_only" source with zero completed records does not count).
//
// Every row lands as review_status "pending". Idempotent (external_id
// dedup) -- safe to re-run.
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
};

const candidates: Candidate[] = [
  {
    source: "maricopa_county_animal_care_control",
    orgName: "Maricopa County Animal Care and Control",
    orgDescription: "Maricopa County's animal shelter and control agency, relying on volunteers for shelter care and foster support across its East and West valley locations.",
    orgWebsite: "https://www.maricopa.gov/294/Volunteer", orgCity: "Phoenix, AZ",
    title: "Shelter Volunteer (Teen Track)", category: "Animals", minimumAge: 15, location: "Phoenix / Mesa, AZ", deliveryMode: "in_person",
    description: "Assist with shelter animal care at Maricopa County's East or West valley shelter locations. Confirmed by the organization: prospective volunteers must generally be at least 18, but 'younger individuals aged 15-17 may participate if they attend training alongside a parent or guardian.'",
    applicationUrl: "https://www.maricopa.gov/294/Volunteer", sourceUrl: "https://www.maricopa.gov/294/Volunteer",
    externalId: "maricopa-acc-shelter-volunteer-teen",
  },
  {
    source: "maricopa_county_parks",
    orgName: "Maricopa County Parks and Recreation",
    orgDescription: "Maricopa County's regional parks department, relying on volunteers as Core Volunteers, Trail Ambassadors, Desert Defender Stewards, and Service Volunteers across its park system.",
    orgWebsite: "https://www.maricopacountyparks.net/get-involved/how-to-volunteer/", orgCity: "Phoenix, AZ",
    title: "Core Volunteer / Trail Ambassador", category: "Environment", minimumAge: 13, location: "Maricopa County regional parks, AZ", deliveryMode: "in_person",
    description: "Serve as a Core Volunteer, Trail Ambassador, or Desert Defender Steward across Maricopa County's regional park system. Confirmed by the organization: 'Minors are welcome to volunteer with a completed Waiver of Liability for Minor Participants form' (parent/guardian signature required); no single specific age floor is published beyond that.",
    applicationUrl: "https://www.volgistics.com/appform/1414842747", sourceUrl: "https://www.maricopacountyparks.net/get-involved/how-to-volunteer/",
    externalId: "maricopa-parks-core-volunteer",
  },
  {
    source: "mim_phoenix",
    orgName: "Musical Instrument Museum",
    orgDescription: "Phoenix museum dedicated to global musical instruments and cultures, relying on volunteers for gallery interpretation and guest services.",
    orgWebsite: "https://mim.org/ways-to-give/volunteer/", orgCity: "Phoenix, AZ",
    title: "Museum Volunteer", category: "Arts & Culture", minimumAge: 16, location: "4725 E Mayo Blvd, Phoenix, AZ 85050", deliveryMode: "in_person",
    description: "Assist with gallery interpretation and guest services at the Musical Instrument Museum. Confirmed by the organization: minimum age 16, with parental consent required for volunteers under 18. Requires a background check and drug test.",
    applicationUrl: "https://mim.org/ways-to-give/volunteer/", sourceUrl: "https://mim.org/ways-to-give/volunteer/",
    externalId: "mim-phoenix-museum-volunteer",
  },
  {
    source: "scottsdale_library_teen_volunteer",
    orgName: "Scottsdale Public Library",
    orgDescription: "Scottsdale's public library system, running a dedicated Teen Volunteer Program across its branches.",
    orgWebsite: "https://www.scottsdalelibrary.org/get-involved/teen-volunteers", orgCity: "Scottsdale, AZ",
    title: "Teen Volunteer", category: "Education", minimumAge: 14, location: "Scottsdale, AZ", deliveryMode: "in_person",
    description: "Volunteer at a Scottsdale Public Library branch during the School Year (Sept-May) or Summer (June-July) track. Confirmed by the organization: 'at least 14 and not yet 18,' parent/guardian permission required. Applications for the 2026-27 cycle open in August (seasonal).",
    applicationUrl: "https://www.scottsdalelibrary.org/get-involved/teen-volunteers", sourceUrl: "https://www.scottsdalelibrary.org/get-involved/teen-volunteers",
    externalId: "scottsdale-library-teen-volunteer",
  },
  {
    source: "scottsdale_parks_teen_volunteer",
    orgName: "City of Scottsdale Parks and Recreation",
    orgDescription: "Scottsdale's parks and recreation department, running a Teen Volunteer Program supporting summer camp mentoring and leadership.",
    orgWebsite: "https://www.scottsdaleaz.gov/volunteer/parks-and-recreation---teen-volunteer-program", orgCity: "Scottsdale, AZ",
    title: "Parks & Recreation Teen Volunteer", category: "Sports & Rec", minimumAge: 14, location: "Scottsdale, AZ", deliveryMode: "in_person",
    description: "Support summer camp mentoring and leadership activities through the City of Scottsdale's Teen Volunteer Program. Confirmed by the organization: ages 14-17. Seasonal — interviews typically begin around April for the summer program.",
    applicationUrl: "https://www.scottsdaleaz.gov/volunteer/parks-and-recreation---teen-volunteer-program", sourceUrl: "https://www.scottsdaleaz.gov/volunteer/parks-and-recreation---teen-volunteer-program",
    externalId: "scottsdale-parks-teen-volunteer",
  },
  {
    source: "chandler_library_teen_volunteer",
    orgName: "Chandler Public Library",
    orgDescription: "Chandler's public library system, running a Teen Volunteer Program at its Sunset and Downtown branches.",
    orgWebsite: "https://chandlerlibrary.org/volunteer/", orgCity: "Chandler, AZ",
    title: "Teen Volunteer", category: "Education", minimumAge: 13, location: "Chandler, AZ", deliveryMode: "in_person",
    description: "Volunteer at the Sunset or Downtown branch of Chandler Public Library on a weekly-shift commitment. Confirmed by the organization: ages 13-17.",
    applicationUrl: "https://chandlerlibrary.org/volunteer/", sourceUrl: "https://chandlerlibrary.org/volunteer/",
    externalId: "chandler-library-teen-volunteer",
  },
  {
    source: "gilbert_myac",
    orgName: "Gilbert Mayor's Youth Advisory Council",
    orgDescription: "Town of Gilbert's official youth civic-engagement council for high schoolers, requiring a annual community-service commitment.",
    orgWebsite: "https://www.gilbertaz.gov/residents/town-programs/mayor-s-youth-advisory-council", orgCity: "Gilbert, AZ",
    title: "Mayor's Youth Advisory Council Member", category: "Community Service", minimumAge: 14, location: "Gilbert, AZ", deliveryMode: "in_person",
    description: "Serve on the Town of Gilbert's Mayor's Youth Advisory Council, contributing to town civic programs and completing at least 15 hours of community service per year. Confirmed by the organization: ages 14-18, high school students only.",
    applicationUrl: "https://www.gilbertaz.gov/residents/town-programs/mayor-s-youth-advisory-council", sourceUrl: "https://www.gilbertaz.gov/residents/town-programs/mayor-s-youth-advisory-council",
    externalId: "gilbert-myac-member",
  },
  {
    source: "sedav_vaaki_museum",
    orgName: "S'edav Va'aki Museum",
    orgDescription: "City of Phoenix archaeological museum (formerly Pueblo Grande Museum) preserving a Hohokam village site, running an annual Teen Volunteer Program.",
    orgWebsite: "https://www.phoenix.gov/administration/departments/sedav-vaaki/support-sedav-vaaki/volunteer.html", orgCity: "Phoenix, AZ",
    title: "Teen Volunteer Program", category: "Education", minimumAge: 14, location: "4619 E Washington St, Phoenix, AZ 85034", deliveryMode: "in_person",
    description: "Support museum operations and visitor programs through S'edav Va'aki Museum's annual Teen Volunteer Program. Confirmed by the organization: ages 14-17. Seasonal application cycles run in fall and spring.",
    applicationUrl: "https://www.phoenix.gov/administration/departments/sedav-vaaki/support-sedav-vaaki/volunteer.html", sourceUrl: "https://www.phoenix.gov/administration/departments/sedav-vaaki/support-sedav-vaaki/volunteer.html",
    externalId: "sedav-vaaki-teen-volunteer",
  },
  {
    source: "united_food_bank",
    orgName: "United Food Bank",
    orgDescription: "East Valley regional food bank serving Mesa and surrounding communities, relying on volunteers for food sorting and emergency food-bag assembly.",
    orgWebsite: "https://unitedfoodbank.org/volunteer/", orgCity: "Mesa, AZ",
    title: "Food Sorting & Emergency Food Bag Volunteer", category: "Community Service", minimumAge: 13, location: "Mesa, AZ", deliveryMode: "in_person",
    description: "Sort donated food and help build emergency food bags at United Food Bank's Mesa facility. Confirmed by the organization: ages 5-15 may volunteer at emergency food-bag shifts; ages 16-17 may volunteer independently with a signed parent/guardian waiver. Recurring shift-based program via the organization's own scheduler, not a single-date event.",
    applicationUrl: "https://volunteer.unitedfoodbank.org/", sourceUrl: "https://unitedfoodbank.org/volunteer/",
    externalId: "united-food-bank-sorting-volunteer",
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

      if (item.location) {
        const zipMatch = item.location.match(/\b(\d{5})\b/);
        const cityMatch = !zipMatch ? item.location.match(/^([A-Za-z .]+),\s*AZ/) : null;
        const key = zipMatch ? zipMatch[1] : cityMatch ? `${cityMatch[1]}, AZ` : null;
        if (key) {
          if (!geocodeCache.has(key)) {
            const coords = zipMatch ? await geocodeStudentLocation(zipMatch[1], null) : await geocodeStudentLocation(null, key);
            geocodeCache.set(key, coords);
            console.log(coords ? `  Geocoded ${key} -> ${coords.lat}, ${coords.lng}` : `  Couldn't geocode ${key}.`);
          }
          const coords = geocodeCache.get(key) ?? null;
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
