"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/Button";
import { ClipboardIcon } from "@/components/icons";

// Aggregate-only admin dashboard for genuine student adoption/
// engagement — deliberately separate from /admin/analytics (matching-
// algorithm quality: classic vs. semantic). All five data-fetching RPCs
// below are security-definer functions (supabase/add_user_analytics.sql)
// that reject a non-admin caller internally; the isAdmin check here is
// the same UX-convenience pattern every other /admin/* page already
// uses (a clear message instead of a failed RPC call), not the real
// security boundary.
type UserTotals = {
  genuine_students: number;
  genuine_organizations: number;
  new_students_7d: number;
  new_students_30d: number;
  onboarding_completed: number;
  tracking_began_at: string | null;
};

type Engagement = {
  dau: number;
  wau: number;
  mau: number;
  returning_students_30d: number;
  currently_saved: number;
  currently_applied: number;
  currently_accepted: number;
  currently_completed: number;
  official_link_clicks_total: number;
  feedback_submissions_total: number;
};

type FunnelStage = { stage_order: number; stage: string; student_count: number };

type TrendDay = {
  day: string;
  new_registrations: number;
  daily_active_students: number;
  detail_views: number;
  link_clicks: number;
  saves: number;
  applied_actions: number;
};

type AmbiguousAccount = { user_id: string; email: string | null; role: string | null; created_at: string };

const CLASSIFICATION_OPTIONS = [
  { value: "automated_test", label: "Automated test account" },
  { value: "manual_test", label: "Manual test account" },
  { value: "demo", label: "Demo account" },
  { value: "other_excluded", label: "Other (exclude)" },
] as const;

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white border border-line rounded-card shadow-soft p-5">
      <p className="text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-ink/70 mt-1">{hint}</p>}
    </div>
  );
}

