"use client";

// Ingestion infrastructure Phase 2 — the catalog metrics dashboard (see
// ARCHITECTURE.md's "Ingestion infrastructure, round two" section).
// Every number here is computed live from `opportunities`/`organizations`
// rows the admin's own RLS policies already let them read — no
// hard-coded counts, nothing pulled from staging/rejected/merged rows
// for the public-facing figures, and the "distinct canonical
// opportunities" figure explicitly excludes rows with review_status in
// ('pending','rejected','merged') so a still-in-review or
// already-superseded row is never double-counted alongside its
// canonical replacement.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";

type OppRow = {
  id: string;
  availability_status: string;
  delivery_mode: string;
  category: string;
  minimum_age: number;
  review_status: string;
  is_stale: boolean;
  source: string;
  organizations: { city: string | null; verified: boolean } | null;
};

type SourceRow = {
  source_name: string;
  status: string;
  last_attempted_at: string | null;
  last_successful_at: string | null;
  last_error_message: string | null;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-line rounded-card shadow-soft p-4">
      <p className="text-xs font-mono uppercase tracking-wide text-ink/70">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-ink/70 mt-1">{sub}</p>}
    </div>
  );
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export default function CatalogDashboardPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [opps, setOpps] = useState<OppRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    // Correctness bug caught while measuring this page's query for the
    // product-readiness audit: a plain, unbounded .select() here was
    // silently capped at 1,000 rows by PostgREST's own default
    // max-rows setting — confirmed live (curl against this exact
    // query returned exactly 1000 rows against an actual total of
    // 1,246), meaning every stat on this dashboard had been silently
    // undercounting by ~20% with no error, no warning, nothing to
    // indicate the numbers were incomplete. Fetching in explicit pages
    // fixes it without needing any server-side config change.
    const PAGE_SIZE = 1000;
    const oppRows: OppRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, availability_status, delivery_mode, category, minimum_age, review_status, is_stale, source, organizations(city, verified)"
        )
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;
      oppRows.push(...(data as unknown as OppRow[]));
      if (data.length < PAGE_SIZE) break;
    }

    const { data: sourceRows } = await supabase
      .from("ingestion_sources")
      .select("source_name, status, last_attempted_at, last_successful_at, last_error_message")
      .order("source_name");

    setOpps(oppRows);
    setSources((sourceRows ?? []) as SourceRow[]);
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
    // app/admin/page.tsx's loadOrganizations()/loadOpportunities() calls
    // right above this identical pattern — no synchronous setState call
    // actually happens inside this effect's own call stack, since load()
    // never sets state before its first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

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
          <p className="text-sm text-ink/70 max-w-xl mx-auto">Admin access required.</p>
        </main>
      </>
    );
  }

  // "Distinct canonical opportunities" — the one public-facing headline
  // number — deliberately excludes anything not yet approved and
  // anything superseded. Staging/rejected/merged rows are real database
  // rows (kept for provenance/history) but were never public and never
  // should be counted as if they were.
  const canonical = opps.filter((o) => o.review_status === "approved");
  const pendingCount = opps.filter((o) => o.review_status === "pending").length;
  const rejectedCount = opps.filter((o) => o.review_status === "rejected").length;
  const mergedCount = opps.filter((o) => o.review_status === "merged").length;

  // "Publicly visible" additionally requires the owning org to be
  // verified (or org-less) — the same condition the RLS policy itself
  // enforces, computed here for the admin's own visibility into the gap
  // between "canonical" and "actually live to a student right now."
  const publiclyVisible = canonical.filter((o) => !o.organizations || o.organizations.verified);

  const byStatus = countBy(canonical, (o) => o.availability_status);
  const byDelivery = countBy(canonical, (o) => o.delivery_mode || "in_person");
  const byCategory = countBy(canonical, (o) => o.category);
  const byLocation = countBy(canonical, (o) => (o.delivery_mode === "virtual" ? "Virtual / no fixed location" : o.organizations?.city || "Unknown"));
  const bySource = countBy(opps, (o) => o.source); // includes non-approved, for acceptance-rate math below
  const staleCount = canonical.filter((o) => o.is_stale).length;
  const teenEligible = canonical.filter((o) => o.minimum_age <= 19).length;

  const acceptanceBySource = Object.keys(bySource).map((source) => {
    const rows = opps.filter((o) => o.source === source);
    const approved = rows.filter((o) => o.review_status === "approved").length;
    const rejected = rows.filter((o) => o.review_status === "rejected").length;
    const total = rows.length;
    return { source, approved, rejected, total, rate: total > 0 ? Math.round((approved / total) * 100) : 0 };
  });

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-5xl mx-auto flex flex-col gap-8">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">Admin</p>
              <h1 className="font-display text-3xl font-semibold">Catalog</h1>
              <p className="text-sm text-ink/70 mt-1">
                All figures computed live from distinct canonical (approved) records — staging, rejected, and merged
                rows are never included.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/review-queue" className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss transition-all">
                Review queue →
              </Link>
              <Link href="/admin" className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss transition-all">
                ← Admin
              </Link>
            </div>
          </div>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">Distinct canonical opportunities</h2>
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
              <StatCard label="Total canonical" value={canonical.length} sub="review_status = approved" />
              <StatCard label="Publicly visible now" value={publiclyVisible.length} sub="also requires org.verified" />
              <StatCard label="Awaiting review" value={pendingCount} sub="never public, never matched" />
              <StatCard label="Teen-eligible (13-19)" value={teenEligible} />
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">By availability status</h2>
            <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-3">
              {["open", "seasonal", "unverified", "closed", "paused", "waitlisted"].map((status) => (
                <StatCard key={status} label={status} value={byStatus[status] ?? 0} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">By delivery mode</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <StatCard label="In person" value={byDelivery.in_person ?? 0} />
              <StatCard label="Virtual" value={byDelivery.virtual ?? 0} />
              <StatCard label="Hybrid" value={byDelivery.hybrid ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">By category</h2>
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <StatCard key={category} label={category} value={count} />
                ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">By location</h2>
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(byLocation)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([location, count]) => (
                  <StatCard key={location} label={location} value={count} />
                ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">Data quality</h2>
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
              <StatCard label="Stale records" value={staleCount} sub="last_verified_at past the freshness window" />
              <StatCard label="Rejected (all-time)" value={rejectedCount} />
              <StatCard label="Merged into another record" value={mergedCount} />
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold mb-3">Connector health &amp; acceptance rate</h2>
            {sources.length === 0 ? (
              <p className="text-sm text-ink/70">
                No rows in ingestion_sources yet — run the registry migration and it will populate automatically.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-line rounded-card overflow-hidden">
                  <thead className="bg-line/30 text-left">
                    <tr>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Last attempt</th>
                      <th className="px-3 py-2">Last success</th>
                      <th className="px-3 py-2">Acceptance rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => {
                      const acc = acceptanceBySource.find((a) => a.source === s.source_name);
                      return (
                        <tr key={s.source_name} className="border-t border-line">
                          <td className="px-3 py-2 font-mono">{s.source_name}</td>
                          <td className="px-3 py-2">{s.status}</td>
                          <td className="px-3 py-2">{s.last_attempted_at ? new Date(s.last_attempted_at).toLocaleDateString() : "—"}</td>
                          <td className="px-3 py-2">{s.last_successful_at ? new Date(s.last_successful_at).toLocaleDateString() : "—"}</td>
                          <td className="px-3 py-2">
                            {acc && acc.total > 0 ? `${acc.approved}/${acc.total} (${acc.rate}%)` : "Not enough data yet"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
