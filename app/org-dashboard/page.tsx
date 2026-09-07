"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAccountInfo } from "@/lib/accountRole";
import { embedAndAttach } from "@/lib/embedAndAttach";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/Button";
import CsvImportPanel from "@/components/CsvImportPanel";
import { ClipboardIcon } from "@/components/icons";
import { CATEGORY_OPTIONS, CATEGORY_TAG_MAP } from "@/lib/constants";
import { daysUntil, deadlineLabel, deadlineBadgeClass } from "@/lib/dates";

const TAG_OPTIONS = Object.values(CATEGORY_TAG_MAP);

const SCHEDULE_OPTIONS = [
  "weekday_morning",
  "weekday_afternoon",
  "weekday_evening",
  "saturday_morning",
  "saturday_afternoon",
  "sunday_morning",
  "sunday_afternoon",
];

const INPUT_CLASS =
  "w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss";

function toggleButtonClass(active: boolean) {
  return `text-sm px-3 py-1.5 rounded-card border transition-all duration-150 active:scale-95 ${
    active
      ? "bg-moss text-white border-moss shadow-soft"
      : "bg-white text-ink border-line hover:border-moss hover:shadow-pop"
  }`;
}

type ApplicantStatus = "applied" | "accepted" | "completed";

type ApplicantRow = {
  id: string;
  status: ApplicantStatus;
  updated_at: string;
  opportunity: { id: string; title: string } | null;
  applicantEmail: string | null;
};

const APPLICANT_NEXT_STATUS: Record<ApplicantStatus, ApplicantStatus | null> = {
  applied: "accepted",
  accepted: "completed",
  completed: null,
};
const APPLICANT_NEXT_LABEL: Record<ApplicantStatus, string> = {
  applied: "Mark as Accepted",
  accepted: "Mark as Completed",
  completed: "",
};

type OpportunityRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  minimum_age: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  application_deadline: string | null;
  schedule_slots: string[];
  skills_required: string[];
  interests_tags: string[];
  commitment_type: "one_time" | "recurring";
  organization_id: string | null;
  source: string;
  external_id: string | null;
};

