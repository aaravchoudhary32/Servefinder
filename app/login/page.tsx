"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAccountInfo, homeRouteFor } from "@/lib/accountRole";
import { friendlyAuthError } from "@/lib/authErrorMessages";
import { PinIcon } from "@/components/icons";
import Button from "@/components/Button";

type AccountType = "student" | "organization";
type Mode = "signup" | "login" | "forgot";

function initialModeFrom(requested: string | null): Mode {
  return requested === "login" || requested === "forgot" ? requested : "signup";
}

// Wrapping the real page in Suspense is what lets useSearchParams() below
// read the `?mode=login|signup|forgot` query param (set by the landing
// page's Log In / Sign Up buttons) correctly on the very first render,
// server and client alike — no post-mount effect, no flash of the wrong
// form before it flips to the right one, and no hydration mismatch, since
// both the server-rendered HTML and the client's first paint agree on the
// real mode from the start. Suspense is what makes that possible while
// this page stays statically prerenderable (confirmed in `next build`'s
// route list — still ○ Static, not ƒ Dynamic, after this change).
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-board min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-moss text-white">
            <PinIcon className="w-4 h-4" />
          </span>
          <span className="font-display text-base font-semibold">
            ServeFinder
          </span>
        </div>
        <div className="bg-white border border-line rounded-card shadow-lift p-8 h-[21rem]" />
      </div>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => initialModeFrom(searchParams.get("mode")));
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set once a reset email has been requested — shown instead of the
  // form so a resubmit can't fire a second email by accident.
  const [resetRequested, setResetRequested] = useState(false);
  // Drives the "Log in instead" button beneath the signup error — kept
  // separate from `error` itself so the two can't drift (this is a
  // presence check on the specific error, not a re-parse of its text).
  const [existingAccountDetected, setExistingAccountDetected] = useState(false);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // resetPasswordForEmail() itself never reveals whether the address
    // has an account (Supabase returns success either way) — showing
    // the same confirmation regardless of the result preserves that,
    // rather than leaking account existence through a client-side branch.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    setResetRequested(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingAccountDetected(false);
    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) {
        setLoading(false);
        // Matched on Supabase Auth's own documented error `code` — a
        // stable API contract — rather than pattern-matching `.message`
        // text, which is prose meant for logs/debugging and could
        // change with a library update without warning. `email_exists`
        // is the code used by some other Auth flows for the same
        // condition (e.g. OTP); checking both is still not a string
        // match, just covering the one real condition this can mean.
        if (error?.code === "user_already_exists" || error?.code === "email_exists") {
          setExistingAccountDetected(true);
          setError("An account with this email may already exist.");
        } else {
          setError(friendlyAuthError(error?.message, "Something went wrong creating your account. Please try again."));
        }
        return;
      }

      // Set once, right after signup, before any onboarding data exists
      // for either account type — this is what a later login checks to
      // know which onboarding flow to resume if it was never finished.
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role: accountType });

      setLoading(false);

      if (roleError) {
        console.error("user_roles insert failed during signup:", roleError.message);
        setError("Something went wrong setting up your account. Please try again.");
        return;
      }

      router.push(accountType === "organization" ? "/onboarding/organization" : "/onboarding");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setLoading(false);
      setError(friendlyAuthError(error?.message, "Something went wrong logging you in. Please try again."));
      return;
    }

    const account = await getAccountInfo();
    setLoading(false);
    router.push(account ? homeRouteFor(account) : "/dashboard");
  }

  return (
    <main id="main-content" tabIndex={-1} className="bg-board min-h-screen flex items-center justify-center px-6">
      <div className="animate-fade-in-up w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-moss text-white">
            <PinIcon className="w-4 h-4" />
          </span>
          <span className="font-display text-base font-semibold">
            ServeFinder
          </span>
        </div>

        <div className="bg-white border border-line rounded-card shadow-lift p-8">
          <h1 className="font-display text-2xl font-semibold mb-1">
            {mode === "signup"
              ? "Create your account"
              : mode === "forgot"
              ? "Reset your password"
              : "Welcome back"}
          </h1>
          <p className="text-sm text-ink/70 mb-6">
            {mode === "signup"
              ? accountType === "organization"
                ? "Set up your organization to start posting opportunities."
                : "Set up your account to start finding matches."
              : mode === "forgot"
              ? "Enter your email and we'll send you a link to reset your password."
              : "Log in to see your matches."}
          </p>

          {mode === "forgot" ? (
            resetRequested ? (
              <div className="animate-fade-in">
                <p className="text-sm text-ink/70 bg-moss-light border border-moss/30 rounded-card px-3 py-2.5">
                  If an account exists for that email, we&apos;ve sent a link
                  to reset your password. Check your inbox.
                </p>
                <button
                  onClick={() => {
                    setMode("login");
                    setResetRequested(false);
                  }}
                  className="mt-5 text-sm text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-line rounded-card px-3 py-2.5 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="animate-fade-in text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                      {error}
                    </p>
                  )}

                  <Button type="submit" variant="primary" size="md" disabled={loading} className="mt-1">
                    {loading ? "Please wait…" : "Send reset link"}
                  </Button>
                </form>

                <button
                  onClick={() => setMode("login")}
                  className="mt-5 text-sm text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
                >
                  Back to login
                </button>
              </>
            )
          ) : (
            <>
          {mode === "signup" && (
            <div className="mb-4">
              <span id="login-account-type-label" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1.5">
                I am a...
              </span>
              <div role="group" aria-labelledby="login-account-type-label" className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "student", label: "Student" },
                    { value: "organization", label: "Organization" },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAccountType(opt.value)}
                    aria-pressed={accountType === opt.value}
                    className={`text-sm px-3 py-2 rounded-card border transition-all duration-150 ${
                      accountType === opt.value
                        ? "bg-moss text-white border-moss"
                        : "bg-white text-ink border-line hover:border-moss"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-line rounded-card px-3 py-2.5 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-line rounded-card px-3 py-2.5 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
              />
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="mt-1.5 text-sm text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {error && (
              <div className="animate-fade-in flex flex-col gap-2">
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                  {error}
                </p>
                {existingAccountDetected && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setExistingAccountDetected(false);
                    }}
                  >
                    Log in instead
                  </Button>
                )}
              </div>
            )}

            <Button type="submit" variant="primary" size="md" disabled={loading} className="mt-1">
              {loading
                ? "Please wait…"
                : mode === "signup"
                ? "Sign up"
                : "Log in"}
            </Button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
              setExistingAccountDetected(false);
            }}
            className="mt-5 text-sm text-moss-dark underline underline-offset-2 hover:text-moss transition-colors"
          >
            {mode === "signup"
              ? "Already have an account? Log in"
              : "New here? Sign up"}
          </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
