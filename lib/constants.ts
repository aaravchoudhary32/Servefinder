// Distance is a hard filter in lib/matching.ts (isWithinRange), not just a
// scoring factor — so the student-set max travel radius itself needs a
// sane ceiling too, or a student could set an unrealistic number (e.g.
// "500 miles") that defeats the point of the filter. 50 miles is roughly
// an hour's drive, the same real-world constraint the hard filter exists
// to encode.
export const MAX_DISTANCE_MILES_CAP = 50;

export const CATEGORY_OPTIONS = [
  "STEM",
  "Environment",
  "Healthcare",
  "Education",
  "Animals",
  "Arts & Culture",
  "Community Service",
  "Sports & Rec",
  "Business & Entrepreneurship",
];

export const COMMITMENT_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "recurring", label: "Recurring" },
] as const;

// Maps each display category to its lowercase interest-tag slug (used by
// TagSelect/admin tag pickers and the ingestion normalizer alike).
export const CATEGORY_TAG_MAP: Record<string, string> = {
  STEM: "stem",
  Environment: "environment",
  Healthcare: "healthcare",
  Education: "education",
  Animals: "animals",
  "Arts & Culture": "arts",
  "Community Service": "community",
  "Sports & Rec": "sports",
  "Business & Entrepreneurship": "business",
};
