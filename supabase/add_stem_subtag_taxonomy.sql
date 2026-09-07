-- Supports the CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology
-- source batch: widens two existing CHECK constraints additively. No new
-- tables, no new columns, no data migration/backfill — every existing row
-- in `profiles` and `opportunities` already satisfies the new (superset)
-- constraints unchanged, since nothing is removed from either list.
--
-- Run this AFTER schema.sql and add_biomedical_program_fields.sql, in the
-- Supabase SQL editor.
--
-- ---------------------------------------------------------------------
-- 1. profiles.interests — add 15 STEM subtags, additive to the existing
--    8-value taxonomy (see supabase/add_profiles_interests_check.sql).
--    A student can now pick a specific field (e.g. "cybersecurity") in
--    addition to, or instead of, the broad "stem" tag — both live in the
--    same flat interests array. lib/matching.ts's expandWithStemParent()
--    is what makes a subtag also credit the broad "stem" tag at match
--    time; this migration only widens what's a *valid* value to store.
--    The original 8 values are never removed — every existing profile
--    row already satisfies this constraint unchanged.
--
--    Safe to run on a database with existing rows: this is a strict
--    superset of the prior constraint, so no existing row can violate it.
--    (If you want to double-check first anyway, the guard below should
--    return zero rows both before and after this migration.)

-- select user_id, interests
-- from profiles
-- where not (interests <@ array[
--   'stem','environment','healthcare','education','animals','arts','community','sports',
--   'computer_science','software_engineering','artificial_intelligence','data_science',
--   'cybersecurity','computer_engineering','electrical_engineering','mechanical_engineering',
--   'civil_engineering','aerospace_engineering','robotics','semiconductor_engineering',
--   'quantum_computing','general_engineering','stem_leadership'
-- ]::text[]);

alter table profiles drop constraint if exists profiles_interests_valid_tags;
alter table profiles add constraint profiles_interests_valid_tags
  check (interests <@ array[
    'stem','environment','healthcare','education','animals','arts','community','sports',
    'computer_science','software_engineering','artificial_intelligence','data_science',
    'cybersecurity','computer_engineering','electrical_engineering','mechanical_engineering',
    'civil_engineering','aerospace_engineering','robotics','semiconductor_engineering',
    'quantum_computing','general_engineering','stem_leadership'
  ]::text[]);

-- ---------------------------------------------------------------------
-- 2. opportunities.program_type — add 'competition', additive to the 6
--    values the biomedical batch introduced (see
--    add_biomedical_program_fields.sql). Kept distinct from
--    career_exploration_program: a judged/ranked/scored/award-based event
--    a student enters (Congressional App Challenge, CyberPatriot, NASA
--    challenges, robotics competitions), never volunteering. Every
--    existing row already satisfies this constraint unchanged (no row
--    can currently have program_type = 'competition' before this runs).

alter table opportunities drop constraint if exists opportunities_program_type_check;
alter table opportunities add constraint opportunities_program_type_check
  check (program_type in ('volunteering', 'internship', 'research_program', 'career_exploration_program', 'camp', 'club', 'competition'));

-- ---------------------------------------------------------------------
-- Rollback (only safe if no row has since taken a new value — check
-- first with the guard queries below, mirroring the pattern above):
--
-- select user_id, interests from profiles
-- where not (interests <@ array['stem','environment','healthcare','education','animals','arts','community','sports']::text[]);
--
-- select id, program_type from opportunities where program_type = 'competition';
--
-- alter table profiles drop constraint if exists profiles_interests_valid_tags;
-- alter table profiles add constraint profiles_interests_valid_tags
--   check (interests <@ array['stem','environment','healthcare','education','animals','arts','community','sports']::text[]);
--
-- alter table opportunities drop constraint if exists opportunities_program_type_check;
-- alter table opportunities add constraint opportunities_program_type_check
--   check (program_type in ('volunteering', 'internship', 'research_program', 'career_exploration_program', 'camp', 'club'));