export default function OrgDashboardPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [minAge, setMinAge] = useState(13);
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [interestsTags, setInterestsTags] = useState<string[]>([]);
  const [skillsRequired, setSkillsRequired] = useState<string[]>([]);
  const [commitment, setCommitment] = useState<"one_time" | "recurring">(
    "one_time"
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // null = not loaded yet. Distinct from 0 (loaded, genuinely no
  // applications) so the stat card can show "…" instead of a
  // momentarily-wrong "0" while the count query is in flight.
  const [applicationCount, setApplicationCount] = useState<number | null>(null);

  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(true);
  // Reserved for list-load failures only (the whole "Applicants" section
  // failed to fetch) — a single status-update failure gets its own
  // per-row entry in applicantErrors instead, so one bad update doesn't
  // read as "everything is broken" and stays attributable to the row
  // that actually failed.
  const [applicantsError, setApplicantsError] = useState<string | null>(null);
  const [applicantErrors, setApplicantErrors] = useState<Record<string, string>>({});
  const [updatingApplicantId, setUpdatingApplicantId] = useState<string | null>(null);
  // Transient — cleared a couple seconds after a successful status
  // update. There's no toast component anywhere in this app to reuse,
  // so this stays a small in-place confirmation next to the row's
  // status badge rather than introducing a new UI pattern for one spot.
  const [justUpdatedApplicantId, setJustUpdatedApplicantId] = useState<string | null>(null);

  // null = still checking. Unlike /admin (gated on the `admins` table),
  // this page is gated on organization_accounts — the same table the
  // opportunities RLS policies check, so "can this page load the form"
  // and "will a write actually be accepted" always agree.
  const [org, setOrg] = useState<{ id: string; name: string } | false | null>(null);

  // Each wrapped in useCallback with a genuinely stable dependency list
  // (no reads from component state/props — organizationId/opportunityIds
  // always come in as parameters) so the mount effect below can list them
  // as real dependencies without re-running on every render: a plain
  // function declaration gets a new reference every render, which would
  // turn "load once on mount" into "load on every render" the moment it's
  // added to a dependency array — confirmed while fixing this, not assumed.

  // A student's own applications policy doesn't cover this — org reps
  // read via a separate policy scoped through organization_accounts
  // (see supabase/schema.sql). count: 'exact', head: true asks Postgres
  // for just the row count, not the rows themselves.
  //
  // Excludes status='saved' (a bookmark, not an application) — same
  // filter app/api/org/applicants/route.ts already applies, so this stat
  // always agrees with how many rows actually show up in the Applicants
  // list right below it.
  const loadApplicationCount = useCallback(async (opportunityIds: string[]) => {
    if (opportunityIds.length === 0) {
      setApplicationCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .in("opportunity_id", opportunityIds)
      .neq("status", "saved");
    setApplicationCount(error ? 0 : count ?? 0);
  }, []);

  const loadOpportunities = useCallback(async (organizationId: string) => {
    setListLoading(true);
    const { data } = await supabase
      .from("opportunities")
      .select(
        "id, title, description, category, minimum_age, location, latitude, longitude, application_deadline, schedule_slots, skills_required, interests_tags, commitment_type, organization_id, source, external_id"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as OpportunityRow[];
    setOpportunities(rows);
    setListLoading(false);
    loadApplicationCount(rows.map((r) => r.id));
  }, [loadApplicationCount]);

  // Goes through a server route rather than a plain client-side query —
  // an applicant's email lives in auth.users, which only the service
  // role can read (see app/api/org/applicants/route.ts for why that's
  // still safe: the route re-derives which applications are this org's
  // own from the caller's own session, never from anything the client
  // sends).
  const loadApplicants = useCallback(async () => {
    setApplicantsLoading(true);
    setApplicantsError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setApplicantsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/org/applicants", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setApplicants(body.applicants ?? []);
    } catch (err) {
      setApplicantsError(err instanceof Error ? err.message : "Couldn't load applicants.");
    } finally {
      setApplicantsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadOrg() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setOrg(false);
        return;
      }
      // Student-only accounts belong on /dashboard, not the "no
      // organization linked to this account" fallback below — that
      // fallback is meant for an org rep mid-onboarding, not a student
      // who wandered onto this URL.
      const info = await getAccountInfo();
      if (info?.role === "student") {
        router.replace("/dashboard");
        return;
      }
      const { data: account } = await supabase
        .from("organization_accounts")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!account) {
        setOrg(false);
        return;
      }
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", account.organization_id)
        .maybeSingle();
      if (!orgRow) {
        setOrg(false);
        return;
      }
      setOrg(orgRow);
      loadOpportunities(orgRow.id);
      loadApplicants();
    }
    loadOrg();
    // loadOpportunities/loadApplicants are stable (useCallback, above) and
    // router is a stable reference from next/navigation's useRouter — none
    // of the three ever actually change identity, so this still only runs
    // once on a real mount despite now correctly listing every value it
    // reads from outer scope.
  }, [loadOpportunities, loadApplicants, router]);

  // The actual status change is an RPC call, not a table update — see
  // org_update_application_status() in supabase/schema.sql. It
  // re-checks org ownership itself, so this is safe even though it runs
  // with the org rep's own (anon-key) session, same trust level as any
  // other client-side write in this app.
  async function handleAdvanceApplicant(applicant: ApplicantRow) {
    const next = APPLICANT_NEXT_STATUS[applicant.status];
    if (!next) return;
    setUpdatingApplicantId(applicant.id);
    // Clear any stale error for this row from a previous failed attempt
    // — a retry that succeeds shouldn't leave the old message behind.
    setApplicantErrors((prev) => {
      if (!(applicant.id in prev)) return prev;
      const { [applicant.id]: _removed, ...rest } = prev;
      return rest;
    });
    const { error } = await supabase.rpc("org_update_application_status", {
      application_id: applicant.id,
      new_status: next,
    });
    setUpdatingApplicantId(null);
    if (error) {
      setApplicantErrors((prev) => ({ ...prev, [applicant.id]: error.message }));
      return;
    }
    setJustUpdatedApplicantId(applicant.id);
    setTimeout(() => {
      setJustUpdatedApplicantId((current) => (current === applicant.id ? null : current));
    }, 2000);
    setApplicants((prev) =>
      prev.map((a) => (a.id === applicant.id ? { ...a, status: next } : a))
    );
  }

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory(CATEGORY_OPTIONS[0]);
    setMinAge(13);
    setLocation("");
    setLatitude("");
    setLongitude("");
    setApplicationDeadline("");
    setSchedule([]);
    setInterestsTags([]);
    setSkillsRequired([]);
    setCommitment("one_time");
    setEditingId(null);
  }

  function startEdit(opp: OpportunityRow) {
    setEditingId(opp.id);
    setTitle(opp.title);
    setDescription(opp.description ?? "");
    setCategory(opp.category);
    setMinAge(opp.minimum_age);
    setLocation(opp.location ?? "");
    setLatitude(opp.latitude != null ? String(opp.latitude) : "");
    setLongitude(opp.longitude != null ? String(opp.longitude) : "");
    setApplicationDeadline(opp.application_deadline ?? "");
    setSchedule(opp.schedule_slots);
    setInterestsTags(opp.interests_tags);
    setSkillsRequired(opp.skills_required);
    setCommitment(opp.commitment_type);
    setStatus(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete(opp: OpportunityRow) {
    const confirmed = window.confirm(
      `Delete "${opp.title}"? This also removes any students' saved/tracked applications for it.`
    );
    if (!confirmed) return;

    // .select("id") turns a silent RLS no-op (delete matches zero rows —
    // e.g. this row somehow isn't this organization's) into a real error
    // instead of a false "Opportunity deleted." Same defense as /admin.
    const { data, error } = await supabase
      .from("opportunities")
      .delete()
      .eq("id", opp.id)
      .select("id");
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setStatus("Error: nothing was deleted.");
      return;
    }
    if (editingId === opp.id) resetForm();
    setStatus("Opportunity deleted.");
    if (org) loadOpportunities(org.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setStatus(null);
    setSaving(true);

    const payload = {
      organization_id: org.id,
      title,
      description,
      category,
      minimum_age: minAge,
      location,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      application_deadline: applicationDeadline || null,
      schedule_slots: schedule,
      interests_tags: interestsTags,
      skills_required: skillsRequired,
      commitment_type: commitment,
    };

    const descriptionText = description;

    const { data: savedRow, error } = editingId
      ? await supabase.from("opportunities").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("opportunities").insert(payload).select("id").single();

    setSaving(false);

    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }

    setStatus(editingId ? "Opportunity updated!" : "Opportunity added!");
    resetForm();
    loadOpportunities(org.id);

    if (savedRow) {
      embedAndAttach(savedRow.id, descriptionText);
    }
  }

  if (org === null) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <p className="text-sm text-ink/70 max-w-xl mx-auto">Loading…</p>
        </main>
      </>
    );
  }

  if (org === false) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <div className="max-w-xl mx-auto">
            <EmptyState
              title="No organization linked to this account"
              description="This page is for organization accounts that have completed setup. If you're representing an organization, finish onboarding first."
              action={
                <Button href="/onboarding/organization" variant="primary" size="md">
                  Set up your organization
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
        <div className="animate-fade-in-up max-w-xl mx-auto mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            {org.name}
          </p>
          <h1 className="font-display text-3xl font-semibold mb-6">Dashboard</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-line rounded-card shadow-soft p-5">
              <p className="text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Total opportunities
              </p>
              <p className="font-display text-3xl font-semibold">
                {listLoading ? "…" : opportunities.length}
              </p>
            </div>
            <div className="bg-white border border-line rounded-card shadow-soft p-5">
              <p className="text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Applications received
              </p>
              <p className="font-display text-3xl font-semibold">
                {applicationCount === null ? "…" : applicationCount}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-xl mx-auto mb-16">
          <h2 className="font-display text-2xl font-semibold mb-6">Applicants</h2>

          {applicantsError && (
            <p className="animate-fade-in text-sm px-3 py-2 rounded-card border text-red-700 bg-red-50 border-red-200 mb-4">
              {applicantsError}
            </p>
          )}

          {applicantsLoading ? (
            <p className="text-sm text-ink/70">Loading…</p>
          ) : applicants.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="No applicants yet"
              description="Once a student applies to one of your opportunities, they'll show up here so you can follow up and update their status."
            />
          ) : (
            <div className="bg-white border border-line rounded-card shadow-soft divide-y divide-line overflow-hidden">
              {applicants.map((applicant) => {
                const next = APPLICANT_NEXT_STATUS[applicant.status];
                const rowError = applicantErrors[applicant.id];
                const justUpdated = justUpdatedApplicantId === applicant.id;
                return (
                  <div key={applicant.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-display text-base font-semibold truncate">
                          {applicant.applicantEmail ?? "Email unavailable"}
                        </p>
                        <p className="text-sm text-ink/70 truncate">
                          {applicant.opportunity?.title ?? "Deleted opportunity"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={applicant.status} />
                        {justUpdated && (
                          <span className="animate-fade-in text-xs font-mono uppercase tracking-wide text-moss-dark">
                            Updated
                          </span>
                        )}
                        {next && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={updatingApplicantId === applicant.id}
                            onClick={() => handleAdvanceApplicant(applicant)}
                          >
                            {updatingApplicantId === applicant.id
                              ? "Saving…"
                              : APPLICANT_NEXT_LABEL[applicant.status]}
                          </Button>
                        )}
                      </div>
                    </div>
                    {rowError && (
                      <p className="animate-fade-in text-xs text-red-700 bg-red-50 border border-red-200 rounded-card px-2.5 py-1.5 self-start">
                        {rowError}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="animate-fade-in-up max-w-xl mx-auto flex flex-col gap-6"
        >
          <h2 className="font-display text-2xl font-semibold">
            {editingId ? "Edit opportunity" : "Add an opportunity"}
          </h2>

          <div className="bg-white border border-line rounded-card shadow-soft p-6 flex flex-col gap-6">
            <div>
              <label htmlFor="org-dashboard-opp-title" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Title
              </label>
              <input
                id="org-dashboard-opp-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="org-dashboard-opp-description" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Description
              </label>
              <textarea
                id="org-dashboard-opp-description"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="org-dashboard-opp-category" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                  Category
                </label>
                <select
                  id="org-dashboard-opp-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="org-dashboard-opp-min-age" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                  Minimum age
                </label>
                <input
                  id="org-dashboard-opp-min-age"
                  type="number"
                  min={13}
                  max={19}
                  required
                  value={minAge}
                  onChange={(e) => setMinAge(Number(e.target.value))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label htmlFor="org-dashboard-opp-location" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Location
              </label>
              <input
                id="org-dashboard-opp-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="org-dashboard-opp-deadline" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Application deadline{" "}
                <span className="normal-case text-ink/70">(optional)</span>
              </label>
              <input
                id="org-dashboard-opp-deadline"
                type="date"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-dashboard-opp-latitude" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                    Latitude <span className="normal-case text-ink/70">(optional)</span>
                  </label>
                  <input
                    id="org-dashboard-opp-latitude"
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 39.9612"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="org-dashboard-opp-longitude" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                    Longitude <span className="normal-case text-ink/70">(optional)</span>
                  </label>
                  <input
                    id="org-dashboard-opp-longitude"
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. -82.9988"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <p className="text-xs text-ink/70 mt-2">
                Coordinates power the real distance calculation on the dashboard.
                Without them, this opportunity won&apos;t appear in any
                student&apos;s matches at all.
              </p>
            </div>

            <div>
              <span id="org-dashboard-schedule-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
                Schedule
              </span>
              <div role="group" aria-labelledby="org-dashboard-schedule-label" className="flex flex-wrap gap-2">
                {SCHEDULE_OPTIONS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggle(schedule, setSchedule, s)}
                    aria-pressed={schedule.includes(s)}
                    className={toggleButtonClass(schedule.includes(s))}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span id="org-dashboard-tags-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
                Interest tags
              </span>
              <div role="group" aria-labelledby="org-dashboard-tags-label" className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggle(interestsTags, setInterestsTags, t)}
                    aria-pressed={interestsTags.includes(t)}
                    className={toggleButtonClass(interestsTags.includes(t))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span id="org-dashboard-commitment-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
                Commitment
              </span>
              <div role="group" aria-labelledby="org-dashboard-commitment-label" className="flex gap-2">
                {(["one_time", "recurring"] as const).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCommitment(c)}
                    aria-pressed={commitment === c}
                    className={toggleButtonClass(commitment === c)}
                  >
                    {c === "one_time" ? "One-time" : "Recurring"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {status && (
            <p
              className={`animate-fade-in text-sm px-3 py-2 rounded-card border ${
                status.startsWith("Error")
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-moss-dark bg-moss-light border-moss/30"
              }`}
            >
              {status}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="lg" disabled={saving} className="self-start">
              {saving ? "Saving…" : editingId ? "Save changes" : "Add opportunity"}
            </Button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-ink/70 underline underline-offset-2 hover:text-ink transition-colors"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <div className="max-w-xl mx-auto mt-16">
          <CsvImportPanel
            organizationId={org.id}
            existingOpportunities={opportunities.map((o) => ({
              id: o.id,
              title: o.title,
              source: o.source,
              external_id: o.external_id,
            }))}
            onImportComplete={() => loadOpportunities(org.id)}
          />
        </div>

        <div className="max-w-xl mx-auto mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            {opportunities.length} posted
          </p>
          <h2 className="font-display text-2xl font-semibold mb-6">
            {org.name}&apos;s opportunities
          </h2>

          {listLoading ? (
            <p className="text-sm text-ink/70">Loading…</p>
          ) : opportunities.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="Nothing posted yet"
              description="Opportunities you add above will show up here."
            />
          ) : (
            <div className="bg-white border border-line rounded-card shadow-soft divide-y divide-line overflow-hidden">
              {opportunities.map((opp) => {
                const days = opp.application_deadline
                  ? daysUntil(opp.application_deadline)
                  : null;
                return (
                  <div
                    key={opp.id}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-base font-semibold truncate">
                          {opp.title}
                        </h3>
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
                      <p className="text-sm text-ink/70 truncate">{opp.category}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(opp)}
                        className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(opp)}
                        className="text-sm text-red-700 hover:text-red-700 underline underline-offset-2 transition-colors"
                      >
                        Delete
                      </button>
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
