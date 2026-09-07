"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/analytics";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/Button";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import AvailabilityBadge from "@/components/AvailabilityBadge";
import ReportIssueModal from "@/components/ReportIssueModal";
import { UnpinnedIcon } from "@/components/icons";
import { daysUntil, deadlineLabel, deadlineBadgeClass } from "@/lib/dates";
import {
  AvailabilityStatus,
  ProgramType,
  Compensation,
  DeliveryMode,
  PROGRAM_TYPE_LABELS,
  COMPENSATION_LABELS,
  DELIVERY_MODE_LABELS,
  applicationLinkLabel,
  isContactOnlyLink,
  yesNoLabel,
} from "@/lib/availabilityStatus";

type Org = {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  city: string | null;
  last_verified_at: string | null;
};

type OrgOpportunity = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  minimum_age: number;
  schedule_slots: string[];
  commitment_type: "one_time" | "recurring";
  application_deadline: string | null;
  application_url: string | null;
  availability_status: AvailabilityStatus;
  availability_note: string | null;
  // Biomedical/healthcare batch — all display-only, see
  // lib/availabilityStatus.ts's header for why these never filter.
  program_type: ProgramType | null;
  compensation: Compensation | null;
  cost: string | null;
  financial_aid_available: boolean | null;
  eligible_grades: string | null;
  time_commitment: string | null;
  arizona_residency_required: boolean | null;
  parental_consent_required: boolean | null;
  health_screening_required: boolean | null;
  background_check_required: boolean | null;
  direct_patient_contact: boolean | null;
  research_component: boolean | null;
  shadowing_component: boolean | null;
  // CS/Engineering batch — see lib/availabilityStatus.ts's DeliveryMode
  // header for why this is a real field, not inferred from missing
  // coordinates.
  delivery_mode: DeliveryMode;
};

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [opportunities, setOpportunities] = useState<OrgOpportunity[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?mode=login");
        return;
      }

      const [{ data: orgData }, { data: opps }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, description, website_url, city, last_verified_at")
          .eq("id", params.id)
          .maybeSingle(),
        supabase
          .from("opportunities")
          .select(
            "id, title, description, category, location, minimum_age, schedule_slots, commitment_type, application_deadline, application_url, availability_status, availability_note, program_type, compensation, cost, financial_aid_available, eligible_grades, time_commitment, arizona_residency_required, parental_consent_required, health_screening_required, background_check_required, direct_patient_contact, research_component, shadowing_component, delivery_mode"
          )
          .eq("organization_id", params.id)
          .order("title"),
      ]);

      setOrg(orgData ?? null);
      setOpportunities(opps ?? []);
      setLoading(false);
    }

    load();
  }, [params.id, router]);

  if (loading) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <DashboardSkeleton />
        </main>
      </>
    );
  }

  if (!org) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <EmptyState
              icon={<UnpinnedIcon className="w-8 h-8" />}
              title="Organization not found"
              description="This organization may have been removed, or the link is off."
              action={
                <Button href="/organizations" variant="primary" size="md">
                  Back to organizations
                </Button>
              }
            />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-5xl mx-auto">
          <Link
            href="/organizations"
            className="text-sm text-ink/70 hover:text-ink transition-colors"
          >
            ← All organizations
          </Link>

          <div className="mt-4 mb-10">
            <h1 className="font-display text-3xl font-semibold mb-2">{org.name}</h1>
            {org.description && (
              <p className="text-ink/70 max-w-2xl leading-relaxed mb-3">{org.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/70">
              {org.city && <span>{org.city}</span>}
              {org.website_url && (
                <a
                  href={org.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("external_link_clicked", { metadata: { context: "organization_website" } })}
                  className="text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
                >
                  Explore official resources ↗
                </a>
              )}
              {org.last_verified_at && (
                <span className="text-xs font-mono">
                  Last manually verified {new Date(org.last_verified_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-4">
            {opportunities.length === 0
              ? "Organization directory"
              : `${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"}`}
          </p>

          {opportunities.length === 0 ? (
            <EmptyState
              icon={<UnpinnedIcon className="w-8 h-8" />}
              title="No opportunities listed here"
              description={
                org.website_url
                  ? "This organization doesn't have a specific opportunity in our database — visit their own site above for current volunteering information."
                  : "This organization doesn't have any opportunities listed right now."
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {opportunities.map((opp) => {
                // Only shown for 'open' records — a non-open
                // availability_status already tells the fuller, more
                // current story (e.g. "Applications closed"), and a past
                // deadline's own label collides word-for-word with that
                // badge otherwise (confirmed live: UA College of
                // Medicine's Summer Scrubs tracks, closed with an
                // already-past deadline, rendered "Applications closed"
                // twice before this check existed).
                const days =
                  opp.application_deadline && opp.availability_status === "open"
                    ? daysUntil(opp.application_deadline)
                    : null;
                return (
                  <div
                    key={opp.id}
                    className="bg-white border border-line rounded-card shadow-soft p-5 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <span className="pin-tag">{opp.category}</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {opp.availability_status !== "open" && (
                          <AvailabilityBadge status={opp.availability_status} />
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
                    </div>
                    <h3 className="font-display text-lg font-semibold leading-tight">
                      {opp.title}
                    </h3>
                    {opp.description && (
                      <p className="text-sm text-ink/80 leading-relaxed">{opp.description}</p>
                    )}
                    {opp.availability_note && (
                      <p className="text-xs text-ink/70">{opp.availability_note}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-mono text-ink/70">
                      <span>{opp.location ?? "Location TBD"}</span>
                      <span>
                        {opp.schedule_slots.join(", ").replace(/_/g, " ") || "Flexible"}
                      </span>
                      <span>Ages {opp.minimum_age}+</span>
                      <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
                        {DELIVERY_MODE_LABELS[opp.delivery_mode ?? "in_person"]}
                      </span>
                      <span>
                        {opp.commitment_type === "one_time" ? "One-time" : "Recurring"}
                      </span>
                    </div>

                    {(opp.program_type || opp.compensation || opp.cost || opp.eligible_grades || opp.time_commitment) && (
                      <div className="border-t border-line pt-2 mt-1 flex flex-col gap-1 text-sm">
                        {(opp.program_type || opp.compensation) && (
                          <p>
                            <span className="font-medium">
                              {opp.program_type ? PROGRAM_TYPE_LABELS[opp.program_type] : "Program"}
                            </span>
                            {opp.compensation && (
                              <span className="text-ink/70"> · {COMPENSATION_LABELS[opp.compensation]}</span>
                            )}
                          </p>
                        )}
                        {opp.eligible_grades && <p className="text-ink/70">{opp.eligible_grades}</p>}
                        {(opp.cost || opp.financial_aid_available != null) && (
                          <p className="text-ink/70">
                            {opp.cost ?? "Cost not specified"}
                            {opp.financial_aid_available === true && " — financial aid available"}
                          </p>
                        )}
                        {opp.time_commitment && <p className="text-ink/70">{opp.time_commitment}</p>}
                      </div>
                    )}

                    {(opp.arizona_residency_required || opp.parental_consent_required || opp.health_screening_required || opp.background_check_required) && (
                      <div className="flex flex-wrap gap-1.5">
                        {opp.arizona_residency_required && (
                          <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
                            Arizona residency required
                          </span>
                        )}
                        {opp.parental_consent_required && (
                          <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
                            Parental consent required
                          </span>
                        )}
                        {opp.health_screening_required && (
                          <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
                            Health screening required
                          </span>
                        )}
                        {opp.background_check_required && (
                          <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line">
                            Background check required
                          </span>
                        )}
                      </div>
                    )}

                    {(yesNoLabel(opp.direct_patient_contact) || yesNoLabel(opp.research_component) || yesNoLabel(opp.shadowing_component)) && (
                      <div className="flex flex-col gap-0.5 text-xs text-ink/70">
                        {yesNoLabel(opp.direct_patient_contact) && (
                          <p>Direct patient contact: {yesNoLabel(opp.direct_patient_contact)}</p>
                        )}
                        {yesNoLabel(opp.research_component) && (
                          <p>Research component: {yesNoLabel(opp.research_component)}</p>
                        )}
                        {yesNoLabel(opp.shadowing_component) && (
                          <p>Shadowing component: {yesNoLabel(opp.shadowing_component)}</p>
                        )}
                      </div>
                    )}

                    {opp.application_url && (
                      <a
                        href={opp.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackEvent(
                            isContactOnlyLink(opp.application_url) ? "contact_interest_clicked" : "external_link_clicked",
                            { opportunityId: opp.id }
                          )
                        }
                        className="self-start text-sm font-medium px-3 py-1.5 rounded-card border border-line bg-white text-ink hover:border-moss hover:shadow-pop hover:-translate-y-px transition-all duration-200 ease-smooth mt-1"
                      >
                        {applicationLinkLabel(opp.application_url)} ↗
                      </a>
                    )}
                    <div className="mt-1">
                      <ReportIssueModal reportType="inaccurate_listing" opportunityId={opp.id} opportunityTitle={opp.title} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
