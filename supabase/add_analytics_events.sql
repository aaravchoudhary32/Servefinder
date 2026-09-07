-- One-time migration for an existing database. Adds the analytics_events
-- table that powers /admin/analytics (lib/analytics.ts's trackEvent()) —
-- Phase 2 of the "Measurable Product Usage" plan.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.
--
-- Deliberately a separate table from `applications`, not a query against
-- it: `applications.status` is mutable and overwritten in place, so a row
-- that moves from 'saved' to 'applied' can no longer be found by
-- querying status = 'saved' — this table is the only place "how many
-- students ever saved something" survives past the moment they moved on
-- to actually applying. `metadata` is jsonb but is only ever small
-- structured values (match mode, from/to status) — never free text, age,
-- city, zip, interests, skills, or email.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'onboarding_started', 'onboarding_completed',
    'match_viewed', 'match_saved',
    'application_started', 'application_submitted',
    'application_status_changed', 'opportunity_completed'
  )),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_type_created_idx
  on analytics_events (event_type, created_at desc);
create index if not exists analytics_events_user_idx
  on analytics_events (user_id);

alter table analytics_events enable row level security;

-- Insert-only for the event's own user, admin-only read — this table
-- holds per-user behavior, unlike `ingestion_runs`'s fully public
-- "using (true)" policies, which have no per-user data in them at all.
-- No update/delete policy exists at all: it's an append-only log, same
-- "no self-service mutation" posture as `admins`/`user_roles`.
create policy "Users can record their own analytics events"
  on analytics_events for insert
  with check (auth.uid() = user_id);
create policy "Admins can read analytics events"
  on analytics_events for select
  using (exists (select 1 from admins where user_id = auth.uid()));
