// Evidence-based reclassification pass for the canonical focus taxonomy
// (lib/interestTaxonomy.ts). Most of the 1,176 approved opportunities
// predate the 10-category taxonomy and carry only a broad interest tag
// (e.g. "animals", "environment") with no specific focus. This script
// adds focus tags where a real, specific detail in the opportunity's own
// title/description supports one — it never invents specificity that
// isn't there.
//
// Every rule below was derived from actually reading real titles and
// descriptions in this catalog (not guessed keywords), and every match
// list was manually reviewed before being accepted; each `excludeIds`
// entry is a specific false positive caught during that review (e.g. a
// hospital's multi-department teen program mentions "nursing units" as
// one of a dozen placement areas — that's not evidence the role itself
// is nursing-focused). See the exclusion comments inline for the
// reasoning on each one.
//
// STRICTLY ADDITIVE: only ever appends a focus tag to
// opportunities.interests_tags if it's not already present. Never
// removes a tag, never touches title/description/category or any other
// field, never changes the approved-opportunity count. Safe to re-run —
// already-tagged rows are skipped, so a second run is a no-op.
//
// Usage:
//   npx tsx scripts/reclassify-focus-tags.ts             # dry run (default) — prints only
//   npx tsx scripts/reclassify-focus-tags.ts --apply      # writes to the database
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../tests/loadEnv";
import { ALL_VALID_INTEREST_VALUES } from "../lib/interestTaxonomy";

loadEnvLocal();

const APPLY = process.argv.includes("--apply");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  interests_tags: string[];
};

type Rule = {
  focus: string;
  categoryScope?: string[]; // raw `category` column values this rule may fire on
  include?: RegExp[]; // any one matching = candidate (omit when using includeIds instead)
  exclude?: RegExp[]; // any one matching = veto
  excludeIds?: string[]; // specific opportunity ids vetoed after manual review
  // Explicit opportunity ids to include, used instead of `include` regexes
  // when the evidence is a one-off, manually-read judgment call (e.g. "this
  // specific park-cleanup event's own description names a climate-resilience
  // initiative") rather than a phrase that recurs across many records and is
  // safe to generalize into a pattern. Every id here was matched by reading
  // that exact opportunity's stored title/description, never by keyword.
  includeIds?: string[];
  titleOnly?: boolean; // match title only, not description (for generic body-text words)
};

