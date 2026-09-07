# Runbook: backups, rollback, and incidents

Companion to `SECURITY.md` (secret rotation, dependency updates,
verification commands). This file covers what to do when production is
actually broken or data needs to be recovered — written from what's
verified to exist today, not aspirational tooling.

## Database backups

**As of this writing, the Supabase project is on the Free plan, which
does not include automated backups or point-in-time recovery (PITR).**
Do not assume otherwise — this was confirmed directly by checking
Database → Backups in the Supabase dashboard, not assumed from
Supabase's general marketing. If the project is ever upgraded to a
paid plan, update this section to reflect what Backups actually shows
before relying on it.

Until then, the only backup is a **manual export**, and it only exists
if someone actually runs it:

```bash
# Requires the Supabase CLI (npx supabase — no separate install
# needed, confirmed via `npx supabase db dump --help`) and the
# project's database connection string (Supabase dashboard -> Project
# Settings -> Database -> Connection string). The password portion of
# that URL must be percent-encoded if it contains special characters
# (the CLI's own --help says so explicitly) — copy the connection
# string as the dashboard shows it rather than reconstructing it by
# hand.
npx supabase db dump --db-url "<connection string from the dashboard>" -f backup-$(date +%Y%m%d).sql
```

This produces a plain SQL file that can be replayed into any Postgres
database (including a fresh Supabase project) with `psql` or the SQL
editor. Store it somewhere durable (not just a laptop) — encrypted
cloud storage is fine; it will contain student emails and profile
data, so treat it with the same care as the live database.

**Recommended cadence until a paid plan changes this:** a manual
export before any risky schema migration (anything in `supabase/*.sql`
beyond a straightforward `create table if not exists`), and
periodically otherwise (monthly is reasonable at this app's current
scale — there is no automatic reminder for this, so it only happens if
a human does it).

### Restoring from a manual export

1. Create a new Supabase project (or use an existing empty one) if the
   original is unusable.
2. Run the exported SQL file against it: `psql "<new project's
   connection string>" -f backup-YYYYMMDD.sql`.
3. Update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   and `SUPABASE_SERVICE_ROLE_KEY` in Vercel's project environment
   variables to point at the new project.
4. Redeploy (see below) so the new environment variables take effect.
5. Verify: `curl https://servefinder-app.vercel.app/api/health`
   reports `"database":"reachable"`, and the approved-opportunity count
   matches what the export should contain (see `SECURITY.md`'s
   verification commands for the anon-scoped count query).

## Vercel deployment rollback

Confirmed present in the dashboard (servefinder-app → Overview →
Production Deployment → **Instant Rollback**): this immediately
re-points the production domain at a previously-deployed build,
without needing a new commit or a new build to run. This is the
fastest way to recover from a bad deploy.

Alternative, if a specific older commit needs to become production
again (not just "whatever was live before"): push a new commit to
`main` that reverts the problematic change (`git revert <sha>`) rather
than force-pushing history — this repo's Git integration auto-deploys
on every push to `main` (see the note below on verifying that
actually happened).

**After any rollback, verify it actually took effect** — this
session's own incident is the reason for this specific instruction:
`curl https://servefinder-app.vercel.app/api/health` and confirm
`deployedCommit` matches the SHA you expect (`git log -1 <ref>` for
the commit you rolled back to). A 200 response alone is not evidence
of anything — the deployed-commit field exists specifically so this
check doesn't require opening the Vercel dashboard.

## Incident response checklist

When something in production seems broken:

1. **Confirm what's actually deployed** before debugging anything
   else: `curl https://servefinder-app.vercel.app/api/health | grep
   deployedCommit` and compare against `git log -1 origin/main`. If
   they don't match, the Git integration may be disconnected again
   (Vercel → servefinder-app → Settings → Git should show a connected
   repo, not a provider picker) — this exact failure mode cost this
   project several hours once already.
2. Check `/admin/error-log` for recent structured errors (admin
   account required).
3. Check `/admin/ingestion-log` (public) for a connector that's been
   failing repeatedly — this affects listing freshness, not the app's
   availability, so it's a lower-urgency check.
4. If the issue is data-related (wrong/missing rows, not a code bug),
   confirm before changing anything: `SECURITY.md`'s verification
   commands include the exact anon-scoped queries to check approved
   opportunity and organization counts against the last known-good
   numbers.
5. If a rollback is needed, follow the Vercel rollback steps above,
   then re-verify the deployed commit.
6. If Supabase itself appears to be the problem (not this app's code),
   check https://status.supabase.com before assuming the bug is local.

## What this runbook does not cover

- Automated backup scheduling — doesn't exist yet on the Free plan;
  see above.
- A tested disaster-recovery drill — the restore procedure above is
  documented but has not been rehearsed end-to-end against a real
  export. Treat it as a starting point, not a guarantee, until it's
  actually been run once.
