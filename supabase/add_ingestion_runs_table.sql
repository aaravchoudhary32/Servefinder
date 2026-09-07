-- One-time migration for an existing database. Adds ingestion_runs, an
-- audit log of each fetcher execution (manual CLI run or scheduled cron)
-- so /admin/ingestion-log can show what happened without grepping
-- Vercel function logs: when it ran, which source, how many listings it
-- found vs. actually wrote vs. skipped as duplicates, and whether it
-- failed outright.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  run_at timestamptz not null default now(),
  status text not null default 'success' check (status in ('success', 'error')),
  listings_found int not null default 0,
  listings_inserted int not null default 0,
  listings_updated int not null default 0,
  listings_skipped_duplicate int not null default 0,
  error_message text
);

create index if not exists ingestion_runs_run_at_idx on ingestion_runs (run_at desc);

alter table ingestion_runs enable row level security;
create policy "Anyone can read ingestion runs"
  on ingestion_runs for select
  using (true);
create policy "Anyone can record ingestion runs"
  on ingestion_runs for insert
  with check (true);
