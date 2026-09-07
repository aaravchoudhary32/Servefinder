-- ServeFinder — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`)

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  verified boolean not null default false,
  contact_email text,
  -- Fields a pure directory record (no linked opportunities) needs to be
  -- useful on its own. last_verified_at is distinct from
  -- opportunities.last_verified_at (which an automated fetcher sets on
  -- every re-scrape) — this one is only ever set by a human confirming
  -- the organization's own info is current.
  website_url text,
  city text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  -- Verification audit trail (see
  -- supabase/add_ingestion_source_registry_and_staging.sql) — `verified`
  -- above is still the flag that actually gates visibility; these three
  -- just make an admin's decision to flip it attributable and
  -- inspectable instead of an opaque boolean toggle.
  verification_method text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz
);

create unique index if not exists organizations_name_idx on organizations (name);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age int not null check (age between 13 and 19),
  city text,
  zip_code text,
  -- Capped at 50 miles (~1 hour's drive) — lib/matching.ts treats distance
  -- as a hard filter, same as age, so an unrealistic radius here would
  -- defeat the point of that filter.
  max_distance_miles int not null default 10 check (max_distance_miles between 1 and 50),
  -- Must stay in sync with lib/interestTaxonomy.ts's TAXONOMY (10 broad
  -- categories, each with its own canonical focus list) and
  -- ALL_VALID_INTEREST_VALUES specifically. The array below is that
  -- canonical taxonomy's values PLUS every legacy alias and retired value
  -- (see FOCUS_ALIASES / RETIRED_FOCUS_VALUES in that file) — a value is
  -- never removed here even after being superseded, since existing
  -- profile rows already contain it and this is a storage-validity
  -- constraint, not a UI option list. Legacy-to-canonical reclassification
  -- happens transparently at match time via resolveCanonicalFocus() in
  -- lib/matching.ts, never by rewriting stored rows. See
  -- supabase/add_canonical_focus_taxonomy.sql for the migration that
  -- introduced this (additive over the prior 28-value constraint from
  -- add_profiles_interests_check.sql / add_stem_subtag_taxonomy.sql /
  -- add_business_interest_taxonomy.sql — nothing removed).
  interests text[] not null default '{}'
    check (interests <@ array[
      'stem','healthcare','education','business','environment','animals',
      'community','arts','government_law','sports','cs_software_engineering','data_science_ai',
      'cybersecurity','electrical_computer_engineering','mechanical_engineering','civil_engineering','environmental_engineering','chemical_engineering',
      'chemistry','physics_astronomy','biology_biotechnology','mathematics_statistics','robotics','aerospace_engineering',
      'architecture_design_engineering','general_engineering','medicine_physician','nursing','dentistry','pharmacy',
      'veterinary_medicine','physical_therapy','occupational_therapy','psychology_mental_health','public_health','biomedical_research',
      'emergency_medicine_first_aid','nutrition_wellness','healthcare_administration','early_childhood_education','elementary_education','secondary_education',
      'special_education','literacy','stem_education','college_career_readiness','youth_mentoring','educational_technology',
      'entrepreneurship','finance','economics','marketing','management_operations','nonprofit_management',
      'human_resources','information_systems','event_planning','social_innovation','environmental_science','conservation',
      'climate_sustainability','ecology','marine_science','agriculture_food_systems','parks_outdoor_stewardship','recycling_waste_reduction',
      'veterinary_interests','animal_shelters','wildlife_conservation','animal_welfare','zoology','marine_wildlife',
      'animal_assisted_services','food_security','housing_homelessness','disability_support','senior_support','youth_services',
      'disaster_preparedness','immigrant_refugee_support','community_development','visual_arts','music','theater_performing_arts',
      'writing_journalism','photography_film','graphic_design','museums_history','digital_media','social_media_communications',
      'law_legal_services','government_public_administration','public_policy','civic_engagement','human_rights','voter_education',
      'international_relations','criminal_justice','advocacy_community_organizing','coaching','youth_sports','adaptive_sports',
      'recreation_programs','sports_management','event_support','outdoor_recreation','health_fitness_education','computer_science',
      'software_engineering','data_science','artificial_intelligence','computer_engineering','electrical_engineering','semiconductor_engineering',
      'quantum_computing','stem_leadership'
    ]::text[]),
  skills text[] not null default '{}',
  availability text[] not null default '{}', -- e.g. saturday_morning, weekday_evening
  commitment_preference text not null default 'either'
    check (commitment_preference in ('one_time', 'recurring', 'either')),
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  title text not null,
  description text,
  category text not null,
  minimum_age int not null default 13,
  location text,
  latitude double precision,
  longitude double precision,
  schedule_slots text[] not null default '{}',
  skills_required text[] not null default '{}',
  interests_tags text[] not null default '{}',
  commitment_type text not null default 'one_time'
    check (commitment_type in ('one_time', 'recurring')),
  application_url text,
  application_deadline date,
  -- Distinguishes a confirmed-open listing from one that's real but not
  -- confirmed currently accepting (seasonal/no published window,
  -- contingent-on-availability, or a known-closed event). Every automated
  -- source and the manual admin form default here, since they're all
  -- genuinely active/verified. app/dashboard/page.tsx and
  -- app/onboarding/page.tsx's preview both filter to 'open' only — a
  -- seasonal/unverified/closed row is real data (visible on its org's own
  -- detail page with a status badge) but never enters ranked matching.
  -- 'paused' (on hold indefinitely, not a normal seasonal cycle) and
  -- 'waitlisted' were added by the biomedical/healthcare batch (see
  -- supabase/add_biomedical_program_fields.sql).
  availability_status text not null default 'open'
    check (availability_status in ('open', 'seasonal', 'unverified', 'closed', 'paused', 'waitlisted')),
  -- Ingestion metadata: where a listing came from and how to dedup it.
  -- "manual" (the /admin form) is the only source in use today; others
  -- (e.g. "idealist", "org_website") are for a future scraper/importer.
  source text not null default 'manual',
  source_url text,
  external_id text, -- source's own ID for this listing; unique per source
  last_verified_at timestamptz,
  is_stale boolean not null default false, -- flipped by the ingestion job, not computed in SQL
  -- 384-dim vector from the local embedding model (Xenova/all-MiniLM-L6-v2),
  -- over `description`. Stored as jsonb (a plain float array) rather than
  -- pgvector, since similarity is computed in JS, not in Postgres — see
  -- lib/vectorMath.ts. Tied to this specific model: switching models means
  -- regenerating every row's embedding, since vectors from different
  -- models aren't comparable.
  embedding jsonb,
  -- ---- Biomedical/healthcare batch (supabase/add_biomedical_program_fields.sql)
  -- and CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology batch
  -- (supabase/add_stem_subtag_taxonomy.sql) additions below. Every one of
  -- these is DISPLAY-ONLY CONTEXT — never read by lib/matching.ts, never
  -- used in a WHERE clause to gate what a student can see or apply to.
  -- The only hard filters remain minimum_age and distance. ----
  availability_note text,
  -- "competition" added by the CS/Engineering batch (Congressional App
  -- Challenge, CyberPatriot, NASA challenges, robotics competitions) —
  -- kept distinct from career_exploration_program: a judged/ranked/
  -- scored/award-based event a student enters, never volunteering.
  program_type text
    check (program_type in ('volunteering', 'internship', 'research_program', 'career_exploration_program', 'camp', 'club', 'competition')),
  compensation text
    check (compensation in ('unpaid', 'paid', 'tuition_based', 'not_specified'))
    default 'not_specified',
  cost text,
  financial_aid_available boolean,
  eligible_grades text,
  arizona_residency_required boolean,
  parental_consent_required boolean,
  health_screening_required boolean,
  background_check_required boolean,
  direct_patient_contact boolean,
  research_component boolean,
  shadowing_component boolean,
  application_open_date date,
  time_commitment text,
  program_focus_tags text[] not null default '{}',
  -- CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology batch
  -- (supabase/add_delivery_mode.sql). 'in_person' is the default and the
  -- only value every pre-existing opportunity ever had — distance stays
  -- a hard filter for it. 'virtual'/'hybrid' bypass the distance hard
  -- filter entirely (see lib/matching.ts's isWithinRange()) since no
  -- physical attendance is required; never inferred from missing
  -- latitude/longitude, only ever set explicitly per-opportunity.
  delivery_mode text not null default 'in_person'
    check (delivery_mode in ('in_person', 'virtual', 'hybrid')),
  created_at timestamptz not null default now(),
  -- Ingestion infrastructure Phase 2 (see
  -- supabase/add_ingestion_source_registry_and_staging.sql). Staging
  -- gate: automated scraper connectors write 'pending' for new rows;
  -- every other write path (manual-curated, admin, org self-service,
  -- CSV import) keeps defaulting to 'approved', same as it always has.
  -- Defaulting to 'approved' here means every pre-existing row (and
  -- every write path that doesn't explicitly opt into staging) is
  -- unaffected — see that migration's header for why this is safe to
  -- add directly as `not null default`, no separate backfill pass.
  review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected', 'merged')),
  first_discovered_at timestamptz,
  content_fingerprint text,
  review_notes text,
  next_review_date date,
  reviewed_by uuid references auth.users(id) on delete set null,
  verification_method text,
  merged_into_id uuid references opportunities(id) on delete set null
);

create index if not exists opportunities_review_status_idx on opportunities (review_status);
create index if not exists opportunities_content_fingerprint_idx on opportunities (content_fingerprint);

-- Dedup key for ingested listings: same source + same external_id = same
-- listing. Manual entries have no external_id, so nulls are excluded
-- (a plain unique index would already allow multiple nulls, but the
-- partial form makes the intent explicit).
create unique index if not exists opportunities_source_external_id_idx
  on opportunities (source, external_id)
  where external_id is not null;

create table if not exists saved_opportunities (
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'accepted', 'completed')),
  updated_at timestamptz not null default now()
);

-- One application per student per opportunity; lets the app upsert on save.
create unique index if not exists applications_user_opportunity_idx
  on applications (user_id, opportunity_id);

-- Append-only product-usage log (lib/analytics.ts's trackEvent()),
-- read by /admin/analytics. Deliberately separate from `applications`:
-- `applications.status` is mutable and overwritten in place, so a saved
-- row that later moves to 'applied' can no longer be found by querying
-- status = 'saved' — this table is the only place "how many students
-- ever saved something" survives past the moment they moved on. metadata
-- is jsonb but is only ever small structured values (match mode,
-- from/to status) — never free text, age, city, zip, interests, skills,
-- or email; see ARCHITECTURE.md for the concrete no-PII definition.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  -- external_link_clicked/contact_interest_clicked distinguish a real
  -- apply/registration link from a contact-only pathway (see
  -- lib/availabilityStatus.ts); program_availability_confirmed logs when
  -- an admin manually re-verifies a seasonal/unverified record as open.
  event_type text not null check (event_type in (
    'onboarding_started', 'onboarding_completed',
    'match_viewed', 'match_saved',
    'application_started', 'application_submitted',
    'application_status_changed', 'opportunity_completed',
    'external_link_clicked', 'contact_interest_clicked', 'program_availability_confirmed'
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

-- "Was this match helpful?" feedback, one row per student per
-- opportunity per algorithm (a student could rate the same opportunity
-- once under classic and once under semantic if they toggle modes) —
-- closer in spirit to `applications`/`saved_opportunities`
-- (current-state, upsertable) than to `analytics_events` (append-only
-- log): re-submitting feedback updates the existing row via the unique
-- index below rather than creating duplicates. `reason` is a fixed
-- preset, not free text — consistent with this app's UI vocabulary
-- elsewhere and aggregable on a dashboard; only meaningful when
-- helpful = false.
create table if not exists match_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  algorithm text not null check (algorithm in ('classic', 'semantic')),
  helpful boolean not null,
  reason text check (reason in ('wrong_category', 'too_far', 'schedule_conflict', 'age_mismatch', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_feedback_user_opportunity_algorithm_idx
  on match_feedback (user_id, opportunity_id, algorithm);

-- Audit log of each fetcher execution (manual CLI run or scheduled cron):
-- when, which source, how many listings found/inserted/updated/skipped as
-- duplicates, and whether it errored. Powers /admin/ingestion-log.
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

-- Minimal admin concept: a user in this table can write to opportunities/
-- organizations via the browser (anon key + RLS check); everyone else
-- reads only. No insert/update/delete policy exists on this table at
-- all — admin status is granted by direct SQL (Supabase SQL editor or
-- service role) on purpose, there's no self-service "become an admin"
-- path or UI for managing it.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Set once, client-side, immediately after signup — before any
-- onboarding data exists for either account type. Kept separate from
-- `profiles` (student-only data) and `organization_accounts` (only
-- exists once org onboarding actually completes): a user who picked
-- "organization" at signup but abandoned onboarding halfway through has
-- neither of those rows yet, and without a role recorded up front, a
-- later login would have no way to know which onboarding flow to send
-- them back to.
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'organization')),
  created_at timestamptz not null default now()
);

-- Which organization a user represents. Existence of a row (not a role
-- string) is what the opportunities write policies below actually
-- check — same "membership table, not a flag" pattern as `admins`.
-- Populated only by create_organization_account() further down, never
-- by a direct client insert.
create table if not exists organization_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists organization_accounts_org_idx
  on organization_accounts (organization_id);

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

-- Prevents two overlapping invocations of the same ingestion source (a
-- genuine Vercel cron retry after a timeout, or a manual CLI run
-- colliding with the weekly cron) from both running at once and
-- double-writing an `ingestion_runs` audit row for the same execution.
-- See supabase/add_error_log_and_ingestion_locks.sql for why this is a
-- row + timestamp claim rather than pg_advisory_lock (connection
-- pooling makes session-scoped advisory locks unsafe here).
create table if not exists ingestion_locks (
  source text primary key,
  locked_at timestamptz
);

-- Ingestion infrastructure Phase 2 (see
-- supabase/add_ingestion_source_registry_and_staging.sql for the full
-- reasoning and the seed rows for every source currently live). The
-- metadata layer lib/ingestion/sourceRegistry.ts's plain string-slug
-- dispatch always lacked — geography, categories, virtual coverage,
-- refresh cadence, health/status, ToS notes — all now live here instead
-- of scattered across each connector file's own header comments.
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
  updated_at timestamptz not null default now(),
  -- Added by supabase/add_source_research_registry_fields.sql for the
  -- catalog-expansion Stage 2/3 research pass — a full disposition
  -- lifecycle (approved_for_ingestion/manual_only/partnership_required/
  -- blocked/rejected/inactive/needs_follow_up) independent of `status`
  -- above, which is about a live connector's own health, not whether a
  -- researched-but-not-yet-connected source is worth pursuing.
  disposition text not null default 'needs_follow_up'
    check (disposition in ('approved_for_ingestion', 'manual_only', 'partnership_required', 'blocked', 'rejected', 'inactive', 'needs_follow_up')),
  access_method text,
  tier text check (tier in ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
  priority_score int,
  expected_yield int,
  teen_eligibility_evidence text,
  duplicate_risk text,
  maintenance_difficulty text check (maintenance_difficulty in ('low', 'medium', 'high')),
  connector_family text,
  disposition_reason text,
  researched_at timestamptz
);

-- Row Level Security: students can only see/edit their own profile + applications
alter table profiles enable row level security;
alter table saved_opportunities enable row level security;
alter table applications enable row level security;
alter table ingestion_runs enable row level security;
alter table admins enable row level security;
alter table user_roles enable row level security;
alter table organization_accounts enable row level security;
alter table analytics_events enable row level security;
alter table match_feedback enable row level security;
alter table error_log enable row level security;
alter table ingestion_locks enable row level security;
alter table ingestion_sources enable row level security;
-- ingestion_locks gets no policies at all, intentionally — only the
-- service role (which bypasses RLS regardless) is ever meant to touch
-- it, via the two functions defined at the end of this file.

create policy "Users manage their own profile"
  on profiles for all
  using (auth.uid() = user_id);

create policy "Users manage their own saved opportunities"
  on saved_opportunities for all
  using (auth.uid() = user_id);

create policy "Users manage their own applications"
  on applications for all
  using (auth.uid() = user_id);

-- Same shape as the two policies above — full access to a student's
-- own rows only, no security-definer function needed since this never
-- crosses an ownership boundary.
create policy "Users manage their own match feedback"
  on match_feedback for all
  using (auth.uid() = user_id);

-- Additional permissive policy alongside the one above (Postgres ORs
-- them for select) — an org rep can view, but not modify, applications
-- tied to their own organization's opportunities. Needed for
-- /org-dashboard's "total applications received" stat.
create policy "Org reps can view applications for their own organization"
  on applications for select
  using (
    exists (
      select 1
      from opportunities
      join organization_accounts
        on organization_accounts.organization_id = opportunities.organization_id
      where opportunities.id = applications.opportunity_id
        and organization_accounts.user_id = auth.uid()
    )
  );

-- Needed for /admin/analytics's "completed volunteer placements" stat
-- (an all-time count across every student, not just the admin's own
-- rows). Caught live while verifying Phase 2: organizations/opportunities
-- are public-read ("using (true)"), so those metrics worked without any
-- change, but applications has no such public/admin policy — without
-- this, the count silently came back 0 for any admin, not an error.
create policy "Admins can view all applications"
  on applications for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- Insert-only for the event's own user, admin-only read — this table
-- holds per-user behavior (which student did what, when), unlike
-- `ingestion_runs`'s fully public "using (true)" below, which has no
-- per-user data in it at all and is public read/write on purpose. No
-- update/delete policy exists at all: it's an append-only log, same
-- "no self-service mutation" posture as `admins`/`user_roles`.
create policy "Users can record their own analytics events"
  on analytics_events for insert
  with check (auth.uid() = user_id);
create policy "Admins can read analytics events"
  on analytics_events for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- Needed for /admin/analytics's "Matching quality" section to compute
-- helpfulness rates across all students, not just the admin's own
-- (nonexistent) feedback rows.
create policy "Admins can view all match feedback"
  on match_feedback for select
  using (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can read the error log"
  on error_log for select
  using (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can read ingestion sources"
  on ingestion_sources for select
  using (exists (select 1 from admins where user_id = auth.uid()));

create policy "Admins can manage ingestion sources"
  on ingestion_sources for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- A user's own row in admins is readable — needed so the `exists (select
-- 1 from admins where user_id = auth.uid())` checks below don't fall
-- into the "RLS enabled, zero policies -> zero rows for everyone" trap
-- (see ARCHITECTURE.md §5): a policy subquery is itself subject to RLS
-- on the table it queries, service role/superuser aside.
create policy "Users can check their own admin status"
  on admins for select
  using (auth.uid() = user_id);

create policy "Users can check their own role"
  on user_roles for select
  using (auth.uid() = user_id);

-- Insert-only, no update/delete policy: a user sets their own role
-- exactly once, at signup (`with check` still restricts it to their own
-- user_id, so no one can set another user's role). Changing roles after
-- the fact isn't a supported self-service flow, same philosophy as
-- `admins` — fix mistakes by hand via the SQL editor if they happen.
create policy "Users can set their own role once at signup"
  on user_roles for insert
  with check (auth.uid() = user_id);

create policy "Users can check their own organization membership"
  on organization_accounts for select
  using (auth.uid() = user_id);

-- Deliberately no insert/update/delete policy here at all — see
-- create_organization_account() below for why.

-- Ingestion run log is still public read/write — out of scope for the
-- admin-only tightening below since its own writers (the ingestion
-- pipeline) move to the service role regardless, and nothing here is
-- sensitive enough to justify gating manually.
create policy "Anyone can read ingestion runs"
  on ingestion_runs for select
  using (true);
create policy "Anyone can record ingestion runs"
  on ingestion_runs for insert
  with check (true);

-- Opportunities: public read is gated on the posting org being
-- verified (see add_org_verification_enforcement.sql for the live
-- rollout caveat — a fresh database has zero organizations, so no
-- backfill is needed here, only for the standalone migration file).
-- Writes require an admin user, an org rep acting on their own
-- organization's rows only (policies further down), or the service
-- role (bypasses RLS entirely, used by the ingestion pipeline — see
-- lib/supabaseAdminClient.ts).
alter table opportunities enable row level security;
-- review_status = 'approved' added by
-- supabase/add_ingestion_source_registry_and_staging.sql — safe with no
-- separate backfill step since the column itself defaults every
-- existing row to 'approved' (see that migration's header).
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
create policy "Admins can read all opportunities regardless of verification"
  on opportunities for select
  using (exists (select 1 from admins where user_id = auth.uid()));
create policy "Org reps can read their own opportunities regardless of verification"
  on opportunities for select
  using (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );
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

-- Organizations: same model as opportunities. Full CRUD for admins now
-- (update/delete never existed as policies before this — that was a gap,
-- not an intentional restriction).
alter table organizations enable row level security;
create policy "Anyone can read organizations"
  on organizations for select
  using (true);
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

-- Org reps: additional permissive policies alongside the admin ones
-- above — Postgres OR's multiple permissive policies for the same
-- command, so a write succeeds if it satisfies *either* the admin
-- policy or these, never neither. An org rep can only ever touch rows
-- whose organization_id matches the organization_accounts row for
-- their own auth.uid(); opportunities.organization_id is nullable
-- (org-less listings from /admin), and null can never satisfy this
-- exists() check, so org reps can't touch or create organization-less
-- rows — that stays an admin-only capability, unchanged.
create policy "Org reps can add opportunities for their own organization"
  on opportunities for insert
  with check (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );
create policy "Org reps can update opportunities for their own organization"
  on opportunities for update
  using (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  )
  with check (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );
create policy "Org reps can delete opportunities for their own organization"
  on opportunities for delete
  using (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );

-- The one sanctioned way to create an organization_accounts row. Runs
-- as its owner (security definer), so it can insert into
-- `organizations` despite that table's insert policy being admin-only —
-- the safety guarantee isn't "this role can bypass RLS," it's that this
-- specific function only ever creates a *new* organization and links it
-- to the *caller's own* auth.uid(), so there's no path to hijacking an
-- existing organization's id this way.
create or replace function create_organization_account(
  org_name text,
  org_description text default null,
  org_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create an organization account';
  end if;

  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'organization'
  ) then
    raise exception 'This account is not registered as an organization';
  end if;

  if exists (select 1 from organization_accounts where user_id = auth.uid()) then
    raise exception 'This account is already linked to an organization';
  end if;

  if org_name is null or btrim(org_name) = '' then
    raise exception 'Organization name is required';
  end if;

  insert into organizations (name, description, contact_email)
  values (
    btrim(org_name),
    nullif(btrim(coalesce(org_description, '')), ''),
    nullif(btrim(coalesce(org_contact_email, '')), '')
  )
  returning id into new_org_id;

  insert into organization_accounts (user_id, organization_id)
  values (auth.uid(), new_org_id);

  return new_org_id;
end;
$$;

revoke all on function create_organization_account(text, text, text) from public;
grant execute on function create_organization_account(text, text, text) to authenticated;

-- Lets an organization rep move an applicant's status forward (Applied
-- -> Accepted -> Completed) from /org-dashboard, synced with the same
-- `applications` row the student's own tracker (/applications) reads
-- and writes. Deliberately a security definer function rather than a
-- raw permissive UPDATE policy: a table-level policy's `with check`
-- only constrains which *rows* qualify, not which *columns* a client is
-- allowed to change on them — a crafted PostgREST PATCH could otherwise
-- reassign `user_id` or `opportunity_id` on someone else's application
-- row instead of just moving its status. This function only ever
-- touches `status` and `updated_at`, and re-derives the org-ownership
-- check itself. Like create_organization_account() above, this
-- function's owner bypasses `applications` RLS entirely while it
-- executes (that's what security definer means) — the safety guarantee
-- is everything checked in the body, not RLS.
create or replace function org_update_application_status(
  application_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  owns_it boolean;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated';
  end if;

  -- Orgs can only ever move an application forward to one of these two
  -- states — not back to 'applied', and never to 'saved' (a student's
  -- private bookmark, not something an org should be able to touch or
  -- even necessarily know exists as "theirs" to act on).
  if new_status not in ('accepted', 'completed') then
    raise exception 'Organizations can only mark an application Accepted or Completed';
  end if;

  select a.status,
    exists (
      select 1
      from opportunities o
      join organization_accounts oa on oa.organization_id = o.organization_id
      where o.id = a.opportunity_id and oa.user_id = auth.uid()
    )
  into current_status, owns_it
  from applications a
  where a.id = application_id;

  if current_status is null then
    raise exception 'Application not found';
  end if;

  if not owns_it then
    raise exception 'Not authorized to update this application';
  end if;

  if current_status = 'saved' then
    raise exception 'This application has not been submitted yet';
  end if;

  if new_status = 'completed' and current_status not in ('accepted', 'completed') then
    raise exception 'An application must be Accepted before it can be marked Completed';
  end if;

  update applications
  set status = new_status, updated_at = now()
  where id = application_id;
end;
$$;

revoke all on function org_update_application_status(uuid, text) from public;
grant execute on function org_update_application_status(uuid, text) to authenticated;

-- Atomically claims the ingestion lock for `source_name`, or fails if
-- another run already holds it and hasn't gone stale.
-- `stale_after_minutes` self-heals a lock left behind by a run that
-- crashed without releasing it (every fetcher run should complete well
-- under 15 minutes in practice).
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

-- Product-readiness audit: backs the "report inaccurate listing" flow
-- and general product feedback — one table for both (report_type
-- distinguishes them), since the review lifecycle is identical either
-- way. See supabase/add_user_reports.sql for the full reasoning.
create table if not exists user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
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
