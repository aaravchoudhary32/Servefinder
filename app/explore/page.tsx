"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/analytics";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import Button from "@/components/Button";
import ExploreOpportunityCard from "@/components/ExploreOpportunityCard";
import ExploreOrgCard from "@/components/ExploreOrgCard";
import { CompassIcon, SearchIcon } from "@/components/icons";
import { getAccountInfo, homeRouteFor } from "@/lib/accountRole";
import { geocodeStudentLocation, Coordinates } from "@/lib/geocode";
import { explorerLocationLabel, isOutsideRadius, resolveDistanceMiles } from "@/lib/distance";
import { classifyExploreSection, EXPLORE_SECTION_LABELS, DEFAULT_EXPLORE_STATUSES, ExploreSection } from "@/lib/explore";
import { CATEGORY_OPTIONS, CATEGORY_TAG_MAP } from "@/lib/constants";
import { TAXONOMY, resolveCanonicalFocus } from "@/lib/interestTaxonomy";
import {
  AvailabilityStatus,
  ProgramType,
  Compensation,
  DeliveryMode,
  PROGRAM_TYPE_LABELS,
  COMPENSATION_LABELS,
} from "@/lib/availabilityStatus";

type ProfileRow = {
  age: number;
  city: string | null;
  zip_code: string | null;
  max_distance_miles: number;
};

type OpportunityRow = {
  id: string;
  title: string;
  organization_id: string | null;
  organizations: { name: string } | null;
  description: string | null;
  category: string;
  minimum_age: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  schedule_slots: string[];
  interests_tags: string[];
  commitment_type: "one_time" | "recurring";
  application_deadline: string | null;
  application_url: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  availability_status: AvailabilityStatus;
  availability_note: string | null;
  program_type: ProgramType | null;
  compensation: Compensation | null;
  delivery_mode: DeliveryMode;
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
};

type OrgRow = {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  last_verified_at: string | null;
};

