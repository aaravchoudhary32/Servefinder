-- Ingestion infrastructure Phase 2: a real source registry, plus
-- provenance/staging fields on `opportunities` and a verification-audit
-- trail on `organizations`. Supports scaling the catalog toward 1,000+
-- opportunities while keeping automated ingestion behind a human review
-- gate before anything it adds becomes publicly visible.
--
-- Run this AFTER schema.sql and every other supabase/*.sql migration, in
-- the Supabase SQL editor. Safe to run on a database with existing rows:
-- every `alter table ... add column ... not null default ...` below is a
-- single atomic statement — Postgres backfills the default for existing
-- rows as part of the same statement, there is no separate two-phase
-- backfill-then-enforce step needed here (unlike
-- add_org_verification_enforcement.sql, which needed one because
-- `verified` used to default to `false`; `review_status` defaults to
-- `'approved'`, so every existing row is immediately, correctly visible
-- exactly as it is today — nothing goes dark when this runs).
--
-- Scope decision (see the accompanying report): staging/review applies
-- to AUTOMATED SCRAPER ingestion only. Manual-curated records (already
-- human-verified through this project's research process), admin CRUD,
-- org self-service CRUD, and CSV import all continue to publish
-- immediately — this migration only changes what NEW rows a connector
-- inserts default to; it does not restrict any existing write path.

-- ---------------------------------------------------------------------
-- 1. ingestion_sources — the real source registry. sourceRegistry.ts
--    (code) already dispatches by a string slug; this table is the
--    metadata layer that slug always lacked (geography, categories,
--    virtual coverage, refresh cadence, health/status/timestamps, ToS
--    notes). `source_name` matches the exact string every connector
--    already writes into opportunities.source (see the seed inserts
--    below) — a foreign-key-shaped relationship kept as a plain text
--    match rather than an actual FK, since `opportunities.source` has
--    no not-null/FK constraint of its own today and this migration
--    isn't the place to add one.
create table if not exists ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  source_name text not null unique,
  first_party_url text not null,
  source_type text not null check (
    source_type in ('api', 'structured_feed', 'approved_scraper', 'manual_research', 'org_submission', 'batch_import')
  ),
  geographic_coverage text,
  categories text[] not null default '{}',
  includes_virtual boolean not null default false,
  expected_refresh_frequency text,
  last_attempted_at timestamptz,
  last_successful_at timestamptz,
  last_human_verified_at timestamptz,
  status text not null default 'active' check (status in ('active', 'error', 'paused')),
  terms_of_use_notes text,
  robots_txt_notes text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ingestion_sources enable row level security;

create policy "Admins can read ingestion sources"
  on ingestion_sources for select
  using (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can manage ingestion sources"
  on ingestion_sources for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- No service-role-specific policy needed: the service role (used by the
-- cron ingestion routes to update last_attempted_at/last_successful_at/
-- status/last_error_message) bypasses RLS entirely, same as every other
-- table the ingestion pipeline writes to.

-- Seed rows for every connector already live in lib/ingestion/sources/,
-- plus the two non-scraper source types already in real use
-- (opportunities.source = 'manual_curated' for seed-manual-records.ts,
-- 'manual' for hand-entered /admin rows). Idempotent — re-running this
-- migration is a no-op for rows that already exist.
insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, expected_refresh_frequency, terms_of_use_notes, robots_txt_notes)
values
  ('Arizona Science Center', 'arizona_science_center', 'https://www.azscience.org/support/volunteer-opportunities/', 'approved_scraper', 'Phoenix, AZ', array['STEM'], false, 'weekly', 'Org''s own volunteer-opportunities page; no login wall.', 'No relevant Disallow rules.'),
  ('Boys & Girls Clubs of Central Arizona', 'bgc_central_az', 'https://bgccaz.org/', 'approved_scraper', 'Phoenix metro, AZ', array['Community Service', 'Education'], false, 'weekly', null, null),
  ('Chesapeake Humane Society', 'chesapeake_humane', 'https://chesapeakehumane.org/', 'approved_scraper', 'Chesapeake, VA', array['Animals'], false, 'weekly', null, null),
  ('Chesapeake Public Library', 'chesapeake_public_library', 'https://www.chesapeakelibrary.org/', 'approved_scraper', 'Chesapeake, VA', array['Education'], false, 'weekly', null, null),
  ('City of Phoenix', 'cityofphoenix', 'https://www.phoenix.gov/', 'approved_scraper', 'Phoenix, AZ', array['Community Service', 'STEM', 'Environment'], false, 'weekly', 'JS-rendered portal, requires Playwright.', 'Checked, no relevant Disallow rules.'),
  ('Firewheel STEM Institute', 'firewheel_stem', 'https://firewheelstem.org/', 'approved_scraper', 'Chandler, AZ', array['STEM'], false, 'weekly', null, null),
  ('Foodbank of Santa Barbara County (Seva)', 'foodbank_seva', 'https://www.foodbanksbc.org/', 'approved_scraper', 'Santa Barbara County, CA', array['Community Service'], false, 'weekly', null, null),
  ('Phoenix Rescue Mission', 'phoenixrescuemission', 'https://phoenixrescuemission.org/', 'approved_scraper', 'Phoenix, AZ', array['Community Service'], false, 'weekly', null, null),
  ('Special Olympics Arizona', 'special_olympics_az', 'https://specialolympicsarizona.org/volunteer/', 'approved_scraper', 'Statewide, AZ', array['Sports & Rec', 'Community Service'], false, 'weekly', 'Org''s own site; portals.specialolympics.org registration deliberately not scraped.', 'Site WAF-blocks non-browser clients; Playwright required. Own robots.txt has no relevant Disallow rules.'),
  ('St. Mary''s Food Bank', 'stmarysfoodbank', 'https://firstfoodbank.org/', 'approved_scraper', 'Phoenix, AZ', array['Community Service'], false, 'weekly', null, null),
  ('Virginia Beach SPCA', 'vbspca', 'https://vbspca.com/', 'approved_scraper', 'Virginia Beach, VA', array['Animals'], false, 'weekly', null, null),
  ('Various (manually curated)', 'manual_curated', 'n/a — one URL per organization, see lib/manualRecords.ts', 'manual_research', 'Arizona + nationwide virtual', array['STEM', 'Education', 'Healthcare', 'Business & Entrepreneurship', 'Environment', 'Animals'], true, 'as researched', 'Each record individually researched and live-link-verified before seeding — see lib/manualRecords.ts header comments.', null),
  ('Various (admin hand-entered)', 'manual', 'n/a — entered directly via /admin', 'manual_research', 'Varies', array[]::text[], false, 'as entered', null, null)
on conflict (source_name) do nothing;

-- ---------------------------------------------------------------------
-- 2. opportunities — provenance + staging. `review_status` is the
--    staging gate: automated connectors will start writing 'pending'
--    for new rows (a code change, not part of this migration); every
--    existing row and every other write path (manual/admin/org/CSV)
--    keeps defaulting to 'approved', preserving current behavior
--    exactly. See this file's header for why the default handles
--    backfill atomically.
alter table opportunities add column if not exists review_status text not null default 'approved'
  check (review_status in ('pending', 'approved', 'rejected', 'merged'));
alter table opportunities add column if not exists first_discovered_at timestamptz;
alter table opportunities add column if not exists content_fingerprint text;
alter table opportunities add column if not exists review_notes text;
alter table opportunities add column if not exists next_review_date date;
alter table opportunities add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table opportunities add column if not exists verification_method text;
alter table opportunities add column if not exists merged_into_id uuid references opportunities(id) on delete set null;

create index if not exists opportunities_review_status_idx on opportunities (review_status);
create index if not exists opportunities_content_fingerprint_idx on opportunities (content_fingerprint);

-- ---------------------------------------------------------------------
-- 3. organizations — verification audit trail. `verified` itself is
--    unchanged (still a plain boolean, still admin-toggled) — these
--    columns just make an admin's verification action attributable and
--    inspectable, rather than an opaque flag flip. No RLS change needed
--    here; the existing admin-only update policy already covers these.
alter table organizations add column if not exists verification_method text;
alter table organizations add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table organizations add column if not exists verified_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. Tighten the public opportunities SELECT policy to also require
--    review_status = 'approved'. Safe given step 2's atomic default —
--    every existing row is already 'approved', so this changes nothing
--    about what's visible today. It only takes effect once a connector
--    starts actually writing 'pending' rows (a separate code change).
--    The admin and org-rep SELECT policies below are untouched — both
--    already read without checking `verified`, so both already see
--    'pending' rows too (needed for the review queue and for an org rep
--    to see their own submissions either way).
drop policy if exists "Public can read opportunities from verified orgs or admin-entered listings" on opportunities;
create policy "Public can read approved opportunities from verified orgs or admin-entered listings"
  on opportunities for select
  using (
    review_status = 'approved'
    and (
      organization_id is null
      or exists (
        select 1 from organizations
        where organizations.id = opportunities.organization_id
          and organizations.verified = true
      )
    )
  );

-- ---------------------------------------------------------------------
-- Verification queries — run these after the migration to confirm
-- nothing changed for existing data before trusting the new policy:
--
-- select count(*) from opportunities where review_status <> 'approved'; -- expect 0
-- select count(*) from ingestion_sources; -- expect 13
--
-- ---------------------------------------------------------------------
-- Rollback (only safe if no row has since been set to a non-'approved'
-- review_status that a rollback would incorrectly re-expose — check
-- with the guard query above first):
--
-- drop policy if exists "Public can read approved opportunities from verified orgs or admin-entered listings" on opportunities;
-- create policy "Public can read opportunities from verified orgs or admin-entered listings"
--   on opportunities for select
--   using (
--     organization_id is null
--     or exists (
--       select 1 from organizations
--       where organizations.id = opportunities.organization_id
--         and organizations.verified = true
--     )
--   );
--
-- alter table opportunities drop column if exists review_status;
-- alter table opportunities drop column if exists first_discovered_at;
-- alter table opportunities drop column if exists content_fingerprint;
-- alter table opportunities drop column if exists review_notes;
-- alter table opportunities drop column if exists next_review_date;
-- alter table opportunities drop column if exists reviewed_by;
-- alter table opportunities drop column if exists verification_method;
-- alter table opportunities drop column if exists merged_into_id;
--
-- alter table organizations drop column if exists verification_method;
-- alter table organizations drop column if exists verified_by;
-- alter table organizations drop column if exists verified_at;
--
-- drop table if exists ingestion_sources;
