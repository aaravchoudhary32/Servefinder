-- One-time migration for an existing database. Grants admins read
-- access to all `applications` rows (not just their own), needed for
-- /admin/analytics's "completed volunteer placements" stat — an
-- all-time count across every student, not just the admin's own rows.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.
--
-- Caught live while verifying Phase 2: `organizations` and
-- `opportunities` are public-read ("using (true)"), so the analytics
-- dashboard's other all-time metrics worked without any change, but
-- `applications` has no such public/admin policy — without this, the
-- completed-placements count silently came back 0 for any admin, not
-- an error (the exact silent-failure shape documented elsewhere in this
-- project — see ARCHITECTURE.md §5).
create policy "Admins can view all applications"
  on applications for select
  using (exists (select 1 from admins where user_id = auth.uid()));