export default function ExplorePage() {
  const router = useRouter();

  // Same reasoning as Dashboard's identical effect: fires once per real
  // visit regardless of loading state, deduped within a short window,
  // and deliberately not part of the "meaningful action" set used for
  // active-user counts (a page load alone isn't engagement).
  useEffect(() => {
    trackEvent("explore_viewed", { dedupe: true });
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [studentCoords, setStudentCoords] = useState<Coordinates | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);

  // Filters — statuses default to the safest useful view (open + seasonal
  // only); every other control defaults to "show everything."
  const [selectedStatuses, setSelectedStatuses] = useState<Set<AvailabilityStatus>>(
    new Set(DEFAULT_EXPLORE_STATUSES)
  );
  const [showDirectories, setShowDirectories] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  // One filter now, not one hardcoded dropdown per category — its
  // options are derived from whichever broad category is selected
  // (see availableFocuses below), covering all 10 categories instead
  // of just STEM/Business.
  const [focusFilter, setFocusFilter] = useState("");
  const [programTypeFilter, setProgramTypeFilter] = useState("");
  const [deliveryModeFilter, setDeliveryModeFilter] = useState("");
  const [compensationFilter, setCompensationFilter] = useState("");
  const [withinRadiusOnly, setWithinRadiusOnly] = useState(false);

  // Debounced rather than tracked per keystroke — search_performed is
  // meant to answer "did the student search," not "how many characters
  // did they type." Never sends the actual search text itself (that
  // would be exactly the raw free-text this table is built to exclude);
  // this only records that a search happened.
  useEffect(() => {
    if (!keyword.trim()) return;
    const timeout = setTimeout(() => {
      trackEvent("search_performed");
    }, 800);
    return () => clearTimeout(timeout);
  }, [keyword]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?mode=login");
        return;
      }

      // Student-facing only — same guard dashboard already uses.
      const account = await getAccountInfo();
      if (account?.role === "organization") {
        router.replace(homeRouteFor(account));
        return;
      }

      const [{ data: profileRow, error: profileError }, { data: oppRows, error: oppsError }, { data: orgRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("age, city, zip_code, max_distance_miles")
            .eq("user_id", user.id)
            .single(),
          // Deliberately NO availability_status filter — unlike the
          // dashboard, /explore's whole purpose is showing every
          // discoverable record with a transparent status, not just
          // ranked-open ones.
          supabase
            .from("opportunities")
            .select(
              "id, title, description, organization_id, organizations(name), category, minimum_age, location, latitude, longitude, schedule_slots, interests_tags, commitment_type, application_deadline, application_url, source_url, last_verified_at, availability_status, availability_note, program_type, compensation, delivery_mode, cost, financial_aid_available, eligible_grades, time_commitment, arizona_residency_required, parental_consent_required, health_screening_required, background_check_required, direct_patient_contact, research_component, shadowing_component"
            ),
          supabase.from("organizations").select("id, name, description, city, last_verified_at"),
        ]);

      if (profileError || !profileRow) {
        setError("We couldn't find your profile yet. Let's finish setting it up first.");
        setLoading(false);
        return;
      }
      if (oppsError) {
        setError(oppsError.message);
        setLoading(false);
        return;
      }

      setProfile(profileRow as ProfileRow);
      setOpportunities((oppRows ?? []) as unknown as OpportunityRow[]);
      setOrgs((orgRows ?? []) as OrgRow[]);
      setStudentCoords(await geocodeStudentLocation(profileRow.zip_code, profileRow.city));
      setLoading(false);
    }
    load();
  }, [router]);

  // Age is a genuine eligibility fact, not a preference — kept as a real
  // hard filter here too, same as the dashboard, even though distance is
  // deliberately not (see the badge/label logic below instead).
  const ageEligible = useMemo(
    () => (profile ? opportunities.filter((o) => profile.age >= o.minimum_age) : []),
    [profile, opportunities]
  );

  const enriched = useMemo(
    () =>
      ageEligible.map((o) => {
        const distanceMiles = resolveDistanceMiles(studentCoords, o);
        return {
          opp: o,
          distanceMiles,
          locationLabel: explorerLocationLabel(distanceMiles, o.delivery_mode),
          outsideRadius: profile ? isOutsideRadius(distanceMiles, o.delivery_mode, profile.max_distance_miles) : false,
        };
      }),
    [ageEligible, studentCoords, profile]
  );

  // Which focus options to show depends on which broad category is
  // currently selected — empty (no dropdown shown) when no category is
  // picked, or when the picked category has no focuses defined.
  const availableFocuses = useMemo(() => {
    const broadTag = CATEGORY_TAG_MAP[categoryFilter];
    if (!broadTag) return [];
    return TAXONOMY.find((c) => c.broadTag === broadTag)?.focuses ?? [];
  }, [categoryFilter]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return enriched.filter(({ opp, outsideRadius }) => {
      if (!selectedStatuses.has(opp.availability_status)) return false;
      if (withinRadiusOnly && outsideRadius) return false;
      if (kw && !opp.title.toLowerCase().includes(kw) && !(opp.eligible_grades ?? "").toLowerCase().includes(kw)) {
        return false;
      }
      if (categoryFilter && opp.category !== categoryFilter) return false;
      // Alias-aware: a legacy-tagged opportunity (e.g. "computer_science")
      // still matches a filter selection on its new canonical focus
      // ("cs_software_engineering") — same resolution matching itself
      // uses, so filtering and ranking never disagree about identity.
      if (focusFilter && !opp.interests_tags.some((t) => resolveCanonicalFocus(t) === focusFilter)) return false;
      if (programTypeFilter && opp.program_type !== programTypeFilter) return false;
      if (deliveryModeFilter && opp.delivery_mode !== deliveryModeFilter) return false;
      if (compensationFilter && opp.compensation !== compensationFilter) return false;
      return true;
    });
  }, [
    enriched,
    selectedStatuses,
    withinRadiusOnly,
    keyword,
    categoryFilter,
    focusFilter,
    programTypeFilter,
    deliveryModeFilter,
    compensationFilter,
  ]);

  const bySection = useMemo(() => {
    const groups: Record<ExploreSection, typeof filtered> = { open: [], seasonal: [], watch: [], closed: [] };
    for (const item of filtered) {
      groups[classifyExploreSection(item.opp.availability_status)].push(item);
    }
    return groups;
  }, [filtered]);

  // Structural fact about the org (does it have ANY opportunity row at
  // all), independent of the current filter state — directory status
  // isn't something a filter should be able to hide or reveal.
  const directoryOrgs = useMemo(() => {
    const orgIdsWithOpportunities = new Set(opportunities.map((o) => o.organization_id).filter(Boolean));
    return orgs.filter((org) => !orgIdsWithOpportunities.has(org.id));
  }, [orgs, opportunities]);

  // Found live while testing the empty state: a keyword search that
  // matched zero opportunities still showed every directory org
  // untouched, since none of the opportunity filters apply to orgs at
  // all — the page never actually reached "no results." Keyword is the
  // one filter that genuinely makes sense for both; applying it here is
  // what makes the empty state (and the result count) honest.
  const visibleDirectoryOrgs = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return directoryOrgs;
    return directoryOrgs.filter(
      (org) => org.name.toLowerCase().includes(kw) || (org.description ?? "").toLowerCase().includes(kw)
    );
  }, [directoryOrgs, keyword]);

  function clearFilters() {
    setSelectedStatuses(new Set(DEFAULT_EXPLORE_STATUSES));
    setShowDirectories(true);
    setKeyword("");
    setCategoryFilter("");
    setFocusFilter("");
    setProgramTypeFilter("");
    setDeliveryModeFilter("");
    setCompensationFilter("");
    setWithinRadiusOnly(false);
  }

  const totalResults = filtered.length + (showDirectories ? visibleDirectoryOrgs.length : 0);

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-6xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">Explore</p>
          <h1 className="font-display text-3xl font-semibold mb-2">Explore opportunities</h1>
          <p className="text-ink/70 max-w-2xl mb-6">
            Everything discoverable on ServeFinder — not just what&apos;s open and eligible right now.
            Your Matches on the dashboard stays limited to ranked, currently-open, in-range opportunities;
            this page shows upcoming, seasonal, unverified, and directory programs too, each labeled honestly.
          </p>

          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <EmptyState
              icon={<CompassIcon className="w-8 h-8" />}
              title="Something went wrong"
              description={error}
            />
          ) : (
            <>
              <div className="bg-white border border-line rounded-card shadow-soft p-4 mb-6 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { section: "open" as const, statuses: ["open"] as AvailabilityStatus[] },
                      { section: "seasonal" as const, statuses: ["seasonal"] as AvailabilityStatus[] },
                      { section: "watch" as const, statuses: ["unverified", "paused", "waitlisted"] as AvailabilityStatus[] },
                      { section: "closed" as const, statuses: ["closed"] as AvailabilityStatus[] },
                    ]
                  ).map(({ section, statuses }) => {
                    const active = statuses.every((s) => selectedStatuses.has(s));
                    return (
                      <button
                        key={section}
                        type="button"
                        onClick={() =>
                          setSelectedStatuses((prev) => {
                            const next = new Set(prev);
                            const currentlyActive = statuses.every((s) => next.has(s));
                            for (const s of statuses) {
                              if (currentlyActive) next.delete(s);
                              else next.add(s);
                            }
                            return next;
                          })
                        }
                        aria-pressed={active}
                        className={`text-sm px-3 py-1.5 rounded-card border transition-all duration-150 ${
                          active
                            ? "bg-moss text-white border-moss shadow-soft"
                            : "bg-white text-ink border-line hover:border-moss hover:shadow-pop"
                        }`}
                      >
                        {EXPLORE_SECTION_LABELS[section]}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowDirectories((v) => !v)}
                    aria-pressed={showDirectories}
                    className={`text-sm px-3 py-1.5 rounded-card border transition-all duration-150 ${
                      showDirectories
                        ? "bg-moss text-white border-moss shadow-soft"
                        : "bg-white text-ink border-line hover:border-moss hover:shadow-pop"
                    }`}
                  >
                    Organizations &amp; directories
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/70" />
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Search by title or grade…"
                      className="w-full border border-line rounded-card pl-9 pr-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                    />
                  </div>
                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      // A focus from the previous category would be
                      // meaningless (and its option wouldn't even exist
                      // in the new dropdown) once the category changes.
                      setFocusFilter("");
                      if (e.target.value) trackEvent("filter_used", { metadata: { filterType: "category" } });
                    }}
                    className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                  >
                    <option value="">All categories</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {availableFocuses.length > 0 && (
                    <select
                      aria-label={`Filter by ${categoryFilter} focus`}
                      value={focusFilter}
                      onChange={(e) => {
                        setFocusFilter(e.target.value);
                        if (e.target.value) trackEvent("filter_used", { metadata: { filterType: "focus" } });
                      }}
                      className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                    >
                      <option value="">Any {categoryFilter} focus</option>
                      {availableFocuses.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    aria-label="Filter by program type"
                    value={programTypeFilter}
                    onChange={(e) => {
                      setProgramTypeFilter(e.target.value);
                      if (e.target.value) trackEvent("filter_used", { metadata: { filterType: "programType" } });
                    }}
                    className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                  >
                    <option value="">Any program type</option>
                    {(Object.keys(PROGRAM_TYPE_LABELS) as ProgramType[]).map((pt) => (
                      <option key={pt} value={pt}>
                        {PROGRAM_TYPE_LABELS[pt]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by delivery mode"
                    value={deliveryModeFilter}
                    onChange={(e) => {
                      setDeliveryModeFilter(e.target.value);
                      if (e.target.value) trackEvent("filter_used", { metadata: { filterType: "deliveryMode" } });
                    }}
                    className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                  >
                    <option value="">Any delivery mode</option>
                    <option value="in_person">In person</option>
                    <option value="virtual">Virtual</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                  <select
                    aria-label="Filter by cost"
                    value={compensationFilter}
                    onChange={(e) => {
                      setCompensationFilter(e.target.value);
                      if (e.target.value) trackEvent("filter_used", { metadata: { filterType: "compensation" } });
                    }}
                    className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                  >
                    <option value="">Any cost</option>
                    {(Object.keys(COMPENSATION_LABELS) as Compensation[]).map((c) => (
                      <option key={c} value={c}>
                        {COMPENSATION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-ink/70">
                    <input
                      type="checkbox"
                      checked={withinRadiusOnly}
                      onChange={(e) => {
                        setWithinRadiusOnly(e.target.checked);
                        if (e.target.checked) trackEvent("filter_used", { metadata: { filterType: "withinRadius" } });
                      }}
                      className="rounded border-line"
                    />
                    Within my preferred radius only
                  </label>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              </div>

              <p className="text-sm text-ink/70 mb-6">
                {totalResults} result{totalResults === 1 ? "" : "s"}
              </p>

              {totalResults === 0 ? (
                <EmptyState
                  icon={<SearchIcon className="w-8 h-8" />}
                  title="No results match these filters"
                  description="Try a different search term, or clear filters to see the full list."
                  action={
                    <Button variant="primary" size="md" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-10">
                  {(["open", "seasonal", "watch", "closed"] as ExploreSection[]).map((section) => {
                    const items = bySection[section];
                    if (items.length === 0) return null;
                    return (
                      <div key={section}>
                        <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
                          {EXPLORE_SECTION_LABELS[section]} ({items.length})
                        </h2>
                        {/* Single-column stack of horizontal cards, not a
                            3-column grid — see app/dashboard/page.tsx's
                            identical comment for why (grid row stretching
                            was leaving uneven blank space under shorter
                            cards). */}
                        <div className="flex flex-col gap-4">
                          {items.map(({ opp, locationLabel, outsideRadius }) => (
                            <ExploreOpportunityCard
                              key={opp.id}
                              id={opp.id}
                              title={opp.title}
                              org={opp.organizations?.name ?? ""}
                              orgId={opp.organization_id}
                              description={opp.description}
                              category={opp.category}
                              minAge={opp.minimum_age}
                              location={opp.location}
                              locationLabel={locationLabel}
                              outsideRadius={outsideRadius}
                              scheduleSlots={opp.schedule_slots}
                              commitmentType={opp.commitment_type}
                              availabilityStatus={opp.availability_status}
                              availabilityNote={opp.availability_note}
                              applicationUrl={opp.application_url}
                              sourceUrl={opp.source_url}
                              applicationDeadline={opp.application_deadline}
                              lastVerifiedAt={opp.last_verified_at}
                              programType={opp.program_type}
                              compensation={opp.compensation}
                              deliveryMode={opp.delivery_mode}
                              cost={opp.cost}
                              financialAidAvailable={opp.financial_aid_available}
                              eligibleGrades={opp.eligible_grades}
                              timeCommitment={opp.time_commitment}
                              arizonaResidencyRequired={opp.arizona_residency_required}
                              parentalConsentRequired={opp.parental_consent_required}
                              healthScreeningRequired={opp.health_screening_required}
                              backgroundCheckRequired={opp.background_check_required}
                              directPatientContact={opp.direct_patient_contact}
                              researchComponent={opp.research_component}
                              shadowingComponent={opp.shadowing_component}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {showDirectories && visibleDirectoryOrgs.length > 0 && (
                    <div>
                      <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
                        Organizations &amp; directories ({visibleDirectoryOrgs.length})
                      </h2>
                      <div className="grid md:grid-cols-3 gap-5">
                        {visibleDirectoryOrgs.map((org) => (
                          <ExploreOrgCard
                            key={org.id}
                            id={org.id}
                            name={org.name}
                            description={org.description}
                            city={org.city}
                            lastVerifiedAt={org.last_verified_at}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
