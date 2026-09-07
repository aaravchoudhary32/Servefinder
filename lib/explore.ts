// Pure helpers for app/explore/page.tsx — kept separate from the page
// component so they're unit-testable (this repo's vitest config only
// collects *.test.ts, no component-test infrastructure — see
// ARCHITECTURE.md's "Known trade-offs").

import type { AvailabilityStatus } from "./availabilityStatus";

export type ExploreSection = "open" | "seasonal" | "watch" | "closed";

// Groups the 6 availability_status values into the 4 sections /explore
// shows as separate headers. 'unverified'/'paused'/'waitlisted' share one
// "Programs to watch" section — all three mean the same thing to a
// student ("real program, not confirmed actionable right now"), just for
// different reasons the section's own per-card badge already spells out.
export function classifyExploreSection(status: AvailabilityStatus): ExploreSection {
  switch (status) {
    case "open":
      return "open";
    case "seasonal":
      return "seasonal";
    case "unverified":
    case "paused":
    case "waitlisted":
      return "watch";
    case "closed":
      return "closed";
  }
}

export const EXPLORE_SECTION_LABELS: Record<ExploreSection, string> = {
  open: "Open now",
  seasonal: "Upcoming or seasonal",
  watch: "Programs to watch",
  closed: "Closed",
};

// "Default to the safest useful view: open and upcoming records" — per
// the approved proposal, "Programs to watch" (unverified/paused/
// waitlisted) and "Closed" both start unselected; a student opts into
// either explicitly via the status filter.
export const DEFAULT_EXPLORE_STATUSES: AvailabilityStatus[] = ["open", "seasonal"];