// UTC-safe: `day` arrives as a plain "YYYY-MM-DD" string from Postgres.
// Parsing it as local time (`new Date("2026-09-06")` alone can do this
// in some engines) risks shifting the displayed date by one depending
// on the viewer's timezone — forcing UTC on both the parse and the
// format keeps the label matching the actual UTC calendar day stored.
function formatUtcDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// A plain CSS bar chart, not a charting library (per the requirement:
// don't add a large dependency for this) — the visual bars are
// decorative (aria-hidden) since a screen reader can't meaningfully
// read a bar's height; the real numbers are in the <table> rendered
// right below every one of these on the page, which is what assistive
// tech and "include textual totals" both actually need.
function TrendBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-0.5 h-16" aria-hidden="true" title={label}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-moss/70 rounded-t-sm min-w-[2px]"
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function UserAnalyticsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userTotals, setUserTotals] = useState<UserTotals | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [ambiguousAccounts, setAmbiguousAccounts] = useState<AmbiguousAccount[]>([]);

  const [classifyDrafts, setClassifyDrafts] = useState<Record<string, { classification: string; note: string }>>({});
  const [classifying, setClassifying] = useState<string | null>(null);
  const [classifyError, setClassifyError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminAndLoad() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      const admin = Boolean(adminRow);
      setIsAdmin(admin);
      if (!admin) return;

      setLoading(true);
      const [totalsRes, engagementRes, funnelRes, trendsRes, ambiguousRes] = await Promise.all([
        supabase.rpc("analytics_admin_user_totals"),
        supabase.rpc("analytics_admin_engagement"),
        supabase.rpc("analytics_admin_funnel"),
        supabase.rpc("analytics_admin_trends"),
        supabase.rpc("analytics_admin_ambiguous_accounts"),
      ]);

      const firstError =
        totalsRes.error || engagementRes.error || funnelRes.error || trendsRes.error || ambiguousRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        setLoading(false);
        return;
      }

      setUserTotals(totalsRes.data?.[0] ?? null);
      setEngagement(engagementRes.data?.[0] ?? null);
      setFunnel(funnelRes.data ?? []);
      setTrends(trendsRes.data ?? []);
      setAmbiguousAccounts(ambiguousRes.data ?? []);
      setLoading(false);
    }
    checkAdminAndLoad();
  }, []);

  async function classifyAccount(userId: string) {
    const draft = classifyDrafts[userId];
    if (!draft?.classification) return;

    setClassifying(userId);
    setClassifyError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setClassifying(null);
      return;
    }

    const { error } = await supabase.from("account_classifications").upsert({
      user_id: userId,
      classification: draft.classification,
      note: draft.note.trim() || null,
      classified_by: user.id,
    });

    setClassifying(null);
    if (error) {
      setClassifyError(error.message);
      return;
    }
    setAmbiguousAccounts((prev) => prev.filter((a) => a.user_id !== userId));
  }

  if (isAdmin === null || (isAdmin && loading)) {
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
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="Admin access required"
              description="This page is for admin users only."
            />
          </div>
        </main>
      </>
    );
  }

  if (loadError || !userTotals || !engagement) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <div className="max-w-xl mx-auto">
            <EmptyState
              title="Couldn't load analytics"
              description={loadError ?? "Something went wrong loading these statistics. Please try again."}
            />
          </div>
        </main>
      </>
    );
  }

  const onboardingPct =
    userTotals.genuine_students > 0
      ? Math.round((userTotals.onboarding_completed / userTotals.genuine_students) * 100)
      : null;

  const maxFunnelCount = Math.max(1, ...funnel.map((f) => f.student_count));

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">Admin</p>
              <h1 className="font-display text-3xl font-semibold">User analytics</h1>
            </div>
            <Link
              href="/admin"
              className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 shrink-0"
            >
              ← Back to admin
            </Link>
          </div>

          <p className="text-sm text-ink/70 mb-1 max-w-2xl">
            Aggregate statistics only &mdash; no individual student&apos;s browsing history, email, or activity is
            shown here. Administrator, demo, and test/automated accounts are excluded from every number below by
            default.
          </p>
          <p className="text-sm text-ink/70 mb-8">
            <strong>Tracking began:</strong>{" "}
            {userTotals.tracking_began_at
              ? formatTimestamp(userTotals.tracking_began_at)
              : "No qualifying events recorded yet"}
            . Registered-user counts and current saved/applied/accepted/completed totals below come from live
            account records and are accurate for all time; everything else that depends on the event log
            (active-user counts, the funnel&apos;s &ldquo;viewed&rdquo;/&ldquo;saved or clicked&rdquo; stages, and
            the 30-day trends) only reflects activity since this timestamp.
          </p>

          <details className="bg-white border border-line rounded-card shadow-soft p-5 mb-10">
            <summary className="cursor-pointer text-sm font-medium">What do these terms mean?</summary>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="font-medium">Registered user</dt>
                <dd className="text-ink/70">
                  Has created a ServeFinder account with a student or organization role. Doesn&apos;t require having
                  finished onboarding.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Active user</dt>
                <dd className="text-ink/70">
                  A genuine authenticated student who performed at least one meaningful action (completed
                  onboarding, searched, used a filter, viewed an opportunity&apos;s details, saved/unsaved one,
                  clicked an official link, changed an application&apos;s status, or submitted feedback) during the
                  period. Loading the dashboard or Explore page alone does not count.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Returning user</dt>
                <dd className="text-ink/70">
                  A genuine student active (per the definition above) on at least two different UTC calendar days
                  within the trailing 30 days.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Official-link click</dt>
                <dd className="text-ink/70">
                  A student clicked an opportunity&apos;s (or organization&apos;s) real external application/listing
                  link.
                  This does not confirm they actually submitted an application on that external site — only that
                  they followed the link.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Save / Applied / Accepted / Completed</dt>
                <dd className="text-ink/70">
                  The four statuses an opportunity moves through in a student&apos;s own tracker. Applied/Accepted/
                  Completed can be set either by the student themselves or, for Accepted/Completed, by the posting
                  organization.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Excluded test/demo/admin account</dt>
                <dd className="text-ink/70">
                  The single administrator account, plus any account marked as an automated test, manually
                  designated test, or demo account (see &ldquo;Review ambiguous accounts&rdquo; below). Excluded
                  accounts are never deleted &mdash; only left out of these totals.
                </dd>
              </div>
            </dl>
          </details>

          <section className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
              User totals — all-time, from live records
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Genuine registered students" value={userTotals.genuine_students} />
              <StatCard label="Genuine organization accounts" value={userTotals.genuine_organizations} />
              <StatCard label="New students (7 days)" value={userTotals.new_students_7d} />
              <StatCard label="New students (30 days)" value={userTotals.new_students_30d} />
              <StatCard
                label="Onboarding completed"
                value={
                  onboardingPct === null
                    ? userTotals.onboarding_completed
                    : `${userTotals.onboarding_completed} (${onboardingPct}%)`
                }
              />
            </div>
          </section>

          <section className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
              Activity — active-user counts since tracking began; saved/applied/accepted/completed are current
              snapshots from live records
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Daily active students" value={engagement.dau} hint="Today, UTC" />
              <StatCard label="Weekly active students" value={engagement.wau} hint="Trailing 7 days" />
              <StatCard label="Monthly active students" value={engagement.mau} hint="Trailing 30 days" />
              <StatCard
                label="Returning students"
                value={engagement.returning_students_30d}
                hint="Active 2+ days in 30"
              />
              <StatCard label="Currently saved" value={engagement.currently_saved} />
              <StatCard label="Currently applied" value={engagement.currently_applied} />
              <StatCard label="Currently accepted" value={engagement.currently_accepted} />
              <StatCard label="Currently completed" value={engagement.currently_completed} />
              <StatCard label="Official-link clicks (all-time)" value={engagement.official_link_clicks_total} />
              <StatCard label="Feedback submissions (all-time)" value={engagement.feedback_submissions_total} />
            </div>
          </section>

          <section className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
              Engagement funnel — unique genuine students who reached each stage
            </h2>
            <p className="text-xs text-ink/70 mb-3 max-w-2xl">
              Cumulative: reaching &ldquo;Marked Accepted&rdquo; implies the student also saved and applied. A stage
              with 0 students is shown as 0, not hidden &mdash; that&apos;s a real result worth seeing, not a missing
              one.
            </p>
            <div className="bg-white border border-line rounded-card shadow-soft p-5 flex flex-col gap-3">
              {funnel.map((stage) => (
                <div key={stage.stage_order}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>
                      {stage.stage_order}. {stage.stage}
                    </span>
                    <span className="font-mono">
                      {stage.student_count === 0 ? "No students yet" : stage.student_count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-line/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-moss transition-all duration-500 ease-smooth"
                      style={{ width: `${(stage.student_count / maxFunnelCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
              30-day trends (UTC calendar days, since tracking began)
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {(
                [
                  { key: "new_registrations", label: "New genuine student registrations" },
                  { key: "daily_active_students", label: "Daily active students" },
                  { key: "detail_views", label: "Opportunity-detail views" },
                  { key: "link_clicks", label: "Official-link clicks" },
                  { key: "saves", label: "Saves" },
                  { key: "applied_actions", label: "Applied actions" },
                ] as const
              ).map(({ key, label }) => {
                const values = trends.map((t) => t[key]);
                const total = values.reduce((a, b) => a + b, 0);
                return (
                  <div key={key} className="bg-white border border-line rounded-card shadow-soft p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs font-mono text-ink/70">{total} total</p>
                    </div>
                    <TrendBars values={values} label={label} />
                    <details className="mt-2">
                      <summary className="text-xs text-moss-dark underline underline-offset-2 cursor-pointer">
                        View daily numbers
                      </summary>
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full text-xs">
                          <caption className="sr-only">{label}, by day</caption>
                          <thead>
                            <tr className="border-b border-line text-left">
                              <th scope="col" className="py-1 pr-3 font-mono uppercase text-ink/70">
                                Day
                              </th>
                              <th scope="col" className="py-1 font-mono uppercase text-ink/70">
                                Count
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {trends.map((t) => (
                              <tr key={t.day} className="border-b border-line/60">
                                <td className="py-1 pr-3">{formatUtcDate(t.day)}</td>
                                <td className="py-1 font-mono">{t[key]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
              Review ambiguous accounts ({ambiguousAccounts.length})
            </h2>
            <p className="text-xs text-ink/70 mb-3 max-w-2xl">
              Accounts whose email loosely resembles a test or demo fixture, not yet classified either way. Nothing
              here is auto-excluded from the totals above &mdash; classify an account below only if you&apos;re
              sure, or leave it as a genuine account by doing nothing.
            </p>
            {ambiguousAccounts.length === 0 ? (
              <p className="text-sm text-ink/70">No ambiguous accounts to review right now.</p>
            ) : (
              <div className="bg-white border border-line rounded-card shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th scope="col" className="px-4 py-3 font-mono text-xs uppercase text-ink/70">
                          Email
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-xs uppercase text-ink/70">
                          Role
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-xs uppercase text-ink/70">
                          Registered
                        </th>
                        <th scope="col" className="px-4 py-3 font-mono text-xs uppercase text-ink/70">
                          Classify
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {ambiguousAccounts.map((a) => {
                        const draft = classifyDrafts[a.user_id] ?? { classification: "", note: "" };
                        return (
                          <tr key={a.user_id}>
                            <td className="px-4 py-3 break-all">{a.email ?? "(no email)"}</td>
                            <td className="px-4 py-3">{a.role ?? "unset"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(a.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-2 min-w-[220px]">
                                <label className="sr-only" htmlFor={`classify-${a.user_id}`}>
                                  Classification for {a.email}
                                </label>
                                <select
                                  id={`classify-${a.user_id}`}
                                  value={draft.classification}
                                  onChange={(e) =>
                                    setClassifyDrafts((prev) => ({
                                      ...prev,
                                      [a.user_id]: { ...draft, classification: e.target.value },
                                    }))
                                  }
                                  className="border border-line rounded-card px-2 py-1.5 text-sm bg-white"
                                >
                                  <option value="">Choose a classification…</option>
                                  {CLASSIFICATION_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={!draft.classification || classifying === a.user_id}
                                  onClick={() => classifyAccount(a.user_id)}
                                >
                                  {classifying === a.user_id ? "Saving…" : "Exclude from analytics"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {classifyError && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2 mt-3">
                {classifyError}
              </p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
