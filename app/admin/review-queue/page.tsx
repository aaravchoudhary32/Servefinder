"use client";

// Ingestion infrastructure Phase 2: the review gate for automated
// scraper ingestion (see supabase/add_ingestion_source_registry_and_staging.sql
// and ARCHITECTURE.md's "Ingestion infrastructure, round two" section).
// Manual-curated records, admin CRUD, org self-service CRUD, and CSV
// import all still publish immediately — this page exists only because
// automated connectors now write review_status: "pending" for new rows,
// and nothing else in the app could previously see, let alone act on,
// a pending row. Admins already see pending rows via the existing
// "Admins can read all opportunities regardless of verification" RLS
// policy (untouched by this batch) — this page is the first UI to
// actually do something with that visibility.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import { classifyDuplicate, type ExistingListing, type DuplicateVerdict } from "@/lib/ingestion/normalize";

type PendingOpportunity = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  minimum_age: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_mode: string;
  availability_status: string;
  application_url: string | null;
  application_deadline: string | null;
  schedule_slots: string[];
  commitment_type: string;
  cost: string | null;
  parental_consent_required: boolean | null;
  background_check_required: boolean | null;
  source: string;
  source_url: string | null;
  external_id: string | null;
  organization_id: string | null;
  organizations: { name: string } | null;
  created_at: string;
};

type DuplicateCandidate = {
  existingId: string;
  existingTitle: string;
  verdict: DuplicateVerdict;
  evidence: string[];
  confidence: number;
};

// Fields worth flagging to a reviewer as missing/uncertain — the ones
// that matter most for a minor-safety-reviewed listing. Not exhaustive
// (many optional biomedical/business-batch fields are legitimately
// often absent) — just the ones a reviewer should consciously notice.
function missingFields(o: PendingOpportunity): string[] {
  const missing: string[] = [];
  if (!o.description) missing.push("description");
  if (!o.application_url) missing.push("application_url");
  if (o.delivery_mode !== "virtual" && !o.location) missing.push("location (in-person, no address)");
  if (o.delivery_mode !== "virtual" && (o.latitude == null || o.longitude == null))
    missing.push("coordinates (in-person, ungeocoded)");
  if (!o.application_deadline) missing.push("application_deadline");
  if (o.parental_consent_required == null) missing.push("parental_consent_required (unconfirmed either way)");
  if (o.background_check_required == null) missing.push("background_check_required (unconfirmed either way)");
  return missing;
}

// The hard floor for batch approval — a record can still be approved
// one at a time with a human consciously looking at it (the single
// Approve button never blocks), but batch approval must never publish
// something with no traceable source, no title/org, no delivery mode,
// or literally zero eligibility evidence at all. This is deliberately a
// smaller set than missingFields() above, which flags softer
// completeness gaps (deadline, consent, background check) that a
// reviewer should notice but that don't make a record unsafe to
// publish.
function batchApprovalBlockers(o: PendingOpportunity): string[] {
  const blockers: string[] = [];
  if (!o.title?.trim()) blockers.push("no title");
  if (!o.organizations?.name) blockers.push("no organization");
  if (!o.source_url && !o.application_url) blockers.push("no first-party or application link at all");
  if (!o.delivery_mode) blockers.push("no delivery mode");
  if (o.minimum_age == null) blockers.push("no age evidence");
  return blockers;
}

// A rough, transparent completeness signal — not a black-box score.
// "High" only when there's nothing to flag at all; "Low" when a batch-
// approval blocker is present or a duplicate needs review; "Medium"
// otherwise (the common case: a real, distinct record missing a soft
// field like deadline or consent status).
function sourceConfidence(o: PendingOpportunity, hasDupeWarning: boolean): "High" | "Medium" | "Low" {
  if (batchApprovalBlockers(o).length > 0 || hasDupeWarning) return "Low";
  if (missingFields(o).length === 0) return "High";
  return "Medium";
}

