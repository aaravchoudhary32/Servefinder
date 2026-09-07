"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/analytics";
import { advanceApplicationStatus } from "@/lib/applications";
import {
  rankOpportunities,
  rankOpportunitiesSemantic,
  StudentProfile,
  Opportunity,
} from "@/lib/matching";
import OpportunityCard, { MatchFeedbackReason } from "@/components/OpportunityCard";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import { CompassIcon, SearchIcon } from "@/components/icons";
import { ApplicationStatus, STATUS_LABELS, nextStatus } from "@/lib/applicationStatus";
import { geocodeStudentLocation } from "@/lib/geocode";
import { resolveDistanceMiles, distanceLabel } from "@/lib/distance";
import { CATEGORY_OPTIONS, COMMITMENT_OPTIONS } from "@/lib/constants";
import { getAccountInfo, homeRouteFor } from "@/lib/accountRole";
import { ProgramType, Compensation, DeliveryMode } from "@/lib/availabilityStatus";

type ProfileRow = {
  age: number;
  city: string | null;
  zip_code: string | null;
  max_distance_miles: number;
  interests: string[];
  skills: string[];
  availability: string[];
  commitment_preference: "one_time" | "recurring" | "either";
};

type OpportunityRow = {
  id: string;
  title: string;
  description: string | null;
  organization_id: string | null;
  organizations: { name: string } | null;
  category: string;
  minimum_age: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  schedule_slots: string[];
  skills_required: string[];
  interests_tags: string[];
  commitment_type: "one_time" | "recurring";
  application_deadline: string | null;
  application_url: string | null;
  source_url: string | null;
  is_stale: boolean;
  last_verified_at: string | null;
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

export default function DashboardPage() {
  const router = useRouter();

  // Fires once per real visit (deduped within a short window — see
  // lib/analytics.ts) regardless of loading/error state below, since
  // the student did land on the dashboard either way. Deliberately not
  // in the "meaningful action" set the admin analytics functions treat
  // as active-user signal — a page load alone shouldn't count as
  // engagement, same reasoning as excluding a bare homepage visit.
  useEffect(() => {
    trackEvent("dashboard_viewed", { dedupe: true });
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when the student's own location couldn't be geocoded (bad ZIP,
  // unresolvable city, or a transient third-party API failure) — distinct
  // from "genuinely no matches nearby" so the empty state below can say
  // the right thing instead of suggesting they widen a radius that was
  // never actually applied.
  const [locationUnresolved, setLocationUnresolved] = useState(false);
  // Raw inputs to the scoring engine, kept around (rather than only storing
  // the already-ranked result) so matches/semanticMatches can be derived
  // via useMemo instead of threading extra state through the load effect.
  const [rawData, setRawData] = useState<{
    profile: StudentProfile;
    opportunities: Opportunity[];
  } | null>(null);
  const [studentEmbedding, setStudentEmbedding] = useState<number[] | null>(null);
  // Per-opportunity embeddings, loaded separately from the main
  // opportunities query (see the load effect below) — this is what
  // shrank the initial dashboard payload from ~1.9MB to a fraction of
  // that: 1,000+ 384-dim vectors serialized as JSON is real weight
  // classic-mode (the default view) never needed to wait on. Merged in
  // only when computing semanticMatches, never touches classic ranking.
  const [oppEmbeddings, setOppEmbeddings] = useState<Record<string, number[] | null>>({});
  const [applications, setApplications] = useState<
    Record<string, { id: string; status: ApplicationStatus }>
  >({});
  // Keyed by `${opportunityId}:${algorithm}` — a student can rate the
  // same opportunity separately under classic and semantic if they
  // toggle modes, so the key has to include which mode was active.
  const [matchFeedback, setMatchFeedback] = useState<Record<string, boolean>>({});
  const [opportunityDetails, setOpportunityDetails] = useState<
    Record<string, OpportunityRow>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [commitmentFilter, setCommitmentFilter] = useState("");
  const [showStale, setShowStale] = useState(false);
  const [matchMode, setMatchMode] = useState<"classic" | "semantic">("classic");
  const [semanticStatus, setSemanticStatus] = useState<"loading" | "ready" | "error">("loading");
  // match_viewed dedup: fires once per opportunity the first time it
  // appears in this session's results, not on every filter/search
  // re-render — a ref (not state) since tracking "have we seen this"
  // shouldn't itself trigger a re-render.
  const viewedOpportunityIds = useRef<Set<string>>(new Set());

  // Distance is a hard filter (lib/matching.ts, isWithinRange) same as age
  // — an opportunity beyond the student's max travel radius never appears
  // here at all, there's no toggle to reveal it.
  const matches = useMemo(
    () => (rawData ? rankOpportunities(rawData.profile, rawData.opportunities) : []),
    [rawData]
  );
  const semanticMatches = useMemo(() => {
    if (!rawData || semanticStatus !== "ready") return [];
    // Embeddings are merged in here, not stored on rawData.opportunities
    // itself — classic-mode ranking (the `matches` memo above) never
    // needs them, and merging in a separate object means embeddings
    // arriving later doesn't force classic matches to recompute.
    const opportunitiesWithEmbeddings = rawData.opportunities.map((o) => ({
      ...o,
      descriptionEmbedding: oppEmbeddings[o.id] ?? null,
    }));
    return rankOpportunitiesSemantic(rawData.profile, studentEmbedding, opportunitiesWithEmbeddings);
  }, [rawData, studentEmbedding, semanticStatus, oppEmbeddings]);

  const activeMatches = matchMode === "semantic" && semanticStatus === "ready" ? semanticMatches : matches;

  const filteredMatches = activeMatches.filter(({ opportunity }) => {
    if (!showStale && opportunityDetails[opportunity.id]?.is_stale) return false;
    if (
      searchQuery &&
      !opportunity.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (categoryFilter && opportunity.category !== categoryFilter) return false;
    if (commitmentFilter && opportunity.commitmentType !== commitmentFilter) return false;
    return true;
  });

  // A primitive dependency (not the filteredMatches array itself, which
  // is a new reference every render) so this effect only actually re-runs
  // when the set of visible opportunities changes, not on every unrelated
  // re-render. Declared here, before the loading/error early returns
  // below, because every hook (useEffect included) must run
  // unconditionally on every render — placing this after an early
  // return would skip registering it whenever that branch is taken,
  // which is exactly the "rendered more hooks than previous render"
  // crash this caused when it was first added further down.
  const filteredMatchIds = filteredMatches.map((m) => m.opportunity.id).join(",");
  useEffect(() => {
    for (const { opportunity } of filteredMatches) {
      if (viewedOpportunityIds.current.has(opportunity.id)) continue;
      viewedOpportunityIds.current.add(opportunity.id);
      trackEvent("match_viewed", { opportunityId: opportunity.id, metadata: { matchMode } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMatchIds, matchMode]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?mode=login");
        return;
      }

      // This page is student-only — an organization account has no
      // `profiles` row and never will, so redirect before even trying
      // that query rather than showing a "couldn't find your profile"
      // error that doesn't apply to them.
      const account = await getAccountInfo();
      if (account?.role === "organization") {
        router.replace(homeRouteFor(account));
        return;
      }

      const [{ data: profile, error: profileError }, { data: opps, error: oppsError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "age, city, zip_code, max_distance_miles, interests, skills, availability, commitment_preference"
            )
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("opportunities")
            .select(
              "id, title, description, organization_id, organizations(name), category, minimum_age, location, latitude, longitude, schedule_slots, skills_required, interests_tags, commitment_type, application_deadline, application_url, source_url, is_stale, last_verified_at, program_type, compensation, cost, financial_aid_available, eligible_grades, time_commitment, arizona_residency_required, parental_consent_required, health_screening_required, background_check_required, direct_patient_contact, research_component, shadowing_component, delivery_mode"
            )
            // Seasonal/unverified/closed manual records are real data
            // (visible on their org's own detail page with a status
            // badge) but never enter ranked matching — see
            // ARCHITECTURE.md's "Manual source integration" section.
            .eq("availability_status", "open"),
        ]);

      if (profileError || !profile) {
        setError(
          "We couldn't find your profile yet. Let's finish setting it up first."
        );
        setLoading(false);
        return;
      }

      if (oppsError) {
        setError(oppsError.message);
        setLoading(false);
        return;
      }

      const { data: apps } = await supabase
        .from("applications")
        .select("id, opportunity_id, status")
        .eq("user_id", user.id);

      setApplications(
        Object.fromEntries(
          (apps ?? []).map((a) => [
            a.opportunity_id,
            { id: a.id, status: a.status as ApplicationStatus },
          ])
        )
      );

      const { data: feedback } = await supabase
        .from("match_feedback")
        .select("opportunity_id, algorithm, helpful")
        .eq("user_id", user.id);

      setMatchFeedback(
        Object.fromEntries(
          (feedback ?? []).map((f) => [`${f.opportunity_id}:${f.algorithm}`, f.helpful as boolean])
        )
      );

      const studentProfile: StudentProfile = {
        age: (profile as ProfileRow).age,
        interests: (profile as ProfileRow).interests,
        skills: (profile as ProfileRow).skills,
        availability: (profile as ProfileRow).availability,
        maxDistanceMiles: (profile as ProfileRow).max_distance_miles,
        commitmentPreference: (profile as ProfileRow).commitment_preference,
      };

      const studentCoords = await geocodeStudentLocation(
        (profile as ProfileRow).zip_code,
        (profile as ProfileRow).city
      );

      const oppRows = (opps ?? []) as unknown as OpportunityRow[];

      setOpportunityDetails(Object.fromEntries(oppRows.map((o) => [o.id, o])));

      // No pre-filtering of unresolvable distances here anymore — every
      // fetched opportunity is passed through, distanceMiles possibly
      // null. lib/matching.ts's isWithinRange()/distanceFit() are what
      // decide what a null distance means: excluded for an in_person
      // opportunity (the default — unresolved location, same safety
      // behavior as before), never excluded for virtual/hybrid (distance
      // doesn't apply at all). See lib/distance.ts's resolveDistanceMiles.
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
        // Loaded separately, in the background — see loadOppEmbeddings
        // below and the semanticMatches memo, which merges them in only
        // when semantic scoring actually runs.
        descriptionEmbedding: null,
      }));

      // studentCoords being null (their own location failed to geocode)
      // is surfaced distinctly from "genuinely no matches" so the empty
      // state doesn't tell a student to widen their travel radius when
      // the real problem is that we don't know where they are at all.
      // Note this is about the STUDENT's location, not any individual
      // opportunity's — virtual/hybrid opportunities can still match
      // even when this is true, since they don't need studentCoords at
      // all (see isWithinRange).
      setLocationUnresolved(studentCoords === null && oppRows.length > 0);

      setRawData({ profile: studentProfile, opportunities });
      setLoading(false);

      // Semantic mode runs in the background and never blocks the initial
      // render — the local embedding model can take several seconds on a
      // cold start, and classic matching should feel exactly as fast as
      // it always has regardless of whether semantic is available yet.
      loadSemanticMatches(studentProfile);
      loadOppEmbeddings();
    }

    // Per-opportunity embeddings are real weight (384 floats each,
    // serialized as JSON, across 1,000+ open opportunities) that only
    // semantic mode needs — fetched here as its own request so it can
    // run fully in parallel with (and never block) the classic-mode
    // render above. A student who never touches the Semantic toggle
    // pays nothing extra for this; one who does sees scores fill in
    // shortly after, the same "not yet indexed" degradation the app
    // already shows for opportunities with no embedding at all.
    async function loadOppEmbeddings() {
      const { data, error } = await supabase.from("opportunities").select("id, embedding").eq("availability_status", "open");
      if (error || !data) return;
      setOppEmbeddings(Object.fromEntries(data.map((row) => [row.id, row.embedding as number[] | null])));
    }

    async function loadSemanticMatches(studentProfile: StudentProfile) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated.");

        const res = await fetch("/api/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text: studentProfile.interests.join(", ") }),
        });
        if (!res.ok) throw new Error(`embeddings API returned ${res.status}`);
        const { embedding } = await res.json();

        setStudentEmbedding(embedding);
        setSemanticStatus("ready");
      } catch (err) {
        console.error("Semantic matching unavailable:", err);
        setSemanticStatus("error");
      }
    }

    load();
  }, [router]);

  async function saveOpportunity(opportunityId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("applications")
      .insert({ user_id: user.id, opportunity_id: opportunityId, status: "saved" })
      .select("id, status")
      .single();

    if (error || !data) return;

    setApplications((prev) => ({
      ...prev,
      [opportunityId]: { id: data.id, status: data.status as ApplicationStatus },
    }));

    // Both fire on this one click: match_saved answers "did this listing
    // get bookmarked," application_started answers "did the applications
    // funnel begin" — saving is the funnel-entry moment, since there's no
    // separate multi-step apply flow in this app.
    trackEvent("match_saved", { opportunityId, applicationId: data.id, metadata: { matchMode } });
    trackEvent("application_started", { opportunityId, applicationId: data.id, metadata: { matchMode } });
  }

  async function unsave(opportunityId: string, applicationId: string) {
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", applicationId);
    if (error) return;

    setApplications((prev) => {
      const next = { ...prev };
      delete next[opportunityId];
      return next;
    });
    // No applicationId here, unlike every other event in this file:
    // analytics_events.application_id is a foreign key to applications(id),
    // and the row it would point to was just deleted above — including it
    // made this insert fail its FK constraint 100% of the time (a 409,
    // silently swallowed by trackEvent's own try/catch), so
    // opportunity_unsaved never recorded a single row in production.
    // Found live, by checking analytics_events after a real unsave click
    // came back empty, then confirming the exact cause via this insert's
    // network response.
    trackEvent("opportunity_unsaved", { opportunityId, metadata: { matchMode } });
  }

  async function advanceStatus(opportunityId: string, applicationId: string, status: ApplicationStatus) {
    const next = await advanceApplicationStatus(supabase, {
      id: applicationId,
      status,
      opportunityId,
    });
    if (!next) return;

    setApplications((prev) => ({
      ...prev,
      [opportunityId]: { id: applicationId, status: next },
    }));
    // application_status_changed/application_submitted/opportunity_completed
    // already fire from inside advanceApplicationStatus() for every
    // transition — this is the one additional, more specific event for
    // "accepted" (see lib/analytics.ts's AnalyticsEventType for why this
    // only fires from the student's own self-report path, not an org's).
    if (next === "accepted") {
      trackEvent("opportunity_accepted", { opportunityId, applicationId });
    }
  }

  // Upserts on the (user_id, opportunity_id, algorithm) unique index —
  // a student can change their mind (thumbs down, then pick a reason
  // moments later) without creating duplicate rows.
  async function submitFeedback(opportunityId: string, helpful: boolean, reason?: MatchFeedbackReason) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("match_feedback").upsert(
      {
        user_id: user.id,
        opportunity_id: opportunityId,
        algorithm: matchMode,
        helpful,
        reason: reason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,opportunity_id,algorithm" }
    );
    if (error) return;

    setMatchFeedback((prev) => ({ ...prev, [`${opportunityId}:${matchMode}`]: helpful }));
    trackEvent("match_feedback_submitted", {
      opportunityId,
      metadata: { matchMode, helpful, ...(reason ? { reason } : {}) },
    });
  }

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

  if (error) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center px-6">
          <div className="animate-fade-in-up text-center max-w-sm">
            <p className="text-ink/70 mb-4">{error}</p>
            <Button href="/onboarding" variant="primary" size="md">
              Go to onboarding
            </Button>
          </div>
        </main>
      </>
    );
  }

  const hasActiveFilters = Boolean(searchQuery || categoryFilter || commitmentFilter);

  const staleCount = matches.filter(
    ({ opportunity }) => opportunityDetails[opportunity.id]?.is_stale
  ).length;

  const classicScoreById = Object.fromEntries(matches.map((m) => [m.opportunity.id, m.score]));
  const semanticScoreById = Object.fromEntries(semanticMatches.map((m) => [m.opportunity.id, m.score]));

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("");
    setCommitmentFilter("");
  }

  return (
    <>
      <NavBar />
      <OnboardingWalkthrough />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-6xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            Your matches
          </p>
          <h1 className="font-display text-3xl font-semibold mb-2">
            {matches.length} opportunit{matches.length === 1 ? "y" : "ies"}{" "}
            found for you
          </h1>
          <p className="text-ink/70 mb-2">
            Ranked by fit. Click save to keep track of ones you&apos;re interested
            in.
          </p>
          <p className="text-sm mb-6">
            Only seeing a few? These are just your currently-open, in-range matches.{" "}
            <Link
              href="/explore"
              className="text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
            >
              Explore upcoming, seasonal, and other programs →
            </Link>
          </p>

          {matches.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Matching algorithm" className="inline-flex rounded-card border border-line overflow-hidden text-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setMatchMode("classic")}
                  aria-pressed={matchMode === "classic"}
                  className={`px-3 py-1.5 transition-colors duration-150 ${
                    matchMode === "classic"
                      ? "bg-moss text-white"
                      : "bg-white text-ink/70 hover:text-ink"
                  }`}
                >
                  Classic
                </button>
                <button
                  type="button"
                  onClick={() => setMatchMode("semantic")}
                  disabled={semanticStatus !== "ready"}
                  aria-pressed={matchMode === "semantic"}
                  className={`px-3 py-1.5 border-l border-line transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                    matchMode === "semantic"
                      ? "bg-moss text-white"
                      : "bg-white text-ink/70 hover:text-ink"
                  }`}
                >
                  Semantic{semanticStatus === "loading" ? "…" : ""}
                </button>
              </div>
              <p className="text-xs text-ink/70">
                {semanticStatus === "loading" &&
                  "Semantic matching is warming up — it compares opportunity descriptions to your interests by meaning, not exact tags."}
                {semanticStatus === "ready" &&
                  "Semantic matches opportunity descriptions to your interests by meaning — try it and compare against classic tag matching."}
                {semanticStatus === "error" &&
                  "Semantic matching couldn't load this time — classic matching still works normally."}
              </p>
            </div>
          )}

          {matches.length > 0 && (
            <div className="bg-white border border-line rounded-card shadow-soft p-4 mb-8 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title…"
                  className="w-full border border-line rounded-card pl-9 pr-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                />
              </div>
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              >
                <option value="">All categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by commitment type"
                value={commitmentFilter}
                onChange={(e) => setCommitmentFilter(e.target.value)}
                className="border border-line rounded-card px-3 py-2 text-sm bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              >
                <option value="">Any commitment</option>
                {COMMITMENT_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              {staleCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-ink/70 ml-auto cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showStale}
                    onChange={(e) => setShowStale(e.target.checked)}
                    className="w-4 h-4 rounded accent-moss cursor-pointer"
                  />
                  Show outdated ({staleCount})
                </label>
              )}
            </div>
          )}

          {matches.length === 0 && locationUnresolved ? (
            <EmptyState
              icon={<CompassIcon className="w-8 h-8" />}
              title="We couldn't find your location"
              description="We couldn't determine your location, so we can't show distance-based matches right now — double-check your ZIP code in your profile, or try again in a moment."
              action={
                <Button href="/onboarding" variant="primary" size="md">
                  Adjust your profile
                </Button>
              }
            />
          ) : matches.length === 0 ? (
            <EmptyState
              icon={<CompassIcon className="w-8 h-8" />}
              title="No matches yet"
              description="There may not be any opportunities within your travel range that fit your age and preferences right now. Check back soon, or widen your max travel distance."
              action={
                <Button href="/onboarding" variant="primary" size="md">
                  Adjust your profile
                </Button>
              }
            />
          ) : filteredMatches.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="w-8 h-8" />}
              title="No opportunities match these filters"
              description="Try a different search term or loosen up a filter."
              action={
                <Button variant="primary" size="md" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            // A single-column stack of wide, horizontal cards — not the
            // 3-column grid this used to be. That grid was the direct
            // cause of a real pilot complaint: CSS grid stretches every
            // cell in a row to the tallest card in that row (grid's
            // default align-items: stretch), so a short card next to a
            // long one just left blank space at its own bottom rather
            // than the row shrinking. A single column sidesteps the
            // problem entirely — every card's height is its own, with no
            // neighboring row to be stretched to match, and the visual
            // order here matches DOM order and keyboard/tab order
            // exactly (no CSS grid/order tricks that could make them
            // diverge).
            <div className="flex flex-col gap-4">
              {/* Visually hidden — each card's own title renders as an h3
                  (components/OpportunityCard.tsx), which needs a real h2
                  ancestor to keep heading order sequential for screen-
                  reader users navigating by heading level. The page's own
                  h1 already says essentially this same thing visibly. */}
              <h2 className="sr-only">Your matched opportunities</h2>
              {filteredMatches.map(({ opportunity, score, breakdown, interestMatch }, i) => {
                const application = applications[opportunity.id];
                const upcoming = application ? nextStatus(application.status) : null;
                const details = opportunityDetails[opportunity.id];

                const comparison =
                  matchMode === "classic"
                    ? semanticStatus === "ready"
                      ? { label: "Semantic", score: semanticScoreById[opportunity.id] ?? 0 }
                      : null
                    : { label: "Classic", score: classicScoreById[opportunity.id] ?? score };

                return (
                  <div
                    key={opportunity.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                  >
                    <OpportunityCard
                      id={opportunity.id}
                      title={opportunity.title}
                      description={details?.description}
                      org={details?.organizations?.name ?? ""}
                      lastVerifiedAt={details?.last_verified_at}
                      interestFitLabel={matchMode === "semantic" ? "Interest (semantic)" : "Interest (tags)"}
                      comparison={comparison}
                      orgId={details?.organization_id}
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
                      applicationDeadline={details?.application_deadline}
                      location={details?.location}
                      applicationUrl={details?.application_url}
                      sourceUrl={details?.source_url}
                      feedbackGiven={matchFeedback[`${opportunity.id}:${matchMode}`]}
                      onFeedback={(helpful, reason) => submitFeedback(opportunity.id, helpful, reason)}
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
                      topBadges={
                        <>
                          {details?.is_stale && (
                            <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-line/40 text-ink/70 border-line">
                              Not recently verified
                            </span>
                          )}
                          {matchMode === "semantic" && !oppEmbeddings[opportunity.id] && (
                            <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-line/40 text-ink/70 border-line">
                              Not yet indexed
                            </span>
                          )}
                        </>
                      }
                      actions={
                        application ? (
                          <div className="flex flex-col items-end gap-2">
                            <StatusBadge status={application.status} />
                            {upcoming && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="min-h-[44px] sm:min-h-0"
                                onClick={() =>
                                  advanceStatus(opportunity.id, application.id, application.status)
                                }
                              >
                                Mark as {STATUS_LABELS[upcoming]}
                              </Button>
                            )}
                            {application.status === "saved" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] sm:min-h-0"
                                onClick={() => unsave(opportunity.id, application.id)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px] sm:min-h-0 hover:border-marigold"
                            onClick={() => saveOpportunity(opportunity.id)}
                          >
                            Save
                          </Button>
                        )
                      }
                    />
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
