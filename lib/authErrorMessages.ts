// Supabase Auth's own error messages are safe to show a user (no secrets,
// no internal details) but read like driver/API text, not this app's own
// voice — an audit flagged this as the one place the UI's copy has an
// unpolished seam. This maps the handful of cases users actually hit to
// copy written for them, falling back to a generic, still-honest message
// for anything unrecognized rather than ever surfacing raw text.
//
// This only rewrites wording — it doesn't change what triggers an error,
// so it preserves whatever account-enumeration posture Supabase's own
// project settings already have (e.g. resetPasswordForEmail's
// same-response-either-way behavior is untouched; this file isn't in that
// path at all).
const KNOWN_PATTERNS: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials/i,
    message: "That email and password combination doesn't match an account. Double-check both and try again.",
  },
  {
    match: /email not confirmed/i,
    message: "Please confirm your email before logging in — check your inbox for the confirmation link.",
  },
  {
    match: /user already registered/i,
    message: "An account with that email already exists. Try logging in instead.",
  },
  {
    match: /password should be at least/i,
    message: "Your password needs to be at least 6 characters.",
  },
  {
    match: /unable to validate email address/i,
    message: "That doesn't look like a valid email address.",
  },
  {
    match: /rate limit/i,
    message: "Too many attempts. Please wait a moment and try again.",
  },
  {
    // What updateUser({ password }) returns once the temporary recovery
    // session behind it has expired or already been used — the same
    // condition app/reset-password/page.tsx's own upfront link-validity
    // check is meant to catch earlier, but this covers it too if the
    // session lapses between that check and the actual submit.
    match: /auth session missing/i,
    message: "This reset link is invalid or has expired. Request a new one.",
  },
  {
    match: /new password should be different/i,
    message: "Your new password needs to be different from your current one.",
  },
];

export function friendlyAuthError(rawMessage: string | null | undefined, fallback: string): string {
  if (!rawMessage) return fallback;
  const known = KNOWN_PATTERNS.find((p) => p.match.test(rawMessage));
  return known ? known.message : fallback;
}
