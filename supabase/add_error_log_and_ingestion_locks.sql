-- Phase 5 (Reliability & Accessibility): structured server-side error
-- logging, and a concurrency guard for the ingestion pipeline.
-- Run this in the Supabase SQL editor. Safe to re-run (all `create table
-- if not exists` / `create or replace function`).

-- Structured server-side error log — the in-house equivalent of what an
-- external monitoring service (Sentry, etc.) would give an admin, without
-- adding a new SaaS dependency to a pre-launch app. Written from server
-- routes' existing catch blocks via lib/errorLog.ts's recordError(),
-- using the service role — every write here bypasses RLS, so (like
-- `admins`) there's no insert policy at all, only an admin-read one.
create table if not exists error_log (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  message text not null,
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists error_log_created_at_idx on error_log (created_at desc);

alter table error_log enable row level security;

create policy "Admins can read the error log"
  on error_log for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- Prevents two overlapping invocations of the same ingestion source (a
-- genuine Vercel cron retry after a timeout, or a manual CLI run
-- colliding with the weekly cron) from both running at once and
-- double-writing an `ingestion_runs` audit row for the same execution.
--
-- Deliberately NOT pg_advisory_lock: that's session-scoped, and every
-- supabase-js call (insert/update/rpc) is its own independent PostgREST
-- request that can land on a different pooled connection. A single
-- ingestion run makes many such calls over its lifetime, so a
-- session-scoped lock acquired on one connection wouldn't actually be
-- held for the rest of the run on another. A row + timestamp claim
-- (this table) is connection-pooling-safe instead: each claim/release is
-- its own self-contained statement, not dependent on holding a session
-- open.
create table if not exists ingestion_locks (
  source text primary key,
  locked_at timestamptz
);

alter table ingestion_locks enable row level security;
-- No policies at all, intentionally — only the service role (which
-- bypasses RLS regardless) is ever meant to touch this table, via the
-- two functions below. Zero policies means zero access for anon/
-- authenticated by default, which is exactly the desired posture.

-- Atomically claims the lock for `source_name`, or fails if another run
-- already holds it and hasn't gone stale. `stale_after_minutes` self-heals
-- a lock left behind by a run that crashed without releasing it (every
-- fetcher run should complete well under 15 minutes in practice).
create or replace function try_claim_ingestion_lock(source_name text, stale_after_minutes int default 15)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  did_claim boolean := false;
begin
  insert into ingestion_locks (source, locked_at)
  values (source_name, now())
  on conflict (source) do update
    set locked_at = now()
    where ingestion_locks.locked_at is null
       or ingestion_locks.locked_at < now() - (stale_after_minutes || ' minutes')::interval
  returning true into did_claim;

  return coalesce(did_claim, false);
end;
$$;

create or replace function release_ingestion_lock(source_name text)
returns void
language sql
security definer
set search_path = public
as $$
  update ingestion_locks set locked_at = null where source = source_name;
$$;

revoke all on function try_claim_ingestion_lock(text, int) from public;
grant execute on function try_claim_ingestion_lock(text, int) to service_role;
revoke all on function release_ingestion_lock(text) from public;
grant execute on function release_ingestion_lock(text) to service_role;