export default function ReviewQueuePage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingOpportunity[]>([]);
  const [duplicatesById, setDuplicatesById] = useState<Record<string, DuplicateCandidate[]>>({});
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [editTitles, setEditTitles] = useState<Record<string, string>>({});
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedPreview, setExpandedPreview] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState<"approve" | "reject" | null>(null);
  const [batchNote, setBatchNote] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  // Batch approve/reject already required a confirm step; the
  // per-row buttons below didn't — a real inconsistency the
  // product-readiness audit's Phase 1 flagged ("no silent actions").
  // Mirrors the batch pattern already established in this file rather
  // than introducing a different confirmation UI (e.g. a modal).
  const [confirmingRow, setConfirmingRow] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  async function load() {
    const { data: pendingRows } = await supabase
      .from("opportunities")
      .select(
        "id, title, description, category, minimum_age, location, latitude, longitude, delivery_mode, availability_status, application_url, application_deadline, schedule_slots, commitment_type, cost, parental_consent_required, background_check_required, source, source_url, external_id, organization_id, organizations(name), created_at"
      )
      .eq("review_status", "pending")
      .order("created_at", { ascending: false });

    // Every APPROVED row is the duplicate-candidate pool — deliberately
    // cross-source (a scraper's new row can duplicate a manual or
    // another source's record just as easily as one from its own
    // source), matching how classifyDuplicate() has always been called
    // throughout the ingestion pipeline. Includes the shared-
    // application-portal fix's extra fields (application_url/
    // application_deadline/location/minimum_age/source_url) so this
    // page's own duplicate check gets the same corroboration signals
    // the connectors use, not the older URL-only-is-conclusive check.
    //
    // Fetched in explicit pages, not one plain .select(): with 1,176+
    // approved rows, an unbounded query here silently truncates at
    // PostgREST's own default 1,000-row cap — confirmed live while
    // measuring this page for the product-readiness audit — which
    // would mean roughly 15% of approved listings never entering the
    // duplicate-candidate pool at all. A real duplicate against one of
    // those ~176 rows would have gone undetected with no error and no
    // indication anything was cut off.
    const APPROVED_PAGE_SIZE = 1000;
    const approvedRows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += APPROVED_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, title, source, external_id, application_url, application_deadline, location, minimum_age, source_url, organizations(name)"
        )
        .eq("review_status", "approved")
        .range(from, from + APPROVED_PAGE_SIZE - 1);
      if (error || !data) break;
      approvedRows.push(...(data as unknown as Record<string, unknown>[]));
      if (data.length < APPROVED_PAGE_SIZE) break;
    }

    const pendingList = (pendingRows ?? []) as unknown as PendingOpportunity[];
    setPending(pendingList);

    const existing: ExistingListing[] = approvedRows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      source: row.source as string,
      external_id: row.external_id as string | null,
      title: row.title as string,
      organizationName: (row.organizations as { name: string } | null)?.name ?? null,
      applicationUrl: row.application_url as string | null,
      applicationDeadline: row.application_deadline as string | null,
      location: row.location as string | null,
      minimumAge: row.minimum_age as number | null,
      sourceUrl: row.source_url as string | null,
    }));

    const dupMap: Record<string, DuplicateCandidate[]> = {};
    for (const p of pendingList) {
      const result = classifyDuplicate(
        {
          source: p.source,
          external_id: p.external_id,
          title: p.title,
          organizationName: p.organizations?.name,
          applicationUrl: p.application_url,
          applicationDeadline: p.application_deadline,
          location: p.location,
          minimumAge: p.minimum_age,
          sourceUrl: p.source_url,
        },
        existing
      );
      // Only surface verdicts that actually warrant a reviewer's
      // attention — "shared_portal_distinct_role" and "no_duplicate"
      // both mean classifyDuplicate() positively examined the evidence
      // and found this is (or is likely) a genuinely distinct listing,
      // so it's shown as a normal new candidate, not a duplicate warning.
      if (result.verdict === "exact_duplicate" || result.verdict === "probable_duplicate") {
        const existingTitle = existing.find((e) => e.id === result.candidateId)?.title ?? "(unknown)";
        dupMap[p.id] = [
          { existingId: result.candidateId!, existingTitle, verdict: result.verdict, evidence: result.evidence, confidence: result.confidence },
        ];
      }
    }
    setDuplicatesById(dupMap);
    setLoading(false);
  }

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      setIsAdmin(Boolean(data));
    }
    checkAdmin();
    // Same "fetch on mount, setState once the promise resolves" shape as
    // app/admin/page.tsx's loadOrganizations()/loadOpportunities() calls —
    // no synchronous setState call actually happens inside this effect's
    // own call stack, since load() never sets state before its first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function approve(o: PendingOpportunity) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const newTitle = editTitles[o.id]?.trim();
    const update: Record<string, unknown> = {
      review_status: "approved",
      reviewed_by: user?.id ?? null,
    };
    if (newTitle && newTitle !== o.title) update.title = newTitle;

    const { error } = await supabase.from("opportunities").update(update).eq("id", o.id).select("id");
    if (error) {
      setActionStatus((s) => ({ ...s, [o.id]: `Error: ${error.message}` }));
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== o.id));
    setConfirmingRow(null);
  }

  async function reject(o: PendingOpportunity, note: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("opportunities")
      .update({ review_status: "rejected", reviewed_by: user?.id ?? null, review_notes: note || null })
      .eq("id", o.id)
      .select("id");
    if (error) {
      setActionStatus((s) => ({ ...s, [o.id]: `Error: ${error.message}` }));
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== o.id));
    setConfirmingRow(null);
  }

  // "Merge" is deliberately conservative: it marks the pending row as
  // superseded by the existing approved one it duplicates, rather than
  // attempting to auto-fuse fields from both — see the Phase 1 report's
  // finding on the Special Olympics case for why blind field-merging is
  // riskier than it looks (two rows that share a title can still be
  // genuinely distinct real-world opportunities).
  async function markMerged(o: PendingOpportunity, canonicalId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("opportunities")
      .update({
        review_status: "merged",
        merged_into_id: canonicalId,
        reviewed_by: user?.id ?? null,
        review_notes: `Marked as a duplicate of ${canonicalId} during review.`,
      })
      .eq("id", o.id)
      .select("id");
    if (error) {
      setActionStatus((s) => ({ ...s, [o.id]: `Error: ${error.message}` }));
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== o.id));
  }

  const sourceCounts = pending.reduce<Record<string, number>>((acc, p) => {
    acc[p.source] = (acc[p.source] ?? 0) + 1;
    return acc;
  }, {});
  const sources = Object.keys(sourceCounts).sort();
  const filteredPending = sourceFilter === "all" ? pending : pending.filter((p) => p.source === sourceFilter);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const allSelected = filteredPending.every((p) => prev.has(p.id));
      if (allSelected) {
        const next = new Set(prev);
        for (const p of filteredPending) next.delete(p.id);
        return next;
      }
      return new Set([...prev, ...filteredPending.map((p) => p.id)]);
    });
  }

  // Batch approve deliberately skips (never force-publishes) any
  // selected record with a hard blocker — see batchApprovalBlockers()
  // — rather than either approving everything indiscriminately or
  // refusing to approve any of the batch. The skipped set is reported
  // back so a reviewer knows exactly what still needs individual
  // attention.
  async function runBatchApprove() {
    setBatchBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const targets = pending.filter((p) => selected.has(p.id));
    const approvable = targets.filter((p) => batchApprovalBlockers(p).length === 0);
    const blocked = targets.filter((p) => batchApprovalBlockers(p).length > 0);

    const ids = approvable.map((p) => p.id);
    if (ids.length > 0) {
      const { error } = await supabase
        .from("opportunities")
        .update({ review_status: "approved", reviewed_by: user?.id ?? null })
        .in("id", ids);
      if (error) {
        setActionStatus((s) => ({ ...s, _batch: `Batch approve error: ${error.message}` }));
      } else {
        setPending((prev) => prev.filter((p) => !ids.includes(p.id)));
      }
    }
    if (blocked.length > 0) {
      setActionStatus((s) => ({
        ...s,
        _batch: `Approved ${ids.length}. Skipped ${blocked.length} — missing required fields: ${blocked
          .map((p) => `"${p.title}" (${batchApprovalBlockers(p).join(", ")})`)
          .join("; ")}`,
      }));
    }
    setSelected(new Set());
    setBatchConfirm(null);
    setBatchBusy(false);
  }

  async function runBatchReject() {
    setBatchBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ids = pending.filter((p) => selected.has(p.id)).map((p) => p.id);
    const { error } = await supabase
      .from("opportunities")
      .update({ review_status: "rejected", reviewed_by: user?.id ?? null, review_notes: batchNote.trim() || "Rejected during batch review." })
      .in("id", ids);
    if (error) {
      setActionStatus((s) => ({ ...s, _batch: `Batch reject error: ${error.message}` }));
    } else {
      setPending((prev) => prev.filter((p) => !ids.includes(p.id)));
    }
    setSelected(new Set());
    setBatchConfirm(null);
    setBatchNote("");
    setBatchBusy(false);
  }

  if (isAdmin === null || loading) {
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
              description="Your account isn't in the admins list."
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
        <div className="animate-fade-in-up max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">Admin</p>
              <h1 className="font-display text-3xl font-semibold">Review queue</h1>
              <p className="text-sm text-ink/70 mt-1">
                {pending.length} opportunit{pending.length === 1 ? "y" : "ies"} from automated ingestion awaiting
                review. Nothing here is publicly visible or enters Dashboard matching until approved.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/catalog"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                Catalog →
              </Link>
              <Link
                href="/admin"
                className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150"
              >
                ← Admin
              </Link>
            </div>
          </div>

          {pending.length === 0 ? (
            <EmptyState title="Nothing to review" description="No pending records from automated ingestion right now." />
          ) : (
            <>
              <div className="bg-white border border-line rounded-card shadow-soft p-4 flex flex-col gap-3 sticky top-2 z-10">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-ink/70">
                    Source:{" "}
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="border border-line rounded-card px-2 py-1 text-sm bg-white"
                    >
                      <option value="all">All ({pending.length})</option>
                      {sources.map((s) => (
                        <option key={s} value={s}>
                          {s} ({sourceCounts[s]})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss transition-colors"
                  >
                    {filteredPending.every((p) => selected.has(p.id)) && filteredPending.length > 0
                      ? "Deselect all visible"
                      : "Select all visible"}
                  </button>
                  <span className="text-sm text-ink/70">{selected.size} selected</span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    disabled={selected.size === 0}
                    onClick={() => setBatchConfirm("approve")}
                    className="text-sm font-medium px-3 py-1.5 rounded-card border border-line bg-moss text-white hover:bg-moss-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Batch approve ({selected.size})
                  </button>
                  <button
                    type="button"
                    disabled={selected.size === 0}
                    onClick={() => setBatchConfirm("reject")}
                    className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Batch reject ({selected.size})
                  </button>
                </div>

                {batchConfirm && (
                  <div className="border-t border-line pt-3 flex flex-col gap-2 text-sm">
                    {batchConfirm === "approve" ? (
                      <>
                        <p>
                          Approve {selected.size} selected record(s)? Any record missing a title, organization, first-party
                          link, delivery mode, or age evidence will be <strong>skipped</strong>, not force-published — you&apos;ll
                          get a list of what was skipped.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={batchBusy}
                            onClick={runBatchApprove}
                            className="text-sm font-medium px-3 py-1.5 rounded-card border border-line bg-moss text-white hover:bg-moss-dark transition-colors disabled:opacity-50"
                          >
                            {batchBusy ? "Approving…" : "Confirm batch approve"}
                          </button>
                          <button type="button" onClick={() => setBatchConfirm(null)} className="text-sm px-3 py-1.5 rounded-card border border-line">
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>Reject {selected.size} selected record(s)? Optional shared note:</p>
                        <input
                          type="text"
                          value={batchNote}
                          onChange={(e) => setBatchNote(e.target.value)}
                          placeholder="Reason (applied to all selected)"
                          className="border border-line rounded-card px-3 py-1.5 text-sm bg-white"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={batchBusy}
                            onClick={runBatchReject}
                            className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-50"
                          >
                            {batchBusy ? "Rejecting…" : "Confirm batch reject"}
                          </button>
                          <button type="button" onClick={() => setBatchConfirm(null)} className="text-sm px-3 py-1.5 rounded-card border border-line">
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {actionStatus._batch && <p className="text-xs text-ink/70">{actionStatus._batch}</p>}
              </div>

            {filteredPending.map((o) => {
              const missing = missingFields(o);
              const dupes = duplicatesById[o.id] ?? [];
              const blockers = batchApprovalBlockers(o);
              const confidence = sourceConfidence(o, dupes.length > 0);
              const previewOpen = expandedPreview.has(o.id);
              return (
                <div key={o.id} className="bg-white border border-line rounded-card shadow-soft p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggleSelected(o.id)}
                        className="mt-2 h-4 w-4"
                        aria-label={`Select ${o.title} for batch review`}
                      />
                      <div>
                        <span className="pin-tag">{o.category}</span>
                        <h2 className="font-display text-lg font-semibold mt-2">{o.title}</h2>
                        <p className="text-sm text-ink/70">
                          {o.organizations?.name ?? "(no organization)"} · source: {o.source}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border whitespace-nowrap ${
                          confidence === "High"
                            ? "bg-moss/10 text-moss-dark border-moss/30"
                            : confidence === "Medium"
                              ? "bg-marigold-light text-marigold-dark border-marigold/30"
                              : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        Confidence: {confidence}
                      </span>
                      <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-marigold-light text-marigold-dark border-marigold/30 whitespace-nowrap">
                        Pending review
                      </span>
                    </div>
                  </div>

                  {blockers.length > 0 && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                      <span className="font-medium">Blocked from batch approval: </span>
                      {blockers.join(", ")} — can still be approved individually below after review.
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink/70">
                    <p>Age eligibility: {o.minimum_age}+</p>
                    <p>Availability status (parsed): {o.availability_status}</p>
                    <p>Delivery mode: {o.delivery_mode}</p>
                    <p>Location: {o.location ?? "—"}</p>
                    <p>Deadline: {o.application_deadline ?? "—"}</p>
                    <p>Commitment: {o.commitment_type}</p>
                    <p>Cost: {o.cost ?? "—"}</p>
                    <p>Schedule: {o.schedule_slots.join(", ") || "—"}</p>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm">
                    {o.source_url && (
                      <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="text-moss-dark underline underline-offset-2 hover:text-moss">
                        Source page ↗
                      </a>
                    )}
                    {o.application_url && (
                      <a href={o.application_url} target="_blank" rel="noopener noreferrer" className="text-moss-dark underline underline-offset-2 hover:text-moss">
                        Application URL ↗
                      </a>
                    )}
                  </div>

                  {missing.length > 0 && (
                    <div className="text-xs text-ink/70 bg-line/30 border border-line rounded-card px-3 py-2">
                      <span className="font-medium">Missing or uncertain: </span>
                      {missing.join(", ")}
                    </div>
                  )}

                  {dupes.length > 0 && (
                    <div className="text-xs bg-marigold-light border border-marigold/30 text-marigold-dark rounded-card px-3 py-2 flex flex-col gap-1">
                      <span className="font-medium">
                        {dupes[0].verdict === "exact_duplicate" ? "Likely duplicate" : "Possible duplicate — needs review"}
                        {" "}
                        ({Math.round(dupes[0].confidence * 100)}% confidence):
                      </span>
                      <span>&quot;{dupes[0].existingTitle}&quot; (already approved, id {dupes[0].existingId.slice(0, 8)}…)</span>
                      {/* Full-opacity marigold-dark, not /80 — the lighter
                          shade dropped below WCAG AA's 4.5:1 on
                          bg-marigold-light once real evidence text (e.g. a
                          "different location" comparison) rendered here;
                          see tailwind.config.ts's marigold.dark comment for
                          why this pairing needs to stay at full opacity. */}
                      <ul className="list-disc list-inside text-marigold-dark">
                        {dupes[0].evidence.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => markMerged(o, dupes[0].existingId)}
                        className="self-start text-xs underline underline-offset-2 hover:text-ink mt-1"
                      >
                        Mark as duplicate of this record
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPreview((prev) => {
                        const next = new Set(prev);
                        if (next.has(o.id)) next.delete(o.id);
                        else next.add(o.id);
                        return next;
                      })
                    }
                    className="self-start text-xs underline underline-offset-2 hover:text-moss-dark"
                  >
                    {previewOpen ? "Hide public card preview" : "Show public card preview"}
                  </button>
                  {previewOpen && (
                    <div className="border border-line rounded-card p-4 bg-cream/50">
                      <p className="text-[0.65rem] font-mono uppercase tracking-widest text-ink/50 mb-2">
                        How this will look on Explore once approved
                      </p>
                      <span className="pin-tag">{o.category}</span>
                      <h3 className="font-display text-base font-semibold mt-2">{editTitles[o.id]?.trim() || o.title}</h3>
                      <p className="text-sm text-ink/70 mt-1">{o.organizations?.name ?? "(no organization)"}</p>
                      {o.description && <p className="text-sm text-ink/80 mt-2 line-clamp-4">{o.description}</p>}
                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink/70 mt-3">
                        <p>Ages {o.minimum_age}+</p>
                        <p>{o.delivery_mode === "virtual" ? "Virtual" : o.location ?? "Location not specified"}</p>
                        <p>{o.commitment_type}</p>
                        <p>{o.cost ? `Cost: ${o.cost}` : "No cost listed"}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
                    <input
                      type="text"
                      placeholder="Edit title before approving (optional)"
                      defaultValue={o.title}
                      onChange={(e) => setEditTitles((s) => ({ ...s, [o.id]: e.target.value }))}
                      className="flex-1 min-w-[200px] border border-line rounded-card px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                    />
                    {confirmingRow?.id === o.id ? (
                      <>
                        <span className="text-sm text-ink/70">
                          {confirmingRow.action === "approve" ? "Approve this record?" : "Reject this record?"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            confirmingRow.action === "approve" ? approve(o) : reject(o, "Rejected during review.")
                          }
                          className={`text-sm font-medium px-3 py-1.5 rounded-card border border-line transition-colors ${
                            confirmingRow.action === "approve"
                              ? "bg-moss text-white hover:bg-moss-dark"
                              : "hover:border-red-300 hover:text-red-700"
                          }`}
                        >
                          Yes, {confirmingRow.action}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingRow(null)}
                          className="text-sm px-3 py-1.5 rounded-card border border-line hover:shadow-pop transition-all duration-150"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmingRow({ id: o.id, action: "approve" })}
                          className="text-sm font-medium px-3 py-1.5 rounded-card border border-line bg-moss text-white hover:bg-moss-dark transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingRow({ id: o.id, action: "reject" })}
                          className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-red-300 hover:text-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                  {actionStatus[o.id] && <p className="text-xs text-red-700">{actionStatus[o.id]}</p>}
                </div>
              );
            })}
            </>
          )}
        </div>
      </main>
    </>
  );
}
