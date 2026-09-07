"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { embedAndAttach } from "@/lib/embedAndAttach";
import { trackEvent } from "@/lib/analytics";
import NavBar from "@/components/NavBar";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import AvailabilityBadge from "@/components/AvailabilityBadge";
import { ClipboardIcon } from "@/components/icons";
import { CATEGORY_OPTIONS, CATEGORY_TAG_MAP } from "@/lib/constants";
import { daysUntil, deadlineLabel, deadlineBadgeClass } from "@/lib/dates";
import { AvailabilityStatus } from "@/lib/availabilityStatus";

const NEW_ORG_VALUE = "__new__";

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

// Fire-and-forget: computed after the opportunity is already saved, so a
// slow (or first-ever, model-downloading) embedding call never blocks the
// admin form. Semantic matching just treats the row as unembedded until
// this finishes.
function toggleButtonClass(active: boolean) {
  return `text-sm px-3 py-1.5 rounded-card border transition-all duration-150 active:scale-95 ${
    active
      ? "bg-moss text-white border-moss shadow-soft"
      : "bg-white text-ink border-line hover:border-moss hover:shadow-pop"
  }`;
}

type OrgOption = { id: string; name: string; verified: boolean };

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
  organizations: { name: string } | null;
  availability_status: AvailabilityStatus;
};

