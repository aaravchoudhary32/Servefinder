// Canonical 3-level interest taxonomy: broad category -> optional
// major/career focus -> (separately, profiles.skills already covers
// activity/skill preferences). Replaces the old hand-copied
// STEM_SUBTAG_OPTIONS/BUSINESS_SUBTAG_OPTIONS + isStemSubtag/
// isBusinessSubtag pair-of-constants pattern with one data-driven
// structure covering all 10 broad categories, so adding a category
// means adding one array entry, not a new pair of hardcoded functions.
//
// Reconciliation history (why some old STEM/Business values aren't
// listed as their own canonical focus below) is in FOCUS_ALIASES and
// RETIRED_FOCUS_VALUES further down — read those before assuming a
// value was "forgotten."

export type FocusOption = { value: string; label: string };

export type CategoryTaxonomy = {
  broadTag: string;
  broadLabel: string;
  focuses: FocusOption[];
};

export const TAXONOMY: CategoryTaxonomy[] = [
  {
    broadTag: "stem",
    broadLabel: "STEM & Technology",
    focuses: [
      { value: "cs_software_engineering", label: "Computer Science & Software Engineering" },
      { value: "data_science_ai", label: "Data Science & Artificial Intelligence" },
      { value: "cybersecurity", label: "Cybersecurity" },
      { value: "electrical_computer_engineering", label: "Electrical & Computer Engineering" },
      { value: "mechanical_engineering", label: "Mechanical Engineering" },
      { value: "civil_engineering", label: "Civil Engineering" },
      { value: "environmental_engineering", label: "Environmental Engineering" },
      { value: "chemical_engineering", label: "Chemical Engineering" },
      { value: "chemistry", label: "Chemistry" },
      { value: "physics_astronomy", label: "Physics & Astronomy" },
      { value: "biology_biotechnology", label: "Biology & Biotechnology" },
      { value: "mathematics_statistics", label: "Mathematics & Statistics" },
      { value: "robotics", label: "Robotics" },
      { value: "aerospace_engineering", label: "Aerospace Engineering" },
      { value: "architecture_design_engineering", label: "Architecture & Design Engineering" },
      { value: "general_engineering", label: "General Engineering" },
    ],
  },
  {
    broadTag: "healthcare",
    broadLabel: "Healthcare & Wellness",
    focuses: [
      { value: "medicine_physician", label: "Medicine/Physician" },
      { value: "nursing", label: "Nursing" },
      { value: "dentistry", label: "Dentistry" },
      { value: "pharmacy", label: "Pharmacy" },
      { value: "veterinary_medicine", label: "Veterinary Medicine" },
      { value: "physical_therapy", label: "Physical Therapy" },
      { value: "occupational_therapy", label: "Occupational Therapy" },
      { value: "psychology_mental_health", label: "Psychology & Mental Health" },
      { value: "public_health", label: "Public Health" },
      { value: "biomedical_research", label: "Biomedical Research" },
      { value: "emergency_medicine_first_aid", label: "Emergency Medicine/First Aid" },
      { value: "nutrition_wellness", label: "Nutrition & Wellness" },
      { value: "healthcare_administration", label: "Healthcare Administration" },
    ],
  },
  {
    broadTag: "education",
    broadLabel: "Education & Mentoring",
    focuses: [
      { value: "early_childhood_education", label: "Early Childhood Education" },
      { value: "elementary_education", label: "Elementary Education" },
      { value: "secondary_education", label: "Secondary Education" },
      { value: "special_education", label: "Special Education" },
      { value: "literacy", label: "Literacy" },
      { value: "stem_education", label: "STEM Education" },
      { value: "college_career_readiness", label: "College & Career Readiness" },
      { value: "youth_mentoring", label: "Youth Mentoring" },
      { value: "educational_technology", label: "Educational Technology" },
    ],
  },
  {
    broadTag: "business",
    broadLabel: "Business & Entrepreneurship",
    focuses: [
      { value: "entrepreneurship", label: "Entrepreneurship" },
      { value: "finance", label: "Finance" },
      { value: "economics", label: "Economics" },
      { value: "marketing", label: "Marketing" },
      { value: "management_operations", label: "Management & Operations" },
      { value: "nonprofit_management", label: "Nonprofit Management" },
      { value: "human_resources", label: "Human Resources" },
      { value: "information_systems", label: "Information Systems" },
      { value: "event_planning", label: "Event Planning" },
      { value: "social_innovation", label: "Social Innovation" },
    ],
  },
  {
    broadTag: "environment",
    broadLabel: "Environment & Sustainability",
    focuses: [
      { value: "environmental_science", label: "Environmental Science" },
      { value: "conservation", label: "Conservation" },
      { value: "climate_sustainability", label: "Climate & Sustainability" },
      { value: "ecology", label: "Ecology" },
      { value: "marine_science", label: "Marine Science" },
      { value: "agriculture_food_systems", label: "Agriculture & Food Systems" },
      { value: "parks_outdoor_stewardship", label: "Parks & Outdoor Stewardship" },
      { value: "recycling_waste_reduction", label: "Recycling & Waste Reduction" },
    ],
  },
  {
    broadTag: "animals",
    broadLabel: "Animals & Wildlife",
    focuses: [
      { value: "veterinary_interests", label: "Veterinary Interests" },
      { value: "animal_shelters", label: "Animal Shelters" },
      { value: "wildlife_conservation", label: "Wildlife Conservation" },
      { value: "animal_welfare", label: "Animal Welfare" },
      { value: "zoology", label: "Zoology" },
      { value: "marine_wildlife", label: "Marine Wildlife" },
      { value: "animal_assisted_services", label: "Animal-Assisted Services" },
    ],
  },
  {
    broadTag: "community",
    broadLabel: "Community Service",
    focuses: [
      { value: "food_security", label: "Food Security" },
      { value: "housing_homelessness", label: "Housing & Homelessness" },
      { value: "disability_support", label: "Disability Support" },
      { value: "senior_support", label: "Senior Support" },
      { value: "youth_services", label: "Youth Services" },
      { value: "disaster_preparedness", label: "Disaster Preparedness" },
      { value: "immigrant_refugee_support", label: "Immigrant & Refugee Support" },
      { value: "community_development", label: "Community Development" },
      // "Faith-Based Service" deliberately excluded as a selectable
      // focus — a faith-based organization's opportunities can still
      // be listed and matched normally under this broad category;
      // religious affiliation just isn't something ServeFinder steers
      // matching by, unless an opportunity's own description genuinely
      // requires or describes it (that's ordinary description text a
      // student reads, not a taxonomy value).
    ],
  },
  {
    broadTag: "arts",
    broadLabel: "Arts, Media & Culture",
    focuses: [
      { value: "visual_arts", label: "Visual Arts" },
      { value: "music", label: "Music" },
      { value: "theater_performing_arts", label: "Theater & Performing Arts" },
      { value: "writing_journalism", label: "Writing & Journalism" },
      { value: "photography_film", label: "Photography & Film" },
      { value: "graphic_design", label: "Graphic Design" },
      { value: "museums_history", label: "Museums & History" },
      { value: "digital_media", label: "Digital Media" },
      { value: "social_media_communications", label: "Social Media & Communications" },
    ],
  },
  {
    broadTag: "government_law",
    broadLabel: "Government, Law & Advocacy",
    focuses: [
      { value: "law_legal_services", label: "Law & Legal Services" },
      { value: "government_public_administration", label: "Government & Public Administration" },
      { value: "public_policy", label: "Public Policy" },
      { value: "civic_engagement", label: "Civic Engagement" },
      { value: "human_rights", label: "Human Rights" },
      { value: "voter_education", label: "Voter Education" },
      { value: "international_relations", label: "International Relations" },
      { value: "criminal_justice", label: "Criminal Justice" },
      { value: "advocacy_community_organizing", label: "Advocacy & Community Organizing" },
    ],
  },
  {
    broadTag: "sports",
    broadLabel: "Sports & Recreation",
    focuses: [
      { value: "coaching", label: "Coaching" },
      { value: "youth_sports", label: "Youth Sports" },
      { value: "adaptive_sports", label: "Adaptive Sports" },
      { value: "recreation_programs", label: "Recreation Programs" },
      { value: "sports_management", label: "Sports Management" },
      { value: "event_support", label: "Event Support" },
      { value: "outdoor_recreation", label: "Outdoor Recreation" },
      { value: "health_fitness_education", label: "Health & Fitness Education" },
    ],
  },
];

