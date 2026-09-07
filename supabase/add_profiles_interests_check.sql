-- Restrict profiles.interests to the app's real 8-value interest taxonomy
-- (see lib/constants.ts CATEGORY_TAG_MAP / app/onboarding/page.tsx
-- INTEREST_OPTIONS, which already only ever write these 8 values).
--
-- Onboarding's UI already only lets students pick from this exact set, so
-- this constraint is a data-integrity safeguard, not a UI enforcement
-- mechanism: it closes off the only remaining way an invalid value like
-- "events" or "academics" could end up in a profile row — a direct write
-- that bypasses the app (manual DB edit, ad hoc script, future code path
-- that forgets to reuse the same fixed list).
--
-- Run this AFTER schema.sql, in the Supabase SQL editor.
--
-- Safe to run on a database with existing rows PROVIDED every existing
-- profiles.interests value is already one of the 8 valid tags. If this
-- fails with a check-constraint violation, run the SELECT below first to
-- find and fix the offending row(s) before re-running the ALTER TABLE.

-- select user_id, interests
-- from profiles
-- where not (interests <@ array['stem','environment','healthcare','education','animals','arts','community','sports']::text[]);

alter table profiles
  add constraint profiles_interests_valid_tags
  check (interests <@ array['stem','environment','healthcare','education','animals','arts','community','sports']::text[]);
