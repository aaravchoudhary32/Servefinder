// Shared labels/logic for manually curated and directory-only records
// (see ARCHITECTURE.md's "Manual source integration" section). Kept as
// pure functions so the badge text/logic lives in exactly one place,
// used by both the org detail page and /admin.

export type AvailabilityStatus = "open" | "seasonal" | "unverified" | "closed" | "paused" | "waitlisted";

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  open: "Active opportunity",
  seasonal: "Seasonal program",
  unverified: "Availability unverified",
  closed: "Applications closed",
  // "On hold" indefinitely, not tied to a normal seasonal cycle — e.g.
  // Banner-UMC Phoenix's teen program, paused due to application volume
  // with no stated reopen date.
  paused: "Temporarily on hold",
  waitlisted: "Waitlisted",
};

export const AVAILABILITY_STATUS_STYLES: Record<AvailabilityStatus, string> = {
  open: "bg-moss-light text-moss-dark border-moss/30",
  seasonal: "bg-marigold-light text-marigold-dark border-marigold/30",
  unverified: "bg-white text-ink/70 border-line",
  closed: "bg-line/40 text-ink/70 border-line",
  paused: "bg-line/40 text-ink/70 border-line",
  waitlisted: "bg-marigold-light text-marigold-dark border-marigold/30",
};

// A stable, low-schema-footprint way to distinguish a real apply/
// registration link from a contact-only pathway: no dedicated field for
// this, just whether the stored application_url is a mailto: link (an
// inbox to write to, not a form/portal to apply through). Every manual
// record's application_url was hand-picked with this distinction in
// mind — see lib/manualRecords.ts.
export function isContactOnlyLink(applicationUrl: string | null | undefined): boolean {
  return !!applicationUrl && applicationUrl.trim().toLowerCase().startsWith("mailto:");
}

export type ApplicationLinkLabel = "External application" | "Contact organization";

export function applicationLinkLabel(
  applicationUrl: string | null | undefined
): ApplicationLinkLabel | null {
  if (!applicationUrl) return null;
  return isContactOnlyLink(applicationUrl) ? "Contact organization" : "External application";
}

// The 8th requested badge, "Organization directory" — not a
// per-opportunity status, it's what a page shows for an organization
// with zero linked opportunities at all (see app/organizations/page.tsx
// and app/organizations/[id]/page.tsx).
export const ORGANIZATION_DIRECTORY_LABEL = "Organization directory";

// ---------- Biomedical/healthcare batch: program-type & compensation ----------
//
// All display-only — never used to filter or gate what a student sees or
// can apply to (see supabase/add_biomedical_program_fields.sql's header).
// The whole point of program_type/compensation existing is to stop a
// paid or tuition-based program from being mistaken for volunteering, or
// a volunteer role from being mistaken for an internship — shown to the
// student as plain context, same as age/schedule/commitment already are.

// "competition" added for the CS/Engineering/Robotics/Cybersecurity/
// Aerospace/Technology batch (Congressional App Challenge, CyberPatriot,
// NASA challenges, robotics competitions) — deliberately kept distinct
// from career_exploration_program: a competition is a judged, ranked,
// scored, or award-based event a student enters, not a program that
// exposes them to a profession. Never label competition participation
// as volunteering.
export type ProgramType =
  | "volunteering"
  | "internship"
  | "research_program"
  | "career_exploration_program"
  | "camp"
  | "club"
  | "competition";

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  volunteering: "Volunteering",
  internship: "Internship",
  research_program: "Research program",
  career_exploration_program: "Career exploration program",
  camp: "Camp",
  club: "Club",
  competition: "Competition",
};

export type Compensation = "unpaid" | "paid" | "tuition_based" | "not_specified";

export const COMPENSATION_LABELS: Record<Compensation, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  tuition_based: "Tuition-based",
  not_specified: "Not specified",
};

// Clinical-exposure disclosure fields render as "Yes"/"No" only when an
// official source explicitly stated it (a real boolean) — a null/
// undefined value means "not specified" and the field is omitted from
// display entirely rather than shown as a guessed "No."
export function yesNoLabel(value: boolean | null | undefined): "Yes" | "No" | null {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

// ---------- CS/Engineering batch: delivery mode ----------
//
// Distinguishes "this opportunity has a fixed physical location a
// student travels to" (in_person, the default — everything before this
// batch) from "no physical attendance is required at all" (virtual —
// Congressional App Challenge, Girls Who Code Pathways, CyberPatriot,
// and similar) or "a genuine remote-participation option exists
// alongside an in-person one" (hybrid — e.g. a challenge with both
// local event sites and an explicit global/virtual track).
//
// This is deliberately its own field, not inferred from missing
// latitude/longitude. A null coordinate can mean either "this opportunity
// doesn't need one" (virtual/hybrid) or "we don't know where this is"
// (a failed geocode, or a real address that just hasn't been entered
// yet) — those are opposite situations that used to be indistinguishable
// and were both silently excluded from ranked matching. delivery_mode
// makes the distinction real: only 'in_person' opportunities are ever
// subject to the distance hard filter (lib/matching.ts's isWithinRange),
// and an in_person opportunity with unresolved coordinates keeps being
// excluded exactly as before — never auto-promoted to virtual just
// because a location wasn't recorded. See lib/distance.ts's
// resolveDistanceMiles() for the (unchanged) distance-calculation half
// of this, and lib/manualRecords.ts for how each virtual/hybrid record
// in this batch was independently classified (never "it has an online
// application form," always "no physical attendance is required").
export type DeliveryMode = "in_person" | "virtual" | "hybrid";

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  in_person: "In person",
  virtual: "Virtual",
  hybrid: "Hybrid",
};

// ---------- Explore page: the one place "can a student apply right now"
// gets decided ----------
//
// Only 'open' means a student can actually act on it today. Every other
// status is real, discoverable information (that's the whole point of
// /explore) but never gets a strong "Apply" call to action — a student
// should always be able to tell, at a glance, whether clicking through
// leads to a real open application or just more information. Kept as its
// own tiny function (not inlined at each call site) so this rule can
// only ever be expressed one way, in one place.
export function canApplyNow(status: AvailabilityStatus): boolean {
  return status === "open";
}