const RULES: Rule[] = [
  // ---- STEM & Technology ----
  {
    focus: "robotics",
    categoryScope: ["STEM"],
    include: [
      /\brobotics?\b/i,
      /\bFIRST Robotics\b/i,
      /\bFIRST Tech Challenge\b/i,
      /\bFIRST Lego League\b/i,
      /\bFLL\b/,
      /\bFTC\b/,
      /\bFRC\b/,
      /\bVEX\b/,
      /\bRoboSub\b/i,
      /\bunderwater (?:autonomous vehicle|robotics)\b/i,
    ],
    // "Program Instructor" (library): "Do you do Tai Chi? Watercolor?
    // Robotics?" is one example among many possible hobbies a volunteer
    // could teach — not evidence the role itself is robotics.
    excludeIds: ["a9874be4-2fab-4663-9973-811bb2fa9512"],
  },
  {
    focus: "data_science_ai",
    categoryScope: ["STEM"],
    include: [/\bcomputer vision\b/i, /\bartificial intelligence\b/i, /\bmachine learning\b/i],
  },

  // ---- Healthcare & Wellness ----
  {
    focus: "nursing",
    categoryScope: ["Healthcare"],
    include: [/\bnursing\b/i, /\bCNA\b/, /\bregistered nurse\b/i],
    // "Teen Application" (Banner Desert): nursing units are one of a dozen
    // listed hospital placement areas (dietary, gift shop, surgery, etc.)
    // — not evidence the role itself is nursing-focused.
    excludeIds: ["51bd58aa-752f-44f7-b416-92f9243c9d24"],
  },
  {
    focus: "medicine_physician",
    categoryScope: ["Healthcare"],
    include: [/\bmedical explorer/i, /\bjunior medical program\b/i, /\bshadow(?:ing)? healthcare professionals\b/i],
  },
  {
    focus: "biomedical_research",
    categoryScope: ["Healthcare", "STEM"],
    include: [
      /\bbioscience program\b/i,
      /\bresearch volunteer pathway\b/i,
      /\bneuroscience.{0,20}biomedical research\b/i,
      /\bclinical trials\b/i,
    ],
  },
  {
    focus: "emergency_medicine_first_aid",
    categoryScope: ["Community Service", "Healthcare"],
    include: [/\bfire (?:&|and) medical cadet\b/i, /\bfire and medical service careers\b/i],
  },

  // ---- Animals & Wildlife ----
  {
    focus: "animal_shelters",
    categoryScope: ["Animals"],
    include: [
      /\badoption\b/i,
      /\bfoster\b/i,
      /\bkennel/i,
      /\bshelter (?:crew|volunteer|support|lobby|greeter)\b/i,
      /\bhumane\b/i,
      /\bPACC\b/,
      /\bpet bank\b/i,
      /\bcat (?:care|enrichment|kennels)\b/i,
      /\bdog walk/i,
      /\banimal care volunteer\b/i,
      /\btrap neuter return\b/i,
      /\bintake window\b/i,
    ],
    exclude: [/\bhomeless/i],
  },
  {
    focus: "veterinary_interests",
    categoryScope: ["Animals"],
    include: [/\bvet services\b/i, /\bspay.?neuter\b/i, /\bveterinary\b/i, /\bvet tech\b/i],
    // "Transport" (PACC): drives animals to vet appointments but doesn't
    // participate in veterinary care itself — too weak a connection.
    excludeIds: ["525d5698-a6e8-4038-a4de-9edfe83066db"],
  },
  {
    focus: "wildlife_conservation",
    categoryScope: ["Animals", "Community Service", "Environment"],
    include: [/\bwildlife (?:area|center|guardian|conservation)\b/i, /\bwater for wildlife\b/i, /\bhabitat.{0,20}wildlife\b/i],
  },
  {
    focus: "marine_wildlife",
    categoryScope: ["Animals", "Community Service", "Education"],
    include: [/\baquarist\b/i, /\bmarine life\b/i, /\btouch tank\b/i, /\bsea center\b/i],
  },
  {
    focus: "animal_assisted_services",
    categoryScope: ["Animals", "Environment", "Education", "Community Service"],
    include: [/\btherapy anim/i, /\breading to dogs\b/i, /\bsit,? stay,? read\b/i],
    // "Del City Teen Volunteer Interview": "Reading to Dogs" is one of six
    // possible activities in a generic library program, not the role.
    excludeIds: ["54d13c80-b9ee-42d8-b9d7-5ce3c6c56734"],
  },

  // ---- Environment & Sustainability ----
  {
    focus: "parks_outdoor_stewardship",
    categoryScope: ["Environment", "Community Service", "STEM", "Education"],
    include: [/\bpark host\b/i, /\btrail (?:maintenance|steward|watch)\b/i, /\bgrounds? maintenance\b/i, /\bfacility.{0,10}maintenance\b/i],
  },
  {
    focus: "agriculture_food_systems",
    categoryScope: ["Environment"],
    include: [/\bcrop production\b/i, /\burban farms?\b/i, /\bcommunity garden\b/i, /\bfarm nursery\b/i],
  },
  {
    focus: "conservation",
    categoryScope: ["Environment"],
    include: [/\bweed warrior\b/i, /\binvader detectors?\b/i, /\binvasive (?:plant|species)\b/i],
  },
  {
    focus: "recycling_waste_reduction",
    categoryScope: ["Environment", "Community Service"],
    // Body-text "recycl" matched dozens of generic park-host/library-
    // sorting listings where recycling is one minor duty among a dozen
    // unrelated ones (e.g. "collect cans from recycling bins" in a
    // maintenance-host job that's mostly mowing/painting/plumbing) —
    // title-only keeps this to opportunities actually about recycling.
    include: [/\brecycl/i],
    titleOnly: true,
  },

  // ---- Community Service ----
  {
    focus: "food_security",
    categoryScope: ["Community Service"],
    include: [/\bfood (?:bank|pantry|box|drive)\b/i, /\bemergency food\b/i, /\bmobile pantr/i, /\bpantry\b/i],
  },
  {
    focus: "housing_homelessness",
    categoryScope: ["Community Service"],
    // \bReStore\b is case-sensitive on purpose: Habitat for Humanity's
    // thrift store is branded "ReStore," but a case-insensitive match
    // also caught "help create or restore" (a park-project verb) in
    // unrelated Eagle/Girl Scout project listings.
    include: [/\bReStore\b/, /\bhabistore\b/i, /\bhabitat for humanity\b/i, /\bCHUCK Center\b/i],
  },
  {
    focus: "civic_engagement",
    categoryScope: ["Community Service", "Education"],
    include: [/\byouth advisory (?:council|board|commission)\b/i, /\byouth (?:council|commission)\b/i, /\bmayor'?s youth\b/i],
  },
  {
    focus: "senior_support",
    categoryScope: ["Healthcare", "Community Service"],
    include: [/\bhome-delivered meals\b/i, /\bsenior health insurance counseling\b/i, /\bcatch-a-ride\b/i],
  },
  {
    focus: "criminal_justice",
    categoryScope: ["Community Service"],
    include: [/\bpolice (?:cadet|explorer)/i, /\bteen jury\b/i, /\bteen court\b/i],
    // "Court Ordered Community Service" (Goodwill): a placement for people
    // fulfilling a court-mandated obligation, not criminal-justice career
    // exposure — the opposite of career-relevant evidence.
    exclude: [/\bcourt ordered\b/i, /\bin lieu of\b/i],
  },
  {
    focus: "government_public_administration",
    categoryScope: ["Community Service"],
    include: [/\bcourt administration\b/i, /\bfirst appearance center\b/i],
    exclude: [/\bcourt ordered\b/i],
  },

  // ---- Education & Mentoring ----
  {
    focus: "literacy",
    categoryScope: ["Education"],
    include: [
      /\btutor(?:ing)?\b/i,
      /\bliteracy\b/i,
      /\breading (?:help|refuel|buddies)\b/i,
      /\bfollow the reader\b/i,
      /\brocket readers\b/i,
      /\bbook buddies\b/i,
      /\bhomework help\b/i,
      /\bESL\b/,
      /\benglish (?:conversation|language learner)\b/i,
    ],
    // "General Volunteer Interest (JA STEM Summit...)": "literacy" here
    // means FINANCIAL literacy, an unrelated Junior Achievement program —
    // not reading/tutoring. "Teen Volunteer" (Pasco County): "literacy"
    // appears only naming a DIFFERENT sibling role at the same library
    // ("Adult Literacy Tutoring") for context — this specific listing is
    // generic branch tasks, not tutoring. "Del City Teen Volunteer
    // Interview": same generic multi-activity library program excluded
    // above — "homework help" is one of six listed activities.
    excludeIds: [
      "8ab38046-877e-48c2-890a-d643b1243d7a",
      "15e8e537-8652-4947-840d-e25ff6685915",
      "54d13c80-b9ee-42d8-b9d7-5ce3c6c56734",
    ],
  },

  // ---- Arts, Media & Culture ----
  {
    focus: "music",
    categoryScope: ["Arts & Culture"],
    // Bare /music/i also caught generic multi-activity library programs
    // ("Adult Programming Volunteer" lists music as one of ~8 possible
    // program types), a K-pop craft event (photocards/crafts, not
    // music-making), and an environmental-stewardship program that
    // mentions "art, music, and more" as an incidental land-based
    // cultural practice — none of those are music-focused roles.
    include: [/\bpianist\b/i, /\bpiano\b/i, /\bmusic\b/i],
    excludeIds: [
      "bf0aa257-5b5b-4e09-b1fd-0dc341a2c781",
      "7d57b330-859b-4791-9a88-f7d5024062b4",
      "d78ce8d8-bb71-4aad-b09a-0873aaef37fc",
      "83ac232b-3ac9-4ef5-b885-4245107e4159",
      "f80e66ec-6fda-4266-8bde-8f772b7b8f8b",
      "c3979bbf-1e92-4892-a90f-236c46e87cfd",
    ],
  },
  { focus: "theater_performing_arts", categoryScope: ["Arts & Culture"], include: [/\btheat(?:er|re)\b/i] },
  {
    focus: "museums_history",
    categoryScope: ["Arts & Culture"],
    include: [/\bmuseum\b/i, /\bhistoric(?:al)? archives?\b/i],
  },

  // ---- Sports & Recreation ----
  { focus: "coaching", categoryScope: ["Sports & Rec"], include: [/\bcoach(?:ing)?\b/i] },
  {
    focus: "adaptive_sports",
    categoryScope: ["Sports & Rec", "Healthcare"],
    include: [/\badaptive sport/i, /\bdisabled sports?\b/i, /\bspecial olympics\b/i],
  },
  {
    focus: "youth_sports",
    categoryScope: ["Sports & Rec"],
    include: [/\byouth (?:sports?|soccer|baseball|basketball) (?:coach|league)/i, /\b(?:soccer|baseball|basketball|flag football) (?:league|coach)\b/i],
  },

  // ---- Community Service + Environment deep pass (2026-09-06) ----
  // Second full read-through of the ~280 Community Service and ~290
  // Environment approved opportunities (most were never reviewed as
  // closely as Healthcare in the original pass). Every id below was
  // matched by reading that specific opportunity's own stored title and
  // description, not a generalizable keyword — includeIds is used
  // instead of a regex `include` precisely because these are one-off
  // judgment calls, not recurring phrases safe to pattern-match broadly.
  // Several plausible-looking candidates were reviewed and deliberately
  // NOT included; see the rejected-false-positives list in this script's
  // header-adjacent commit message for what was excluded and why.
  {
    // Family Dining Room, Kitchen Crew: St. Vincent de Paul meal service,
    // description explicitly names "financial and food insecurity."
    // Lunch/Evening Meal Service (Phoenix Dining Room): same org, "serve
    // ... individuals experiencing homelessness and food insecurity."
    // Pizza Making: same St. Vincent de Paul guest population.
    // Turkey & Food Bag Distribution: Thanksgiving food-bag distribution
    // to "individuals and families in need."
    // Shopper Support (Maryvale): Harvest Compassion Center's "food and
    // clothing assistance location."
    // Chef's Night Off / Rise and Dine / 9/11 Service Weekend Chef's
    // Night Off: HomeBase Youth Services — preparing/serving meals for
    // youth experiencing homelessness.
    // Residential Dining Volunteer: UMOM New Day Centers — serving meals
    // to "residential guest families" (UMOM is a family homeless shelter).
    // Volunteer at Three Square: "Assemble meals for children or pack
    // produce for seniors and families" at a food bank.
    focus: "food_security",
    categoryScope: ["Community Service"],
    includeIds: [
      "995157b6-56af-4692-88d5-24cbdac2a4ff", // Family Dining Room
      "55238b6c-6999-463d-b1da-9bb324b30b20", // Kitchen Crew
      "8a500ab5-45cd-4f30-a899-062afcb860f1", // Lunch Service (Phoenix Dining Room)
      "129adf45-1478-4ccb-ab8c-6d147a7e1aac", // Evening Meal Service (Phoenix Dining Room)
      "c16033bb-13db-403b-9670-ae31fe302021", // Pizza Making
      "cf49e516-cc20-4031-9829-78a4582231a5", // Turkey & Food Bag Distribution
      "651ab297-e676-462a-9cd7-8d687b728fc9", // Shopper Support (Maryvale)
      "b9d4e7a9-6694-42cc-823b-c920a4b46ded", // Chef's Night Off
      "5508e39e-606a-46bf-b7f3-0d5e02cc2e58", // Rise and Dine
      "43aae5f2-6f4b-4dbe-b6c8-355a8a59420b", // 9/11 Service Weekend: Chef's Night Off at HomeBase Surprise
      "69ad4359-37c8-4979-b6d8-b8df2dcb5173", // Residential Dining Volunteer
      "f2793fef-245d-4359-a0d0-50c0879ef52a", // Volunteer at Three Square
    ],
  },
  {
    // Chef's Night Off / Rise and Dine / 9/11 HomeBase Chef's Night Off:
    // HomeBase Youth Services serves "youth experiencing homelessness."
    // Residential Dining Volunteer, Clothing Closet Restock: UMOM New Day
    // Centers — "residential guest families" / "resident families" at
    // Arizona's largest family homeless shelter.
    // Maggie's Place Spruce Up: a residential maternity home for
    // "pregnant and parenting women in need."
    // Construction and Home Repair Volunteer / Construction & Habitat
    // Stores Volunteer: two distinct Habitat-for-Humanity-style orgs
    // ("Build or rehab homes in partnership with families" / explicit
    // "Habitat Stores") not already covered by the first pass's Habitat
    // records (different organization_id).
    focus: "housing_homelessness",
    categoryScope: ["Community Service"],
    includeIds: [
      "b9d4e7a9-6694-42cc-823b-c920a4b46ded", // Chef's Night Off
      "5508e39e-606a-46bf-b7f3-0d5e02cc2e58", // Rise and Dine
      "43aae5f2-6f4b-4dbe-b6c8-355a8a59420b", // 9/11 Service Weekend: Chef's Night Off at HomeBase Surprise
      "69ad4359-37c8-4979-b6d8-b8df2dcb5173", // Residential Dining Volunteer
      "6046fd70-e93f-4ef0-b16e-16f1b0852ab9", // Clothing Closet Restock
      "dda29115-5bac-45f1-ab45-771810b43e7c", // Maggie's Place Spruce Up
      "51f5c830-f513-47af-ac88-07f7f74635a2", // Construction and Home Repair Volunteer
      "e188a256-ac45-4252-b0aa-c8aa72989528", // Construction & Habitat Stores Volunteer
    ],
  },
  {
    // HomeBase Youth Services' three meal-service roles specifically
    // serve "youth experiencing homelessness" / "homeless youth and
    // young adults" — a distinct vulnerable-youth population, not just
    // "homelessness" generically.
    focus: "youth_services",
    categoryScope: ["Community Service"],
    includeIds: [
      "b9d4e7a9-6694-42cc-823b-c920a4b46ded", // Chef's Night Off
      "5508e39e-606a-46bf-b7f3-0d5e02cc2e58", // Rise and Dine
      "43aae5f2-6f4b-4dbe-b6c8-355a8a59420b", // 9/11 Service Weekend: Chef's Night Off at HomeBase Surprise
    ],
  },
  {
    // "pack donations for the refugee families that will be welcomed" —
    // explicit refugee-resettlement evidence.
    focus: "immigrant_refugee_support",
    categoryScope: ["Community Service"],
    includeIds: ["06517076-1e6d-40e0-bdc1-27c6c213cad6"], // Donation Packing with The Welcome to America Project
  },
  {
    // Montgomery County's "Active Aging Week" event for "residents 55
    // years old or better" — explicit senior-focused community event.
    focus: "senior_support",
    categoryScope: ["Community Service"],
    includeIds: ["1eed1fcd-863f-4514-ad38-2bbf628d4e59"], // Active Aging Week Kick-Off Event
  },
  {
    // Crisis Text Line's Crisis Counselor role — genuine mental-health
    // crisis support, cross-tagged into Healthcare's focus taxonomy even
    // though this record's category is Community Service (same pattern
    // as the first pass's Fire & Medical Cadet -> emergency_medicine_
    // first_aid cross-tag).
    focus: "psychology_mental_health",
    categoryScope: ["Community Service"],
    includeIds: ["e23d4a63-96f3-4988-9f50-43bf2a3751e8"], // Crisis Counselor
  },
  {
    // "cleanup blight in our neighborhoods... Neighborhood Services
    // Department Volunteer Program" — neighborhood revitalization work,
    // not an environmental-science or conservation activity despite this
    // record's Environment category/broad tag.
    focus: "community_development",
    categoryScope: ["Environment"],
    includeIds: ["3956f1af-deae-4db3-90bb-98dd698da702"], // NSD Volunteers
  },

  // ---- Environment deep pass ----
  {
    // Park Cleanup and Stinknet Removal: "remove invasive stinknet weed."
    // MPEA Conservation Stewardship Project: "habitat restoration tasks
    // (invasive-species removal, shelter clearing, tree planting)."
    // Tuesdays in the Gardens (Native Wildflower Stewardship Team):
    // tending a native-wildflower habitat garden, not an ornamental one.
    // Native Garden Planting Day: planting native species "important for
    // supporting [wildlife/pollinators]."
    // Green Teens: "learn about environmental issues, conservation
    // action, and pollution's effects on wildlife" — conservation is the
    // program's own explicit framing, not incidental.
    // Urban Forest restoration (Saugstad Park): native oak planting to
    // stabilize a riverbank — genuine riparian habitat restoration.
    // Preserve Park Steward Volunteer: Phoenix Parks' own description
    // says "Park Stewards are a valuable part of our conservation team."
    // Native Plant Garden Workday (Plains Conservation Center): explicit
    // "pollinator habitat" and "seed bank" — habitat conservation, not
    // ornamental gardening.
    // Riparian Event Volunteer: assists with "Conservation Celebration"
    // and "Bioblitz" events at a riparian preserve.
    // Region 2 Wildlife Conservation & Habitat Enhancement: already
    // carries Animals' wildlife_conservation tag from the first pass;
    // "Habitat Enhancement" is equally genuine evidence for Environment's
    // own conservation focus.
    focus: "conservation",
    categoryScope: ["Environment"],
    includeIds: [
      "641c6021-d45a-4f21-890b-f6469d964120", // Park Cleanup and Stinknet Removal
      "8e2b0d4b-2a8f-4709-bae2-524737c9cf99", // MPEA Conservation Stewardship Project
      "0bcf6b22-4cdf-49de-a4be-479c73731070", // Tuesdays in the Gardens - Native Wildflower Stewardship Team
      "af2ad5ff-d339-4392-a66b-fc47b590759c", // Native Garden Planting Day
      "be328dc5-7029-475b-8619-20d0902f1aa0", // Green Teens
      "8acbf515-79ed-4833-a626-48123e6d2baa", // Urban Forest restoration. Saugstad Park
      "63a73cb9-af18-4239-acc7-da89a16a9bf0", // Preserve Park Steward Volunteer
      "79539f48-7702-412c-8030-95ddb6f58993", // Native Plant Garden Workday (Plains Conservation Center)
      "97566aac-3427-4af4-882e-245e1701915b", // Riparian Event Volunteer
      "4819fdf9-cbf1-415d-92e9-caa99aa765e2", // Region 2 Wildlife Conservation & Habitat Enhancement
    ],
  },
  {
    // "record environmental observations... contributing real data to
    // NASA Earth-science research" (GLOBE Observer app: cloud cover,
    // land cover classification, tree measurements) — genuine
    // environmental-science data collection, not just outdoor activity.
    focus: "environmental_science",
    categoryScope: ["Environment"],
    includeIds: ["d3ea2e40-891b-41d2-9049-c0aff4ff5f05"], // GLOBE Observer Citizen Science Volunteer
  },
  {
    // The event's own initiative name is "Reinvesting in Aurora's Urban
    // Canopy for Social Equity and Climate Resilience" — climate
    // resilience is the program's own explicit framing, not an inferred
    // label for generic tree-planting/park cleanup.
    focus: "climate_sustainability",
    categoryScope: ["Environment"],
    includeIds: ["916a7940-e3a7-4815-870f-36a81a9702a6"], // Natural Helpers: Park Trash Cleanup and Stewardship Day at Montview Park
  },
  {
    // Preserve Park Steward Volunteer: "trail monitor," "maintaining
    // trailhead gates" across 35,000 acres of preserve/trail lands.
    // Core Volunteer / Trail Ambassador: an explicit Trail Ambassador
    // role across Maricopa County's regional park/trail system.
    focus: "parks_outdoor_stewardship",
    categoryScope: ["Environment"],
    includeIds: [
      "63a73cb9-af18-4239-acc7-da89a16a9bf0", // Preserve Park Steward Volunteer
      "31d39b61-20a4-40a4-9e99-d25d134dde66", // Core Volunteer / Trail Ambassador
    ],
  },
];

const knownFocuses = new Set(ALL_VALID_INTEREST_VALUES);
for (const rule of RULES) {
  if (!knownFocuses.has(rule.focus)) throw new Error(`Rule references unknown focus: ${rule.focus}`);
}

function textOf(row: Row): string {
  return `${row.title}\n${row.description ?? ""}`;
}

async function fetchAllApproved(): Promise<Row[]> {
  const PAGE_SIZE = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, category, title, description, interests_tags")
      .eq("review_status", "approved")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function main() {
  console.log(APPLY ? "APPLY MODE — will write to the database.\n" : "DRY RUN — no writes will be made.\n");

  const rows = await fetchAllApproved();
  console.log(`Fetched ${rows.length} approved opportunities.\n`);

  // opportunity id -> set of new focus tags to add
  const additions = new Map<string, Set<string>>();

  for (const rule of RULES) {
    const matches = rows.filter((row) => {
      if (rule.categoryScope && !rule.categoryScope.includes(row.category)) return false;
      if (rule.excludeIds?.includes(row.id)) return false;
      if (rule.includeIds) return rule.includeIds.includes(row.id);
      const text = rule.titleOnly ? row.title : textOf(row);
      if (rule.exclude?.some((re) => re.test(text))) return false;
      return (rule.include ?? []).some((re) => re.test(text));
    });

    const newOnes = matches.filter((r) => !(r.interests_tags ?? []).includes(rule.focus));
    console.log(`${rule.focus}: ${newOnes.length} new (${matches.length - newOnes.length} already tagged)`);
    for (const r of newOnes) {
      if (!additions.has(r.id)) additions.set(r.id, new Set());
      additions.get(r.id)!.add(rule.focus);
    }
  }

  const totalOpportunities = additions.size;
  const totalTagAdditions = [...additions.values()].reduce((sum, set) => sum + set.size, 0);
  console.log(`\n${totalOpportunities} opportunities affected, ${totalTagAdditions} total tag additions.`);

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write these changes.");
    return;
  }

  const beforeCount = rows.length;
  let updated = 0;
  for (const [id, newFocuses] of additions) {
    const row = rows.find((r) => r.id === id)!;
    const mergedTags = [...new Set([...(row.interests_tags ?? []), ...newFocuses])];
    const { error } = await supabase.from("opportunities").update({ interests_tags: mergedTags }).eq("id", id);
    if (error) {
      console.error(`FAILED to update ${id} (${row.title}): ${error.message}`);
      continue;
    }
    updated++;
  }
  console.log(`\nUpdated ${updated}/${totalOpportunities} opportunities.`);

  const { count: afterCount } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "approved");
  console.log(`Approved-opportunity count before: ${beforeCount}, after: ${afterCount} (must match).`);
  if (afterCount !== beforeCount) {
    console.error("MISMATCH — investigate immediately, this script should never change the approved count.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
