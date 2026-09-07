-- Adds opportunities.delivery_mode: distinguishes a fixed-location,
-- in-person opportunity (the only kind that existed before this batch,
-- and the default going forward) from one that's virtual (no physical
-- attendance required at all) or hybrid (a genuine remote-participation
-- option exists alongside an in-person one).
--
-- Backward compatible: every existing row defaults to 'in_person',
-- preserving today's exact matching behavior for every opportunity that
-- predates this column. Nothing is auto-converted to virtual just
-- because its coordinates happen to be null — a null coordinate on an
-- in_person row means "location unresolved," not "doesn't need one," and
-- that row keeps being excluded from ranked matching until corrected,
-- exactly as before. See lib/matching.ts's isWithinRange()/distanceFit()
-- for how delivery_mode is actually used, and lib/manualRecords.ts for
-- how each virtual/hybrid record in this batch was independently
-- classified (never "it has an online application form").
--
-- Run this AFTER schema.sql, add_biomedical_program_fields.sql, and
-- add_stem_subtag_taxonomy.sql, in the Supabase SQL editor.

alter table opportunities add column if not exists delivery_mode text not null default 'in_person'
  check (delivery_mode in ('in_person', 'virtual', 'hybrid'));

-- Rollback:
-- alter table opportunities drop column if exists delivery_mode;
