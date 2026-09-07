-- Fixes organizations returning zero rows to the anon key. RLS turned out
-- to already be enabled on this table (likely a project-level default)
-- with no policies at all, which silently denies all access rather than
-- erroring — so opportunity cards' organization links and the
-- /organizations pages were rendering blank. Safe to re-run.

alter table organizations enable row level security;

drop policy if exists "Anyone can read organizations" on organizations;
create policy "Anyone can read organizations"
  on organizations for select
  using (true);

drop policy if exists "Anyone can add organizations" on organizations;
create policy "Anyone can add organizations"
  on organizations for insert
  with check (true);
