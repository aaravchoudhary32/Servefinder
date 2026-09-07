// The four eligibility-requirement flags every student-facing
// opportunity card can carry — identical markup previously duplicated
// between OpportunityCard.tsx (dashboard/onboarding/homepage) and
// ExploreOpportunityCard.tsx. Kept as small always-visible chips (not
// buried in the expanded "View details" panel) since "important
// eligibility requirements" is one of the scan-priority fields real
// pilot feedback asked for.
type Props = {
  arizonaResidencyRequired?: boolean | null;
  parentalConsentRequired?: boolean | null;
  healthScreeningRequired?: boolean | null;
  backgroundCheckRequired?: boolean | null;
};

export default function OpportunityEligibilityBadges({
  arizonaResidencyRequired,
  parentalConsentRequired,
  healthScreeningRequired,
  backgroundCheckRequired,
}: Props) {
  if (!arizonaResidencyRequired && !parentalConsentRequired && !healthScreeningRequired && !backgroundCheckRequired) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {arizonaResidencyRequired && (
        <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
          Arizona residency required
        </span>
      )}
      {parentalConsentRequired && (
        <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
          Parental consent required
        </span>
      )}
      {healthScreeningRequired && (
        <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
          Health screening required
        </span>
      )}
      {backgroundCheckRequired && (
        <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
          Background check required
        </span>
      )}
    </div>
  );
}
