-- Supports the Business/Entrepreneurship/Finance/Marketing/Social
-- Innovation source batch: widens one existing CHECK constraint
-- additively, exactly like supabase/add_stem_subtag_taxonomy.sql did for
-- the STEM subtags. No new tables, no new columns, no data
-- migration/backfill, no automatic modification of any existing row —
-- every existing row in `profiles` already satisfies the new (superset)
-- constraint unchanged, since nothing is removed from the allowed list.
--
-- Run this AFTER schema.sql and add_stem_subtag_taxonomy.sql, in the
-- Supabase SQL editor.
--
-- ---------------------------------------------------------------------
-- profiles.interests — add the broad "business" interest plus 4
-- Business sub-interests (entrepreneurship, finance, marketing,
-- social_innovation), additive to the existing 8-value taxonomy + 15
-- STEM subtags. A student can now pick "Business & Entrepreneurship"
-- and/or a specific sub-interest (e.g. "finance") — both live in the
-- same flat interests array. lib/matching.ts's
-- expandWithTaxonomyParents() is what makes a sub-interest also credit
-- the broad "business" tag at match time (mirroring
-- expandWithStemParent()'s existing STEM behavior); this migration only
-- widens what's a *valid* value to store. No existing value is ever
-- removed — every existing profile row already satisfies this
-- constraint unchanged, and no existing row is touched by this
-- migration (no update/backfill statement below, by design).
--
-- Safe to run on a database with existing rows: this is a strict
-- superset of the prior constraint, so no existing row can violate it.
-- (If you want to double-check first anyway, the guard below should
-- return zero rows both before and after this migration.)

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
    'quantum_computing','general_engineering','stem_leadership',
    'business','entrepreneurship','finance','marketing','social_innovation'
  ]::text[]);

-- ---------------------------------------------------------------------
-- Rollback (only safe if no row has since taken a new "business"/subtag
-- value — check first with the guard query below, mirroring the pattern
-- add_stem_subtag_taxonomy.sql already established):
--
-- select user_id, interests from profiles
-- where interests && array['business','entrepreneurship','finance','marketing','social_innovation']::text[];
--
-- alter table profiles drop constraint if exists profiles_interests_valid_tags;
-- alter table profiles add constraint profiles_interests_valid_tags
--   check (interests <@ array[
--     'stem','environment','healthcare','education','animals','arts','community','sports',
--     'computer_science','software_engineering','artificial_intelligence','data_science',
--     'cybersecurity','computer_engineering','electrical_engineering','mechanical_engineering',
--     'civil_engineering','aerospace_engineering','robotics','semiconductor_engineering',
--     'quantum_computing','general_engineering','stem_leadership'
--   ]::text[]);
