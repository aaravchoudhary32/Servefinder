-- One-time migration for an existing database. Grants organization reps
-- read-only access to applications tied to their own organization's
-- opportunities — needed for /org-dashboard's "total applications
-- received" stat, which today would silently return zero rows for an
-- org rep: `applications` RLS currently only has "Users manage their
-- own applications" (`using (auth.uid() = user_id)`, for all
-- operations), scoped to the student who submitted it. An org rep's
-- auth.uid() never matches applications.user_id for any row, so
-- without this, a straightforward count query wouldn't error — it
-- would just always return 0, the exact silent-failure shape
-- documented repeatedly elsewhere in this project (ARCHITECTURE.md §5).
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.
--
-- Deliberately select-only: an org rep can see who applied and their
-- status (needed to count/display it at all), but can't insert, update,
-- or delete a student's application record — that stays exclusively the
-- student's own capability via the existing policy. This is an
-- additional permissive policy alongside "Users manage their own
-- applications," not a replacement — Postgres ORs multiple permissive
-- policies together for the same command, so students keep exactly the
-- access they had before.
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