// Old canonical-focus values that a real profile or opportunity may
// still carry, mapped to the new canonical value that replaces them.
// Resolution happens transparently at match time (see lib/matching.ts)
// — no existing profile or opportunity row is rewritten. An opportunity
// still tagged with the old value keeps matching exactly as if it
// carried the new one.
//
// `quantum_computing` -> `cs_software_engineering` (not
// `physics_astronomy`) is a deliberate evidence-based exception: the
// one existing opportunity carrying this tag ("Quantum Camp," a
// quantum-computing-specific program) is genuinely computing-focused,
// not general physics — confirmed by reading its actual description,
// not assumed from the tag name.
export const FOCUS_ALIASES: Record<string, string> = {
  computer_science: "cs_software_engineering",
  software_engineering: "cs_software_engineering",
  data_science: "data_science_ai",
  artificial_intelligence: "data_science_ai",
  computer_engineering: "electrical_computer_engineering",
  electrical_engineering: "electrical_computer_engineering",
  semiconductor_engineering: "electrical_computer_engineering",
  quantum_computing: "cs_software_engineering",
};

// Values that remain valid (a real profile still has one) but are no
// longer offered as a selectable focus in new onboarding/settings —
// retired as a *major/career focus* specifically, not deleted. Each
// still rolls up to its broad category for matching, same as before.
// `stem_leadership` -> "stem": a peer-elected STEM ambassador/
// leadership role isn't a subject-area major focus; the one existing
// opportunity carrying it ("Chief Science Officers") is genuinely a
// leadership/activity role, not a discipline-specific one — evidence
// confirmed, not assumed. Leadership as a general activity preference
// belongs in profiles.skills, not this taxonomy.
export const RETIRED_FOCUS_VALUES: Record<string, string> = {
  stem_leadership: "stem",
};

