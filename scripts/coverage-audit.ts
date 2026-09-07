// Read-only coverage audit for the canonical taxonomy. Fetches every
// approved opportunity (anon-scoped, RLS-respecting — same view a real
// visitor gets) and reports, per broad category and per canonical
// focus: opportunity count, distinct source-organization count,
// Arizona-vs-virtual split, age range, and availability_status
// breakdown. Alias-aware: an opportunity still carrying a legacy tag
// (e.g. "computer_science") counts toward its canonical focus
// ("Computer Science & Software Engineering") automatically — no
// opportunity row needs to be rewritten for its coverage to count.
//
// Coverage tiers (revised 2026-09-05 — 5-7 distinct sources is an ideal
// for high-demand focuses, not a launch requirement for every one of
// the ~106 narrow specialties; forcing that target everywhere would
// mean fabricating or padding weak/duplicate listings just to hit a
// number, which this project explicitly refuses to do):
//   Tier A: 5+ distinct verified sources
//   Tier B: 2-4 distinct verified sources
//   Tier C: exactly 1 distinct verified source
//   Tier D: 0 — relies entirely on broad-category fallback matching
// A focus with no direct match still gets a real, honest match via
// lib/matching.ts's rollup to its broad category — Tier D is not
// "broken," it's "not yet specifically covered." See HIGH_DEMAND_FOCUSES
// below for which Tier C/D focuses are worth prioritizing first.
//
// Methodology, disclosed plainly rather than left implicit:
// - "Arizona in-person" = opportunity's `location` text contains ", AZ"
//   (this app's address strings are consistently formatted
//   "<street>, <city>, AZ <zip>" — confirmed by inspection of real
//   rows) AND delivery_mode is not 'virtual'.
// - "Virtual/nationwide" = delivery_mode is 'virtual', OR no location
//   contains an AZ marker.
// - "Distinct sources" = distinct organization_id, per the audit
//   instructions' explicit distinction from raw listing count.
//
// Run with: npx tsx scripts/coverage-audit.ts
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../tests/loadEnv";
import { TAXONOMY, resolveCanonicalFocus, broadParentOf } from "../lib/interestTaxonomy";
import { CATEGORY_TAG_MAP } from "../lib/constants";

loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  id: string;
  category: string;
  interests_tags: string[];
  organization_id: string | null;
  location: string | null;
  delivery_mode: string | null;
  minimum_age: number;
  availability_status: string;
  commitment_type: string;
};

