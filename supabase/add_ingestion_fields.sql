-- One-time migration for an existing database. Adds ingestion metadata
-- to opportunities so listings can eventually come from an automated
-- importer/scraper instead of only the /admin form:
--   1. source           — "manual" (default, today's only source),
--                          "idealist", "org_website", etc. for later
--   2. source_url       — where the listing was pulled from
--   3. external_id      — the source's own ID for this listing
--   4. last_verified_at — when an ingestion job last confirmed it's live
--   5. is_stale         — flipped by the ingestion job when a listing
--                          hasn't been reverified recently; NOT a SQL
--                          generated column, since "stale" depends on
--                          the current time (now()) and Postgres generated
--                          columns must be immutable
--   6. application_deadline, if an earlier migration was skipped
--
-- Also adds a dedup index on (source, external_id) — safe to re-run.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes all of this.

alter table opportunities add column if not exists application_deadline date;
alter table opportunities add column if not exists source text not null default 'manual';
alter table opportunities add column if not exists source_url text;
alter table opportunities add column if not exists external_id text;
alter table opportunities add column if not exists last_verified_at timestamptz;
alter table opportunities add column if not exists is_stale boolean not null default false;

create unique index if not exists opportunities_source_external_id_idx
  on opportunities (source, external_id)
  where external_id is not null;
