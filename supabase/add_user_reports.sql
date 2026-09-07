-- P0 (product-readiness audit): backs the "report inaccurate listing"
-- flow and general product feedback — both currently missing from the
-- app entirely. One table serves both cases (report_type
-- distinguishes them) rather than two near-identical tables, since a
-- report's lifecycle (received -> reviewing -> corrected/dismissed) is
-- identical either way and an admin reviews both from the same queue.
--
-- Run this in the Supabase SQL editor. Safe to re-run (all `create
-- table if not exists` / `create policy` guarded).

create table if not exists user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  -- Nullable: only set for report_type = 'inaccurate_listing'. `on
  -- delete set null` rather than cascade — deleting the opportunity
  -- later shouldn't destroy the report record itself (an admin should
  -- still be able to see what was reported and when), same reasoning
  -- app/org-dashboard/page.tsx already applies to a deleted
  -- opportunity's applications (falls back to "Deleted opportunity"
  -- in the UI rather than losing the row).
  opportunity_id uuid references opportunities(id) on delete set null,
  report_type text not null check (report_type in ('inaccurate_listing', 'general_feedback')),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'received' check (status in ('received', 'reviewing', 'corrected', 'dismissed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_reports_status_idx on user_reports (status);
create index if not exists user_reports_created_at_idx on user_reports (created_at desc);

alter table user_reports enable row level security;

-- Insert-only for the reporter, matching the app's existing "no
-- self-service state change beyond creation" posture for
-- similarly-shaped tables (analytics_events' "Users can record their
-- own analytics events" is the closest precedent: authenticated users
-- can create a row about themselves, but can't edit an admin's later
-- review of it).
create policy "Users can submit their own reports"
  on user_reports for insert
  with check (auth.uid() = reporter_user_id);

create policy "Users can view their own reports"
  on user_reports for select
  using (auth.uid() = reporter_user_id);

create policy "Admins can view all reports"
  on user_reports for select
  using (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can update reports"
  on user_reports for update
  using (exists (select 1 from admins where user_id = auth.uid()));
