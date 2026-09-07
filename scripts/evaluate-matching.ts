// Read-only matching-quality evaluation against the real, live catalog
// (product-readiness audit, Phase 3). Never writes anything — only
// reads `opportunities` with the anon key (same RLS-scoped view a real
// student's browser gets) and runs the exact ranking functions
// students' own sessions call.
//
// Run with: npx tsx scripts/evaluate-matching.ts
//
// This exists because the 64 existing unit tests in lib/matching.test.ts
// already prove the hard filters and scoring formula are correct
// against synthetic fixtures — what they can't show is how matching
// actually behaves against the real catalog's real geographic and
// categorical distribution (e.g. "does a rural or out-of-state student
// get anything useful back at all?"). Both kinds of testing matter;
// this script is the second kind, not a replacement for the first.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../tests/loadEnv";
import { rankOpportunities, type Opportunity, type StudentProfile } from "../lib/matching";
import { resolveDistanceMiles } from "../lib/distance";
import type { DeliveryMode } from "../lib/availabilityStatus";

loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  id: string;
  title: string;
  minimum_age: number;
  category: string;
  interests_tags: string[];
  skills_required: string[];
  schedule_slots: string[];
  latitude: number | null;
  longitude: number | null;
  delivery_mode: DeliveryMode | null;
  commitment_type: "one_time" | "recurring";
  embedding: number[] | null;
};

