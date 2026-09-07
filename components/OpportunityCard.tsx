"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import MatchStamp from "./MatchStamp";
import { ThumbsUpIcon, ThumbsDownIcon } from "./icons";
import ReportIssueModal from "./ReportIssueModal";
import ViewDetailsToggle from "./ViewDetailsToggle";
import OpportunityEligibilityBadges from "./OpportunityEligibilityBadges";
import OpportunityDetailsPanel from "./OpportunityDetailsPanel";
import { daysUntil, deadlineLabel, deadlineBadgeClass } from "@/lib/dates";
import {
  ProgramType,
  Compensation,
  DeliveryMode,
  DELIVERY_MODE_LABELS,
} from "@/lib/availabilityStatus";

type Breakdown = {
  interestFit: number;
  scheduleFit: number;
  distanceFit: number;
  skillFit: number;
  commitmentFit: number;
};

type InterestMatch = {
  level: "focus" | "broad" | "rollup" | "none";
  labels: string[];
};

// Renders nothing for "none" (a student with no interests selected, or
// genuine non-overlap, should never see a fabricated or negative-sounding
// claim). Only "focus" — a shared specific major/career focus tag —
// earns the confident "Matches your interest in X" claim. "broad" (an
// exact shared broad-category tag, e.g. both sides just say "stem") and
// "rollup" (an inferred hierarchy connection, no shared tag at all) are
// deliberately given the SAME softer "Related to your interest in X"
// phrasing: neither one is a direct focus match, so neither should read
// as more specific than "this is in the same broad field" — a generic
// hospital/library/STEM/nonprofit role tagged only with a broad category
// must never be described as matching a specific career focus it was
// never actually classified into.
function interestMatchSentence(match: InterestMatch | undefined): string | null {
  if (!match || match.labels.length === 0) return null;
  const joined = match.labels.slice(0, 2).join(" and ");
  if (match.level === "focus") return `Matches your interest in ${joined}`;
  if (match.level === "broad" || match.level === "rollup") return `Related to your interest in ${joined}`;
  return null;
}

export type MatchFeedbackReason =
  | "wrong_category"
  | "too_far"
  | "schedule_conflict"
  | "age_mismatch"
  | "other";

const REASON_OPTIONS: { value: MatchFeedbackReason; label: string }[] = [
  { value: "wrong_category", label: "Wrong category" },
  { value: "too_far", label: "Too far" },
  { value: "schedule_conflict", label: "Schedule conflict" },
  { value: "age_mismatch", label: "Age requirement" },
  { value: "other", label: "Other" },
];

type Props = {
  // Only present for a real, persisted opportunity — the homepage's
  // fabricated sample-match cards and any other purely illustrative
  // usage simply omit this, which is what gates both the "Last
  // verified" line and the "Report an issue" trigger below (can't
  // report or date-check something with no real record).
  id?: string;
  title: string;
  description?: string | null;
  org: string;
  orgId?: string | null;
  lastVerifiedAt?: string | null;
  distance: string;
  schedule: string;
  minAge: number;
  category: string;
  matchScore: number;
  breakdown: Breakdown;
  interestMatch?: InterestMatch;
  applicationDeadline?: string | null;
  interestFitLabel?: string; // e.g. "Interest (semantic)" vs "Interest (tags)"
  comparison?: { label: string; score: number } | null; // the other mode's score, shown side by side
  // undefined/null = not rated yet. Card stays presentational/callback-driven
  // (no Supabase calls of its own) — the parent owns persistence, same as
  // the Save/status buttons rendered alongside this card.
  feedbackGiven?: boolean | null;
  onFeedback?: (helpful: boolean, reason?: MatchFeedbackReason) => void;
  location?: string | null;
  // A real per-listing apply link is rarer than a source_url (most
  // scraped sites don't have one distinct from the listing page
  // itself) — applicationUrl wins when present since it's the more
  // specific, actionable link; sourceUrl is the fallback. Which one
  // was actually used determines the label below, so a source_url
  // (just "here's the original listing") is never mislabeled as an
  // "Apply" link.
  applicationUrl?: string | null;
  sourceUrl?: string | null;
  deliveryMode?: DeliveryMode | null;
  programType?: ProgramType | null;
  compensation?: Compensation | null;
  cost?: string | null;
  financialAidAvailable?: boolean | null;
  eligibleGrades?: string | null;
  timeCommitment?: string | null;
  arizonaResidencyRequired?: boolean | null;
  parentalConsentRequired?: boolean | null;
  healthScreeningRequired?: boolean | null;
  backgroundCheckRequired?: boolean | null;
  directPatientContact?: boolean | null;
  researchComponent?: boolean | null;
  shadowingComponent?: boolean | null;
  // Rendered above the category tag — e.g. dashboard's "Not recently
  // verified" / "Not yet indexed" flags. Kept as a slot rather than more
  // boolean props since the parent already knows exactly when to show
  // these and what they should say.
  topBadges?: ReactNode;
  // Rendered in the card's right-hand action column — the Save button
  // or, once applied, the status badge + advance/remove buttons. A
  // slot (not boolean/callback props for every possible application
  // state) because the parent (dashboard) already owns that state
  // machine in full; duplicating it here would be the same logic in
  // two places.
  actions?: ReactNode;
};

