"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { advanceApplicationStatus } from "@/lib/applications";
import NavBar from "@/components/NavBar";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import ApplicationsSkeleton from "@/components/ApplicationsSkeleton";
import { ClipboardIcon } from "@/components/icons";
import { STATUS_FLOW, STATUS_LABELS, nextStatus, ApplicationStatus } from "@/lib/applicationStatus";

type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  updated_at: string;
  opportunity_id: string;
  opportunities: {
    title: string;
    category: string;
    location: string | null;
    schedule_slots: string[];
    minimum_age: number;
  } | null;
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?mode=login");
        return;
      }

      const { data } = await supabase
        .from("applications")
        .select(
          "id, status, updated_at, opportunity_id, opportunities(title, category, location, schedule_slots, minimum_age)"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      setApplications((data ?? []) as unknown as ApplicationRow[]);
      setLoading(false);
    }

    load();
  }, [router]);

  async function advance(app: ApplicationRow) {
    const next = await advanceApplicationStatus(supabase, {
      id: app.id,
      status: app.status,
      opportunityId: app.opportunity_id,
    });
    if (!next) return;

    setApplications((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, status: next } : a))
    );
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <ApplicationsSkeleton />
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-5xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            Your applications
          </p>
          <h1 className="font-display text-3xl font-semibold mb-10">
            Application tracker
          </h1>

          {applications.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="Nothing tracked yet"
              description="Save an opportunity from your dashboard and it'll show up here, sorted by status as you move through it."
              action={
                <Button href="/dashboard" variant="primary" size="md">
                  Find opportunities
                </Button>
              }
            />
          ) : (
            <div className="grid md:grid-cols-4 gap-6">
              {STATUS_FLOW.map((status, colIndex) => {
                const inStatus = applications.filter((a) => a.status === status);
                return (
                  <div key={status}>
                    <h2 className="font-mono text-xs uppercase tracking-widest text-ink/70 mb-3">
                      {STATUS_LABELS[status]} ({inStatus.length})
                    </h2>
                    <div className="flex flex-col gap-3">
                      {inStatus.length === 0 && (
                        <p className="text-xs text-ink/70">None yet</p>
                      )}
                      {inStatus.map((app, i) => {
                        const upcoming = nextStatus(app.status);
                        return (
                          <div
                            key={app.id}
                            className="animate-fade-in-up bg-white border border-line rounded-card shadow-soft hover:shadow-pop transition-shadow duration-200 p-4 flex flex-col gap-2"
                            style={{ animationDelay: `${(colIndex * 2 + i) * 50}ms` }}
                          >
                            <span className="pin-tag self-start">
                              {app.opportunities?.category}
                            </span>
                            <h3 className="font-display text-sm font-semibold leading-tight">
                              {app.opportunities?.title}
                            </h3>
                            <p className="text-xs text-ink/70 font-mono">
                              {app.opportunities?.location ?? "Location TBD"}
                            </p>
                            <StatusBadge status={app.status} />
                            {upcoming && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="self-start"
                                onClick={() => advance(app)}
                              >
                                Mark as {STATUS_LABELS[upcoming]}
                              </Button>
                            )}
                          </div>
                        );
                      })}
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
