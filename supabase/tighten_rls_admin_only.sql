-- One-time migration for an existing database. Replaces the wide-open
-- write policies on opportunities/organizations ("Anyone can add/update/
-- delete") with admin-gated ones, now that this app has a real (if
-- minimal) admin concept. Public read access is unchanged.
--
-- Two paths are allowed to write after this:
--   1. Admin users — authenticated, and present in the new `admins`
--      table, checked via `auth.uid() in (select user_id from admins)`.
--   2. The ingestion pipeline (fetchers + cron jobs) — now authenticates
--      with the Supabase service role key instead of the anon key. The
--      service role bypasses RLS entirely (standard Postgres/Supabase
--      behavior for that role), so it needs no policy of its own.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes all of this.

-- ---------- admins ----------
-- A user's own row is readable (so RLS policies elsewhere can check
-- `exists (select 1 from admins where user_id = auth.uid())` without
-- tripping the "RLS enabled, zero policies -> zero rows for everyone"
-- trap — see ARCHITECTURE.md §5). No insert/update/delete policy is
-- defined at all: admin status can only be granted via the Supabase SQL
-- editor or the service role, never by a client request, by design —
-- there's no self-service "become an admin" path.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

create policy "Users can check their own admin status"
  on admins for select
  using (auth.uid() = user_id);

-- Seeds the account used throughout local development/testing as the
-- first admin. Add more admins the same way (or remove this row) as
-- needed — there's no UI for managing this table on purpose.
insert into admins (user_id)
values ('2b632bfc-7ff9-4e95-91e8-2d44c0f00247')
on conflict (user_id) do nothing;

-- ---------- opportunities ----------
drop policy if exists "Anyone can add opportunities" on opportunities;
drop policy if exists "Anyone can update opportunities" on opportunities;
drop policy if exists "Anyone can delete opportunities" on opportunities;

create policy "Admins can add opportunities"
  on opportunities for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can update opportunities"
  on opportunities for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can delete opportunities"
  on opportunities for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

-- ---------- organizations ----------
-- organizations never had update/delete policies at all (only insert
-- was open) — adding both now, admin-gated, so admins have full CRUD
-- rather than leaving a permanent gap that was never intentional.
drop policy if exists "Anyone can add organizations" on organizations;

create policy "Admins can add organizations"
  on organizations for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can update organizations"
  on organizations for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can delete organizations"
  on organizations for delete
  using (exists (select 1 from admins where user_id = auth.uid()));
