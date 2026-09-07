// CSV opportunity import for organizations (app/org-dashboard/page.tsx's
// CsvImportPanel) — the 8th ingestion "source," UI-triggered instead of
// cron-triggered, sharing normalize.ts's dedup/normalization pipeline
// with the 7 scraped sources rather than reinventing it.
//
// The template's column headers are deliberately NOT chosen to match
// normalizeListing()'s internal field-name candidates (e.g. "title",
// "minimum_age") — human-friendly headers like "Minimum Age" instead.
// That's safe for the fields normalizeListing() genuinely does
// structured pass-through for (title/description/location/latitude/
// longitude/application_deadline/external_id/category — confirmed by
// reading normalize.ts directly, not assumed), but five fields turned
// out NOT to have a real structured pass-through path at all:
//
// - minimum_age is always regex-extracted from free text (patterns like
//   "must be 13", "13+", "13 years old") — a bare numeric string like
//   "13" matches none of them and would silently fall back to the
//   default (13), wrong for any other age.
// - commitment_type is regex-inferred too — "recurring" happens to
//   match one of the patterns and "one_time" happens to hit the
//   fallback default, but that's a coincidence of those two exact
//   strings, not a real structured field.
// - schedule_slots/interests_tags/skills_required only ever accept an
//   already-a-JS-array value (`Array.isArray()`), never a delimited
//   string — a parsed CSV cell is always a string, so these fields
//   would silently fall through to (mostly empty) free-text inference
//   over the title+description regardless of what the CSV actually says.
//
// So this module parses and validates those five fields itself and
// sets them directly on normalizeListing()'s output afterward — the
// same "call normalizeListing for what it's good at, then override
// specific fields with better source data" pattern the scraped sources
// already use for geocoded coordinates (e.g. vbspca.ts sets
// `normalized.latitude` directly after the call).

import Papa from "papaparse";
import { CATEGORY_OPTIONS } from "@/lib/constants";
import type { RawListing } from "./normalize";

export const CSV_HEADERS = [
  "Title",
  "Description",
  "Category",
  "Minimum Age",
  "Location",
  "Latitude",
  "Longitude",
  "Schedule Slots",
  "Interest Tags",
  "Skills Required",
  "Commitment Type",
  "Application Deadline",
  "External ID",
] as const;

const REQUIRED_HEADERS: (typeof CSV_HEADERS)[number][] = [
  "Title",
  "Description",
  "Category",
  "Minimum Age",
  "Commitment Type",
];

// Same bounds normalize.ts's own free-text age extraction uses, for
// consistency between the two ingestion paths.
const PLAUSIBLE_AGE_RANGE: [number, number] = [5, 25];

const COMMITMENT_TYPES = ["one_time", "recurring"] as const;
type CommitmentType = (typeof COMMITMENT_TYPES)[number];

const EXAMPLE_ROW: Record<(typeof CSV_HEADERS)[number], string> = {
  Title: "Weekend Park Cleanup",
  Description: "Help clear litter and invasive plants along the river trail.",
  Category: "Environment",
  "Minimum Age": "13",
  Location: "123 Main St, Phoenix, AZ",
  Latitude: "33.4484",
  Longitude: "-112.0740",
  "Schedule Slots": "saturday_morning",
  "Interest Tags": "environment",
  "Skills Required": "",
  "Commitment Type": "one_time",
  "Application Deadline": "",
  "External ID": "",
};

/** The downloadable template: header row + one example row, correctly quoted. */
export function generateCsvTemplate(): string {
  return Papa.unparse({
    fields: [...CSV_HEADERS],
    data: [CSV_HEADERS.map((h) => EXAMPLE_ROW[h])],
  });
}

function splitArrayField(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

export type CsvRowResult =
  | { status: "invalid"; errors: string[] }
  | {
      status: "valid";
      raw: RawListing; // -> normalizeListing() for title/description/location/lat/lng/deadline/category/external_id
      overrides: {
        minimum_age: number;
        commitment_type: CommitmentType;
        schedule_slots: string[];
        interests_tags: string[];
        skills_required: string[];
      };
    };

/** Validates and parses one already-header-mapped CSV row. Pure — no I/O. */
export function parseCsvRow(row: Record<string, string>): CsvRowResult {
  const errors: string[] = [];
  const get = (header: (typeof CSV_HEADERS)[number]) => row[header]?.trim() ?? "";

  for (const header of REQUIRED_HEADERS) {
    if (!get(header)) errors.push(`${header} is required`);
  }

  const category = get("Category");
  const matchedCategory = CATEGORY_OPTIONS.find((c) => c.toLowerCase() === category.toLowerCase());
  if (category && !matchedCategory) {
    errors.push(`Category "${category}" is not one of: ${CATEGORY_OPTIONS.join(", ")}`);
  }

  const commitmentRaw = get("Commitment Type");
  const commitmentType = COMMITMENT_TYPES.find((c) => c === commitmentRaw);
  if (commitmentRaw && !commitmentType) {
    errors.push(`Commitment Type "${commitmentRaw}" must be exactly one of: ${COMMITMENT_TYPES.join(", ")}`);
  }

  const ageRaw = get("Minimum Age");
  const age = Number(ageRaw);
  const ageValid = ageRaw !== "" && Number.isFinite(age) && age >= PLAUSIBLE_AGE_RANGE[0] && age <= PLAUSIBLE_AGE_RANGE[1];
  if (ageRaw && !ageValid) {
    errors.push(`Minimum Age "${ageRaw}" must be a number between ${PLAUSIBLE_AGE_RANGE[0]} and ${PLAUSIBLE_AGE_RANGE[1]}`);
  }

  for (const header of ["Latitude", "Longitude"] as const) {
    const value = get(header);
    if (value && !Number.isFinite(Number(value))) {
      errors.push(`${header} "${value}" is not a number`);
    }
  }

  if (errors.length > 0) return { status: "invalid", errors };

  return {
    status: "valid",
    raw: {
      Title: get("Title"),
      Description: get("Description"),
      Category: matchedCategory,
      Location: get("Location") || undefined,
      Latitude: get("Latitude") || undefined,
      Longitude: get("Longitude") || undefined,
      "Application Deadline": get("Application Deadline") || undefined,
      "External ID": get("External ID") || undefined,
    },
    overrides: {
      minimum_age: age,
      commitment_type: commitmentType as CommitmentType,
      schedule_slots: splitArrayField(get("Schedule Slots")),
      interests_tags: splitArrayField(get("Interest Tags")),
      skills_required: splitArrayField(get("Skills Required")),
    },
  };
}

export type ParsedCsvFile = {
  headerErrors: string[];
  rows: Record<string, string>[];
};

const MAX_ROWS = 200;

/** Parses raw CSV file text into header-mapped rows, checking the header row itself before any per-row validation. */
export function parseCsvFile(fileText: string): ParsedCsvFile {
  const result = Papa.parse<Record<string, string>>(fileText, { header: true, skipEmptyLines: true });
  const headerErrors: string[] = [];

  const actualHeaders = result.meta.fields ?? [];
  for (const required of REQUIRED_HEADERS) {
    if (!actualHeaders.includes(required)) {
      headerErrors.push(`Missing required column: "${required}"`);
    }
  }

  if (result.data.length > MAX_ROWS) {
    headerErrors.push(`This file has ${result.data.length} rows — imports are capped at ${MAX_ROWS} at a time.`);
  }

  return { headerErrors, rows: headerErrors.length > 0 ? [] : result.data };
}