async function fetchAllApproved(): Promise<Row[]> {
  const PAGE_SIZE = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("opportunities")
      .select(
        "id, category, interests_tags, organization_id, location, delivery_mode, minimum_age, availability_status, commitment_type"
      )
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Focuses a typical high-school student is relatively likely to select,
// based on well-established common-major/career-interest popularity
// (not this app's own usage data, which doesn't yet exist at meaningful
// volume) — used only to prioritize which Tier C/D gaps to research
// next, never to change matching behavior. Intentionally a judgment
// call, revisited as real usage data becomes available.
const HIGH_DEMAND_FOCUSES = new Set([
  "medicine_physician", "nursing", "psychology_mental_health", "biology_biotechnology",
  "veterinary_medicine", "public_health",
  "cs_software_engineering", "data_science_ai", "cybersecurity", "general_engineering",
  "mechanical_engineering", "electrical_computer_engineering", "civil_engineering",
  "entrepreneurship", "marketing", "finance",
  "criminal_justice",
  "visual_arts", "digital_media",
  "literacy", "youth_mentoring",
  "animal_shelters", "wildlife_conservation",
  "coaching",
]);

type Tier = "A" | "B" | "C" | "D";
function tierFor(distinctSources: number): Tier {
  if (distinctSources >= 5) return "A";
  if (distinctSources >= 2) return "B";
  if (distinctSources === 1) return "C";
  return "D";
}

function isArizonaInPerson(row: Row): boolean {
  if ((row.delivery_mode ?? "in_person") === "virtual") return false;
  return (row.location ?? "").includes(", AZ");
}

type FocusSummary = { name: string; value: string | null; tier: Tier; sources: number; opportunities: number; highDemand: boolean };
const summaries: FocusSummary[] = [];

function report(name: string, matches: Row[], focusValue: string | null = null) {
  const orgIds = new Set(matches.map((r) => r.organization_id).filter(Boolean));
  const az = matches.filter(isArizonaInPerson).length;
  const virtual = matches.length - az;
  const ages = matches.map((r) => r.minimum_age);
  const minAge = ages.length ? Math.min(...ages) : null;
  const maxAge = ages.length ? Math.max(...ages) : null;
  const statusCounts: Record<string, number> = {};
  for (const r of matches) statusCounts[r.availability_status] = (statusCounts[r.availability_status] ?? 0) + 1;
  const recurring = matches.filter((r) => r.commitment_type === "recurring").length;
  const tier = tierFor(orgIds.size);
  const highDemand = focusValue !== null && HIGH_DEMAND_FOCUSES.has(focusValue);

  if (focusValue !== null) {
    summaries.push({ name, value: focusValue, tier, sources: orgIds.size, opportunities: matches.length, highDemand });
  }

  console.log(`${name}: [Tier ${tier}]${highDemand ? " [HIGH-DEMAND]" : ""}`);
  console.log(`  Opportunities: ${matches.length} | Distinct sources: ${orgIds.size}`);
  console.log(`  AZ in-person: ${az} | Virtual/other: ${virtual}`);
  console.log(`  Age range: ${minAge ?? "n/a"}-${maxAge ?? "n/a"}`);
  console.log(`  Status: ${JSON.stringify(statusCounts)} | Recurring: ${recurring}/${matches.length}`);
}

// Alias-aware match: an opportunity's tag list counts toward a
// canonical focus if it carries that focus directly OR a legacy tag
// that resolves to it.
function tagsIncludeCanonical(tags: string[], canonicalValue: string): boolean {
  return (tags ?? []).some((t) => resolveCanonicalFocus(t) === canonicalValue);
}

// Broad-category rollup: an opportunity counts toward a broad category if
// it carries that broad tag directly OR any focus (canonical or legacy)
// that rolls up to it — same rollup lib/matching.ts uses at match time.
// Checking only the literal broad tag undercounts categories where every
// opportunity was tagged with a specific focus but never the broad tag
// itself (this caught Government, Law & Advocacy showing 0 opportunities
// despite Criminal Justice/Civic Engagement having real coverage).
function tagsRollUpToBroad(tags: string[], broadTag: string): boolean {
  return (tags ?? []).some((t) => broadParentOf(resolveCanonicalFocus(t)) === broadTag);
}

async function main() {
  console.log("Fetching all approved opportunities (anon-scoped)...\n");
  const rows = await fetchAllApproved();
  console.log(`Total approved: ${rows.length}\n`);

  for (const category of TAXONOMY) {
    const label = Object.entries(CATEGORY_TAG_MAP).find(([, tag]) => tag === category.broadTag)?.[0] ?? category.broadLabel;
    console.log(`\n########## ${category.broadLabel} ##########\n`);
    const broadMatches = rows.filter((r) => r.category === label || tagsRollUpToBroad(r.interests_tags, category.broadTag));
    report(`[Broad category] ${category.broadLabel}`, broadMatches);
    console.log("");

    for (const focus of category.focuses) {
      const matches = rows.filter((r) => tagsIncludeCanonical(r.interests_tags, focus.value));
      report(focus.label, matches, focus.value);
      console.log("");
    }
  }

  const tierCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const s of summaries) tierCounts[s.tier]++;
  console.log("\n########## Coverage tier summary ##########\n");
  console.log(
    `Tier A (5+ sources): ${tierCounts.A} | Tier B (2-4): ${tierCounts.B} | Tier C (1): ${tierCounts.C} | Tier D (0, fallback-only): ${tierCounts.D}`
  );

  const priority = summaries
    .filter((s) => s.highDemand && (s.tier === "C" || s.tier === "D"))
    .sort((a, b) => (a.tier === b.tier ? a.sources - b.sources : a.tier === "D" ? -1 : 1));
  console.log(`\nPriority research targets — high-demand focuses still in Tier C/D (${priority.length}):`);
  for (const s of priority) {
    console.log(`  [Tier ${s.tier}] ${s.name} — ${s.sources} source(s), ${s.opportunities} opportunity(ies)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
