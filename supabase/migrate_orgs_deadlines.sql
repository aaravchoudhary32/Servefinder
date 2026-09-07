-- One-time migration for an existing database that already ran the old
-- schema.sql/seed.sql (matches by name/title, safe to re-run). Adds:
--   1. organizations.description + a uniqueness guard on org name
--   2. opportunities.application_deadline
--   3. the missing INSERT policy on opportunities (without it, the
--      /admin form silently fails to save — RLS was enabled with only a
--      SELECT policy)
--   4. seed organizations + link them to the existing seeded opportunities
--   5. illustrative deadlines on a few opportunities (some intentionally
--      close to "today" to exercise the marigold urgency badge)
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql and seed.sql already include all of this.

alter table organizations add column if not exists description text;
create unique index if not exists organizations_name_idx on organizations (name);

alter table opportunities add column if not exists application_deadline date;

drop policy if exists "Anyone can add opportunities" on opportunities;
create policy "Anyone can add opportunities"
  on opportunities for insert
  with check (true);

insert into organizations (name, description) values
  ('Downtown Public Library', 'The city''s main library branch, running youth tutoring and tech programs year-round.'),
  ('Riverside Conservancy', 'A nonprofit maintaining trails and natural habitat along the river corridor.'),
  ('St. Anne''s Medical Center', 'A community hospital with a long-running volunteer program across departments.'),
  ('Valley Humane Society', 'A no-kill animal shelter relying on volunteers for daily animal care.'),
  ('Community Food Bank', 'Sorts and distributes donated food to families across the region each week.'),
  ('Public Library Tech Lab', 'The library''s hands-on tech space, home to coding camps and maker workshops.'),
  ('City Arts Center', 'A public arts space hosting community art projects and youth programs.'),
  ('Community Learning Center', 'Offers free adult education and English-language classes.'),
  ('City Rec Complex', 'Runs youth sports leagues and recreational programs for the city.'),
  ('Elementary School Library', 'A neighborhood elementary school library supporting student literacy.'),
  ('Sunset Neighborhood Park', 'A city park maintained in part through neighborhood volunteer days.')
on conflict (name) do nothing;

update opportunities set organization_id = (select id from organizations where name = 'Downtown Public Library'), application_deadline = '2026-08-30' where title = 'STEM Tutor';
update opportunities set organization_id = (select id from organizations where name = 'Riverside Conservancy'), application_deadline = '2026-08-18' where title = 'Trail Restoration Crew';
update opportunities set organization_id = (select id from organizations where name = 'St. Anne''s Medical Center'), application_deadline = null where title = 'Hospital Front Desk Helper';
update opportunities set organization_id = (select id from organizations where name = 'Valley Humane Society'), application_deadline = '2026-08-17' where title = 'Animal Shelter Dog Walker';
update opportunities set organization_id = (select id from organizations where name = 'Community Food Bank'), application_deadline = '2026-09-15' where title = 'Food Bank Sorter';
update opportunities set organization_id = (select id from organizations where name = 'Public Library Tech Lab'), application_deadline = null where title = 'Coding Camp Assistant';
update opportunities set organization_id = (select id from organizations where name = 'City Arts Center'), application_deadline = '2026-08-19' where title = 'Community Mural Painter';
update opportunities set organization_id = (select id from organizations where name = 'Community Learning Center'), application_deadline = '2026-08-25' where title = 'ESL Conversation Partner';
update opportunities set organization_id = (select id from organizations where name = 'City Rec Complex'), application_deadline = null where title = 'Youth Soccer Coach Assistant';
update opportunities set organization_id = (select id from organizations where name = 'St. Anne''s Medical Center'), application_deadline = '2026-08-16' where title = 'Hospital Gift Shop Helper';
update opportunities set organization_id = (select id from organizations where name = 'Elementary School Library'), application_deadline = '2026-09-01' where title = 'Bilingual Reading Buddy';
update opportunities set organization_id = (select id from organizations where name = 'Sunset Neighborhood Park'), application_deadline = '2026-08-17' where title = 'Park Cleanup Day';
