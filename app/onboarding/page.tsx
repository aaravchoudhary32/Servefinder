"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/analytics";
import TagSelect from "@/components/TagSelect";
import Button from "@/components/Button";
import OpportunityCard from "@/components/OpportunityCard";
import { MAX_DISTANCE_MILES_CAP } from "@/lib/constants";
import { getAccountInfo, homeRouteFor } from "@/lib/accountRole";
import { rankOpportunities, StudentProfile, Opportunity, MatchResult } from "@/lib/matching";
import { geocodeStudentLocation } from "@/lib/geocode";
import { resolveDistanceMiles, distanceLabel } from "@/lib/distance";
import { ProgramType, Compensation, DeliveryMode } from "@/lib/availabilityStatus";
import { TAXONOMY } from "@/lib/interestTaxonomy";

// sessionStorage key carrying what an anonymous visitor entered during a
// preview over to signup, so creating an account doesn't mean re-answering
// every question from scratch.
const PENDING_PROFILE_KEY = "pendingStudentProfile";

type PendingProfile = {
  age: number;
  city: string;
  zip: string;
  maxDistance: number;
  interests: string[];
  // Progressive-disclosure major/career focus selections (Computer
  // Science & Software Engineering, Nursing, Entrepreneurship, etc.,
  // across all 10 categories — see lib/interestTaxonomy.ts's TAXONOMY)
  // — stored separately from `interests` only for the picker's own
  // controlled state; every write to `profiles.interests` (and every
  // StudentProfile built for matching) combines the two into one flat
  // array, since that's the single column lib/matching.ts's
  // expandWithTaxonomyParents() reads. One flat array covering every
  // category, not one state variable per category — a student's
  // selected focuses are inherently a flat set regardless of which
  // broad category each one belongs to.
  focusSelections: string[];
  skills: string[];
  availability: string[];
  commitment: "one_time" | "recurring" | "either";
};