export default function AdminPage() {
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
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  // null = still checking. Writes to opportunities/organizations are
  // RLS-gated to rows present in the `admins` table now — checked here so
  // a non-admin sees a clear message instead of a form that would only
  // fail (or, for delete, silently no-op) on submit.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [recentFailureCount, setRecentFailureCount] = useState(0);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsAdmin(Boolean(data));
    }
    checkAdmin();

    loadOrganizations();
    loadOpportunities();
    loadRecentFailureCount();
  }, []);

  // Ingestion failures already land in ingestion_runs (status: "error"),
  // but the only place that surfaced them before was /admin/ingestion-log
  // — which nobody would think to check unless something already looked
  // wrong. Surfacing the count here, on the page an admin actually lands
  // on, closes that gap without a new table or an external alerting
  // service.
  async function loadRecentFailureCount() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("ingestion_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "error")
      .gte("run_at", sevenDaysAgo);
    setRecentFailureCount(count ?? 0);
  }

  async function loadOrganizations() {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, verified")
      .order("name");
    setOrganizations(data ?? []);
  }

  async function toggleOrgVerified(org: OrgOption) {
    const { error } = await supabase
      .from("organizations")
      .update({ verified: !org.verified })
      .eq("id", org.id);
    if (error) return;
    setOrganizations((prev) =>
      prev.map((o) => (o.id === org.id ? { ...o, verified: !org.verified } : o))
    );
  }

  async function loadOpportunities() {
    setListLoading(true);
    // Same silent-truncation bug found and fixed in
    // app/admin/catalog/page.tsx: an unbounded .select() against this
    // table (1,246 rows total, all review_statuses) is capped at 1,000
    // by PostgREST's own default max-rows setting, with no error and
    // no indication anything was cut off. This is the admin's own
    // opportunity edit list, so the practical effect was roughly 246
    // opportunities being invisible to admin editing here. Fetching in
    // explicit pages fixes it.
    const PAGE_SIZE = 1000;
    const rows: OpportunityRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, title, description, category, minimum_age, location, latitude, longitude, application_deadline, schedule_slots, skills_required, interests_tags, commitment_type, organization_id, organizations(name), availability_status"
        )
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;
      rows.push(...(data as unknown as OpportunityRow[]));
      if (data.length < PAGE_SIZE) break;
    }
    setOpportunities(rows);
    setListLoading(false);
  }

  // Manually re-verifying a seasonal/unverified record as currently
  // open — the "program_availability_confirmed" event from the
  // manual-source-integration spec. Only meaningful for non-'open' rows;
  // never silently reopens a 'closed' (deadline-passed) row without a
  // human's explicit action, same posture as every other admin write.
  async function handleVerifyNow(opp: OpportunityRow) {
    const { error } = await supabase
      .from("opportunities")
      .update({ availability_status: "open", last_verified_at: new Date().toISOString() })
      .eq("id", opp.id);
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    trackEvent("program_availability_confirmed", { opportunityId: opp.id });
    setOpportunities((prev) =>
      prev.map((o) => (o.id === opp.id ? { ...o, availability_status: "open" } : o))
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
    setOrganizationId("");
    setNewOrgName("");
    setNewOrgDescription("");
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
    setOrganizationId(opp.organization_id ?? "");
    setNewOrgName("");
    setNewOrgDescription("");
    setStatus(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete(opp: OpportunityRow) {
    const confirmed = window.confirm(
      `Delete "${opp.title}"? This also removes any students' saved/tracked applications for it.`
    );
    if (!confirmed) return;

    // .select("id") turns a silent RLS no-op (delete matches zero rows,
    // e.g. because admin status was revoked mid-session) into a real
    // error instead of a false "Opportunity deleted." — a DELETE whose
    // `using` clause excludes every row is valid SQL, not an error, so
    // without checking the returned rows this would look identical to a
    // real success. Same class of bug as the RLS gaps in ARCHITECTURE.md §5.
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
      setStatus("Error: nothing was deleted — you may not have admin access.");
      return;
    }
    if (editingId === opp.id) resetForm();
    setStatus("Opportunity deleted.");
    loadOpportunities();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSaving(true);

    let resolvedOrgId: string | null = organizationId || null;

    if (organizationId === NEW_ORG_VALUE) {
      if (!newOrgName.trim()) {
        setStatus("Error: give the new organization a name.");
        setSaving(false);
        return;
      }
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: newOrgName.trim(), description: newOrgDescription.trim() || null })
        .select("id")
        .single();

      if (orgError || !newOrg) {
        setStatus(`Error: ${orgError?.message ?? "couldn't create organization"}`);
        setSaving(false);
        return;
      }
      resolvedOrgId = newOrg.id;
      setOrganizations((prev) =>
        [...prev, { id: newOrg.id, name: newOrgName.trim(), verified: false }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    }

    const payload = {
      organization_id: resolvedOrgId,
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
    loadOpportunities();

    if (savedRow) {
      embedAndAttach(savedRow.id, descriptionText);
    }
  }

  if (isAdmin === null) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <p className="text-sm text-ink/70 max-w-xl mx-auto">Loading…</p>
        </main>
      </>
    );
  }

  if (isAdmin === false) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <div className="max-w-xl mx-auto">
            <EmptyState
              title="Admin access required"
              description="Your account isn't in the admins list, so you can't post or edit opportunities. Ask an existing admin to add your account if you think this is wrong."
            />
          </div>
        </main>
      </>
    );
  }

  const unverifiedOrgCount = organizations.filter((org) => !org.verified).length;

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="animate-fade-in-up max-w-xl mx-auto flex flex-col gap-6"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
                Admin
              </p>
              <h1 className="font-display text-3xl font-semibold">
                {editingId ? "Edit opportunity" : "Add an opportunity"}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/admin/review-queue"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Review queue →
              </Link>
              <Link
                href="/admin/catalog"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Catalog →
              </Link>
              <Link
                href="/admin/analytics"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Analytics →
              </Link>
              <Link
                href="/admin/user-analytics"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                User analytics →
              </Link>
              <Link
                href="/admin/ingestion-log"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Ingestion log →
              </Link>
              <Link
                href="/admin/error-log"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Error log →
              </Link>
              <Link
                href="/admin/reports"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Reports →
              </Link>
            </div>
          </div>

          {recentFailureCount > 0 && (
            <Link
              href="/admin/ingestion-log"
              className="block text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3 hover:border-red-300 transition-colors duration-150"
            >
              {recentFailureCount} ingestion {recentFailureCount === 1 ? "failure" : "failures"} in the last 7
              days — view the ingestion log →
            </Link>
          )}

          <div className="bg-white border border-line rounded-card shadow-soft p-6 flex flex-col gap-6">
            <div>
              <label htmlFor="admin-opp-title" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Title
              </label>
              <input
                id="admin-opp-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="admin-opp-description" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Description
              </label>
              <textarea
                id="admin-opp-description"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-opp-category" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                  Category
                </label>
                <select
                  id="admin-opp-category"
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
                <label htmlFor="admin-opp-min-age" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                  Minimum age
                </label>
                <input
                  id="admin-opp-min-age"
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
              <label htmlFor="admin-opp-location" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Location
              </label>
              <input
                id="admin-opp-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="admin-opp-organization" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Organization <span className="normal-case text-ink/70">(optional)</span>
              </label>
              <select
                id="admin-opp-organization"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">
                  {editingId ? "No organization (remove)" : "No organization"}
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
                <option value={NEW_ORG_VALUE}>+ Add new organization…</option>
              </select>

              {organizationId === NEW_ORG_VALUE && (
                <div className="animate-fade-in mt-3 flex flex-col gap-3 border border-line rounded-card p-3 bg-paper">
                  <div>
                    <label htmlFor="admin-new-org-name" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                      New organization name
                    </label>
                    <input
                      id="admin-new-org-name"
                      type="text"
                      required
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-new-org-description" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                      Short description{" "}
                      <span className="normal-case text-ink/70">(optional)</span>
                    </label>
                    <textarea
                      id="admin-new-org-description"
                      rows={2}
                      value={newOrgDescription}
                      onChange={(e) => setNewOrgDescription(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="admin-opp-deadline" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Application deadline{" "}
                <span className="normal-case text-ink/70">(optional)</span>
              </label>
              <input
                id="admin-opp-deadline"
                type="date"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-opp-latitude" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                    Latitude <span className="normal-case text-ink/70">(optional)</span>
                  </label>
                  <input
                    id="admin-opp-latitude"
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 39.9612"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="admin-opp-longitude" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                    Longitude <span className="normal-case text-ink/70">(optional)</span>
                  </label>
                  <input
                    id="admin-opp-longitude"
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
              <span id="admin-schedule-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
                Schedule
              </span>
              <div role="group" aria-labelledby="admin-schedule-label" className="flex flex-wrap gap-2">
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
              <span id="admin-tags-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
                Interest tags
              </span>
              <div role="group" aria-labelledby="admin-tags-label" className="flex flex-wrap gap-2">
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
              <span id="admin-commitment-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
                Commitment
              </span>
              <div role="group" aria-labelledby="admin-commitment-label" className="flex gap-2">
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
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            {opportunities.length} posted
          </p>
          <h2 className="font-display text-2xl font-semibold mb-6">
            Existing opportunities
          </h2>

          {listLoading ? (
            <p className="text-sm text-ink/70">Loading…</p>
          ) : opportunities.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="Nothing posted yet"
              description="Every opportunity shows up here — ones you add above, and anything pulled in by a fetcher source."
            />
          ) : (
            <div className="bg-white border border-line rounded-card shadow-soft divide-y divide-line overflow-hidden">
              {opportunities.map((opp) => {
                // Only shown for 'open' records — a non-open
                // availability_status already tells the fuller story,
                // and a past deadline's own label collides word-for-word
                // with the "Applications closed" AvailabilityBadge
                // otherwise (see app/organizations/[id]/page.tsx for
                // where this was first caught live).
                const days =
                  opp.application_deadline && opp.availability_status === "open"
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
                      <p className="text-sm text-ink/70 truncate">
                        {opp.category}
                        {opp.organizations?.name ? ` · ${opp.organizations.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(opp.availability_status === "seasonal" || opp.availability_status === "unverified") && (
                        <button
                          onClick={() => handleVerifyNow(opp)}
                          className="text-sm px-3 py-1.5 rounded-card border border-moss/30 text-moss-dark hover:border-moss hover:shadow-pop transition-all duration-150"
                        >
                          Verify now
                        </button>
                      )}
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

        <div className="max-w-xl mx-auto mt-16">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            {organizations.length} total
          </p>
          <h2 className="font-display text-2xl font-semibold mb-6">Organizations</h2>
          <p className="text-sm text-ink/70 mb-6">
            Unverified organizations&apos; opportunities are hidden from
            students entirely — this isn&apos;t just a flag, it gates what&apos;s
            publicly visible. New organizations default to unverified,
            whether created here, by an org account signing up, or
            auto-created by an ingestion source — so a newly added
            org&apos;s listings stay invisible to every student until you
            check this box.
          </p>

          {unverifiedOrgCount > 0 && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-6">
              {unverifiedOrgCount} {unverifiedOrgCount === 1 ? "organization is" : "organizations are"} unverified
              — {unverifiedOrgCount === 1 ? "its" : "their"} opportunities aren&apos;t visible to students yet.
            </p>
          )}

          {organizations.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="No organizations yet"
              description="Organizations created here, by an org account signing up, or auto-created by an ingestion source will show up here."
            />
          ) : (
            <div className="bg-white border border-line rounded-card shadow-soft divide-y divide-line overflow-hidden">
              {organizations.map((org) => (
                <div key={org.id} className="p-4 flex items-center justify-between gap-4">
                  <h3 className="font-display text-base font-semibold truncate">{org.name}</h3>
                  <label className="flex items-center gap-2 text-sm text-ink/70 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={org.verified}
                      onChange={() => toggleOrgVerified(org)}
                      className="w-4 h-4 accent-moss"
                    />
                    Verified
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