const BREAKDOWN_ROWS: { key: keyof Breakdown; label: string }[] = [
  { key: "interestFit", label: "Interest" },
  { key: "scheduleFit", label: "Schedule" },
  { key: "distanceFit", label: "Distance" },
  { key: "skillFit", label: "Skill" },
  { key: "commitmentFit", label: "Commitment" },
];

export default function OpportunityCard({
  id,
  title,
  description,
  org,
  orgId,
  lastVerifiedAt,
  distance,
  schedule,
  minAge,
  category,
  matchScore,
  breakdown,
  interestMatch,
  applicationDeadline,
  interestFitLabel,
  comparison,
  feedbackGiven,
  onFeedback,
  location,
  applicationUrl,
  sourceUrl,
  deliveryMode,
  programType,
  compensation,
  cost,
  financialAidAvailable,
  eligibleGrades,
  timeCommitment,
  arizonaResidencyRequired,
  parentalConsentRequired,
  healthScreeningRequired,
  backgroundCheckRequired,
  directPatientContact,
  researchComponent,
  shadowingComponent,
  topBadges,
  actions,
}: Props) {
  const titleId = useId();
  const detailsId = useId();
  const days = applicationDeadline ? daysUntil(applicationDeadline) : null;
  const applyHref = applicationUrl || sourceUrl || null;
  const applyLabel = applicationUrl ? "Apply" : "View Listing";
  // Revealed after a "not helpful" click so a reason can optionally be
  // added — separate from feedbackGiven (which reflects the parent's
  // persisted state) since this is purely local, optimistic UI.
  const [showReasons, setShowReasons] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const interestSentence = interestMatchSentence(interestMatch);

  return (
    <article className="opportunity-card bg-white border border-line rounded-card p-5" aria-labelledby={titleId}>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {topBadges && <div className="flex flex-wrap gap-1.5">{topBadges}</div>}
          <div>
            <span className="pin-tag">{category}</span>
            <h3 id={titleId} className="font-display text-lg font-semibold mt-2 leading-snug">
              {title}
            </h3>
            {org &&
              (orgId ? (
                <Link
                  href={`/organizations/${orgId}`}
                  className="text-sm text-moss-dark hover:text-moss underline underline-offset-2 transition-colors"
                >
                  {org}
                </Link>
              ) : (
                <p className="text-sm text-ink/70">{org}</p>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-mono text-ink/70">
            <span>{distance}</span>
            <span>{schedule}</span>
            <span>Ages {minAge}+</span>
            <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
              {DELIVERY_MODE_LABELS[deliveryMode ?? "in_person"]}
            </span>
          </div>

          {(cost || financialAidAvailable != null) && (
            <p className="text-sm text-ink/70">
              {cost ?? "Cost not specified"}
              {financialAidAvailable === true && " — financial aid available"}
            </p>
          )}

          <OpportunityEligibilityBadges
            arizonaResidencyRequired={arizonaResidencyRequired}
            parentalConsentRequired={parentalConsentRequired}
            healthScreeningRequired={healthScreeningRequired}
            backgroundCheckRequired={backgroundCheckRequired}
          />

          {interestSentence && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-ink/80">{interestSentence}</p>
              {onFeedback && (
                <div className="flex items-center gap-2">
                  {feedbackGiven === undefined || feedbackGiven === null ? (
                    <>
                      <span className="text-xs text-ink/70">Helpful?</span>
                      <button
                        type="button"
                        aria-label="Mark this match as helpful"
                        onClick={() => onFeedback(true)}
                        className="px-2.5 py-1 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
                      >
                        <ThumbsUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Mark this match as not helpful"
                        onClick={() => {
                          onFeedback(false);
                          setShowReasons(true);
                        }}
                        className="px-2.5 py-1 rounded-card border border-line hover:border-marigold hover:shadow-pop transition-all duration-150"
                      >
                        <ThumbsDownIcon className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-ink/70">Thanks for your feedback.</span>
                  )}
                </div>
              )}
            </div>
          )}
          {showReasons && feedbackGiven === false && (
            <div className="flex flex-wrap gap-1.5 -mt-1 animate-fade-in">
              {REASON_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => {
                    onFeedback?.(false, r.value);
                    setShowReasons(false);
                  }}
                  className="text-xs px-2 py-1 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink transition-all duration-150"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {description && (
            <p className={`text-sm text-ink/80 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{description}</p>
          )}

          {(description ||
            location ||
            programType ||
            compensation ||
            eligibleGrades ||
            timeCommitment ||
            directPatientContact != null ||
            researchComponent != null ||
            shadowingComponent != null) && (
            <ViewDetailsToggle
              expanded={expanded}
              onToggle={() => {
                // Only the expand direction — collapsing isn't a new
                // "view," and this only fires for a real, persisted
                // opportunity (id is undefined for the homepage's
                // fabricated sample cards). Called here, not inside the
                // setExpanded updater below: React Strict Mode
                // double-invokes updater functions to catch impure ones,
                // which would double-fire this exactly once per genuine
                // click in dev.
                if (!expanded && id) {
                  trackEvent("opportunity_details_viewed", { opportunityId: id, metadata: { category } });
                }
                setExpanded((v) => !v);
              }}
              controlsId={detailsId}
            />
          )}

          {expanded && (
            <div id={detailsId} className="border-t border-line pt-3 flex flex-col gap-4">
              <OpportunityDetailsPanel
                location={location}
                programType={programType}
                compensation={compensation}
                eligibleGrades={eligibleGrades}
                timeCommitment={timeCommitment}
                directPatientContact={directPatientContact}
                researchComponent={researchComponent}
                shadowingComponent={shadowingComponent}
              />
              <div>
                <p className="text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">Why this matches you</p>
                <div className="flex flex-col gap-1.5">
                  {BREAKDOWN_ROWS.map(({ key, label }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-ink/70">
                          {key === "interestFit" && interestFitLabel ? interestFitLabel : label}
                        </span>
                        <span className="font-mono text-ink/70">{breakdown[key]}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-moss transition-all duration-500 ease-smooth"
                          style={{ width: `${breakdown[key]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(lastVerifiedAt || id) && (
            <div className="flex items-center justify-between gap-2 mt-1">
              {lastVerifiedAt ? (
                <p className="text-xs font-mono text-ink/70">
                  Last manually verified {new Date(lastVerifiedAt).toLocaleDateString()}
                </p>
              ) : (
                <span />
              )}
              {id && <ReportIssueModal reportType="inaccurate_listing" opportunityId={id} opportunityTitle={title} />}
            </div>
          )}
        </div>

        {/* Always a vertical stack, on every viewport — the mobile-only
            variant of this used to be flex-row (badges beside actions),
            which could add up to wider than a 375px viewport once the
            match stamp, comparison badge, and deadline badge sat next
            to the Save/Apply buttons with none of them able to wrap.
            Stacking unconditionally (each inner group can still wrap
            *within itself* via flex-wrap) removes that failure mode
            outright rather than tuning widths to avoid it. */}
        <div className="flex flex-col items-start sm:items-end gap-3 sm:w-40 shrink-0">
          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2">
            <MatchStamp score={matchScore} />
            {comparison && (
              <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border border-line bg-white text-ink/70 whitespace-nowrap">
                {comparison.label} {comparison.score}%
              </span>
            )}
            {days !== null && (
              <span
                className={`text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border whitespace-nowrap ${deadlineBadgeClass(
                  days
                )}`}
              >
                {deadlineLabel(days)}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {actions}
            {applyHref && (
              <a
                href={applyHref}
                target="_blank"
                rel="noopener noreferrer"
                // Fires before the new tab actually opens (target="_blank"
                // never unloads this page, so there's no race against
                // navigation the way there would be for a same-tab link) —
                // only for a real, persisted opportunity.
                onClick={() => {
                  if (id) trackEvent("external_link_clicked", { opportunityId: id, metadata: { category } });
                }}
                className="text-sm font-medium px-3 py-3 sm:py-1.5 rounded-card border border-line bg-white text-ink hover:border-moss hover:shadow-pop hover:-translate-y-px transition-all duration-200 ease-smooth whitespace-nowrap"
              >
                {applyLabel} ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
