-- Sample opportunities for ServeFinder
-- Run this AFTER schema.sql, in the Supabase SQL editor
--
-- Coordinates are placed around a fictional downtown (39.9612, -82.9988)
-- so the haversine distance calc on the dashboard has real spread to work
-- with (~1-10 miles out). Swap in real addresses/coordinates for production.
-- Deadlines are illustrative (some intentionally close to seed-time so the
-- "closes in X days" urgency badge has something to show).

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

insert into opportunities
  (organization_id, title, description, category, minimum_age, location, latitude, longitude, schedule_slots, skills_required, interests_tags, commitment_type, application_url, application_deadline)
values
  ((select id from organizations where name = 'Downtown Public Library'),
   'STEM Tutor', 'Help elementary students with math and science homework at the downtown library.', 'STEM', 15,
   'Downtown Public Library', 40.0047, -82.9988, '{saturday_morning}', '{tutoring}', '{stem,education}', 'recurring', null, '2026-08-30'),

  ((select id from organizations where name = 'Riverside Conservancy'),
   'Trail Restoration Crew', 'Join a crew clearing invasive plants and repairing trail erosion at the riverside park.', 'Environment', 14,
   'Riverside Conservancy', 39.9612, -82.8488, '{sunday_afternoon}', '{}', '{environment}', 'one_time', null, '2026-08-18'),

  ((select id from organizations where name = 'St. Anne''s Medical Center'),
   'Hospital Front Desk Helper', 'Greet visitors and help with administrative tasks at the front desk.', 'Healthcare', 16,
   'St. Anne''s Medical Center', 39.9012, -83.0788, '{weekday_evening}', '{}', '{healthcare}', 'recurring', null, null),

  ((select id from organizations where name = 'Valley Humane Society'),
   'Animal Shelter Dog Walker', 'Walk and socialize shelter dogs to help them stay active and adoptable.', 'Animals', 14,
   'Valley Humane Society', 39.9412, -82.9988, '{saturday_morning,sunday_morning}', '{}', '{animals}', 'recurring', null, '2026-08-17'),

  ((select id from organizations where name = 'Community Food Bank'),
   'Food Bank Sorter', 'Sort and pack donated food items for weekly distribution to families in need.', 'Community Service', 13,
   'Community Food Bank', 39.9612, -83.0488, '{weekday_afternoon,saturday_afternoon}', '{}', '{community}', 'one_time', null, '2026-09-15'),

  ((select id from organizations where name = 'Public Library Tech Lab'),
   'Coding Camp Assistant', 'Assist younger students during a summer coding camp, helping debug simple projects.', 'STEM', 15,
   'Public Library Tech Lab', 40.0612, -82.9988, '{weekday_morning}', '{coding,tutoring}', '{stem,education}', 'recurring', null, null),

  ((select id from organizations where name = 'City Arts Center'),
   'Community Mural Painter', 'Help paint a community mural celebrating local history and culture.', 'Arts & Culture', 13,
   'City Arts Center', 39.9612, -82.9688, '{saturday_afternoon}', '{design}', '{arts}', 'one_time', null, '2026-08-19'),

  ((select id from organizations where name = 'Community Learning Center'),
   'ESL Conversation Partner', 'Practice conversational English with adult English-language learners.', 'Education', 16,
   'Community Learning Center', 39.8412, -83.0988, '{weekday_evening}', '{public_speaking}', '{education,community}', 'recurring', null, '2026-08-25'),

  ((select id from organizations where name = 'City Rec Complex'),
   'Youth Soccer Coach Assistant', 'Help coach a youth recreational soccer team on weekend mornings.', 'Sports & Rec', 14,
   'City Rec Complex', 40.0112, -83.0488, '{saturday_morning}', '{}', '{sports}', 'recurring', null, null),

  ((select id from organizations where name = 'St. Anne''s Medical Center'),
   'Hospital Gift Shop Helper', 'Assist with inventory and customer service in the hospital gift shop.', 'Healthcare', 15,
   'St. Anne''s Medical Center', 39.8812, -82.9388, '{sunday_afternoon}', '{}', '{healthcare,community}', 'recurring', null, '2026-08-16'),

  ((select id from organizations where name = 'Elementary School Library'),
   'Bilingual Reading Buddy', 'Read with young bilingual students to support literacy in English and Spanish.', 'Education', 14,
   'Elementary School Library', 39.9812, -82.9788, '{weekday_afternoon}', '{spanish,tutoring}', '{education}', 'recurring', null, '2026-09-01'),

  ((select id from organizations where name = 'Sunset Neighborhood Park'),
   'Park Cleanup Day', 'One-day event picking up litter and restoring a neglected neighborhood park.', 'Environment', 13,
   'Sunset Neighborhood Park', 39.9512, -82.9988, '{saturday_morning}', '{}', '{environment,community}', 'one_time', null, '2026-08-17');
