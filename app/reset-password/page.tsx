"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { friendlyAuthError } from "@/lib/authErrorMessages";
import { PinIcon } from "@/components/icons";
import Button from "@/components/Button";

type LinkStatus = "checking" | "ready" | "invalid";

// Reached by clicking the link in the email resetPasswordForEmail() sends
// (app/login/page.tsx's handleForgotPassword). Supabase's own /auth/v1/verify
// endpoint validates the recovery token server-side, then redirects the
// browser back here with either a recovery session encoded in the URL, or
// (for an expired/already-used/malformed link) an error_code appended
// instead — this page never parses or touches the raw token itself,
// only the outcome supabase-js's client already extracts from the URL.
//
// Deliberately does NOT treat "a session exists" as proof this is a valid
// recovery visit — an already-logged-in user navigating here directly
// would also have a session, and per this app's own security review,
// a normal authenticated session must never be silently treated as a
// password-recovery one. The only signals trusted here are the
// PASSWORD_RECOVERY auth event and the URL's own recovery markers.
function readUrlRecoveryState(): { errorCode: string | null; looksLikeRecoveryLink: boolean } {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  const errorCode = hashParams.get("error_code") || searchParams.get("error_code");
  const looksLikeRecoveryLink =
    hashParams.get("type") === "recovery" || Boolean(hashParams.get("access_token")) || Boolean(searchParams.get("code"));
  return { errorCode, looksLikeRecoveryLink };
}

export default function ResetPasswordPage() {
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let resolved = false;

    // The one documented, reliable signal that a real recovery session
    // was just established from this URL (not a normal login session).
    // Subscribed unconditionally, before the async status check below,
    // so a PASSWORD_RECOVERY event firing during supabase-js's own
    // client initialization can't be missed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        resolved = true;
        setLinkStatus("ready");
      }
    });

    // Wrapped in an async function (rather than setState calls directly
    // in the effect body) so this reads as what it is: one status
    // resolution, done once — not a synchronous render-cascade the
    // effect body would otherwise appear to trigger.
    async function resolveLinkStatus() {
      const { errorCode, looksLikeRecoveryLink } = readUrlRecoveryState();

      // Supabase's own verify redirect appends error info directly to
      // the URL for an expired, already-used, or otherwise rejected
      // link — checked before any async session work, so this shows
      // the safe explanation immediately instead of waiting on a
      // timeout.
      if (errorCode) {
        resolved = true;
        setLinkStatus("invalid");
        return;
      }

      // Nothing in the URL even claims to be a recovery link (a bare
      // direct visit to this route) — no token to validate, so there's
      // nothing to wait for.
      if (!looksLikeRecoveryLink) {
        resolved = true;
        setLinkStatus("invalid");
        return;
      }

      // Covers the race noted above from the other direction: the URL
      // already told us this looks like a recovery link, so a session
      // existing now (checked once, not polled) is enough corroboration
      // without trusting event timing alone.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!resolved && session) {
        resolved = true;
        setLinkStatus("ready");
      }
    }
    resolveLinkStatus();

    // Nothing above resolved within a few seconds — most likely a
    // malformed link, or Supabase rejected it without an error_code
    // this page recognizes. Treated as invalid rather than leaving the
    // page stuck checking forever.
    const timeout = setTimeout(() => {
      if (!resolved) setLinkStatus("invalid");
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setLoading(true);
    let updateError;
    try {
      ({ error: updateError } = await supabase.auth.updateUser({ password }));
    } catch {
      // A thrown (network-level) failure rather than a returned
      // AuthError — same safe, generic handling either way, never the
      // raw exception text.
      setLoading(false);
      setError("Something went wrong. Please check your connection and try again.");
      return;
    }

    if (updateError) {
      setLoading(false);
      setError(friendlyAuthError(updateError.message, "Something went wrong. Please try again."));
      return;
    }

    // The recovery session that just set this password is a real,
    // temporary authenticated session — ending it here means the user
    // has to actually log back in with the new password next, which is
    // both the more secure default and direct proof (for them and for
    // the test suite) that the new password really works, rather than
    // silently carrying them into the dashboard on the old session.
    await supabase.auth.signOut();
    setLoading(false);
    setSuccess(true);
  }

  return (
    <main id="main-content" tabIndex={-1} className="bg-board min-h-screen flex items-center justify-center px-6">
      <div className="animate-fade-in-up w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-moss text-white">
            <PinIcon className="w-4 h-4" />
          </span>
          <span className="font-display text-base font-semibold">ServeFinder</span>
        </div>

        <div className="bg-white border border-line rounded-card shadow-lift p-8">
          {linkStatus === "checking" && (
            <div>
              <h1 className="font-display text-2xl font-semibold mb-1">Checking your link…</h1>
              <p className="text-sm text-ink/70">This only takes a moment.</p>
            </div>
          )}

          {linkStatus === "invalid" && (
            <div>
              <h1 className="font-display text-2xl font-semibold mb-1">Link invalid or expired</h1>
              <p role="alert" className="text-sm text-ink/70 mb-6">
                This password-reset link is invalid or has expired.
              </p>
              <div className="flex flex-col gap-3">
                <Button href="/login?mode=forgot" variant="primary" size="md">
                  Request a new reset email
                </Button>
                <Button href="/login?mode=login" variant="ghost" size="md">
                  Return to Login
                </Button>
              </div>
            </div>
          )}

          {linkStatus === "ready" && !success && (
            <div>
              <h1 className="font-display text-2xl font-semibold mb-1">Choose a new password</h1>
              <p className="text-sm text-ink/70 mb-6">Enter and confirm your new password below.</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="reset-password"
                    className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1"
                  >
                    New password
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="reset-password-hint"
                    className="w-full border border-line rounded-card px-3 py-2.5 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                  />
                  <p id="reset-password-hint" className="text-xs text-ink/70 mt-1">
                    At least 8 characters.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reset-password-confirm"
                    className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="reset-password-confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-line rounded-card px-3 py-2.5 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="animate-fade-in text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2"
                  >
                    {error}
                  </p>
                )}

                <Button type="submit" variant="primary" size="md" disabled={loading} className="mt-1">
                  {loading ? "Please wait…" : "Set new password"}
                </Button>
              </form>
            </div>
          )}

          {success && (
            <div>
              <h1 className="font-display text-2xl font-semibold mb-1">Password updated</h1>
              <p role="status" className="text-sm text-ink/70 mb-6">
                Your password has been changed. Log in with your new password to continue.
              </p>
              <Button href="/login?mode=login" variant="primary" size="md">
                Go to Login
              </Button>
            </div>
          )}
        </div>

        {linkStatus === "ready" && !success && (
          <p className="text-center text-sm text-ink/70 mt-5">
            <Link href="/login?mode=login" className="text-moss-dark underline underline-offset-2 hover:text-moss transition-colors">
              Back to Login
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
