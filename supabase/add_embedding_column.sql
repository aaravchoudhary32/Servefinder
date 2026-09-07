-- One-time migration for an existing database. Adds opportunities.embedding
-- (a 384-dim vector from Xenova/all-MiniLM-L6-v2, stored as jsonb since
-- similarity is computed in JS rather than in Postgres). Safe to re-run.
--
-- This only adds the column — it does NOT backfill existing rows. Run
-- `npm run embed:backfill` after applying this to populate embeddings
-- for opportunities that predate this feature.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.

alter table opportunities add column if not exists embedding jsonb;
