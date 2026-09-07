"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import { ClipboardIcon } from "@/components/icons";

type ReportStatus = "received" | "reviewing" | "corrected" | "dismissed";
type ReportType = "inaccurate_listing" | "general_feedback";

type ReportRow = {
  id: string;
  reporter_user_id: string;
  opportunity_id: string | null;
  report_type: ReportType;
  message: string;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  opportunities: { title: string } | null;
};

const ROW_LIMIT = 200;
const STATUS_OPTIONS: ReportStatus[] = ["received", "reviewing", "corrected", "dismissed"];
const FILTER_OPTIONS: Array<ReportStatus | "all"> = ["all", "received", "reviewing", "corrected", "dismissed"];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminReportsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "all">("received");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("user_reports")
      .select("id, reporter_user_id, opportunity_id, report_type, message, status, admin_note, created_at, opportunities(title)")
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT);
    setRows((data ?? []) as unknown as ReportRow[]);
    setLoading(false);
  }

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
      setIsAdmin(Boolean(adminRow));
      if (!adminRow) return;
      await load();
    }
    checkAdminAndLoad();
  }, []);

  async function updateStatus(id: string, status: ReportStatus) {
    setSavingId(id);
    const { error } = await supabase
      .from("user_reports")
      .update({
        status,
        resolved_at: status === "corrected" || status === "dismissed" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setSavingId(null);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  }

  async function saveNote(id: string) {
    const note = noteDrafts[id] ?? "";
    setSavingId(id);
    const { error } = await supabase.from("user_reports").update({ admin_note: note }).eq("id", id);
    setSavingId(null);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, admin_note: note } : r)));
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
              description="Your account isn't in the admins list, so you can't view reports. Ask an existing admin to add your account if you think this is wrong."
            />
          </div>
        </main>
      </>
    );
  }

  const visibleRows = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">Admin</p>
              <h1 className="font-display text-3xl font-semibold">Reports &amp; feedback</h1>
              <p className="text-sm text-ink/70 mt-2 max-w-lg">
                Inaccurate-listing reports and general feedback submitted by students and organizations. Most
                recent {ROW_LIMIT} shown.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 shrink-0"
            >
              ← Back to admin
            </Link>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-6" role="group" aria-label="Filter by status">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-card border transition-all duration-150 ${
                  filter === option
                    ? "bg-moss text-white border-moss"
                    : "border-line text-ink/70 hover:border-moss hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-ink/70">Loading…</p>
          ) : visibleRows.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="Nothing here"
              description="No reports match this filter right now."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {visibleRows.map((row) => (
                <div key={row.id} className="bg-white border border-line rounded-card shadow-soft p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wide text-ink/70">
                        {row.report_type === "inaccurate_listing" ? "Inaccurate listing" : "General feedback"}
                      </span>
                      {row.report_type === "inaccurate_listing" && (
                        <p className="text-sm font-medium">
                          {row.opportunities?.title ?? "Deleted opportunity"}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-ink/70 font-mono whitespace-nowrap">{formatTimestamp(row.created_at)}</span>
                  </div>

                  <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{row.message}</p>

                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <label htmlFor={`status-${row.id}`} className="text-xs font-mono uppercase tracking-wide text-ink/70">
                      Status
                    </label>
                    <select
                      id={`status-${row.id}`}
                      value={row.status}
                      disabled={savingId === row.id}
                      onChange={(e) => updateStatus(row.id, e.target.value as ReportStatus)}
                      className="text-sm border border-line rounded-card px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Internal note (optional)"
                      value={noteDrafts[row.id] ?? row.admin_note ?? ""}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      className="flex-1 text-sm border border-line rounded-card px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                    />
                    <button
                      type="button"
                      onClick={() => saveNote(row.id)}
                      disabled={savingId === row.id}
                      className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 disabled:opacity-50"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
