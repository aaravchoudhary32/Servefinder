"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { ClipboardIcon } from "@/components/icons";

type OrgRow = {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  // Only counts availability_status = 'open' rows — matches the rule
  // that a directory record (or a seasonal/unverified one) shouldn't
  // inflate what looks like an "active opportunity" count.
  openOpportunityCount: number;
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?mode=login");
        return;
      }

      const [{ data: orgs }, { data: opps }] = await Promise.all([
        supabase.from("organizations").select("id, name, description, city").order("name"),
        supabase.from("opportunities").select("organization_id, availability_status"),
      ]);

      const counts = new Map<string, number>();
      for (const o of opps ?? []) {
        if (!o.organization_id || o.availability_status !== "open") continue;
        counts.set(o.organization_id, (counts.get(o.organization_id) ?? 0) + 1);
      }

      setOrganizations(
        (orgs ?? []).map((org) => ({
          ...org,
          openOpportunityCount: counts.get(org.id) ?? 0,
        }))
      );
      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-5xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            Organizations
          </p>
          <h1 className="font-display text-3xl font-semibold mb-10">
            Who&apos;s posting opportunities
          </h1>

          {loading ? (
            <div
              className="bg-white border border-line rounded-card shadow-soft divide-y divide-line"
              role="status"
              aria-label="Loading organizations"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-4" aria-hidden="true">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <Skeleton className="h-3 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : organizations.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="w-8 h-8" />}
              title="No organizations yet"
              description="Organizations created here, by an org account signing up, or auto-created by an ingestion source will show up here."
            />
          ) : (
            <div className="bg-white border border-line rounded-card shadow-soft overflow-hidden">
              <div className="divide-y divide-line">
                {organizations.map((org) => (
                  <Link
                    key={org.id}
                    href={`/organizations/${org.id}`}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-moss-light/40 transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-semibold truncate">
                        {org.name}
                      </h2>
                      {org.description && (
                        <p className="text-sm text-ink/70 truncate">
                          {org.description}
                        </p>
                      )}
                      {org.city && (
                        <p className="text-xs font-mono text-ink/70 truncate">{org.city}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-mono uppercase tracking-wide text-ink/70 bg-line/40 px-2.5 py-1 rounded-card">
                      {org.openOpportunityCount === 0
                        ? "Organization directory"
                        : `${org.openOpportunityCount} opportunit${org.openOpportunityCount === 1 ? "y" : "ies"}`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