type PreviewOpportunityRow = {
  id: string;
  title: string;
  organization_id: string | null;
  organizations: { name: string } | null;
  category: string;
  minimum_age: number;
  latitude: number | null;
  longitude: number | null;
  schedule_slots: string[];
  skills_required: string[];
  interests_tags: string[];
  commitment_type: "one_time" | "recurring";
  application_deadline: string | null;
  is_stale: boolean;
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

// Derived from TAXONOMY rather than hand-copied: a hardcoded parallel
// list previously drifted out of sync when Government, Law & Advocacy
// was added as the taxonomy's 10th broad category, silently leaving it
// unselectable in onboarding despite having real, evidence-tagged
// opportunities (see supabase/add_canonical_focus_taxonomy.sql).
const INTEREST_OPTIONS = TAXONOMY.map((c) => ({ value: c.broadTag, label: c.broadLabel }));

const SKILL_OPTIONS = [
  { value: "tutoring", label: "Tutoring" },
  { value: "first_aid", label: "First Aid / CPR" },
  { value: "coding", label: "Coding" },
  { value: "public_speaking", label: "Public Speaking" },
  { value: "spanish", label: "Bilingual: Spanish" },
  { value: "design", label: "Design" },
  { value: "photography", label: "Photography" },
];

const AVAILABILITY_OPTIONS = [
  { value: "weekday_morning", label: "Weekday mornings" },
  { value: "weekday_afternoon", label: "Weekday afternoons" },
  { value: "weekday_evening", label: "Weekday evenings" },
  { value: "saturday_morning", label: "Saturday mornings" },
  { value: "saturday_afternoon", label: "Saturday afternoons" },
  { value: "sunday_morning", label: "Sunday mornings" },
  { value: "sunday_afternoon", label: "Sunday afternoons" },
];

export default function OnboardingPage() {
  const router = useRouter();
  // No default age — a pre-filled in-range value (e.g. 15) reads as a
  // real answer and can be submitted untouched, silently miscalibrating
  // the age hard filter. Empty lets the input's own required/min/max
  // constraints actually block submission until a real age is entered.
  const [age, setAge] = useState<number | "">("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [maxDistance, setMaxDistance] = useState(10);
  const [interests, setInterests] = useState<string[]>([]);
  const [focusSelections, setFocusSelections] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [commitment, setCommitment] = useState<"one_time" | "recurring" | "either">(
    "either"
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Anonymous visitors get a live preview instead of a "you need an
  // account" wall — set once they submit the form without being logged
  // in. null = form is showing (either nothing submitted yet, or they
  // clicked back to edit their answers).
  const [previewMatches, setPreviewMatches] = useState<MatchResult[] | null>(null);
  const [previewDetails, setPreviewDetails] = useState<
    Record<string, { orgName: string; deadline: string | null } & Omit<PreviewOpportunityRow, "id" | "organizations">>
  >({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Student-only onboarding — an organization account landing here
  // (stale bookmark, back button, direct URL) would otherwise be able
  // to submit this form and get a `profiles` row that makes no sense
  // for their account type, since nothing else in the app expects an
  // org rep to have one.
  useEffect(() => {
    async function guard() {
      const account = await getAccountInfo();
      if (account?.role === "organization") {
        router.replace(homeRouteFor(account));
        return;
      }
      // Fired here (after the guard confirms this is actually a
      // student, not an org account about to bounce off the page) —
      // this is a single-step form, not a wizard, so "started" has no
      // more precise meaning than "reached the form."
      if (account?.role === "student") {
        trackEvent("onboarding_started");
      }

      // Carry over whatever was entered during an anonymous preview
      // (see handlePreview) so signing up afterward doesn't mean
      // re-answering every question — read once, then cleared, so a
      // later unrelated visit to this page doesn't get stale answers.
      const pending = window.sessionStorage.getItem(PENDING_PROFILE_KEY);
      if (pending) {
        window.sessionStorage.removeItem(PENDING_PROFILE_KEY);
        try {
          // `as PendingProfile & { stemInterests?; businessInterests? }`:
          // a value written to sessionStorage moments before this exact
          // deploy could still carry the pre-migration shape (this is
          // short-lived session storage, not persisted data, but the
          // anonymous-preview-to-signup handoff this key exists for
          // means a value written just before a deploy could still be
          // read just after it) — read both old keys as a fallback so
          // that narrow window doesn't silently drop a real selection.
          const parsed = JSON.parse(pending) as PendingProfile & {
            stemInterests?: string[];
            businessInterests?: string[];
          };
          setAge(parsed.age);
          setCity(parsed.city);
          setZip(parsed.zip);
          setMaxDistance(parsed.maxDistance);
          setInterests(parsed.interests);
          setFocusSelections(parsed.focusSelections ?? [...(parsed.stemInterests ?? []), ...(parsed.businessInterests ?? [])]);
          setSkills(parsed.skills);
          setAvailability(parsed.availability);
          setCommitment(parsed.commitment);
        } catch {
          // Malformed/stale value — ignore rather than block onboarding.
        }
      }
    }
    guard();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPreviewError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      await showPreview();
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      age: Number(age),
      city,
      zip_code: zip,
      max_distance_miles: maxDistance,
      // profiles.interests is one flat array — broad interests and any
      // STEM subtags (Computer Science, Robotics, Cybersecurity, ...)
      // both live in it; lib/matching.ts's expandWithStemParent() is
      // what makes a subtag also credit the broad "stem" tag at match
      // time, not a second column here.
      interests: [...interests, ...focusSelections],
      skills,
      availability,
      commitment_preference: commitment,
    });
    setSaving(false);

    if (error) {
      console.error("profiles upsert failed during onboarding:", error.message);
      setError("Something went wrong saving your profile. Please try again.");
      return;
    }

    trackEvent("onboarding_completed");
    router.push("/dashboard");
  }

  // Anonymous visitor path: score real, public opportunities against what
  // they just entered (same rankOpportunities() the real dashboard uses)
  // and show the results inline, instead of requiring an account first.
  // Nothing here is saved — signing up (goToSignup) is what actually
  // persists a profile.
  async function showPreview() {
    setPreviewLoading(true);

    const profile: StudentProfile = {
      age: Number(age),
      interests: [...interests, ...focusSelections],
      skills,
      availability,
      maxDistanceMiles: maxDistance,
      commitmentPreference: commitment,
    };

    const { data: opps, error: oppsError } = await supabase
      .from("opportunities")
      .select(
        "id, title, organization_id, organizations(name), category, minimum_age, latitude, longitude, schedule_slots, skills_required, interests_tags, commitment_type, application_deadline, is_stale, program_type, compensation, cost, financial_aid_available, eligible_grades, time_commitment, arizona_residency_required, parental_consent_required, health_screening_required, background_check_required, direct_patient_contact, research_component, shadowing_component, delivery_mode"
      )
      // Same filter dashboard/page.tsx applies — seasonal/unverified/
      // closed manual records never enter ranked matching, even in the
      // anonymous preview.
      .eq("availability_status", "open");

    if (oppsError) {
      console.error("opportunities fetch failed during onboarding preview:", oppsError.message);
      setPreviewError("Something went wrong finding your matches. Please try again.");
      setPreviewLoading(false);
      return;
    }

    const studentCoords = await geocodeStudentLocation(zip, city);
    const oppRows = ((opps ?? []) as unknown as PreviewOpportunityRow[]).filter(
      (o) => !o.is_stale
    );

    setPreviewDetails(
      Object.fromEntries(
        oppRows.map((o) => {
          const { id: _id, organizations, ...rest } = o;
          return [o.id, { ...rest, orgName: organizations?.name ?? "", deadline: o.application_deadline }];
        })
      )
    );

    // No pre-filtering of unresolvable distances here anymore — every
    // fetched opportunity is passed through, distanceMiles possibly
    // null. lib/matching.ts's isWithinRange()/distanceFit() decide what
    // a null distance means per delivery_mode — see lib/distance.ts's
    // resolveDistanceMiles and app/dashboard/page.tsx's identical logic.
    const opportunities: Opportunity[] = oppRows.map((o): Opportunity => ({
      id: o.id,
      title: o.title,
      minimumAge: o.minimum_age,
      category: o.category,
      interestsTags: o.interests_tags,
      skillsRequired: o.skills_required,
      scheduleSlots: o.schedule_slots,
      distanceMiles: resolveDistanceMiles(studentCoords, o),
      deliveryMode: o.delivery_mode,
      commitmentType: o.commitment_type,
    }));

    // Persist what they entered so the signup CTA below can carry it
    // over — see the guard effect's prefill above.
    const pending: PendingProfile = {
      age: Number(age),
      city,
      zip,
      maxDistance,
      interests,
      focusSelections,
      skills,
      availability,
      commitment,
    };
    window.sessionStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));

    setPreviewMatches(rankOpportunities(profile, opportunities).slice(0, 6));
    setPreviewLoading(false);
  }

  function editAnswers() {
    setPreviewMatches(null);
  }

  function goToSignup() {
    router.push("/login?mode=signup");
  }

  if (previewMatches) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-6xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            Preview
          </p>
          <h1 className="font-display text-3xl font-semibold mb-2">
            {previewMatches.length === 0
              ? "No preview matches yet"
              : `Here's what matches you, based on what you told us`}
          </h1>
          <p className="text-ink/70 mb-6 max-w-2xl">
            This is a preview — nothing has been saved. Sign up to keep your
            profile, save opportunities, and apply.
          </p>

          <div className="bg-white border border-line rounded-card shadow-soft p-4 mb-8 flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" size="md" onClick={goToSignup}>
              Sign up to save your matches
            </Button>
            <a
              href="/login?mode=login"
              className="text-sm text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
            >
              Already have an account? Log in
            </a>
            <button
              type="button"
              onClick={editAnswers}
              className="text-sm text-ink/70 underline underline-offset-2 hover:text-ink transition-colors ml-auto"
            >
              Edit your answers
            </button>
          </div>

          {previewMatches.length === 0 ? (
            <p className="text-ink/70">
              There may not be any opportunities within your travel range
              that fit your age and preferences right now. Try widening your
              max travel distance or{" "}
              <button
                type="button"
                onClick={editAnswers}
                className="text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
              >
                adjusting your answers
              </button>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Visually hidden — see app/dashboard/page.tsx's identical
                  fix for why this is needed (each card's own title is an
                  h3, which needs a real h2 ancestor for heading order).
                  Deliberately doesn't contain the word "match" — an
                  existing e2e test locates the page's real result-count
                  heading by that word and would otherwise resolve two
                  headings instead of one. */}
              <h2 className="sr-only">Preview results</h2>
              {previewMatches.map(({ opportunity, score, breakdown, interestMatch }, i) => {
                const details = previewDetails[opportunity.id];
                return (
                  <div
                    key={opportunity.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <OpportunityCard
                      title={opportunity.title}
                      org={details?.orgName ?? ""}
                      distance={distanceLabel(opportunity.distanceMiles, opportunity.deliveryMode)}
                      deliveryMode={opportunity.deliveryMode}
                      schedule={opportunity.scheduleSlots
                        .join(", ")
                        .replace(/_/g, " ")}
                      minAge={opportunity.minimumAge}
                      category={opportunity.category}
                      matchScore={score}
                      breakdown={breakdown}
                      interestMatch={interestMatch}
                      applicationDeadline={details?.deadline}
                      programType={details?.program_type}
                      compensation={details?.compensation}
                      cost={details?.cost}
                      financialAidAvailable={details?.financial_aid_available}
                      eligibleGrades={details?.eligible_grades}
                      timeCommitment={details?.time_commitment}
                      arizonaResidencyRequired={details?.arizona_residency_required}
                      parentalConsentRequired={details?.parental_consent_required}
                      healthScreeningRequired={details?.health_screening_required}
                      backgroundCheckRequired={details?.background_check_required}
                      directPatientContact={details?.direct_patient_contact}
                      researchComponent={details?.research_component}
                      shadowingComponent={details?.shadowing_component}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in-up max-w-xl mx-auto flex flex-col gap-8"
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            Step 1 of 1
          </p>
          <h1 className="font-display text-3xl font-semibold">
            Tell us about you
          </h1>
          <p className="text-ink/70 mt-2 leading-relaxed">
            This shapes every match we show you — nothing here is shared with
            organizations until you apply.
          </p>
        </div>

        <div className="bg-white border border-line rounded-card shadow-soft p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="onboarding-age" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Age
              </label>
              <input
                id="onboarding-age"
                type="number"
                min={13}
                max={19}
                required
                value={age}
                onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              />
            </div>
            <div>
              <label htmlFor="onboarding-max-distance" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Max travel distance (miles)
              </label>
              <input
                id="onboarding-max-distance"
                type="number"
                min={1}
                max={MAX_DISTANCE_MILES_CAP}
                required
                value={maxDistance}
                onChange={(e) =>
                  setMaxDistance(Math.min(Number(e.target.value), MAX_DISTANCE_MILES_CAP))
                }
                className="w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              />
              <p className="text-xs text-ink/70 mt-1">
                Capped at {MAX_DISTANCE_MILES_CAP} miles (roughly an hour&apos;s drive) — opportunities
                farther than this are excluded from your matches entirely.
              </p>
            </div>
            <div>
              <label htmlFor="onboarding-city" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                City
              </label>
              <input
                id="onboarding-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              />
            </div>
            <div>
              <label htmlFor="onboarding-zip" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                ZIP code
              </label>
              <input
                id="onboarding-zip"
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              />
            </div>
          </div>

          <TagSelect
            label="Interests"
            options={INTEREST_OPTIONS}
            selected={interests}
            onChange={(newInterests) => {
              // Unchecking a broad interest also drops any focus
              // selections that belonged only to it, so a focus picked
              // under a category the student later unchecks doesn't
              // keep silently counting toward matching with no visible
              // picker showing it's still selected.
              const removedCategories = interests.filter((tag) => !newInterests.includes(tag));
              if (removedCategories.length > 0) {
                const removedFocusValues = new Set(
                  TAXONOMY.filter((c) => removedCategories.includes(c.broadTag)).flatMap((c) =>
                    c.focuses.map((f) => f.value)
                  )
                );
                setFocusSelections((prev) => prev.filter((v) => !removedFocusValues.has(v)));
              }
              setInterests(newInterests);
            }}
          />

          {TAXONOMY.filter((category) => interests.includes(category.broadTag)).map((category) => {
            const focusValues = category.focuses.map((f) => f.value);
            return (
              <div key={category.broadTag}>
                <TagSelect
                  label={`${category.broadLabel} focus areas (optional)`}
                  options={category.focuses}
                  selected={focusSelections.filter((v) => focusValues.includes(v))}
                  onChange={(newSelectedForCategory) =>
                    setFocusSelections((prev) => [
                      ...prev.filter((v) => !focusValues.includes(v)),
                      ...newSelectedForCategory,
                    ])
                  }
                />
                <p className="text-xs text-ink/60 mt-1">
                  Optional — picking one helps us rank closely-related opportunities higher, but you&apos;ll still
                  see strong {category.broadLabel} matches either way.
                </p>
              </div>
            );
          })}

          <TagSelect
            label="Skills"
            options={SKILL_OPTIONS}
            selected={skills}
            onChange={setSkills}
          />

          <TagSelect
            label="Availability"
            options={AVAILABILITY_OPTIONS}
            selected={availability}
            onChange={setAvailability}
          />

          <div>
            <span id="onboarding-commitment-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
              Commitment preference
            </span>
            <div role="group" aria-labelledby="onboarding-commitment-label" className="flex gap-2">
              {(
                [
                  { value: "one_time", label: "One-time" },
                  { value: "recurring", label: "Recurring" },
                  { value: "either", label: "Either" },
                ] as const
              ).map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setCommitment(opt.value)}
                  aria-pressed={commitment === opt.value}
                  className={`text-sm px-3 py-1.5 rounded-card border transition-all duration-150 ${
                    commitment === opt.value
                      ? "bg-moss text-white border-moss"
                      : "bg-white text-ink border-line hover:border-moss"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(error || previewError) && (
          <p role="alert" className="animate-fade-in text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
            {error || previewError}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={saving || previewLoading}
          className="self-start"
        >
          {saving ? "Saving…" : previewLoading ? "Finding matches…" : "Find My Matches"}
        </Button>
      </form>
    </main>
  );
}
