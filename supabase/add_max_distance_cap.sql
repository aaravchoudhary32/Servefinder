-- One-time migration for an existing database. Caps profiles.max_distance_miles
-- at 50 miles (~1 hour's drive) via a check constraint, mirroring the
-- existing `age between 13 and 19` constraint on this same table.
--
-- Distance became a hard filter in the matching engine (lib/matching.ts,
-- isWithinRange) rather than a soft scoring factor, so an unrealistic
-- student-set radius (e.g. "500 miles") would defeat the point of that
-- filter entirely — this constraint is the enforcement backstop behind
-- the onboarding form's own max={50} input cap.
--
-- Clamp any existing out-of-range rows first — a fresh check constraint
-- fails immediately if existing data already violates it.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes this constraint.

update profiles set max_distance_miles = 50 where max_distance_miles > 50;
update profiles set max_distance_miles = 1 where max_distance_miles < 1;

alter table profiles add constraint profiles_max_distance_miles_check
  check (max_distance_miles between 1 and 50);
