// Manually curated / non-scraped source records — organizations and
// programs that don't have a discrete, scrapeable listings page, added
// via lib/../scripts/seed-manual-records.ts rather than a weekly cron
// fetcher (see ARCHITECTURE.md's "Manual source integration" section for
// the full research trail and why each one is shaped the way it is).
//
// Every field here was verified against a live, accessible, first-party
// source as of the date this file was written — never a search-cache
// snippet, never guessed. Where a source didn't publish a fact (an exact
// age, a deep-link URL, a current application window), the honest choice
// was made explicitly, not filled in with a plausible-sounding invented
// value — see each record's own comment for what's actually unknown and
// why the value chosen (or omission) is the honest one.
//
// applicationUrl uses a `mailto:` link specifically where the only real
// pathway is "email this person," not a form/portal — that's also how
// lib/availabilityStatus.ts's isContactOnlyLink() distinguishes an
// "External application" badge from a "Contact organization" one,
// without needing a second dedicated schema field for it.
//
// Where the exact deep-link to a registration form/portal wasn't fully
// captured during research (a truncated URL fragment, not the complete
// address), applicationUrl points to the verified page that itself links
// to that form instead of reconstructing a guessed URL — a broken or
// wrong direct link would be worse than one extra click through a page
// that's confirmed real and correct.

// ProgramType/Compensation were previously redeclared locally here,
// duplicating lib/availabilityStatus.ts's own definitions — a real risk
// once the CS/Engineering batch needed to add "competition" to
// ProgramType in exactly one place, not two that could silently drift.
// Now imported directly, same as AvailabilityStatus already was.
import type { AvailabilityStatus, ProgramType, Compensation, DeliveryMode } from "./availabilityStatus";
export type { ProgramType, Compensation, DeliveryMode };

export type ManualOpportunity = {
  title: string;
  description: string;
  location: string | null;
  // Geocoding inputs — both null means "deliberately not geocoded" (see
  // Future Stars AZ below), not an oversight.
  zip: string | null;
  geocodeCity: string | null;
  minimumAge: number;
  applicationUrl: string;
  applicationDeadline: string | null; // YYYY-MM-DD, only when a real date was published
  availabilityStatus: AvailabilityStatus;
  externalIdSuffix: string;
  category: string; // matches lib/constants.ts CATEGORY_OPTIONS — set explicitly, not inferred
  interestsTags: string[];
  commitmentType: "one_time" | "recurring";
  // CS/Engineering batch — omitted defaults to 'in_person' (DB default),
  // correct for every pre-existing record here (all genuinely physical,
  // location-bound programs). Only set explicitly to 'virtual'/'hybrid'
  // when independently reasoned as requiring NO physical attendance at a
  // fixed location — never merely because an application happens online.
  // See each record's own comment below for the specific reasoning.
  deliveryMode?: DeliveryMode;

  // ---- Biomedical/healthcare batch additions (all optional: the STEM
  // batch's existing records predate these fields and are left as-is
  // rather than retroactively guessed at) — every one of these is
  // DISPLAY-ONLY CONTEXT for the student and their parent. None of them
  // are ever read by lib/matching.ts or used in a query filter; the only
  // hard filter remains minimumAge. See
  // supabase/add_biomedical_program_fields.sql's header for the full
  // reasoning. ----

  // Exact org language for the current status, shown next to the
  // AvailabilityBadge — e.g. "2026 canceled — check back December 2026
  // for 2027 status."
  availabilityNote?: string;
  programType?: ProgramType;
  compensation?: Compensation;
  // Free text, not a number — real costs here don't reduce to one value
  // ("$500 residential / $300 day / $250 for a different track").
  cost?: string;
  financialAidAvailable?: boolean;
  // Free text, not a second age column — e.g. "Completed 10th grade, at
  // least 15 by program start, incoming junior or senior." Where a
  // source's own pages genuinely conflict (Mayo Clinic states both
  // "15-18" and "15-17" on two different official pages), both values
  // are shown here honestly rather than picking one.
  eligibleGrades?: string;
  arizonaResidencyRequired?: boolean;
  parentalConsentRequired?: boolean;
  healthScreeningRequired?: boolean;
  backgroundCheckRequired?: boolean;
  // Clinical-exposure disclosure — only ever set true/false when an
  // official source explicitly says so; omitted (not_specified in the DB)
  // otherwise. Never inferred from "sounds like a hospital program."
  directPatientContact?: boolean;
  researchComponent?: boolean;
  shadowingComponent?: boolean;
  applicationOpenDate?: string; // YYYY-MM-DD
  timeCommitment?: string;
  // Display-only finer sub-taxonomy — deliberately separate from
  // interestsTags, which profiles.interests is hard-constrained to (8
  // canonical values) and is what actually drives interest-fit scoring.
  programFocusTags?: string[];
  // Omitted (the default) means "approved" — every pre-existing record
  // in this file predates review gating and was hand-verified before
  // being added, so it publishes immediately per this file's own header.
  // Set explicitly to "pending" only for a record discovered during an
  // unattended/autonomous session, per that session's own policy of
  // never self-approving what it just found — a later human review pass
  // is what should flip it to "approved".
  reviewStatus?: "pending" | "approved";
};

export type ManualOrgRecord = {
  slug: string; // used for ingestion_runs "manual:<slug>" tagging and re-run idempotency
  name: string;
  description: string;
  websiteUrl: string;
  city: string | null; // display text only — organizations has no lat/long, no geocoding implied
  contactEmail: string | null;
  // Empty = a pure directory record (see ARCHITECTURE.md) — the
  // organization exists for /organizations and its own detail page, but
  // has no opportunities row at all, so it structurally cannot appear in
  // ranked matching (there's nothing there to rank).
  opportunities: ManualOpportunity[];
};

export const MANUAL_RECORDS: ManualOrgRecord[] = [
  {
    slug: "arizona-museum-of-natural-history",
    name: "Arizona Museum of Natural History",
    description:
      "City of Mesa-operated natural history museum. Volunteer roles support exhibits, educational programs, and events, but the museum's volunteer application system requires a login to view or apply — no individual roles are publicly listed.",
    websiteUrl: "https://azmnh.org/volunteer",
    city: "Mesa, AZ",
    contactEmail: null, // TJ.Gaudelli@MesaAZ.gov surfaced only via a search-cache snippet, not a live-fetched page — not used per the "no cached snippets as sole basis" rule
    opportunities: [], // BetterImpact portal is login-gated with zero visible listings — directory only, no opportunity row
  },
  {
    slug: "museum-of-northern-arizona",
    name: "Museum of Northern Arizona",
    description:
      "Natural and cultural history museum in Flagstaff. Runs a Junior Docents program for middle- and high-school students who lead short demonstrations and hands-on activities for museum visitors.",
    websiteUrl: "https://musnaz.org/volunteers/",
    city: "Flagstaff, AZ",
    contactEmail: "aswann@musnaz.org",
    opportunities: [
      {
        title: "Junior Docents",
        description:
          "Junior Docents are trained to lead short demonstrations and hands-on activities for museum visitors. Open to middle-school and high-school students with reliable transportation, available some weekends and Thursday evenings. No specific application window is published — express interest by emailing the museum's volunteer coordinator directly.",
        location: "Museum of Northern Arizona, 3101 N Fort Valley Rd, Flagstaff, AZ 86001",
        zip: "86001",
        geocodeCity: "Flagstaff, AZ",
        // No specific numeric age/grade cutoff published ("middle-school
        // and high-school students") — the platform's own profile floor
        // (13) already covers this without inventing a higher number.
        minimumAge: 13,
        applicationUrl: "mailto:aswann@musnaz.org",
        applicationDeadline: null,
        // No application window is published — rolling/contact-based,
        // marked seasonal per your explicit decision rather than assumed
        // continuously open.
        availabilityStatus: "seasonal",
        externalIdSuffix: "junior-docents",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
      },
    ],
  },
  {
    slug: "pima-county-public-library",
    name: "Pima County Public Library",
    description:
      "Tucson-area public library system. Runs a Teen Volunteer Program (in-person, ages 14-17) and a Library Virtual Volunteer program (remote, ages 14-18); applicants are contacted by the library if a placement is available at their preferred branch.",
    websiteUrl: "https://library.pima.gov/youth-volunteer-opportunities/",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen & Virtual Volunteer Program",
        description:
          "Pima County Public Library's Teen Volunteer Program (in-person, ages 14-17) and Library Virtual Volunteer program (remote, ages 14-18) place volunteers at branches based on current need. Applicants submit a PDF application to their preferred branch and are contacted only if an opportunity is available there — placement isn't guaranteed. Browse individual branches at library.pima.gov/locations/.",
        location: "Pima County Public Library — Main Library, 101 N. Stone Ave., Tucson, AZ 85701",
        zip: "85701",
        geocodeCity: "Tucson, AZ",
        minimumAge: 14,
        applicationUrl: "https://library.pima.gov/youth-volunteer-opportunities/",
        applicationDeadline: null,
        // The library's own language is explicitly contingent ("You will
        // be contacted... if there are volunteer opportunities
        // available") — not a confirmed-open placement.
        availabilityStatus: "unverified",
        externalIdSuffix: "teen-virtual-volunteer-program",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
      },
    ],
  },
  {
    slug: "sarsef",
    name: "SARSEF",
    description:
      "Tucson-based STEM education nonprofit. Runs Arizona STEM Adventure, a one-day annual STEM exploration event for K-8 students, staffed by volunteers.",
    websiteUrl: "https://sarsef.org/programs/stem-exploration/arizona-stem-adventure/",
    city: "Tucson, AZ",
    contactEmail: "dani@sarsef.org",
    opportunities: [
      {
        // Confirmed genuinely distinct from Exhibitors below: different
        // responsibilities, different position counts, separate
        // registration links.
        title: "Arizona STEM Adventure — Event Staff",
        description:
          "General event volunteers guiding students through booths and activities at Arizona STEM Adventure, SARSEF's annual one-day STEM exploration event. 80 positions across multiple shifts.",
        location: "Pima Community College Northwest Campus, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 13, // not stated by the source
        applicationUrl: "https://sarsef.org/programs/stem-exploration/arizona-stem-adventure/",
        applicationDeadline: "2026-11-20", // the event's own date — after which signing up is moot
        availabilityStatus: "open",
        externalIdSuffix: "arizona-stem-adventure-event-staff",
        category: "STEM",
        interestsTags: ["stem", "education"],
        commitmentType: "one_time",
      },
      {
        title: "Arizona STEM Adventure — Exhibitors",
        description:
          "STEM professionals who bring their own lesson or activity to present at Arizona STEM Adventure, SARSEF's annual one-day STEM exploration event. 63 positions, single shift (8:00 AM-1:30 PM).",
        location: "Pima Community College Northwest Campus, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 13,
        applicationUrl: "https://sarsef.org/programs/stem-exploration/arizona-stem-adventure/",
        applicationDeadline: "2026-11-20",
        availabilityStatus: "open",
        externalIdSuffix: "arizona-stem-adventure-exhibitors",
        category: "STEM",
        interestsTags: ["stem", "education"],
        commitmentType: "one_time",
      },
    ],
  },
  {
    slug: "junior-achievement-of-arizona",
    name: "Junior Achievement of Arizona",
    description:
      "Statewide nonprofit teaching financial literacy, career readiness, and entrepreneurship to Arizona students via volunteer mentors, including the JA STEM Summit for middle/high schoolers. Volunteering here means adults mentoring students, not students volunteering.",
    websiteUrl: "https://jaaz.org",
    city: "Tempe, AZ",
    contactEmail: "info@jaaz.org",
    opportunities: [
      {
        title: "General Volunteer Interest (JA STEM Summit inquiries welcome)",
        description:
          "Junior Achievement of Arizona's real volunteer-interest intake form — not specific to the JA STEM Summit, since that program has no dedicated sign-up link of its own and points back to this general form. JA's volunteer model is adults mentoring students (financial literacy, career readiness, entrepreneurship, and STEM programming), so this is better suited to an adult or young-adult volunteer than a high-school student looking to volunteer directly, though the form itself states no explicit age floor.",
        location: "Junior Achievement of Arizona, 636 W Southern Ave, Tempe, AZ 85282",
        zip: "85282",
        geocodeCity: "Tempe, AZ",
        minimumAge: 13, // no explicit age floor published on the intake form itself
        applicationUrl: "https://jaaz.org/our-volunteers/new-volunteers/",
        applicationDeadline: null,
        // Real intake form exists, but it's general JA volunteering, not
        // a guaranteed or STEM-Summit-specific placement.
        availabilityStatus: "unverified",
        externalIdSuffix: "general-volunteer-interest",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
      },
    ],
  },
  {
    slug: "arizona-community-science-alliance",
    name: "Arizona Community Science Alliance (ADEQ)",
    description:
      "A joint ADEQ/ASU community water-quality monitoring program (LABraries — equipment-lending hubs for groundwater monitoring). The program's own azdeq.gov pages are blocked to automated access site-wide; the only accessible official source found is ASU's own description page, which has no volunteer contact or application pathway published.",
    websiteUrl: "https://azwaterinnovation.asu.edu/empowering-communities-conduct-water-monitoring-labraries",
    city: "Arizona (multiple sites — currently Patagonia; Bouse, Salome, and Flagstaff planned)",
    contactEmail: null,
    // Inactive/review record only, per your rule: no accessible official
    // source verifies a volunteer pathway, so no opportunity row exists —
    // this is an org-level citation only, not something to represent as
    // an active or even contact-only opportunity.
    opportunities: [],
  },
  {
    slug: "arizona-4h-stem-ambassador",
    name: "University of Arizona Cooperative Extension — 4-H STEM Ambassador Project",
    description:
      "Statewide 4-H program (University of Arizona Cooperative Extension) training teen ambassadors to deliver STEM workshops in their own Arizona county or tribal nation, via a mix of virtual training and in-person delivery.",
    websiteUrl:
      "https://extension.arizona.edu/programs/4-h/state-4-h-programs/stem-youniversity/stem-ambassador",
    city: "Tucson, AZ", // program administration; the ambassador role itself is delivered in the applicant's own county, statewide
    contactEmail: "gabrielsonv@arizona.edu",
    opportunities: [
      {
        title: "4-H STEM Ambassador",
        description:
          "Trains teen ambassadors to deliver STEM workshops for youth and community members in their own Arizona county or tribal nation, through a mix of virtual training workshops and in-person delivery. Application-based, not guaranteed acceptance. Official eligibility sources genuinely conflict (grades 8-12 on one page, ages 14-18 on another) — 14 is used here as the more specific, numeric statement.",
        location: "Statewide (Arizona counties and tribal nations) — administered from Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 14,
        applicationUrl: "mailto:gabrielsonv@arizona.edu",
        applicationDeadline: null,
        // No current application window published anywhere found.
        availabilityStatus: "seasonal",
        externalIdSuffix: "stem-ambassador",
        category: "STEM",
        interestsTags: ["stem", "education"],
        commitmentType: "recurring",
      },
    ],
  },
  {
    slug: "arizona-mesa",
    name: "Arizona MESA",
    description:
      "University of Arizona STEM outreach program (Mathematics, Engineering, Science Achievement) for grades 6-12, running since 1984. Curates a directory of external STEM programs (UA Summer Engineering Academy, TGen, ASU Access programs, Med-Start, and others) rather than running its own opportunity listings — see its own resources page to discover the original programs directly.",
    websiteUrl: "https://azmesa.arizona.edu/stem-opportunities",
    city: "Tucson, AZ",
    contactEmail: null,
    // Discovery-only: MESA's linked programs are each a separate
    // organization's own opportunity, not MESA's to claim — see
    // ARCHITECTURE.md. Evaluating and importing any of those 12 linked
    // programs individually is explicitly out of scope for this pass.
    opportunities: [],
  },
  {
    slug: "future-stars-az",
    name: "Future Stars AZ",
    description:
      "Phoenix-based nonprofit providing STEM education and mentorship for inner-city youth, founded 2008. Has a real volunteer application (a Google Form plus a full onboarding document set), but no public street address is published anywhere on the organization's site.",
    websiteUrl: "https://futurestarsaz.org",
    city: null, // deliberately unset — see the opportunity below
    contactEmail: "volunteer@futurestarsaz.org",
    opportunities: [
      {
        title: "Volunteer with Future Stars AZ",
        description:
          "Future Stars AZ provides STEM education and mentorship for inner-city youth in the Phoenix area via community-center partnerships. A real volunteer application exists (application form plus emergency info, referral form, agreement, liability waiver, and background-check paperwork), but the organization publishes only a PO Box, no street address, and gives no explicit signal of current recruitment status.",
        location: null, // no real service address published — do not show a fabricated one
        // Deliberately not geocoded at all: the only published address is
        // a PO Box, and geocoding a mailing box would put this
        // opportunity at a fake physical location for distance
        // calculations. No zip/city means no coordinates, which means
        // this opportunity can never enter distance-filtered matching —
        // it's only ever reachable from the organization's own page.
        zip: null,
        geocodeCity: null,
        minimumAge: 13, // not stated
        applicationUrl: "https://futurestarsaz.org/volunteer/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        externalIdSuffix: "volunteer",
        category: "STEM",
        interestsTags: ["stem", "education"],
        commitmentType: "recurring",
      },
    ],
  },
  {
    slug: "arizona-science-bowl",
    name: "Arizona Science Bowl (Maricopa Institute of Technology)",
    description:
      "The Arizona regional of the U.S. Department of Energy's National Science Bowl — a student STEM trivia competition, not a volunteer opportunity. Hosted by Maricopa Institute of Technology; the next High School Regional is scheduled for January 30, 2027, with team registration opening October 5, 2026. No Arizona-specific volunteer/judge recruitment call has been published — the event organizer can be contacted directly about judging or volunteering, but this is not a confirmed open volunteer role.",
    websiteUrl:
      "https://science.osti.gov/wdts/nsb/Regional-Competitions/High-School-Regionals/AZ_Maricopa-Institute-of-Technology-High-School-Regional-Science-Bowl",
    city: "Phoenix, AZ",
    contactEmail: null, // No public organizational contact email available — see websiteUrl above for the official event page
    // This is a student competition, not volunteer service — per your
    // explicit instruction, competing is never represented as an
    // opportunity here. No confirmed volunteer/judge call exists to
    // represent either, so this stays a pure informational directory
    // record with no opportunity row.
    opportunities: [],
  },

  // ==========================================================================
  // Arizona biomedical/healthcare/premed batch. Every fact below was
  // verified against a live, first-party official page (several needed a
  // real headless-browser fetch to get past bot-detection that a plain
  // fetch() hit — Mayo Clinic, both Banner properties, Red Cross, and
  // TGen all initially looked blocked but weren't). Hospital street
  // addresses used for geocoding below (Thompson Peak, Deer Valley, Mayo
  // Scottsdale, Banner Desert, Banner-UMC Phoenix, Phoenix Children's, St.
  // Joseph's/Barrow) are each institution's well-documented public
  // address, not something asserted by the specific program page fetched
  // — used only as a representative point for distance calculation, same
  // convention as every multi-facility program in the STEM batch.
  // ==========================================================================

  {
    slug: "honorhealth",
    name: "HonorHealth",
    description:
      "Scottsdale/Phoenix-area nonprofit hospital system running three distinct high-school programs: a seven-week Summer Volunteer Program, and two Explorer Clubs (Medical and Nursing) — hands-on career-exploration clubs, structurally separate from hospital volunteering.",
    websiteUrl: "https://www.honorhealth.com/community/volunteer-opportunities/teen",
    city: "Scottsdale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer High School Volunteer Program",
        description:
          "A seven-week hospital volunteer program (June-mid-July) at HonorHealth's Thompson Peak, Deer Valley, and John C. Lincoln Medical Centers. Two 4-hour shifts per week (7am-4pm, Monday-Friday), minimum 6-week participation. High school volunteers are not permitted in patient rooms and the program does not include job shadowing, research, or internship experience — explicit on the official page.",
        location: "HonorHealth Thompson Peak / Deer Valley / John C. Lincoln Medical Centers",
        zip: "85255",
        geocodeCity: "Scottsdale, AZ",
        minimumAge: 15,
        applicationUrl: "https://www.honorhealth.com/community/volunteer-opportunities/teen",
        applicationDeadline: null,
        availabilityStatus: "closed",
        availabilityNote:
          "2026 applications are closed. 2027 applications open mid-January 2027 (exact date not yet published).",
        externalIdSuffix: "summer-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades:
          "Incoming junior or senior; must have completed 10th grade; at least 15 by program start; Arizona residency required; current seniors not eligible.",
        arizonaResidencyRequired: true,
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Two 4-hour shifts/week, 7am-4pm Mon-Fri, minimum 6 of 7 weeks",
        programFocusTags: ["hospital_volunteering"],
      },
      {
        title: "Medical Explorers Club",
        description:
          "A career-exploration club at HonorHealth's Thompson Peak, Deer Valley, and Center of Clinical Excellence facilities — monthly meetings, hands-on events, and professional interactions with medical staff. Structurally separate from hospital volunteering; does not include job shadowing, research, or internship experience, and volunteers are not permitted in patient rooms.",
        location: "HonorHealth Thompson Peak / Deer Valley Medical Centers / Center of Clinical Excellence",
        zip: "85255",
        geocodeCity: "Scottsdale, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.honorhealth.com/community/volunteer-opportunities/teen",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "2026-27 academic year application is currently closed — check availability.",
        externalIdSuffix: "medical-explorers-club",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "club",
        compensation: "unpaid",
        eligibleGrades: "Grades 9-12",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Monthly meetings",
        programFocusTags: ["healthcare_club", "premed"],
      },
      {
        title: "Nursing Explorers Club",
        description:
          "A career-exploration club at HonorHealth's Center of Clinical Excellence — monthly meetings, hands-on events, and professional interactions with nursing staff. Structurally separate from hospital volunteering; does not include job shadowing, research, or internship experience, and volunteers are not permitted in patient rooms.",
        location: "HonorHealth Center of Clinical Excellence",
        zip: "85255",
        geocodeCity: "Scottsdale, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.honorhealth.com/community/volunteer-opportunities/teen",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "2026-27 academic year application is currently closed — check availability.",
        externalIdSuffix: "nursing-explorers-club",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "club",
        compensation: "unpaid",
        eligibleGrades: "Grades 9-12",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Monthly meetings",
        programFocusTags: ["healthcare_club", "premed"],
      },
    ],
  },

  {
    slug: "mayo-clinic-arizona",
    name: "Mayo Clinic Arizona",
    description:
      "Mayo Clinic's Phoenix/Scottsdale campuses run a High School Student Summer Volunteer Program each June-July when offered — service assignments supporting patient care, without clinical shadowing.",
    websiteUrl:
      "https://www.mayoclinic.org/about-mayo-clinic/volunteers/arizona/high-school-volunteer-summer-program",
    city: "Scottsdale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "High School Student Summer Volunteer Program",
        description:
          "Mayo Clinic Arizona's summer volunteer program for high schoolers, at the Phoenix or Scottsdale campus. Volunteers serve one 4-hour shift/week (max 12 hours/week) in service assignments involving both patient and non-patient interactions. Clinical shadowing is explicitly not part of the program. Requires a signed application (student and parent/guardian), current immunization records, and an Occupational Health screening visit (TB test, at Mayo's expense). Note: Mayo's own pages state the eligibility and duration inconsistently — the program page says ages 15-18 and a nine-week program (June 1-July 31), while the separate Requirements page says ages 15-17 and an eight-week program. Both are shown here rather than picking one.",
        location: "Mayo Clinic Arizona — Phoenix or Scottsdale campus",
        zip: "85259",
        geocodeCity: "Scottsdale, AZ",
        // Both of Mayo's own pages agree on 15 as the floor; the
        // discrepancy is only in the upper bound (17 vs 18) and program
        // length (8 vs 9 weeks) — see the description above.
        minimumAge: 15,
        applicationUrl:
          "https://www.mayoclinic.org/about-mayo-clinic/volunteers/arizona/high-school-volunteer-summer-program",
        applicationDeadline: null,
        availabilityStatus: "closed",
        availabilityNote: "2026 program canceled. Mayo's own page instructs checking back in December 2026 for 2027 status — not yet confirmed.",
        externalIdSuffix: "high-school-summer-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades:
          "Program page: ages 15-18, nine-week program (June 1-July 31). Requirements page: ages 15-17, eight-week program. Not yet enrolled in college.",
        parentalConsentRequired: true,
        healthScreeningRequired: true,
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "One 4-hour shift/week (max 12 hours/week)",
        programFocusTags: ["hospital_volunteering"],
      },
    ],
  },

  {
    slug: "banner-desert-medical-center",
    name: "Banner Desert Medical Center / Banner Children's at Desert",
    description:
      "Mesa hospital campus with separate Teen and Summer Student volunteer application pathways, alongside its general adult volunteer program. Health screening and background check required for all volunteers.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-desert-volunteer",
    city: "Mesa, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Application",
        description:
          "Banner Desert Medical Center and Banner Children's at Desert's teen volunteer pathway. Volunteers are needed across many hospital areas (administrative offices, courtesy shuttles, dietary, dog therapy, emergency department, family lobbies, gift shop, information desks, nursing units, surgery, volunteer office) — listed as areas volunteers may be placed, not guaranteed assignments or an indication of clinical duties. Process: apply and interview, health screening and background check, volunteer orientation. The page states a general minimum commitment of six months or 100 hours.",
        location: "Banner Desert Medical Center, 1400 S Dobson Rd, Mesa, AZ 85202",
        zip: "85202",
        geocodeCity: "Mesa, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.bannerhealth.com/services/volunteer/banner-desert-volunteer",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "No specific minimum age published for the Teen pathway specifically.",
        externalIdSuffix: "teen-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Not specified for the Teen Application pathway specifically.",
        healthScreeningRequired: true,
        backgroundCheckRequired: true,
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Minimum six months or 100 hours (general policy, as stated on the page)",
        programFocusTags: ["hospital_volunteering"],
      },
      {
        title: "Summer Student Application",
        description:
          "Banner Desert Medical Center and Banner Children's at Desert's summer-specific student volunteer pathway — summer applications are only accepted January through March. Same general volunteer areas and process (health screening, background check, orientation) as the standing Teen Application.",
        location: "Banner Desert Medical Center, 1400 S Dobson Rd, Mesa, AZ 85202",
        zip: "85202",
        geocodeCity: "Mesa, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.bannerhealth.com/services/volunteer/banner-desert-volunteer",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Summer applications accepted January-March only.",
        externalIdSuffix: "summer-student-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "one_time",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Not specified for the Summer Student pathway specifically.",
        healthScreeningRequired: true,
        backgroundCheckRequired: true,
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        programFocusTags: ["hospital_volunteering"],
      },
    ],
  },

  {
    slug: "banner-university-medical-center-phoenix",
    name: "Banner - University Medical Center Phoenix",
    description:
      "Phoenix teaching hospital. Its Teen Volunteer Program is currently paused due to a high volume of applicants — the org's own page states it will reopen once space is available.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-university-phoenix-volunteer",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description:
          "Banner - University Medical Center Phoenix's Teen Volunteer Program. The official page states, verbatim: \"Due to an overwhelming number of teen applicants this year, our Teen Volunteer Program is currently on hold. We're excited by the interest and will reopen applications once space becomes available.\" This program is currently paused — the adult volunteer application is a separate pathway for adults only and is not a substitute for the teen program.",
        location: "Banner - University Medical Center Phoenix, 1111 E McDowell Rd, Phoenix, AZ 85006",
        zip: "85006",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.bannerhealth.com/services/volunteer/banner-university-phoenix-volunteer",
        applicationDeadline: null,
        availabilityStatus: "paused",
        availabilityNote: "On hold due to a high volume of teen applicants. No reopen date published.",
        externalIdSuffix: "teen-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Not specified for the teen pathway (adult pathway requires 18+, a separate program).",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        programFocusTags: ["hospital_volunteering"],
      },
    ],
  },

  {
    slug: "phoenix-childrens-hospital",
    name: "Phoenix Children's",
    description:
      "Phoenix pediatric hospital system with two teen-eligible volunteer pathways — independent hospital volunteering (16+) and a Family Volunteer Program pairing a parent/guardian with a 13-17-year-old teen — both currently unavailable to new applicants.",
    websiteUrl: "https://phoenixchildrens.org/about-us/ways-help/volunteering",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Independent Hospital Volunteer Program",
        description:
          "Phoenix Children's independent hospital volunteer program, generally open to ages 16 and up. The official FAQ currently states, verbatim: \"we are not currently accepting volunteer applications for individuals 17 years old and younger.\" No specific campus is named — this is an org-wide program. Check back for updates on when applications for this age group reopen.",
        location: "Phoenix Children's",
        zip: "85016",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 16,
        applicationUrl: "https://phoenixchildrens.org/about-us/ways-help/volunteering",
        applicationDeadline: null,
        availabilityStatus: "closed",
        availabilityNote: "Not currently accepting applications from individuals 17 and younger. Eligibility does not guarantee an opening once reopened.",
        externalIdSuffix: "independent-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "16+ generally; currently closed to everyone 17 and under regardless.",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        programFocusTags: ["hospital_volunteering", "patient_family_support"],
      },
      {
        title: "Family Volunteer Program",
        description:
          "Phoenix Children's Family Volunteer Program pairs a parent or guardian with their 13-17-year-old teen to volunteer together. The official FAQ states this program is currently waitlisted. No specific campus is named.",
        location: "Phoenix Children's",
        zip: "85016",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://phoenixchildrens.org/about-us/ways-help/volunteering",
        applicationDeadline: null,
        availabilityStatus: "waitlisted",
        availabilityNote: "Waitlisted. Requires a parent or guardian to volunteer alongside the teen. Eligibility does not guarantee an opening.",
        externalIdSuffix: "family-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17, with a parent or guardian volunteering alongside.",
        parentalConsentRequired: true,
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        programFocusTags: ["hospital_volunteering", "patient_family_support"],
      },
    ],
  },

  {
    slug: "dignity-health-st-josephs",
    name: "Dignity Health St. Joseph's Hospital and Medical Center",
    description:
      "Phoenix hospital running a Summer Junior Volunteer Program with potential (not guaranteed) placements in areas like transportation, IT, the information desk, and administrative support.",
    websiteUrl:
      "https://www.dignityhealth.org/arizona/locations/stjosephs/ways-to-give/volunteer-information",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer Junior Volunteer Program",
        description:
          "St. Joseph's Hospital and Medical Center's Summer Junior Volunteer Program for teenagers. The official page states junior volunteers work in \"many areas including\" transportation, information technology, the copy center, the information desk, and other areas as needed — these are described as possible placement areas, not guaranteed roles, and no direct patient care is claimed. Applications are currently closed.",
        location: "St. Joseph's Hospital and Medical Center, 350 W Thomas Rd, Phoenix, AZ 85013",
        zip: "85013",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl:
          "https://www.dignityhealth.org/arizona/locations/stjosephs/ways-to-give/volunteer-information",
        applicationDeadline: null,
        availabilityStatus: "closed",
        availabilityNote: "Applications are currently closed. Check back for future updates.",
        externalIdSuffix: "summer-junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Described generally as \"teenagers\" — no specific numeric age published.",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        programFocusTags: ["hospital_volunteering"],
      },
    ],
  },

  {
    slug: "hospice-of-the-valley",
    name: "Hospice of the Valley",
    description:
      "Maricopa County hospice organization running two distinct teen programs: general Teen Volunteering (patient/family support) and Teens in Nursing (healthcare education plus service, not professional nursing training).",
    websiteUrl: "https://hov.org/volunteer/teen-volunteering/",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteering",
        description:
          "Hospice of the Valley's general teen volunteer program at inpatient care homes across Maricopa County, northern Pinal County, and the Tucson area — the specific location is supplied at placement, not a single address. Volunteers spend about two hours per week building a personal connection with a patient (sharing stories, reading, visiting). Requires a one-day orientation. This is patient and family support, not clinical training.",
        location: "Maricopa County, AZ (specific care home supplied at placement)",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://pm.healthcaresource.com/CS/hovvolunteer#/job/6",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteering",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "High school student residing in Maricopa County; no specific numeric age published.",
        directPatientContact: true,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "About two hours per week",
        programFocusTags: ["hospice_volunteering", "patient_family_support"],
      },
      {
        title: "Teens in Nursing",
        description:
          "Hospice of the Valley's Teens in Nursing program, for students interested in becoming a registered nurse or CNA — 9 hours of initial training plus CNA-exam preparation, 8 monthly meetings, and about 4 hours per week during the school year, providing patient care under CNA supervision. This is healthcare education plus service, not professional nursing training or certification.",
        location: "Maricopa County, AZ (specific care home supplied at placement)",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://hov.org/volunteer/teens-in-nursing/",
        applicationDeadline: null,
        availabilityStatus: "closed",
        availabilityNote: "Applications closed. Reopening July 2027 (exact date not yet published).",
        externalIdSuffix: "teens-in-nursing",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Interested in becoming a registered nurse or CNA; no specific numeric age published.",
        directPatientContact: true,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "9 hours initial training, 8 monthly meetings, ~4 hours/week during the school year",
        programFocusTags: ["hospice_volunteering", "healthcare_education"],
      },
    ],
  },

  {
    slug: "american-red-cross-az-nm",
    name: "American Red Cross — Arizona and New Mexico Region",
    description:
      "Regional chapter of the American Red Cross. School-based Red Cross Clubs let middle/high school/college students lead service projects (blood drives, fundraisers, preparedness education) — a standing leadership structure, not an individual volunteer shift. Individual opportunities (blood-services support, disaster relief, community health) are found through the Red Cross's own national Volunteer Connection search, not imported here.",
    websiteUrl: "https://www.redcross.org/local/az-nm/volunteer/youth-services.html",
    city: "Phoenix, AZ",
    contactEmail: "AZNM@redcross.org",
    opportunities: [
      {
        title: "Red Cross Club",
        description:
          "A school-based leadership opportunity, not an individual volunteer shift: Red Cross Clubs are officially recognized organizations on school campuses, led by middle school, high school, or college students, running service projects and leadership training throughout the school year in partnership with their local Red Cross chapter. All youth and young-adult volunteers must register online, and anyone under 18 needs parent or guardian consent before starting. Blood-services volunteering through the Red Cross does not provide clinical experience.",
        location: "Arizona and New Mexico Region",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "mailto:AZNM@redcross.org",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Standing school-based program — join an existing club or contact the region to start one.",
        externalIdSuffix: "red-cross-club",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "club",
        compensation: "unpaid",
        eligibleGrades: "Middle school, high school, or college students. Parental/guardian consent required if under 18.",
        parentalConsentRequired: true,
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        programFocusTags: ["community_health_volunteering", "blood_services", "health_education_advocacy"],
      },
    ],
  },

  {
    slug: "barrow-neurological-institute",
    name: "Barrow Neurological Institute",
    description:
      "Phoenix neuroscience research institute running a selective Summer High School Internship Program (biomedical research, not hospital volunteering) and a separate, contact-only Research Volunteer pathway for students who reach out to individual lab mentors directly.",
    websiteUrl:
      "https://www.barrowneuro.org/for-physicians-researchers/research/training-programs/high-school-research-program/",
    city: "Phoenix, AZ",
    contactEmail: "Karis.Miller@BarrowNeuro.org",
    opportunities: [
      {
        title: "Summer High School Internship Program",
        description:
          "Barrow Neurological Institute's Summer High School Internship Program — neuroscience/biomedical research, not hospital volunteering. Applicants (not yet interns until selected) work with TGen-style hands-on lab work, or non-lab tracks in marketing, publications, medical illustration, VR, or philanthropy. Requires one professional letter of recommendation and a one-page letter of intent; transcripts are explicitly not required. The official page states not all applicants will be accepted — submission does not guarantee placement.",
        location: "Barrow Neurological Institute, 350 W Thomas Rd, Phoenix, AZ 85013",
        zip: "85013",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 16,
        applicationUrl:
          "https://www.barrowneuro.org/for-physicians-researchers/research/training-programs/high-school-research-program/",
        applicationDeadline: "2027-02-12",
        applicationOpenDate: "2027-01-04",
        availabilityStatus: "seasonal",
        availabilityNote: "2027 cycle: applications open January 4, 2027, deadline February 12, 2027. Program runs June 7-July 8, 2027.",
        externalIdSuffix: "summer-high-school-internship",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "one_time",
        programType: "internship",
        compensation: "not_specified",
        eligibleGrades: "At least 16 years old by the start of the program.",
        researchComponent: true,
        timeCommitment: "5-week program, June 7-July 8, 2027",
        programFocusTags: ["biomedical_research", "neuroscience", "translational_science"],
      },
      {
        title: "Research Volunteer Opportunities",
        description:
          "Barrow Neurological Institute's year-round research volunteer pathway — not a hospital volunteer role. The institute is not taking a general application: students identify a lab of interest and contact the mentor directly with a resume/CV, then complete credentialing (up to 30 days) after securing a verbal commitment. Requires a background check and drug screening if 18 or older.",
        location: "Barrow Neurological Institute, 350 W Thomas Rd, Phoenix, AZ 85013",
        zip: "85013",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 16,
        applicationUrl:
          "https://www.barrowneuro.org/for-physicians-researchers/research/training-programs/research-volunteer-opportunities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "No general application — contact an individual lab's mentor directly to be considered.",
        externalIdSuffix: "research-volunteer-opportunities",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "16+; background check and drug screening required if 18 or older.",
        backgroundCheckRequired: true,
        researchComponent: true,
        programFocusTags: ["biomedical_research", "neuroscience"],
      },
    ],
  },

  {
    slug: "tgen",
    name: "TGen (Translational Genomics Research Institute)",
    description:
      "Phoenix biomedical research institute running the TGen Bioscience Leadership Academy, a two-week summer program for 20 Arizona high schoolers exploring biosciences, precision medicine, and lab skills — an education/career-exploration program, not volunteering.",
    websiteUrl: "https://www.tgen.org/education/tgen-bioscience-leadership-academy/",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "TGen Bioscience Leadership Academy",
        description:
          "A two-week bioscience program serving 20 Arizona high school students each summer. TGen scientists and staff share research expertise and expose students to technical skill basics, lab shadowing, clinical trials, bioethics, experimental design, the clinical application of genomic medicine, and topics in neurological disease, cancer, diabetes, and infectious disease, plus a leadership component (science communication, public speaking, teamwork, networking). Each graduate receives a $1,000 scholarship. Students with a high school diploma from an Arizona school by the program start are eligible for Helios Scholars at TGen instead — Helios is a college-level program and is not appropriate for high-school applicants to this record.",
        location: "TGen, 445 N. Fifth Street, Phoenix, AZ 85004",
        zip: "85004",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.tgen.org/education/tgen-bioscience-leadership-academy/",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote:
          "2027 applications not yet open. TGen's own page offers an email sign-up for a December notification when applications open — link directly to TGen's page for that, no separate notify-me mechanism needed here.",
        externalIdSuffix: "bioscience-leadership-academy",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "one_time",
        programType: "career_exploration_program",
        compensation: "not_specified",
        eligibleGrades: "At least 16 by the start of the program; rising junior or senior at an Arizona high school.",
        arizonaResidencyRequired: true,
        cost: "Free; graduates receive a $1,000 completion scholarship.",
        researchComponent: true,
        shadowingComponent: true,
        timeCommitment: "Two-week summer program",
        programFocusTags: ["biomedical_research", "precision_medicine", "genetics", "bioscience_summer_program"],
      },
    ],
  },

  {
    slug: "ua-college-of-medicine-phoenix",
    name: "University of Arizona College of Medicine - Phoenix",
    description:
      "Phoenix medical school running high-school health-career-exploration programs — Summer Scrubs (three seasonal tracks with real cost and need-based aid) and Saturday Scrubs (a recurring monthly series). Health-career exploration, not volunteering; simulated skills training, not actual clinical practice.",
    websiteUrl: "https://phoenixmed.arizona.edu/health-care-advancement/high-school-programs",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer Scrubs — Explore Medicine (Residential)",
        description:
          "A residential health-career-exploration program for rising seniors (current 11th graders), including room, board, and transportation. 2026 cycle: applications December 1, 2025-March 1, 2026; program May 31-June 6, 2026 — this cycle has already closed; 2027 dates are not yet published and these 2026 dates should not be reused as current. Need-based financial aid is available through Central Arizona AHEC.",
        location: "University of Arizona College of Medicine - Phoenix, 475 N. 5th St., Phoenix, AZ 85004",
        zip: "85004",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://phoenixmed.arizona.edu/summerscrubs",
        applicationDeadline: "2026-03-01",
        applicationOpenDate: "2025-12-01",
        availabilityStatus: "closed",
        availabilityNote: "2026 cycle closed (application window and program dates have both passed). 2027 dates not yet published.",
        externalIdSuffix: "summer-scrubs-explore-medicine-residential",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "one_time",
        programType: "career_exploration_program",
        compensation: "tuition_based",
        cost: "$500 (includes room, board, and transportation)",
        financialAidAvailable: true,
        eligibleGrades: "Rising senior (current 11th grader)",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Residential program, May 31-June 6, 2026 (2026 cycle)",
        programFocusTags: ["medical_career_exploration", "anatomy", "premed"],
      },
      {
        title: "Summer Scrubs — Explore Medicine (Day Camp)",
        description:
          "A day-camp version of Explore Medicine for rising seniors (current 11th graders), no residential component. 2026 cycle: applications December 1, 2025-March 1, 2026; program June 8-12, 2026 — this cycle has already closed; 2027 dates are not yet published. Need-based financial aid is available through Central Arizona AHEC.",
        location: "University of Arizona College of Medicine - Phoenix, 475 N. 5th St., Phoenix, AZ 85004",
        zip: "85004",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://phoenixmed.arizona.edu/summerscrubs",
        applicationDeadline: "2026-03-01",
        applicationOpenDate: "2025-12-01",
        availabilityStatus: "closed",
        availabilityNote: "2026 cycle closed (application window and program dates have both passed). 2027 dates not yet published.",
        externalIdSuffix: "summer-scrubs-explore-medicine-day",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "one_time",
        programType: "career_exploration_program",
        compensation: "tuition_based",
        cost: "$300",
        financialAidAvailable: true,
        eligibleGrades: "Rising senior (current 11th grader)",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Day camp, June 8-12, 2026 (2026 cycle)",
        programFocusTags: ["medical_career_exploration", "anatomy", "premed"],
      },
      {
        title: "Summer Scrubs — The Healthcare Team",
        description:
          "A health-career-exploration track for rising sophomores/juniors (current 9th/10th graders). 2026 cycle: applications December 1, 2025-March 1, 2026; program June 15-18, 2026 (no camp June 19, Juneteenth) — this cycle has already closed; 2027 dates are not yet published. Need-based financial aid is available through Central Arizona AHEC.",
        location: "University of Arizona College of Medicine - Phoenix, 475 N. 5th St., Phoenix, AZ 85004",
        zip: "85004",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://phoenixmed.arizona.edu/summerscrubs",
        applicationDeadline: "2026-03-01",
        applicationOpenDate: "2025-12-01",
        availabilityStatus: "closed",
        availabilityNote: "2026 cycle closed (application window and program dates have both passed). 2027 dates not yet published.",
        externalIdSuffix: "summer-scrubs-healthcare-team",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "one_time",
        programType: "career_exploration_program",
        compensation: "tuition_based",
        cost: "$250",
        financialAidAvailable: true,
        eligibleGrades: "Rising sophomore or junior (current 9th/10th grader)",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "June 15-18, 2026, no camp June 19 (2026 cycle)",
        programFocusTags: ["medical_career_exploration", "anatomy", "premed"],
      },
      {
        title: "Saturday Scrubs",
        description:
          "A monthly lecture and hands-on activity series for high schoolers interested in becoming a physician — pig heart dissection, vital-signs demonstrations, CPR certification, and suturing/intubation training. All activities are simulated skills training, not actual clinical practice or direct patient care.",
        location: "University of Arizona College of Medicine - Phoenix, 475 N. 5th St., Phoenix, AZ 85004",
        zip: "85004",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://phoenixmed.arizona.edu/scrubs",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "Current registration status and cost are not published on the official page.",
        externalIdSuffix: "saturday-scrubs",
        category: "STEM",
        interestsTags: ["stem", "healthcare"],
        commitmentType: "recurring",
        programType: "career_exploration_program",
        compensation: "not_specified",
        eligibleGrades: "High school students interested in becoming a physician; no specific grade/age published.",
        directPatientContact: false,
        researchComponent: false,
        shadowingComponent: false,
        timeCommitment: "Monthly lecture/activity series during the school year",
        programFocusTags: ["medical_career_exploration", "anatomy", "premed"],
      },
    ],
  },

  {
    slug: "arizona-burn-foundation",
    name: "Arizona Burn Foundation",
    description:
      "Phoenix healthcare-related nonprofit running Camp Courage (a camp for burn survivors, ages 6-19) and a Leaders-in-Training program for former campers. The organization's own volunteer pages are reachable but did not render usable content during research (a client-rendered page that didn't finish loading even with an extended wait) — kept as a directory record only, no opportunity rows, until a human can verify current program specifics directly.",
    websiteUrl: "https://www.azburn.org/get-involved/volunteer/",
    city: "Phoenix, AZ",
    contactEmail: null,
    // Directory-only: the org's volunteer page content couldn't be
    // confirmed live (client-rendered, didn't finish loading), and
    // per-role eligibility (e.g. Leaders-in-Training explicitly requires
    // having attended Camp Courage as a camper first — not open to any
    // unaccompanied minor) couldn't be verified well enough to represent
    // as a discrete opportunity without risking inaccuracy.
    opportunities: [],
  },

  // ---------------------------------------------------------------------
  // CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology batch.
  // Every record below uses only facts confirmed on a live, first-party
  // page as of the research date (2026-08-29) — see ARCHITECTURE.md's
  // third "Manual source integration" subsection for the full research
  // trail, source-by-source audit, and the taxonomy/ProgramType design
  // decisions this batch introduced (STEM_SUBTAG_OPTIONS,
  // ProgramType "competition"). Two sources from the same audit are
  // deliberately NOT represented here: ASU Fulton Summer Academy's own
  // Fulton Academy camps (nothing published yet — see its directory-only
  // entry below) and AZFirst's 5 competition/team pages (correctly
  // excluded — see its directory-only entry below; competition
  // participation is never labeled volunteering). Phoenix R.I.S.E. was
  // reviewed and explicitly deferred per an out-of-scope decision
  // (broad paid city employment, no published technical placements) —
  // not represented at all, not even as a directory record.
  // ---------------------------------------------------------------------

  {
    slug: "asu-fulton-summer-academy",
    name: "ASU Fulton Summer Academy",
    description:
      "Arizona State University's Fulton Schools of Engineering K-12 outreach umbrella, historically running individual engineering, computing, semiconductor, and robotics camps. As of this research date, the page states 2027 registration opens January 2027 — no individual camps, dates, or costs are published yet for the upcoming cycle. Kept as a directory record only; re-check in January 2027 rather than assuming past camps will repeat.",
    websiteUrl: "https://outreach.engineering.asu.edu/fulton-academy/",
    city: "Tempe, AZ",
    contactEmail: null,
    // Directory-only per the audit's explicit "monitor" recommendation:
    // no current camp content exists to curate, only a future promise —
    // creating an opportunity row here would mean fabricating dates.
    opportunities: [],
  },
  {
    slug: "asu-scai-summer-camps",
    name: "ASU School of Computing and Augmented Intelligence — Summer Camps",
    description:
      "Arizona State University's School of Computing and Augmented Intelligence runs two currently-published, individually dated summer camps at the Brickyard Engineering Building in Tempe: a Robotics Camp and a Game and AI Camp.",
    websiteUrl: "https://scai.engineering.asu.edu/summer-camps/",
    city: "Tempe, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Robotics Camp",
        description:
          "Two-track robotics camp: grades 7-8 cover Alice programming, EV3 robotics, and FLL-level competition; grades 9-12 cover advanced computing/robotics, Python, web programming, and phone app programming. \"Back on the schedule for Summer 26\" per the program's own page, implying it isn't offered every year.",
        location: "Brickyard Engineering Building, Room 222, 699 S Mill Ave, Tempe, AZ 85281",
        zip: "85281",
        geocodeCity: "Tempe, AZ",
        minimumAge: 13,
        applicationUrl: "https://venus.sod.asu.edu/roboticscamp/",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Summer 2026 session; registration open as of this research date.",
        externalIdSuffix: "robotics-camp",
        category: "STEM",
        interestsTags: ["stem", "robotics"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$900",
        eligibleGrades: "Grades 7-12 (two tracks: 7-8 and 9-12)",
        timeCommitment: "Mon-Fri, June 1-12, 2026, 8:15 AM-4:45 PM",
        programFocusTags: ["robotics_camp"],
      },
      {
        title: "Game and AI Camp",
        description:
          "GameMaker-based 2D game development combined with AI-generated assets (images, sound, music).",
        location: "Brickyard Engineering Building, Room M1-11 (Mezzanine), 699 S Mill Ave, Tempe, AZ 85281",
        zip: "85281",
        geocodeCity: "Tempe, AZ",
        minimumAge: 13,
        applicationUrl: "https://scai.engineering.asu.edu/summer-camps/",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Summer 2026 session; registration open as of this research date. Lunch not provided.",
        externalIdSuffix: "game-and-ai-camp",
        category: "STEM",
        interestsTags: ["stem", "artificial_intelligence", "computer_science"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$1000",
        eligibleGrades: "Grades 7-10",
        timeCommitment: "Mon-Fri, June 15-26, 2026, 9:00 AM-4:00 PM",
        programFocusTags: ["game_design", "artificial_intelligence"],
      },
    ],
  },
  {
    slug: "university-of-arizona-summer-engineering-academy",
    name: "University of Arizona Summer Engineering Academy",
    description:
      "UA College of Engineering's K-12 outreach program running 8 individually published camps in Tucson, spanning grades 5-12. Kept in the database despite being outside the Phoenix metro per explicit instruction: this app's existing distance hard-filter (lib/matching.ts) already controls relevance for Phoenix-area students without needing manual geographic exclusion.",
    websiteUrl: "https://engineering.arizona.edu/k12/k12_SEA",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Service through Engineering",
        description: "Engineering camp focused on community-service-oriented design projects.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 13,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        // The page itself self-contradicts on when registration opens
        // (see the org-level note below) — shown honestly rather than
        // silently reconciled, per this batch's established convention
        // for source pages with internal contradictions.
        availabilityNote:
          "SEA's page states registration opens January 2027 for these 2027 dates, but a separate FAQ section on the same page (likely stale/carried over) states registration opens March 2, 2026 through June 30, 2026 — both figures shown here as published, not reconciled. No per-camp price is published; only a page-wide $50 non-refundable registration fee.",
        externalIdSuffix: "service-through-engineering",
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 8th-11th grade",
        timeCommitment: "June 7-10, 2027",
        programFocusTags: ["community_engineering"],
      },
      {
        title: "Engineering Innovation and Exploration",
        description: "Residential engineering camp exploring innovation-focused design challenges.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 15,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note). Residential program — a real cost beyond the $50 registration fee is implied but not published per-camp.",
        externalIdSuffix: "engineering-innovation-exploration",
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 10th-11th grade",
        timeCommitment: "June 14-17, 2027 (residential)",
        programFocusTags: [],
      },
      {
        title: "Women in Engineering",
        description: "Residential and day-option camp introducing engineering disciplines to young women.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 13,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note).",
        externalIdSuffix: "women-in-engineering",
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 8th-11th grade",
        timeCommitment: "June 28-July 1, 2027 (residential or day option)",
        programFocusTags: ["women_in_stem"],
      },
      {
        title: "Semiconductors",
        description: "Engineering camp introducing semiconductor design and fabrication concepts.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 13,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note).",
        externalIdSuffix: "semiconductors",
        category: "STEM",
        interestsTags: ["stem", "semiconductor_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 8th-11th grade",
        timeCommitment: "July 5-8, 2027",
        programFocusTags: [],
      },
      {
        title: "Grand Challenges in Engineering",
        description: "Residential camp addressing large-scale engineering \"grand challenge\" problems.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 15,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note). Residential program — a real cost beyond the $50 registration fee is implied but not published per-camp.",
        externalIdSuffix: "grand-challenges-in-engineering",
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 10th-11th grade",
        timeCommitment: "July 12-15, 2027 (residential)",
        programFocusTags: [],
      },
      {
        title: "Disaster Response: Engineering in the Community",
        description: "Engineering camp focused on disaster-response design and community-engineering projects.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 13,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note).",
        externalIdSuffix: "disaster-response-engineering",
        category: "STEM",
        interestsTags: ["stem", "civil_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 8th-11th grade",
        timeCommitment: "July 19-22, 2027",
        programFocusTags: ["community_engineering"],
      },
      {
        title: "Semiconductors and the Workforce of Tomorrow",
        description: "Shorter-format program introducing semiconductor careers and workforce pathways.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 14,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note).",
        externalIdSuffix: "semiconductors-workforce-of-tomorrow",
        category: "STEM",
        interestsTags: ["stem", "semiconductor_engineering"],
        commitmentType: "one_time",
        programType: "career_exploration_program",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 9th-12th grade",
        timeCommitment: "March 17-19, 2027",
        programFocusTags: ["workforce_pathways"],
      },
      {
        title: "Summer Engineering Explorers",
        description: "Introductory engineering camp for younger students exploring core engineering concepts.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        // True published floor is grade 5 (roughly age 10) — set to this
        // platform's own minimum profile age (13) rather than the
        // program's real floor, since no ServeFinder student can be
        // younger than 13 regardless; eligibleGrades states the real
        // range so a 13-year-old rising 7th/8th grader can judge fit.
        minimumAge: 13,
        applicationUrl: "https://engineering.arizona.edu/k12/k12_SEA",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Same registration-date contradiction as this org's other camps (see Service through Engineering's note). Published for grades 5-7 — this platform's own minimum student age is 13, so realistically fits only students at the upper end of that range.",
        externalIdSuffix: "summer-engineering-explorers",
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "tuition_based",
        cost: "$50 non-refundable registration fee (full program cost not published per-camp)",
        eligibleGrades: "Current 5th-7th grade",
        timeCommitment: "May 31-June 4, 2027",
        programFocusTags: [],
      },
    ],
  },
  {
    slug: "university-of-arizona-early-academic-outreach",
    name: "University of Arizona Early Academic Outreach",
    description:
      "UA's Early Academic Outreach office runs a directory of ~16 summer programs; two are directly relevant to this batch: Quantum Camp (a free quantum-computing camp for high school girls) and NASEP (a year-long program for Native American, Alaskan Native, and Hawaiian Native high schoolers).",
    websiteUrl: "https://eao.arizona.edu/summer",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Quantum Camp",
        description:
          "Free quantum computing camp for high school girls, hosted at Central Arizona College (not the UA Tucson campus). Overnight/residential program.",
        location: "Central Arizona College",
        zip: null,
        geocodeCity: "Coolidge, AZ",
        minimumAge: 14,
        applicationUrl: "https://eao.arizona.edu/summer",
        // The 2026-05-25 deadline this record originally shipped with has
        // now passed (confirmed during the Explore-page audit) — cleared
        // rather than left displayed as if still current. No 2027 date is
        // invented; availabilityNote says exactly that and nothing more.
        // Status stays 'seasonal' — this is a presentation correction,
        // not a status change, and not new first-party evidence about
        // next cycle's dates.
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "2026 registration has closed. 2027 dates have not yet been announced.",
        externalIdSuffix: "quantum-camp",
        category: "STEM",
        interestsTags: ["stem", "quantum_computing"],
        commitmentType: "one_time",
        programType: "camp",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 14-17; open to high school girls",
        timeCommitment: "June 8-12, 2026 (overnight/residential)",
        programFocusTags: ["girls_in_stem"],
      },
      {
        title: "NASEP (Native American Science and Engineering Program)",
        description:
          "Free, year-long program for Native American, Alaskan Native, and Hawaiian Native high school students in 4 phases: a week-long residential Summer Program Phase at UA (June), a Research Project Phase (geoscience research, Aug-Jan, presenting posters at Native American College Day), an Enrichment Phase (Sept-May: Navajo Nation Fair & Parade, Tribal Environmental Health Forum, Native American College Day, AISES Regional Conference, SARSEF Fair), and a Closing Banquet Phase (May) with a NASEP stole. Represented as one continuous program with one application, not 4 separate opportunities, since it's a single multi-phase commitment.",
        location: "University of Arizona, Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 15,
        // The dedicated "Apply" link/portal for NASEP itself wasn't
        // reached during research (only the nav link was noted, not
        // followed) — pointing to the verified summer-programs page that
        // itself links to it, per this batch's "don't reconstruct a
        // guessed URL" convention.
        applicationUrl: "https://nasep.arizona.edu/about-nasep",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Eligibility is Native American, Alaskan Native, and Hawaiian Native high school students, grades 10-11, exactly as published by the program — shown as informational context only. This platform has no mechanism to filter or gate visibility on tribal identity or similar attributes, and none is planned; every student sees this record regardless of profile. Application deadline/cost not published on the pages reached during research.",
        externalIdSuffix: "nasep",
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "recurring",
        programType: "research_program",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Current 10th-11th grade; Native American, Alaskan Native, or Hawaiian Native high school students",
        timeCommitment: "Year-long: summer residential week (June) + research phase (Aug-Jan) + enrichment events (Sept-May) + closing banquet (May)",
        researchComponent: true,
        programFocusTags: ["native_american_stem", "geoscience_research"],
      },
    ],
  },
  {
    slug: "azfirst-robotics",
    name: "AZFirst (Arizona FIRST Robotics)",
    description:
      "Statewide affiliate supporting FIRST LEGO League, FIRST Tech Challenge, FIRST Robotics Competition, VEX, and the Arizona Robotics League. Every one of AZFirst's own \"Programs\"/\"Calendar\"/FTC/FRC/ARL pages describes team/competitor participation, not volunteering, and is correctly excluded per this batch's explicit instruction not to label competition participation as volunteer service. A real volunteer pathway exists (\"Volunteer With Purpose\" — mentors, event-operations support, industry professionals) but publishes no age criteria, no dated role list, and no registration form beyond emailing a coordinator — too vague to represent as a discrete opportunity without risking inaccuracy. Kept as a directory record only.",
    websiteUrl: "https://www.azfirst.info/how-to-volunteer",
    city: null,
    contactEmail: null,
    // Directory-only: see description. Do not add the 5 competition/
    // team-registration pages as opportunities (correctly rejected per
    // audit), and do not fabricate a structured volunteer record from
    // the vague "email a coordinator" pathway.
    opportunities: [],
  },
  {
    slug: "scitech-institute-chief-science-officers",
    name: "SciTech Institute — Chief Science Officers",
    description:
      "Statewide STEM-promotion nonprofit running the Chief Science Officers program: students in grades 6-12 elected by their peers to serve as school-level STEM ambassadors. No public individual-student application, portal, or \"apply here\" link exists anywhere on the program's page — a student joins only if their own school participates and holds an election.",
    websiteUrl: "https://scitechinstitute.org/programs/chief-science-officers/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Chief Science Officers",
        description:
          "A school-level STEM ambassador title: students are elected by their peers, not admitted through a public application. Part of a national/international network (800+ CSOs across 15 US cities and 6 countries as of the program's own most recently cited cohort data).",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://scitechinstitute.org/programs/chief-science-officers/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Participation through school/program — there is no direct student application. Ask your school whether it participates and holds a CSO election.",
        externalIdSuffix: "chief-science-officers",
        // Virtual: not because it "sounds remote," but because there is
        // no fixed third-party address for a distance calculation to
        // apply to at all — a CSO's activity happens at whichever school
        // they already attend, so "how far is this from the student" is
        // a question that doesn't make sense to ask.
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "stem_leadership"],
        commitmentType: "recurring",
        programType: "career_exploration_program",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Grades 6-12; elected by peers at a participating school",
        programFocusTags: ["stem_ambassador", "school_mediated"],
      },
    ],
  },
  {
    slug: "congressional-app-challenge",
    name: "Congressional App Challenge",
    description:
      "Nationwide coding competition organized by congressional district — a sitting U.S. House member must opt their district in for constituents to compete. Students submit an original app for judging.",
    websiteUrl: "https://www.congressionalappchallenge.us/students/student-registration/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Congressional App Challenge 2026",
        description:
          "Students (individually or in teams of up to 4) build and submit an original app to compete within their congressional district. A student competes in the district they reside in OR attend school in, so a student whose home district isn't participating may still be eligible via their school's district. Deadline and Arizona district participation independently verified live on the official rules/registration pages, not assumed from the figure supplied for this research.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.congressionalappchallenge.us/students/student-registration/",
        applicationDeadline: "2026-10-26",
        availabilityStatus: "open",
        availabilityNote:
          "This is a competition, not volunteering. Of Arizona's 9 congressional districts, 6 are confirmed participating for the 2026 cycle (AZ01, AZ02, AZ03, AZ04, AZ05, AZ06); AZ07, AZ08, and AZ09 are not currently listed — a student in one of those districts may still be eligible if their school is in a participating district.",
        externalIdSuffix: "2026",
        // Virtual: students build and submit an app online — the
        // competition itself has no physical event or venue a student
        // must attend. (Not "virtual because it has an online form" —
        // there is no in-person component at all to this competition.)
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "computer_science", "software_engineering"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Middle or high school student at time of submission; individual or teams up to 4; U.S. residents",
        timeCommitment: "Registration and submission due October 26, 2026, 12:00 PM ET",
        programFocusTags: ["app_development", "coding_competition"],
      },
    ],
  },
  {
    slug: "nasa-high-school-stem-opportunities",
    name: "NASA — High School STEM Opportunities",
    description:
      "NASA runs a rolling set of nationally-available STEM challenges and programs. Represented here are the evergreen challenges explicitly confirmed open to high-school-age (or younger) students on NASA's own current pages — college-only programs (Pathways internships, Community College Aerospace Scholars, undergraduate/graduate design projects) are explicitly excluded. NASA's searchable stemgateway.nasa.gov portal was also checked and currently yields zero individually-actionable, Arizona-eligible high-school opportunities after filtering — not represented here, revisit in a future pass. Exact current-cycle deadlines for the challenges below were not independently confirmed at the individual-challenge-page level during this research pass; shown as unverified rather than a guessed date.",
    websiteUrl: "https://www.nasa.gov/learning-resources/for-students-grades-9-12/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "TechRise Student Challenge",
        description: "Students submit experiment proposals for a chance to fly them on a suborbital research platform.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "Explicitly open to grades 6-12. Exact current-cycle deadline not independently confirmed — check NASA's page directly for the current application window.",
        externalIdSuffix: "techrise-challenge",
        // Virtual: inferred from the challenge's submission-based
        // structure (design a proposal, build/test a payload at the
        // student's own school or home, then submit it — NASA handles
        // integration, no confirmed mandatory in-person event for
        // standard participation). This inference is weaker than the
        // other virtual classifications in this batch — flagged for a
        // future live re-check, not asserted with full confidence.
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "aerospace_engineering"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "not_specified",
        eligibleGrades: "Grades 6-12",
        programFocusTags: ["aerospace_challenge"],
      },
      {
        title: "Dream with Us Design Challenge",
        description: "NASA-run design challenge open to middle and high school students.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "Explicitly open to grades 6-12. Exact current-cycle deadline not independently confirmed — check NASA's page directly for the current application window.",
        externalIdSuffix: "dream-with-us",
        // deliveryMode deliberately left unset (defaults to in_person):
        // unlike TechRise/App Development Challenge, there isn't enough
        // confirmed information about this challenge's actual
        // participation format to responsibly classify it as requiring
        // no physical attendance — left at the safe default rather than
        // guessed, consistent with "do not mark an event virtual merely
        // because registration happens online."
        category: "STEM",
        interestsTags: ["stem", "general_engineering"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "not_specified",
        eligibleGrades: "Grades 6-12",
        programFocusTags: ["design_challenge"],
      },
      {
        title: "App Development Challenge",
        description: "NASA-run app development challenge open to high school and community college students.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "Explicitly open to \"high school and community college students.\" Exact current-cycle deadline not independently confirmed — check NASA's page directly for the current application window.",
        externalIdSuffix: "app-development-challenge",
        // Virtual: an app-development challenge is inherently a
        // submit-what-you-built competition, same reasoning as
        // Congressional App Challenge — no physical event to attend.
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "computer_science", "software_engineering"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "not_specified",
        eligibleGrades: "High school and community college students",
        programFocusTags: ["app_development"],
      },
      {
        title: "HUNCH (High Schools United with NASA to Create Hardware)",
        description:
          "Structured, hands-on program where high school students design and build real flight hardware and other products for NASA, typically through a participating school's engineering/CTE program.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Explicitly high-school-focused. Typically joined through a participating school's program rather than an individual public application — shown as \"Participation through school/program.\" Exact current-cycle details not independently confirmed.",
        externalIdSuffix: "hunch",
        // deliveryMode deliberately left unset (defaults to in_person):
        // HUNCH is a hands-on hardware-building program, plausibly
        // involving a physical build space and, for some tracks,
        // shipping/visiting NASA facilities for integration — this is
        // NOT the "no fixed third-party location" reasoning used for
        // SciTech's CSO program (which is a title, not a build program).
        // Left at the safe default rather than guessed.
        category: "STEM",
        interestsTags: ["stem", "aerospace_engineering", "mechanical_engineering"],
        commitmentType: "recurring",
        programType: "career_exploration_program",
        compensation: "not_specified",
        eligibleGrades: "High school students, typically via a participating school program",
        programFocusTags: ["hardware_design", "school_mediated"],
      },
      {
        title: "NASA Human Exploration Rover Challenge",
        description:
          "Teams design and build human-powered rovers to navigate a simulated planetary-surface obstacle course. Teams are typically formed through a school or community organization. The challenge culminates each April in a final excursion event at the U.S. Space & Rocket Center in Huntsville, Alabama — confirmed via NASA's own event page and the venue's own site.",
        location: "One Tranquility Base, Huntsville, AL 35805",
        zip: "35805",
        geocodeCity: "Huntsville, AL",
        minimumAge: 13,
        applicationUrl: "https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "Explicitly open to \"middle school, high school, and college/university level\" teams. Exact current-cycle deadline not independently confirmed.",
        externalIdSuffix: "rover-challenge",
        // deliveryMode deliberately left unset (defaults to in_person):
        // this challenge culminates in teams physically racing their
        // built rover at an actual NASA-hosted competition site — a
        // genuine travel requirement, not a submission-only format.
        // Correctly stays subject to the distance hard filter. Address
        // added this session (U.S. Space & Rocket Center, Huntsville,
        // AL) after independently confirming the fixed annual event
        // site via NASA's own page plus corroborating sources.
        category: "STEM",
        interestsTags: ["stem", "mechanical_engineering", "aerospace_engineering"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "not_specified",
        eligibleGrades: "Middle school, high school, and college/university level (team-based)",
        programFocusTags: ["rover_design"],
      },
      {
        title: "NASA International Space Apps Challenge",
        description:
          "Weekend-format hackathon-style challenge, individual or team-based, open registration with no stated age floor (\"All ages, skill levels... there's always space for one more\" per NASA's own page).",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.nasa.gov/learning-resources/nasa-stem-opportunities-activities/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "No age floor published — genuinely open registration. Exact current-cycle event date not independently confirmed.",
        externalIdSuffix: "space-apps-challenge",
        // Hybrid, not virtual: Space Apps runs real physical local-event
        // host sites in many cities AND explicitly permits fully
        // remote/global participation as its own established track —
        // both are genuine options, unlike a challenge with only one
        // format. Bypasses the distance hard filter the same way
        // virtual does (see lib/matching.ts's isWithinRange), since the
        // remote track alone is enough to make travel unnecessary.
        deliveryMode: "hybrid",
        category: "STEM",
        interestsTags: ["stem", "computer_science", "data_science"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "not_specified",
        eligibleGrades: "All ages/skill levels; no floor published",
        programFocusTags: ["hackathon"],
      },
    ],
  },
  {
    slug: "cyberpatriot",
    name: "CyberPatriot — National Youth Cyber Defense Competition",
    description:
      "National youth cyber-defense competition. This organization's robots.txt blanket-disallows all automated crawling (Disallow: / for every user-agent, no exceptions) — per this batch's explicit instruction, no automated or ad hoc scraping was attempted beyond checking robots.txt itself. This is deliberately a minimal, administrator-reviewed external-link record: season, divisions, eligibility, team size, coach requirement, and fees were not independently verified from first-party materials and are left unknown rather than guessed.",
    websiteUrl: "https://www.uscyberpatriot.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "CyberPatriot National Youth Cyber Defense Competition",
        description:
          "National cyber-defense competition for students. Full program details (current season, divisions, eligibility, team size, coach requirement, fees, and dates) were not independently verified — this site's robots.txt disallows all automated access, so this record intentionally leaves those fields unknown rather than stating unverified facts. Visit the official site directly for current details.",
        location: null,
        zip: null,
        geocodeCity: null,
        // Not asserting a real published minimum age — this is this
        // platform's own floor (no ServeFinder student is younger than
        // 13 regardless), used only because minimum_age is a required,
        // non-nullable column. See the org description for why every
        // other detail is deliberately left unknown.
        minimumAge: 13,
        applicationUrl: "https://www.uscyberpatriot.org/",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "Administrator-reviewed external link only — eligibility, team size, coach requirement, cost, and dates were not independently verified (robots.txt disallows automated crawling of this site). Visit the official site directly for current, accurate details before relying on anything here beyond the program's name and existence.",
        externalIdSuffix: "national-competition",
        // Virtual: this is a structural fact about how CyberPatriot
        // rounds work (teams remotely defend a downloaded virtual
        // network image, not travel to a venue) — distinct from the
        // season/eligibility/fee specifics left genuinely unknown above,
        // which do require checking the current page and were not
        // assumed.
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "cybersecurity"],
        commitmentType: "recurring",
        programType: "competition",
        compensation: "not_specified",
        programFocusTags: ["cybersecurity_competition"],
      },
    ],
  },
  {
    slug: "girls-who-code-pathways",
    name: "Girls Who Code — Pathways",
    description:
      "Free, year-round, fully virtual/self-paced program for 9th-12th grade girls and non-binary students, with tracks in game design, data science, AI, cybersecurity, and web development, plus a Discord community and career panels. Girls Who Code's older Summer Immersion Program is not currently listed as an active, enrolling program on either page checked during this research — not represented here, per this batch's explicit instruction not to rely on outdated Summer Immersion information.",
    websiteUrl: "https://girlswhocode.com/programs/pathways",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Pathways",
        description:
          "Self-paced virtual program (6-7 weeks per track) covering game design, data science, AI, cybersecurity, and web development, with a Discord community, optional corporate-partner events, career panels, and advisor-led workshops. \"Apply Now\" is the live call-to-action; no specific numeric application deadline is published anywhere on either page checked — represented honestly as rolling/year-round, not a fabricated cutoff date.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://girlswhocode.com/programs/pathways",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Rolling / year-round — no published application deadline. Open to 9th-12th grade girls and non-binary students, including rising 9th graders and graduating seniors.",
        externalIdSuffix: "pathways",
        // Virtual: explicitly confirmed on the live program page — "free
        // year-round program," fully self-paced/online with a Discord
        // community, no physical location at all.
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "computer_science", "cybersecurity", "data_science", "artificial_intelligence"],
        commitmentType: "recurring",
        programType: "club",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Grades 9-12, girls and non-binary students",
        timeCommitment: "Self-paced, 6-7 weeks per track",
        programFocusTags: ["girls_in_stem", "virtual_program"],
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Education/Tutoring/Literacy/Mentoring/Academic Support batch. Every
  // record below uses only facts confirmed on a live, first-party page as
  // of the research date (2026-08-29/30) — see ARCHITECTURE.md for the
  // full research trail. This batch's own audit found the space thinner
  // than prior batches: 18 organizations were investigated, and exactly
  // 5 opportunities cleared the "currently actionable or clearly
  // upcoming" bar. Several real sources were deliberately NOT
  // represented here: Schoolhouse.world (its own robots.txt names and
  // disallows automated crawling by this specific agent — not bypassed,
  // deferred pending manual confirmation), Reading Partners (Arizona is
  // not a listed region and the org's own materials don't confirm AZ
  // eligibility for virtual tutoring either — creating a record would
  // send a real AZ student through a signup flow with no confirmed
  // outcome), Literacy Connects' four volunteer tracks (no minimum
  // volunteer age is published anywhere on the org's site, and three of
  // the four run during school-day hours — a structural conflict on top
  // of the unconfirmed eligibility), and Hope Ignites Phoenix (no
  // published minimum age, and its application is multi-step and
  // staff-mediated rather than self-service).
  //
  // Every record below discloses real, unresolved safety facts plainly
  // rather than omitting or softening them — a confirmed absence of
  // evidence (e.g. "no background-check requirement was found") is
  // stated as exactly that, never smoothed into either a false
  // reassurance or a false alarm. None of these fields are ever read by
  // lib/matching.ts as a filter; they exist purely to inform the student
  // and their parent before they click through to the organization's own
  // real application.
  // ---------------------------------------------------------------------

  {
    slug: "learn-to-be",
    name: "Learn To Be",
    description:
      "Nonprofit connecting volunteer tutors with K-12 students nationwide for free, one-on-one virtual tutoring.",
    websiteUrl: "https://www.learntobe.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Online Tutor",
        description:
          "Learn To Be matches volunteer tutors with K-12 students nationwide for free, one-on-one virtual tutoring in academic subjects. Tutors set a recurring weekly schedule with their matched student, meeting for 60-minute sessions 1-2 times a week, and are expected to continue for about a semester (roughly 4 months) once matched — many stay longer. Volunteer tutors may be high-school students themselves. Safety facts, stated plainly: Learn To Be's own materials say only applicants over 18 are run through a sex-offender background check — a background-check requirement for minor tutors was not found and should not be assumed. Sessions are recorded for quality review, and a parent/guardian is encouraged (not required) to sit in. Before applying, a minor volunteer should review Learn To Be's own safety and communication policies directly and involve a parent or guardian.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.learntobe.org/apply",
        applicationDeadline: null,
        // Confirmed functional live, immediately before seeding (both
        // /apply and /tutor-hub returned real content, HTTP 200) — a
        // scheduled short maintenance window noted on the page affects
        // live tutoring sessions only, not the application itself, and
        // had not started at verification time.
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-tutor",
        deliveryMode: "virtual",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "High school age or older; no stricter minimum age published.",
        timeCommitment: "60-minute sessions, 1-2 times per week, minimum ~4 months (one semester) once matched.",
        // background_check_required deliberately left unset (not false,
        // not true) — Learn To Be's own materials distinguish 18+
        // applicants (checked) from minors (not checked); that nuance
        // lives in the description text above, not a single boolean.
        programFocusTags: ["tutoring", "academic_support"],
      },
    ],
  },

  {
    slug: "upchieve",
    name: "UPchieve",
    description: "Nonprofit providing free, on-demand virtual academic coaching to students nationwide.",
    websiteUrl: "https://upchieve.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Academic Coach",
        description:
          "UPchieve provides free, on-demand academic coaching to students nationwide over chat and a shared whiteboard, across 40+ subjects including math, reading & writing, science, and SAT/ACT test prep. Student volunteers must be in at least 9th grade to become a coach — no upper age limit is stated. Coaches log into their own dashboard whenever available, rather than keeping a fixed weekly slot, and must complete UPchieve's \"Intro to UPchieve\" course plus a subject-certification quiz before tutoring. Safety facts, stated plainly: no background-check requirement for volunteer coaches was found published as of this review — this is not independently confirmed either way, not assumed absent. Chat and whiteboard content may be retained and reviewed by UPchieve staff for moderation. Before applying, a minor volunteer should review UPchieve's own safety, privacy, and communication policies directly.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://upchieve.org/volunteer",
        applicationDeadline: null,
        // Confirmed functional live, immediately before seeding (HTTP
        // 200, real page content).
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-academic-coach",
        deliveryMode: "virtual",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "9th grade or higher; no upper age limit stated.",
        timeCommitment: "On-demand — no fixed minimum weekly commitment; log in to the coach dashboard whenever available.",
        programFocusTags: ["tutoring", "academic_support", "literacy"],
      },
    ],
  },

  {
    slug: "engin-program",
    name: "ENGin",
    description:
      "Global nonprofit pairing volunteers with Ukrainian students for weekly English-conversation practice and cultural exchange.",
    websiteUrl: "https://www.enginprogram.org/",
    city: null,
    contactEmail: "info@enginprogram.org",
    opportunities: [
      {
        title: "English Conversation Volunteer",
        description:
          "ENGin pairs volunteers with Ukrainian students for weekly English-conversation practice and cultural exchange over video call — this is conversational language mentoring, not formal academic tutoring. Volunteers must be at least 13 years old and commit to about 1 hour per week for a minimum of 10-12 weeks. ENGin requires a video interview and training, and — for any participant under 18 — written parental permission, before matching. Safety facts, stated plainly: scheduled sessions happen through ENGin's own platform, but ENGin's own materials note day-to-day coordination often moves to third-party apps (WhatsApp, Telegram, Messenger) or email — ServeFinder does not supervise or moderate any communication that happens outside ENGin's own platform. A minor volunteer should involve a parent or guardian, protect their own personal contact information, and never share more of it than the matching process actually requires.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.enginprogram.org/volunteer",
        applicationDeadline: null,
        // Confirmed functional live, immediately before seeding (HTTP
        // 200, real page content).
        availabilityStatus: "open",
        externalIdSuffix: "english-conversation-volunteer",
        deliveryMode: "virtual",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        // A real cost exists, but only for an optional service, not
        // participation itself — stated exactly, not flattened to "Free".
        cost: "Free to volunteer; a $29/year fee applies only if you request official service-hour verification.",
        eligibleGrades: "13 years of age or older.",
        timeCommitment: "About 1 hour per week, for a minimum of 10-12 weeks (roughly 3 months).",
        parentalConsentRequired: true,
        programFocusTags: ["mentoring", "english_language"],
      },
    ],
  },

  {
    slug: "read-better-be-better",
    name: "Read Better Be Better",
    description:
      "Phoenix-based nonprofit running literacy and youth-development programs, including two high-school pathways programs in education-career exploration and civic leadership.",
    websiteUrl: "https://www.readbetterbebetter.org/",
    city: "Phoenix, AZ",
    contactEmail: "pathways@readbetterbebetter.org",
    opportunities: [
      {
        title: "Pathway to Education Professions",
        description:
          "An after-school program where Phoenix-area high schoolers work alongside Read Better Be Better staff supporting K-8 classrooms while learning about careers in education; scholarship-eligible upon satisfactory completion. Runs each semester, with the option to continue past one. Applying directly through the link below (a real, live Formstack application) is the only way to confirm current availability — RBBB's own program page does not state a specific current application window.",
        location: "Phoenix-area partner schools (specific site assigned upon acceptance)",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://formstack.io/82EF8",
        applicationDeadline: null,
        // RBBB's own page never confirms a current application cycle —
        // real, individually-actionable program, but not enough to call
        // "open." Never shown with an Apply button; see canApplyNow() in
        // lib/availabilityStatus.ts.
        availabilityStatus: "unverified",
        availabilityNote:
          "RBBB's page doesn't confirm a current application cycle — apply directly to check current availability.",
        externalIdSuffix: "pathway-education-professions",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "career_exploration_program",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "High school students; specific grade not published.",
        timeCommitment: "Semesterly after-school program; option to continue beyond one semester.",
        programFocusTags: ["mentoring", "academic_support"],
      },
      {
        title: "Pathway to Civic Leadership",
        description:
          "Part of Read Better Be Better's \"Changemaker Continuum,\" using the Flinn Foundation's own leadership guidebook — Phoenix-area high schoolers identify a school or community issue and present proposals to real school decision-makers. Runs each semester, with the option to continue past one. Applying directly through the link below (a real, live Formstack application) is the only way to confirm current availability — RBBB's own program page does not state a specific current application window.",
        location: "Phoenix-area partner schools (specific site assigned upon acceptance)",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://formstack.io/929E5",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote:
          "RBBB's page doesn't confirm a current application cycle — apply directly to check current availability.",
        externalIdSuffix: "pathway-civic-leadership",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "career_exploration_program",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "High school students; specific grade not published.",
        timeCommitment: "Semesterly program; option to continue beyond one semester.",
        programFocusTags: ["mentoring", "civic_leadership"],
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Business/Entrepreneurship/Finance/Marketing/Social Innovation batch.
  // Research investigated 20 first-party sources (Diamond Challenge,
  // Conrad Challenge, Blue Ocean, Wharton Investment Competition, DECA
  // Arizona, Arizona FBLA, Junior Achievement of Arizona, NFTE (national +
  // AZ presence), ASU and University of Arizona youth-entrepreneurship
  // programs, Phoenix-area chambers/incubators/economic-development
  // programs, National Economics Challenge, Fed Challenge, SIFMA's Stock
  // Market Game, Rise, and several others) — 6 opportunities cleared the
  // "currently open or confirmed upcoming, genuine HS eligibility, safe"
  // bar. Every application link below was re-checked live, immediately
  // before this file was written, for HTTP 200 + real matching content.
  //
  // Rejected, with reasons: DECA Arizona and Arizona FBLA (membership is
  // structurally gated behind an existing school chapter — no individual
  // application pathway a ServeFinder student could use exists); NFTE's
  // "Next-Level Startup" course ($595 fee, enrollment via a general
  // third-party community platform not built for minors — a real
  // off-platform safety concern beyond the fee alone); every ASU Edson
  // E+I Institute K-12 listing (teacher/school-district licensing
  // programs, no individual-student application pathway); University of
  // Arizona's McGuire Entrepreneurship Summer Academy (its own page
  // states the application is currently closed, no next cycle announced);
  // SEED SPOT's youth track (no self-service application URL published);
  // Greater Phoenix Chamber Foundation and the Arizona Commerce
  // Authority's youth pilot (no confirmed individual application
  // pathway); Hustle PHX's Y.E.P. (serves justice-involved youth at
  // detention facilities specifically, not a general-public opportunity);
  // "Young Entrepreneurs of America" (Tempe) (active legitimacy red
  // flags — a suspiciously recent founding date, no verified address, a
  // generic contact-only "application," and a name collision with a
  // separately-reported scam-adjacent org — not used, full stop);
  // National Economics Challenge and the Fed Challenge (both real and
  // credible, but their current cycles are already closed with no
  // 2026-27 dates announced yet); SIFMA's Stock Market Game (confirmed
  // simulated, no real money — but no confirmed individual-student
  // registration path independent of a teacher registering a whole
  // classroom); and Aspiring Youth Academy's Spring Break Innovation Camp
  // (two independent research passes returned conflicting dates for the
  // same residential program — a real, unresolved ambiguity, not
  // something to paper over by picking one). Rise
  // (risefortheworld.org) was also not included this pass: it's a real,
  // credible program, but this batch's own live link-recheck could not
  // find a working self-service application page or independently
  // reconfirm a specific deadline — worth revisiting once that can be
  // verified directly rather than carried over from a single research
  // pass. Schoolhouse.world-style crawl-restricted sources were not
  // investigated for this category.
  // ---------------------------------------------------------------------

  {
    slug: "diamond-challenge",
    name: "Diamond Challenge",
    description:
      "Global entrepreneurship competition for high school students, presented by the University of Delaware's Horn Entrepreneurship — teams develop business or social-impact venture concepts for a shared prize pool.",
    websiteUrl: "https://diamondchallenge.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Diamond Challenge — Business & Social Innovation Competition",
        description:
          "Diamond Challenge invites high school teams to develop a venture concept in one of two tracks: Business Innovation (a for-profit idea that solves a customer problem) or Social Innovation (a venture that addresses a social problem). Teams of 2-4 students (ages 14-18 at the submission deadline) are required to have one adult advisor (21+) — a teacher, parent, or other mentor. The competition is fully virtual through the submission and judging rounds; only the small number of finalist teams are invited to an in-person Summit (details vary by year — most participants never need to travel). Top teams across both tracks share a real prize pool (1st: $12,000; 2nd: $8,000; 3rd: $4,500, plus topical prizes). Safety facts, stated plainly: no background-check requirement was found published for participants or advisors. Before registering, a minor should review Diamond Challenge's own rules and privacy policy directly and involve a parent or guardian, especially since an adult advisor's participation is required for every team.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://diamondchallenge.org/competition/",
        applicationDeadline: "2027-01-14",
        availabilityStatus: "open",
        externalIdSuffix: "business-social-innovation-competition",
        deliveryMode: "virtual",
        category: "Business & Entrepreneurship",
        interestsTags: ["entrepreneurship", "social_innovation"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "High school students ages 14-18 at the submission deadline.",
        timeCommitment: "Team-based venture development from registration through the January submission deadline.",
        programFocusTags: ["entrepreneurship", "social_innovation", "pitch_competition"],
      },
    ],
  },

  {
    slug: "conrad-challenge",
    name: "Conrad Challenge",
    description:
      "Global student innovation competition, presented by Equinor and hosted by the Conrad Foundation, where teams build entrepreneurial ventures around real-world challenges across multiple industries.",
    websiteUrl: "https://conrad.spacecenter.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Conrad Challenge — Innovation & Entrepreneurship Competition",
        description:
          "Conrad Challenge teams of 2-5 students (ages 13-18) build a venture around a real-world innovation challenge, guided by one required adult team coach (18+). The 2026-2027 cycle's Phase One (Activation Stage) runs August 27 - October 30, 2026, when teams register and begin; Phase Two (Innovation Stage, October 30, 2026 - January 8, 2027) is where the program's real cost applies. Cost, stated plainly: Phase Two carries a $499 per-team fee — this is a real cost, not a low-barrier program — with financial aid available for qualifying teams (financial aid applications open November 2 - December 3, 2026). Only finalist teams travel to the in-person Innovation Summit (April 21-24, 2027, Houston, TX) — the general competition itself is virtual, with no travel required to compete. Safety facts, stated plainly: no background-check requirement was found published for participants or coaches. Before registering, a minor should review Conrad Challenge's own rules and privacy policy directly and involve a parent or guardian, especially given the real per-team cost and the required adult coach role.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://conrad.spacecenter.org/participate/",
        applicationDeadline: "2026-10-30",
        availabilityStatus: "open",
        externalIdSuffix: "innovation-entrepreneurship-competition",
        deliveryMode: "virtual",
        category: "Business & Entrepreneurship",
        interestsTags: ["entrepreneurship", "stem"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "unpaid",
        cost: "$499 per team (Innovation Stage); financial aid available for qualifying teams.",
        financialAidAvailable: true,
        eligibleGrades: "Ages 13-18; teams of 2-5 students plus one required adult team coach (18+).",
        timeCommitment: "Phase One (registration/activation) Aug 27 - Oct 30, 2026; Phase Two (paid Innovation Stage) through Jan 8, 2027.",
        programFocusTags: ["entrepreneurship", "innovation_competition"],
      },
    ],
  },

  {
    slug: "blue-ocean-student-entrepreneur-competition",
    name: "Blue Ocean Student Entrepreneur Competition",
    description:
      "Global virtual pitch competition where high school students compete individually or in teams, applying Blue Ocean Strategy concepts to a real business idea.",
    websiteUrl: "https://blueoceancompetition.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Blue Ocean Student Entrepreneur Competition",
        description:
          "Blue Ocean is a fully virtual pitch competition — students record and submit a video pitch of a business idea, applying concepts from Blue Ocean Strategy after completing a required free Mini-Course. Students may compete individually or in a team of up to 5; no adult advisor or teacher sponsor is required to participate, though a teacher may optionally register to support students. Open to students ages 14-18 at the time of registration. Safety facts, stated plainly: because no adult advisor is structurally required, this is a lower-supervision program than Diamond Challenge or Conrad Challenge — no background-check requirement was found published, and a personal (non-school) email is recommended by the organizer to avoid school firewall issues with registration emails. Before registering, a minor should review Blue Ocean's own rules and privacy policy directly and involve a parent or guardian.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://blueoceancompetition.org/register/",
        applicationDeadline: "2027-02-21",
        availabilityStatus: "open",
        externalIdSuffix: "student-entrepreneur-competition",
        deliveryMode: "virtual",
        category: "Business & Entrepreneurship",
        interestsTags: ["entrepreneurship"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 14-18 at time of registration; solo or teams of up to 5 students.",
        timeCommitment: "Self-paced Mini-Course plus a video pitch submitted by the February deadline.",
        programFocusTags: ["entrepreneurship", "pitch_competition"],
      },
    ],
  },

  {
    slug: "wharton-global-youth-program",
    name: "Wharton Global Youth Program",
    description:
      "The University of Pennsylvania's Wharton School runs a free, simulated stock-market investment competition for high school teams nationwide.",
    websiteUrl: "https://globalyouth.wharton.upenn.edu/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Wharton Global High School Investment Competition",
        description:
          "A free, fully simulated investment competition — teams of 4-6 students (9th-12th grade) use a shared online stock-market simulator with virtual (not real) cash to research and trade approved securities, competing on portfolio performance from September 28 through December 4, 2026. Simulated only, confirmed directly: no real money is ever used by any participant at any point. Structural fact, stated plainly and prominently: a student cannot register themselves for this competition — registration must be completed by a teacher or educator at the student's own high school, acting as the team's advisor, on the student's behalf. A ServeFinder student interested in this competition needs to bring it to a teacher, not apply directly. The team's designated student leader must be at least 16 by the competition start date. Only top teams travel to an in-person Global Finale in Philadelphia; the competition itself is entirely online. Safety facts, stated plainly: no background-check requirement was found published. Before asking a teacher to register a team, a minor should review the competition's own rules directly and involve a parent or guardian.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://globalyouth.wharton.upenn.edu/competitions/investment-competition/",
        applicationDeadline: "2026-09-11",
        availabilityStatus: "open",
        externalIdSuffix: "global-high-school-investment-competition",
        deliveryMode: "virtual",
        category: "Business & Entrepreneurship",
        interestsTags: ["finance"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "9th-12th grade; team leader must be at least 16. Registration must be completed by a teacher/school advisor, not the student directly.",
        timeCommitment: "Registration closes September 11, 2026; competition runs September 28 - December 4, 2026.",
        programFocusTags: ["finance", "simulated_investing"],
      },
    ],
  },

  {
    slug: "junior-achievement-arizona",
    name: "Junior Achievement of Arizona",
    description:
      "Phoenix-based nonprofit delivering financial literacy, work readiness, and entrepreneurship education to Arizona students, including a free virtual career-exploration platform.",
    websiteUrl: "https://www.jaaz.org/",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "JA Inspire — Virtual Career Exploration Program",
        description:
          "JA Inspire is Junior Achievement of Arizona's virtual career-exploration and workforce-readiness platform: a virtual exhibit hall with booths from 100+ real Arizona employers, live and recorded webinars from local professionals, and downloadable career resources. Normally experienced through a participating school, but JA's own platform confirms students whose school doesn't offer it can self-register for free and access it from home — no adviser or team is required, this is an individual, self-paced experience. Safety facts, stated plainly: this is an asynchronous virtual expo (exhibitor booths, pre-recorded/live webinars), not one-on-one live contact with unvetted adults; no background-check requirement was found published, and none should be assumed. Before self-registering, a minor should review JA Inspire's own privacy and safety information directly and involve a parent or guardian.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://jaazinspirehighschool.vfairs.com/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "ja-inspire-virtual-career-exploration",
        deliveryMode: "virtual",
        category: "Business & Entrepreneurship",
        interestsTags: ["business"],
        commitmentType: "one_time",
        programType: "career_exploration_program",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Open to Arizona middle and high school students; no minimum age above ServeFinder's own 13+ floor was found.",
        timeCommitment: "Self-paced — no fixed session length or deadline published; a rolling, always-open virtual platform.",
        programFocusTags: ["career_exploration", "workforce_pathways"],
      },
    ],
  },

  {
    slug: "nfte-world-series-of-innovation",
    name: "NFTE (Network for Teaching Entrepreneurship)",
    description:
      "National nonprofit running the World Series of Innovation, a free virtual entrepreneurship challenge series where young people pitch solutions to real-world problems aligned with the UN Sustainable Development Goals.",
    websiteUrl: "https://www.nfte.com/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "World Series of Innovation — Impact League",
        description:
          "NFTE's World Series of Innovation (Impact League track) challenges young people ages 13-24 to pitch entrepreneurial solutions to real-world problems tied to specific UN Sustainable Development Goals (recent challenges have covered financial literacy, climate action, health & well-being, and reduced inequalities). Teams of 1-4 register and submit fully online — no school affiliation is required. The 2025-26 cycle has already closed (winners announced); confirmed directly on NFTE's own site: new challenges for the next cycle launch September 9, 2026 — this record is marked upcoming, not yet open, until that date arrives. Safety facts, stated plainly and confirmed directly from NFTE's own participation agreement: any entrant under 18 must have a parent or legal guardian read and enter into the agreement on their behalf — a real, confirmed parental-consent requirement, not assumed. The agreement also grants NFTE the right to use a participant's name, image, and city/state for promotional purposes — worth knowing before a minor (with their parent/guardian) agrees to it. No background-check requirement was found published.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://innovation.nfte.com/",
        applicationDeadline: null,
        applicationOpenDate: "2026-09-09",
        availabilityStatus: "seasonal",
        availabilityNote: "New challenges launch September 9, 2026 — not yet open.",
        externalIdSuffix: "world-series-of-innovation-impact-league",
        deliveryMode: "virtual",
        category: "Business & Entrepreneurship",
        interestsTags: ["entrepreneurship", "social_innovation"],
        commitmentType: "one_time",
        programType: "competition",
        compensation: "unpaid",
        cost: "Free",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 13-24 (Impact League); teams of 1-4, no school affiliation required.",
        timeCommitment: "New challenge cycle launches September 9, 2026 — check back for the submission window.",
        programFocusTags: ["entrepreneurship", "social_innovation", "pitch_competition"],
      },
    ],
  },

  // ---------------------------------------------------------------------
  // STEM expansion + virtual volunteering batch. Research investigated
  // ~45 first-party sources across 7 AZ universities/colleges, 9 AZ
  // museums/libraries/science centers, 10 national remote-volunteering
  // platforms, 7 AZ coding/robotics/makerspace orgs, and 13 AZ
  // environmental/municipal/research-support orgs. Only 5 cleared the
  // "currently open or clearly upcoming, genuine HS eligibility, safe,
  // independently confirmable first-party" bar — an honest yield per
  // the approved audit's own "no artificial quota" instruction, not a
  // lowered bar. Every application link was re-checked live immediately
  // before this file was written; Reid Park Zoo's own domain returned a
  // site-wide 403 to automated requests on this pass (confirmed via 3
  // retries with different browser contexts, plus the homepage itself,
  // not just the volunteer page — a blanket bot-block, not evidence the
  // program is down) — corroborated instead via an Internet Archive
  // snapshot confirming "Zoo Crew" as a real, named, distinct volunteer
  // track from the 18+ "Interpretive" track, consistent with (not
  // contradicting) the audit's dated "closed for 2026, reopens January
  // 2027" finding.
  //
  // Not implemented this batch, per explicit approval scope: Maricopa
  // County Parks & Recreation, Arizona Museum of Natural History
  // (already a directory-only record here — a real upgrade candidate
  // once its own volunteer-program age policy can be confirmed),
  // Watershed Management Group, Tempe Public Library, the 2027 FRC
  // Arizona Regionals, and iNaturalist (real and COPPA-compliant, but
  // structurally a self-directed app, not a discrete opportunity) all
  // need one more follow-up confirmation before they could be added —
  // deliberately left out rather than implemented on partial evidence.
  // Every other source investigated was rejected outright (chapter-
  // gated, adults-only, no independently-verifiable first-party
  // evidence, aggregator-only, or a genuine safety concern — see the
  // audit report delivered to the user for the full list). The
  // pre-existing Special Olympics Arizona duplicate-opportunity-titles
  // issue (found while verifying the prior Business batch) is
  // deliberately not touched here — out of scope, to be handled by a
  // future ingestion-infrastructure audit.
  //
  // Arizona Science Center was in the user's approved list of 5, but
  // dropped from implementation after a deduplication check the seed
  // step itself surfaced: "Arizona Science Center" already existed as a
  // real organization with 6 real, live opportunities from an existing
  // WEEKLY SCRAPED source (lib/ingestion/sources/arizonaScienceCenter.ts,
  // reading azscience.org/support/volunteer-opportunities/). Direct
  // side-by-side comparison of that page against the "teens" landing
  // page (azscience.org/learn/students/teens/) this record was sourced
  // from showed the teens page's own "Volunteers" section is a short
  // pointer to that SAME general volunteer program (identical minimum
  // age 15, identical program description), not a distinct offering —
  // the teens page's genuinely distinct items are "Teen Advisory Board"
  // and "Counselors in Training," neither of which is volunteering. A
  // "Teen Volunteer Program" manual record was seeded, then removed
  // once this was confirmed, rather than leaving a substantive
  // duplicate live under a different title. See the final report
  // delivered to the user for the full explanation.
  // ---------------------------------------------------------------------

  {
    slug: "desert-botanical-garden",
    name: "Desert Botanical Garden",
    description:
      "Phoenix botanical garden dedicated to the conservation, study, and display of desert plants, running a dedicated teen volunteer program alongside its general volunteer corps.",
    websiteUrl: "https://www.dbg.org/",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teens in the Garden — Teen Volunteer Program",
        description:
          "Desert Botanical Garden's \"Teens in the Garden\" program offers hands-on volunteer opportunities for ages 13-17 to learn, grow, and give back alongside staff and adult volunteers, across departments including guest engagement, horticulture and plant care, educational programming, and conservation/research support. Students can choose a short-term project, a seasonal role, or an ongoing commitment. This application form is the Garden's own teen-specific pathway — confirmed distinct from its separate general-volunteer (18+) application. Safety facts, stated plainly: the Garden's own application page currently notes that orientation sessions resume in September; no specific application deadline, volunteer cost, or background-check requirement was found published. Before applying, a minor should review the Garden's own volunteer policies directly and involve a parent or guardian.",
        location: "1201 N. Galvin Parkway, Phoenix, AZ 85008",
        zip: "85008",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.volgistics.com/appform/1208246188",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Orientation sessions resume in September — the Garden's own current note on its application page.",
        externalIdSuffix: "teens-in-the-garden",
        category: "Environment",
        interestsTags: ["environment", "stem"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 13-17.",
        timeCommitment: "Short-term project, seasonal role, or ongoing commitment — flexible by department.",
        programFocusTags: ["environmental_conservation", "science_education"],
      },
    ],
  },

  {
    slug: "reid-park-zoo",
    name: "Reid Park Zoo",
    description:
      "Tucson's accredited zoo, home to over 500 animals, running a teen-specific \"Zoo Crew\" volunteer track distinct from its general (18+) volunteer program.",
    websiteUrl: "https://www.reidparkzoo.org/",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Zoo Crew — Teen Volunteer Program",
        description:
          "Reid Park Zoo's Zoo Crew is a teen-specific volunteer track (distinct from the Zoo's separate 18+ Interpretive Volunteer program) open to students entering 9th through 12th grade. Volunteers commit to roughly 4 hours per month on zoo grounds and must complete a mandatory 4-day in-person training. As of this review, applications for the 2026 Zoo Crew cycle are closed; the Zoo's own materials state the program is expected to reopen in January 2027 — this record is marked seasonal, not open, until then. Safety facts, stated plainly: no background-check requirement was found published for Zoo Crew specifically; the program's own page addresses teens directly rather than stating an explicit parental-consent requirement, so none is claimed here. Before applying, a minor should review Reid Park Zoo's own volunteer policies directly and involve a parent or guardian.",
        location: "3400 Zoo Court, Tucson, AZ 85716",
        zip: "85716",
        geocodeCity: "Tucson, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.reidparkzoo.org/about/volunteer/",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Applications for the 2026 Zoo Crew cycle are closed; expected to reopen January 2027.",
        externalIdSuffix: "zoo-crew-teen-volunteer",
        category: "Animals",
        interestsTags: ["animals", "stem"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Entering 9th through 12th grade.",
        timeCommitment: "~4 hours/month on zoo grounds; mandatory 4-day training required before volunteering begins.",
        programFocusTags: ["zoo_volunteering", "wildlife_conservation"],
      },
      {
        // New this pass (2026-08-31 autonomous session) — a distinct,
        // currently-open role separate from the seasonal/closed Zoo Crew
        // above, live-verified against reidparkzoo.org/about/volunteer/.
        // Not auto-approved: reviewStatus stays pending for a later
        // human review pass, per this session's own policy of never
        // self-approving a record it just discovered.
        title: "Outdoor Aviary Monitor",
        description:
          "Reid Park Zoo's Outdoor Aviary Monitor role supports the zoo's outdoor aviary exhibit, distinct from the teen-specific Zoo Crew program above and from the zoo's separate 18+ general volunteer tracks. The zoo's own page states volunteers must be at least 16 years of age and commit to a minimum of 4 hours per week for 6 months. Safety facts, stated plainly: no background-check requirement was found published for this specific role; no explicit parental-consent requirement is stated on the page, so none is claimed here. Before applying, a minor should review Reid Park Zoo's own volunteer policies directly and involve a parent or guardian.",
        location: "3400 Zoo Court, Tucson, AZ 85716",
        zip: "85716",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.reidparkzoo.org/about/volunteer/volunteer-internship-application/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "outdoor-aviary-monitor",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Must be at least 16 years of age.",
        timeCommitment: "Minimum of 4 hours per week for 6 months.",
        programFocusTags: ["zoo_volunteering", "wildlife_conservation"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "zooniverse",
    name: "Zooniverse",
    description:
      "The world's largest people-powered research platform — volunteers of all ages classify real research data online, no scientific background required.",
    websiteUrl: "https://www.zooniverse.org/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Citizen Science Volunteer",
        description:
          "Zooniverse connects professional researchers with volunteers who help classify real research data — images, text, audio — across hundreds of active projects spanning astronomy, biology, history, and more. No PhD or scientific background is required, and the platform states all ages and backgrounds are welcome. This is entirely asynchronous, self-paced work — there is no live contact with strangers, only browsing and classifying data on the platform's own site. Safety facts, stated plainly: Zooniverse's own policy requires parent or guardian sign-off only to create an account for a participant under 16 — this is a real, confirmed requirement, not assumed. No background-check requirement applies to this kind of activity. Before creating an account, a minor should review Zooniverse's own youth/privacy policy directly and involve a parent or guardian.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://www.zooniverse.org/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "citizen-science-volunteer",
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "No hard minimum age for participation; parent/guardian sign-off required to create an account under 16.",
        timeCommitment: "Fully self-paced — browse and classify data on your own schedule, no minimum commitment.",
        programFocusTags: ["citizen_science", "data_classification"],
      },
    ],
  },

  {
    slug: "smithsonian-digital-volunteers",
    name: "Smithsonian Digital Volunteers",
    description:
      "The Smithsonian Institution's Transcription Center, where volunteer \"volunpeers\" transcribe historical documents and biodiversity data from Smithsonian collections to make them publicly accessible.",
    websiteUrl: "https://transcription.si.edu/",
    city: null,
    contactEmail: null,
    opportunities: [
      {
        title: "Digital Volunteer — Transcription Center",
        description:
          "The Smithsonian's Transcription Center invites volunteers to transcribe and review historical documents and biodiversity data from Smithsonian collections — recent projects have included Freedmen's Bureau Records and the history of pioneering women in science. This is asynchronous, self-paced work with no live contact with strangers — only reading and transcribing scanned materials on the platform's own site, plus optional monthly online office hours with program staff. Safety facts, stated plainly: a registered account requires a minimum age of 14; anonymous transcription (no account) is available for younger participants, per the Center's own materials. No background-check requirement applies to this kind of activity. Before creating an account, a minor should review the Smithsonian's own privacy policy directly and involve a parent or guardian.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 14,
        applicationUrl: "https://transcription.si.edu/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "digital-volunteer-transcription",
        deliveryMode: "virtual",
        category: "STEM",
        interestsTags: ["stem", "education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Registered account requires age 14+; anonymous transcription available for younger participants.",
        timeCommitment: "Fully self-paced — transcribe on your own schedule, plus optional monthly virtual office hours.",
        programFocusTags: ["citizen_science", "historical_transcription"],
      },
    ],
  },

  // ---- Added 2026-08-31, autonomous expansion session. Every
  // opportunity below has reviewStatus: "pending" — new discoveries from
  // an unattended run must never self-approve; a later human review pass
  // decides whether each one publishes. See each record's own comment
  // for exact live-verified evidence. ----

  // Phoenix Zoo is deliberately NOT added here: this session's own
  // independent research (ZooTeens, 14+/grades 9-12, seasonal) turned
  // out to conclusively duplicate an opportunity a prior session had
  // already researched, staged, and gotten approved directly in the
  // database under a different source ("phoenix_zoo_zooteens",
  // external_id "phoenix-zoo-zooteens") — same org, coordinates,
  // application_url, minimum_age, and availability_status. This
  // session's duplicate row was inserted, caught, and marked
  // review_status: "merged" (merged_into_id pointing at the real
  // approved row) rather than left as a second live copy. Not migrated
  // into this file for the same reason as Habitat Central Arizona's
  // ReStore role above: doing so would risk a future regression if this
  // file's insert path ever ran ahead of the row that's already live.

  {
    slug: "habitat-for-humanity-central-arizona",
    name: "Habitat for Humanity Central Arizona",
    description:
      "Phoenix-metro affiliate of Habitat for Humanity, building and repairing homes through construction and ReStore volunteer programs, distinct from the separate Habitat for Humanity Tucson affiliate.",
    websiteUrl: "https://habitatcaz.org/volunteer/",
    city: "Phoenix, AZ",
    contactEmail: "volunteerinfo@habitatcaz.org",
    opportunities: [
      {
        title: "General Construction",
        description:
          "Habitat for Humanity Central Arizona's General Construction volunteers help build homes — painting, framing, roofing, and similar tasks, mostly on Saturdays. Confirmed directly via the organization's own official FAQ document (habitatcaz.org/documents/volunteers/Frequently-Asked-Questions.pdf): \"Arizona state laws which prohibit volunteers under the age of 16 from participating in our construction projects.\" A signed parent/guardian waiver (printed, in hand) is required for any minor before volunteering begins; volunteers under 18 are prohibited from tasks requiring power tools or ladders — a scope restriction, not a requirement that a parent be physically present during the shift. Registration goes through the org's own VolunteerHub portal (a client-rendered app not scraped by this platform, same posture as this project's other VolunteerHub-booking sources) — this application_url points to the org's own volunteer page, which itself links to that portal.",
        location: "Habitat for Humanity Central Arizona, Phoenix, AZ",
        zip: "85009",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 16,
        applicationUrl: "https://habitatcaz.org/volunteer/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "general-construction",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Must be at least 16 years of age (Arizona state law, per the org's own FAQ).",
        timeCommitment: "Mostly Saturday shifts.",
        programFocusTags: ["community_development"],
        reviewStatus: "pending",
      },
      // A "ReStore Volunteer" (15+) role is deliberately NOT duplicated
      // here: a prior session already researched, staged, and got this
      // exact role approved directly in the database (source:
      // "habitat_humanity_central_az", external_id:
      // "habitat-caz-restore-volunteer", review_status: "approved") via
      // a mechanism outside this file. Discovered when this session's
      // own seed run correctly skipped a would-be duplicate (similarity
      // 1.00) rather than double-inserting it — see
      // ingestion_sources.habitat_humanity_central_az's disposition_reason
      // for the full note. Not migrated into this file: doing so would
      // risk a review_status regression if this file's insert path ever
      // ran ahead of, or instead of, the row that's already live.
    ],
  },

  {
    slug: "habitat-for-humanity-tucson",
    name: "Habitat for Humanity Tucson",
    description:
      "Tucson-area affiliate of Habitat for Humanity, building homes and operating the CHUCK Center and HabiStore, distinct from the separate Habitat for Humanity Central Arizona affiliate.",
    websiteUrl: "https://habitattucson.org/volunteer/youth-opportunities/",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Construction Site / CHUCK Center / HabiStore Volunteer",
        description:
          "Habitat for Humanity Tucson's construction-site, CHUCK Center, and HabiStore volunteering, confirmed via the org's own youth-opportunities page: \"the minimum age to volunteer at the traditional construction site, CHUCK, or HabiStore is 16.\" A parental waiver applies for 16-17 year olds per the org's main volunteer page. Note: this record deliberately excludes the org's separate \"A Brush With Kindness\"/Neighborhood Revitalization role (14+ per the youth-opportunities page, but the org's own main volunteer page separately describes that specific role as \"14-15 with parent/guardian present\") — that phrasing conflicts across the org's own two pages on whether a guardian must be physically present, so it's left out of this app pending a clearer source, rather than guessed at. Registration: \"Volunteer Here!\" on the org's main volunteer page links to a Cervis-hosted registration console; a required new-volunteer orientation is a Microsoft Forms link reached from the same page.",
        location: "Habitat for Humanity Tucson, Tucson, AZ",
        zip: "85713",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://habitattucson.org/volunteer/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "construction-chuck-habistore",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Minimum age 16 for construction site, CHUCK Center, or HabiStore (per the org's own youth-opportunities page).",
        timeCommitment: "Not published on the current page.",
        programFocusTags: ["community_development"],
        reviewStatus: "pending",
      },
    ],
  },

  // ---- Added 2026-08-31, second autonomous expansion session:
  // Tucson/Pima County municipal-hub research. Every opportunity below
  // has reviewStatus: "pending" — same never-self-approve policy as the
  // first session's batch. ----

  {
    slug: "tucson-police-department",
    name: "Tucson Police Department",
    description:
      "City of Tucson's police department, running Explorer Post 180 — a teen-specific law-enforcement-exploration program distinct from its separate 18+ civilian volunteer program (administrative support, community engagement, role players).",
    websiteUrl: "https://tpdrecruiting.tucsonaz.gov/explorer-post-180",
    city: "Tucson, AZ",
    contactEmail: "TPDExplorers@tucsonaz.gov",
    opportunities: [
      {
        title: "Explorer Post 180",
        description:
          "Tucson Police Explorer Post 180 gives teens hands-on exposure to law enforcement — community service events, police ride-alongs, defensive tactics training, drill/ceremonial procedures, and local/national Explorer competitions. Confirmed directly via the department's own recruiting page: \"Be 14 to 20 years of age.\" Members must attend at least 50% of functions/meetings and maintain a C average or better in school; no felony or serious misdemeanor arrests permitted. Application is three downloadable PDF forms (Exploring Youth Application, Explorer Applicant Questionnaire, Parent Waiver) rather than a single online form — this record's application_url points to the page hosting all three, per this project's established practice of linking the verified page over reconstructing a guessed direct-download URL. Distinct from the department's separate 18+ general volunteer program (administrative/community-engagement/role-player roles), which is explicitly adult-only per the same recruiting site.",
        location: "270 S. Stone Ave, Tucson, AZ 85701",
        zip: "85701",
        geocodeCity: "Tucson, AZ",
        minimumAge: 14,
        applicationUrl: "https://tpdrecruiting.tucsonaz.gov/explorer-post-180",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "explorer-post-180",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Be 14 to 20 years of age (per the department's own recruiting page).",
        timeCommitment: "At least 50% of scheduled functions/meetings; C average or better required.",
        programFocusTags: ["public_safety", "leadership_development"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "pima-animal-care-center",
    name: "Pima Animal Care Center",
    description:
      "Pima County's animal shelter and adoption system, operating a West campus (Tucson) and an East campus (Eastside Adoption Center), with a tiered youth-volunteer structure distinct from most animal shelters in this app's catalog: 16-17 year olds may volunteer independently after an initial parent-supervised orientation, while 12-15 year olds may only volunteer with a parent/guardian actively supervising and doing the same activity the entire time.",
    websiteUrl: "https://www.pima.gov/2795/Volunteer-with-PACC",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Dog Walkers",
        description:
          "Handle shelter dogs (mostly 40+ lb large breeds) for exercise and kennel relief at Pima Animal Care Center. Confirmed directly via the org's own page: volunteers ages 16-17 \"may volunteer without a guardian present\" after completing an orientation and tour WITH a parent/guardian, who signs the required waiver — the teen then volunteers independently afterward, not accompanied during shifts. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "dog-walkers",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "Adoption Counselors",
        description:
          "Match families with cats and dogs available for adoption at Pima Animal Care Center. Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "adoption-counselors",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "Administrative Support",
        description:
          "Answer emails, voicemails, and service inquiries for Pima Animal Care Center. Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "administrative-support",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "PACC Greeter Crew",
        description:
          "Direct visitors, answer questions, and help locate animals at Pima Animal Care Center — roaming or front-desk roles. Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "greeter-crew",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "Transport",
        description:
          "Move animals to veterinary specialists, rescue partners, or new homes for Pima Animal Care Center. Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse. Note: likely involves riding in a transport vehicle — a prospective volunteer/parent should confirm exact driving/passenger expectations directly with the org, since this platform does not independently verify vehicle-related logistics.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "transport",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "Bin Buddies",
        description:
          "Sort community donations at Pima Animal Care Center's West campus (west-campus-only role, per the org's own page). Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "bin-buddies",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver. West campus only.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "Medical Cat Care Assistant",
        description:
          "Feed, weigh, and groom medical cats at Pima Animal Care Center's West campus (west-campus-only role, per the org's own page). Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "medical-cat-care-assistant",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver. West campus only.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        title: "Special Event Volunteers",
        description:
          "Staff adoption events and community tabling activities for Pima Animal Care Center's West campus (west-campus-only role, per the org's own page). Same 16-17-independent-after-orientation eligibility as this org's other 16-17 roles — see Dog Walkers for the full verbatim policy. Register via GivePulse.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "special-event-volunteers",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "one_time",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 16-17 may volunteer without a guardian present after an initial parent-supervised orientation and signed waiver. West campus only.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
      {
        // Deliberately a SEPARATE record from the 8 above, not folded
        // in: this is a genuinely different eligibility structure (a
        // parent/guardian must supervise and do the same activity the
        // ENTIRE TIME, not just sign a waiver up front) and a different,
        // narrower activity set (non-animal-handling only) — conflating
        // the two would misrepresent an accompanied-only role as
        // independently accessible. Same policy basis already
        // established this session for Arizona Small Dog Rescue's
        // Shelter Volunteer and precedented by the live-approved
        // az_game_fish connector: minimum_age set to the platform floor
        // (13, since the real evidence is 12+) with
        // parentalConsentRequired true and the accompaniment disclosed
        // plainly in the description, not hidden.
        title: "Family Volunteer Program (Ages 12-15, Parent/Guardian Required)",
        description:
          "Pima Animal Care Center welcomes volunteers ages 12-15 for non-animal-handling activities — sorting donated items, laundry, dishes, and stocking the Pet Pantry — plus the org's separate Paws and Pages community reading program. Confirmed directly via the org's own page, quoted verbatim: children ages 12-15 \"may volunteer with their parent/guardian supervising and doing [the] same activity as the child the entire time.\" This is a real, stronger-than-consent requirement — a parent/guardian must be present and actively participating for the full duration of every shift, not just sign a form beforehand (contrast with the 16-17 roles above, which only require an up-front orientation/waiver). minimum_age is set to this platform's own 13+ floor since the org's real stated minimum (12) is below it; the accompaniment requirement is disclosed here rather than implied to be independently accessible.",
        location: "4000 N Silverbell Rd, Tucson, AZ 85745",
        zip: "85745",
        geocodeCity: "Tucson, AZ",
        minimumAge: 13,
        applicationUrl: "https://pacc.givepulse.com/group/300666-pima-animal-care-center-volunteers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "family-volunteer-program",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 12-15, parent/guardian must supervise and do the same activity for the entire shift (per the org's own page, quoted verbatim).",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "pima-county-health-department",
    name: "Pima County Health Department",
    description:
      "Pima County's public health department, running the Counter Strike Program — a teen tobacco-compliance-check program in partnership with the Arizona Attorney General's Office and the Department of Public Safety.",
    websiteUrl: "https://www.pima.gov/2195/Volunteer-Opportunities",
    city: "Tucson, AZ",
    contactEmail: "CounterStrike@pima.gov",
    opportunities: [
      {
        title: "Counter Strike Program — Youth Tobacco Compliance Volunteer",
        description:
          "Pima County's Counter Strike Program, run by the Health Department in partnership with the Arizona Attorney General's Office and the Department of Public Safety (DPS), ensures Pima County tobacco retailers aren't selling to minors. Confirmed directly via the program's own official application packet: teen volunteers \"ages 14-17,\" accompanied at all times by two DPS officers/special agents (never alone), attempt to purchase tobacco using their real Arizona State ID at retailers once or twice a month; a sale results in a fine for the retailer. Transportation to inspection sites is provided by the county. Application requires both the teen and a parent/guardian to complete a mailed paper application (Youth Volunteer Application, Participation Agreement, Parent/Adult Guardian Consent, and Emergency Medical Consent forms) — mailed to the program address, not submitted online. The source document is dated \"Revised 06/20/2015\" but is still the current document served from the county's own site; staged as unverified (not open) pending human confirmation the program is still actively recruiting, per this platform's own \"don't assume undated/unclear-freshness sources are currently open\" convention.",
        location: "3950 S. Country Club Rd, Tucson, AZ 85714",
        zip: "85714",
        geocodeCity: "Tucson, AZ",
        minimumAge: 14,
        applicationUrl: "mailto:CounterStrike@pima.gov",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        availabilityNote: "Source application packet is dated 'Revised 06/20/2015' — still served from the county's own site, but currency not independently confirmed this session.",
        externalIdSuffix: "counter-strike-program",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Ages 14-17 (per the program's own official application packet).",
        timeCommitment: "Once or twice per month, afternoons/evenings.",
        programFocusTags: ["public_health", "public_safety"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "yuma-county-library-district",
    name: "Yuma County Library District",
    description:
      "Yuma County's public library system, running a teen volunteer program distinct from its general adult volunteer opportunities.",
    websiteUrl: "https://yumalibrary.org/volunteer/",
    city: "Yuma, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description:
          "Yuma County Library District's teen volunteer program. Confirmed directly via the library's own volunteer page: \"Must be at least 14 years of age,\" with a minimum 6-month commitment and at least 2 hours per week. A working online application is available (the library's own page links to it), plus a downloadable PDF alternative.",
        location: "2951 S. 21st Dr, Yuma, AZ 85364",
        zip: "85364",
        geocodeCity: "Yuma, AZ",
        minimumAge: 14,
        applicationUrl: "https://yumalibrary.org/volunteer/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Must be at least 14 years of age (per the library's own volunteer page).",
        timeCommitment: "Minimum 6-month commitment, at least 2 hours per week.",
        programFocusTags: ["literacy_education"],
        reviewStatus: "pending",
      },
    ],
  },

  // ---- Added 2026-08-31, third autonomous expansion session: Banner
  // Health teen-volunteer batch. bannerhealth.com's plain-fetch response
  // throws a "header overflow" parse error — the exact same pattern
  // ARCHITECTURE.md documents for Mayo Clinic/Banner/Red Cross earlier in
  // this project's history — so every page below was read via a real
  // Chrome browser (claude-in-chrome), not WebFetch. Unlike the earlier
  // Banner Desert / Banner-UMC Phoenix records (which predate this
  // technique and honestly note "no specific minimum age published"),
  // every record here has a real, per-facility numeric age pulled
  // directly off that facility's own Volgistics application FORM, not
  // just its landing page — Banner apparently states the exact age only
  // on the form itself for most locations, not the marketing page. Every
  // opportunity below has reviewStatus: "pending". ----

  {
    slug: "banner-heart-hospital",
    name: "Banner Heart Hospital",
    description:
      "Mesa cardiac specialty hospital on the Baywood campus, running a Teen Volunteer Application program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-heart-volunteer",
    city: "Mesa, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description:
          "Banner Heart Hospital's teen volunteer program. Confirmed directly on the hospital's own page: \"If you are a teen, between the ages of 14 and 17, and are interested in volunteering, please fill out our Teen Volunteer Application or call (480) 321-4122.\" Requires a full application, interview, and background check (up to 3 weeks), plus a commitment of at least 100 hours within 6 months or 1 shift per week (~4 hours).",
        location: "6750 E Baywood Ave, Mesa, AZ 85206",
        zip: "85206",
        geocodeCity: "Mesa, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.volgistics.com/appform/442477748",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Between the ages of 14 and 17 (per the hospital's own page).",
        timeCommitment: "At least 100 hours within 6 months, or 1 shift/week (~4 hours).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-baywood-medical-center",
    name: "Banner Baywood Medical Center",
    description:
      "Mesa medical center sharing a campus with Banner Heart Hospital, running its own separate Teen Volunteer Application program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-baywood-volunteer",
    city: "Mesa, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description:
          "Banner Baywood Medical Center's teen volunteer program, distinct from the co-located Banner Heart Hospital's own separate teen program. Confirmed directly: \"If you are a teen, between the ages of 14 and 17, and are interested in volunteering, please fill out our Teen Volunteer Application or call (480) 321-4122.\"",
        location: "6750 E Baywood Ave, Mesa, AZ 85206",
        zip: "85206",
        geocodeCity: "Mesa, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.bannerhealth.com/services/volunteer/banner-baywood-volunteer",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Between the ages of 14 and 17 (per the hospital's own page).",
        timeCommitment: "Approximately 4 hours per week.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-boswell-medical-center",
    name: "Banner Boswell Medical Center",
    description:
      "Sun City medical center running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-boswell-volunteer",
    city: "Sun City, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description:
          "Banner Boswell Medical Center's teen volunteer program. Confirmed directly on the actual Teen Volunteer Application form (not just the landing page): \"Please complete this application if you are 16 to 17 years of age... Teens ages 16-17 must have a parent or guardians consent to volunteer.\" Teen volunteers will not be placed in direct patient care assignments. Requires a minimum 100-hour/6-month commitment, one 4-hour shift/week.",
        location: "10401 W Thunderbird Blvd, Sun City, AZ 85351",
        zip: "85351",
        geocodeCity: "Sun City, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/308707636",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        directPatientContact: false,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16 to 17 years of age (per the teen application form itself).",
        timeCommitment: "Minimum 100 hours/6 months, one 4-hour shift per week.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-del-e-webb-medical-center",
    name: "Banner Del E Webb Medical Center",
    description:
      "Sun City West medical center running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-del-e-webb-volunteer",
    city: "Sun City West, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description:
          "Banner Del E. Webb Medical Center's teen volunteer program. Confirmed directly on the actual Teen Volunteer Application form: \"Please complete this application if you are 16 to 17 years of age... Teens ages 16-17 must have a parent or guardians consent to volunteer.\" Teen volunteers will not be placed in direct patient care assignments. Requires a minimum 100-hour/6-month commitment.",
        location: "14502 W Meeker Blvd, Sun City West, AZ 85375",
        zip: "85375",
        geocodeCity: "Sun City West, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/822353568",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        directPatientContact: false,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16 to 17 years of age (per the teen application form itself).",
        timeCommitment: "Minimum 100 hours/6 months, one 4-hour shift per week.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-goldfield-medical-center",
    name: "Banner Goldfield Medical Center",
    description:
      "Apache Junction medical center running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-goldfield-volunteer",
    city: "Apache Junction, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description:
          "Banner Goldfield Medical Center's teen volunteer program. Confirmed directly on the actual Teen Application form: \"By submitting this application, I certify that at the time of this application, I meet the minimum Teen Applicant Age Requirement of 16 years of age... Teens ages 16-17 must have a parent or guardians consent to volunteer.\" Teen volunteers will not be placed in direct patient care assignments.",
        location: "2050 W Southern Ave, Apache Junction, AZ 85120",
        zip: "85120",
        geocodeCity: "Apache Junction, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/1461006553",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        directPatientContact: false,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16 to 17 years of age (per the teen application form itself).",
        timeCommitment: "6 months to 1 year, one 4-hour shift per week.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-ironwood-medical-center",
    name: "Banner Ironwood Medical Center",
    description:
      "San Tan Valley medical center running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-ironwood-volunteer",
    city: "San Tan Valley, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description:
          "Banner Ironwood Medical Center's teen volunteer program. Confirmed directly on the actual Teen Application form: \"By submitting this application, I certify that at the time of this application, I meet the minimum Teen Applicant Age Requirement of 16 years of age... Teens ages 16-17 must have a parent or guardians consent to volunteer.\" Teen volunteers will not be placed in direct patient care assignments.",
        location: "37000 N Gantzel Rd, San Tan Valley, AZ 85140",
        zip: "85140",
        geocodeCity: "San Tan Valley, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/2110551425",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        directPatientContact: false,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16 to 17 years of age (per the teen application form itself).",
        timeCommitment: "6 months to 1 year, one 4-hour shift per week.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-ocotillo-medical-center",
    name: "Banner Ocotillo Medical Center",
    description:
      "Chandler medical center running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-ocotillo-volunteer",
    city: "Chandler, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description:
          "Banner Ocotillo Medical Center's teen volunteer program. Confirmed directly on the actual Teen Volunteer Application form: \"Please complete this application if you are 16 to 17 years of age and interested in becoming a Teen Volunteer at Banner Ocotillo Medical Center.\"",
        location: "1405 S Alma School Rd, Chandler, AZ 85286",
        zip: "85286",
        geocodeCity: "Chandler, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/243695064",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16 to 17 years of age (per the teen application form itself).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-thunderbird-medical-center",
    name: "Banner Thunderbird Medical Center",
    description:
      "Glendale medical center running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-thunderbird-volunteer",
    city: "Glendale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description:
          "Banner Thunderbird Medical Center's teen volunteer program. Confirmed directly on the actual Teen Volunteer Application form: \"Please complete this application if you are 16 to 17 years of age and interested in becoming a Teen Volunteer at Banner Thunderbird Medical Center.\"",
        location: "5555 W Thunderbird Rd, Glendale, AZ 85306",
        zip: "85306",
        geocodeCity: "Glendale, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/1777610600",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16 to 17 years of age (per the teen application form itself).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-estrella-medical-center",
    name: "Banner Estrella Medical Center",
    description:
      "Phoenix medical center running a Jr/Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-estrella-volunteer",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Jr/Teen Volunteer Application",
        description:
          "Banner Estrella Medical Center's teen volunteer program. Confirmed directly on the actual application form: \"This application is specifically for applicants that are 16-17 years of age (Jr/Teen Volunteers)... have your parent or guardian consent, and abide by the BEMC Jr. Teen Agreement.\" Teen volunteers will not be placed in direct patient care assignments. Not able to accommodate court-ordered community service.",
        location: "9201 W Thomas Rd, Phoenix, AZ 85037",
        zip: "85037",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/76108051",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "jr-teen-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        directPatientContact: false,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16-17 years of age (per the teen application form itself).",
        timeCommitment: "6 months or longer, one 3-4 hour shift per week.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "banner-university-medical-center-tucson",
    name: "Banner - University Medical Center Tucson",
    description:
      "Tucson teaching hospital and Banner-University Medicine market, covering Banner-University Medical Center Tucson, Banner-University Medical Center South, Diamond Children's Medical Center, Banner Cancer Centers, and Banner Clinics under one shared volunteer intake — distinct from the separate Banner - University Medical Center Phoenix (a different city/market).",
    websiteUrl: "https://www.bannerhealth.com/services/volunteer/banner-university-tucson-volunteer",
    city: "Tucson, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Banner-University Medicine Tucson Volunteer",
        description:
          "Banner-University Medicine's Tucson-market volunteer program, covering Banner-University Medical Center Tucson, Banner-University Medical Center South, Diamond Children's Medical Center, Banner Cancer Centers, and Banner Clinics under one shared intake process (the org's own interest form lets an applicant pick which of these facilities they're interested in). Confirmed directly: \"Must be 16 years of age or older.\" Also requires a minimum 2 hours/week for 6 months and 100 hours total, current immunization records, a group interview, and a background check. Specialty programs mentioned include Dog Therapy, Music Program, NICU, Pediatrics, and Spiritual Care.",
        location: "1501 N Campbell Ave, Tucson, AZ 85724",
        zip: "85724",
        geocodeCity: "Tucson, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.bannerhealth.com/services/volunteer/banner-university-tucson-volunteer",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Must be 16 years of age or older (per the org's own page).",
        timeCommitment: "Minimum 2 hours/week for 6 months, 100 hours total.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "northern-arizona-healthcare",
    name: "Northern Arizona Healthcare (Flagstaff Medical Center)",
    description:
      "Flagstaff's regional healthcare system, running a Teen Volunteer Program distinct from its general adult volunteer program.",
    websiteUrl: "https://www.nahealth.com/volunteer-services/volunteer-flagstaff-medical-center/",
    city: "Flagstaff, AZ",
    contactEmail: "volunteer@nahealth.org",
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description:
          "Northern Arizona Healthcare's teen volunteer program at Flagstaff Medical Center. Confirmed directly: \"We do have a teen volunteer program for individuals 16-17 years of age.\" Requires a dedicated teen application, interview, educational modules, employee health screening, background check, and on-campus training; some specific roles are restricted to 18+ (not all). The org's own page notes availability varies by department/assignment and advises checking periodically for new openings.",
        location: "1200 N Beaver St, Flagstaff, AZ 86001",
        zip: "86001",
        geocodeCity: "Flagstaff, AZ",
        minimumAge: 16,
        applicationUrl: "https://www.volgistics.com/appform/654405871",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        healthScreeningRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "16-17 years of age (per the org's own page); some specific roles restricted to 18+.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "onvida-health",
    name: "Onvida Health",
    description:
      "Yuma's regional health system (formerly Yuma Regional Medical Center), running a Junior Volunteer Program for high school students distinct from its general adult volunteer program.",
    websiteUrl: "https://www.onvidahealth.org/community/volunteer-program/",
    city: "Yuma, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Onvida Health's Junior Volunteer Program (Yuma). Confirmed directly via the org's own current page: \"Minimum age of 15\" and \"Junior Volunteer applications are now open.\" Participants must be enrolled in high school; parental consent required for all participants (ages 15-18, all minors or recent-minors while in high school). Commitment of 3-4 hours per week for a minimum of one semester or summer break.",
        location: "2400 S Avenue A, Yuma, AZ 85364",
        zip: "85364",
        geocodeCity: "Yuma, AZ",
        minimumAge: 15,
        applicationUrl: "https://www.volgistics.com/appform/701613850",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        parentalConsentRequired: true,
        programType: "volunteering",
        compensation: "unpaid",
        cost: "Free",
        eligibleGrades: "Minimum age 15, must be enrolled in high school (per the org's own page).",
        timeCommitment: "3-4 hours per week, minimum one semester or summer break.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Nationwide-expansion pass — first non-Arizona hospital-network batch.
  // Same "one org per hospital campus, per-hospital application pathway"
  // shape as the existing Banner Health (AZ) batch, since these are
  // likewise separately-run intake pipelines under one parent brand, not
  // one shared program. Every quote below is from that specific
  // hospital's own current page (fetched directly, not a search snippet)
  // as of 2026-08-31. Distance filtering (lib/matching.ts's
  // isWithinRange, hard filter) is what keeps these from ever appearing
  // on an Arizona student's Dashboard — see this session's nationwide-
  // expansion audit; no geographic gating needed here beyond real
  // coordinates.

  {
    slug: "north-shore-university-hospital",
    name: "North Shore University Hospital",
    description:
      "Manhasset, NY teaching hospital (Northwell Health) running a Junior Volunteer Program for high schoolers, separate from its adult/college volunteer program.",
    websiteUrl: "https://northwell.vsyslive.com/pages/NORTHSHORE",
    city: "Manhasset, NY",
    contactEmail: "nsuhvolunteerapp@northwell.edu",
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "North Shore University Hospital's Junior Volunteer Program, confirmed directly via the hospital's own current page: \"a year-round opportunity designed for high school students... Volunteers must be at least 15 years old.\" Applications are accepted exclusively through the hospital's own website and ONLY during two annual windows: Fall (Sept 1-7, orientation in November) and Summer (Apr 1-7, orientation in June) — outside those windows there is no application link to submit. Requires a minimum of 100 service hours in the first year, weekly 2-3 hour shifts, orientation, on-site training, and medical clearance from Northwell's own Team Member Health Services. The page explicitly states junior volunteers cannot be onboarded in the fall or spring of their senior year of high school, given the time commitment.",
        location: "North Shore University Hospital, 300 Community Drive, Manhasset, NY 11030",
        zip: "11030",
        geocodeCity: "Manhasset, NY",
        minimumAge: 15,
        applicationUrl: "https://northwell.vsyslive.com/pages/NORTHSHORE",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Applications open only Sept 1-7 (fall) and Apr 1-7 (summer) each year — the org's own page states no application link exists outside those windows.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "High school students only; cannot onboard in fall/spring of senior year per the org's own page.",
        healthScreeningRequired: true,
        timeCommitment: "100 hours minimum in first year; weekly 2-3 hour shifts.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "huntington-hospital-ny",
    name: "Huntington Hospital",
    description:
      "Huntington, NY hospital (Northwell Health) with a Junior Volunteer Program for ages 14-17 — currently paused to new applicants due to waitlist volume, per the hospital's own page.",
    websiteUrl: "https://northwell.vsyslive.com/pages/Huntington",
    city: "Huntington, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Huntington Hospital's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"The minimum age to volunteer is 14... junior volunteer program (ages 14-17). Due to an extensive waitlist, we're currently pausing new applications.\" Requires a 100-hour commitment per calendar year, professional interview, mandatory orientation, and medical clearance; volunteers 18+ additionally require a background screening. Summer-only applications are separately accepted March-April.",
        location: "Huntington Hospital, 270 Park Avenue, Huntington, NY 11743",
        zip: "11743",
        geocodeCity: "Huntington, NY",
        minimumAge: 14,
        applicationUrl: "https://northwell.vsyslive.com/pages/Huntington",
        applicationDeadline: null,
        availabilityStatus: "paused",
        availabilityNote: "The hospital's own page states, verbatim: \"Due to an extensive waitlist, we're currently pausing new applications.\"",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-17 (per the org's own page).",
        timeCommitment: "100 hours per calendar year; two 4-hour shifts weekly for summer-only applicants.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "lenox-hill-hospital",
    name: "Lenox Hill Hospital",
    description:
      "Manhattan (Upper East Side) hospital (Northwell Health) with a Junior Volunteer track for ages 16-17, processed in quarterly application cohorts.",
    websiteUrl: "https://northwell.vsyslive.com/pages/LENOX",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Lenox Hill Hospital's Junior Volunteer track. Confirmed directly via the hospital's own current page, quoted verbatim: \"Junior volunteers (ages 16-17) must submit working papers and complete a parental consent form.\" Applications are accepted year-round in quarterly cohorts with deadlines of March 1, June 1, September 1, and December 1 — an application received after a given date rolls to the next cohort rather than being rejected outright, so this reads as a standing, currently-open pathway rather than a narrow seasonal window. Requires a 100-hour annual commitment, interview, six-month probationary period, mandatory orientation, and medical clearance; volunteers 18+ additionally require a background screening.",
        location: "Lenox Hill Hospital, 100 E 77th St, New York, NY 10075",
        zip: "10075",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://northwell.vsyslive.com/pages/LENOX",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Rolling quarterly application deadlines (Mar 1 / Jun 1 / Sep 1 / Dec 1) — a late application rolls to the next cohort rather than closing outright, per the org's own page.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 16-17; must submit working papers (per the org's own page).",
        timeCommitment: "100 hours per calendar year.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "cohen-childrens-medical-center",
    name: "Cohen Children's Medical Center",
    description:
      "New Hyde Park, NY children's hospital (Northwell Health) running a summer-only Junior Volunteer program for ages 15-17, with a narrow annual application window.",
    websiteUrl: "https://northwell.vsyslive.com/pages/CCMC",
    city: "New Hyde Park, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Summer Program",
        description:
          "Cohen Children's Medical Center's Junior Volunteer Summer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"Junior volunteer summer program (ages 15-17)... Summer applications are accepted between February 1st and February 7th. Any applications received before or after the application period cannot be considered.\" Volunteers commit to a minimum of 50 hours over four consecutive weeks in July, four days per week (Monday-Thursday), 9am-1pm; applicants are notified in late February to early March only if invited for an interview.",
        location: "Cohen Children's Medical Center, 269-01 76th Avenue, New Hyde Park, NY 11040",
        zip: "11040",
        geocodeCity: "New Hyde Park, NY",
        minimumAge: 15,
        applicationUrl: "https://northwell.vsyslive.com/pages/CCMC",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states applications are accepted ONLY Feb 1-7 each year for a July program — outside that window there is no application to submit.",
        externalIdSuffix: "junior-volunteer-summer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "one_time",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per the org's own page).",
        timeCommitment: "Minimum 50 hours over 4 consecutive weeks in July, Mon-Thu 9am-1pm.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "phelps-hospital",
    name: "Phelps Hospital",
    description:
      "Sleepy Hollow, NY hospital (Northwell Health) with a Junior Volunteer track (minimum age 16), processed in quarterly application cohorts.",
    websiteUrl: "https://northwell.vsyslive.com/pages/PHELPS",
    city: "Sleepy Hollow, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Phelps Hospital's Junior Volunteer track. Confirmed directly via the hospital's own current page, quoted verbatim: \"Junior volunteers gain knowledge and exposure to the hospital environment... Requirements: Minimum age of 16.\" Applications are accepted year-round in quarterly cohorts with deadlines of March 1, June 1, September 1, and December 1 — an application received after a given date rolls to the next cohort, so this reads as a standing, currently-open pathway. Requires a 100-hour commitment per session, mandatory orientation, medical clearance, and a full background screening for applicants 18+ (working papers instead for ages 16-17).",
        location: "Phelps Hospital, 701 North Broadway, Sleepy Hollow, NY 10591",
        zip: "10591",
        geocodeCity: "Sleepy Hollow, NY",
        minimumAge: 16,
        applicationUrl: "https://northwell.vsyslive.com/pages/PHELPS",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "Rolling quarterly application deadlines (Mar 1 / Jun 1 / Sep 1 / Dec 1) — a late application rolls to the next cohort rather than closing outright, per the org's own page.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Minimum age 16; ages 16-17 provide working papers instead of a background screening (per the org's own page).",
        timeCommitment: "100 hours per session.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "mather-hospital",
    name: "Mather Hospital",
    description:
      "Port Jefferson, NY hospital (Northwell Health) with summer-specific Junior Volunteer placements for ages 15-18.",
    websiteUrl: "https://northwell.vsyslive.com/pages/mather",
    city: "Port Jefferson, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer Junior Volunteer Placement",
        description:
          "Mather Hospital's summer junior volunteer placements. Confirmed directly via the hospital's own current page, quoted verbatim: \"a minimum commitment of 100 hours per year is requested with the exception of summer placements for junior volunteers (ages 15-18).\" The page does not publish a specific annual application window (unlike several other Northwell hospitals in this batch, which do) — staged as seasonal since the role is explicitly summer-specific, not standing.",
        location: "Mather Hospital, 75 North Country Road, Port Jefferson, NY 11777",
        zip: "11777",
        geocodeCity: "Port Jefferson, NY",
        minimumAge: 15,
        applicationUrl: "https://northwell.vsyslive.com/pages/mather",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Explicitly a summer-specific junior placement (ages 15-18); the org's own page does not publish a specific application window, so current-window status could not be confirmed further.",
        externalIdSuffix: "summer-junior-volunteer-placement",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "one_time",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-18, summer placements only (per the org's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "university-of-colorado-hospital",
    name: "University of Colorado Hospital",
    description:
      "Aurora, CO teaching hospital (UCHealth) with a year-round Junior Volunteer Program for ages 16-17, distinct from its separate summer-only student program.",
    websiteUrl: "https://uclive.vsyslive.com/pages/app/juniorref",
    city: "Aurora, CO",
    contactEmail: "uchvolunteerservices@uchealth.org",
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "University of Colorado Hospital's Junior Volunteer Program, confirmed directly via the hospital's own current application page: those under 18 join the Junior Volunteer Program, and \"Junior Volunteers (ages 16-17) may also apply to volunteer throughout the year outside of the summer program\" — a standing, year-round track separate from the summer-only cohort. Requires online application, required education/HIPAA training modules, and a small-group remote interview (webcam required); a minimum 100-hour commitment applies.",
        location: "University of Colorado Hospital, 12605 E. 16th Avenue, Aurora, CO 80045",
        zip: "80045",
        geocodeCity: "Aurora, CO",
        minimumAge: 16,
        applicationUrl: "https://uclive.vsyslive.com/pages/app/juniorref",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the org's own application page).",
        timeCommitment: "100 hours minimum commitment.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "uchealth-highlands-ranch-hospital",
    name: "UCHealth Highlands Ranch Hospital",
    description:
      "Highlands Ranch, CO hospital (UCHealth, South Metro Denver region) with a Teen Volunteer Application for high schoolers ages 16-18, covering the hospital and its Inverness Ambulatory Surgery Center.",
    websiteUrl: "https://uclive2.vsyslive.com/pages/app/HRHTeen",
    city: "Highlands Ranch, CO",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description:
          "UCHealth Highlands Ranch Hospital's Teen Volunteer Application (South Metro Denver region). Confirmed directly via the hospital's own current application page, quoted verbatim: \"Applicants must be 16 - 18 years of age and in high school.\" The page notes high application volume with selective acceptance; it does not state a specific closed season, and reads as a standing (not date-gated) program.",
        location: "UCHealth Highlands Ranch Hospital, 1500 Park Central Drive, Highlands Ranch, CO 80129",
        zip: "80129",
        geocodeCity: "Highlands Ranch, CO",
        minimumAge: 16,
        applicationUrl: "https://uclive2.vsyslive.com/pages/app/HRHTeen",
        applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "The org's own page notes high application volume and selective acceptance, but does not state the program is currently closed.",
        externalIdSuffix: "teen-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-18, must be in high school (per the org's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // San José Public Library's "King Library - Youth Services" runs on
  // Better Impact too, but as a flat PublicOrganization page shaped
  // differently from both Mesa/Gilbert/Sacramento's facet-driven search
  // AND Multnomah County Library's title-embedded ages: each activity's
  // own detail page has a plainly labeled "Qualifications Required Age:
  // Must be at least N+" field instead. Only 5-6 total activities (below
  // this session's connector-effort threshold for a third parser
  // variant), so added as manual records instead — same choice this
  // project already makes for any small, single-org source. One activity
  // found on the same org page (ChAD 60 Homework Coach, "age 15+") was
  // excluded: its own Qualifications section also requires "Are you a
  // ChAD student at SJSU? Must be Yes" — restricted to San José State
  // University Communicative Disorders and Sciences students specifically,
  // not independently actionable for a general teen applicant despite the
  // stated age floor.
  {
    slug: "san-jose-public-library-king-library-youth-services",
    name: "San José Public Library — King Library Youth Services",
    description:
      "Teen-focused volunteer programs run out of San José Public Library's Dr. Martin Luther King Jr. Library (King Library) Youth Services department, plus a citywide teen civic-engagement council and a home-based virtual role — coordinated through the library's own MyImpactPage volunteer portal.",
    websiteUrl: "https://app.betterimpact.com/PublicOrganization/972f1f4f-9417-4fb5-9865-8f141718713d",
    city: "San Jose, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Authors Corner",
        description:
          "San José Public Library's Teen Authors Corner. Confirmed directly via the activity's own current page: \"Qualifications Required Age: Must be at least 13+.\" Volunteers help plan and run writing critique circles and other teen writing events/activities (both virtually and in-person), facilitate monthly critique circle meetings, and attend planning meetings with the program's teen leadership team.",
        location: "Dr. Martin Luther King Jr. Library, 150 E San Fernando St, San Jose, CA 95112",
        zip: "95112",
        geocodeCity: "San Jose, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/972f1f4f-9417-4fb5-9865-8f141718713d/Activity/1f239d86-26fc-4004-a6e5-aded08233a89/1",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        externalIdSuffix: "teen-authors-corner",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Must be at least 13 (per the org's own Qualifications field).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "Teen Library Volunteer",
        description:
          "San José Public Library's general Teen Library Volunteer application. Confirmed directly via the activity's own current page: \"Potential teen volunteers (ages 13-17) can use this application as a general application for teen volunteer opportunities in Youth Services at the Dr. Martin Luther King Jr. Library.\" A librarian follows up to discuss current vacancies. Activities can include toy cleaning/sanitizing, program preparation, display decoration, program support, crowd control for performers, and co-leading academic-support programs like Reading Buddies or Homework Club. Explicitly NOT the application for Teens Reach or Teen Book Reviewer, which use separate forms (both included separately in this batch).",
        location: "Dr. Martin Luther King Jr. Library, 150 E San Fernando St, San Jose, CA 95112",
        zip: "95112",
        geocodeCity: "San Jose, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/972f1f4f-9417-4fb5-9865-8f141718713d/Activity/4c1b1465-1bcd-4faf-8705-c118551e349d/1",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        externalIdSuffix: "teen-library-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "Teens Reach",
        description:
          "San José Public Library's Teens Reach program. Confirmed directly via the activity's own current page: \"Be part of a fun volunteering opportunity for teens between the ages of 13-17\" and \"Requirements: Age must be between the ages of 13-17 years old. Obtain parent/guardian consent to volunteer via online form.\" Volunteers assist with and promote library programs, represent the library's teen point-of-view to the library community, and build leadership skills.",
        location: "Dr. Martin Luther King Jr. Library, 150 E San Fernando St, San Jose, CA 95112",
        zip: "95112",
        geocodeCity: "San Jose, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/972f1f4f-9417-4fb5-9865-8f141718713d/Activity/46e9cd7b-a3fd-4df3-95b0-31d537fd644d/1",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        externalIdSuffix: "teens-reach",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 13-17 (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "Teen Book Reviewer",
        description:
          "San José Public Library's Teen Book Reviewer program — a fully home-based virtual role. Confirmed directly via the activity's own current page: \"Qualifications Required Age: Must be at least 13+.\" Volunteers write book reviews (each counting as one hour, up to 10 reviews/quarter) and post them publicly on the library's catalog site. The org's own page states virtual opportunities are exclusively available to California residents.",
        location: null,
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/972f1f4f-9417-4fb5-9865-8f141718713d/Activity/434ba341-033f-4592-81da-a71544b61f1b/1",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        externalIdSuffix: "teen-book-reviewer",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Must be at least 13 (per the org's own page); California residents only.",
        deliveryMode: "virtual",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "San José Youth Advisory Council (YAC)",
        description:
          "The City of San José's Youth Commission — the official youth advisory group to the Mayor and City Council. Confirmed directly via the activity's own current page: \"Qualifications Required Age: Must be at least 13+.\" Youth Commissioners develop policy recommendations on youth issues, attend monthly Youth Commission meetings/trainings, and help form district-wide Youth Advisory Councils.",
        location: "San José City Hall, 200 E Santa Clara St, San Jose, CA 95113",
        zip: "95113",
        geocodeCity: "San Jose, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/972f1f4f-9417-4fb5-9865-8f141718713d/Activity/5f76d72e-9e8f-4326-b2c7-d93d93ff9e91/1",
        applicationDeadline: null,
        availabilityStatus: "unverified",
        externalIdSuffix: "youth-advisory-council",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Must be at least 13 (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Phase 2 continuation: additional Northwell Health hospital, same
  // VSys One platform and one-org-per-campus shape as the 6 already
  // shipped.
  {
    slug: "glen-cove-hospital",
    name: "Glen Cove Hospital",
    description:
      "Glen Cove, NY hospital (Northwell Health) with a Junior Volunteer Program for ages 16-18.",
    websiteUrl: "https://northwell.vsyslive.com/pages/GLENCOVE",
    city: "Glen Cove, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Glen Cove Hospital's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"The Junior Volunteer Program offers young people ages 16 to 18 the opportunity to choose from many areas of hospital service while serving their community and familiarizing themselves with the varied careers within a hospital setting.\" Junior volunteers must submit working papers and a letter of recommendation from a guidance counselor, in addition to medical clearance, a background check, and an interview with the director of volunteer experience. The application process takes three to five weeks. No specific annual application window is published — reads as a standing, currently-open pathway, same as Lenox Hill/Phelps.",
        location: "Glen Cove Hospital, 101 St. Andrews Lane, Glen Cove, NY 11542",
        zip: "11542",
        geocodeCity: "Glen Cove, NY",
        minimumAge: 16,
        applicationUrl: "https://northwell.vsyslive.com/pages/GLENCOVE",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        backgroundCheckRequired: true,
        eligibleGrades: "Ages 16-18; must submit working papers and a guidance-counselor letter of recommendation (per the org's own page).",
        timeCommitment: "Application process takes 3-5 weeks.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Mount Sinai Health System is a DIFFERENT VSys One tenant from
  // Northwell Health (a genuinely separate hospital system) — reached
  // via a real browser session after curl/WebFetch were both WAF-
  // blocked (Akamai "Access Denied") on mountsinai.org directly; this is
  // the same access a real visitor gets, not a circumvention. Mount
  // Sinai's own Student Research Volunteer program (ages 15-16) was
  // checked and explicitly excluded — its own page states "we are only
  // able to accept applications from people who already have
  // assignments with a Principal Investigator," failing this app's
  // "distinct, independently-actionable role" requirement, the same
  // reasoning Staten Island University Hospital's Physician/PA Observer
  // program was already excluded for in an earlier session.
  {
    slug: "mount-sinai-south-nassau",
    name: "Mount Sinai South Nassau",
    description:
      "Oceanside, NY hospital (Mount Sinai Health System) with a Junior Volunteer Program for high-school-aged volunteers ages 15-17.",
    websiteUrl: "https://www.mountsinai.org/locations/south-nassau/about/volunteer",
    city: "Oceanside, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Mount Sinai South Nassau's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"Mount Sinai South Nassau welcomes high school-aged young adults ages 15-17 to volunteer with us. You can work after school or during spring and summer breaks.\" Volunteers work with patients or assist with clerical/courier duties; some junior volunteers are eligible for the Dorothy M. Sharer Health Care Scholarship ($250-$1,000) upon graduating. The page separately states, quoted verbatim: \"Our applications for the Junior Summer Program are now closed and will reopen in the fall, or at a later date depending on hospital needs\" — no specific reopen date is published, so this is staged seasonal rather than open.",
        location: "Mount Sinai South Nassau, One Healthy Way, Oceanside, NY 11572",
        zip: "11572",
        geocodeCity: "Oceanside, NY",
        minimumAge: 15,
        applicationUrl: "https://www.mountsinai.org/locations/south-nassau/about/volunteer",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Our applications for the Junior Summer Program are now closed and will reopen in the fall, or at a later date depending on hospital needs.\" No specific reopen date published.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "High-school-aged, ages 15-17 (per the org's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Phase 2 continuation, second wave.
  {
    slug: "cleveland-clinic-avon-hospital",
    name: "Cleveland Clinic Avon Hospital",
    description:
      "Avon, OH hospital (Cleveland Clinic) with a Junior Volunteer Application for ages 15-17.",
    websiteUrl: "https://my.clevelandclinic.org/locations/avon-hospital/about/volunteer/junior-volunteer-application",
    city: "Avon, OH",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Application",
        description:
          "Cleveland Clinic Avon Hospital's Junior Volunteer Application. Confirmed directly via the hospital's own current page, quoted verbatim: \"Thank you for your interest in becoming a volunteer at Avon Hospital. The application below is intended for applicants ages 15 to 17.\" The online application asks for parent/guardian name and contact, school, grade, and availability. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Cleveland Clinic Avon Hospital, 33300 Cleveland Clinic Blvd., Avon, OH 44011",
        zip: "44011",
        geocodeCity: "Avon, OH",
        minimumAge: 15,
        applicationUrl: "https://my.clevelandclinic.org/locations/avon-hospital/about/volunteer/junior-volunteer-application",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 15-17 (per the org's own application page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "long-beach-parks-recreation-marine",
    name: "City of Long Beach Department of Parks, Recreation and Marine",
    description:
      "Long Beach, CA municipal parks department with a Teen Volunteer program for ages 13-17, coordinated through its own MyImpactPage volunteer portal (Better Impact). Only this one of the department's five listed volunteer programs states an explicit numeric age — the other four (Youth Sports Assistant, El Dorado Nature Center, Teen Center Programs, Senior Center Programs) mention no age at all and are deliberately not included here.",
    websiteUrl: "https://app.betterimpact.com/PublicOrganization/7fc2fd93-e8cd-47c3-9d3a-392e56c6ebaf/1",
    city: "Long Beach, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Opportunities for Teen Volunteers (Ages 13-17)",
        description:
          "The Department of Parks, Recreation and Marine's teen program. Confirmed directly via the activity's own current page, quoted verbatim: \"General Qualifications and Requirements: Must be between the ages of 13-17.\" The program exists to provide teens a safe, positive environment to build personal and social skills and leadership; year-round Program Assistant roles support After School, Youth Sports, Senior Center, and Teen Center activities (setup/cleanup, planning games and activities, safety enforcement). No specific annual application window is published — reads as a standing, year-round program.",
        location: "2760 N. Studebaker Rd., Long Beach, CA 90815",
        zip: "90815",
        geocodeCity: "Long Beach, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/7fc2fd93-e8cd-47c3-9d3a-392e56c6ebaf/Gvi/058e8ad7-eab5-4b54-b843-64d761114bfc/1",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteers-ages-13-17",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Phase 2 continuation, third wave: 2 more VSys One hospitals + a
  // Better Impact municipal parks tenant. Baylor Scott & White operates
  // multiple independent hospital campuses on the same bsw.vsyslive.com
  // tenant, each with its own distinct Junior Volunteer program — same
  // one-org-per-campus shape already established for Northwell Health.
  {
    slug: "baylor-scott-white-temple",
    name: "Baylor Scott & White Medical Center – Temple",
    description:
      "Temple, TX hospital (Baylor Scott & White Health) with a Junior Volunteer Ambassador program for ages 16-17.",
    websiteUrl: "https://bsw.vsyslive.com/pages/Temple",
    city: "Temple, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Ambassador",
        description:
          "Baylor Scott & White Medical Center – Temple's Junior Volunteer Ambassador program. Confirmed directly via the hospital's own current page, quoted verbatim: \"We have volunteer opportunities for 16 - 17 year old students for our Jr. Volunteer program.\" The role's own listing states: \"Assist with non-clinical duties in various areas within the hospital. Areas will be assigned based on greatest need,\" including wayfinding/escorting patients and visitors, stocking supplies, and clerical duties. Its own qualifications explicitly state \"Parental consent required.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Baylor Scott & White Medical Center – Temple, 2401 S 31st St, Temple, TX 76508",
        zip: "76508",
        geocodeCity: "Temple, TX",
        minimumAge: 16,
        applicationUrl: "https://bsw.vsyslive.com/pages/Apply",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-ambassador",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 16-17 (per the org's own page).",
        timeCommitment: "3 to 4 hours per week, shifts vary.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "baylor-scott-white-grapevine",
    name: "Baylor Scott & White Medical Center – Grapevine",
    description:
      "Grapevine, TX hospital (Baylor Scott & White Health) with a Junior Volunteer Program for ages 16-18. A genuinely distinct campus from Temple, on the same platform.",
    websiteUrl: "https://bsw.vsyslive.com/pages/GRAPEVINE",
    city: "Grapevine, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Baylor Scott & White Medical Center – Grapevine's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"Our summer junior program is for high school students entering 11th - 12th grades in the fall of 2026 (ages 16-18), who have not previously participated in Baylor Scott & White Medical Center - Grapevine's Summer Junior Volunteer Program.\" The same page also states, quoted verbatim: \"Our 2026 Junior Volunteer Program is now closed.\" No reopen date is published — staged seasonal rather than open, same treatment as Mount Sinai South Nassau's closed program.",
        location: "Baylor Scott & White Medical Center – Grapevine, 1650 W College St, Grapevine, TX 76051",
        zip: "76051",
        geocodeCity: "Grapevine, TX",
        minimumAge: 16,
        applicationUrl: "https://bsw.vsyslive.com/pages/Apply",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Our 2026 Junior Volunteer Program is now closed.\" No reopen date published.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Rising 11th-12th graders, ages 16-18 (per the org's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "harris-health",
    name: "Harris Health",
    description:
      "Public healthcare safety-net system serving Harris County, TX (Ben Taub Hospital, Lyndon B. Johnson Hospital, and community health centers) with a Summer Junior Volunteer Program for age 14+.",
    websiteUrl: "https://harrishealth.vsyslive.com",
    city: "Houston, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Harris Health's Summer Junior Volunteer Program. Confirmed directly via the org's own current FAQ, quoted verbatim: \"The minimum age to volunteer is 18. However, for the Summer Junior Volunteer Program, the minimum age is 14.\" (The general 18+ floor does NOT apply to this specific program.) The program card itself states: \"The Junior Volunteer Program builds vital partnerships with students who are interested in making a difference in the lives of others. Students are provided with an opportunity to explore the healthcare field while enriching the lives of our patients and giving back to the community.\" The same card states, quoted verbatim: \"Applications open in February.\" — staged seasonal.",
        location: "Ben Taub Hospital, 1504 Taub Loop, Houston, TX 77030",
        zip: "77030",
        geocodeCity: "Houston, TX",
        minimumAge: 14,
        applicationUrl: "https://harrishealth.vsyslive.com/pages/junior",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Applications open in February.\" No specific date published.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Age 14+ for the Summer Junior Volunteer Program specifically (per the org's own FAQ).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "santa-barbara-cottage-hospital",
    name: "Santa Barbara Cottage Hospital",
    description:
      "Santa Barbara, CA hospital (Cottage Health) with a general Volunteer Application program open to all volunteers age 14+.",
    websiteUrl: "https://sbch.vsyslive.com/pages/HOME",
    city: "Santa Barbara, CA",
    contactEmail: "volunteering@sbch.org",
    opportunities: [
      {
        title: "Volunteer Application",
        description:
          "Santa Barbara Cottage Hospital's general Volunteer Application. Confirmed directly via the hospital's own current FAQ, quoted verbatim: \"All volunteers must be at least 14 years of age (in high school) or older. All volunteers 18 years old and older will be required to complete a background check.\" (No separate handling or role restriction is stated for the 14-17 tier — the extra background-check step applies only to the 18+ tier.) Most positions ask for a weekly 4-hour shift and a minimum of 100 hours of service (about 6 months). An in-person interview at the hospital is required. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Santa Barbara Cottage Hospital, 400 W. Pueblo St., Santa Barbara, CA 93105",
        zip: "93105",
        geocodeCity: "Santa Barbara, CA",
        minimumAge: 14,
        applicationUrl: "https://sbch.vsyslive.com/pages/app/VOLAPP",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14+ (in high school), per the org's own FAQ.",
        timeCommitment: "Weekly 4-hour shift; minimum 100 hours of service (about 6 months).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "virtua-health",
    name: "Virtua Health",
    description:
      "South Jersey hospital system (Virtua Health) with a Junior Volunteer program for ages 14-18, coordinated across its member hospitals including Virtua Voorhees, Virtua Marlton, Virtua Memorial, Virtua Mount Holly, and Virtua Our Lady of Lourdes.",
    websiteUrl: "https://virtua.vsyslive.com/pages/FAQ",
    city: "Voorhees, NJ",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Applications",
        description:
          "Virtua Health's Junior Volunteer program. Confirmed directly via the org's own current FAQ (both on its vsyslive.com portal and independently corroborated on virtua.org), quoted verbatim: \"We offer volunteer opportunities for adults (18+ years old) as well as juniors (ages 14-18 years).\" Prospective volunteers are asked to call a site's own Volunteer Coordinator to begin the process. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Virtua Voorhees Hospital, 100 Bowman Dr., Voorhees, NJ 08043",
        zip: "08043",
        geocodeCity: "Voorhees, NJ",
        minimumAge: 14,
        applicationUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-applications",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-18 (per the org's own FAQ).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Phase 2 continuation, fourth wave: 4 more Northwell Health hospitals
  // (same VSys One one-org-per-campus shape as the 7 already shipped)
  // plus King County Library System's one qualifying activity.
  {
    slug: "long-island-jewish-forest-hills",
    name: "Long Island Jewish Forest Hills",
    description:
      "Forest Hills, NY hospital (Northwell Health) with a Junior Volunteer Program for ages 16-18.",
    websiteUrl: "https://northwell.vsyslive.com/pages/LIJFORESTHILLS",
    city: "Forest Hills, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Long Island Jewish Forest Hills's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: minimum age to volunteer is 16, and \"Junior volunteers (ages 16-18)\" is the stated program band. Volunteers commit to 100 hours per year. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Long Island Jewish Forest Hills, 102-01 66th Road, Forest Hills, NY 11375",
        zip: "11375",
        geocodeCity: "Forest Hills, NY",
        minimumAge: 16,
        applicationUrl: "https://northwell.vsyslive.com/pages/LIJFORESTHILLS",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-18 (per the org's own page).",
        timeCommitment: "100 hours per year.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "long-island-jewish-medical-center",
    name: "Long Island Jewish Medical Center",
    description:
      "New Hyde Park, NY hospital (Northwell Health) with a Summer Junior Volunteer Program for ages 14-17.",
    websiteUrl: "https://northwell.vsyslive.com/pages/LIJMEDICALCENTER",
    city: "New Hyde Park, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer Junior Volunteer Program",
        description:
          "Long Island Jewish Medical Center's Summer Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"Summer Junior Volunteer Program... age 14-17.\" The same page states applications are accepted only \"between February 1 and February 15\" each year — outside that window currently, staged seasonal rather than open.",
        location: "Long Island Jewish Medical Center, 270-05 76th Avenue, New Hyde Park, NY 11040",
        zip: "11040",
        geocodeCity: "New Hyde Park, NY",
        minimumAge: 14,
        applicationUrl: "https://northwell.vsyslive.com/pages/LIJMEDICALCENTER",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states applications are accepted only between February 1 and February 15 each year. Outside that window as of this session.",
        externalIdSuffix: "summer-junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-17 (per the org's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "long-island-jewish-valley-stream",
    name: "Long Island Jewish Valley Stream",
    description:
      "Valley Stream, NY hospital (Northwell Health) with a Junior Volunteer Program for ages 16-17.",
    websiteUrl: "https://northwell.vsyslive.com/pages/LIJVALLEYSTREAM",
    city: "Valley Stream, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Long Island Jewish Valley Stream's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"Junior volunteers are 16-17 years of age.\" The same page states the summer application \"must be completed... submitted by May 1st\" each year — outside that window currently, staged seasonal rather than open.",
        location: "Long Island Jewish Valley Stream, 900 Franklin Ave, Valley Stream, NY 11580",
        zip: "11580",
        geocodeCity: "Valley Stream, NY",
        minimumAge: 16,
        applicationUrl: "https://northwell.vsyslive.com/pages/LIJVALLEYSTREAM",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states the summer junior volunteer application must be submitted by May 1st each year. Outside that window as of this session.",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the org's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "peconic-bay-medical-center",
    name: "Peconic Bay Medical Center",
    description:
      "Riverhead, NY hospital (Northwell Health) with a Junior Volunteer Program for ages 16-17.",
    websiteUrl: "https://northwell.vsyslive.com/pages/PECONICBAY",
    city: "Riverhead, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Peconic Bay Medical Center's Junior Volunteer Program. Confirmed directly via the hospital's own current page, quoted verbatim: \"You must be 16-17 years of age\" for junior volunteers, with a minimum of 75 hours of service. No specific annual application window is published — reads as a standing, currently-open pathway; the page separately notes its ED Ambassador program (a different, adult-oriented role) is currently accepting applications.",
        location: "Peconic Bay Medical Center, 1 Heroes Way, Riverhead, NY 11901",
        zip: "11901",
        geocodeCity: "Riverhead, NY",
        minimumAge: 16,
        applicationUrl: "https://northwell.vsyslive.com/pages/PECONICBAY",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the org's own page).",
        timeCommitment: "Minimum 75 hours of service.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "king-county-library-system",
    name: "King County Library System",
    description:
      "49-branch public library system serving King County, WA. Only one of its listed Better Impact volunteer activities (Burien Tech Tutor) states an explicit numeric age — its 2 \"Teen\" council/board activities use only the bare word \"teen\" with no number, and its other 2 Tech Tutor roles are 18+-only; those 4 are deliberately not included here.",
    websiteUrl: "https://app.betterimpact.com/PublicOrganization/4971bb69-bc61-4086-b183-c0b7d17cc18a/1",
    city: "Burien, WA",
    contactEmail: "mtarcorace@kcls.org",
    opportunities: [
      {
        title: "Burien Tech Tutor",
        description:
          "Volunteer Tech Tutor at the Burien Library, offering one-on-one help with basic technology questions in drop-in tech sessions. Confirmed directly via the activity's own current page, quoted verbatim under Qualifications: \"15 years or older.\" A Parental Consent Form is required if under 18. Also requires a WA State background check, Volunteer Agreement Form, and orientation attendance. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Burien Library, near Rapid Ride F & H / Burien Transit Center, Burien, WA 98166",
        zip: "98166",
        geocodeCity: "Burien, WA",
        minimumAge: 15,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/4971bb69-bc61-4086-b183-c0b7d17cc18a/Gvi/1ac331b0-31e6-4435-90b5-e7ba019abee6/1",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "burien-tech-tutor",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        backgroundCheckRequired: true,
        eligibleGrades: "Ages 15+ (per the activity's own page).",
        timeCommitment: "Wednesday or Thursday, shift negotiable.",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Phase 2 continuation, fifth wave: Fremont Main Library (Alameda
  // County Library, CA) — found via a Better Impact age-text search.
  // Only 2 of its 5 listed activities have a real numeric age: English
  // Buddies and Teen Advisory Group both only state "Age Level Must be
  // at least High School Teen" (no number, deliberately excluded);
  // Booklegger is adult-only per its own section header. Palo Alto City
  // Library and the "Atherton" page (an existing San Mateo County
  // Libraries branch, already covered by sanMateoCountyLibraries.ts)
  // were also checked this pass and yielded nothing new — not added.
  {
    slug: "fremont-main-library",
    name: "Fremont Main Library",
    description:
      "Fremont, CA public library (Alameda County Library system) with 2 confirmed teen volunteer roles: Seed Library (ages 12-18, in-person) and Virtual Book Reviewer (ages 13-17, virtual).",
    websiteUrl: "https://app.betterimpact.com/PublicOrganization/76b4ccce-eabc-4203-b14b-c1fac01f32c0/1",
    city: "Fremont, CA",
    contactEmail: "ebuchanan@aclibrary.org",
    opportunities: [
      {
        title: "Seed Library",
        description:
          "Help package, label, and file seeds for the library's seed library, available for the public to take and plant. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"Be 12-18 years old.\" Also requires ability to work independently and a commitment of 1-2 hours/week for at least 3 months. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Fremont Main Library, 2400 Stevenson Blvd, Fremont, CA 94538",
        zip: "94538",
        geocodeCity: "Fremont, CA",
        minimumAge: 12,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/76b4ccce-eabc-4203-b14b-c1fac01f32c0/Activity/83297fa8-0eff-4406-836f-f92263dbf0a3/1",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "seed-library",
        category: "Environment",
        interestsTags: ["environment"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 12-18 (per the activity's own page).",
        timeCommitment: "1-2 hours/week for at least 3 months.",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "Virtual Book Reviewer",
        description:
          "Write book reviews and curated reading lists for the library's online catalog, helping fellow teens find books. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"You must be 13 years old or older and You must be 17 years old or younger.\" Book reviews must be 100+ words; book lists must contain 10+ titles. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Fremont Main Library, 2400 Stevenson Blvd, Fremont, CA 94538",
        zip: null,
        geocodeCity: null,
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/PublicOrganization/76b4ccce-eabc-4203-b14b-c1fac01f32c0/Activity/b8e8f323-b92a-4df8-84c9-e9d54deb5b18/1",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "virtual-book-reviewer",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
        deliveryMode: "virtual",
      },
    ],
  },

  // Continuation, sixth wave: Nuvance Health hospitals (a Northwell
  // Health affiliate, same VSys One platform, but on its OWN separate
  // portal at nuvancehealth.vsyslive.com rather than northwell.vsyslive.com
  // — confirmed live directly). The portal's own FAQ states a single,
  // network-wide policy governing every "Student"/"Junior" application
  // link on the homepage, quoted verbatim: "It is our policy that junior
  // volunteers must be at least 16 years of age at the start of their
  // service." Danbury, New Milford, and Sharon Hospitals share ONE
  // application link/pathway (their own homepage groups them together
  // under a single "Students (16 and up)" application) — genuinely
  // distinct physical hospitals, correctly staged as 3 separate org
  // records sharing one application_url (same shared-portal pattern
  // already established for Baylor Scott & White Temple/Grapevine).
  {
    slug: "danbury-hospital",
    name: "Danbury Hospital",
    description:
      "Danbury, CT hospital (Nuvance Health, a Northwell Health affiliate) with a Student Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "Danbury, CT",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Volunteer Application",
        description:
          "Danbury Hospital's Student Volunteer Program, shared with New Milford and Sharon Hospitals under one application pathway. Confirmed directly via the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Danbury Hospital, 24 Hospital Ave, Danbury, CT 06810",
        zip: "06810",
        geocodeCity: "Danbury, CT",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/STUDENT",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "new-milford-hospital",
    name: "New Milford Hospital",
    description:
      "New Milford, CT hospital (Nuvance Health, a Northwell Health affiliate) with a Student Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "New Milford, CT",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Volunteer Application",
        description:
          "New Milford Hospital's Student Volunteer Program, shared with Danbury and Sharon Hospitals under one application pathway. Confirmed directly via the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "New Milford Hospital, 21 Elm St, New Milford, CT 06776",
        zip: "06776",
        geocodeCity: "New Milford, CT",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/STUDENT",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "sharon-hospital",
    name: "Sharon Hospital",
    description:
      "Sharon, CT hospital (Nuvance Health, a Northwell Health affiliate) with a Student Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "Sharon, CT",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Volunteer Application",
        description:
          "Sharon Hospital's Student Volunteer Program, shared with Danbury and New Milford Hospitals under one application pathway. Confirmed directly via the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Sharon Hospital, 50 Hospital Hill Rd, Sharon, CT 06069",
        zip: "06069",
        geocodeCity: "Sharon, CT",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/STUDENT",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "northern-dutchess-hospital",
    name: "Northern Dutchess Hospital",
    description:
      "Rhinebeck, NY hospital (Nuvance Health, a Northwell Health affiliate) with a Student Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "Rhinebeck, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Volunteer Application",
        description:
          "Northern Dutchess Hospital's Student Volunteer Program. Confirmed directly via the hospital's own current application page title, \"Northern Dutchess Hospital Student Volunteer Application (Minor 16+),\" and the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Northern Dutchess Hospital, 6511 Springbrook Ave, Rhinebeck, NY 12572",
        zip: "12572",
        geocodeCity: "Rhinebeck, NY",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/NDHSTUDENT",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "norwalk-hospital",
    name: "Norwalk Hospital",
    description:
      "Norwalk, CT hospital (Nuvance Health, a Northwell Health affiliate) with a Student Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "Norwalk, CT",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Volunteer Application",
        description:
          "Norwalk Hospital's Student Volunteer Program. Confirmed directly via the hospital's own current application page title, \"Norwalk Student Volunteer Application (FULL YEAR UNDER 18),\" and the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Norwalk Hospital, 24 Stevens Street, Norwalk, CT 06856",
        zip: "06856",
        geocodeCity: "Norwalk, CT",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/STUDENTNORWALK",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "putnam-hospital-center",
    name: "Putnam Hospital Center",
    description:
      "Carmel, NY hospital (Nuvance Health, a Northwell Health affiliate) with a Junior Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "Carmel, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Application",
        description:
          "Putnam Hospital Center's Junior Volunteer Program. Confirmed directly via the hospital's own current application page title, \"Putnam Hospital Junior Volunteer Application (16+),\" and the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Putnam Hospital Center, 670 Stoneleigh Avenue, Carmel, NY 10512",
        zip: "10512",
        geocodeCity: "Carmel, NY",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/PUTNAMJR",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "vassar-brothers-medical-center",
    name: "Vassar Brothers Medical Center",
    description:
      "Poughkeepsie, NY hospital (Nuvance Health, a Northwell Health affiliate) with a Student Volunteer Program for ages 16+.",
    websiteUrl: "https://nuvancehealth.vsyslive.com",
    city: "Poughkeepsie, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Volunteer Application",
        description:
          "Vassar Brothers Medical Center's Student Volunteer Program. Confirmed directly via the hospital's own current application page title, \"Vassar Brothers Medical Center - Volunteer Applications for Students (16 and up),\" and the Nuvance Health VSys One portal's own current FAQ, quoted verbatim: \"It is our policy that junior volunteers must be at least 16 years of age at the start of their service.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Vassar Brothers Medical Center, 45 Reade Place, Poughkeepsie, NY 12601",
        zip: "12601",
        geocodeCity: "Poughkeepsie, NY",
        minimumAge: 16,
        applicationUrl: "https://nuvancehealth.vsyslive.com/pages/app/VBMCSTUDENT",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-volunteer-application",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the network's own stated policy).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Continuation, seventh wave: Alameda County Library — a Better
  // Impact PublicEnterprise covering 8 branches (guid
  // 94215a86-c03a-4c8a-b0e9-29e7222896a7), confirmed live directly.
  // Fremont Main Library is one of its branches, already covered by 2
  // standalone manual records above (fremont-main-library) sourced from
  // that branch's own PublicOrganization page — this wave adds the
  // OTHER branches, not Fremont again. IMPORTANT: this enterprise's
  // "Working with Teens" facet (ActivityClassification, SearchId 15891)
  // is a TASK-TYPE category, not an age-suitability facet like Mesa/
  // Gilbert/Sacramento/San José/Boise/Roseville use — its label alone
  // says nothing about real eligibility (verified live: of its 9 total
  // activities across all branches, 3 had no real numeric/grade age
  // evidence at all — Castro Valley's Homework Center, Newark's "Teen
  // Program Preparation", and an "Adult D&D Campaign Leader" that turned
  // out to be 18+-only despite being tagged under this facet). Every
  // one of the 6 records below was individually confirmed via its own
  // activity detail page's explicit Requirements/Qualifications text —
  // never inferred from the facet label or title.
  {
    slug: "albany-library",
    name: "Albany Library",
    description:
      "Albany, CA public library (Alameda County Library system) with 2 confirmed teen volunteer roles: D&D Campaign Leader (14+) and General Volunteering: Organizing Books and More (13+).",
    websiteUrl: "https://app.betterimpact.com/PublicEnterprise/94215a86-c03a-4c8a-b0e9-29e7222896a7",
    city: "Albany, CA",
    contactEmail: "albany@aclibrary.org",
    opportunities: [
      {
        title: "D&D Campaign Leader",
        description:
          "Help manage a large group of 10-12 year olds for a D&D campaign at Albany Library, managing attention and possibly running a secondary tabletop roleplaying game. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"Be 14 years of age or older.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Albany Library, 1247 Marin Ave, Albany, CA 94706",
        zip: "94706",
        geocodeCity: "Albany, CA",
        minimumAge: 14,
        applicationUrl: "https://app.betterimpact.com/Application/LoggedInApplicationRedirect?OrganizationGuid=7dd74bf7-0fbe-4e51-8b19-9d92ed9e838e&ApplicationFormNumber=1&ActivityGUID=6af387d3-13ad-4af4-8143-02383aec2265",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "dd-campaign-leader",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14+ (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "General Volunteering: Organizing Books and More",
        description:
          "Help sort and straighten books and keep Albany Library orderly. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"Be 13 years of age or older\" and under Qualifications Required: \"Ages 13 and up.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Albany Library, 1247 Marin Ave, Albany, CA 94706",
        zip: "94706",
        geocodeCity: "Albany, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/Application/LoggedInApplicationRedirect?OrganizationGuid=7dd74bf7-0fbe-4e51-8b19-9d92ed9e838e&ApplicationFormNumber=1&ActivityGUID=285ef2eb-4a26-4b19-9a00-f0035fab8e20",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "general-volunteering-books",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13+ (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "centerville-library",
    name: "Centerville Library",
    description:
      "Fremont, CA public library (Alameda County Library system) with a Teen Advisory Board for ages 12+.",
    websiteUrl: "https://app.betterimpact.com/PublicEnterprise/94215a86-c03a-4c8a-b0e9-29e7222896a7",
    city: "Fremont, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Centerville Teen Advisory Board",
        description:
          "Centerville Library's Teen Advisory Board (TAB), made up of local students who represent teens in the community, analyzing, approving, and implementing library programs. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"Be 12 years of age or older.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Centerville Library, 3801 Nicolet Ave, Fremont, CA 94536",
        zip: "94536",
        geocodeCity: "Fremont, CA",
        minimumAge: 12,
        applicationUrl: "https://app.betterimpact.com/Application/LoggedInApplicationRedirect?OrganizationGuid=644d6b73-55b6-408d-b448-4f14270b4621&ApplicationFormNumber=1&ActivityGUID=a94ebe87-923d-440d-905e-9d3d6bc4ac32",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 12+ (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "dublin-library",
    name: "Dublin Library",
    description:
      "Dublin, CA public library (Alameda County Library system) with a Teen Volunteer Orientation for ages 13+.",
    websiteUrl: "https://app.betterimpact.com/PublicEnterprise/94215a86-c03a-4c8a-b0e9-29e7222896a7",
    city: "Dublin, CA",
    contactEmail: "dublin@aclibrary.org",
    opportunities: [
      {
        title: "Teen Volunteer Orientation",
        description:
          "Required orientation for all teens interested in volunteering in-person at Dublin Library, held three times a year (beginning of Fall, Spring, and Summer). Confirmed directly via the activity's own current page, quoted verbatim: \"All teens aged 13 and older who are interested in working as an in-person volunteer at the library are required to attend an orientation prior to any volunteer activities.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Dublin Library, 200 Civic Plaza, Dublin, CA 94568",
        zip: "94568",
        geocodeCity: "Dublin, CA",
        minimumAge: 13,
        applicationUrl: "https://app.betterimpact.com/Application/LoggedInApplicationRedirect?OrganizationGuid=eb663cd9-7ebf-4e35-81a8-5c8f76e4a0a2&ApplicationFormNumber=1&ActivityGUID=6b855816-f235-4064-a6fe-44c1d5207863",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-orientation",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13+ (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "newark-library-ca",
    name: "Newark Library",
    description:
      "Newark, CA public library (Alameda County Library system) with a Teen Advisory Group for grades 7-12.",
    websiteUrl: "https://app.betterimpact.com/PublicEnterprise/94215a86-c03a-4c8a-b0e9-29e7222896a7",
    city: "Newark, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Advisory Group",
        description:
          "Newark Library's Teen Advisory Group (TAG) — members help run programs, start services for teens, create a teen zine, and shape the library's teen collection. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"Be in grades 7-12.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Newark Library, 6300 Civic Terrace Ave, Newark, CA 94560",
        zip: "94560",
        geocodeCity: "Newark, CA",
        minimumAge: 12,
        applicationUrl: "https://app.betterimpact.com/Application/LoggedInApplicationRedirect?OrganizationGuid=7e6ac7d5-bbf0-476b-8477-3d8f17a6ed70&ApplicationFormNumber=1&ActivityGUID=22a82aba-1a5a-41ae-a0fa-71e97bf44e65",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-group",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Grades 7-12 (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "union-city-library",
    name: "Union City Library",
    description:
      "Union City, CA public library (Alameda County Library system) with a Teen Advisory Group for ages 12-18.",
    websiteUrl: "https://app.betterimpact.com/PublicEnterprise/94215a86-c03a-4c8a-b0e9-29e7222896a7",
    city: "Union City, CA",
    contactEmail: "unioncitylibrary@aclibrary.org",
    opportunities: [
      {
        title: "Teen Advisory Group",
        description:
          "Union City Library's Teen Advisory Group members advise the library on connecting with and serving teen library members, including selecting new teen books/movies and suggesting new programs. Confirmed directly via the activity's own current page, quoted verbatim under Requirements: \"High School or 8th Grade Teen (ages 12-18).\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Union City Library, 34007 Alvarado Niles Rd, Union City, CA 94587",
        zip: "94587",
        geocodeCity: "Union City, CA",
        minimumAge: 12,
        applicationUrl: "https://app.betterimpact.com/Application/LoggedInApplicationRedirect?OrganizationGuid=2b05224d-01a4-4ecc-8e07-03468c1dd98b&ApplicationFormNumber=1&ActivityGUID=47037591-cbe1-4c9b-ba0a-271a336f1718",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-group",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 12-18 (per the activity's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Arizona-priority batch: United Food Bank already has one connector-
  // sourced record ("Food Sorting & Emergency Food Bag Volunteer",
  // source "united_food_bank", the 5-15-with-adult role). This adds the
  // genuinely distinct SECOND role confirmed live directly on the org's
  // own current page: teens 16-17 who may volunteer independently
  // (without an accompanying adult), a different eligibility tier and
  // duty shape from the existing record. Org name matches exactly so
  // seed-manual-records.ts's org lookup reuses the existing org row
  // rather than creating a duplicate.
  {
    slug: "united-food-bank",
    name: "United Food Bank",
    description:
      "Mesa, AZ regional food bank serving the East Valley. Confirmed directly via the org's own current page a second, distinct teen-eligible tier beyond its existing accompanied-minor role: teens 16-17 who may volunteer independently.",
    websiteUrl: "https://unitedfoodbank.org/volunteer/",
    city: "Mesa, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Independently (Ages 16-17)",
        description:
          "United Food Bank's Volunteer Center accepts teens 16-17 to volunteer on their own (without an accompanying parent/guardian), a distinct eligibility tier from the org's existing accompanied-minor emergency-food-bag role (ages 5-15). Confirmed directly via the org's own current page, quoted verbatim: \"teens ages 16-17 can volunteer on their own at any shift with a signed waiver from a parent or guardian.\" A signed parental waiver is required. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "United Food Bank, Mesa, AZ",
        zip: "85210",
        geocodeCity: "Mesa, AZ",
        minimumAge: 16,
        applicationUrl: "https://unitedfoodbank.org/volunteer/volunteer-sign-up/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-independently-16-17",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 16-17, independent (no accompanying adult required), signed parental waiver required (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Arizona-priority batch: Arizona Humane Society's Humane Teens
  // program — confirmed live directly (azhumane.org/humane-teens),
  // after the org's own JS-gated /youth/ landing page required a real
  // browser render to locate the direct program URL (curl and guessed
  // direct URLs were bounced by a "Javascript is required" wall).
  // Arizona Animal Welfare League was independently researched this
  // pass and rejected (its teen program appears discontinued — only
  // 2011-2015 newsletter mentions found, nothing current). The Arizona-
  // Sonora Desert Museum's "Junior Docent Program" was also researched
  // but NOT added here: its current live volunteer page states plainly
  // "No current volunteer opportunities available" with no Junior
  // Docent category listed at all — the evidence a research pass found
  // (PDF forms, a 2025 event reference) was stale, not a currently
  // confirmed pathway.
  {
    slug: "arizona-humane-society",
    name: "Arizona Humane Society",
    description:
      "Phoenix-area animal shelter (Rob & Melani Walton Papago Park Campus) with Humane Teens, a competitive youth leadership program for ages 14-17.",
    websiteUrl: "https://www.azhumane.org/humane-teens/",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Humane Teens",
        description:
          "A competitive youth leadership program for teens interested in animal welfare, primarily run out of the Papago Park Campus (other locations/offsite events as each semester's schedule permits). Confirmed directly via the org's own current page, quoted verbatim: \"a unique youth leadership program for teenagers between the ages of 14 and 17 who are interested in animal welfare.\" Requires an application, two letters of recommendation, and an interview; requires 24 hours of service within a school semester. Humane Teens receive animal-handling training, help lead youth programs/presentations, assist with daily care of Animal Teachers and homeless pets, and meet primarily Saturdays 9am-1pm. The org's own page states the current application deadline, quoted verbatim: \"Application deadline is September 17, 2026 at midnight.\"",
        location: "Arizona Humane Society, Rob & Melani Walton Papago Park Campus, 5501 E Van Buren St, Phoenix, AZ 85008",
        zip: "85008",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.azhumane.org/humane-teens/",
        applicationDeadline: "2026-09-17",
        availabilityStatus: "open",
        externalIdSuffix: "humane-teens",
        category: "Animals",
        interestsTags: ["animals"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-17 (per the org's own page). Competitive — requires application, 2 recommendation letters, and an interview.",
        timeCommitment: "24 hours of service within a school semester; primarily Saturdays 9am-1pm.",
        programFocusTags: ["animal_welfare"],
        reviewStatus: "pending",
      },
    ],
  },

  // Nationwide expansion, high-yield batch: NewYork-Presbyterian — a
  // single shared VSys One portal (nyp.vsyslive.com/pages/app/STAND)
  // covering 11 named campuses in one application form. Confirmed live
  // directly, quoted verbatim: application form offers "Please choose
  // one category below: 16-17 Years old / 18+", with a "Which campus
  // are you interested in?" selector listing exactly these 11 campuses.
  // Commitment: minimum 4-8 hours/week depending on campus; Ongoing
  // (6-10 months) or Summer only (120 hours, not offered at Queens,
  // applications accepted Jan 1-Mar 31). NY state law requires
  // fingerprinting for an accepted volunteer. All 11 share this one
  // application_url — same real shared-portal pattern already
  // established for Nuvance Health's 7-hospital portal and Baylor Scott
  // & White's 3-hospital shared link.
  {
    slug: "nyp-allen-hospital",
    name: "NewYork-Presbyterian Allen Hospital",
    description: "Manhattan (Inwood) hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Allen Hospital campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway (a separate Summer-only track accepts applications Jan 1-Mar 31).",
        location: "NewYork-Presbyterian Allen Hospital, 5141 Broadway, New York, NY 10034",
        zip: "10034",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-brooklyn-methodist",
    name: "NewYork-Presbyterian Brooklyn Methodist Hospital",
    description: "Brooklyn hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "Brooklyn, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Brooklyn Methodist Hospital campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Brooklyn Methodist Hospital, 506 6th St, Brooklyn, NY 11215",
        zip: "11215",
        geocodeCity: "Brooklyn, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-columbia",
    name: "NewYork-Presbyterian / Columbia University Irving Medical Center",
    description: "Manhattan (Washington Heights) hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Columbia University Irving Medical Center campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian / Columbia University Irving Medical Center, 622 W 168th St, New York, NY 10032",
        zip: "10032",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-gracie-square",
    name: "NewYork-Presbyterian Gracie Square",
    description: "Manhattan (Upper East Side) psychiatric hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Gracie Square campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. Note: this is a psychiatric facility; specific role placements are determined by the hospital's own volunteer office during onboarding. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Gracie Square, 420 E 76th St, New York, NY 10021",
        zip: "10021",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-hudson-valley",
    name: "NewYork-Presbyterian Hudson Valley Hospital",
    description: "Cortlandt Manor, NY hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "Cortlandt Manor, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Hudson Valley Hospital campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Hudson Valley Hospital, 1980 Crompond Rd, Cortlandt Manor, NY 10567",
        zip: "10567",
        geocodeCity: "Cortlandt Manor, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-lower-manhattan",
    name: "NewYork-Presbyterian Lower Manhattan Hospital",
    description: "Manhattan (Financial District) hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Lower Manhattan Hospital campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Lower Manhattan Hospital, 170 William St, New York, NY 10038",
        zip: "10038",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-morgan-stanley-childrens",
    name: "NewYork-Presbyterian Morgan Stanley Children's Hospital",
    description: "Manhattan (Washington Heights) children's hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Morgan Stanley Children's Hospital campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Morgan Stanley Children's Hospital, 3959 Broadway, New York, NY 10032",
        zip: "10032",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-queens",
    name: "NewYork-Presbyterian Queens",
    description: "Flushing, NY hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "Flushing, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Queens campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. The Summer-only track is explicitly \"Not offered at Queens campus\" — only the Ongoing track (6-10 months) applies here. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Queens, 56-45 Main St, Flushing, NY 11355",
        zip: "11355",
        geocodeCity: "Flushing, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months (Summer-only track not offered at this campus).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-weill-cornell",
    name: "NewYork-Presbyterian / Weill Cornell Medical Center",
    description: "Manhattan (Upper East Side) hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "New York, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Weill Cornell Medical Center campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian / Weill Cornell Medical Center, 525 E 68th St, New York, NY 10065",
        zip: "10065",
        geocodeCity: "New York, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-westchester",
    name: "NewYork-Presbyterian Westchester",
    description: "White Plains, NY hospital, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "White Plains, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Westchester campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Westchester, 21 Bloomingdale Rd, White Plains, NY 10605",
        zip: "10605",
        geocodeCity: "White Plains, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nyp-westchester-behavioral-health",
    name: "NewYork-Presbyterian Westchester Behavioral Health Center",
    description: "White Plains, NY behavioral health facility, part of the NewYork-Presbyterian system, with a Volunteer Program for ages 16+.",
    websiteUrl: "https://nyp.vsyslive.com",
    city: "White Plains, NY",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Program",
        description: "NewYork-Presbyterian's system-wide Volunteer Program, applicable to the Westchester Behavioral Health Center campus. Confirmed directly via the shared VSys One application form, quoted verbatim: \"Please choose one category below: 16-17 Years old / 18+.\" Minimum 4-8 hours/week depending on campus; NY state law requires fingerprinting for accepted volunteers. Note: this is a behavioral health facility; specific role placements are determined by the hospital's own volunteer office during onboarding. No specific annual application window is published for the Ongoing track — reads as a standing, currently-open pathway.",
        location: "NewYork-Presbyterian Westchester Behavioral Health Center, 21 Bloomingdale Rd, White Plains, NY 10605",
        zip: "10605",
        geocodeCity: "White Plains, NY",
        minimumAge: 16,
        applicationUrl: "https://nyp.vsyslive.com/pages/app/STAND",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared application's own category selector).",
        timeCommitment: "4-8 hours/week; Ongoing track 6-10 months or Summer-only track 120 hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Nationwide expansion: Wellstar Health System (GA) — VSys One,
  // confirmed live directly. Each site's own "VolunTeen" page states a
  // genuinely different age range (per the platform's own FAQ: "each
  // site may have a different age range") — never copy-pasted, each
  // independently verified. 10 other Wellstar sites checked (Douglas,
  // Acworth, Avalon, Cherokee, East Cobb, Spalding, Sylvan, Vinings,
  // Windy Hill) showed no VolunTeen program at all — not added.
  {
    slug: "wellstar-cobb",
    name: "Wellstar Cobb Hospital",
    description: "Austell, GA hospital (Wellstar Health System) with a VolunTeen summer program for ages 16-17.",
    websiteUrl: "https://wellstar.vsyslive.com/pages/cobb",
    city: "Austell, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Wellstar Cobb Hospital's VolunTeen summer program, a competitive program for high school students interested in a healthcare career. Confirmed directly via the hospital's own current page, quoted verbatim: \"VolunTeen Information (Aged 16-17).\" Selection includes a completed application and interview. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Wellstar Cobb Hospital, 3950 Austell Rd, Austell, GA 30106",
        zip: "30106",
        geocodeCity: "Austell, GA",
        minimumAge: 16,
        applicationUrl: "https://wellstar.vsyslive.com/pages/app/TEENAPP?reqSite=87AQFVT4XODSDZ9M",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteen-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "wellstar-paulding",
    name: "Wellstar Paulding Hospital",
    description: "Hiram, GA hospital (Wellstar Health System) with a VolunTeen summer program for ages 16-17.",
    websiteUrl: "https://wellstar.vsyslive.com/pages/paulding",
    city: "Hiram, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Wellstar Paulding Hospital's VolunTeen summer program, a competitive program for high school students interested in a healthcare career. Confirmed directly via the hospital's own current page, quoted verbatim: \"VolunTeen Information (Aged 16-17).\" Selection includes a completed application and interview. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Wellstar Paulding Hospital, 2518 Jimmy Lee Smith Pkwy, Hiram, GA 30141",
        zip: "30141",
        geocodeCity: "Hiram, GA",
        minimumAge: 16,
        applicationUrl: "https://wellstar.vsyslive.com/pages/app/TEENAPP?reqSite=JH7L86NE4XXQUUBX",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteen-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "wellstar-kennestone",
    name: "Wellstar Kennestone Hospital",
    description: "Marietta, GA hospital (Wellstar Health System) with a VolunTeen summer program for ages 16-18.",
    websiteUrl: "https://wellstar.vsyslive.com/pages/kennestone",
    city: "Marietta, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Wellstar Kennestone Hospital's VolunTeen summer program, a competitive program for high school students interested in a healthcare career. Confirmed directly via the hospital's own current page, quoted verbatim: \"VolunTeen Information (Aged 16-18).\" Selection includes a completed application and interview. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Wellstar Kennestone Hospital, 677 Church St NE, Marietta, GA 30060",
        zip: "30060",
        geocodeCity: "Marietta, GA",
        minimumAge: 16,
        applicationUrl: "https://wellstar.vsyslive.com/pages/app/TEENAPP?reqSite=QIJNTP9MZ65T0KWZ",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteen-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-18 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "wellstar-north-fulton",
    name: "Wellstar North Fulton Hospital",
    description: "Roswell, GA hospital (Wellstar Health System) with a VolunTeen summer program for ages 16-18.",
    websiteUrl: "https://wellstar.vsyslive.com/pages/northfulton",
    city: "Roswell, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Wellstar North Fulton Hospital's VolunTeen summer program, a competitive program for high school students interested in a healthcare career. Confirmed directly via the hospital's own current page, quoted verbatim: \"VolunTeen Information (Aged 16-18).\" Selection includes a completed application and interview. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Wellstar North Fulton Hospital, 3000 Hospital Blvd, Roswell, GA 30076",
        zip: "30076",
        geocodeCity: "Roswell, GA",
        minimumAge: 16,
        applicationUrl: "https://wellstar.vsyslive.com/pages/app/TEENAPP?reqSite=P8A53LR0BCNW0EVJ",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteen-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-18 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "wellstar-west-georgia",
    name: "Wellstar West Georgia Medical Center",
    description: "LaGrange, GA hospital (Wellstar Health System) with a VolunTeen summer program for ages 14-18.",
    websiteUrl: "https://wellstar.vsyslive.com/pages/westgeorgia",
    city: "LaGrange, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Wellstar West Georgia Medical Center's VolunTeen summer program, a competitive program for high school students interested in a healthcare career. Confirmed directly via the hospital's own current page, quoted verbatim: \"VolunTeen Information (Aged 14-18).\" The same page states, quoted verbatim: \"2027 Program Dates: June 1 - July 15, 2027\" — staged seasonal, matching the program's own published dates.",
        location: "Wellstar West Georgia Medical Center, 1514 Vernon Rd, LaGrange, GA 30240",
        zip: "30240",
        geocodeCity: "LaGrange, GA",
        minimumAge: 14,
        applicationUrl: "https://wellstar.vsyslive.com/pages/app/TEENAPP?reqSite=0NZ1Y7C4SYO7Z7GG",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"2027 Program Dates: June 1 - July 15, 2027.\"",
        externalIdSuffix: "volunteen-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-18 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "wellstar-mcg",
    name: "Wellstar MCG Health",
    description: "Augusta, GA hospital (Wellstar Health System, Medical College of Georgia) with a VolunTeen summer program for ages 15-17.",
    websiteUrl: "https://wellstar.vsyslive.com/pages/mcg",
    city: "Augusta, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Wellstar MCG Health's VolunTeen summer program, a competitive program for high school students interested in a healthcare career. Confirmed directly via the hospital's own current page, quoted verbatim: \"VolunTeen Information (Aged 15-17).\" Selection includes a completed application and interview. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Wellstar MCG Health, 1120 15th St, Augusta, GA 30912",
        zip: "30912",
        geocodeCity: "Augusta, GA",
        minimumAge: 15,
        applicationUrl: "https://wellstar.vsyslive.com/pages/app/TEENAPP?reqSite=D559VQ1NBA4N2RAE",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteen-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Nationwide expansion: Geisinger (PA) Junior Volunteer Program (JVP)
  // — VSys One, confirmed live directly at geisinger.vsyslive.com/pages/
  // PROGRAMS, offered at exactly 4 of the portal's 13 listed facilities.
  // All 4 share one system-wide application (VOLINFO) and one age range,
  // since the JVP is explicitly one combined program, not per-facility
  // variants — genuinely different from Wellstar's per-site variation.
  {
    slug: "geisinger-community-medical-center",
    name: "Geisinger Community Medical Center",
    description: "Scranton, PA hospital (Geisinger) offering the Junior Volunteer Program (JVP) for ages 15-18.",
    websiteUrl: "https://geisinger.vsyslive.com/pages/PROGRAMS",
    city: "Scranton, PA",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program (JVP)",
        description: "Geisinger's Junior Volunteer Program, a 6-week summer experience combining volunteer service with healthcare career education, offered at Geisinger Community Medical Center (Scranton). Confirmed directly via the org's own current page, quoted verbatim: \"Are you a high school student between ages 15 and 18 with a passion for helping others and an interest in healthcare careers?\" Requires 2 references, a 500-word essay, an interview, and a mandatory orientation; commits to 6-7 hours/week for 6 weeks (minimum 40 service + 15 educational hours, 5 of 6 weeks). The org's own page states, quoted verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        location: "Geisinger Community Medical Center, 1800 Mulberry St, Scranton, PA 18510",
        zip: "18510",
        geocodeCity: "Scranton, PA",
        minimumAge: 15,
        applicationUrl: "https://geisinger.vsyslive.com/pages/app/VOLINFO",
        applicationDeadline: "2027-02-14",
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-18 (per the org's own page). Competitive — requires application, 2 references, essay, and interview.",
        timeCommitment: "6-7 hours/week for a 6-week summer program; minimum 40 service hours + 15 educational hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "geisinger-lewistown-hospital",
    name: "Geisinger Lewistown Hospital",
    description: "Lewistown, PA hospital (Geisinger) offering the Junior Volunteer Program (JVP) for ages 15-18.",
    websiteUrl: "https://geisinger.vsyslive.com/pages/PROGRAMS",
    city: "Lewistown, PA",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program (JVP)",
        description: "Geisinger's Junior Volunteer Program, a 6-week summer experience combining volunteer service with healthcare career education, offered at Geisinger Lewistown Hospital. Confirmed directly via the org's own current page, quoted verbatim: \"Are you a high school student between ages 15 and 18 with a passion for helping others and an interest in healthcare careers?\" Requires 2 references, a 500-word essay, an interview, and a mandatory orientation; commits to 6-7 hours/week for 6 weeks (minimum 40 service + 15 educational hours, 5 of 6 weeks). The org's own page states, quoted verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        location: "Geisinger Lewistown Hospital, 400 Highland Ave, Lewistown, PA 17044",
        zip: "17044",
        geocodeCity: "Lewistown, PA",
        minimumAge: 15,
        applicationUrl: "https://geisinger.vsyslive.com/pages/app/VOLINFO",
        applicationDeadline: "2027-02-14",
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-18 (per the org's own page). Competitive — requires application, 2 references, essay, and interview.",
        timeCommitment: "6-7 hours/week for a 6-week summer program; minimum 40 service hours + 15 educational hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "geisinger-medical-center-danville",
    name: "Geisinger Medical Center",
    description: "Danville, PA hospital (Geisinger) offering the Junior Volunteer Program (JVP) for ages 15-18.",
    websiteUrl: "https://geisinger.vsyslive.com/pages/PROGRAMS",
    city: "Danville, PA",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program (JVP)",
        description: "Geisinger's Junior Volunteer Program, a 6-week summer experience combining volunteer service with healthcare career education, offered at Geisinger Medical Center (Danville). Confirmed directly via the org's own current page, quoted verbatim: \"Are you a high school student between ages 15 and 18 with a passion for helping others and an interest in healthcare careers?\" Requires 2 references, a 500-word essay, an interview, and a mandatory orientation; commits to 6-7 hours/week for 6 weeks (minimum 40 service + 15 educational hours, 5 of 6 weeks). The org's own page states, quoted verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        location: "Geisinger Medical Center, 100 N Academy Ave, Danville, PA 17822",
        zip: "17822",
        geocodeCity: "Danville, PA",
        minimumAge: 15,
        applicationUrl: "https://geisinger.vsyslive.com/pages/app/VOLINFO",
        applicationDeadline: "2027-02-14",
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-18 (per the org's own page). Competitive — requires application, 2 references, essay, and interview.",
        timeCommitment: "6-7 hours/week for a 6-week summer program; minimum 40 service hours + 15 educational hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "geisinger-wyoming-valley-medical-center",
    name: "Geisinger Wyoming Valley Medical Center",
    description: "Wilkes-Barre, PA hospital (Geisinger) offering the Junior Volunteer Program (JVP) for ages 15-18.",
    websiteUrl: "https://geisinger.vsyslive.com/pages/PROGRAMS",
    city: "Wilkes-Barre, PA",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program (JVP)",
        description: "Geisinger's Junior Volunteer Program, a 6-week summer experience combining volunteer service with healthcare career education, offered at Geisinger Wyoming Valley Medical Center (Wilkes-Barre). Confirmed directly via the org's own current page, quoted verbatim: \"Are you a high school student between ages 15 and 18 with a passion for helping others and an interest in healthcare careers?\" Requires 2 references, a 500-word essay, an interview, and a mandatory orientation; commits to 6-7 hours/week for 6 weeks (minimum 40 service + 15 educational hours, 5 of 6 weeks). The org's own page states, quoted verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        location: "Geisinger Wyoming Valley Medical Center, 1000 E Mountain Blvd, Wilkes-Barre, PA 18711",
        zip: "18711",
        geocodeCity: "Wilkes-Barre, PA",
        minimumAge: 15,
        applicationUrl: "https://geisinger.vsyslive.com/pages/app/VOLINFO",
        applicationDeadline: "2027-02-14",
        availabilityStatus: "seasonal",
        availabilityNote: "The org's own page states, verbatim: \"Apply online between Feb. 1 - Feb. 14, 2027.\"",
        externalIdSuffix: "junior-volunteer-program",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-18 (per the org's own page). Competitive — requires application, 2 references, essay, and interview.",
        timeCommitment: "6-7 hours/week for a 6-week summer program; minimum 40 service hours + 15 educational hours.",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Nationwide expansion: 3 new Habitat for Humanity regional affiliates
  // (distinct legal entities from the already-covered Central Arizona
  // and Tucson affiliates), each confirmed live directly.
  {
    slug: "habitat-for-humanity-twin-cities",
    name: "Twin Cities Habitat for Humanity",
    description: "Minneapolis-St. Paul, MN Habitat for Humanity affiliate with 2 distinct teen-eligible roles: Construction/Home Repair (16+ with chaperone, 18+ independent) and ReStore One Day at a Time (14+, accompanied if under 18).",
    websiteUrl: "https://www.tchabitat.org/get-involved/youth-and-family",
    city: "St. Paul, MN",
    contactEmail: "lizzy.reilly@tchabitat.org",
    opportunities: [
      {
        title: "Construction and Home Repair Volunteer",
        description: "Build or rehab homes in partnership with families, or help with the Home Repair program. Confirmed directly via the org's own current page, quoted verbatim: \"Must be at least 16 years old with a chaperone; anyone 18 years or older can volunteer on their own.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Twin Cities Habitat for Humanity, 1954 University Ave W, St Paul, MN 55104",
        zip: "55104",
        geocodeCity: "St. Paul, MN",
        minimumAge: 16,
        applicationUrl: "https://www.tchabitat.org/get-involved/youth-and-family",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "construction-home-repair-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 16-17 with a chaperone; 18+ independently (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "ReStore One Day at a Time Volunteer",
        description: "Non-construction volunteer role supporting Twin Cities Habitat's ReStore. Confirmed directly via the org's own current page, quoted verbatim: \"ReStore One Day at a Time Volunteer (Must be at least 14 years old; anyone 14 to 17 must be accompanied by an adult.)\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Twin Cities Habitat for Humanity, 1954 University Ave W, St Paul, MN 55104",
        zip: "55104",
        geocodeCity: "St. Paul, MN",
        minimumAge: 14,
        applicationUrl: "https://www.tchabitat.org/get-involved/youth-and-family",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "restore-one-day-at-a-time-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "one_time",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 14-17, accompanied by an adult (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "habitat-for-humanity-seattle-king-kittitas",
    name: "Habitat for Humanity Seattle-King & Kittitas Counties",
    description: "Renton, WA Habitat for Humanity affiliate with a Volunteer Program (construction and Habitat Stores) for ages 16+.",
    websiteUrl: "https://www.habitatskc.org/how-to-help/volunteer/",
    city: "Renton, WA",
    contactEmail: null,
    opportunities: [
      {
        title: "Construction & Habitat Stores Volunteer",
        description: "Volunteer at construction sites or Habitat Stores (retail thrift stores raising funds for the mission). Confirmed directly via the org's own current FAQ, quoted verbatim: \"Volunteers must be at least 16 years old to work on at any of our construction sites, or at our Habitat Stores. Anyone under the age of 18 must be accompanied by an adult throughout their volunteer day. Groups of young adults (under 18) must have one adult (over age 21) per every five youth.\" Sign-up is via VolunteerHub. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Habitat for Humanity Seattle-King & Kittitas Counties, 500 Naches Ave SW Ste 200, Renton, WA 98057",
        zip: "98057",
        geocodeCity: "Renton, WA",
        minimumAge: 16,
        applicationUrl: "https://www.habitatskc.org/how-to-help/volunteer/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "construction-habitat-stores-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 16-17 accompanied by an adult; 18+ independently (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "habitat-for-humanity-greater-los-angeles",
    name: "Habitat for Humanity of Greater Los Angeles",
    description: "Los Angeles, CA Habitat for Humanity affiliate with 2 distinct teen-eligible roles: Build/construction (16+) and ReStore (14-15).",
    websiteUrl: "https://www.habitatla.org/get-involved/youth-programs/",
    city: "Los Angeles, CA",
    contactEmail: "volunteers@habitatla.org",
    opportunities: [
      {
        title: "Build (Construction Volunteer)",
        description: "Help build or renovate a home with a hardworking family at a Habitat LA construction site. Confirmed directly via the org's own current Youth Programs page, quoted verbatim: \"Habitat for Humanity of Greater Los Angeles has a variety of programs available for teens aged 14-15 in our ReStores and 16 and up on our construction sites.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Habitat for Humanity of Greater Los Angeles, 1071 S La Brea Ave, Los Angeles, CA 90019",
        zip: "90019",
        geocodeCity: "Los Angeles, CA",
        minimumAge: 16,
        applicationUrl: "https://www.habitatla.org/get-involved/youth-programs/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "build-construction-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "ReStore Youth Volunteer",
        description: "Volunteer at a Habitat LA ReStore (retail thrift store selling donated building materials). Confirmed directly via the org's own current Youth Programs page, quoted verbatim: \"Habitat for Humanity of Greater Los Angeles has a variety of programs available for teens aged 14-15 in our ReStores and 16 and up on our construction sites.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Habitat for Humanity of Greater Los Angeles, 1071 S La Brea Ave, Los Angeles, CA 90019",
        zip: "90019",
        geocodeCity: "Los Angeles, CA",
        minimumAge: 14,
        applicationUrl: "https://www.habitatla.org/get-involved/youth-programs/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "restore-youth-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-15 (per the org's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Arizona-priority batch, second wave: municipal parks/rec/library/
  // police-cadet programs, each independently re-verified live (a
  // stale claim was caught and corrected below: Avondale Library's
  // status was re-checked directly and confirmed still CLOSED until
  // July 2027, contradicting an earlier research-fork claim it had
  // reopened — the fresh direct fetch is authoritative).
  {
    slug: "tempe-volunteer-program",
    name: "City of Tempe Community Services",
    description: "Tempe, AZ citywide Volunteer Program with a Youth track (ages 17 and younger) and a Summer Youth track.",
    websiteUrl: "https://www.tempe.gov/government/community-services/volunteer",
    city: "Tempe, AZ",
    contactEmail: "volunteer@tempe.gov",
    opportunities: [
      {
        title: "Youth Volunteer Program",
        description: "Tempe Community Services' citywide Volunteer Program, Youth track. Confirmed directly via the city's own current page, quoted verbatim: \"Application - Youth (ages 17 years and younger)\" and a separate \"Application - Summer Youth\" track. Roles include Summer Youth Volunteer, Docent (History Museum), CARE 7, and HOPE team. Application via email. No specific annual application window is published for the Youth track — reads as a standing, currently-open pathway.",
        location: "City of Tempe Community Services, 3500 S. Rural Rd. Ste 202, Tempe, AZ 85282",
        zip: "85282",
        geocodeCity: "Tempe, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.tempe.gov/government/community-services/volunteer",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "youth-volunteer-program",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 17 and younger (per the city's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "goodyear-parks-recreation",
    name: "City of Goodyear Parks & Recreation",
    description: "Goodyear, AZ parks and recreation department with 2 distinct teen volunteer programs: GRC-U (13-15) and Junior Leader Volunteer (13-14).",
    websiteUrl: "https://recreation.goodyearaz.gov",
    city: "Goodyear, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "GRC-U",
        description: "Goodyear Recreation Campus youth volunteer program. Confirmed directly via the city's own current page, quoted verbatim: \"GRC-U is an opportunity for youth, ages 13-15,\" including a Jr. Guard sub-track for volunteering at City of Goodyear pools. Registration via RecDesk. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Goodyear Recreation Campus, 420 S. Estrella Pkwy, Goodyear, AZ 85338",
        zip: "85338",
        geocodeCity: "Goodyear, AZ",
        minimumAge: 13,
        applicationUrl: "https://recreation.goodyearaz.gov",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "grc-u",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-15 (per the city's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
      {
        title: "Junior Leader Volunteer",
        description: "Goodyear's Summer Recreation Junior Leader volunteer program. Confirmed directly via the city's own current page, quoted verbatim: \"youth ages 13-14... Junior Leader.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Goodyear Recreation Campus, 420 S. Estrella Pkwy, Goodyear, AZ 85338",
        zip: "85338",
        geocodeCity: "Goodyear, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.goodyearaz.gov",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-leader-volunteer",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-14 (per the city's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "goodyear-police-youth-cadet",
    name: "City of Goodyear Police Department",
    description: "Goodyear, AZ police department with a Youth Cadet program for ages 14-20.",
    websiteUrl: "https://www.goodyearaz.gov/community-policing",
    city: "Goodyear, AZ",
    contactEmail: "youthcadets@goodyearaz.gov",
    opportunities: [
      {
        title: "Police Youth Cadet Program",
        description: "Goodyear Police Department's Youth Cadet program. Confirmed directly via the department's own current page, quoted verbatim: \"designed for young men and women ages 14 to 20.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Goodyear Police Department, 14455 W Van Buren St, Goodyear, AZ 85338",
        zip: "85338",
        geocodeCity: "Goodyear, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.goodyearaz.gov/community-policing",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "police-youth-cadet-program",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-20 (per the department's own page).",
        programFocusTags: ["public_safety"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "prescott-public-library",
    name: "Prescott Public Library",
    description: "Prescott, AZ public library with a Teen Advisory Group (TAG) for grades 6-12.",
    websiteUrl: "https://library.prescott-az.gov",
    city: "Prescott, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Advisory Group (TAG)",
        description: "Prescott Public Library's Teen Advisory Group. Confirmed directly via the library's own current page, quoted verbatim: \"Teens in grades 6-12 may volunteer... Teen Advisory Group (TAG).\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Prescott Public Library, 215 E Goodwin St, Prescott, AZ 86303",
        zip: "86303",
        geocodeCity: "Prescott, AZ",
        minimumAge: 11,
        applicationUrl: "https://library.prescott-az.gov",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-group",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Grades 6-12 (per the library's own page).",
        programFocusTags: ["literacy_education"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "prescott-recreation-services",
    name: "City of Prescott Recreation Services",
    description: "Prescott, AZ recreation services department with a Teen Task Force for ages 13-17.",
    websiteUrl: "https://www.prescott-az.gov",
    city: "Prescott, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Task Force",
        description: "Prescott Recreation Services' city-assisted volunteer program for quad-city area teens. Confirmed directly via the city's own current page, quoted verbatim: \"quad-city area teens 13-17 years old.\" Registration via RecDesk or email. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Prescott Community Center, 1280 E Rosser St, Prescott, AZ 86301",
        zip: "86301",
        geocodeCity: "Prescott, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.prescott-az.gov",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-task-force",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the city's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "avondale-public-library",
    name: "Avondale Public Library",
    description: "Avondale, AZ public library with a Teen Volunteer program for ages 13-17.",
    websiteUrl: "https://library.avondaleaz.gov/about/volunteer",
    city: "Avondale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Avondale Public Library's Teen Volunteer program, including a \"Serve & Socialize (Ages 13-17)\" track. Confirmed directly via the library's own current page, quoted verbatim: \"Volunteer Application 2026-2027 (Ages 13-17)... Applications are closed for 2026-2027. The 2027-2028 application will open in July 2027.\" A prior research pass claimed this had reopened — independently re-verified directly and confirmed still closed as of this session.",
        location: "Avondale Civic Center Library, 495 E. Western Ave, Avondale, AZ 85323",
        zip: "85323",
        geocodeCity: "Avondale, AZ",
        minimumAge: 13,
        applicationUrl: "https://library.avondaleaz.gov/about/volunteer",
        applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The library's own page states, verbatim: \"Applications are closed for 2026-2027. The 2027-2028 application will open in July 2027.\"",
        externalIdSuffix: "teen-volunteer-program",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the library's own page).",
        programFocusTags: ["literacy_education"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "avondale-neighborhood-family-services",
    name: "City of Avondale Neighborhood & Family Services",
    description: "Avondale, AZ neighborhood and family services department with the Avondale Youth Advisory Council (AYAC) for ages 13-18.",
    websiteUrl: "https://www.avondaleaz.gov/neighborhood-family-services",
    city: "Avondale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Avondale Youth Advisory Council (AYAC)",
        description: "Avondale's Youth Advisory Council, requiring Avondale residency. Confirmed directly via the city's own current page, quoted verbatim: \"must be an Avondale resident and be between the ages of 13 to 18.\" Application via interest form. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "City of Avondale, 11465 W. Civic Center Dr., Avondale, AZ 85323",
        zip: "85323",
        geocodeCity: "Avondale, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.avondaleaz.gov/neighborhood-family-services",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "avondale-youth-advisory-council",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-18, Avondale residency required (per the city's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "buckeye-library-museum",
    name: "Buckeye Library & Museum",
    description: "Buckeye, AZ public library and museum with a Teen Volunteer program for ages 14+.",
    websiteUrl: "https://www.buckeyeaz.gov/library",
    city: "Buckeye, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Buckeye Library & Museum's Teen Volunteer program. Confirmed directly via the city's own current page, quoted verbatim: \"Minimum age to volunteer is 14 at the time of the volunteer information session.\" Recurring mandatory information-session pattern. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Buckeye Library, 310 N. 6th St., Buckeye, AZ 85326",
        zip: "85326",
        geocodeCity: "Buckeye, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.buckeyeaz.gov/library",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-application",
        category: "Education",
        interestsTags: ["education"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14+ (per the city's own page).",
        programFocusTags: ["literacy_education"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "yuma-police-explorers",
    name: "City of Yuma Police Department",
    description: "Yuma, AZ police department with a Police Explorers program (Learning for Life) for ages 14-20.",
    websiteUrl: "https://www.yumaaz.gov/services-programs/explorers",
    city: "Yuma, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Police Explorers",
        description: "Yuma Police Department's Explorer post, part of the Learning for Life career education program (a Boy Scouts of America affiliate). Confirmed directly via the department's own current page, quoted verbatim: \"young men and women who are 14 (and have completed the eighth grade) or 15 through 20.\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Yuma Police Department, 1500 S. 1st Ave, Yuma, AZ 85364",
        zip: "85364",
        geocodeCity: "Yuma, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.yumaaz.gov/services-programs/explorers",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "police-explorers",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Age 14 (completed 8th grade) through 20 (per the department's own page).",
        programFocusTags: ["public_safety"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "chandler-leaders-in-training",
    name: "City of Chandler Recreation",
    description: "Chandler, AZ recreation department with a Leaders In Training (L.I.T.) program for ages 13-17.",
    websiteUrl: "https://www.chandleraz.gov/explore/teen-programs",
    city: "Chandler, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Leaders In Training (L.I.T.)",
        description: "Chandler Recreation's Leaders In Training program, giving teens work experience. Confirmed directly via the city's own current page, quoted verbatim: \"Teens between the ages of 13-17 can gain valuable work experience as a L.I.T.\" Application via Mentor Application. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Chandler Community Center, 125 E Commonwealth Ave, Chandler, AZ 85225",
        zip: "85225",
        geocodeCity: "Chandler, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.chandleraz.gov/explore/teen-programs",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "leaders-in-training",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the city's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "glendale-police-cadets",
    name: "City of Glendale Police Department",
    description: "Glendale, AZ police department with a Police Cadets/Explorers program for ages 14.5-20.",
    websiteUrl: "https://www.glendaleaz.gov",
    city: "Glendale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Police Cadets/Explorers",
        description: "Glendale Police Department's Cadets/Explorers program. Confirmed directly via the department's own current page, quoted verbatim: \"Be between 14.5 and 20 years of age (can remain until 21 years of age).\" No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Glendale Police Department, 6835 N 57th Dr, Glendale, AZ 85301",
        zip: "85301",
        geocodeCity: "Glendale, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.glendaleaz.gov",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "police-cadets-explorers",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14.5-20 (per the department's own page).",
        programFocusTags: ["public_safety"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "gilbert-police-cadets",
    name: "Town of Gilbert Police Department",
    description: "Gilbert, AZ police department with a Cadet Program for ages 14-20.",
    websiteUrl: "https://www.gilbertaz.gov/departments/police/teen-resources",
    city: "Gilbert, AZ",
    contactEmail: "gilbertpdcadets@gilbertaz.gov",
    opportunities: [
      {
        title: "Police Cadet Program",
        description: "Gilbert Police Department's Cadet Program, for those interested in pursuing a career in law enforcement. Confirmed directly via the department's own current page, quoted verbatim: \"...ages 14-20 who are interested in pursuing a career in law enforcement.\" Independently checked and confirmed this is NOT already covered by the Town of Gilbert's existing Better Impact connector (no \"cadet\" listing found there) — a genuinely separate program. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Gilbert Police Department, 75 E Civic Center Dr, Gilbert, AZ 85296",
        zip: "85296",
        geocodeCity: "Gilbert, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.gilbertaz.gov/departments/police/teen-resources",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "police-cadet-program",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-20 (per the department's own page).",
        programFocusTags: ["public_safety"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "mesa-police-cadets",
    name: "City of Mesa Police Department",
    description: "Mesa, AZ police department with Cadet Post #2055 for ages 14-19.",
    websiteUrl: "https://www.mesaaz.gov/Mesa-Police/Community",
    city: "Mesa, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Cadet Post #2055",
        description: "Mesa Police Department's Cadet Post #2055. Confirmed directly via the department's own current page, quoted verbatim: \"Be between ages 14-19 and have graduated from the 8th grade; allowing to remain in the program until your 21st birthday.\" Independently checked and confirmed this is NOT already covered by the City of Mesa's existing Better Impact connector — a genuinely separate program. No specific annual application window is published — reads as a standing, currently-open pathway.",
        location: "Mesa Police Department, 130 N Robson St, Mesa, AZ 85201",
        zip: "85201",
        geocodeCity: "Mesa, AZ",
        minimumAge: 14,
        applicationUrl: "https://www.mesaaz.gov/Mesa-Police/Community",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "cadet-post-2055",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 14-19, completed 8th grade (per the department's own page).",
        programFocusTags: ["public_safety"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "maricopa-county-elections",
    name: "Maricopa County Elections Department",
    description: "Maricopa County, AZ elections department with a Student Election Program for grades 9-12.",
    websiteUrl: "https://elections.maricopa.gov/work-with-us/student-election-program",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Student Election Program",
        description: "Maricopa County's Student Election Program, giving students election-day work experience for volunteer hour credit. Confirmed directly via the county's own current page, quoted verbatim: \"designed for students in grades 9-12.\" Application online. No specific annual application window is published beyond election cycles — reads as a standing, currently-open pathway.",
        location: "Maricopa County Elections Department, 111 S 3rd Ave Ste 102, Phoenix, AZ 85003",
        zip: "85003",
        geocodeCity: "Phoenix, AZ",
        minimumAge: 14,
        applicationUrl: "https://elections.maricopa.gov/work-with-us/student-election-program",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "student-election-program",
        category: "Community Service",
        interestsTags: ["community"],
        commitmentType: "one_time",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Grades 9-12 (per the county's own page).",
        programFocusTags: ["community_service"],
        reviewStatus: "pending",
      },
    ],
  },

  // Phase 2 platform-discovery continuation: extensions of already-
  // trusted VSys One systems (Trinity Health Michigan, Virtua Health,
  // Baylor Scott & White) plus the first record from a newly-discovered
  // system (Ascension). Each was independently confirmed this session
  // via a direct fetch of the org's own VSys One application page — not
  // taken from a research subagent's report at face value, since that
  // report's URLs for a separate platform (Communico libraries) turned
  // out to include stale/dead links on spot-check. All pending per this
  // file's own convention for session-discovered records.
  {
    slug: "trinity-health-grand-rapids",
    name: "Trinity Health Grand Rapids",
    description:
      "A Trinity Health hospital campus in Grand Rapids, Michigan, sharing a Junior Volunteer application portal with Trinity Health Muskegon.",
    websiteUrl: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/grand-rapids-and-muskegon",
    city: "Grand Rapids, MI",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Application",
        description:
          "Support hospital operations at Trinity Health Grand Rapids as a junior volunteer. Confirmed directly via the health system's own VSys One application (trinityhealthwm.vsyslive.com/pages/app/TEENAPP), titled 'Junior Volunteer Application (16 & 17 y/o)' with the applicant confirming 'I am 16 or 17 years old.' The same shared form lists a 'Requested site' choice of Grand Rapids or Muskegon — this record is scoped to Grand Rapids only; see the separate Trinity Health Muskegon record for that site.",
        location: "200 Jefferson Ave SE, Grand Rapids, MI 49503",
        zip: "49503",
        geocodeCity: "Grand Rapids, MI",
        minimumAge: 16,
        applicationUrl: "https://trinityhealthwm.vsyslive.com/pages/app/TEENAPP",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared Trinity Health West Michigan VSys One portal).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "trinity-health-muskegon",
    name: "Trinity Health Muskegon",
    description:
      "A Trinity Health hospital campus in Muskegon, Michigan, sharing a Junior Volunteer application portal with Trinity Health Grand Rapids.",
    websiteUrl: "https://www.trinityhealthmichigan.org/foundation-and-giving/volunteer/grand-rapids-and-muskegon",
    city: "Muskegon, MI",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Application",
        description:
          "Support hospital operations at Trinity Health Muskegon as a junior volunteer. Confirmed directly via the same shared VSys One application as Trinity Health Grand Rapids (trinityhealthwm.vsyslive.com/pages/app/TEENAPP), titled 'Junior Volunteer Application (16 & 17 y/o)'; the form's placement-preference options include a 'Guest Ambassador (Muskegon)' role specific to this site.",
        location: "1500 E. Sherman Blvd, Muskegon, MI 49444",
        zip: "49444",
        geocodeCity: "Muskegon, MI",
        minimumAge: 16,
        applicationUrl: "https://trinityhealthwm.vsyslive.com/pages/app/TEENAPP",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16-17 (per the shared Trinity Health West Michigan VSys One portal).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "virtua-voorhees",
    name: "Virtua Voorhees Hospital",
    description:
      "A Virtua Health hospital campus in Voorhees, New Jersey, sharing the system-wide Junior Volunteer application portal with Virtua's four other already-listed New Jersey campuses (Marlton, Mount Holly, Our Lady of Lourdes, Willingboro).",
    websiteUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
    city: "Voorhees, NJ",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Support hospital operations at Virtua Voorhees Hospital as a junior volunteer. Voorhees is confirmed directly as a selectable site in Virtua's shared JUNIORAPP portal (virtua.vsyslive.com/pages/app/JUNIORAPP), the same form already used for Virtua's Marlton, Mount Holly, Our Lady of Lourdes, and Willingboro records. Minimum age is carried over from that shared system-wide policy (14) rather than independently re-confirmed on a Voorhees-specific page, since the age gate lives on the shared form, not per-site.",
        location: "100 Bowman Drive, Voorhees, NJ 08043",
        zip: "08043",
        geocodeCity: "Voorhees, NJ",
        minimumAge: 14,
        applicationUrl: "https://virtua.vsyslive.com/pages/app/JUNIORAPP",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Age 14+ (per Virtua's system-wide Junior Volunteer policy, shared across all listed campuses).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "baylor-scott-white-mckinney",
    name: "Baylor Scott & White Medical Center – McKinney",
    description:
      "McKinney, TX hospital (Baylor Scott & White Health) with a Junior Volunteer program for ages 16 and up — a distinct campus from the already-listed Temple and Grapevine locations, on the same bsw.vsyslive.com platform.",
    websiteUrl: "https://bsw.vsyslive.com/pages/app/VOLUNTEERAPP",
    city: "McKinney, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Support hospital operations at Baylor Scott & White Medical Center – McKinney as a junior volunteer. Confirmed directly via the shared bsw.vsyslive.com application, quoted verbatim: 'We are accepting applications for Volunteers ages 16+... currently recruiting for: Main Registration, Women's Imaging Center, and MyBSWHealth App Rounding.' Most other Baylor Scott & White locations on this same portal require 18+ — McKinney is a genuine exception, independently confirmed.",
        location: "5252 W University Dr, McKinney, TX 75071",
        zip: "75071",
        geocodeCity: "McKinney, TX",
        minimumAge: 16,
        applicationUrl: "https://bsw.vsyslive.com/pages/app/VOLUNTEERAPP",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 16+ (per the org's own shared application portal).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "ascension-providence-waco",
    name: "Ascension Providence",
    description:
      "A hospital in Waco, Texas, part of the Ascension health system's Texas VSys One volunteer portal (ascensiontx.vsyslive.com) — the first ServeFinder record from Ascension, a newly-discovered multi-state VSys One system (~140 hospitals, ~19 states) flagged this session as the highest-priority platform for a dedicated future expansion pass.",
    websiteUrl: "https://ascensiontx.vsyslive.com",
    city: "Waco, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description:
          "Support hospital operations at Ascension Providence as a junior volunteer. Confirmed directly via the health system's own shared Texas VSys One portal (ascensiontx.vsyslive.com), which lists two separate application pathways for this facility: 'APPLY NOW (Age 15-17)' and 'APPLY NOW (Age 18 and above).' Address independently corroborated via Medicare.gov and CMS.gov provider listings (6901 Medical Parkway, Waco, TX 76712), not just the hospital's own marketing page.",
        location: "6901 Medical Parkway, Waco, TX 76712",
        zip: "76712",
        geocodeCity: "Waco, TX",
        minimumAge: 15,
        applicationUrl: "https://ascensiontx.vsyslive.com",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer",
        category: "Healthcare",
        interestsTags: ["healthcare"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per the org's own shared Texas VSys One portal).",
        programFocusTags: ["hospital_volunteering"],
        reviewStatus: "pending",
      },
    ],
  },

  // Ascension VSys One build-out: Florida's ascensionfl.vsyslive.com
  // portal states one explicit "ages 15 years to 17 years" teen policy
  // that names all 8 of these facilities on a single shared application
  // page — independently confirmed via direct fetch, unlike Texas/
  // Wisconsin/Oklahoma where per-facility policies differ or lack an
  // explicit number. Addresses independently corroborated via CMS.gov/
  // Medicare.gov/American Hospital Directory, not just the org's own
  // marketing pages.
  {
    slug: "ascension-sacred-heart-bay",
    name: "Ascension Sacred Heart Bay",
    description: "An Ascension hospital in Panama City, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Panama City, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension Sacred Heart Bay as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility alongside 7 other Ascension Florida sites on one shared application — not a per-facility policy.",
        location: "615 N Bonita Ave, Panama City, FL 32401", zip: "32401", geocodeCity: "Panama City, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-sacred-heart-emerald-coast",
    name: "Ascension Sacred Heart Emerald Coast",
    description: "An Ascension hospital in Miramar Beach, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Miramar Beach, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension Sacred Heart Emerald Coast as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility alongside 7 other Ascension Florida sites on one shared application.",
        location: "7800 U.S. Highway 98 West, Miramar Beach, FL 32550", zip: "32550", geocodeCity: "Miramar Beach, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-sacred-heart-gulf",
    name: "Ascension Sacred Heart Gulf",
    description: "An Ascension hospital in Port Saint Joe, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Port Saint Joe, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension Sacred Heart Gulf as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility alongside 7 other Ascension Florida sites on one shared application.",
        location: "3801 E Hwy 98, Port Saint Joe, FL 32456", zip: "32456", geocodeCity: "Port Saint Joe, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-sacred-heart-pensacola",
    name: "Ascension Sacred Heart Pensacola",
    description: "An Ascension hospital campus in Pensacola, Florida (also home to Studer Family Children's Hospital on the same campus), sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Pensacola, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension Sacred Heart Pensacola as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility (listed as 'Pensacola-Studer') alongside 7 other Ascension Florida sites on one shared application.",
        location: "5151 N 9th Ave, Pensacola, FL 32504", zip: "32504", geocodeCity: "Pensacola, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-st-vincents-clay-county",
    name: "Ascension St. Vincent's Clay County",
    description: "An Ascension hospital in Middleburg, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Middleburg, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension St. Vincent's Clay County as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility alongside 7 other Ascension Florida sites on one shared application.",
        location: "1670 St Vincents Way, Middleburg, FL 32068", zip: "32068", geocodeCity: "Middleburg, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-st-vincents-riverside",
    name: "Ascension St. Vincent's Riverside",
    description: "An Ascension hospital in Jacksonville, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Jacksonville, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension St. Vincent's Riverside as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility alongside 7 other Ascension Florida sites on one shared application. Genuinely distinct campus from the also-Jacksonville St. Vincent's Southside record below.",
        location: "1 Shircliff Way, Jacksonville, FL 32204", zip: "32204", geocodeCity: "Jacksonville, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-st-vincents-southside",
    name: "Ascension St. Vincent's Southside",
    description: "An Ascension hospital in Jacksonville, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "Jacksonville, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension St. Vincent's Southside as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility alongside 7 other Ascension Florida sites on one shared application. Genuinely distinct campus from the also-Jacksonville St. Vincent's Riverside record above.",
        location: "4201 Belfort Rd, Jacksonville, FL 32216", zip: "32216", geocodeCity: "Jacksonville, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-st-vincents-st-johns",
    name: "Ascension St. Vincent's St. Johns",
    description: "An Ascension hospital in St. Johns, Florida, sharing Ascension Florida's Teen Volunteer application portal.",
    websiteUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN",
    city: "St. Johns, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Application",
        description: "Support hospital operations at Ascension St. Vincent's St. Johns as a teen volunteer. Confirmed directly via Ascension Florida's shared VSys One teen application (ascensionfl.vsyslive.com/pages/app/TEEN), quoted verbatim: 'This application is for teens ages 15 years to 17 years,' which names this facility (as 'St. Vincent's St. John') alongside 7 other Ascension Florida sites on one shared application.",
        location: "205 Trinity Way, St. Johns, FL 32259", zip: "32259", geocodeCity: "St. Johns, FL",
        minimumAge: 15, applicationUrl: "https://ascensionfl.vsyslive.com/pages/app/TEEN", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per Ascension Florida's shared teen application portal).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },

  // Ascension Tennessee: unlike Florida's year-round shared teen policy,
  // Tennessee runs a dated "Junior Volunteer Summer Program" per
  // facility with a Jan 1 - Mar 31 application window each year — both
  // facilities checked are confirmed CLOSED for the current cycle (West's
  // window ended, Rutherford explicitly full), so staged seasonal, not
  // open, per this session's live re-verification.
  {
    slug: "ascension-saint-thomas-west",
    name: "Ascension Saint Thomas Hospital West",
    description: "An Ascension hospital in Nashville, Tennessee, running a seasonal Junior Volunteer Summer Program for high schoolers.",
    websiteUrl: "https://healthcare.ascension.org/volunteer/tnnas-nashville-tn-ascension-saint-thomas-hospital-west-volunteer",
    city: "Nashville, TN",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Summer Program",
        description: "A 6-week summer volunteer program for high schoolers at Ascension Saint Thomas Hospital West. Confirmed directly via the org's own page, quoted verbatim: a 'six week volunteer opportunity for students between ages 15-18 and still in high school.' Applications are only accepted January 1 through March 31 each year; the 2026 cycle's window has already closed (deadline was March 28), so this is staged seasonal, not open, pending the next application cycle.",
        location: "4220 Harding Pike, Nashville, TN 37205", zip: "37205", geocodeCity: "Nashville, TN",
        minimumAge: 15, applicationUrl: "https://ascensiontn.vsyslive.com/pages/app/TNVOLAPP", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "2026 application window (Jan 1 - Mar 31) has closed. Check back in January for the next cycle.",
        externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-18, still in high school (per the org's own page).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "ascension-saint-thomas-rutherford",
    name: "Ascension Saint Thomas Rutherford",
    description: "An Ascension hospital in Murfreesboro, Tennessee, running a seasonal Junior Volunteer Summer Program for high schoolers.",
    websiteUrl: "https://healthcare.ascension.org/volunteer/tnnas-murfreesboro-tn-ascension-saint-thomas-rutherford-volunteer",
    city: "Murfreesboro, TN",
    contactEmail: null,
    opportunities: [
      {
        title: "Junior Volunteer Summer Program",
        description: "A 3-week summer volunteer program for high schoolers at Ascension Saint Thomas Rutherford. Confirmed directly via the org's own page, quoted verbatim: a 'three week volunteer opportunity for students between ages 15-18 and still in high school.' The same page states, quoted verbatim, 'This online volunteer application has been closed by Ascension Saint Thomas as it is full' — staged seasonal, not open, per that explicit current-cycle-full status.",
        location: "1700 Medical Center Parkway, Murfreesboro, TN 37129", zip: "37129", geocodeCity: "Murfreesboro, TN",
        minimumAge: 15, applicationUrl: "https://ascensiontn.vsyslive.com/pages/app/TNVOLAPP", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Current cycle's application is full/closed. Check back for the next annual cycle.",
        externalIdSuffix: "junior-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-18, still in high school (per the org's own page).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },

  // Communico library platform: a parallel research worker on this
  // platform stalled twice (infrastructure failure, not a research
  // quality issue) and didn't finish this session, so these 3 tenants
  // were found and independently live-verified directly rather than via
  // a subagent report — each confirmed on its own current general page
  // (not a dated/expiring calendar event instance, learning from last
  // session's stale-link problem), with a genuinely current dated event
  // additionally cross-checked where available (Ocean County: a Sept
  // 12, 2026 session; Gail Borden: a Sept 5, 2026 orientation, 3 days
  // out from this session's date).
  {
    slug: "ocean-county-library",
    name: "Ocean County Library",
    description: "A 21-branch public library system in Ocean County, New Jersey, running a school-year Teen Volunteer program (Teen Advisory Board, Adopt a Shelf, Teen Book & Media Reviewer) plus a summer program.",
    websiteUrl: "https://theoceancountylibrary.org/teens/volunteers",
    city: "Toms River, NJ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Volunteer at Ocean County Library through one of several teen tracks. Confirmed directly via the library's own current page, quoted verbatim: 'This opportunity is for teens ages 12 – 18 only. Application must be signed by a teen and parent or guardian.' School-year tracks (Sept-May) include Teen Advisory Board, Adopt a Shelf, and Teen Book & Media Reviewer; a summer program (S.A.I.L., entering 8th grade) is separate and currently closed for the season. A live 'Teen Volunteer Day' event is also independently confirmed on the library's calendar (attend.oceancountylibrary system) for September 12, 2026, consistent with an actively recurring program, not a stale listing. Apply via the OCL Teen Application linked from the library's own page.",
        location: "Ocean County Library branches (multiple, 21 locations), NJ", zip: null, geocodeCity: "Toms River, NJ",
        minimumAge: 12, applicationUrl: "https://theoceancountylibrary.org/teens/volunteers/virtual/application", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "teen-volunteer-program", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-18 (per the library's own page); the summer-only S.A.I.L. track additionally requires entering 8th grade.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "gail-borden-public-library",
    name: "Gail Borden Public Library District",
    description: "A public library district in Elgin, Illinois, running a year-round Teen Volunteer program requiring an orientation.",
    websiteUrl: "https://gailborden.info/teens",
    city: "Elgin, IL",
    contactEmail: "gbpl_volunteers@gailborden.info",
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Assist with library events, shelving, and program prep as a teen volunteer at Gail Borden Public Library. Confirmed directly via the library's own current Teens page, quoted verbatim: 'Teens in grades 6-12 are invited to volunteer at the library... assisting with library events, revitalizing the library space, preparing crafts for programs, and more.' A live Teen Volunteer Orientation session is independently confirmed on the library's own current events listing for September 5, 2026 (3 days from this record's verification date), confirming the program is actively recurring, not stale.",
        location: "270 N. Grove Ave., Elgin, IL 60120", zip: "60120", geocodeCity: "Elgin, IL",
        minimumAge: 11, applicationUrl: "https://gailborden.info/teens", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "teen-volunteer-program", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Grades 6-12 (per the library's own page); all prospective volunteers must attend an orientation before signing up for shifts.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "pasco-county-libraries",
    name: "Pasco County Libraries",
    description: "A 9-branch public library cooperative in Pasco County, Florida, running a year-round Teen Volunteer program.",
    websiteUrl: "https://www.pascolibraries.org/support-the-library/volunteer/",
    city: "Dade City, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Assist with branch tasks as a teen volunteer at Pasco County Libraries. Confirmed directly via the library's own current Volunteer page, quoted verbatim: 'We accept both Adult Volunteers, who are aged 18+... and Teen Volunteers who are aged 13-18.' 'Teen Volunteer' is listed as one of several named, distinct volunteer roles (alongside Adult Literacy Tutoring, Makerspace Volunteer, Program Assistant, Shelving Volunteer) on the org's own current page, each with its own application. Opportunities vary by the library's 9 branches depending on availability.",
        location: "Pasco County Libraries branches (multiple, 9 locations), FL", zip: null, geocodeCity: "Dade City, FL",
        minimumAge: 13, applicationUrl: "https://www.pascolibraries.org/support-the-library/volunteer/", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18 (per the library's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "york-county-libraries",
    name: "York County Libraries",
    description: "A 13-branch public library system in York County, South Carolina, running a year-round volunteer program open to teens.",
    websiteUrl: "https://www.yorklibraries.org/support/volunteer/",
    city: "Rock Hill, SC",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Support library operations as a teen volunteer at York County Libraries. Confirmed directly via the library's own current Volunteer page, quoted verbatim: 'If you are an adult or teen (age 12 or older) we would love to have you join our volunteer team!' The same page states 'Volunteers serve at all 13 of our libraries and in several of our behind-the-scenes departments!' A comprehensive online application form is available, or applicants may print and submit one directly at their chosen library location.",
        location: "York County Libraries branches (multiple, 13 locations), SC", zip: null, geocodeCity: "Rock Hill, SC",
        minimumAge: 12, applicationUrl: "https://www.yorklibraries.org/support/volunteer/", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 12 or older (per the library's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Volgistics platform: a bounded 10-candidate discovery pass found a
  // 50% hit rate across Volgistics-hosted municipal parks/library
  // tenants (2 of 4 verified) — a promising signal for a future
  // dedicated pass, though not yet enough tenants sampled to build a
  // generalized connector. Both staged here were independently
  // reloaded and confirmed directly, not taken from the research
  // worker's report alone.
  {
    slug: "rockwood-park-museum",
    name: "Rockwood Park & Museum",
    description: "A New Castle County, Delaware historic park and museum running a youth volunteer program via Volgistics.",
    websiteUrl: "https://www.newcastlede.gov/517",
    city: "Wilmington, DE",
    contactEmail: null,
    opportunities: [
      {
        title: "Youth Volunteer",
        description: "Support park and museum operations at Rockwood Park & Museum. Confirmed directly via New Castle County's own current page, quoted verbatim: 'There are also plenty of opportunities for youth volunteers from age 16 and older.'",
        location: "4651 Washington St Extension, Wilmington, DE 19802", zip: "19802", geocodeCity: "Wilmington, DE",
        minimumAge: 16, applicationUrl: "https://www.volgistics.com/appform/1992166270", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "youth-volunteer", category: "Arts & Culture", interestsTags: ["arts_culture"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16 or older (per the county's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "irvine-public-library",
    name: "Irvine Public Library",
    description: "A 3-branch public library system in Irvine, California, running several teen volunteer tracks (Program Assistance, Toy Cleaning, Teen Advisory Group) via Volgistics.",
    websiteUrl: "https://cityofirvine.gov/irvine-public-library/volunteer-opportunities",
    city: "Irvine, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Assist library staff with craft-activity prep and toy sanitizing/organizing as a teen volunteer at Irvine Public Library. Confirmed directly via the city's own current page, quoted verbatim: 'High school students ages 14 and over... are encouraged to volunteer,' with Program Assistance and Toy Cleaning both specifically scoped to 'High school teens ages 14–17.' A separate Teen Advisory Group track exists but the page's own current text states 'All teen volunteer spots are currently full. Applications received after August 26 will be placed on a wait list' — staged as waitlisted to reflect this honestly rather than presented as immediately open.",
        location: "Irvine Public Library branches (multiple, 3 locations), CA", zip: null, geocodeCity: "Irvine, CA",
        minimumAge: 14, applicationUrl: "https://www.volgistics.com/appform/337674493", applicationDeadline: null,
        availabilityStatus: "waitlisted", externalIdSuffix: "teen-volunteer-program", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-17 (per the city's own page); general library-wide floor is 14+.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Samaritan platform: a newly-discovered second family beyond City of
  // Phoenix (ServeFinder's existing Samaritan source). Samaritan's own
  // site claims 1,400+ client organizations — a genuinely large
  // untapped platform, though several instances sit behind a WAF
  // (blocked this session: Santa Clara County CA, Kaiser Permanente
  // South Bay) so a future connector would need per-tenant handling.
  {
    slug: "city-of-santa-clarita-trail-volunteers",
    name: "City of Santa Clarita (SCV Trail Users)",
    description: "A City of Santa Clarita, California volunteer program (via the Samaritan platform) running standing, as-needed park/trail-maintenance workdays.",
    websiteUrl: "https://volunteer.samaritan.com/custom/526",
    city: "Santa Clarita, CA",
    contactEmail: "stuber@santa-clarita.com",
    opportunities: [
      {
        title: "Bike Park Workdays",
        description: "Help maintain the pump and BMX tracks and assist with general clean-up at the Trek Bike Park in Santa Clarita. Confirmed directly via the City's own live Samaritan-platform opportunity page (opp_details/9968), quoted verbatim: 'AGE: 12 and up.' Projects are held on an as-needed basis (not date-bound), with schedule/details emailed prior to each project date. Note: the originally-staged 'Trail Workday Volunteer' record (opp_details/13070, age 15+) was independently re-checked this session and found to be a stale/expired 2025 listing with 'All Shifts Are Full' — replaced with this genuinely current, standing opportunity from the same city portal instead of approving stale evidence.",
        location: "20870 Centre Pointe Parkway, Santa Clarita, CA 91350", zip: "91350", geocodeCity: "Santa Clarita, CA",
        minimumAge: 12, applicationUrl: "https://volunteer.samaritan.com/custom/526/opp_details/9968", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "bike-park-workdays", category: "Environment", interestsTags: ["environment"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 12+ (per the city's own current page). Minors must be added as a family member to a parent's account.",
        parentalConsentRequired: true,
        programFocusTags: ["environmental_stewardship"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "howard-county-recreation-parks",
    name: "Howard County Recreation & Parks",
    description: "A Maryland county parks department (via the Samaritan platform) running recurring teen-eligible conservation stewardship volunteer projects.",
    websiteUrl: "https://hocovolunteer.org/recruiter/index.php?class=OppSearch&recruiterID=501&act=search_all&type=all",
    city: "Columbia, MD",
    contactEmail: null,
    opportunities: [
      {
        title: "MPEA Conservation Stewardship Project",
        description: "Assist with habitat restoration tasks (invasive-species removal, shelter clearing, tree planting) at recurring Howard County conservation stewardship project days. Confirmed directly via the county's own Samaritan-platform (white-labeled) volunteer portal, which lists multiple 2026-dated instances of this same project (Sept-Nov), each quoted verbatim: 'Ages 18+ (13-17 with guardian present).' Recurring dated instances of the same underlying project are consolidated into this one record rather than staged separately.",
        location: "Howard County parks (multiple sites), MD", zip: null, geocodeCity: "Columbia, MD",
        minimumAge: 13, applicationUrl: "https://hocovolunteer.org/recruiter/index.php?class=OppSearch&recruiterID=501&act=search_all&type=all", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "mpea-conservation-stewardship", category: "Environment", interestsTags: ["environment"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 18+ independently; ages 13-17 must have a guardian present for the full shift (per the county's own portal).",
        programFocusTags: ["environmental_stewardship"], reviewStatus: "pending",
      },
    ],
  },

  // Off-target finds from a Volgistics-focused search pass — real
  // organizations with explicit teen age evidence, just hosted on a
  // different platform than the one being searched for. Staged anyway
  // since the evidence is solid and independently re-verified.
  {
    slug: "canby-public-library",
    name: "Canby Public Library",
    description: "A public library in Canby, Oregon, running a year-round teen-eligible volunteer program.",
    websiteUrl: "https://www.canbyoregon.gov/library/page/volunteers",
    city: "Canby, OR",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Assist with library tasks as a volunteer at Canby Public Library. Confirmed directly via the library's own current page, quoted verbatim: 'The minimum age for volunteers is 15.' Volunteers under 18 need parental or legal guardian approval. All volunteers must complete an online application.",
        location: "220 NE 2nd Avenue, Canby, OR 97013", zip: "97013", geocodeCity: "Canby, OR",
        minimumAge: 15, applicationUrl: "https://www.canbyoregon.gov/library/page/volunteers", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 15+ (per the library's own page); under-18 volunteers need parent/guardian approval.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "three-rivers-park-district",
    name: "Three Rivers Park District",
    description: "A multi-park district in the Minneapolis, Minnesota metro area running a seasonal Counselor-in-Training (CIT) program for teens.",
    websiteUrl: "https://www.threeriversparks.org/page/teen-volunteer-opportunities",
    city: "Plymouth, MN",
    contactEmail: "mary.morris@threeriversparks.org",
    opportunities: [
      {
        title: "Counselor-in-Training (CIT) Program",
        description: "Assist camp staff as a Counselor-in-Training at Three Rivers Park District. Confirmed directly via the district's own current page, quoted verbatim: 'Open to ages 15–18.' Applications are accepted March through May each year; staged seasonal since the current application window's status wasn't confirmable on this pass.",
        location: "Three Rivers Park District (multiple parks), MN", zip: null, geocodeCity: "Plymouth, MN",
        minimumAge: 15, applicationUrl: "https://www.threeriversparks.org/page/teen-volunteer-opportunities", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Applications accepted March through May each year; check the district's page for the current cycle's status.",
        externalIdSuffix: "counselor-in-training", category: "Sports & Rec", interestsTags: ["sports_rec"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-18 (per the district's own page).",
        programFocusTags: ["youth_mentoring"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "forsyth-county-public-library",
    name: "Forsyth County Public Library",
    description: "A multi-branch public library system in Forsyth County, Georgia, running a year-round teen-eligible volunteer program.",
    websiteUrl: "https://www.forsythpl.org/volunteer",
    city: "Cumming, GA",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Assist with library tasks as a volunteer at Forsyth County Public Library. Confirmed directly via the library's own current page, quoted verbatim: 'Volunteers must be at least age 16. (Exceptions may be made for volunteers for the Summer Reading Program and other programs targeted to children.)' A Volunteer Application PDF is available on the library's site or at any branch, submitted via email, mail, or fax.",
        location: "Forsyth County Public Library branches (multiple, incl. Cumming), GA", zip: "30040", geocodeCity: "Cumming, GA",
        minimumAge: 16, applicationUrl: "https://www.forsythpl.org/volunteer", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the library's own page); younger exceptions possible for Summer Reading Program roles specifically, not general volunteering.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Samaritan platform, continued build-out: 2 more independently-
  // confirmed tenants beyond Santa Clarita/Howard County, bringing the
  // total to 5 real, non-blocked, age-verified Samaritan tenants across
  // this session — still too thin against the platform's claimed
  // 1,400+ clients to justify a real connector yet, but a real signal
  // worth another dedicated pass with working search access.
  {
    slug: "prince-georges-parks-recreation",
    name: "Prince George's Parks and Recreation",
    description: "A Maryland county parks department (via the Samaritan platform) running seasonal summer youth volunteer programs.",
    websiteUrl: "https://www.pgparks.com/get-involved/volunteer-opportunities",
    city: "Riverdale, MD",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer Playtime Volunteer",
        description: "Assist with the Summer Playtime children's program as a youth volunteer for Prince George's Parks and Recreation. Confirmed directly via the county's own current page, quoted verbatim: 'Youth Individuals must be the required age on or before May 31 to volunteer: Summer Playtime: 14 years old.' A related, separately age-gated track (Summer Day Camps, 15 years old) also exists on the same application system. Volunteer applications are accepted online March 1 - May 1 each year; staged seasonal given that annual window.",
        location: "Prince George's County parks (multiple sites), MD", zip: null, geocodeCity: "Riverdale, MD",
        minimumAge: 14, applicationUrl: "https://pgc.samaritan.com/custom/1543/opp_search", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Applications accepted March 1 - May 1 each year for the summer program.",
        externalIdSuffix: "summer-playtime-volunteer", category: "Sports & Rec", interestsTags: ["sports_rec"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ for Summer Playtime; a separate Summer Day Camps track requires age 15+ (per the county's own page).",
        programFocusTags: ["youth_mentoring"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "metropolitan-library-system-okc",
    name: "Metropolitan Library System (Oklahoma City)",
    description: "A multi-branch public library system in the Oklahoma City metro area running a year-round teen-eligible volunteer program via the Samaritan platform.",
    websiteUrl: "https://www.metrolibrary.org/volunteer",
    city: "Oklahoma City, OK",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Assist with library tasks as a volunteer at a Metropolitan Library System branch. Confirmed directly via the library's own current page, quoted verbatim: 'Library volunteers must be at least 12 years of age.' A real search-and-signup application system (Samaritan) lets volunteers find and sign up for open positions at their preferred branch.",
        location: "Metropolitan Library System branches (multiple), OK", zip: null, geocodeCity: "Oklahoma City, OK",
        minimumAge: 12, applicationUrl: "https://ec.samaritan.com/custom/1527/", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 12+ (per the library's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  {
    slug: "nebraska-humane-society",
    name: "Nebraska Humane Society",
    description: "An animal shelter in Omaha, Nebraska, running a monthly Youth Volunteer Day for teens.",
    websiteUrl: "https://www.nehumanesociety.org/volunteer/",
    city: "Omaha, NE",
    contactEmail: null,
    opportunities: [
      {
        title: "Youth Volunteer Day",
        description: "Assist with shelter tasks at a monthly Youth Volunteer Day. Confirmed directly via the shelter's own current page, quoted verbatim: 'Youth volunteer days are held on the last Saturday of each month and are open to ages 14-18.' A real Youth Volunteer Application form is linked from the org's own page.",
        location: "8929 Fort Street, Omaha, NE 68134", zip: "68134", geocodeCity: "Omaha, NE",
        minimumAge: 14, applicationUrl: "http://support.nehumanesociety.org/site/Survey?ACTION_REQUIRED=URI_ACTION_USER_REQUESTS&SURVEY_ID=10982", applicationDeadline: null,
        availabilityStatus: "open", externalIdSuffix: "youth-volunteer-day", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-18 (per the shelter's own page); held the last Saturday of each month.",
        programFocusTags: ["animal_welfare"], reviewStatus: "pending",
      },
    ],
  },

  // Arizona sweep, this session: independently verified via real
  // browser (both .gov domains hit the familiar WAF-style error on
  // plain fetch, resolved via browser same as prior sessions).
  // Avondale's Youth Advisory Commission was also checked and confirmed
  // to be a duplicate of the already-approved "Avondale Youth Advisory
  // Council (AYAC)" record — correctly not re-added.
  {
    slug: "goodyear-youth-commission",
    name: "City of Goodyear Youth Commission",
    description: "A City of Goodyear, Arizona youth civic-engagement commission for high schoolers, advising the City Council on youth-related issues.",
    websiteUrl: "https://www.goodyearaz.gov/our-city/residents/goodyear-youth-commission",
    city: "Goodyear, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Goodyear Youth Commission",
        description: "Advise the Goodyear City Council and staff on youth-related issues (programming, recreation, special events) as a Goodyear Youth Commission (GYC) member. Confirmed directly via the city's own current page, quoted verbatim: 'High school students (Grades 9-12) are eligible to apply. Students may also apply during the summer between 8th and 9th grades.' Meets the 4th Wednesday of the month at Goodyear City Hall. Applications open April 1-30 each year (references due May 1) — staged seasonal to reflect that real annual window.",
        location: "1900 N. Civic Square, Goodyear, AZ 85395", zip: "85395", geocodeCity: "Goodyear, AZ",
        minimumAge: 13, applicationUrl: "https://www.goodyearaz.gov/our-city/residents/goodyear-youth-commission", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Applications open April 1-30 each year; references due by May 1.",
        externalIdSuffix: "youth-commission", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Grades 9-12, or entering 9th grade over the summer (per the city's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },
  {
    slug: "chandler-center-for-the-arts",
    name: "Chandler Center for the Arts",
    description: "A performing arts venue in Chandler, Arizona, running a volunteer program (ushers, greeters, ticket assistance) via Volgistics.",
    websiteUrl: "https://chandlercenter.org/support-us/volunteer",
    city: "Chandler, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer Usher/Greeter",
        description: "Support live performances at Chandler Center for the Arts as a volunteer usher or greeter. Confirmed directly via the venue's own current page, quoted verbatim: 'Volunteers must be at least 16 years of age with parental supervision to volunteer.' Those 18 and older may volunteer without a guardian present. Apply via the linked Volgistics Volunteer Application.",
        location: "250 N. Arizona Avenue, Chandler, AZ 85225", zip: "85225", geocodeCity: "Chandler, AZ",
        minimumAge: 16, applicationUrl: "https://chandlercenter.org/support-us/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "volunteer-usher-greeter", category: "Arts & Culture", interestsTags: ["arts_culture"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 16+ with parental supervision; 18+ may volunteer independently (per the venue's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Discovered via a Volgistics platform sweep (site:volgistics.com/od
  // "Age 14"/"Age 15"/"Age 16" searches) after direct Google indexing of
  // the org's own domain came back empty for teen-specific terms. The
  // Opportunity Directory (od/354299) lists 11 distinct Age-16+ roles
  // total; only 3 genuinely different-duty ones are staged here (pantry
  // fulfillment, refrigerated-food sorting, client check-in) rather than
  // all 11 near-variants (e.g. Pantry Prep vs. Pantry Session are the
  // same duty on different shifts) — consolidating same-duty shift
  // variants into one record, same policy as every other multi-shift
  // source in this file. Cross-checked against the org's own
  // riverfoodpantry.org pages (address, volunteer-line phone, and the
  // "PANTRY / FAM / MUNCH / RIVER CAFÉ" program names) for first-party
  // confirmation, not just the Volgistics-hosted pages.
  {
    slug: "the-river-food-pantry",
    name: "The River Food Pantry",
    description: "A Madison, Wisconsin food pantry running Drive-Thru Groceries, walk-up distribution, a refrigerated-food rescue program, and several meal programs (FAM, Munch, The River Café), all staffed through a Volgistics-hosted Opportunity Directory.",
    websiteUrl: "https://www.riverfoodpantry.org/volunteer/",
    city: "Madison, WI",
    contactEmail: "volunteer@riverfoodpantry.org",
    opportunities: [
      {
        title: "Pantry Assistant/Walk-ups",
        description: "Serve clients at The River Food Pantry's walk-up door: assist with registration, pick their grocery order, and help with other Drive-Thru tasks (prepping cooler bags, sorting product, helping with carts) between walk-ups. Confirmed via the org's own Volgistics Opportunity Directory listing, titled verbatim 'Pantry Assistant/Walk-ups (Age 16+)'.",
        location: "3301 Packers Ave, Madison, WI 53704", zip: "53704", geocodeCity: "Madison, WI",
        minimumAge: 16, applicationUrl: "https://www.riverfoodpantry.org/volunteer/at-the-pantry/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "pantry-assistant-walkups", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the org's own Opportunity Directory listing title).",
        programFocusTags: ["food_security"], reviewStatus: "pending",
      },
      {
        title: "Cooler Recovery Assistant",
        description: "Process, sort, and safely package refrigerated food (dairy, produce, meats, prepared meals) rescued from local partners so it can reach families in need — a less physically strenuous role than filling grocery carts, focused on food-safety inspection and cold-chain handling. Confirmed via the org's own Volgistics Opportunity Directory listing, titled verbatim 'Cooler Recovery Assistant (Age 16+)'.",
        location: "3301 Packers Ave, Madison, WI 53704", zip: "53704", geocodeCity: "Madison, WI",
        minimumAge: 16, applicationUrl: "https://www.riverfoodpantry.org/volunteer/at-the-pantry/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "cooler-recovery-assistant", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the org's own Opportunity Directory listing title).",
        programFocusTags: ["food_security"], reviewStatus: "pending",
      },
      {
        title: "Client Registration Assistant",
        description: "Greet clients at the Drive-Thru Grocery line, perform digital check-ins on a tablet, hand out grocery menus/flyers, and direct traffic — a mentored 'learning-by-doing' entry role that is the prerequisite pathway to a Client Registration Lead shift. Confirmed via the org's own Volgistics Opportunity Directory listing, titled verbatim 'Client Registration Assistant (Age 16+)'.",
        location: "3301 Packers Ave, Madison, WI 53704", zip: "53704", geocodeCity: "Madison, WI",
        minimumAge: 16, applicationUrl: "https://www.riverfoodpantry.org/volunteer/at-the-pantry/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "client-registration-assistant", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the org's own Opportunity Directory listing title).",
        programFocusTags: ["food_security"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep, following up an earlier hit for org 25299
  // that turned out to be a stale 2024-dated seasonal listing ("2024
  // Teen Volunteers Reading Buddies Program," deadline already passed
  // two years ago) — correctly not used. Checked the org's CURRENT
  // sitemap instead and found two live, currently-listed 2026 events
  // with genuine numeric age evidence in their own qualifications text.
  // Note for a future session: this library also runs an annual summer
  // "Teen Reading Buddies" program (age 14-18, confirmed via multiple
  // years' listings) that is real but currently out of its seasonal
  // window (not on the live sitemap as of this check) — not staged here
  // to avoid guessing next year's exact dates.
  {
    slug: "poudre-river-public-library-district",
    name: "Poudre River Public Library District",
    description: "The public library district serving Fort Collins, Colorado, running teen/tween volunteer roles for specific branch programs and events via a Volgistics-hosted Opportunity Directory.",
    websiteUrl: "https://poudrelibraries.org/volunteer",
    city: "Fort Collins, CO",
    contactEmail: null,
    opportunities: [
      {
        title: "Tween Night Volunteer",
        description: "Help facilitate Tween Night, a monthly program for tweens to learn and socialize (presented in English and Spanish) at Old Town Library. Duties include explaining/demonstrating activities, encouraging participation, minor setup/teardown, and alerting facilitators to any tween needing extra support. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'I would prefer volunteers that are between 14 and 19 years-old.'",
        location: "201 Peterson St, Fort Collins, CO 80524", zip: "80524", geocodeCity: "Fort Collins, CO",
        minimumAge: 14, applicationUrl: "https://poudrelibraries.org/teen", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "tween-night-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Preferred ages 14-19 (per the library's own Opportunity Directory listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Fiesta Familiar de Lotería Volunteer",
        description: "Assist with setup, cleanup, and hosting during Fiesta Familiar de Lotería, a Spanish-language family Lotería (bingo-style) game night at Old Town Library. Requires Spanish speaking or full bilingual fluency. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Volunteer must be 16+.'",
        location: "201 Peterson St, Fort Collins, CO 80524", zip: "80524", geocodeCity: "Fort Collins, CO",
        minimumAge: 16, applicationUrl: "https://poudrelibraries.org/teen", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "fiesta-familiar-de-loteria-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "one_time", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+, Spanish-speaking or fully bilingual required (per the library's own Opportunity Directory listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep. Found via "CHH Volunteen-<department>"-titled
  // listings (Clinical Research, Breast Center, Guest Services, Bariatric,
  // Burn ICU, etc.) — a single hospital-wide teen volunteer program with
  // many department placement options, same shape as every other hospital
  // Junior/Teen Volunteer program in this file: staged as ONE record, not
  // one per department, since the department is a placement choice within
  // one program, not a materially different opportunity. Age (14-18) and
  // the program's real spring-application/summer-session cadence were
  // both confirmed directly on the hospital's own cabellhuntington.org
  // pages, not just the Volgistics listings or a St. Mary's PDF. St.
  // Mary's Medical Center (same Marshall Health Network, referenced in
  // that PDF as sharing the VolunTeen program) was not independently
  // confirmed this pass and is left for a future session.
  {
    slug: "cabell-huntington-hospital",
    name: "Cabell Huntington Hospital",
    description: "A Marshall Health Network hospital in Huntington, West Virginia, running a VolunTeen Program with placement options across many departments (Clinical Research, Breast Center, Guest Services, Bariatric, Burn ICU, and more), staffed through a Volgistics-hosted Opportunity Directory.",
    websiteUrl: "https://cabellhuntington.org/services/volunteer-services",
    city: "Huntington, WV",
    contactEmail: null,
    opportunities: [
      {
        title: "VolunTeen Program",
        description: "Serve in a non-medical support role at Cabell Huntington Hospital as part of the VolunTeen Program, with placement options across many departments (Clinical Research, Breast Center, Guest Services, Family Medicine, Bariatric, Burn ICU, 2 East Post Surgical, and others). Confirmed directly via the hospital's own current news page, quoted verbatim: 'A teen must be between 14 and 18 years old' and 'Our VolunTeen program only accepts new teens during the spring of each year.' The 2026 session ran June 15 through Aug. 9, 2026 — already closed as of this listing; the next application window opens in spring 2027 for a summer 2027 session.",
        location: "1340 Hal Greer Blvd, Huntington, WV 25701", zip: "25701", geocodeCity: "Huntington, WV",
        minimumAge: 14, applicationUrl: "https://cabellhuntington.org/services/volunteer-services", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Applications open each spring for a summer session; the 2026 session ran June 15-Aug. 9, 2026 and is now closed. Check back spring 2027.",
        externalIdSuffix: "volunteen-program", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-18 (per the hospital's own page).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep. Two genuinely distinct teen-eligible roles
  // confirmed on this org's Opportunity Directory, out of ~17 total
  // listed roles (most others are 18+ internships or unspecified-age
  // adult roles, e.g. Advancement Intern, Aquarist Intern, Horticulture
  // Volunteer — not included here since no numeric teen-age evidence was
  // found for them). Address/contact cross-checked against the org's own
  // thevlm.org pages, which also independently confirm the org runs
  // dedicated teen programming (a "What Opportunities Are There for
  // Teens at the Virginia Living Museum?" page).
  {
    slug: "virginia-living-museum",
    name: "Virginia Living Museum",
    description: "A natural history museum and living-animal exhibit in Newport News, Virginia, running both guest-facing interpretation volunteer roles and a dedicated teen environmental leadership program, staffed through a Volgistics-hosted Opportunity Directory.",
    websiteUrl: "https://thevlm.org/Support",
    city: "Newport News, VA",
    contactEmail: "volunteer@thevlm.org",
    opportunities: [
      {
        title: "Education Interpretation Volunteer",
        description: "Interact directly with museum guests, sharing knowledge of exhibits/animal areas and enhancing guests' understanding and appreciation of the natural environment. Requires a minimum 16-hour commitment served within 3-4 months. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'MINIMUM AGE: 15 years old to volunteer alone and ages 11-14 with an adult (family volunteer).' Apply via the Junior Application (ages 15-17).",
        location: "524 J. Clyde Morris Blvd, Newport News, VA 23601", zip: "23601", geocodeCity: "Newport News, VA",
        minimumAge: 15, applicationUrl: "https://thevlm.org/Support", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "education-interpretation-volunteer", category: "Environment", interestsTags: ["environment"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 15+ to volunteer independently; ages 11-14 only with an accompanying adult (per the org's own listing).",
        programFocusTags: ["environmental_stewardship"], reviewStatus: "pending",
      },
      {
        title: "Green Teens",
        description: "A mentorship program for high schoolers to learn about environmental issues, conservation action, and pollution's effects on wildlife, meeting weekly (Wednesdays at 4:00pm) to design and lead a sustainable project addressing a real problem in their environment (e.g. improving recycling at the museum), building leadership and problem-solving skills. Runs September through May, with additional summer-extension opportunities. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'MINIMUM AGE: Must be at least 15 years old' and 'High school student ages 15-18.'",
        location: "524 J. Clyde Morris Blvd, Newport News, VA 23601", zip: "23601", geocodeCity: "Newport News, VA",
        minimumAge: 15, applicationUrl: "https://thevlm.org/Support", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "green-teens", category: "Environment", interestsTags: ["environment"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "High school students ages 15-18 (per the org's own listing).",
        programFocusTags: ["environmental_stewardship"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep. Found via "CARE" and "Welcome Desk Main
  // Entrance" listings (both age 16+); ED Volunteer at the same hospital
  // was also checked and is genuinely 18+ ("must be at least 18 years
  // old and out of high school") — correctly excluded, not guessed
  // younger. Address confirmed via the hospital's own iuhealth.org
  // location page.
  {
    slug: "iu-health-west-hospital",
    name: "IU Health West Hospital",
    description: "An Indiana University Health hospital in Avon, Indiana, running several teen-eligible volunteer roles (geriatric patient support, guest services) staffed through a Volgistics-hosted Opportunity Directory. IU Health's Emergency Department volunteer role at this same hospital is 18+ only.",
    websiteUrl: "https://iuhealth.org/about-our-system/volunteering",
    city: "Avon, IN",
    contactEmail: null,
    opportunities: [
      {
        title: "CARE Volunteer",
        description: "Support hospitalized older patients through CARE, an evidence-based program addressing common geriatric issues (delirium, depression, loneliness, decline in mobility) that contribute to cognitive and functional decline during hospitalization. Duties include communicating and socializing with patients to maintain cognitive functioning, and serving as a therapeutic activist facilitating activities that stimulate cognition and physical well-being. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Must be at least age 16.'",
        location: "1111 N. Ronald Reagan Pkwy, Avon, IN 46123", zip: "46123", geocodeCity: "Avon, IN",
        minimumAge: 16, applicationUrl: "https://iuhealth.org/about-our-system/volunteering", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "care-volunteer", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the hospital's own Opportunity Directory listing).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
      {
        title: "Welcome Desk Main Entrance (Guest Ambassador)",
        description: "Serve as a Guest Ambassador at the hospital's main entrance: greet visitors, escort guests to service areas, push patients in wheelchairs, provide concierge-level directional support, and maintain wheelchair/wagon supply around the hospital and Professional Office Center. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Must be at least age 16.'",
        location: "1111 N. Ronald Reagan Pkwy, Avon, IN 46123", zip: "46123", geocodeCity: "Avon, IN",
        minimumAge: 16, applicationUrl: "https://iuhealth.org/about-our-system/volunteering", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "welcome-desk-guest-ambassador", category: "Healthcare", interestsTags: ["healthcare"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the hospital's own Opportunity Directory listing).",
        programFocusTags: ["hospital_volunteering"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep. Org-wide policy is a consistent "minimum age
  // 14, youth 14-17 must volunteer with a parent/guardian" across every
  // role checked — 3 of 8 total roles staged as genuinely distinct duties
  // (different animal types/tasks); Feline Support, Community Programs,
  // South Shore Felines/Rabbits, and Transport share the same org-wide
  // age policy but were not individually re-verified this pass and are
  // left for a future session rather than assumed identical without
  // checking. parentalConsentRequired mirrors this file's existing
  // pattern (see Chandler Center for the Arts above) for an accompanied-
  // minor requirement that doesn't disqualify the role, just gates it.
  {
    slug: "faas-alameda-animal-shelter",
    name: "Friends of the Alameda Animal Shelter (FAAS)",
    description: "The animal shelter serving Alameda, California, running several teen-eligible animal-care volunteer roles (canine, small-creature/rabbit, and general shelter support) staffed through a Volgistics-hosted Opportunity Directory. Youth 14-17 must volunteer alongside a parent or guardian.",
    websiteUrl: "https://www.alamedaanimalshelter.org",
    city: "Alameda, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Canine Support",
        description: "Provide general care and daily enrichment for shelter dogs: kennel cleaning, dog walking, and supporting staff with behavior modification/training and health monitoring. Requires a minimum 2 hours/week, 3-month commitment. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Minimum age: 14 years old. Youth volunteers (14-17 years) must volunteer with their parent or guardian.'",
        location: "1590 Fortmann Way, Alameda, CA 94501", zip: "94501", geocodeCity: "Alameda, CA",
        minimumAge: 14, applicationUrl: "https://www.alamedaanimalshelter.org", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "canine-support", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 14+; ages 14-17 must volunteer with a parent or guardian (per the org's own listing).",
        programFocusTags: ["animal_welfare"], reviewStatus: "pending",
      },
      {
        title: "Small Creature Support",
        description: "Provide general care and daily enrichment for rabbits and other small-creature shelter guests: kennel cleaning, socializing, and supporting staff with behavior monitoring and training. Requires a minimum 2 hours/week, 3-month commitment. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Minimum age: 14 years old. Youth volunteers (14-17 years) must volunteer with their parent or guardian.'",
        location: "1590 Fortmann Way, Alameda, CA 94501", zip: "94501", geocodeCity: "Alameda, CA",
        minimumAge: 14, applicationUrl: "https://www.alamedaanimalshelter.org", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "small-creature-support", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 14+; ages 14-17 must volunteer with a parent or guardian (per the org's own listing).",
        programFocusTags: ["animal_welfare"], reviewStatus: "pending",
      },
      {
        title: "Shelter Support",
        description: "Support overall shelter operations: clean kennel dishes and the kennel kitchen, do shelter laundry, clean canine areas/litter pans/animal crates, restock supplies, and make enrichment treats for dogs. No direct animal handling required. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Minimum age: 14 years old. Youth volunteers (14-17 years) must volunteer with their parent or guardian.'",
        location: "1590 Fortmann Way, Alameda, CA 94501", zip: "94501", geocodeCity: "Alameda, CA",
        minimumAge: 14, applicationUrl: "https://www.alamedaanimalshelter.org", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "shelter-support", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 14+; ages 14-17 must volunteer with a parent or guardian (per the org's own listing).",
        programFocusTags: ["animal_welfare"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep, following a different search angle ("Age 13"/
  // "Age 17"). This org (HELP of Southern Nevada) has many programs
  // (Diaper Bank, Homeless Response Teams, Shannon West Homeless Youth
  // Center), but only its Thanksgiving-specific shifts publish a numeric
  // age — Diaper Bank Support has no published age at all, so it was
  // checked but not staged (no guessing). Confirmed as a real, long-
  // running annual program (the org's separate HELP2O Water Drive is in
  // its 15th year per local press), not a one-off — staged as seasonal
  // since today's date is well before the Thanksgiving shift window.
  {
    slug: "help-of-southern-nevada",
    name: "HELP of Southern Nevada",
    description: "A Las Vegas-area social services nonprofit running Diaper Bank, homeless-response, and holiday-assistance programs, including an annual Thanksgiving food distribution staffed through a Volgistics-hosted Opportunity Directory.",
    websiteUrl: "https://www.helpsonv.org",
    city: "Las Vegas, NV",
    contactEmail: "volunteer@helpsonv.org",
    opportunities: [
      {
        title: "Turkey & Food Bag Distribution",
        description: "Assist with client check-in and distribution of Thanksgiving food bags and frozen turkeys to roughly 900 individuals and families in need at the org's Framing Hope Warehouse; may also help break down boxes and move warehouse supplies. Confirmed directly via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Volunteers must be age 13+ (minors must be pre-registered and accompanied by a registered adult volunteer).' Runs annually around Thanksgiving.",
        location: "1600 E. Flamingo Rd, Las Vegas, NV 89119", zip: "89119", geocodeCity: "Las Vegas, NV",
        minimumAge: 13, applicationUrl: "https://www.helpsonv.org", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Runs annually around Thanksgiving (November); not currently in its active shift window.",
        externalIdSuffix: "turkey-food-bag-distribution", category: "Community Service", interestsTags: ["community"],
        commitmentType: "one_time", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 13+; minors must be pre-registered and accompanied by a registered adult volunteer (per the org's own listing).",
        programFocusTags: ["food_security", "community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Volgistics sweep. This tenant (City of Southlake, TX's shared
  // "Volunteer Southlake" portal) also has a "P&R-Special Event
  // Assistant" role, but its age language was ambiguous ("volunteers age
  // 15 and older are required to complete a background check," which
  // doesn't state whether younger volunteers are accepted without one) —
  // not staged, consistent with this file's "don't guess ambiguous
  // eligibility" policy. TC-Teen Jury Member instead: the Volgistics
  // listing itself only gives a grade range ("middle school or high
  // school"), so the org's own official Metroport-Teen-Court page was
  // checked directly, which corroborates with a specific age range
  // (12-19) for the broader teen-court population. That same official
  // page discloses the program currently has a volunteer waitlist (no
  // open signup, email required) — staged as waitlisted, not open, to
  // reflect that honestly.
  {
    slug: "city-of-southlake-teen-court",
    name: "Metroport Teen Court (City of Southlake)",
    description: "A restorative-justice diversion program for youth offenders, jointly funded by the cities of Colleyville, Grapevine, Keller, and Southlake, Texas, where teen volunteers serve as jury members for peer cases. Staffed through the City of Southlake's shared Volgistics-hosted volunteer portal.",
    websiteUrl: "https://www.cityofsouthlake.com/106/Metroport-Teen-Court",
    city: "Southlake, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Jury Member",
        description: "Serve alongside other teens on jury panels for Teen Court cases: listen to testimony and, together with fellow jury members, impose a community-service sentence within a set range. Held weekly on Tuesday evenings at Southlake DPS Headquarters. Confirmed via the org's own Volgistics Opportunity Directory listing, quoted verbatim: 'Volunteers must be in middle school or high school.' The program's own official page additionally confirms teen-court participant ages run 12-19, and states the volunteer program currently has a waitlist rather than open signup: 'We currently have a waitlist of volunteers. Please email us for more information regarding volunteer opportunities and how to be added to the waitlist.'",
        location: "600 State Street, Southlake, TX 76092", zip: "76092", geocodeCity: "Southlake, TX",
        minimumAge: 12, applicationUrl: "https://www.cityofsouthlake.com/106/Metroport-Teen-Court", applicationDeadline: null,
        availabilityStatus: "waitlisted",
        availabilityNote: "The program currently has a volunteer waitlist rather than open signup — email Teen Court staff to be added, per the org's own page.",
        externalIdSuffix: "teen-jury-member", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Middle school or high school (per the Volgistics listing); the broader program's official page states ages 12-19.",
        programFocusTags: ["community_service", "civic_engagement"], reviewStatus: "pending",
      },
    ],
  },

  // Communico platform discovery pass (site:librarymarket.com and
  // site:libnet.info searches for explicit teen ages — same technique
  // as the Volgistics sweep, since Communico also has no central tenant
  // directory, just per-library subdomains). Montgomery County Public
  // Libraries already has an approved Teen Advisory Board record from an
  // earlier session (org matched by exact name, not re-created) — this
  // adds a second, genuinely distinct general branch-volunteering role
  // that wasn't previously captured, confirmed directly on the county's
  // own .gov page (not the Communico-hosted event pages, which are
  // useful for discovery but reference specific calendar sessions).
  {
    slug: "montgomery-county-public-libraries-md-general",
    name: "Montgomery County Public Libraries",
    description: "The public library system serving Montgomery County, Maryland, with branches across the county.",
    websiteUrl: "https://www.montgomerycountymd.gov/montgomery-county-public-libraries/about-library/support-library/volunteer-library",
    city: "Rockville, MD",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Assist with critical library operations that let staff focus on helping library users; volunteers generally do not work directly with the public. Both short-term and long-term assignments are available, matched to skills, interests, and availability. Confirmed directly via the county's own current page, quoted verbatim: 'Volunteers must be at least 13 years old.' Apply by calling the desired branch, filling out a volunteer application, and interviewing with the branch's Volunteer Coordinator.",
        location: "Montgomery County Public Libraries branches (multiple), MD", zip: "20850", geocodeCity: "Rockville, MD",
        minimumAge: 13, applicationUrl: "https://www.montgomerycountymd.gov/montgomery-county-public-libraries/about-library/support-library/volunteer-library", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "library-volunteer-general", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 13+ (per the county's own page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico platform sweep. Confirmed on the library's own current
  // policy page (rapidcitylibrary.org), not the Communico-hosted PDF.
  {
    slug: "rapid-city-public-library",
    name: "Rapid City Public Library",
    description: "The public library serving Rapid City, South Dakota.",
    websiteUrl: "https://rapidcitylibrary.org/volunteer-policy",
    city: "Rapid City, SD",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Expand and enhance library events and services alongside staff. To get started, print the Volunteer Application Form, fill it out, and drop it off at the library. Confirmed directly via the library's own current Volunteer Policy page, quoted verbatim: 'Volunteers must be at least 12 years old. Volunteers 12-17 years old must have written permission from their parent or guardian, and will not be assigned tasks prohibited by the Fair Labor Standards Act.' The same policy notes 12-14-year-olds are considered case-by-case, contingent on available adult supervision.",
        location: "610 Quincy Street, Rapid City, SD 57701", zip: "57701", geocodeCity: "Rapid City, SD",
        minimumAge: 12, applicationUrl: "https://rapidcitylibrary.org/volunteer-policy", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Age 12+ with parent/guardian permission for ages 12-17; ages 12-14 considered case-by-case with adult supervision (per the library's own policy page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Note: a Facebook comment on the library's own
  // page claimed a 16+ requirement, contradicting the library's own
  // written policy — the live, current, first-party policy page (fetched
  // directly, not a search-cache snippet) unambiguously states 12, which
  // is what's used here per the "current first-party evidence over
  // secondhand claims" standard.
  {
    slug: "hiawatha-public-library",
    name: "Hiawatha Public Library",
    description: "The public library serving Hiawatha, Iowa.",
    websiteUrl: "https://hiawathapubliclibrary.org/volunteer-9640",
    city: "Hiawatha, IA",
    contactEmail: "library@hiawatha-iowa.com",
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Supplement the efforts of paid library staff with programs or projects that complement staff duties, serving as a liaison between the library and the community. Confirmed directly via the library's own current policy page, quoted verbatim: 'Participants who provide volunteer services to the Hiawatha Public Library must be at least 12 years of age.' National and Iowa Sex Abuse Registry checks apply to all applicants. Apply by downloading the volunteer form and bringing it to the library's Front Desk, or filling it out online.",
        location: "150 W. Willman St, Hiawatha, IA 52233", zip: "52233", geocodeCity: "Hiawatha, IA",
        minimumAge: 12, applicationUrl: "https://hiawathapubliclibrary.org/volunteer-9640", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 12+ (per the library's own current policy page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Two genuinely distinct roles confirmed on the
  // library's own current volunteer page: general collection/clerical
  // volunteering (14+) and Teen Advisory Board (12-18), the latter run
  // as separate chapters at 4 branches (Eldersburg, Mount Airy,
  // Taneytown, Westminster) with their own meeting schedules —
  // consolidated into one record per this file's existing convention for
  // multi-branch chapters of the same program (see Montgomery County
  // Public Libraries' TAB record above).
  {
    slug: "carroll-county-public-library",
    name: "Carroll County Public Library",
    description: "The public library system serving Carroll County, Maryland, with branches in Eldersburg, Mount Airy, Taneytown, and Westminster among others.",
    websiteUrl: "https://library.carr.org/kids-teens/volunteer",
    city: "Westminster, MD",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Assist with collection maintenance and program development at a branch, or clerical tasks at library headquarters. Confirmed directly via the library's own current page, quoted verbatim: 'Volunteers must be at least 14 years of age by the time they begin volunteering.' Service learning hours may be available; check with your school for qualification.",
        location: "Carroll County Public Library branches (multiple), MD", zip: "21157", geocodeCity: "Westminster, MD",
        minimumAge: 14, applicationUrl: "https://library.carr.org/kids-teens/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Teen Advisory Board",
        description: "Help plan teen programming and influence the library's teen collections as a Teen Advisory Board member — run as separate chapters at the Eldersburg (3rd Thursday, 6:00-7:30pm), Mount Airy (last Tuesday, 6:30-7:30pm), Taneytown (4th Monday, 6:00pm), and Westminster (4th Monday, 3:30-5:00pm, in-person or via Zoom) branches. Confirmed directly via the library's own current page, quoted verbatim: 'Eldersburg's Teen Advisory Board is now open to anyone age 12-18' and 'The Mount Airy Teen Advisory Board is for ages 12-18.'",
        location: "Carroll County Public Library branches (multiple), MD", zip: "21157", geocodeCity: "Westminster, MD",
        minimumAge: 12, applicationUrl: "https://library.carr.org/kids-teens/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-18 (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Confirmed directly on the library's own
  // current volunteer page, not the Communico-hosted training-session
  // event pages (which only cover the seasonal Book Buddies program).
  // "Events and Programming Collaborator" and Graduate Practicum roles
  // were also listed but not staged here: the former substantially
  // overlaps Book Master's general branch-support duties (not a
  // materially different role), and the latter is for MLS/MLIS graduate
  // students, not teens.
  {
    slug: "dallas-public-library",
    name: "Dallas Public Library",
    description: "The public library system serving Dallas, Texas, with a central library and branches across the city.",
    websiteUrl: "https://www.dallaslibrary.org/about/volunteer",
    city: "Dallas, TX",
    contactEmail: "libvolunteers@dallas.gov",
    opportunities: [
      {
        title: "Book Master",
        description: "Help library staff with general branch tasks: find books to send to other libraries across the city, ensure books are shelved correctly, organize library materials and spaces, weed books from the collection, create display cases, and sort donated materials. Confirmed directly via the library's own current page, quoted verbatim: 'Dallas Public Library accepts volunteers age 14 and older.'",
        location: "1515 Young Street, Dallas, TX 75201", zip: "75201", geocodeCity: "Dallas, TX",
        minimumAge: 14, applicationUrl: "https://www.dallaslibrary.org/about/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "book-master", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Teen Advisory Council",
        description: "Connect with other teens to create dynamic social media content and virtual programs for peers throughout Dallas: DIY YouTube videos, Teen Talk Safe Spaces, TikTok videos, YA author chats, Summer Teen Kits, and a SMART Summer Teen Scavenger Hunt, while earning volunteer hours for school and college applications. Confirmed directly via the library's own current page (general library-wide minimum age applies: 'Dallas Public Library accepts volunteers age 14 and older').",
        location: "1515 Young Street, Dallas, TX 75201", zip: "75201", geocodeCity: "Dallas, TX",
        minimumAge: 14, applicationUrl: "https://www.dallaslibrary.org/about/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-council", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Summer Book Buddies",
        description: "Read and work with a child over the summer as part of the library's annual Summer Book Buddies program. Confirmed directly via the library's own Communico-hosted training listing, quoted verbatim: 'You must be at least 14 years of age.' Runs during the summer months; volunteers complete an online application and attend a required training session.",
        location: "1515 Young Street, Dallas, TX 75201", zip: "75201", geocodeCity: "Dallas, TX",
        minimumAge: 14, applicationUrl: "https://www.dallaslibrary.org/about/volunteer", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Runs during the summer months; volunteers are needed and trained ahead of the summer session, per the library's own page listing this as a 'Yearly Special Event.'",
        externalIdSuffix: "summer-book-buddies", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ (per the library's own listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Application-window status is genuinely
  // ambiguous as of this check: the library's own live page says 'OUR
  // SCHOOL YEAR APPLICATION IS CURRENTLY CLOSED. PLEASE CHECK BACK AT
  // THE END OF AUGUST' — but today's date is already past that reopening
  // marker, so it's unclear whether the page is simply stale or the
  // window genuinely hasn't reopened yet. Staged as seasonal with the
  // exact quoted caveat rather than guessing either way. The separate
  // Summer Volunteer Application (closed May 4) is a different, already-
  // closed seasonal track not staged here.
  {
    slug: "fairfield-public-library-ct",
    name: "Fairfield Public Library",
    description: "The public library system serving Fairfield, Connecticut, with a Main Library and the Fairfield Woods Branch.",
    websiteUrl: "https://fairfieldpubliclibrary.org/teens/teen-volunteers/",
    city: "Fairfield, CT",
    contactEmail: "jlaseman@fplct.org",
    opportunities: [
      {
        title: "Teen Council",
        description: "Help ensure the library is meeting the needs and wants of teens in the community: help plan and promote special events, assist at teen programs, develop passive activities for the Teen room, suggest collection items, and help develop website/social media content. Meets once a month. Confirmed directly via the library's own current page, quoted verbatim: 'This group is for teens age 12 and up.' As of this check the school-year application window is marked closed with a 'check back at the end of August' note, which has already passed — status genuinely unclear, staged as seasonal.",
        location: "1080 Old Post Rd, Fairfield, CT 06824", zip: "06824", geocodeCity: "Fairfield, CT",
        minimumAge: 12, applicationUrl: "https://fairfieldpubliclibrary.org/teens/teen-volunteers/", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The library's own page currently reads 'OUR SCHOOL YEAR APPLICATION IS CURRENTLY CLOSED. PLEASE CHECK BACK AT THE END OF AUGUST' — check the page directly, as this may have already reopened.",
        externalIdSuffix: "teen-council", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 12+ (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Content Creation (Reviews by Teens for Teens)",
        description: "Write book reviews (minimum five sentences, no spoilers, published within the past 5 years, YA section only) for the library's blog and in-house review book, 'Reviews by Teens for Teens,' earning up to 4 hours of volunteer credit per approved review. Titles must be pre-approved by the Teen Librarian before writing. Confirmed directly via the library's own current page, part of the same school-year teen volunteer program (age 12-18). As of this check the school-year application window is marked closed with a 'check back at the end of August' note, which has already passed — status genuinely unclear, staged as seasonal.",
        location: "1080 Old Post Rd, Fairfield, CT 06824", zip: "06824", geocodeCity: "Fairfield, CT",
        minimumAge: 12, applicationUrl: "https://fairfieldpubliclibrary.org/teens/teen-volunteers/", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "The library's own page currently reads 'OUR SCHOOL YEAR APPLICATION IS CURRENTLY CLOSED. PLEASE CHECK BACK AT THE END OF AUGUST' — check the page directly, as this may have already reopened.",
        externalIdSuffix: "content-creation-reviews", category: "Education", interestsTags: ["education"],
        commitmentType: "one_time", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 12-18 (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Confirmed directly on the library's own
  // current page (myclearwaterlibrary.com), a general year-round program
  // (not a one-off open house event).
  {
    slug: "clearwater-public-library-system",
    name: "Clearwater Public Library System",
    description: "The public library system serving Clearwater, Florida.",
    websiteUrl: "https://www.myclearwaterlibrary.com/Kids-and-Teens",
    city: "Clearwater, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Earn hours for school, scholarships, or just for fun as a Teen Volunteer at the Clearwater Public Library System. Requires a notarized Affidavit of Good Moral Character and a background check as part of the application process. Confirmed directly via the library's own current page, quoted verbatim: 'Our teen volunteer program is open to young people ages 15 through 17. Older candidates may apply to become adult library volunteers.'",
        location: "100 N. Osceola Ave., Clearwater, FL 33755", zip: "33755", geocodeCity: "Clearwater, FL",
        minimumAge: 15, applicationUrl: "https://www.myclearwaterlibrary.com/Kids-and-Teens", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-17 (per the library's own current page); 18+ apply as adult volunteers instead.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep, second search pass (site:libnet.info "ages
  // 13"/"ages 14"). Currently mid-application-window as of this check —
  // the org's own recent posts confirm the Fall 2026 cycle is open now
  // through Sept. 23, 2026, corroborated by a Volgistics-hosted listing
  // for the same program (this org uses both platforms).
  {
    slug: "faulkner-county-library-system",
    name: "Faulkner County Library System",
    description: "The public library system serving Faulkner County, Arkansas (Conway, Greenbrier, and other communities).",
    websiteUrl: "https://fcl.org/departments/teen-volunteer-program/",
    city: "Conway, AR",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Volunteer at the Faulkner County Library as part of its Teen Volunteer Program, completing an online application and attending a required orientation before starting. Confirmed directly via the library's own current social posts and a corroborating Volgistics-hosted listing for the same program, quoted verbatim: 'Teen Volunteer Orientation for ages 13-18' and 'Our Teen Volunteer Program has returned for Fall 2026! Apply any time between now and WED, SEPT 23 to volunteer.'",
        location: "1900 Tyler St, Conway, AR 72032", zip: "72032", geocodeCity: "Conway, AR",
        minimumAge: 13, applicationUrl: "https://fcl.org/departments/teen-volunteer-program/", applicationDeadline: "2026-09-23",
        availabilityStatus: "open",
        availabilityNote: "Fall 2026 cycle applications open now through Sept. 23, 2026, per the library's own current posts.",
        externalIdSuffix: "teen-volunteer-program", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18 (per the library's own current listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. This org actually runs its volunteer program
  // on Better Impact (app.betterimpact.com), not Communico directly —
  // discovered via a Communico-hosted "Every Teen's Book Club" event
  // that linked back to the org, then confirmed on the org's own
  // Better Impact-hosted listings. Two genuinely distinct programs
  // confirmed: general teen library volunteering and a Teen Library
  // Connections planning group (comparable to other libraries' Teen
  // Advisory Boards in this file).
  {
    slug: "pueblo-city-county-library",
    name: "Pueblo City-County Library",
    description: "The public library district serving Pueblo, Colorado.",
    websiteUrl: "https://www.pueblolibrary.org/teen-resources",
    city: "Pueblo, CO",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Library Volunteer",
        description: "Volunteer in person at a Pueblo City-County Library branch. Fill out a volunteer application; you'll be notified by email when orientation sessions become available. Confirmed directly via the library's own Better Impact-hosted volunteer listing, quoted verbatim: 'To be considered for teen volunteer opportunities potential volunteers must: be at least 13 years old, and less than 18 years old (unless you are still in high school).'",
        location: "100 E Abriendo Ave., Pueblo, CO 81004", zip: "81004", geocodeCity: "Pueblo, CO",
        minimumAge: 13, applicationUrl: "https://www.pueblolibrary.org/teen-resources", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 13+ and under 18 (or still in high school) (per the library's own listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Teen Library Connections (TLC)",
        description: "Plan and organize library programs as part of Teen Library Connections, meeting the last Tuesday of every month from 6:00-7:30pm. Confirmed directly via the library's own Better Impact-hosted listing, quoted verbatim: 'Middle and High School students ages 12 to 18 are welcome to join us.'",
        location: "100 E Abriendo Ave., Pueblo, CO 81004", zip: "81004", geocodeCity: "Pueblo, CO",
        minimumAge: 12, applicationUrl: "https://www.pueblolibrary.org/teen-resources", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-library-connections", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-18, middle and high school students (per the library's own listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. General teen policy confirmed on the library's
  // own current page; Teen Advisory Board confirmed via Communico-hosted
  // listings across multiple branches (Orange, Liberty). A separate
  // "Summer Volunteen" program (13-17) was also found but is seasonal
  // and was already open back in March 2026 — not staged here since its
  // current cycle status wasn't confirmed and the general Teen Volunteer
  // pathway already covers the same age range year-round.
  {
    slug: "delaware-county-district-library",
    name: "Delaware County District Library",
    description: "The public library district serving Delaware County, Ohio, with branches including Delaware, Liberty (Powell), Orange, and Ostrander.",
    websiteUrl: "https://www.delawarelibrary.org/teen",
    city: "Delaware, OH",
    contactEmail: "askus@delawarelibrary.org",
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Volunteer at a Delaware County District Library (DCDL) branch. Confirmed directly via the library's own current page, quoted verbatim: 'Teens ages 13-17 are eligible to volunteer at one of our DCDL branches.'",
        location: "84 E. Winter St., Delaware, OH 43015", zip: "43015", geocodeCity: "Delaware, OH",
        minimumAge: 13, applicationUrl: "https://www.delawarelibrary.org/teen", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Teen Advisory Board",
        description: "Discuss and influence teen services at DCDL as a Teen Advisory Board member; each meeting counts as one hour of volunteering, and no previous experience is required. Runs at multiple branches (Orange, Liberty, and others) with their own meeting schedules. Confirmed directly via the library's own Communico-hosted listings, quoted verbatim: 'TAB is open to teens ages 12-17' and 'Ages 13-18. open to teens aged 13-18 from all Delaware County District Library branches.'",
        location: "Delaware County District Library branches (multiple), OH", zip: "43015", geocodeCity: "Delaware, OH",
        minimumAge: 12, applicationUrl: "https://www.delawarelibrary.org/teen", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-18 depending on branch (per the library's own listings).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Note: the district's Main Library (600 E.
  // Mariposa St.) is temporarily closed for renovation/rebuilding
  // (Yelp lists a scheduled 2027 reopening, consistent with fire-related
  // rebuilding timelines in this area) — this record uses the Bob Lucas
  // Memorial Library & Literacy Center address instead, since that
  // branch is confirmed currently operating and the district's own
  // current page still actively invites teen volunteer applications.
  {
    slug: "altadena-library-district",
    name: "Altadena Library District",
    description: "The public library district serving Altadena, California. The Main Library is temporarily closed for renovation; the Bob Lucas Memorial Library & Literacy Center branch remains open.",
    websiteUrl: "https://www.altadenalibrary.org/teens",
    city: "Altadena, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Volunteer at the Altadena Library District. Confirmed directly via the district's own current page, quoted verbatim: 'We invite all teens 13-18 in the Altadena area to become part of our teen volunteer program.' All new volunteers must complete the online Teen Volunteer Application.",
        location: "2659 Lincoln Avenue, Altadena, CA 91001", zip: "91001", geocodeCity: "Altadena, CA",
        minimumAge: 13, applicationUrl: "https://www.altadenalibrary.org/teens", applicationDeadline: null,
        availabilityStatus: "open",
        availabilityNote: "The district's Main Library is temporarily closed for renovation (reopening expected 2027); the Bob Lucas Memorial branch remains open and the teen volunteer program remains active per the district's own current page.",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18 (per the district's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Confirmed directly on the org's own current
  // page (lacountylibrary.org), a large 80+ branch system serving
  // unincorporated LA County (distinct from the separate City of Los
  // Angeles Public Library system).
  {
    slug: "la-county-library",
    name: "LA County Library",
    description: "The public library system serving unincorporated Los Angeles County and dozens of cities across the county, with over 80 branches.",
    websiteUrl: "https://lacountylibrary.org/volunteer/",
    city: "Downey, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Support library services for youth and adults at an LA County Library branch, gaining skills, knowledge, and (for students) school service credit and job experience. Confirmed directly via the library's own current page, quoted verbatim: 'Anyone 14 and older who has an interest in libraries and books, a concern for their community, and/or a passion for helping others can be a volunteer!'",
        location: "7400 E. Imperial Hwy, Downey, CA 90242", zip: "90242", geocodeCity: "Downey, CA",
        minimumAge: 14, applicationUrl: "https://lacountylibrary.org/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ (per the library's own current page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Communico sweep. Confirmed directly on the library's own
  // current "Future Ready Teens" page — a separate system from LA
  // County Library above, serving the City of Los Angeles specifically
  // (73 locations, 2,600+ teen volunteers/year per the org's own page).
  // 3 genuinely distinct programs staged with their own duty lists and
  // age floors, matching the org's own framing exactly.
  {
    slug: "los-angeles-public-library",
    name: "Los Angeles Public Library",
    description: "The public library system serving the City of Los Angeles, with 73 locations and a large 'Future Ready Teens' volunteer program.",
    websiteUrl: "https://www.lapl.org/teens/get-involved",
    city: "Los Angeles, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Help librarians organize and arrange the teen area, create library displays, work on special projects, be a Homework Helper, assist Friends of the Library at book sales, and (seasonally, at select branches) help with Summer Reading signups or serving Summer Lunch. Confirmed directly via the library's own current page, quoted verbatim: 'Ages 14-19. Teen Volunteers make a difference at their library in a variety of ways and earn community service hours at the same time.' Requires a Teen Volunteer Intake Form and a parent/guardian-signed waiver.",
        location: "630 W. 5th Street, Los Angeles, CA 90071", zip: "90071", geocodeCity: "Los Angeles, CA",
        minimumAge: 14, applicationUrl: "https://www.lapl.org/teens/get-involved", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        parentalConsentRequired: true,
        eligibleGrades: "Ages 14-19 (per the library's own current page); opportunities vary by branch.",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
      {
        title: "Teen Council",
        description: "Work with a Young Adult Librarian and peers to suggest library purchases, plan library programs, implement a Teens Leading Change civic action project, and write for the Teen Blog, earning a minimum of 20 community service hours. Confirmed directly via the library's own current page, quoted verbatim: 'Ages 11-19. By joining your library's Teen Council, you will gain valuable 21st-century skills such as leadership, critical thinking, collaboration and civic engagement.' Requires a Teen Volunteer Intake Form and a parent/guardian-signed waiver.",
        location: "630 W. 5th Street, Los Angeles, CA 90071", zip: "90071", geocodeCity: "Los Angeles, CA",
        minimumAge: 11, applicationUrl: "https://www.lapl.org/teens/get-involved", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "teen-council", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 11-19 (per the library's own current page); minimum 20 service hours required.",
        programFocusTags: ["community_service", "civic_engagement"], reviewStatus: "pending",
      },
      {
        title: "Teens Leading Change",
        description: "Develop and participate in a civic action project to implement positive change in your community, gaining leadership skills and knowledge about local government and democracy in action. New projects form each September, but teens can join anytime. Confirmed directly via the library's own current page, quoted verbatim: 'Ages 14-19. When you join your local library's Teen Council, you'll have the opportunity to develop and participate in a civic action project.' Requires a Teen Volunteer Intake Form and a parent/guardian-signed waiver.",
        location: "630 W. 5th Street, Los Angeles, CA 90071", zip: "90071", geocodeCity: "Los Angeles, CA",
        minimumAge: 14, applicationUrl: "https://www.lapl.org/teens/get-involved", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "teens-leading-change", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-19 (per the library's own current page); new projects form each September.",
        programFocusTags: ["community_service", "civic_engagement"], reviewStatus: "pending",
      },
    ],
  },

  // Arizona library gap-check (this session's Arizona priority),
  // following up bonus leads surfaced during the Communico sweep.
  // Peoria's own press releases (2023 and 2024, both April) consistently
  // frame this as a summer-only program with limited slots, not a
  // year-round pathway — staged seasonal rather than open. A third-party
  // "AZ Student Opportunity Hub" listing cites ages 14-18, but the city's
  // own repeated official releases say 13-17, which is used here.
  {
    slug: "peoria-public-library-az",
    name: "Peoria Public Library",
    description: "The public library system serving Peoria, Arizona, with a summer Book Buddies teen volunteer program pairing teens with young readers.",
    websiteUrl: "https://www.peoriaaz.gov/parks-and-recreation/libraries",
    city: "Peoria, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Summer Teen Volunteer (Book Buddies)",
        description: "Help build reading confidence in children (grades K-5) as a teen volunteer in the library's Book Buddies program, or assist with other library programs, summer reading initiatives, and book shelving. Confirmed directly via the city's own repeated official press releases (April 2023 and April 2024), quoted verbatim: 'The Peoria Main Public Library is accepting a limited number of teen volunteers between the ages of 13-17 this summer.'",
        location: "8463 W. Monroe St., Peoria, AZ 85345", zip: "85345", geocodeCity: "Peoria, AZ",
        minimumAge: 13, applicationUrl: "https://www.peoriaaz.gov/parks-and-recreation/libraries", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Runs during the summer with a limited number of slots; the city's official announcement is typically published each spring. Not currently in its active window.",
        externalIdSuffix: "summer-teen-volunteer-book-buddies", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the city's own repeated official press releases).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Arizona library gap-check. City of Surprise's already-approved
  // "Teen Volunteer Program" record explicitly includes Library Programs
  // as one of its placement categories, so a separate generic "Library
  // Volunteer" record here would be redundant — only this genuinely
  // distinct activity is added: a structured Teen Advisory Board run
  // through the library's own separate registration platform
  // (mylibrary.digital), not the city's general volunteer application.
  {
    slug: "surprise-public-library",
    name: "Surprise Public Library",
    description: "The public library system serving Surprise, Arizona, running a Teen Advisory Board (The Bookworms) separately from the city's general Teen Volunteer Program.",
    websiteUrl: "https://www.surprisepubliclibrary.gov/volunteer",
    city: "Surprise, AZ",
    contactEmail: "library@surpriseaz.gov",
    opportunities: [
      {
        title: "The Bookworms (Teen Advisory Board)",
        description: "Help plan library programs and provide input as a member of The Bookworms, the Surprise Regional Library's Teen Advisory Board; attending sessions earns volunteer hours. Confirmed directly via the library's own current event listing, quoted verbatim: 'Surprise Regional Library 13-18 Ages... attending you get volunteer hours.' No advance booking required.",
        location: "16089 N. Bullard Ave., Surprise, AZ 85374", zip: "85374", geocodeCity: "Surprise, AZ",
        minimumAge: 13, applicationUrl: "https://www.surprisepubliclibrary.gov/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "the-bookworms-teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18 (per the library's own current listing).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Same Arizona library gap-check. This is a shared district-wide
  // program run per-branch (18+ branches across Maricopa County) —
  // confirmed on the Perry branch's own page, but that specific branch
  // is not currently accepting new applications ('This location is not
  // accepting teen volunteer applications at this time'), and a second
  // branch's guessed URL 404'd. Staged as seasonal rather than open to
  // reflect this honestly, since branch-level acceptance clearly varies
  // and wasn't confirmed open anywhere at this check.
  {
    slug: "maricopa-county-library-district",
    name: "Maricopa County Library District",
    description: "The library district serving unincorporated Maricopa County and several municipalities across the Phoenix metro area, with 18+ branches including Perry (Gilbert), Guadalupe, Ed Robson, Southeast Regional, and Queen Creek.",
    websiteUrl: "https://mcldaz.org/en-US/perry/volunteer/teen",
    city: "Gilbert, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Shelve materials, assist with programs, and help with other library tasks at a Maricopa County Library District branch. Confirmed directly via the district's own current Perry branch page, quoted verbatim: 'Teen (ages 13-18) Volunteer Form. We are looking for people who can shelve materials, assist with programs, and do other library tasks.' Acceptance varies by branch and rotates based on need; the Perry branch itself is not currently accepting new applications, per its own page.",
        location: "1965 E Queen Creek Rd, Gilbert, AZ 85297", zip: "85297", geocodeCity: "Gilbert, AZ",
        minimumAge: 13, applicationUrl: "https://mcldaz.org/en-US/perry/volunteer/teen", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Teen volunteer acceptance rotates by branch and by need; check your nearest MCLD branch's own volunteer page for current status (the Perry branch is not currently accepting as of this check).",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18 (per the district's own Perry branch page).",
        programFocusTags: ["community_service"], reviewStatus: "pending",
      },
    ],
  },

  // Volgistics platform sweep, continued (site:volgistics.com/od "Age
  // 16"/"Age 17" museum/zoo/aquarium search). Cheekwood's own current
  // page lists 5 distinct volunteer tracks; only the 2 genuinely
  // independently-actionable teen ones are staged. The Family Team
  // Volunteer Program (ages 10-17) always requires pairing with an adult
  // guardian — no age within it is independently actionable — so it was
  // not staged, consistent with this file's "group/paired-only
  // mechanism" exclusion policy. Adult Volunteer Program (18+) and Group
  // Volunteering (organizational groups) are also not teen-additive.
  {
    slug: "cheekwood-estate-and-gardens",
    name: "Cheekwood Estate and Gardens",
    description: "A botanical garden, art museum, and historic estate in Nashville, Tennessee.",
    websiteUrl: "https://cheekwood.org/support/volunteer/",
    city: "Nashville, TN",
    contactEmail: "volunteers@cheekwood.org",
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Ongoing volunteer opportunities in gardening, art projects, visitor greeting, and special events. Confirmed directly via the organization's own current page, quoted verbatim: 'For teens age 16 or older.' A volunteer application and orientation training are required.",
        location: "1200 Forrest Park Dr, Nashville, TN 37205", zip: "37205", geocodeCity: "Nashville, TN",
        minimumAge: 16, applicationUrl: "https://cheekwood.org/support/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program", category: "Arts & Culture", interestsTags: ["arts_culture"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the organization's own current page).",
        programFocusTags: ["community_service"],
      },
      {
        title: "Harvest Weekends Volunteer",
        description: "Volunteer as a greeter/way-finder or in the Pumpkin Village during Cheekwood's fall Harvest Weekends season. Confirmed directly via the organization's own current page, quoted verbatim: 'For ages 16 and older.' Advance registration via an online volunteer agreement/waiver is required.",
        location: "1200 Forrest Park Dr, Nashville, TN 37205", zip: "37205", geocodeCity: "Nashville, TN",
        minimumAge: 16, applicationUrl: "https://cheekwood.org/support/volunteer/", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Runs during Cheekwood's fall Harvest Weekends season, per the organization's own current page.",
        externalIdSuffix: "harvest-weekends-volunteer", category: "Arts & Culture", interestsTags: ["arts_culture"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the organization's own current page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Volgistics sweep. Note: a name-collision hazard was caught here
  // — "Heartland Humane Society" also refers to at least two unrelated
  // organizations (one in South Dakota at heartlandhumanesociety.net,
  // one in Missouri), each with their own similar-but-distinct age
  // policies. Confirmed this specific org is the Corvallis, OR one
  // (matching the Volgistics tenant, cross-referenced via a "Corvallis
  // Emerging Pros" event on the tenant's own sitemap and "Corvallis
  // KeyBank" mentioned on the org's own current page) before using its
  // age evidence — not the similarly-named South Dakota org's page.
  {
    slug: "heartland-humane-society-corvallis",
    name: "Heartland Humane Society (Corvallis, OR)",
    description: "An animal shelter serving Corvallis, Oregon (Benton County), running shelter care, thrift shop, and Whiskers Cat Lounge volunteer programs.",
    websiteUrl: "https://www.heartlandhumane.org/get-involved",
    city: "Corvallis, OR",
    contactEmail: null,
    opportunities: [
      {
        title: "Youth Volunteer",
        description: "Help care for shelter animals: kennel care, dog walking, cat socialization, grooming, and event support. Confirmed directly via the organization's own current page, quoted verbatim: 'Volunteers of any age are welcome! Youth 16yrs and up may volunteer without a guardian.' Youth volunteers and a guardian must both complete the application, orientation, and training process.",
        location: "398 SW Twin Oak Circle, Corvallis, OR 97333", zip: "97333", geocodeCity: "Corvallis, OR",
        minimumAge: 16, applicationUrl: "https://www.heartlandhumane.org/get-involved", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "youth-volunteer", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ may volunteer without a guardian (per the organization's own current page).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Same Volgistics sweep. Southern Nevada's largest hunger-relief
  // organization, distinct from the already-covered HELP of Southern
  // Nevada (a different Las Vegas nonprofit, different programs).
  {
    slug: "three-square-food-bank",
    name: "Three Square Food Bank",
    description: "Southern Nevada's largest hunger-relief organization, serving Clark, Lincoln, Nye, and Esmeralda counties.",
    websiteUrl: "https://www.threesquare.org/how-to-help/volunteer/",
    city: "Las Vegas, NV",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer at Three Square",
        description: "Assemble meals for children or pack produce for seniors and families at Three Square's main campus. Confirmed directly via the organization's own current page, quoted verbatim: 'The minimum age to volunteer is 10 years old,' with other independently corroborating sources confirming 'Ages 10-15 must have a guardian.'",
        location: "4190 N. Pecos Rd, Las Vegas, NV 89115", zip: "89115", geocodeCity: "Las Vegas, NV",
        minimumAge: 10, applicationUrl: "https://www.threesquare.org/how-to-help/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "volunteer-at-three-square", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 10+; ages 10-15 must be accompanied by a guardian (per the organization's own page and corroborating sources).",
        programFocusTags: ["food_security"],
      },
    ],
  },

  // Same Volgistics sweep.
  {
    slug: "hope-helps-inc",
    name: "HOPE Helps, Inc.",
    description: "A Central Florida nonprofit (Seminole County) working to prevent and reduce hunger and homelessness through Housing, Outreach, Prevention, and Education.",
    websiteUrl: "https://www.hopehelps.org",
    city: "Oviedo, FL",
    contactEmail: "resources@hopehelps.org",
    opportunities: [
      {
        title: "Teen Bright Futures Food Drive",
        description: "Organize and implement a food drive to support HOPE's food pantry: carry and sort donated items, maintain the sorting area, and manage the collection shift. Confirmed directly via the organization's own Volgistics Opportunity Directory listing, quoted verbatim: 'Teens/Bright Future Students that are 15 years old and over can volunteer on their own. If children between the ages of 10-and 14 would like to volunteer, they can do so accompanied by an adult.'",
        location: "812 Eyrie Drive, Oviedo, FL 32765", zip: "32765", geocodeCity: "Oviedo, FL",
        minimumAge: 10, applicationUrl: "https://www.hopehelps.org", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "teen-bright-futures-food-drive", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 15+ to volunteer independently; ages 10-14 must be accompanied by an adult (per the organization's own listing).",
        programFocusTags: ["food_security"],
      },
    ],
  },

  // Second Communico wave (site:libnet.info "ages 14"/"ages 15" search).
  // Note: distinct from "Salt Lake City Public Library" (a separate
  // city-run system, slcpl.org, with its own "Teen Squad" program) —
  // not staged this pass since its own age evidence wasn't independently
  // confirmed on its own domain.
  {
    slug: "salt-lake-county-library",
    name: "Salt Lake County Library",
    description: "The public library system serving Salt Lake County, Utah (distinct from the separate Salt Lake City Public Library system).",
    websiteUrl: "https://www.slcolibrary.org/information/volunteer-opportunities",
    city: "Salt Lake City, UT",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Summer Volunteer",
        description: "Help with the library's Summer Reading Program during June and July. Attendance at one of several offered training/orientation sessions is required. Confirmed directly via the library's own current Communico-hosted event listing, quoted verbatim: 'Teens ages 14-17 can volunteer this summer at the library!'",
        location: "2197 E Fort Union Blvd, Salt Lake City, UT 84121", zip: "84121", geocodeCity: "Salt Lake City, UT",
        minimumAge: 14, applicationUrl: "https://www.slcolibrary.org/information/volunteer-opportunities", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Runs during the summer (June-July) with trainings held ahead of the season, per the library's own current listing.",
        externalIdSuffix: "teen-summer-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-17 (per the library's own current listing).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave. Two genuinely distinct programs: the general
  // library volunteer track (16+, per the org's own main volunteer page)
  // and a separate Teen Library Advisory Committee (13-18, per multiple
  // consistent event listings on the same domain).
  {
    slug: "miami-dade-public-library-system",
    name: "Miami-Dade Public Library System",
    description: "The public library system serving Miami-Dade County, Florida.",
    websiteUrl: "https://mdpls.org/miami-dade-public-library-system/volunteer",
    city: "Miami, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Volunteer at a Miami-Dade Public Library System branch. Confirmed directly via the library's own current page, quoted verbatim: 'Volunteers must be 16 years of age or older. A parent or guardian's signature is required on the Volunteer Application/Agreement for volunteers between 16-17 years of age.'",
        location: "101 W. Flagler St, Miami, FL 33130", zip: "33130", geocodeCity: "Miami, FL",
        minimumAge: 16, applicationUrl: "https://mdpls.org/miami-dade-public-library-system/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+, with a parent/guardian signature required for ages 16-17 (per the library's own current page).",
        programFocusTags: ["community_service"],
      },
      {
        title: "Teen Library Advisory Committee",
        description: "Earn volunteer hours while helping make the library a better place for teens, providing input on teen programming and services. Confirmed directly via the library's own current event listings, quoted verbatim: 'Ages 13 - 19 yrs' and 'Ages 13 - 18 yrs,' consistently cited across multiple branch listings on the same domain.",
        location: "101 W. Flagler St, Miami, FL 33130", zip: "33130", geocodeCity: "Miami, FL",
        minimumAge: 13, applicationUrl: "https://mdpls.org/miami-dade-public-library-system/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-library-advisory-committee", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18/19 depending on branch (per the library's own current event listings).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave.
  {
    slug: "new-orleans-public-library",
    name: "New Orleans Public Library",
    description: "The public library system serving New Orleans, Louisiana, with teen volunteer opportunities at Algiers Regional, Milton H. Latter, and Mid-City branches.",
    websiteUrl: "https://nolalibrary.org/youth",
    city: "New Orleans, LA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Volunteer at the Algiers Regional, Milton H. Latter, or Mid-City library branches, developing teen programs and services. Confirmed directly via the library's own current page ('opportunities for teens in grades 8-12') and corroborating Communico-hosted event listings, quoted verbatim: 'Teen Volunteer Day is open to teens ages 14-18.'",
        location: "219 Loyola Ave, New Orleans, LA 70112", zip: "70112", geocodeCity: "New Orleans, LA",
        minimumAge: 14, applicationUrl: "https://nolalibrary.org/youth", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Grades 8-12 / ages 14-18 (per the library's own current page and event listings).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave. Confirmed directly on the library's own .gov
  // FAQ and Employment/Volunteering pages.
  {
    slug: "provo-city-library",
    name: "Provo City Library",
    description: "The public library serving Provo, Utah.",
    websiteUrl: "https://www.provolibrary.gov/employmentandvolunteering",
    city: "Provo, UT",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Volunteer at the Provo City Library. Confirmed directly via the library's own current FAQ, quoted verbatim: 'You can be a volunteer if you are at least 14 years old (volunteers 14-18 years old require a parent/guardian consent form filled out), complete a volunteer application.'",
        location: "550 N University Ave, Provo, UT 84601", zip: "84601", geocodeCity: "Provo, UT",
        minimumAge: 14, applicationUrl: "https://www.provolibrary.gov/employmentandvolunteering", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+, with a parent/guardian consent form required for ages 14-17 (per the library's own current FAQ).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave. RESOLVED this continuation: the original
  // applicationUrl was simply missing a "/get_involved/" path segment
  // (not a real site restructuring) — the corrected URL below is live
  // and links directly to the city's own Samaritan volunteer portal
  // (volunteer.samaritan.com, recruiterID 507 — see
  // samaritan_city_of_aurora_co in samaritan.ts). That portal's own
  // structured data independently corroborates the age-13 floor: 9 of
  // its "Library-" prefixed listings require age 13 and one requires 14
  // (Chess Club), confirming this general record's claim from a second,
  // independent first-party source.
  {
    slug: "aurora-public-library-co",
    name: "Aurora Public Library",
    description: "The public library system serving Aurora, Colorado, with seven branches, a bookmobile, and a Teen Advisory Board/Group.",
    websiteUrl: "https://www.auroragov.org/things_to_do/aurora_public_library/get_involved/volunteer_with_a_p_l",
    city: "Aurora, CO",
    contactEmail: "library@auroragov.org",
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Volunteer at an Aurora Public Library branch. Confirmed directly via the City of Aurora's own current page, quoted verbatim: 'Volunteers must be ages 13 or older. Volunteers under the age of 18 require parental/guardian consent.' Independently corroborated via the city's own Samaritan volunteer portal, where 9 of 10 library-specific Teen Advisory Group/volunteer listings require minimum age 13 (one, Chess Club, requires 14).",
        location: "14949 E Alameda Pkwy, Aurora, CO 80012", zip: "80012", geocodeCity: "Aurora, CO",
        minimumAge: 13, applicationUrl: "https://www.auroragov.org/things_to_do/aurora_public_library/get_involved/volunteer_with_a_p_l", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 13+, with parental/guardian consent required under age 18 (per the city's own current page, independently corroborated by the city's Samaritan volunteer portal).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave. Note: a name-collision hazard was caught here
  // too — "Portage District Library" (Michigan, portagelibrary.info) and
  // "Portage County Public Library" (a different domain, pocolibrary.org)
  // are unrelated organizations with similarly-worded pages. This record
  // is specifically Ohio's Portage County District Library
  // (portagelibrary.org), confirmed via multiple current 2026-dated
  // event listings at its Aurora Memorial branch.
  {
    slug: "portage-county-district-library-oh",
    name: "Portage County District Library",
    description: "The public library district serving Portage County, Ohio, with branches including Aurora Memorial, Brimfield, and others.",
    websiteUrl: "https://www.portagelibrary.org",
    city: "Aurora, OH",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Advisory Board",
        description: "Help create the teen programs you want to attend as a Teen Advisory Board member at the Aurora Memorial branch, earning volunteer hours. Confirmed directly via the library's own current event listings, quoted verbatim: 'Ages 13-18' and 'AURORA MEMORIAL LIBRARY - TEEN ADVISORY BOARD - VOLUNTEERS (AGES 13-18).' Registration required.",
        location: "115 East Pioneer Trail, Aurora, OH 44202", zip: "44202", geocodeCity: "Aurora, OH",
        minimumAge: 13, applicationUrl: "https://www.portagelibrary.org", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-18 (per the library's own current event listings).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave. Staged the School Year VolunTEEN track
  // specifically (currently in its active window, since today falls
  // within September-March) rather than the separate Summer Read
  // VolunTEEN track, which is seasonal and not currently active.
  {
    slug: "toledo-lucas-county-public-library",
    name: "Toledo Lucas County Public Library",
    description: "The public library system serving Toledo and Lucas County, Ohio.",
    websiteUrl: "https://www.toledolibrary.org/volunteer",
    city: "Toledo, OH",
    contactEmail: null,
    opportunities: [
      {
        title: "School Year VolunTEEN",
        description: "Volunteer during the school year, working with staff, children, and families at a Toledo Lucas County Public Library branch. Confirmed directly via the library's own current page, quoted verbatim: 'The School Year VolunTEEN program runs September through March, and is for teens ages 13 (must be 13) through high school graduation.'",
        location: "325 Michigan St, Toledo, OH 43604", zip: "43604", geocodeCity: "Toledo, OH",
        minimumAge: 13, applicationUrl: "https://www.toledolibrary.org/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "school-year-volunteen", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 13+ through high school graduation (per the library's own current page); runs September through March.",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Arizona-priority follow-up, surfaced via the Communico wave (site:
  // libnet.info arizona search). Two genuinely distinct programs
  // confirmed across multiple branches and independent sources
  // (Communico events, a VolunteerPinal.org listing, and local news
  // coverage): a general teen shelving/program-support role, and a
  // Teen Advisory Board active at San Tan Valley, Coolidge, and Vista
  // Grande (Casa Grande) branches.
  {
    slug: "pinal-county-library-district",
    name: "Pinal County Library District",
    description: "The public library district serving Pinal County, Arizona, with branches including San Tan Valley, Coolidge, and Vista Grande (Casa Grande).",
    websiteUrl: "https://www.volunteerpinal.org",
    city: "San Tan Valley, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Help with library program preparation, shelving, and other tasks at a Pinal County Library District branch, committing to at least 2 hours per week. Confirmed directly via a VolunteerPinal.org listing for the Coolidge Library, quoted verbatim: 'Participants must be between the ages of 13-17,' corroborated by a San Tan Valley Library Facebook post: 'the library works with Teen Volunteers (ages 13-17) to help with the program preparations and the program events.'",
        location: "31505 N. Schnepf Road, San Tan Valley, AZ 85140", zip: "85140", geocodeCity: "San Tan Valley, AZ",
        minimumAge: 13, applicationUrl: "https://www.volunteerpinal.org", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the org's own VolunteerPinal.org listing and corroborating branch social media).",
        programFocusTags: ["community_service"],
      },
      {
        title: "Teen Advisory Board",
        description: "Help plan and participate in teen activities and programming as a Teen Advisory Board member, active at multiple branches (San Tan Valley, Vista Grande in Casa Grande). Confirmed directly via the library's own current event listings, quoted verbatim: 'This event is exclusively for people aged between 13 and 18' (San Tan Valley) and 'Teens ages 12 to 17 are invited to join the Vista Grande Library Teen Advisory Board' (per a City of Casa Grande press release).",
        location: "31505 N. Schnepf Road, San Tan Valley, AZ 85140", zip: "85140", geocodeCity: "San Tan Valley, AZ",
        minimumAge: 12, applicationUrl: "https://www.volunteerpinal.org", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-18 depending on branch (per the library's own event listings and a City of Casa Grande press release).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Volgistics sweep, additional angle (aquarium/garden/conservatory
  // phrase search). The org's own current page and volunteer handbook
  // PDF both confirm a tiered age policy.
  {
    slug: "the-open-door-pantry",
    name: "The Open Door Pantry",
    description: "A hunger-relief food shelf serving Dakota County, Minnesota (based in Eagan), serving roughly 20,000 residents a month.",
    websiteUrl: "https://theopendoorpantry.org/individual-volunteering",
    city: "Eagan, MN",
    contactEmail: null,
    opportunities: [
      {
        title: "Warehouse Assistant",
        description: "Help process and organize food donations in the warehouse to support Dakota County hunger-relief efforts. Confirmed directly via the organization's own Volgistics Opportunity Directory listing, quoted verbatim: 'Age 16+ can volunteer independently.' Confirmed by the org's own current page and Volunteer Handbook: 'Teens who are 14 or 15 are welcome to volunteer with a parent or adult' (15+ may volunteer in all positions except Client Attendant and Driver).",
        location: "3000 Ames Crossing Road, Suite 100, Eagan, MN 55121", zip: "55121", geocodeCity: "Eagan, MN",
        minimumAge: 14, applicationUrl: "https://theopendoorpantry.org/individual-volunteering", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "warehouse-assistant", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ to volunteer independently; ages 14-15 must be accompanied by a parent or adult (per the organization's own page and volunteer handbook).",
        programFocusTags: ["food_security"],
      },
    ],
  },

  // Communico platform, second-wave age-phrase search
  // (site:libnet.info "must be 13"/"must be 14"). Two genuinely distinct
  // libraries, neither previously staged.
  {
    slug: "hartford-public-library-ct",
    name: "Hartford Public Library",
    description: "The public library system serving Hartford, Connecticut.",
    websiteUrl: "https://hplct.libguides.com/teenandyoungadultservicesdepartment/volunteeropportunities",
    city: "Hartford, CT",
    contactEmail: "melder@hplct.org",
    opportunities: [
      {
        title: "Teen/Young Adult Volunteer",
        description: "Volunteer at Hartford Public Library, earning community service hours. Confirmed directly via the library's own current LibGuide, quoted verbatim: 'you need to be either a resident of the Greater Hartford OR a student at a Hartford school, ages 13-24.' Interested volunteers email the Teen/YA Services coordinator to begin.",
        location: "500 Main St, Hartford, CT 06103", zip: "06103", geocodeCity: "Hartford, CT",
        minimumAge: 13, applicationUrl: "https://hplct.libguides.com/teenandyoungadultservicesdepartment/volunteeropportunities", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-young-adult-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-24, residency in Greater Hartford or enrollment at a Hartford school required (per the library's own current LibGuide).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same Communico wave.
  {
    slug: "braswell-memorial-library-nc",
    name: "Braswell Memorial Library",
    description: "The public library serving Rocky Mount, North Carolina.",
    websiteUrl: "https://braswell-library.libguides.com/home/vols",
    city: "Rocky Mount, NC",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer, Children's Room",
        description: "Volunteer in the Children's Room at Braswell Memorial Library. Confirmed directly via the library's own current LibGuide, quoted verbatim: 'Teens 13 to 17 years of age are invited to volunteer in the Children's Room.' A Volunteer Application, Volunteer Agreement, and Volunteer Policy are posted on the same page.",
        location: "727 N. Grace St., Rocky Mount, NC 27804", zip: "27804", geocodeCity: "Rocky Mount, NC",
        minimumAge: 13, applicationUrl: "https://braswell-library.libguides.com/home/vols", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-childrens-room", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 13-17 (per the library's own current LibGuide).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Communico wave, Teen Advisory Board search.
  {
    slug: "jacksonville-public-library-fl",
    name: "Jacksonville Public Library",
    description: "The public library system serving Jacksonville, Florida (Duval County).",
    websiteUrl: "https://jaxpubliclibrary.org/teens",
    city: "Jacksonville, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Advisory Board (TAB)",
        description: "Vote for, plan, and help make things happen at the library as a Teen Advisory Board member, earning Bright Futures Scholarship service hours. Confirmed directly via the library's own current event listing and Teens page, quoted verbatim: 'For ages 12 - 17.'",
        location: "303 N Laura St, Jacksonville, FL 32202", zip: "32202", geocodeCity: "Jacksonville, FL",
        minimumAge: 12, applicationUrl: "https://jaxpubliclibrary.org/teens", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-17 (per the library's own current event listing and Teens page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Humane-society sweep (Better Impact / general search for "must be
  // 14" and "ages 14-17" phrasing). Five orgs, none previously staged.
  {
    slug: "austin-humane-society",
    name: "Austin Humane Society",
    description: "An animal shelter serving Austin and Travis County, Texas.",
    websiteUrl: "https://austinhumanesociety.org/volunteer/faqs/",
    city: "Austin, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Volunteer",
        description: "Volunteer in shelter care, cat/dog socialization, and other roles. Confirmed directly via the organization's own current FAQ, quoted verbatim: minimum age 14; '14 and 15-year old volunteers must have a parent or guardian over the age of 21 train and volunteer with them at all times'; '16 and 17-year old volunteers only need parental consent, which is given during the online application process.'",
        location: "124 W. Anderson Ln, Austin, TX 78752", zip: "78752", geocodeCity: "Austin, TX",
        minimumAge: 14, applicationUrl: "https://austinhumanesociety.org/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "volunteer", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+; ages 14-15 require a parent/guardian (21+) to train and volunteer alongside them; ages 16-17 need parental consent only (per the organization's own current FAQ).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Same humane-society sweep.
  {
    slug: "tri-county-humane-society-mn",
    name: "Tri-County Humane Society",
    description: "An animal shelter serving the St. Cloud, Minnesota area (Stearns, Benton, and Sherburne counties).",
    websiteUrl: "https://tricountyhumanesociety.org/volunteer/",
    city: "St. Cloud, MN",
    contactEmail: "volunteer@tricountyhumanesociety.org",
    opportunities: [
      {
        title: "Volunteer",
        description: "Volunteer in shelter animal care and other roles. Confirmed directly via the organization's own current page, quoted verbatim: 'Volunteers must be 14 years of age or older to volunteer alone, or as young as 10 years of age to volunteer alongside an adult.'",
        location: "735 8th St NE, St. Cloud, MN 56304", zip: "56304", geocodeCity: "St. Cloud, MN",
        minimumAge: 10, applicationUrl: "https://tricountyhumanesociety.org/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "volunteer", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ to volunteer alone; as young as 10 alongside an adult (per the organization's own current page).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Same humane-society sweep.
  {
    slug: "humane-society-of-charlotte",
    name: "Humane Society of Charlotte",
    description: "An animal shelter serving Charlotte, North Carolina.",
    websiteUrl: "https://humanesocietyofcharlotte.org/volunteer-faqs/",
    city: "Charlotte, NC",
    contactEmail: null,
    opportunities: [
      {
        title: "On-Site Volunteer",
        description: "Volunteer on-site after completing an information session and orientation. Confirmed directly via the organization's own current FAQ, quoted verbatim: 'On-site volunteers must be at least 16-years-old.' Requires a $25 fee (t-shirt/badge) and a minimum 6 hours/month, 6-month commitment.",
        location: "1348 Parker Dr, Charlotte, NC 28208", zip: "28208", geocodeCity: "Charlotte, NC",
        minimumAge: 16, applicationUrl: "https://humanesocietyofcharlotte.org/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "on-site-volunteer", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the organization's own current FAQ).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Same humane-society sweep.
  {
    slug: "humane-society-of-broward-county",
    name: "Humane Society of Broward County",
    description: "An animal shelter serving Broward County, Florida.",
    websiteUrl: "https://humanebroward.com/programs/teen-animal-care-volunteer-program/",
    city: "Fort Lauderdale, FL",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Animal Care Volunteer Program",
        description: "Care for shelter animals as a teen volunteer. Confirmed directly via the organization's own current program page, quoted verbatim: 'Teens ages 16-18 who are currently enrolled in high school.' Requires a $40 non-refundable fee (uniform, badge, lanyard, background check).",
        location: "2070 Griffin Rd, Fort Lauderdale, FL 33312", zip: "33312", geocodeCity: "Fort Lauderdale, FL",
        minimumAge: 16, applicationUrl: "https://humanebroward.com/programs/teen-animal-care-volunteer-program/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-animal-care-volunteer-program", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 16-18, must be currently enrolled in high school (per the organization's own current program page).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Same humane-society sweep.
  {
    slug: "dane-county-humane-society",
    name: "Dane County Humane Society",
    description: "An animal shelter serving Dane County, Wisconsin (based in Madison).",
    websiteUrl: "https://www.giveshelter.org/how-to-help/volunteer/youth-volunteer",
    city: "Madison, WI",
    contactEmail: null,
    opportunities: [
      {
        title: "Youth Volunteer",
        description: "Volunteer in youth-eligible shelter roles. Confirmed directly via the organization's own current page, quoted verbatim: 'Youth ages 8 to 12 must volunteer with a parent or guardian; youth ages 13 to 17 may also team up with an adult,' and 'Youth ages 13 to 17 may volunteer solo, opportunities are limited.'",
        location: "5132 Voges Rd, Madison, WI 53718", zip: "53718", geocodeCity: "Madison, WI",
        minimumAge: 8, applicationUrl: "https://www.giveshelter.org/how-to-help/volunteer/youth-volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "youth-volunteer", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 8-12 must volunteer with a parent/guardian; ages 13-17 may team up with an adult or, in limited cases, volunteer solo (per the organization's own current page).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Arizona depth pass (Phase 3): checked the DB first for existing
  // AZ coverage of nearby Pinal County towns before researching.
  // Coolidge is not represented at all yet (Pinal County Library
  // District's Coolidge branch is a different department/org).
  {
    slug: "coolidge-police-department-az",
    name: "Coolidge Police Department",
    description: "The police department serving Coolidge, Arizona (Pinal County).",
    websiteUrl: "https://www.coolidgeaz.com/?SEC=A31329AA-5175-4ECC-A080-4E43423C81DD",
    city: "Coolidge, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Police Explorer Program",
        description: "Explore a law-enforcement career through ride-alongs, training, and community events. Confirmed directly via the department's own current page, quoted verbatim: 'ages 14 to 20 who are interested in pursuing a career in law enforcement.' An Explorer Application document is posted on the same page.",
        location: "130 W Central Ave, Coolidge, AZ 85128", zip: "85128", geocodeCity: "Coolidge, AZ",
        minimumAge: 14, applicationUrl: "https://www.coolidgeaz.com/?SEC=A31329AA-5175-4ECC-A080-4E43423C81DD", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "police-explorer-program", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-20 (per the department's own current page).",
        programFocusTags: ["civic_engagement"],
      },
    ],
  },

  // Same AZ depth pass. Queen Creek is not represented at all yet.
  // Two departments confirmed with clean explicit numeric ages via the
  // town's own volunteer page (found via search; the page itself
  // returned 403 to a direct fetch, likely bot protection — quotes
  // below are as rendered from queencreekaz.gov by the search tool). A
  // third role (Recreation Center Lobby Ambassador, "all ages" with
  // under-14 needing an adult) was NOT staged since it has no clean
  // single numeric floor.
  {
    slug: "queen-creek-library-az",
    name: "Queen Creek Library",
    description: "The public library serving Queen Creek, Arizona, part of the Maricopa County Library District.",
    websiteUrl: "https://www.queencreekaz.gov/i-want-to/volunteer",
    city: "Queen Creek, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Library Volunteer",
        description: "Volunteer at the Queen Creek Library. Confirmed via the town's own current volunteer page: applicants must be 14 years of age or older and able to commit to a weekly 2-hour shift for a minimum of 4 months.",
        location: "21802 S Ellsworth Rd, Queen Creek, AZ 85142", zip: "85142", geocodeCity: "Queen Creek, AZ",
        minimumAge: 14, applicationUrl: "https://www.queencreekaz.gov/i-want-to/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "library-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+, minimum 4-month/weekly 2-hour-shift commitment (per the town's own current volunteer page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same AZ depth pass, different department (parks maintenance rather
  // than library) — a genuinely distinct role from the library one
  // above, with its own separate age floor.
  {
    slug: "queen-creek-parks-recreation-az",
    name: "Town of Queen Creek Parks and Recreation",
    description: "The parks and recreation department of the Town of Queen Creek, Arizona.",
    websiteUrl: "https://www.queencreekaz.gov/i-want-to/volunteer",
    city: "Queen Creek, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Parks and Grounds Maintenance Volunteer",
        description: "Help with general parks and grounds maintenance for the Town of Queen Creek. Confirmed via the town's own current volunteer page: 'volunteers must be 16 years old or older.'",
        location: "22358 S Ellsworth Rd, Queen Creek, AZ 85142", zip: "85142", geocodeCity: "Queen Creek, AZ",
        minimumAge: 16, applicationUrl: "https://www.queencreekaz.gov/i-want-to/volunteer", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "parks-grounds-maintenance-volunteer", category: "Environment", interestsTags: ["environment"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 16+ (per the town's own current volunteer page).",
        programFocusTags: ["environmental_stewardship"],
      },
    ],
  },

  // Museum/library discovery pass (site:volgistics.com/od age searches +
  // general search), five orgs, none previously staged.
  {
    slug: "discovery-childrens-museum-las-vegas",
    name: "DISCOVERY Children's Museum",
    description: "A children's museum in Las Vegas, Nevada.",
    websiteUrl: "https://discoverykidslv.org/support/volunteer/teen-volunteers/",
    city: "Las Vegas, NV",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer Program",
        description: "Volunteer at the museum as a high school student. Confirmed directly via the museum's own current page, quoted verbatim: 'high school students ages 14 to 17.' A volunteer application form and a mandatory orientation (held twice monthly) are required.",
        location: "360 Promenade Pl, Las Vegas, NV 89106", zip: "89106", geocodeCity: "Las Vegas, NV",
        minimumAge: 14, applicationUrl: "https://discoverykidslv.org/support/volunteer/teen-volunteers/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer-program", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "High school students ages 14-17 (per the museum's own current page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // ProRodeo Hall of Fame (Colorado Springs, CO) was researched and
  // briefly staged here but WITHDRAWN during independent review: its
  // own current volunteer page and linked PDF application form state no
  // minimum age at all. The original "16+" figure came only from a
  // third-party (Idealist.org) listing, not a first-party source, so it
  // didn't meet the evidence bar. The already-created DB row was
  // rejected with this reason rather than left pending or approved.

  // Same discovery pass. Note: current official page says "Juniors
  // (14-17)" — used over older, stale press releases from 2010-2014
  // that cited a broader "12-17" range.
  {
    slug: "florida-museum-of-natural-history",
    name: "Florida Museum of Natural History",
    description: "A natural history museum at the University of Florida in Gainesville, Florida.",
    websiteUrl: "https://www.floridamuseum.ufl.edu/volunteers/",
    city: "Gainesville, FL",
    contactEmail: "volunteers@floridamuseum.ufl.edu",
    opportunities: [
      {
        title: "Junior Volunteer Program",
        description: "Run Discovery Carts and the Discovery Room, and serve in other visitor-facing roles. Confirmed directly via the museum's own current volunteer page, quoted verbatim: 'Juniors (14-17).'",
        location: "3215 Hull Rd, Gainesville, FL 32611", zip: "32611", geocodeCity: "Gainesville, FL",
        minimumAge: 14, applicationUrl: "https://www.floridamuseum.ufl.edu/volunteers/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "junior-volunteer-program", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-17 (per the museum's own current volunteer page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same discovery pass.
  {
    slug: "san-antonio-public-library",
    name: "San Antonio Public Library",
    description: "The public library system serving San Antonio, Texas.",
    websiteUrl: "https://guides.mysapl.org/teenvolunteers/apply",
    city: "San Antonio, TX",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Volunteer in-person at most SAPL locations and/or off-site. Confirmed directly via the library's own current LibGuide, quoted verbatim: 'Ages 14-18 can become a teen volunteer at the library!' Applicants print and physically drop off the application at a library location.",
        location: "600 Soledad St, San Antonio, TX 78205", zip: "78205", geocodeCity: "San Antonio, TX",
        minimumAge: 14, applicationUrl: "https://guides.mysapl.org/teenvolunteers/apply", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-18 (per the library's own current LibGuide).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same discovery pass.
  {
    slug: "santa-clara-city-library",
    name: "Santa Clara City Library",
    description: "The public library serving Santa Clara, California.",
    websiteUrl: "https://www.sclibrary.org/kids-teens/teens/teen-volunteer-opportunities",
    city: "Santa Clara, CA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Volunteer at the library, committing to at least 20 hours. Confirmed via the library's own current page (found via search; the page itself returned 403 to a direct fetch): must be at least 14 years old and in high school; a parent/legal guardian signature is required for ages 14-17.",
        location: "2635 Homestead Rd, Santa Clara, CA 95051", zip: "95051", geocodeCity: "Santa Clara, CA",
        minimumAge: 14, applicationUrl: "https://www.sclibrary.org/kids-teens/teens/teen-volunteer-opportunities", applicationDeadline: null,
        availabilityStatus: "open",
        parentalConsentRequired: true,
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 14+ and in high school; parent/guardian signature required for ages 14-17 (per the library's own current page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // General search pass, three orgs, none previously staged.
  {
    slug: "pierce-county-library-system",
    name: "Pierce County Library System",
    description: "The public library system serving Pierce County, Washington.",
    websiteUrl: "https://mypcls.org/get-involved/volunteer/",
    city: "Tacoma, WA",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Volunteer",
        description: "Volunteer in roles specifically for teens, or in general roles open to both teens and adults; each role has its own minimum age. Confirmed directly via the library system's own current volunteer page, quoted verbatim: 'Minimum age of 13.' Applications are submitted via the library's Better Impact volunteer portal.",
        location: "3005 112th St E, Tacoma, WA 98446", zip: "98446", geocodeCity: "Tacoma, WA",
        minimumAge: 13, applicationUrl: "https://mypcls.org/get-involved/volunteer/", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-volunteer", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 13+ minimum, with individual roles carrying their own specific minimum age (per the library system's own current volunteer page).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same pass.
  {
    slug: "westminster-public-library-co",
    name: "Westminster Public Library",
    description: "The public library system serving Westminster, Colorado.",
    websiteUrl: "https://westminsterco.librarycalendar.com/event/teen-advisory-board-tab-640",
    city: "Westminster, CO",
    contactEmail: null,
    opportunities: [
      {
        title: "Teen Advisory Board (TAB)",
        description: "Join the Teen Advisory Board at the College Hill branch. Confirmed directly via the library's own current event listing, quoted verbatim: 'AGES: 12-18.'",
        location: "3705 W 112th Ave, Westminster, CO 80031", zip: "80031", geocodeCity: "Westminster, CO",
        minimumAge: 12, applicationUrl: "https://westminsterco.librarycalendar.com/event/teen-advisory-board-tab-640", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "teen-advisory-board", category: "Education", interestsTags: ["education"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 12-18 (per the library's own current event listing).",
        programFocusTags: ["community_service"],
      },
    ],
  },

  // Same pass, Arizona priority. Currently closed for new applicants
  // (annual August recruitment window) — staged with accurate current
  // status rather than omitted, per policy of transparently labeling
  // seasonal/closed programs rather than skipping them.
  {
    slug: "east-valley-fire-cadet-program-az",
    name: "East Valley Fire Cadet Program",
    description: "A regional youth public-safety program supported by the Mesa Fire & Medical Department and partners Gilbert Fire & Rescue, Queen Creek Fire & Medical, Salt River Fire, and Superstition Fire & Medical, serving the East Valley, Arizona area.",
    websiteUrl: "https://www.mesaaz.gov/Public-Safety/Mesa-Fire-Medical/Community-Outreach/ProgramsClasses/Youth-Programs/Fire-Medical-Cadets",
    city: "Mesa, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Fire & Medical Cadet Program",
        description: "Learn about fire and medical service careers while developing leadership and teamwork skills. Confirmed directly via the program's own current page, quoted verbatim: applicants must be '15 years old but not older than 18 years old' and currently enrolled in school with a 'C' average.",
        location: "Mesa, AZ", zip: null, geocodeCity: "Mesa, AZ",
        minimumAge: 15, applicationUrl: "https://www.mesaaz.gov/Public-Safety/Mesa-Fire-Medical/Community-Outreach/ProgramsClasses/Youth-Programs/Fire-Medical-Cadets", applicationDeadline: null,
        availabilityStatus: "closed",
        availabilityNote: "Recruitment and registration happen once a year in August. The current cycle's applications are closed; the program's own page directs interested applicants to check back August 1 for the next school year's window.",
        externalIdSuffix: "fire-medical-cadet-program", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 15-18, must be currently enrolled in school with a 'C' average or better (per the program's own current page).",
        programFocusTags: ["civic_engagement"],
      },
    ],
  },

  // Arizona depth pass continuation. Avondale already has two other
  // departments covered (Neighborhood & Family Services, Library) —
  // this is a genuinely distinct department (Police) not yet staged.
  // Own page returned 403 to a direct fetch (bot protection); evidence
  // below is as rendered from avondaleaz.gov by the search tool.
  {
    slug: "avondale-police-department-az",
    name: "Avondale Police Department",
    description: "The police department serving Avondale, Arizona.",
    websiteUrl: "https://www.avondaleaz.gov/government/departments/police/police-department-programs/avondale-cadet-program",
    city: "Avondale, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "Avondale Cadet Program",
        description: "Gain an in-depth experience into a policing career. Confirmed via the department's own current page (found via search): participants must be at least 14 and not more than 18 years of age, an Avondale teen entering Freshman through Senior year of high school, with a C average or better from the last academic year, free of felony arrests/current drug or alcohol use/criminal activity. Attends weekly Tuesday night meetings at the Avondale Police Station.",
        location: "11485 W Civic Center Dr, Avondale, AZ 85323", zip: "85323", geocodeCity: "Avondale, AZ",
        minimumAge: 14, applicationUrl: "https://www.avondaleaz.gov/government/departments/police/police-department-programs/avondale-cadet-program", applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "avondale-cadet-program", category: "Community Service", interestsTags: ["community"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Ages 14-18, must be an Avondale teen in grades 9-12 with a C average or better (per the department's own current page).",
        programFocusTags: ["civic_engagement"],
      },
    ],
  },

  // General search pass. Note: this is Peoria, ILLINOIS's zoo
  // (peoriazoo.org) — not Peoria, Arizona, which has no zoo of its own.
  // Seasonal: the specific dates confirmed on the org's own page
  // (application deadline April 30, training June 5-6) describe the
  // annual cycle pattern; by the time of this session (September) the
  // 2026 cycle's own deadlines had already passed.
  {
    slug: "peoria-zoo-il",
    name: "Peoria Zoo",
    description: "A zoo in Peoria, Illinois, operated by the Peoria Park District.",
    websiteUrl: "https://peoriazoo.org/connect/volunteer/",
    city: "Peoria, IL",
    contactEmail: null,
    opportunities: [
      {
        title: "Zoo Teen Program",
        description: "Volunteer as a Zoo Teen. Confirmed directly via the zoo's own current volunteer page, quoted verbatim: 'Must be at least 13 years old and a freshman in high school by Fall of 2026.' The annual cycle includes a questionnaire and reference letter, online registration, and mandatory two-day training workshops each spring/early summer.",
        location: "2320 N Prospect Rd, Peoria, IL 61603", zip: "61603", geocodeCity: "Peoria, IL",
        minimumAge: 13, applicationUrl: "https://peoriazoo.org/connect/volunteer/", applicationDeadline: null,
        availabilityStatus: "seasonal",
        availabilityNote: "Annual cycle: application/reference letter and online registration due by April 30, two-day mandatory training in early June, decisions by mid-June, per the zoo's own current page. This year's cycle has already concluded by the time of this record's creation (September).",
        externalIdSuffix: "zoo-teen-program", category: "Animals", interestsTags: ["animals"],
        commitmentType: "recurring", programType: "volunteering", compensation: "unpaid",
        eligibleGrades: "Age 13+, must be entering high school as a freshman by the applicable fall (per the zoo's own current page).",
        programFocusTags: ["animal_welfare"],
      },
    ],
  },

  // Canonical-taxonomy source research batch (Healthcare specialties):
  // targeting focuses with zero coverage after the reclassification
  // pass (see scripts/reclassify-focus-tags.ts and its coverage-audit
  // output) — psychology_mental_health, public_health, dentistry.
  // Reclassification of existing opportunities was done first (see the
  // "supplementary evidence-based reclassification" commit); these are
  // genuinely new sources, not previously-mistagged existing records.
  //
  // Reviewed 2026-09-05 against a stricter "clearly volunteer-based"
  // standard. Two records below (STAND Coalition, Youth Advisory
  // Council) passed and are approved (reviewStatus omitted). Three
  // records were rejected and removed from this file entirely — kept
  // here only as a record of what was tried and why, not as data to
  // re-insert:
  //   - Active Minds' "Mental Health Advocacy Academy" — primarily a
  //     leadership/advocacy TRAINING curriculum (interactive virtual
  //     sessions, discussions, mentorship), not direct volunteer
  //     service; its actual "doing" phase (the paid, stipended Action
  //     Lab) is a paid role, not a volunteer one.
  //   - OHSU School of Dentistry's "Dental Explorers" — a paid CLASS
  //     (monthly lecture + lab session, $15 application fee + $70
  //     registration fee), not volunteer service.
  //   - MentorKids USA's "iLEAD Youth Leadership" — students are
  //     explicitly "hired as part-time employees" (compensation: paid),
  //     not volunteers.
  {
    slug: "maricopa-county-public-health",
    name: "Maricopa County Department of Public Health",
    description: "Maricopa County, AZ's public health department, running teen-eligible public health education and advisory programs.",
    websiteUrl: "https://www.maricopa.gov/5302/Public-Health",
    city: "Phoenix, AZ",
    contactEmail: null,
    opportunities: [
      {
        title: "STAND Coalition",
        description:
          "Youth ages 13-19 work within their communities on health improvement projects focused on tobacco use prevention, public health, and mental wellness. Confirmed directly via the county's own current page: 'We're now accepting applications! Apply to the program today!' A one-year commitment (August 2026-May 2027) with weekly one-hour meetings held virtually or in-person.",
        location: "Maricopa County, AZ",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://forms.cloud.microsoft/g/4DJdDGR1CW",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "stand-coalition",
        category: "Healthcare",
        interestsTags: ["healthcare", "public_health"],
        deliveryMode: "hybrid",
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-19 (per the county's own current page).",
        timeCommitment: "Weekly one-hour meetings, August 2026-May 2027.",
        programFocusTags: ["healthcare_club"],
        // Reviewed 2026-09-05 and approved (genuine volunteer community
        // health project work) — reviewStatus omitted.
      },
      {
        title: "Youth Advisory Council (Public Health)",
        description:
          "Teens from across Maricopa County collaborate and share perspectives on public health topics to help influence county public health initiatives; no prior experience necessary. Confirmed directly via the county's own current page: ages 13-19, Maricopa County residency required. Distinct from Maricopa County Elections' separate Student Election Program and the county library's separate teen programs — this is the public health department's own advisory council.",
        location: "Maricopa County, AZ",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 13,
        applicationUrl: "https://www.maricopa.gov/5918/Youth-Advisory-Council",
        applicationDeadline: null,
        // The county's own page states plainly: "The 2026-27 applications
        // are now closed. Please keep an eye out for next year's
        // application in April 2027." Staged with accurate current
        // status rather than omitted.
        availabilityStatus: "seasonal",
        availabilityNote: "2026-27 applications are closed; the county's own page says to watch for the next application window in April 2027.",
        externalIdSuffix: "youth-advisory-council-public-health",
        category: "Healthcare",
        interestsTags: ["healthcare", "public_health", "civic_engagement"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 13-19, Maricopa County residents (per the county's own current page).",
        timeCommitment: "One-year term (most recent cohort ran July 2025-May 2026).",
        programFocusTags: ["healthcare_club", "civic_engagement"],
        // Reviewed 2026-09-05 and approved (genuine civic-advisory
        // volunteer role, consistent with other approved Youth Advisory
        // Councils elsewhere in this catalog) — reviewStatus omitted.
      },
    ],
  },

  // High-demand-focus research batch (2026-09-05, revised coverage
  // strategy): targeting Medicine/Physician, Nursing, Psychology/Mental
  // Health, CS/Software Engineering, Engineering, Business/Marketing,
  // and Arts/Media per the confirmed prioritization. Applied the
  // stricter "clearly volunteer-based" filter throughout — several
  // candidates researched this pass were NOT added because they failed
  // it: a Phoenix-area "Social Media & Digital Marketing Volunteer"
  // listing (Idealist-only, no first-party org page to verify against,
  // and it discloses a stipend — paid, not volunteer); Phoenix Art
  // Museum's Teen Art Council (explicitly paid); Phoenix Children's
  // Foundation's Teen Council (real $100/year dues plus a $1,000/year
  // personal fundraising quota — too significant a financial barrier to
  // add as a broadly-accessible option, and currently closed until
  // April 2027 regardless); FIRST Robotics/FLL mentoring roles (in
  // practice filled by industry professionals or college students, not
  // a structured high-school-student-facing application). All were
  // researched and deliberately not added, not overlooked.
  {
    slug: "teen-lifeline-az",
    name: "Teen Lifeline",
    description: "Arizona's only teen peer crisis hotline (est. 1986) — trains teen volunteers as \"Peer Counselors\" to answer calls and texts from teens in crisis, under the supervision of licensed clinicians.",
    websiteUrl: "https://teenlifeline.org/about-us/",
    city: "Phoenix, AZ",
    contactEmail: "volunteer@teenlifeline.org",
    opportunities: [
      {
        title: "Peer Counselor (Maricopa County / Phoenix)",
        description:
          "Trained teen \"Peer Counselors\" ages 15-19 answer calls and texts on Arizona's only teen peer crisis hotline, 3-9pm daily, under licensed-clinician supervision. Confirmed directly via the organization's own current pages: applicants must be at least 15, live in Maricopa County, have reliable transportation to Phoenix, and commit to a minimum 4 months at 15+ hours/month (2-3 shifts). Requires completing 72 hours of life-skills-development training before starting on the hotline. No application fee. The application form itself is live with no stated closed/full status — reads as a standing, rolling pathway (apply, then receive the next training-session schedule by email).",
        location: "Phoenix, AZ",
        zip: null,
        geocodeCity: "Phoenix, AZ",
        minimumAge: 15,
        applicationUrl: "https://teenlifeline.org/teen-volunteer-app-phx/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "peer-counselor-maricopa",
        category: "Healthcare",
        interestsTags: ["healthcare", "psychology_mental_health"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-19; must live in Maricopa County with reliable transportation to Phoenix (per the organization's own current pages).",
        timeCommitment: "Minimum 4-month commitment, 15+ hours/month (2-3 shifts); 72 hours of training required before starting on the hotline.",
        parentalConsentRequired: true, // application form itself requires parent/guardian contact info for a minor
        programFocusTags: ["healthcare_club"],
        // Re-verified 2026-09-06 directly against the organization's own
        // pages (unpaid, live application form, no fee, Maricopa County
        // residency confirmed) and approved — reviewStatus omitted.
      },
      {
        title: "Peer Counselor (Pima County / Tucson)",
        description:
          "Same statewide Peer Counselor program as the Maricopa County listing, via Teen Lifeline's separate Tucson application intake. Confirmed directly via the organization's own current pages: applicants must be at least 15, live in Pima County, have reliable transportation to Tucson, and commit to a minimum 4 months at 15+ hours/month (2-3 shifts).",
        location: "Tucson, AZ",
        zip: null,
        geocodeCity: "Tucson, AZ",
        minimumAge: 15,
        applicationUrl: "https://teenlifeline.org/teen-volunteer-app-tus/",
        applicationDeadline: null,
        availabilityStatus: "open",
        externalIdSuffix: "peer-counselor-pima",
        category: "Healthcare",
        interestsTags: ["healthcare", "psychology_mental_health"],
        commitmentType: "recurring",
        programType: "volunteering",
        compensation: "unpaid",
        eligibleGrades: "Ages 15-19; must live in Pima County with reliable transportation to Tucson (per the organization's own current pages).",
        timeCommitment: "Minimum 4-month commitment, 15+ hours/month (2-3 shifts); 72 hours of training required before starting on the hotline.",
        parentalConsentRequired: true,
        programFocusTags: ["healthcare_club"],
        // Re-verified 2026-09-06 directly against the organization's own
        // pages (unpaid, live application form, no fee, Pima County
        // residency confirmed) and approved — reviewStatus omitted.
      },
    ],
  },
];
