-- Adds UPDATE and DELETE policies to opportunities, needed for the new
-- edit/delete controls in /admin. Same open posture as the existing
-- SELECT/INSERT policies — there's no admin-role concept in this app yet.
-- Safe to re-run.
--
-- Note: deleting an opportunity cascades to any students' saved/tracked
-- applications for it (applications.opportunity_id references
-- opportunities(id) on delete cascade) — that's existing schema
-- behavior, not new.

drop policy if exists "Anyone can update opportunities" on opportunities;
create policy "Anyone can update opportunities"
  on opportunities for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete opportunities" on opportunities;
create policy "Anyone can delete opportunities"
  on opportunities for delete
  using (true);
