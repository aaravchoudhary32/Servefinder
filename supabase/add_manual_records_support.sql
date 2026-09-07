-- Supports manually curated / non-scraped source integration: directory
-- records (an organization with no linked opportunities), and real
-- opportunities whose availability isn't a confirmed, currently-open
-- listing (seasonal, unverified, or closed).
--
-- Run this AFTER schema.sql, in the Supabase SQL editor.

-- organizations: fields a directory record needs to be useful on its own
-- (website, city/service region) plus a manual-verification timestamp —
-- distinct from opportunities.last_verified_at, which an automated
-- fetcher sets on every re-scrape; this one is only ever set by a human
-- confirming an organization's own info is current.
alter table organizations add column if not exists website_url text;
alter table organizations add column if not exists city text;
alter table organizations add column if not exists last_verified_at timestamptz;

-- opportunities: distinguishes a confirmed-open listing from one that's
-- real but not confirmed currently accepting (seasonal/no published
-- window, contingent-on-availability, or a known-closed event). Defaults
-- to 'open' so every existing row (all 11 automated sources + the manual
-- admin form) keeps its current behavior with zero migration needed.
alter table opportunities add column if not exists availability_status text not null default 'open'
  check (availability_status in ('open', 'seasonal', 'unverified', 'closed'));

-- analytics_events: three new event types for the manual-source-record
-- UI — external_link_clicked/contact_interest_clicked distinguish a real
-- apply/registration link from a contact-only pathway (mirroring the
-- "External application" vs "Contact organization" badges), and
-- program_availability_confirmed logs when an admin manually re-verifies
-- a seasonal/unverified record as currently open.
alter table analytics_events drop constraint if exists analytics_events_event_type_check;
alter table analytics_events add constraint analytics_events_event_type_check
  check (event_type in (
    'onboarding_started', 'onboarding_completed',
    'match_viewed', 'match_saved',
    'application_started', 'application_submitted',
    'application_status_changed', 'opportunity_completed',
    'external_link_clicked', 'contact_interest_clicked', 'program_availability_confirmed'
  ));
