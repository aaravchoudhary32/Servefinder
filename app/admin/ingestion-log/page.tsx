"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import { ClipboardIcon } from "@/components/icons";

type IngestionRun = {
  id: string;
  source: string;
  run_at: string;
  status: "success" | "error";
  listings_found: number;
  listings_inserted: number;
  listings_updated: number;
  listings_skipped_duplicate: number;
  error_message: string | null;
};

const RUN_LIMIT = 50;

function sourceLabel(source: string): string {
  return source
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function IngestionLogPage() {
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRuns() {
      setLoading(true);
      const { data } = await supabase
        .from("ingestion_runs")
        .select(
          "id, source, run_at, status, listings_found, listings_inserted, listings_updated, listings_skipped_duplicate, error_message"
        )
        .order("run_at", { ascending: false })
        .limit(RUN_LIMIT);
      setRuns((data ?? []) as IngestionRun[]);
      setLoading(false);
    }
    loadRuns();
  }, []);

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
                Admin
              </p>
              <h1 className="font-display text-3xl font-semibold">Ingestion log</h1>
              <p className="text-sm text-ink/70 mt-2 max-w-lg">
                Every automated fetcher run — manual CLI or scheduled cron — most
                recent {RUN_LIMIT} shown.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm px-3 py-1.5 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 shrink-0"
            >
              ← Back to admin
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-ink/70">Loading…</p>
          ) : runs.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="No fetcher runs yet"
              description="Run a source manually (e.g. npm run fetch:chesapeake-humane) or wait for the weekly cron — every run shows up here."
            />
          ) : (
            <div className="bg-white border border-line rounded-card shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                        Source
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                        Status
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70 text-right">
                        Found
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70 text-right">
                        Inserted
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70 text-right">
                        Updated
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70 text-right">
                        Duplicates skipped
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {runs.map((run) => (
                      <tr key={run.id} className="align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-ink/70">
                          {formatTimestamp(run.run_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {sourceLabel(run.source)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border ${
                              run.status === "success"
                                ? "bg-moss-light text-moss-dark border-moss/30"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {run.status}
                          </span>
                          {run.status === "error" && run.error_message && (
                            <p className="text-xs text-red-700 mt-1 max-w-xs">
                              {run.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink/70">
                          {run.listings_found}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink/70">
                          {run.listings_inserted}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink/70">
                          {run.listings_updated}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink/70">
                          {run.listings_skipped_duplicate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
