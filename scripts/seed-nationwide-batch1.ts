// Manual-curation seed for nationwide sources individually verified live
// this session (Communico library systems, Better Impact tenants, a VSys
// One hospital campus, and a Wisconsin Humane Society campus not yet in
// the catalog). Every field was confirmed against a live, first-party
// page during this session — see each candidate's description for the
// exact quoted evidence. Every row lands as review_status "pending".
// Idempotent (external_id dedup) — safe to re-run.
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
  orgCity: string; // "City, ST" — used for geocoding fallback
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
    source: "broward_county_library",
    orgName: "Broward County Library",
    orgDescription: "Florida's Broward County public library system, running an annual Summer Teen Volunteer Program through its Youth Services department, coordinated via the system's Communico events platform.",
    orgWebsite: "https://www.broward.org/Library/Pages/Volunteer.aspx", orgCity: "Fort Lauderdale, FL",
    title: "Summer Teen Volunteer Program", category: "Education", minimumAge: 15, location: "Broward County Library branches (multiple), FL", deliveryMode: "in_person",
    description: "Volunteer in the Youth Services department at a Broward County Library branch over the summer. Confirmed directly via the system's own Communico event pages (broward.libnet.info): 'Teens entering 10th - 12th grade in the fall are invited to apply to volunteer this summer.' Requires a mandatory in-person orientation with a parent/guardian (applications distributed at orientation, not online), and availability for 6+ weeks between June 3 and August 1. Multiple branches (e.g. Southwest Regional) hold their own orientation sessions on a rolling seasonal schedule.",
    applicationUrl: "https://broward.libnet.info/event/16342122", sourceUrl: "https://broward.libnet.info/event/16342122",
    externalId: "broward-county-library-summer-teen-volunteer",
    availabilityStatus: "seasonal",
    availabilityNote: "Orientation sign-ups open on a rolling basis each spring for the June-August summer cycle; the most recently observed session's registration was already closed. Check broward.libnet.info for the next open orientation date.",
  },
  {
    source: "cuyahoga_county_public_library",
    orgName: "Cuyahoga County Public Library",
    orgDescription: "Ohio's Cuyahoga County public library system, running a VolunTEENS program across its branches through the system's Communico events platform.",
    orgWebsite: "https://attend.cuyahogalibrary.org", orgCity: "Cleveland, OH",
    title: "VolunTEENS Program", category: "Education", minimumAge: 11, location: "Cuyahoga County Public Library branches (multiple), OH", deliveryMode: "in_person",
    description: "Help with library programs (e.g. assisting Kindergarten Countdown, running the juvenile Chess & Checkers Club, book-sale setup) at a Cuyahoga County Public Library branch, earning volunteer credit hours. Confirmed directly via the system's own Communico event pages (attend.cuyahogalibrary.org / reserve.cuyahogalibrary.org): general VolunTEENS eligibility is 'ages 11-18,' while specific credit-earning roles (Chess & Checkers Club, Kindergarten Countdown) each separately state 'volunteers 13 and older (at least 8th grade).'",
    applicationUrl: "https://reserve.cuyahogalibrary.org/event/10279310", sourceUrl: "https://reserve.cuyahogalibrary.org/event/10279310",
    externalId: "cuyahoga-county-library-volunteens",
    availabilityStatus: "open",
  },
  {
    source: "montgomery_county_public_libraries_md",
    orgName: "Montgomery County Public Libraries",
    orgDescription: "Maryland's Montgomery County public library system, running a Teen Advisory Board (TAB) at multiple branches through the system's Communico events platform.",
    orgWebsite: "https://www.montgomerycountymd.gov/library/board/teen-advisory-board.html", orgCity: "Rockville, MD",
    title: "Teen Advisory Board (TAB)", category: "Education", minimumAge: 13, location: "Montgomery County Public Libraries branches (multiple, e.g. Davis, Chevy Chase, Germantown, Rockville Memorial, White Oak, Quince Orchard, Wheaton), MD", deliveryMode: "in_person",
    description: "Advise library staff on teen programming, materials, and events as a member of a branch Teen Advisory Board. Confirmed directly via the county's own page: applicants must be '13 or in 8th grade at time of application up to 17 or 18 and a Senior in high school.' Apply via the Teen Advisory Board interest form; a caregiver-signed paper volunteer application (montgomerycountymd.gov/library/resources/files/about/volunteer-application.pdf) is required at the first meeting. Multiple branches each run their own TAB chapter with its own meeting schedule.",
    applicationUrl: "https://www.montgomerycountymd.gov/library/board/teen-advisory-board.html", sourceUrl: "https://www.montgomerycountymd.gov/library/board/teen-advisory-board.html",
    externalId: "montgomery-county-md-library-tab",
    availabilityStatus: "open",
  },
  {
    source: "awla_arlington",
    orgName: "Animal Welfare League of Arlington (AWLA)",
    orgDescription: "Virginia's Arlington County animal shelter and welfare organization, running a dedicated Teen Volunteer Program through its Better Impact volunteer portal.",
    orgWebsite: "https://www.awla.org/volunteer/", orgCity: "Arlington, VA",
    title: "Teen Volunteer Program", category: "Animals", minimumAge: 16, location: "2650 S Arlington Mill Dr, Arlington, VA 22206", deliveryMode: "in_person",
    description: "Support shelter operations at AWLA as part of its dedicated teen track. Confirmed directly via the organization's own volunteer page: 'We have two volunteer programs at AWLA - adult volunteers (anyone over 18 years old) and teen volunteers (16-17 years old).' Apply via the org's Better Impact portal, button labeled 'Become a Teen Volunteer (16-17 years).'",
    applicationUrl: "https://app.betterimpact.com/PublicOrganization/4151d407-787a-47f0-9fde-e04829647d85/2", sourceUrl: "https://www.awla.org/volunteer/",
    externalId: "awla-arlington-teen-volunteer",
    availabilityStatus: "open",
  },
  {
    source: "cincinnati_parks",
    orgName: "Cincinnati Parks",
    orgDescription: "The City of Cincinnati's parks department, running youth summer-camp volunteer programs through its Better Impact volunteer portal.",
    orgWebsite: "https://www.cincinnati-oh.gov/parks/", orgCity: "Cincinnati, OH",
    title: "Youth Service Program", category: "Environment", minimumAge: 13, location: "Cincinnati Parks locations (multiple), OH", deliveryMode: "in_person",
    description: "Assist with Cincinnati Parks' youth summer programming as part of the Youth Service Program. Confirmed directly via the organization's own Better Impact activity listing (app.betterimpact.com/PublicOrganization/3ef7a4d9-44cf-40b9-aa64-6068529691e0/1): 'Must be at least 13 years old.'",
    applicationUrl: "https://app.betterimpact.com/PublicOrganization/3ef7a4d9-44cf-40b9-aa64-6068529691e0/1", sourceUrl: "https://app.betterimpact.com/PublicOrganization/3ef7a4d9-44cf-40b9-aa64-6068529691e0/1",
    externalId: "cincinnati-parks-youth-service-program",
    availabilityStatus: "open",
  },
  {
    source: "cincinnati_parks",
    orgName: "Cincinnati Parks",
    orgDescription: "The City of Cincinnati's parks department, running youth summer-camp volunteer programs through its Better Impact volunteer portal.",
    orgWebsite: "https://www.cincinnati-oh.gov/parks/", orgCity: "Cincinnati, OH",
    title: "Counselor-in-Training (CIT)", category: "Environment", minimumAge: 13, location: "Cincinnati Parks locations (multiple), OH", deliveryMode: "in_person",
    description: "Serve as a Counselor-in-Training supporting Cincinnati Parks' summer camp programs. Confirmed directly via the organization's own Better Impact activity listing (app.betterimpact.com/PublicOrganization/3ef7a4d9-44cf-40b9-aa64-6068529691e0/1): 'C.I.T.s must be at least 13 years old by the start of camp.' A distinct role from the general Youth Service Program, with its own activity listing on the same portal.",
    applicationUrl: "https://app.betterimpact.com/PublicOrganization/3ef7a4d9-44cf-40b9-aa64-6068529691e0/1", sourceUrl: "https://app.betterimpact.com/PublicOrganization/3ef7a4d9-44cf-40b9-aa64-6068529691e0/1",
    externalId: "cincinnati-parks-cit",
    availabilityStatus: "open",
  },
  {
    source: "mount_sinai_west",
    orgName: "Mount Sinai West",
    orgDescription: "A Mount Sinai Health System hospital campus in Manhattan, running the Junior Medical Program (JuMP) summer teen volunteer program through the health system's VSys One volunteer portal.",
    orgWebsite: "https://www.mountsinai.org/locations/west/about/volunteer", orgCity: "New York, NY",
    title: "Junior Medical Program (JuMP)", category: "Healthcare", minimumAge: 15, location: "Mount Sinai West, 1000 10th Ave, New York, NY 10019", deliveryMode: "in_person",
    description: "Shadow healthcare professionals in clinical and non-clinical hospital areas and gain direct patient contact through Mount Sinai West's Junior Medical Program (JuMP). Confirmed via the organization's own published application packet and program description: a 6-week summer program 'for 15 to 17-year-olds,' requiring 100 hours across all 6 weeks, one letter of recommendation, and a resume. Applications are only accepted January 1 - March 1 each year.",
    applicationUrl: "https://mountsinai.vsyslive.com/pages/vreq", sourceUrl: "https://www.mountsinai.org/locations/west/about/volunteer",
    externalId: "mount-sinai-west-jump",
    availabilityStatus: "seasonal",
    availabilityNote: "The org's own materials state applications are accepted January 1 - March 1 only, for a summer program start; outside that window the program is not currently accepting new applicants.",
  },
  {
    source: "wisconsin_humane_society_racine",
    orgName: "Wisconsin Humane Society - Racine Campus",
    orgDescription: "Wisconsin Humane Society's Racine, WI campus, running a seasonal Youth Leader volunteer program under the org's site-wide teen volunteer policy.",
    orgWebsite: "https://www.wihumane.org/volunteer", orgCity: "Racine, WI",
    title: "Youth Leader Program", category: "Animals", minimumAge: 13, location: "Wisconsin Humane Society - Racine Campus, WI", deliveryMode: "in_person",
    description: "Serve as a Youth Leader supporting seasonal shelter programs at the Wisconsin Humane Society's Racine Campus. Confirmed directly via the organization's own volunteer materials: 'Youth Leader positions are available at the Racine Campus for young people ages 13-17.' Requires a parent/guardian-signed consent form (parent must be present for the online application) and attendance at a mandatory informational session before applying to any seasonal position at this campus.",
    applicationUrl: "https://www.wihumane.org/volunteer", sourceUrl: "https://www.wihumane.org/volunteer",
    externalId: "wisconsin-humane-society-racine-youth-leader",
    availabilityStatus: "seasonal",
    availabilityNote: "Seasonal positions require attending an informational session before applying; check the org's site for the current cycle's session dates.",
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