// Every focus value (current canonical, or a legacy/retired one) that
// this app has ever considered valid, resolved to the broad category
// tag it should roll up to for matching. Built once from TAXONOMY plus
// the two maps above rather than maintained as a separate hand-kept
// list — adding a category or focus to TAXONOMY is the only edit a
// future change needs to make.
const FOCUS_TO_BROAD_PARENT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const category of TAXONOMY) {
    for (const focus of category.focuses) {
      map[focus.value] = category.broadTag;
    }
  }
  for (const [oldValue, canonicalValue] of Object.entries(FOCUS_ALIASES)) {
    const parent = map[canonicalValue];
    if (parent) map[oldValue] = parent;
  }
  for (const [retiredValue, parent] of Object.entries(RETIRED_FOCUS_VALUES)) {
    map[retiredValue] = parent;
  }
  return map;
})();

// Resolves any known tag (current canonical focus, legacy alias, or
// retired value) to its canonical form for overlap comparisons —
// current canonical focuses and broad-category tags resolve to
// themselves. An unrecognized tag also resolves to itself, so an
// unknown value never throws; it just never rolls up to anything
// (matches lib/matching.ts's existing "no-op for anything it doesn't
// recognize" behavior).
export function resolveCanonicalFocus(tag: string): string {
  return FOCUS_ALIASES[tag] ?? tag;
}

// True for any focus value (canonical or legacy/retired) this app has
// ever considered a real subtag — i.e. it rolls up to some broad
// category. False for a broad-category tag itself or an unrecognized
// value.
export function isKnownFocus(tag: string): boolean {
  return tag in FOCUS_TO_BROAD_PARENT;
}

export function broadParentOf(tag: string): string | undefined {
  return FOCUS_TO_BROAD_PARENT[tag];
}

// Human-readable label for any known tag (broad category or focus,
// current canonical or legacy alias/retired value) — used to build
// accurate "why this matches" copy without hardcoding a second label
// list. Resolves through resolveCanonicalFocus first, so e.g.
// "computer_science" (a legacy alias) still resolves to "Computer
// Science & Software Engineering", not undefined. Returns undefined for
// a tag this app has never recognized.
const TAG_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const category of TAXONOMY) {
    map[category.broadTag] = category.broadLabel;
    for (const focus of category.focuses) {
      map[focus.value] = focus.label;
    }
  }
  return map;
})();

export function labelForTag(tag: string): string | undefined {
  return TAG_LABELS[tag] ?? TAG_LABELS[resolveCanonicalFocus(tag)];
}

// True when a tag (after resolving aliases) is a specific major/career
// focus rather than a broad-category tag itself — the distinction
// "why this matches" copy needs to avoid claiming focus-level alignment
// ("Matches your interest in Robotics") when only a broad-category
// signal ("STEM & Technology") actually exists.
export function isFocusValue(tag: string): boolean {
  const canonical = resolveCanonicalFocus(tag);
  return TAXONOMY.some((c) => c.focuses.some((f) => f.value === canonical));
}

const BROAD_TAGS = new Set(TAXONOMY.map((c) => c.broadTag));

// Splits a raw profiles.interests array (which may carry legacy alias
// spellings like "computer_science" or a retired value like
// "stem_leadership" from before this taxonomy existed) into what a
// profile editor (Settings, onboarding) can present as checkboxes, plus
// whatever it can't display — which the caller should carry through
// untouched on save rather than silently drop. This is what keeps
// editing a profile from being a trap that quietly deletes an old
// selection the picker doesn't have a button for.
export function splitInterestTags(raw: string[]): { broad: string[]; focus: string[]; other: string[] } {
  const broad: string[] = [];
  const focus: string[] = [];
  const other: string[] = [];
  for (const tag of raw) {
    if (BROAD_TAGS.has(tag)) {
      broad.push(tag);
      continue;
    }
    const canonical = resolveCanonicalFocus(tag);
    if (isFocusValue(canonical)) {
      focus.push(canonical);
    } else {
      // Retired (e.g. stem_leadership) or otherwise unrecognized —
      // preserved as-is, never shown as a selectable option.
      other.push(tag);
    }
  }
  return { broad, focus: [...new Set(focus)], other };
}

// Every valid interest-tag value this app has ever accepted from a
// student profile — current canonical focuses, all 10 broad-category
// tags, plus every legacy alias/retired value. This is exactly the
// set supabase/schema.sql's `profiles.interests` CHECK constraint
// must allow; see supabase/add_canonical_focus_taxonomy.sql.
export const ALL_VALID_INTEREST_VALUES: string[] = [
  ...new Set([
    ...TAXONOMY.map((c) => c.broadTag),
    ...TAXONOMY.flatMap((c) => c.focuses.map((f) => f.value)),
    ...Object.keys(FOCUS_ALIASES),
    ...Object.keys(RETIRED_FOCUS_VALUES),
  ]),
];