async function fetchAllOpenOpportunities(): Promise<Row[]> {
  const PAGE_SIZE = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("opportunities")
      .select(
        "id, title, minimum_age, category, interests_tags, skills_required, schedule_slots, latitude, longitude, delivery_mode, commitment_type, embedding"
      )
      .eq("availability_status", "open")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

type NamedProfile = { name: string; coords: { lat: number; lng: number } | null; profile: StudentProfile };

// Real coordinates (not fabricated) for each named location, matching
// this app's own precedent for test coordinates (tests/e2e/student-workflow.spec.ts
// uses 33.704,-112.3518 for ZIP 85001, confirmed live against
// api.zippopotam.us — reused verbatim here for the "Phoenix" profile).
const PROFILES: NamedProfile[] = [
  {
    name: "Age 13, Phoenix, broad interests, 10mi",
    coords: { lat: 33.704, lng: -112.3518 },
    profile: {
      age: 13,
      interests: ["stem", "environment", "community", "education", "animals"],
      skills: [],
      availability: ["saturday_morning", "weekday_evening"],
      maxDistanceMiles: 10,
      commitmentPreference: "either",
    },
  },
  {
    name: "Age 16, Phoenix, narrow interest (STEM only), 15mi, recurring only",
    coords: { lat: 33.704, lng: -112.3518 },
    profile: {
      age: 16,
      interests: ["stem"],
      skills: ["coding"],
      availability: ["weekday_evening"],
      maxDistanceMiles: 15,
      commitmentPreference: "recurring",
    },
  },
  {
    name: "Age 18, Phoenix, broad interests, 25mi",
    coords: { lat: 33.704, lng: -112.3518 },
    profile: {
      age: 18,
      interests: ["healthcare", "community", "education"],
      skills: [],
      availability: ["weekday_evening", "weekend"],
      maxDistanceMiles: 25,
      commitmentPreference: "either",
    },
  },
  {
    // Window Rock, AZ — genuinely rural, ~325mi from Phoenix, real coords.
    name: "Age 15, rural AZ (Window Rock), broad interests, 25mi",
    coords: { lat: 35.6805, lng: -109.0523 },
    profile: {
      age: 15,
      interests: ["stem", "environment", "community", "education", "animals", "arts"],
      skills: [],
      availability: ["saturday_morning", "weekday_evening", "weekend"],
      maxDistanceMiles: 25,
      commitmentPreference: "either",
    },
  },
  {
    // Chicago, IL — real coords, genuinely out of this catalog's
    // current (AZ-concentrated) in-person coverage area.
    name: "Age 14, out-of-state (Chicago), broad interests, 20mi",
    coords: { lat: 41.8781, lng: -87.6298 },
    profile: {
      age: 14,
      interests: ["stem", "environment", "community", "education", "animals"],
      skills: [],
      availability: ["saturday_morning"],
      maxDistanceMiles: 20,
      commitmentPreference: "either",
    },
  },
  {
    // No coords at all — simulates a student whose ZIP/city never
    // geocoded. In-person opportunities become unresolvable-distance
    // (excluded); virtual ones are exempt from the distance filter
    // entirely (see lib/distance.ts's header comment).
    name: "Age 17, no resolved location (virtual-only in practice), broad interests",
    coords: null,
    profile: {
      age: 17,
      interests: ["stem", "environment", "community", "education", "animals", "business"],
      skills: [],
      availability: ["weekday_evening", "weekend", "saturday_morning"],
      maxDistanceMiles: 15,
      commitmentPreference: "either",
    },
  },
];

function toOpportunity(row: Row, coords: { lat: number; lng: number } | null): Opportunity {
  return {
    id: row.id,
    title: row.title,
    minimumAge: row.minimum_age,
    category: row.category,
    interestsTags: row.interests_tags ?? [],
    skillsRequired: row.skills_required ?? [],
    scheduleSlots: row.schedule_slots ?? [],
    distanceMiles: resolveDistanceMiles(coords, { latitude: row.latitude, longitude: row.longitude }),
    deliveryMode: row.delivery_mode ?? undefined,
    commitmentType: row.commitment_type,
    descriptionEmbedding: row.embedding ?? undefined,
  };
}

async function main() {
  console.log("Fetching live catalog (anon-scoped, open opportunities only)...");
  const rows = await fetchAllOpenOpportunities();
  console.log(`Fetched ${rows.length} open opportunities.\n`);

  let totalEligibilityViolations = 0;
  let totalDistanceViolations = 0;
  let totalRanked = 0;
  const noResultProfiles: string[] = [];

  for (const { name, coords, profile } of PROFILES) {
    const opportunities = rows.map((r) => toOpportunity(r, coords));
    const classic = rankOpportunities(profile, opportunities);
    // Semantic mode needs a computed student-embedding (the ONNX model
    // in lib/embeddings/embed.ts, only ever run server-side/on-demand
    // in the real app) — not pulled into this script; classic (tag-
    // based) ranking is the default matchMode real students see, and
    // it's what this evaluation's hard-constraint checks apply to.
    // Reported here only as a coverage figure, not separately ranked.
    const semanticEligibleCount = opportunities.filter((o) => o.descriptionEmbedding).length;

    // Eligibility violation rate: any ranked result whose minimumAge
    // exceeds the student's age, or whose resolved distance exceeds
    // maxDistanceMiles for a non-virtual/hybrid opportunity. Should
    // always be exactly 0 — these are meant to be hard filters, not
    // soft-scored factors. A non-zero count here would be a real bug.
    const eligibilityViolations = classic.filter((r) => r.opportunity.minimumAge > profile.age).length;
    const distanceViolations = classic.filter((r) => {
      const requiresInPerson = (r.opportunity.deliveryMode ?? "in_person") === "in_person";
      return requiresInPerson && r.opportunity.distanceMiles !== null && r.opportunity.distanceMiles > profile.maxDistanceMiles;
    }).length;

    totalEligibilityViolations += eligibilityViolations;
    totalDistanceViolations += distanceViolations;
    totalRanked += classic.length;

    const top5 = classic.slice(0, 5);
    const top10Categories = new Set(classic.slice(0, 10).map((r) => r.opportunity.category));
    // "Obvious irrelevance" proxy: a top-5 result sharing none of the
    // student's stated interest tags (case-insensitive) with the
    // opportunity's own interest tags or category. Not a perfect
    // semantic judgment — a cheap, mechanical check for the clearest
    // failure mode (a completely unrelated category ranked highly).
    const studentInterests = new Set(profile.interests.map((i) => i.toLowerCase()));
    const obviouslyIrrelevant = top5.filter((r) => {
      const oppTags = new Set([r.opportunity.category.toLowerCase(), ...r.opportunity.interestsTags.map((t) => t.toLowerCase())]);
      return ![...studentInterests].some((i) => oppTags.has(i));
    }).length;

    if (classic.length === 0) noResultProfiles.push(name);

    console.log(`--- ${name} ---`);
    console.log(`  Classic-ranked results: ${classic.length} (of ${opportunities.length} in-catalog)`);
    console.log(`  Opportunities with an embedding (semantic-mode eligible): ${semanticEligibleCount}`);
    console.log(`  Eligibility violations (age): ${eligibilityViolations}`);
    console.log(`  Distance violations (in-person, over max): ${distanceViolations}`);
    console.log(`  Top-5 "obviously irrelevant" (no shared interest/category): ${obviouslyIrrelevant}/${top5.length}`);
    console.log(`  Category diversity in top 10: ${top10Categories.size} distinct categories`);
    if (top5.length > 0) {
      console.log(`  Top match: "${top5[0].opportunity.title}" (score ${top5[0].score}, category: ${top5[0].opportunity.category})`);
    }
    console.log("");
  }

  console.log("=== Summary across all profiles ===");
  console.log(`Total ranked results across all profiles: ${totalRanked}`);
  console.log(`Eligibility violation rate: ${totalEligibilityViolations}/${totalRanked} (must be 0)`);
  console.log(`Distance violation rate: ${totalDistanceViolations}/${totalRanked} (must be 0)`);
  console.log(`Profiles with zero results: ${noResultProfiles.length > 0 ? noResultProfiles.join(", ") : "none"}`);

  if (totalEligibilityViolations > 0 || totalDistanceViolations > 0) {
    console.error("\nFAIL: hard eligibility constraints were violated against real catalog data.");
    process.exit(1);
  }
  console.log("\nPASS: no hard eligibility or distance violations against the live catalog.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
