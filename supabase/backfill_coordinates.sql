-- One-time backfill: adds lat/long to opportunities seeded before the
-- distance-calc feature existed. Safe to run once against an existing
-- database that already ran the old seed.sql (matches by title, no
-- duplicates). Skip this if you're seeding a brand-new database — the
-- updated seed.sql already includes coordinates on insert.

update opportunities set latitude = 40.0047, longitude = -82.9988 where title = 'STEM Tutor';
update opportunities set latitude = 39.9612, longitude = -82.8488 where title = 'Trail Restoration Crew';
update opportunities set latitude = 39.9012, longitude = -83.0788 where title = 'Hospital Front Desk Helper';
update opportunities set latitude = 39.9412, longitude = -82.9988 where title = 'Animal Shelter Dog Walker';
update opportunities set latitude = 39.9612, longitude = -83.0488 where title = 'Food Bank Sorter';
update opportunities set latitude = 40.0612, longitude = -82.9988 where title = 'Coding Camp Assistant';
update opportunities set latitude = 39.9612, longitude = -82.9688 where title = 'Community Mural Painter';
update opportunities set latitude = 39.8412, longitude = -83.0988 where title = 'ESL Conversation Partner';
update opportunities set latitude = 40.0112, longitude = -83.0488 where title = 'Youth Soccer Coach Assistant';
update opportunities set latitude = 39.8812, longitude = -82.9388 where title = 'Hospital Gift Shop Helper';
update opportunities set latitude = 39.9812, longitude = -82.9788 where title = 'Bilingual Reading Buddy';
update opportunities set latitude = 39.9512, longitude = -82.9988 where title = 'Park Cleanup Day';
