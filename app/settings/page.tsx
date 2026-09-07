"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAccountInfo, AccountInfo } from "@/lib/accountRole";
import NavBar from "@/components/NavBar";
import Button from "@/components/Button";
import TagSelect from "@/components/TagSelect";
import { TAXONOMY, splitInterestTags } from "@/lib/interestTaxonomy";

const DELETE_CONFIRM_TEXT = "DELETE";

// Same list onboarding builds from TAXONOMY — kept as one derived source
// so a future 11th category can't drift between the two pickers again
// (see app/onboarding/page.tsx's INTEREST_OPTIONS comment for the bug
// this pattern already caused once).
const BROAD_INTEREST_OPTIONS = TAXONOMY.map((c) => ({ value: c.broadTag, label: c.broadLabel }));

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Interests/focus editor — student accounts only (organizations have no
  // profiles.interests row at all).
  const [interestsLoaded, setInterestsLoaded] = useState(false);
  const [broadInterests, setBroadInterests] = useState<string[]>([]);
  const [focusSelections, setFocusSelections] = useState<string[]>([]);
  const [otherLegacyTags, setOtherLegacyTags] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestsSaved, setInterestsSaved] = useState(false);
  const [interestsError, setInterestsError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?mode=login");
        return;
      }
      setEmail(user.email ?? null);
      const info = await getAccountInfo();
      setAccount(info);

      if (info?.role === "student") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("interests")
          .eq("user_id", user.id)
          .maybeSingle();
        const { broad, focus, other } = splitInterestTags(profile?.interests ?? []);
        setBroadInterests(broad);
        setFocusSelections(focus);
        setOtherLegacyTags(other);
        setInterestsLoaded(true);
      }
    }
    load();
  }, [router]);

  async function handleSaveInterests() {
    setSavingInterests(true);
    setInterestsError(null);
    setInterestsSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingInterests(false);
      setInterestsError("You need to be logged in to save your interests.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ interests: [...broadInterests, ...focusSelections, ...otherLegacyTags] })
      .eq("user_id", user.id);
    setSavingInterests(false);

    if (error) {
      console.error("profiles interests update failed:", error.message);
      setInterestsError("Something went wrong saving your interests. Please try again.");
      return;
    }
    setInterestsSaved(true);
  }

  // Unchecking a broad interest also drops any focus selections that
  // belonged only to it — otherwise a focus picked under a category the
  // student later unchecks would keep silently counting toward matching
  // with no visible way to tell it was still there.
  function handleBroadInterestsChange(newBroad: string[]) {
    const removedCategories = broadInterests.filter((tag) => !newBroad.includes(tag));
    if (removedCategories.length > 0) {
      const removedFocusValues = new Set(
        TAXONOMY.filter((c) => removedCategories.includes(c.broadTag)).flatMap((c) => c.focuses.map((f) => f.value))
      );
      setFocusSelections((prev) => prev.filter((v) => !removedFocusValues.has(v)));
    }
    setBroadInterests(newBroad);
    setInterestsSaved(false);
  }

  async function authHeader(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session ? `Bearer ${session.access_token}` : null;
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    const header = await authHeader();
    if (!header) {
      setExporting(false);
      setExportError("You need to be logged in to export your data.");
      return;
    }

    const res = await fetch("/api/account", { headers: { Authorization: header } });
    setExporting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setExportError(body?.error ?? "Couldn't export your data.");
      return;
    }

    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `servefinder-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (deleteConfirmText !== DELETE_CONFIRM_TEXT) return;
    const confirmed = window.confirm(
      account?.role === "organization"
        ? "Delete your account? This also permanently deletes your organization and every opportunity it has posted. This can't be undone."
        : "Delete your account? This permanently removes your profile, saved opportunities, and application history. This can't be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    const header = await authHeader();
    if (!header) {
      setDeleting(false);
      setDeleteError("You need to be logged in to delete your account.");
      return;
    }

    const res = await fetch("/api/account", { method: "DELETE", headers: { Authorization: header } });
    if (!res.ok) {
      setDeleting(false);
      const body = await res.json().catch(() => null);
      setDeleteError(body?.error ?? "Couldn't delete your account.");
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?mode=login");
  }

  if (!email) {
    return (
      <>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
          <p className="text-sm text-ink/40 max-w-xl mx-auto">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen px-6 py-16">
        <div className="animate-fade-in-up max-w-xl mx-auto flex flex-col gap-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">
              Settings
            </p>
            <h1 className="font-display text-3xl font-semibold">Account</h1>
            <p className="text-ink/70 mt-2">
              {email} ·{" "}
              {account?.role === "organization" ? "Organization account" : "Student account"}
            </p>
          </div>

          {account?.role === "student" && interestsLoaded && (
            <div className="bg-white border border-line rounded-card shadow-soft p-6 flex flex-col gap-6">
              <div>
                <h2 className="font-display text-lg font-semibold">Interests</h2>
                <p className="text-sm text-ink/70 mt-1">
                  These shape your matches — picking a specific focus helps us rank closely-related
                  opportunities higher, but you&apos;ll still see strong matches across each broad
                  interest either way. Nothing here restricts what you can explore.
                </p>
              </div>

              <TagSelect
                label="Broad interests"
                options={BROAD_INTEREST_OPTIONS}
                selected={broadInterests}
                onChange={handleBroadInterestsChange}
              />

              {TAXONOMY.filter((category) => broadInterests.includes(category.broadTag)).map((category) => {
                const focusValues = category.focuses.map((f) => f.value);
                return (
                  <div key={category.broadTag}>
                    <TagSelect
                      label={`${category.broadLabel} focus areas (optional)`}
                      options={category.focuses}
                      selected={focusSelections.filter((v) => focusValues.includes(v))}
                      onChange={(newSelectedForCategory) => {
                        setFocusSelections((prev) => [
                          ...prev.filter((v) => !focusValues.includes(v)),
                          ...newSelectedForCategory,
                        ]);
                        setInterestsSaved(false);
                      }}
                    />
                  </div>
                );
              })}

              {interestsError && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                  {interestsError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveInterests}
                  disabled={savingInterests}
                  className="self-start text-sm px-4 py-2 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {savingInterests ? "Saving…" : "Save interests"}
                </button>
                {interestsSaved && (
                  <p className="text-sm text-moss-dark" role="status">
                    Saved.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-line rounded-card shadow-soft p-6 flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Export your data</h2>
            <p className="text-sm text-ink/70">
              Download everything associated with your account — your profile, applications,
              match feedback, and usage events — as a JSON file.
            </p>
            {exportError && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                {exportError}
              </p>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="self-start text-sm px-4 py-2 rounded-card border border-line hover:border-moss hover:shadow-pop transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none"
            >
              {exporting ? "Preparing export…" : "Download my data"}
            </button>
          </div>

          <div className="bg-white border border-red-200 rounded-card shadow-soft p-6 flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-red-700">Delete account</h2>
            <p className="text-sm text-ink/70">
              {account?.role === "organization"
                ? "Permanently deletes your account, your organization, and every opportunity it has posted. This can't be undone."
                : "Permanently deletes your account, profile, saved opportunities, and application history. This can't be undone."}
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                {deleteError}
              </p>
            )}
            <label htmlFor="settings-delete-confirm" className="text-xs font-mono uppercase tracking-wide text-ink/70">
              Type {DELETE_CONFIRM_TEXT} to confirm
            </label>
            <input
              id="settings-delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full max-w-xs border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-700/30 focus:border-red-700"
            />
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmText !== DELETE_CONFIRM_TEXT}
              className="self-start"
            >
              {deleting ? "Deleting…" : "Permanently delete my account"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/70 pt-4 border-t border-line">
            <a href="/about" className="hover:text-ink underline-offset-2 hover:underline">
              About
            </a>
            <a href="/privacy" className="hover:text-ink underline-offset-2 hover:underline">
              Privacy
            </a>
            <a href="/terms" className="hover:text-ink underline-offset-2 hover:underline">
              Terms
            </a>
            <a href="/contact" className="hover:text-ink underline-offset-2 hover:underline">
              Contact
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
