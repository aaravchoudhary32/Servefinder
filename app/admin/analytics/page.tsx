"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import { ClipboardIcon } from "@/components/icons";
import type { AnalyticsEventType } from "@/lib/analytics";

const WINDOW_DAYS = 30;
// Below this many ratings for a given algorithm, a helpfulness
// percentage would look more authoritative than the sample actually
// supports (100% from n=1 is not a real signal) — show "not enough
// data" instead of a number that could be mistaken for one.
const MIN_FEEDBACK_SAMPLE = 10;
const ALGORITHMS = ["classic", "semantic"] as const;

type EventRow = {
  event_type: AnalyticsEventType;
  user_id: string;
  opportunity_id: string | null;
  metadata: Record<string, unknown> | null;
};

type FeedbackRow = { algorithm: "classic" | "semantic"; helpful: boolean };

type AlgorithmStats = {
  views: number;
  saves: number;
  applications: number;
  feedbackHelpful: number;
  feedbackTotal: number;
};

type Metrics = {
  uniqueActiveStudents: number;
  verifiedOrganizations: number;
  activeOpportunities: number;
  onboardingStarted: number;
  onboardingCompleted: number;
  saves: number;
  applicationsSubmitted: number;
  opportunitiesCompletedInWindow: number;
  completedPlacementsAllTime: number;
  matchViewsByMode: Record<string, number>;
  matchingByAlgorithm: Record<(typeof ALGORITHMS)[number], AlgorithmStats>;
};

// "Not enough data yet" rather than 0%/NaN%/a misleading 100% — showing
// a bare percentage for a rate this app has almost no data for yet would
// be more misleading than showing nothing, not less.
function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return "Not enough data yet";
  const pct = Math.round((numerator / denominator) * 100);
  return `${numerator}/${denominator} (${pct}%)`;
}

