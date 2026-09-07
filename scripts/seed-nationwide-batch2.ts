// Manual-curation seed, batch 2 of nationwide sources individually
// verified live this session (more VSys One hospital campuses, Virtua
// Health's shared-application junior volunteer network, two multi-
// location humane societies with a site-wide teen age policy, and more
// Communico/Better Impact library systems). Every field was confirmed
// against a live, first-party page during this session. Every row lands
// as review_status "pending". Idempotent (external_id dedup).
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

const candidates: Candidate[] = [
  {
    source: "yale_new_haven_hospital",
    orgName: "Yale New Haven Hospital",
    orgDescription: "The flagship hospital of Yale New Haven Health, running a student volunteer program through the system's VSys One volunteer portal.",
    orgWebsite: "https://www.ynhh.org", orgCity: "New Haven, CT",
    title: "Student Volunteer Program", category: "Healthcare", minimumAge: 15, location: "20 York St, New Haven, CT 06510", deliveryMode: "in_person",
    description: "Support hospital operations and patient services as a student volunteer at Yale New Haven Hospital. Confirmed directly via the hospital's own VSys One application form: 'Students must be 15 years of age.' Also requires a criminal background check for volunteers 18+.",
    applicationUrl: "https://yalenewhaven.vsysweb.com/pages/webapp/HSAPP", sourceUrl: "https://yalenewhaven.vsysweb.com/pages/webapp/HSAPP",
    externalId: "yale-new-haven-hospital-student-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "trinity_health_st_mary_mercy_livonia",
    orgName: "St. Mary Mercy Livonia Hospital (Trinity Health)",
    orgDescription: "A Trinity Health hospital in Livonia, Michigan, running a Teen Volunteer Program through the system's VSys One volunteer portal.",
    orgWebsite: "https://www.stmarymercy.org", orgCity: "Livonia, MI",
    title: "Teen Volunteer Program", category: "Healthcare", minimumAge: 16, location: "36475 Five Mile Rd, Livonia, MI 48154", deliveryMode: "in_person",
    description: "Support hospital operations at St. Mary Mercy Livonia as a teen volunteer. Confirmed directly via the hospital's own VSys One application form, titled 'Trinity Health Teen Volunteer Application (16 & 17 y/o),' with a confirmation checkbox reading 'I am 16 or 17 years old.'",
    applicationUrl: "https://stmarymercy.vsyslive.com/pages/app/TEENAPP", sourceUrl: "https://stmarymercy.vsyslive.com/pages/app/TEENAPP",
    externalId: "st-mary-mercy-livonia-teen-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "stamford_health",
    orgName: "Stamford Hospital (Stamford Health)",
    orgDescription: "Stamford Health's hospital in Stamford, Connecticut, running a Teen Volunteer Program through the system's VSys One volunteer portal.",
    orgWebsite: "https://www.stamfordhealth.org", orgCity: "Stamford, CT",
    title: "Teen Volunteer Program", category: "Healthcare", minimumAge: 16, location: "1 Hospital Plaza, Stamford, CT 06902", deliveryMode: "in_person",
    description: "Support hospital operations at Stamford Hospital as a teen volunteer. Confirmed directly via the hospital's own VSys One application form: 'Please complete this application form if you are 16 or 17 years old' (adults 18+ are directed to a separate application).",
    applicationUrl: "https://stamford.vsyslive.com/pages/app/VOLAPP", sourceUrl: "https://stamford.vsyslive.com/pages/app/VOLAPP",
    externalId: "stamford-hospital-teen-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "virtua_health",
    orgName: "Virtua Marlton Hospital",
    orgDescription: "A Virtua Health acute-care hospital campus in Marlton, New Jersey, part of Virtua's shared junior volunteer network.",
    orgWebsite: "https://www.virtua.org", orgCity: "Marlton, NJ",
    title: "Junior Volunteer Program", category: "Healthcare", minimumAge: 14, location: "90 Brick Rd, Marlton, NJ 08053", deliveryMode: "in_person",
    description: "Support hospital operations at Virtua Marlton Hospital as a junior volunteer. Confirmed via Virtua's own shared junior volunteer application (juniors 'ages 14-18 years'), which lists Marlton among its selectable campus locations alongside Voorhees (already a separate ServeFinder listing), Mount Holly, Our Lady of Lourdes, and Willingboro.",
    applicationUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP", sourceUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
    externalId: "virtua-marlton-junior-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "virtua_health",
    orgName: "Virtua Mount Holly Hospital",
    orgDescription: "A Virtua Health acute-care hospital campus in Mount Holly, New Jersey, part of Virtua's shared junior volunteer network.",
    orgWebsite: "https://www.virtua.org", orgCity: "Mount Holly, NJ",
    title: "Junior Volunteer Program", category: "Healthcare", minimumAge: 14, location: "175 Madison Ave, Mount Holly, NJ 08060", deliveryMode: "in_person",
    description: "Support hospital operations at Virtua Mount Holly Hospital as a junior volunteer. Confirmed via Virtua's own shared junior volunteer application (juniors 'ages 14-18 years'), which lists Mount Holly among its selectable campus locations.",
    applicationUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP", sourceUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
    externalId: "virtua-mount-holly-junior-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "virtua_health",
    orgName: "Our Lady of Lourdes Medical Center (Virtua)",
    orgDescription: "A Virtua Health acute-care hospital campus in Camden, New Jersey, part of Virtua's shared junior volunteer network.",
    orgWebsite: "https://www.virtua.org", orgCity: "Camden, NJ",
    title: "Junior Volunteer Program", category: "Healthcare", minimumAge: 14, location: "1600 Haddon Ave, Camden, NJ 08103", deliveryMode: "in_person",
    description: "Support hospital operations at Our Lady of Lourdes Medical Center as a junior volunteer. Confirmed via Virtua's own shared junior volunteer application (juniors 'ages 14-18 years'), which lists Our Lady of Lourdes among its selectable campus locations.",
    applicationUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP", sourceUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
    externalId: "virtua-lourdes-camden-junior-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "virtua_health",
    orgName: "Virtua Willingboro Hospital",
    orgDescription: "A Virtua Health hospital campus in Willingboro, New Jersey, part of Virtua's shared junior volunteer network.",
    orgWebsite: "https://www.virtua.org", orgCity: "Willingboro, NJ",
    title: "Junior Volunteer Program", category: "Healthcare", minimumAge: 14, location: "218 Sunset Rd, Willingboro, NJ 08046", deliveryMode: "in_person",
    description: "Support hospital operations at Virtua Willingboro Hospital as a junior volunteer. Confirmed via Virtua's own shared junior volunteer application (juniors 'ages 14-18 years'), which lists Willingboro among its selectable campus locations.",
    applicationUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP", sourceUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
    externalId: "virtua-willingboro-junior-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "peninsula_humane_society_spca",
    orgName: "Peninsula Humane Society & SPCA",
    orgDescription: "A San Francisco Peninsula animal welfare organization (Burlingame, CA) running a Junior Volunteer Program with an age-banded policy.",
    orgWebsite: "https://phs-spca.org", orgCity: "Burlingame, CA",
    title: "Junior Volunteer Program", category: "Animals", minimumAge: 13, location: "1450 Rollins Rd, Burlingame, CA 94010", deliveryMode: "in_person",
    description: "Support shelter operations at Peninsula Humane Society & SPCA as a junior volunteer. Confirmed directly via the organization's own page: the program is 'available for youth 13 to 17 years of age,' and 'volunteers ages 13-15 must be accompanied by a parent or guardian (one adult per junior volunteer ages 13-15)' — 16-17 year olds are not named in the accompaniment requirement, consistent with an unaccompanied older-teen tier.",
    applicationUrl: "https://phs-spca.org/volunteer/positions/junior/", sourceUrl: "https://phs-spca.org/volunteer/positions/junior/",
    externalId: "peninsula-humane-society-junior-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "michigan_humane",
    orgName: "Michigan Humane",
    orgDescription: "A Metro Detroit animal welfare organization with campuses in Detroit, Westland, and Rochester Hills, running a youth volunteer program.",
    orgWebsite: "https://www.michiganhumane.org", orgCity: "Detroit, MI",
    title: "Youth Volunteer Program", category: "Animals", minimumAge: 14, location: "Michigan Humane campuses (Detroit, Westland, Rochester Hills), MI", deliveryMode: "in_person",
    description: "Support shelter and event operations across Michigan Humane's Detroit-area campuses as a youth volunteer. Confirmed directly via the organization's own page: Michigan Humane 'welcomes youth volunteers between the ages of 14 and 17 to serve onsite or at our events with an adult over the age of 25' — every age within the 14-17 band requires adult accompaniment (no unaccompanied-teen tier, unlike some other humane societies).",
    applicationUrl: "https://www.michiganhumane.org/community-service/", sourceUrl: "https://www.michiganhumane.org/community-service/",
    externalId: "michigan-humane-youth-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "fountaindale_public_library",
    orgName: "Fountaindale Public Library",
    orgDescription: "A public library in Bolingbrook, Illinois, running a recurring Teen Volunteer program through its Communico events platform.",
    orgWebsite: "https://www.fountaindale.org", orgCity: "Bolingbrook, IL",
    title: "Teen Volunteer Program", category: "Education", minimumAge: 12, location: "300 W Briarcliff Rd, Bolingbrook, IL 60440", deliveryMode: "in_person",
    description: "Volunteer at Fountaindale Public Library. Confirmed directly via the library's own Communico event page: open to 'Grades 6-12.' Does not accept court-ordered community service.",
    applicationUrl: "https://fountaindale.libnet.info/event/13568602", sourceUrl: "https://fountaindale.libnet.info/event/13568602",
    externalId: "fountaindale-library-teen-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "naperville_public_library",
    orgName: "Naperville Public Library",
    orgDescription: "A public library system in Naperville, Illinois, running a recurring Teen Volunteering program through its Communico events platform.",
    orgWebsite: "https://www.naperville-lib.org", orgCity: "Naperville, IL",
    title: "Teen Volunteering", category: "Education", minimumAge: 11, location: "Naperville Public Library branches (multiple), IL", deliveryMode: "in_person",
    description: "Volunteer at a Naperville Public Library branch. Confirmed directly via the library's own Communico event page: 'This event is for registrants grade 6th Grade to 12th Grade.' The library also uses Better Impact separately for logging volunteer hours once registered.",
    applicationUrl: "https://napervillepl.librarycalendar.com/event/teen-volunteering-62559", sourceUrl: "https://napervillepl.librarycalendar.com/event/teen-volunteering-62559",
    externalId: "naperville-library-teen-volunteering",
    availabilityStatus: "open",
  },
  {
    source: "hoover_public_library",
    orgName: "Hoover Public Library",
    orgDescription: "A public library in Hoover, Alabama, running recurring Teen Volunteer Days through its Communico events platform.",
    orgWebsite: "https://www.hooverlibrary.org", orgCity: "Hoover, AL",
    title: "Teen Volunteer Days", category: "Education", minimumAge: 13, location: "200 Municipal Dr, Hoover, AL 35216", deliveryMode: "in_person",
    description: "Volunteer at Hoover Public Library. Confirmed directly via the library's own Communico event page: 'Volunteering is for High School students Grades 8-12. Hours available for community service only.'",
    applicationUrl: "https://hoover.libnet.info/event/6159729", sourceUrl: "https://hoover.libnet.info/event/6159729",
    externalId: "hoover-library-teen-volunteer-days",
    availabilityStatus: "open",
  },
  {
    source: "allen_county_public_library",
    orgName: "Allen County Public Library",
    orgDescription: "A public library system in Fort Wayne, Indiana, running a two-tier Teen Volunteer Corps through its Communico events platform.",
    orgWebsite: "https://www.acpl.info", orgCity: "Fort Wayne, IN",
    title: "Teen Volunteer Corps", category: "Education", minimumAge: 12, location: "Allen County Public Library branches (multiple), IN", deliveryMode: "in_person",
    description: "Volunteer at an Allen County Public Library branch. Confirmed directly via the library's own Communico event page, which splits eligibility into two tiers: '9th-12th Grade' and '7th-8th Grade' — both tiers volunteer under the same Teen Volunteer Corps program, distinguished only by grade band, not by distinct duties.",
    applicationUrl: "https://acpl.libnet.info/event/7043643", sourceUrl: "https://acpl.libnet.info/event/7043643",
    externalId: "allen-county-library-teen-volunteer-corps",
    availabilityStatus: "open",
  },
  {
    source: "las_vegas_clark_county_library_district",
    orgName: "Las Vegas-Clark County Library District",
    orgDescription: "A public library district in Las Vegas, Nevada, running a Youth Services volunteer track through its Better Impact volunteer portal.",
    orgWebsite: "https://www.thelibrarydistrict.org", orgCity: "Las Vegas, NV",
    title: "Youth Services Volunteer", category: "Education", minimumAge: 14, location: "Las Vegas-Clark County Library District branches (multiple), NV", deliveryMode: "in_person",
    description: "Support Youth Services programming at a Las Vegas-Clark County Library District branch. Confirmed directly via the district's own Better Impact portal, which lists a 'Youth Services (ages 14 - 17 years)' category distinct from its Adult Services volunteer track.",
    applicationUrl: "https://app.betterimpact.com/PublicEnterprise/b5133c47-a61a-4d7f-ae3a-e0879ad955b2", sourceUrl: "https://app.betterimpact.com/PublicEnterprise/b5133c47-a61a-4d7f-ae3a-e0879ad955b2",
    externalId: "las-vegas-clark-county-library-youth-services",
    availabilityStatus: "open",
  },
  {
    source: "cincinnati_hamilton_county_public_library",
    orgName: "Cincinnati & Hamilton County Public Library",
    orgDescription: "A public library system serving Cincinnati and Hamilton County, Ohio, running teen volunteer roles across its branches through its Better Impact volunteer portal.",
    orgWebsite: "https://www.chpl.org", orgCity: "Cincinnati, OH",
    title: "Summer Program Assistant / Branch Library Aide", category: "Education", minimumAge: 12, location: "Cincinnati & Hamilton County Public Library branches (multiple, e.g. Monfort Heights), OH", deliveryMode: "in_person",
    description: "Assist library staff with summer programming or general branch duties as a teen volunteer at a Cincinnati & Hamilton County Public Library branch. Confirmed directly via the system's own Better Impact activity listing: 'minimum age 12 years old, maximum age 18 years old.' The same activity is offered at multiple branches (e.g. Monfort Heights); this record represents the shared teen-eligible role, not a per-branch listing.",
    applicationUrl: "https://app.betterimpact.com/PublicOrganization/b5363d89-ae1d-4a9a-878b-f57ec63139ff/Gvi/dc1dbf3b-e10f-4527-b24b-11cd6af4f94b/1", sourceUrl: "https://app.betterimpact.com/PublicOrganization/b5363d89-ae1d-4a9a-878b-f57ec63139ff/Gvi/dc1dbf3b-e10f-4527-b24b-11cd6af4f94b/1",
    externalId: "cincinnati-hamilton-county-library-summer-program-assistant",
    availabilityStatus: "open",
  },
  {
    source: "frisco_public_library",
    orgName: "Frisco Public Library",
    orgDescription: "A public library in Frisco, Texas, running a VolunTEEN program (grades 7-12) through its Better Impact volunteer portal.",
    orgWebsite: "https://www.friscolibrary.com", orgCity: "Frisco, TX",
    title: "VolunTEEN Program", category: "Education", minimumAge: 12, location: "6101 Frisco Square Blvd, Frisco, TX 75034", deliveryMode: "in_person",
    description: "Volunteer at Frisco Public Library as part of the VolunTEEN program. Confirmed directly via the library's own Better Impact portal: the program serves 'middle and high school students (grades 7-12),' split into 'VolunTEEN: 7th-8th Grade' and 'VolunTEEN: 9th-12th Grade' tiers. At the time of this session's check, the VolunTEEN listing showed as full/not currently accepting new applications.",
    applicationUrl: "https://app.betterimpact.com/PublicOrganization/62d49a32-754a-40c2-9d93-75b2d2f93892/1", sourceUrl: "https://app.betterimpact.com/PublicOrganization/62d49a32-754a-40c2-9d93-75b2d2f93892/1",
    externalId: "frisco-library-volunteen",
    availabilityStatus: "waitlisted",
    availabilityNote: "Listed as full/not currently accepting new applications as of this session's check; the org's own portal indicates this is a capacity limit, not a discontinued program — check back for reopened capacity.",
  },
  {
    source: "corvallis_parks_and_recreation",
    orgName: "Corvallis Parks and Recreation",
    orgDescription: "The City of Corvallis, Oregon's parks and recreation department, running a Youth Volunteer Corps through its Better Impact volunteer portal. Distinct from the Corvallis Public Library, already a separate ServeFinder connector.",
    orgWebsite: "https://www.corvallisoregon.gov/parks", orgCity: "Corvallis, OR",
    title: "Youth Volunteer Corps", category: "Environment", minimumAge: 11, location: "Corvallis Parks and Recreation locations (multiple), OR", deliveryMode: "in_person",
    description: "Support parks and recreation programs and events as part of Corvallis Parks and Recreation's Youth Volunteer Corps. Confirmed directly via the department's own Better Impact portal: the Youth Volunteer Corps serves 'youth ages 11-18,' and multiple other listed activities are separately marked 'Suitable for youth 16 and over.'",
    applicationUrl: "https://app.betterimpact.com/PublicEnterprise/2045eae9-4b9e-48e7-a032-b7eaacdde0a7", sourceUrl: "https://app.betterimpact.com/PublicEnterprise/2045eae9-4b9e-48e7-a032-b7eaacdde0a7",
    externalId: "corvallis-parks-rec-youth-volunteer-corps",
    availabilityStatus: "open",
  },
];

async function main() {
  const bySource = new Map<string, Candidate[]>();
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

      const zipMatch = item.location.match(/\b(\d{5})\b/);
      const geoKey = zipMatch ? zipMatch[1] : item.orgCity;
      if (!geocodeCache.has(geoKey)) {
        const coords = zipMatch
          ? await geocodeStudentLocation(zipMatch[1], null)
          : await geocodeStudentLocation(null, item.orgCity);
        geocodeCache.set(geoKey, coords);
        console.log(coords ? `  Geocoded ${geoKey} -> ${coords.lat}, ${coords.lng}` : `  Couldn't geocode ${geoKey}.`);
      }
      const coords = geocodeCache.get(geoKey) ?? null;
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
