import {
  ProgramType,
  Compensation,
  PROGRAM_TYPE_LABELS,
  COMPENSATION_LABELS,
  yesNoLabel,
} from "@/lib/availabilityStatus";

// The secondary-detail content revealed by ViewDetailsToggle — program
// type/compensation, eligible grades, time commitment, the literal
// street address, and the healthcare-specific patient-contact/research/
// shadowing flags. None of this is removed from the app; it just isn't
// part of the always-visible compact card body any more (see
// OpportunityCard.tsx / ExploreOpportunityCard.tsx's own header comments
// for which fields stayed compact and why).
type Props = {
  location?: string | null;
  programType?: ProgramType | null;
  compensation?: Compensation | null;
  eligibleGrades?: string | null;
  timeCommitment?: string | null;
  directPatientContact?: boolean | null;
  researchComponent?: boolean | null;
  shadowingComponent?: boolean | null;
};

export default function OpportunityDetailsPanel({
  location,
  programType,
  compensation,
  eligibleGrades,
  timeCommitment,
  directPatientContact,
  researchComponent,
  shadowingComponent,
}: Props) {
  const hasProgramInfo = Boolean(programType || compensation || eligibleGrades || timeCommitment);
  const hasPatientContactInfo = Boolean(
    yesNoLabel(directPatientContact) || yesNoLabel(researchComponent) || yesNoLabel(shadowingComponent)
  );

  if (!location && !hasProgramInfo && !hasPatientContactInfo) return null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {location && <p className="text-ink/70">{location}</p>}

      {hasProgramInfo && (
        <div className="flex flex-col gap-1">
          {(programType || compensation) && (
            <p>
              <span className="font-medium">{programType ? PROGRAM_TYPE_LABELS[programType] : "Program"}</span>
              {compensation && <span className="text-ink/70"> · {COMPENSATION_LABELS[compensation]}</span>}
            </p>
          )}
          {eligibleGrades && <p className="text-ink/70">{eligibleGrades}</p>}
          {timeCommitment && <p className="text-ink/70">{timeCommitment}</p>}
        </div>
      )}

      {hasPatientContactInfo && (
        <div className="flex flex-col gap-0.5 text-xs text-ink/70">
          {yesNoLabel(directPatientContact) && <p>Direct patient contact: {yesNoLabel(directPatientContact)}</p>}
          {yesNoLabel(researchComponent) && <p>Research component: {yesNoLabel(researchComponent)}</p>}
          {yesNoLabel(shadowingComponent) && <p>Shadowing component: {yesNoLabel(shadowingComponent)}</p>}
        </div>
      )}
    </div>
  );
}
