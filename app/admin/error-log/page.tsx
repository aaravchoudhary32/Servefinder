"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import { ClipboardIcon } from "@/components/icons";

type ErrorLogRow = {
  id: string;
  route: string;
  message: string;
  context: Record<string, unknown>;
  created_at: string;
};

const ROW_LIMIT = 50;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ErrorLogPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAndLoad() {
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
      setIsAdmin(Boolean(adminRow));
      if (!adminRow) return;

      setLoading(true);
      const { data } = await supabase
        .from("error_log")
        .select("id, route, message, context, created_at")
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      setRows((data ?? []) as ErrorLogRow[]);
      setLoading(false);
    }
    checkAdminAndLoad();
  }, []);

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
              description="Your account isn't in the admins list, so you can't view the error log. Ask an existing admin to add your account if you think this is wrong."
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
                Admin
              </p>
              <h1 className="font-display text-3xl font-semibold">Error log</h1>
              <p className="text-sm text-ink/70 mt-2 max-w-lg">
                Structured errors caught by server routes — most recent {ROW_LIMIT}{" "}
                shown. Not a substitute for real monitoring once this app has real
                users; an in-house record until then.
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
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="No errors logged"
              description="Nothing has been recorded here yet — that's the expected state, not a sign anything's missing."
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
                        Route
                      </th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink/70">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-ink/70">
                          {formatTimestamp(row.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink/70">
                          {row.route}
                        </td>
                        <td className="px-4 py-3 text-red-700 max-w-md">{row.message}</td>
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
