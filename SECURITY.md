# Security

This document describes ServeFinder's actual security architecture, the
boundaries it relies on, and how to report a problem. It makes no
compliance claims (SOC 2, HIPAA, COPPA, etc.) — none has been sought or
established. It does not describe the app as "secure," "hardened," or
"unhackable"; it describes what exists, what depends on what, and what
is known to still be missing.

## Reporting a vulnerability

This is a single-maintainer project with no dedicated security team or
SLA. To report a vulnerability, open a private [GitHub Security
Advisory](https://github.com/aaravchoudhary32/servefinder/security/advisories/new)
on this repository, or contact the maintainer via GitHub: https://github.com/aaravchoudhary32.
Please don't open a public issue for anything that isn't already
public. Include reproduction steps and, if applicable, which account
type/role the issue affects (anonymous, student, organization, admin).

## Architecture: where authorization actually happens

**There is no `middleware.ts` in this app, and that's deliberate.**
Every protected page (`/admin`, `/dashboard`, `/org-dashboard`,
`/settings`, `/applications`, onboarding pages) is a Client Component
that checks `supabase.auth.getUser()` plus a role-table lookup
(`lib/accountRole.ts`) before rendering, and redirects if the check
fails. **This client-side check is a UX convenience, not the security
boundary.** It exists only to avoid showing an account a page that's
meaningless for it (e.g. a student hitting `/org-dashboard`) — it can't
leak data, because the actual data-access boundary underneath it is
Postgres Row Level Security (RLS), enforced against the caller's own
Supabase session (anon key + user JWT) no matter what page requested
it or whether that page's own client-side check was bypassed. See
`ARCHITECTURE.md` §5 for the full reasoning and history behind this
choice.

**Practical consequence for anyone changing this code:** adding a new
page-level `if (!isAdmin) redirect()` check does nothing for security
by itself. If a table needs new protection, the fix belongs in
`supabase/schema.sql`'s RLS policies, not in a page component.

## Role matrix

| Role | How membership is established | What it can read/write |
|---|---|---|
| Anonymous / public | N/A | `select` on `opportunities` and `organizations` only (both tables' `select` policy is `using (true)` — this is an intentionally public catalog). |
| Student | `user_roles.role = 'student'`, set once at signup | Own `profiles`, `applications`, `saved_opportunities`, `match_feedback`, `analytics_events` rows only (`auth.uid() = user_id` on every policy). No visibility into other students' data or into `applications.user_id` for other users. |
| Organization rep | Row in `organization_accounts`, created only via the `create_organization_account()` security-definer function | `select` on `applications` for their own `organization_id`'s opportunities only (RLS policy); status changes go through `org_update_application_status()`, a security-definer function that only allows moving an application to `'accepted'` or `'completed'` — never back to `'applied'`, and never to `'saved'` (a student's private bookmark an org shouldn't touch). Can create/edit/delete `opportunities` rows scoped to their own `organization_id`. Cannot read another organization's applicants, and cannot read a student's `auth.users` email directly (see `/api/org/applicants` below). |
| Admin | Row in `admins`, granted only by direct SQL (Supabase SQL editor) or the service role — **no in-app path grants admin** | Full `insert`/`update`/`delete` on `opportunities` and `organizations` (review queue, catalog management). Can read `error_log`. |
| Service role (`SUPABASE_SERVICE_ROLE_KEY`) | N/A — a secret, server-only credential | Bypasses RLS entirely. Used only by: the ingestion pipeline (fetch scripts, `/api/cron/*`), `/api/account` (account deletion needs `auth.admin.deleteUser()`, which RLS can't grant), and `/api/org/applicants` (needs `auth.admin.getUserById()` to resolve an applicant's email, since `auth.users` isn't in the `public` schema PostgREST exposes). Never imported into any `"use client"` component; never sent to the browser. |

## RLS expectations

- **Every table in `supabase/schema.sql` has RLS enabled.** There is no
  table that relies on "no policy = no access via PostgREST" as its
  only protection — each has an explicit policy set.
- **`admins` and `organization_accounts` have no insert/update/delete
  policy at all.** Membership in either is granted only by a direct SQL
  statement (Supabase SQL editor) or, for `organization_accounts`
  specifically, the `create_organization_account()` security-definer
  function — never by any request an ordinary authenticated user can
  send. This is intentional: there is no "become an admin" or
  "self-assign to a different organization" code path anywhere in the
  app, by design, not by omission.
- **Security-definer functions** (`create_organization_account`,
  `org_update_application_status`, `try_claim_ingestion_lock`,
  `release_ingestion_lock`) all explicitly `set search_path = public`
  (preventing a search-path-hijack privilege escalation) and use
  `revoke all` + `grant execute` to a specific role rather than relying
  on default grants. Each function's own body constrains what it can
  do regardless of caller input — e.g.
  `create_organization_account()` only ever links `auth.uid()` (the
  caller's own ID, never a parameter) to a brand-new organization row;
  there is no code path where a request body can make it link a
  different user or an existing organization.
- **Do not weaken RLS to make a failing test or a broken feature work.**
  If a policy seems to be blocking something that should be allowed,
  the fix is a more precise policy (or a security-definer function with
  a narrow, audited body), not `using (true)`.
- Authorization/isolation is covered by
  `tests/integration/stagingVisibility.integration.test.ts` (anonymous
  callers only ever see `review_status = 'approved'` rows, never
  pending/rejected/merged) and
  `tests/integration/orgApplicantIsolation.integration.test.ts` (an org
  rep can only see applicants for their own organization's
  opportunities). These run against a real, live Supabase project (not
  mocks) and are intentionally excluded from `npm test`/CI because they
  need `SUPABASE_SERVICE_ROLE_KEY` — run them by hand via `npm run
  test:integration` when changing anything RLS-related.

## API routes

All six API routes live under `app/api/`; there are no Next.js Server
Actions anywhere in this codebase.

| Route | Auth | Notes |
|---|---|---|
| `GET /api/health` | None (public) | No secrets or internal details in the response body; errors are logged server-side only. |
| `GET /api/account` | Caller's own JWT | Own-account data export only, via a request-scoped client (not service role) — RLS does the scoping. |
| `DELETE /api/account` | Caller's own JWT | Rate-limited (5/hour/user). Deletes the caller's own organization + its opportunities first (if an org rep) to avoid orphaning them as ownerless public listings, then the auth user. Generic error messages; details go to `error_log` via `recordError()`. |
| `GET /api/org/applicants` | Caller's own JWT, must have an `organization_accounts` row | Rate-limited (60/5min/user). Applications are resolved via the caller's own RLS-scoped client; the service role is used only to resolve emails for user_ids that query already proved belong to the caller's org — never to query `applications` directly. |
| `POST /api/embeddings` | Caller's own JWT | Rate-limited (300/5min/user); input capped at 5,000 characters (`lib/embeddings/validateText.ts`) since this runs real ML inference per call. |
| `GET /api/cron/fetch/[source]` | `Authorization: Bearer $CRON_SECRET`, constant-time compare | Vercel-cron-only in practice (Vercel sets this header automatically once `CRON_SECRET` is configured). |
| `GET /api/cron/mark-stale` | Same as above | Same. |

All routes return generic client-facing error messages
(`lib/apiError.ts`'s `safeErrorResponse`) — no raw driver/DB error text,
stack traces, or internal paths reach the client. Diagnostic detail
goes server-side only, via `recordError()` into the admin-only-readable
`error_log` table.

## Rate limiting

`lib/rateLimit.ts` is an honest, in-process, fixed-window limiter keyed
by user ID, backed by a plain module-scope `Map`. It is **not** shared
across concurrent or cold serverless instances — it is a real, if
imperfect, mitigation against a single warm instance being hammered,
not a distributed rate limiter. If this app's traffic or abuse profile
ever justifies it, the natural upgrade is a shared store (e.g. Upstash
Redis, which is Vercel-marketplace-native) behind the same
`checkRateLimit()` call signature so callers don't need to change.

## Environment variables and secrets

- `.env*` files are gitignored; only `.env.local.example` (placeholders
  only, no real values) is committed.
- `NEXT_PUBLIC_*`-prefixed variables are the only ones ever shipped to
  the browser bundle — by Next.js's own convention, not a rule this app
  enforces separately. `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are
  never prefixed this way and are only read in server-only files
  (`lib/supabaseAdminClient.ts`, `lib/cronAuth.ts`, API routes with
  `export const runtime = "nodejs"`).
- If you ever find a real credential committed to this repo or logged
  somewhere it shouldn't be: **do not attempt to rotate it yourself as
  part of a code change.** Report it (see above) with the exact file
  and credential type, without pasting the credential value anywhere
  further (issue trackers, commit messages, chat). Rotation checklist:
  1. Rotate the credential at its source (Supabase project settings for
     `SUPABASE_SERVICE_ROLE_KEY`/anon key; regenerate a new random value
     for `CRON_SECRET`).
  2. Update the value in Vercel's project environment variables.
  3. Redeploy.
  4. If it was ever committed to git history, treat the old value as
     permanently compromised — rotating supersedes trying to scrub
     history.

## Security headers

Configured in `next.config.js`'s `headers()` (there's no middleware to
attach a per-request CSP nonce to, so this is static, applied via
`source: "/:path*"`): `Content-Security-Policy`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security`, and
`poweredByHeader: false`. The CSP's `connect-src` is scoped to this
app's genuinely small cross-origin footprint: its own Supabase project
plus the two geocoding APIs `lib/geocode.ts` calls directly from the
browser (`api.zippopotam.us`, `nominatim.openstreetmap.org`) — dropping
either of those breaks student location resolution, which is why
`next.config.test.ts` pins them as a regression test. `script-src` and
`style-src` keep `'unsafe-inline'`: Next.js App Router's streaming RSC
payload emits inline scripts that a strict `script-src` would block
without a per-request nonce, which would require adding middleware this
app deliberately doesn't have. This is a real, currently-accepted gap,
not a mistake — documented here rather than silently dropped or claimed
as stricter than it is.

## Dependency updates

- Run `npm audit` before any dependency bump; read what it actually
  flags rather than reflexively running `npm audit fix --force`, which
  can pull in breaking major-version changes.
- Known accepted residual findings (as of this writing): `npm audit`
  reports 7 high-severity findings, all in transitive dependencies with
  no non-breaking fix available (`adm-zip` via
  `onnxruntime-node`/`@huggingface/transformers`; `sharp` via the same
  chain). Neither is reachable through user input: this app has no
  direct `sharp` import and no image-upload feature anywhere.
  `path-to-regexp` (via `@vercel/routing-utils`) does have a fix, but
  only via `npm audit fix --force`, which is a breaking change not made
  speculatively as part of a security pass.
- Before upgrading anything load-bearing (Next.js, React, Supabase
  client libraries), run the full verification suite below — don't
  assume a version bump is safe because it built once.

## Verification commands

```bash
npm run lint            # ESLint
npx tsc --noEmit         # TypeScript
npm test                 # Unit tests (Vitest)
npm run test:integration # RLS/authorization tests — needs SUPABASE_SERVICE_ROLE_KEY
npm run test:a11y        # Accessibility (Playwright + axe) — needs `npm run dev` already running
npm run test:e2e         # End-to-end critical-journey tests — same requirement
npm run build            # Production build
npm audit                # Dependency vulnerability scan
```

## Backups, rollback, and incident response

See `RUNBOOK.md` for the actual (not aspirational) database backup/
restore procedure, Vercel deployment rollback steps, and an incident
checklist — including the current Supabase plan's real backup
capability, checked directly in the dashboard rather than assumed.

## Known residual risks

- No defense-in-depth server-side authorization layer beyond RLS (see
  "Architecture" above) — this is a deliberate, documented choice, not
  an oversight, but it means every new table or policy must get RLS
  right the first time; there's no middleware-level backstop.
- The in-process rate limiter (`lib/rateLimit.ts`) doesn't coordinate
  across concurrent or cold serverless instances. Acceptable at current
  traffic; would need a shared store if abuse patterns change.
- No automated test coverage yet for login/signup error-message
  behavior (e.g. confirming no account-existence leakage) or for
  malformed-input edge cases beyond what `lib/ingestion/csvImport.ts`
  already validates. Flagged as future work, not fixed speculatively in
  this pass.
- 7 `npm audit` high-severity findings accepted as unreachable residual
  risk (see "Dependency updates" above) rather than force-upgraded.
- No privacy policy or terms-of-service legal review has been
  performed — any copy describing data handling should be treated as
  descriptive, not as an established legal compliance claim.
- The Supabase project is on the Free plan, which has no automated
  backups or point-in-time recovery (confirmed directly in the
  dashboard). The only backup is a manual export a human has to
  actually run — see `RUNBOOK.md`.
