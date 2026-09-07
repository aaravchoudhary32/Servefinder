"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import AvailabilityBadge from "./AvailabilityBadge";
import ViewDetailsToggle from "./ViewDetailsToggle";
import OpportunityEligibilityBadges from "./OpportunityEligibilityBadges";
import OpportunityDetailsPanel from "./OpportunityDetailsPanel";
import { daysUntil, deadlineLabel, deadlineBadgeClass } from "@/lib/dates";
import {
  AvailabilityStatus,
  ProgramType,
  Compensation,
  DeliveryMode,
  DELIVERY_MODE_LABELS,
  applicationLinkLabel,
  canApplyNow,
} from "@/lib/availabilityStatus";

type Props = {
  // Only present for a real, persisted opportunity (see
  // OpportunityCard.tsx's identical field for why) — gates analytics
  // tracking below.
  id?: string;
  title: string;
  description?: string | null;
  org: string;
  orgId?: string | null;
  category: string;
  minAge: number;
  location: string | null;
  locationLabel: string; // explorerLocationLabel() output — real miles, "Virtual"/"Hybrid", or "Location not verified"
  outsideRadius: boolean; // isOutsideRadius() output
  scheduleSlots: string[];
  commitmentType: "one_time" | "recurring";
  availabilityStatus: AvailabilityStatus;
  availabilityNote?: string | null;
  applicationUrl?: string | null;
  sourceUrl?: string | null;
  applicationDeadline?: string | null;
  lastVerifiedAt?: string | null;
  programType?: ProgramType | null;
  compensation?: Compensation | null;
  deliveryMode?: DeliveryMode | null;
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
};

export default function ExploreOpportunityCard({
  id,
  title,
  description,
  org,
  orgId,
  category,
  minAge,
  location,
  locationLabel,
  outsideRadius,
  scheduleSlots,
  commitmentType: _commitmentType,
  availabilityStatus,
  availabilityNote,
  applicationUrl,
  sourceUrl,
  applicationDeadline,
  lastVerifiedAt,
  programType,
  compensation,
  deliveryMode,
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
}: Props) {
  const titleId = useId();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const days =
    applicationDeadline && availabilityStatus === "open" ? daysUntil(applicationDeadline) : null;
  const linkHref = applicationUrl || sourceUrl || null;
  const canApply = canApplyNow(availabilityStatus);

  // Fires before the new tab opens (target="_blank" never unloads this
  // page) — only for a real, persisted opportunity.
  function handleLinkClick() {
    if (id) trackEvent("external_link_clicked", { opportunityId: id, metadata: { category } });
  }
  const scheduleSummary = scheduleSlots.join(", ").replace(/_/g, " ") || "Flexible";

  return (
    <article className="opportunity-card bg-white border border-line rounded-card p-5" aria-labelledby={titleId}>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
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

          {availabilityStatus === "unverified" && (
            <p className="text-xs text-ink/70">Current availability not verified.</p>
          )}
          {availabilityStatus === "seasonal" && (
            <p className="text-xs text-ink/70">{availabilityNote || "Dates not yet announced."}</p>
          )}
          {(availabilityStatus === "paused" || availabilityStatus === "waitlisted") && availabilityNote && (
            <p className="text-xs text-ink/70">{availabilityNote}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-mono text-ink/70">
            <span>
              {locationLabel}
              {outsideRadius && (
                <span className="ml-1.5 text-[0.65rem] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-card border bg-marigold-light text-marigold-dark border-marigold/30 align-middle">
                  Outside your preferred radius
                </span>
              )}
            </span>
            <span>{scheduleSummary}</span>
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
                // "view." Called here, not inside the setExpanded updater
                // below: React Strict Mode double-invokes updater
                // functions to catch impure ones, which would
                // double-fire this exactly once per genuine click in dev.
                if (!expanded && id) {
                  trackEvent("opportunity_details_viewed", { opportunityId: id, metadata: { category } });
                }
                setExpanded((v) => !v);
              }}
              controlsId={detailsId}
            />
          )}

          {expanded && (
            <div id={detailsId} className="border-t border-line pt-3">
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
            </div>
          )}

          {lastVerifiedAt && (
            <p className="text-xs font-mono text-ink/70 mt-1">
              Last manually verified {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Always a vertical stack — see OpportunityCard.tsx's identical
            comment for why (a mobile-only flex-row here could add up to
            wider than the viewport once the badges sat beside the apply
            button with neither able to wrap against the other). */}
        <div className="flex flex-col items-start sm:items-end gap-3 sm:w-44 shrink-0">
          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 justify-end">
            <AvailabilityBadge status={availabilityStatus} />
            {days !== null && (
              <span
                className={`text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border whitespace-nowrap ${deadlineBadgeClass(days)}`}
              >
                {deadlineLabel(days)}
              </span>
            )}
          </div>
          {linkHref &&
            (canApply ? (
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
                className="text-sm font-medium px-3 py-3 sm:py-1.5 rounded-card border border-line bg-moss text-white hover:bg-moss-dark hover:shadow-pop hover:-translate-y-px transition-all duration-200 ease-smooth whitespace-nowrap"
              >
                {applicationLinkLabel(linkHref) ?? "Apply"} ↗
              </a>
            ) : (
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
                className="text-sm text-moss-dark underline underline-offset-2 hover:text-moss transition-colors py-3 sm:py-0 whitespace-nowrap"
              >
                View official page ↗
              </a>
            ))}
        </div>
      </div>
    </article>
  );
}
