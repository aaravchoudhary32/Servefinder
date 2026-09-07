-- Supports the Arizona biomedical/healthcare/premed source batch: richer,
-- purely descriptive program metadata (grade eligibility, cost, consent/
-- screening requirements, clinical-exposure disclosure) plus two more
-- availability states this batch's real-world programs actually need.
--
-- Every new column below is DISPLAY-ONLY CONTEXT for the student and their
-- parent — none of them are ever used in a WHERE clause, in
-- lib/matching.ts's scoring, or to gate/filter what a student can see or
-- apply to. The only hard filter remains minimum_age, unchanged by this
-- migration. A student sees every program in this batch regardless of
-- what these fields say; the platform's job is to inform before the
-- student clicks through to the organization's own real application,
-- where the organization itself handles actual eligibility, consent, and
-- screening.
--
-- Run this AFTER schema.sql and add_manual_records_support.sql, in the
-- Supabase SQL editor.

-- Two more availability states this batch's real programs need, beyond
-- 'open'/'seasonal'/'unverified'/'closed': 'paused' (on hold indefinitely,
-- not tied to a normal seasonal cycle — Banner-UMC Phoenix's teen program)
-- and 'waitlisted' (Phoenix Children's Family Volunteer Program).
alter table opportunities drop constraint if exists opportunities_availability_status_check;
alter table opportunities add constraint opportunities_availability_status_check
  check (availability_status in ('open', 'seasonal', 'unverified', 'closed', 'paused', 'waitlisted'));

-- Exact org language for the current status, shown to the student
-- alongside the AvailabilityBadge — e.g. "2026 canceled — check back
-- December 2026 for 2027 status," or "On hold due to application
-- volume." Lets the specific real-world nuance be shown honestly without
-- inventing a new availability_status enum value for every phrase.
alter table opportunities add column if not exists availability_note text;

-- What kind of activity this is — several programs in this batch are
-- paid/tuition-based research or career-exploration programs, not
-- volunteering, and mislabeling that is exactly what the spec forbids.
alter table opportunities add column if not exists program_type text
  check (program_type in ('volunteering', 'internship', 'research_program', 'career_exploration_program', 'camp', 'club'));

-- Whether money changes hands, and in which direction — orthogonal to
-- program_type (a "career_exploration_program" can be free, paid, or
-- tuition-based). 'not_specified' is a real, expected value, not a
-- placeholder to fill in later.
alter table opportunities add column if not exists compensation text
  check (compensation in ('unpaid', 'paid', 'tuition_based', 'not_specified'))
  default 'not_specified';

-- Free text rather than a numeric column: real costs in this batch don't
-- reduce to one number ("$500 residential / $300 day / $250 for a
-- different track", "$1,000 completion scholarship", "Free"). null means
-- genuinely not specified, not $0.
alter table opportunities add column if not exists cost text;
alter table opportunities add column if not exists financial_aid_available boolean;

-- Free text, not a second age column — several programs' real eligibility
-- doesn't reduce to one number (HonorHealth: "completed 10th grade AND at
-- least 15"; Mayo: conflicting 15-17 vs 15-18 across the org's own two
-- pages — both stated values get shown here, not silently picked between).
alter table opportunities add column if not exists eligible_grades text;

-- Requirement flags — null = not specified (never guessed), true/false
-- only when an official source explicitly states it. Purely descriptive;
-- see the file header for why these are never filters.
alter table opportunities add column if not exists arizona_residency_required boolean;
alter table opportunities add column if not exists parental_consent_required boolean;
alter table opportunities add column if not exists health_screening_required boolean;
alter table opportunities add column if not exists background_check_required boolean;

-- Clinical-exposure disclosure — the spec is explicit and repeated: never
-- imply patient contact, research, or shadowing unless the official
-- source explicitly says so. null = not specified, distinct from false.
alter table opportunities add column if not exists direct_patient_contact boolean;
alter table opportunities add column if not exists research_component boolean;
alter table opportunities add column if not exists shadowing_component boolean;

-- A real second date several of these programs have, distinct from
-- application_deadline (which already exists) — e.g. Barrow's internship
-- opens January 4, 2027 and closes February 12, 2027.
alter table opportunities add column if not exists application_open_date date;

-- Free text, not the existing fixed day/time-of-day schedule_slots enum —
-- can't express "two hours once a week" or "seven-week program, two
-- 4-hour shifts/week" as a set of day/time slots.
alter table opportunities add column if not exists time_commitment text;

-- Display-only finer sub-taxonomy (hospital_volunteering, hospice,
-- biomedical_research, premed, blood_services, ...) — deliberately
-- separate from interests_tags, which profiles.interests is hard-
-- constrained to 8 canonical values (see add_profiles_interests_check.sql)
-- and is what actually drives interest-fit scoring. A tag a student can
-- never select in their own profile is inert for matching purposes, so
-- this stays purely descriptive metadata, never read by lib/matching.ts.
alter table opportunities add column if not exists program_focus_tags text[] not null default '{}';
