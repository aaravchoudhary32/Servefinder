"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAccountInfo, homeRouteFor } from "@/lib/accountRole";
import Button from "@/components/Button";

const INPUT_CLASS =
  "w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss";

export default function OrganizationOnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Organization-only, and only for an org that hasn't finished setup
  // yet — a student here would just hit create_organization_account's
  // own "not registered as an organization" exception on submit, and an
  // already-linked org rep has nothing left to do on this form (a
  // second submit would just hit its "already linked" exception too).
  useEffect(() => {
    async function guard() {
      const account = await getAccountInfo();
      if (!account) return;
      if (account.role === "student" || (account.role === "organization" && account.organizationId)) {
        router.replace(homeRouteFor(account));
      }
    }
    guard();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You need to be logged in to set up an organization.");
      return;
    }

    setSaving(true);
    // Runs as a security definer function (not a plain insert) — the
    // only path that can create an organization_accounts row, so it's
    // the only way this page can actually link the new org to this
    // account. See supabase/schema.sql for why.
    const { error } = await supabase.rpc("create_organization_account", {
      org_name: name,
      org_description: description || null,
      org_contact_email: contactEmail || null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/org-dashboard");
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in-up max-w-xl mx-auto flex flex-col gap-8"
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
            Step 1 of 1
          </p>
          <h1 className="font-display text-3xl font-semibold">
            Tell us about your organization
          </h1>
          <p className="text-ink/70 mt-2 leading-relaxed">
            This becomes your organization&apos;s public profile. New organizations
            start unverified, so students won&apos;t see your opportunities until an
            admin approves your organization — after that, they&apos;ll appear on
            everything you post. You&apos;ll only be able to manage this one
            organization&apos;s listings.
          </p>
        </div>

        <div className="bg-white border border-line rounded-card shadow-soft p-6 flex flex-col gap-6">
          <div>
            <label htmlFor="org-onboarding-name" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
              Organization name
            </label>
            <input
              id="org-onboarding-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="org-onboarding-description" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
              Short description{" "}
              <span className="normal-case text-ink/70">(optional)</span>
            </label>
            <textarea
              id="org-onboarding-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="org-onboarding-contact-email" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
              Contact email{" "}
              <span className="normal-case text-ink/70">(optional)</span>
            </label>
            <input
              id="org-onboarding-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="animate-fade-in text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={saving} className="self-start">
          {saving ? "Saving…" : "Create organization"}
        </Button>
      </form>
    </main>
  );
}