// Same "don't show a number the sample can't support" idea as
// formatRate, with an explicit floor rather than just a zero check —
// this app has no real users yet, so a rate computed from a handful of
// ratings would look more decisive than it is.
function formatHelpfulness(helpful: number, total: number): string {
  if (total < MIN_FEEDBACK_SAMPLE) {
    return total === 0 ? "Not enough data yet" : `Not enough data yet (n=${total})`;
  }
  const pct = Math.round((helpful / total) * 100);
  return `${helpful}/${total} (${pct}%)`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-line rounded-card shadow-soft p-5">
      <p className="text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  // null = still checking. Same pattern as /admin: a non-admin sees a
  // clear message rather than an empty dashboard that looks broken —
  // this table holds per-user behavioral data, so unlike
  // /admin/ingestion-log (which relies purely on RLS with no client-side
  // gate, fine for a table with no per-user data in it), this page adds
  // the same explicit admin check /admin's opportunity form uses.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data: adminRow } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const admin = Boolean(adminRow);
      setIsAdmin(admin);
      if (!admin) return;

      setLoading(true);
      const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

      // One snapshot query — every event-derived metric below is
      // computed client-side from this same result set, so they can
      // never disagree with each other over slightly different query
      // timing. A few metrics (verified orgs, active opportunities,
      // all-time completed placements) come from live table state
      // instead — see ARCHITECTURE.md for why those specifically don't
      // need the event log.
      const [
        { data: events },
        { count: verifiedOrgs },
        { count: activeOpps },
        { count: completedAllTime },
        { data: feedback },
      ] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("event_type, user_id, opportunity_id, metadata")
          .gte("created_at", windowStart),
        supabase.from("organizations").select("id", { count: "exact", head: true }).eq("verified", true),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("is_stale", false),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("match_feedback").select("algorithm, helpful"),
      ]);

      const rows = (events ?? []) as EventRow[];
      const byType = (type: AnalyticsEventType) => rows.filter((r) => r.event_type === type);
      const distinctUsers = (r: EventRow[]) => new Set(r.map((row) => row.user_id)).size;

      const matchViewsByMode: Record<string, number> = {};
      for (const row of byType("match_viewed")) {
        const mode = typeof row.metadata?.matchMode === "string" ? row.metadata.matchMode : "unknown";
        matchViewsByMode[mode] = (matchViewsByMode[mode] ?? 0) + 1;
      }

      // application_submitted/opportunity_completed don't carry
      // matchMode themselves (attributing a status change to an
      // algorithm days after the fact wouldn't mean anything) — instead
      // this looks up which mode originally surfaced the match via the
      // match_saved event for the same (user, opportunity) pair, which
      // does carry it.
      const modeByUserOpportunity = new Map<string, string>();
      for (const row of byType("match_saved")) {
        const mode = typeof row.metadata?.matchMode === "string" ? row.metadata.matchMode : null;
        if (mode && row.opportunity_id) modeByUserOpportunity.set(`${row.user_id}:${row.opportunity_id}`, mode);
      }

      const matchingByAlgorithm: Metrics["matchingByAlgorithm"] = {
        classic: { views: 0, saves: 0, applications: 0, feedbackHelpful: 0, feedbackTotal: 0 },
        semantic: { views: 0, saves: 0, applications: 0, feedbackHelpful: 0, feedbackTotal: 0 },
      };
      for (const algo of ALGORITHMS) {
        matchingByAlgorithm[algo].views = matchViewsByMode[algo] ?? 0;
        matchingByAlgorithm[algo].saves = byType("match_saved").filter(
          (r) => r.metadata?.matchMode === algo
        ).length;
      }
      for (const row of byType("application_submitted")) {
        if (!row.opportunity_id) continue;
        const mode = modeByUserOpportunity.get(`${row.user_id}:${row.opportunity_id}`);
        if (mode === "classic" || mode === "semantic") matchingByAlgorithm[mode].applications += 1;
      }
      for (const f of (feedback ?? []) as FeedbackRow[]) {
        matchingByAlgorithm[f.algorithm].feedbackTotal += 1;
        if (f.helpful) matchingByAlgorithm[f.algorithm].feedbackHelpful += 1;
      }

      setMetrics({
        uniqueActiveStudents: distinctUsers(rows),
        verifiedOrganizations: verifiedOrgs ?? 0,
        activeOpportunities: activeOpps ?? 0,
        onboardingStarted: distinctUsers(byType("onboarding_started")),
        onboardingCompleted: distinctUsers(byType("onboarding_completed")),
        saves: byType("match_saved").length,
        applicationsSubmitted: byType("application_submitted").length,
        opportunitiesCompletedInWindow: byType("opportunity_completed").length,
        completedPlacementsAllTime: completedAllTime ?? 0,
        matchViewsByMode,
        matchingByAlgorithm,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (isAdmin === null) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <p className="text-sm text-ink/70 max-w-4xl mx-auto">Loading…</p>
        </main>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <div className="max-w-xl mx-auto">
            <EmptyState title="Admin access required" description="This page is for admin users only." />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">Admin</p>
              <h1 className="font-display text-3xl font-semibold">Analytics</h1>
            </div>
            <Link
              href="/admin"
              className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 shrink-0"
            >
              ← Back to admin
            </Link>
          </div>
          <p className="text-sm text-ink/70 mb-10 max-w-lg">
            Rates and counts marked &quot;trailing {WINDOW_DAYS} days&quot; are windowed; others are all-time. Every
            rate shows its raw numerator/denominator alongside the percentage — never a bare percentage.
          </p>

          {loading || !metrics ? (
            <p className="text-sm text-ink/70">Loading…</p>
          ) : (
            <div className="flex flex-col gap-10">
              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
                  Trailing {WINDOW_DAYS} days
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Unique active students" value={metrics.uniqueActiveStudents} />
                  <StatCard
                    label="Onboarding completion"
                    value={formatRate(metrics.onboardingCompleted, metrics.onboardingStarted)}
                  />
                  <StatCard label="Saves" value={metrics.saves} />
                  <StatCard label="Applications submitted" value={metrics.applicationsSubmitted} />
                  <StatCard
                    label="Application completion"
                    value={formatRate(metrics.opportunitiesCompletedInWindow, metrics.applicationsSubmitted)}
                  />
                </div>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">All-time</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Verified organizations" value={metrics.verifiedOrganizations} />
                  <StatCard label="Active opportunities" value={metrics.activeOpportunities} />
                  <StatCard label="Completed volunteer placements" value={metrics.completedPlacementsAllTime} />
                </div>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
                  Matching quality — weighted vs. semantic (trailing {WINDOW_DAYS} days)
                </h2>
                <p className="text-xs text-ink/70 mb-3 max-w-lg">
                  &quot;Views&quot; stands in for clicks — each card&apos;s Apply/View Listing
                  link is a real click-through now, but it isn&apos;t tracked as an
                  analytics event yet, so exposure in the ranked results is
                  still the closest signal this table can show. No verdict is
                  rendered here on purpose: compare the numbers yourself, and
                  treat anything below a reasonable sample size as noise, not
                  signal.
                </p>
                <div className="bg-white border border-line rounded-card shadow-soft overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left">
                          <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                            Metric
                          </th>
                          <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                            Classic
                          </th>
                          <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                            Semantic
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        <tr>
                          <td className="px-4 py-3 text-ink/70">Views (click stand-in)</td>
                          <td className="px-4 py-3 font-mono">{metrics.matchingByAlgorithm.classic.views}</td>
                          <td className="px-4 py-3 font-mono">{metrics.matchingByAlgorithm.semantic.views}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-ink/70">Saves</td>
                          <td className="px-4 py-3 font-mono">{metrics.matchingByAlgorithm.classic.saves}</td>
                          <td className="px-4 py-3 font-mono">{metrics.matchingByAlgorithm.semantic.saves}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-ink/70">Applications</td>
                          <td className="px-4 py-3 font-mono">
                            {metrics.matchingByAlgorithm.classic.applications}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {metrics.matchingByAlgorithm.semantic.applications}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-ink/70">Helpfulness</td>
                          <td className="px-4 py-3 font-mono">
                            {formatHelpfulness(
                              metrics.matchingByAlgorithm.classic.feedbackHelpful,
                              metrics.matchingByAlgorithm.classic.feedbackTotal
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {formatHelpfulness(
                              metrics.matchingByAlgorithm.semantic.feedbackHelpful,
                              metrics.matchingByAlgorithm.semantic.feedbackTotal
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
