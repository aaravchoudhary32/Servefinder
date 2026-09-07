-- Catalog-expansion Stage 2/3 registry: extends ingestion_sources with
-- the fields needed to track a real 200-source research pass (tier,
-- disposition, access method, priority, expected yield, teen-eligibility
-- evidence, duplicate risk, maintenance difficulty, connector family)
-- and records every source personally researched this run — both the
-- 2 newly built (Better Impact: Mesa + Gilbert) and the ~65 investigated-
-- but-not-yet-connected candidates, each with an honest disposition.
--
-- Safe to run on the existing database: every `add column if not
-- exists` is additive and nullable/defaulted, and every data statement
-- either UPDATEs an already-existing row (the 14 connectors already in
-- the registry) or INSERTs ... ON CONFLICT (source_name) DO UPDATE, so
-- this file is fully idempotent — re-running it changes nothing beyond
-- the first run.
--
-- Run this AFTER schema.sql and every other supabase/*.sql migration,
-- in the Supabase SQL editor.

-- ---------------------------------------------------------------------
-- 1. New ingestion_sources columns.
alter table ingestion_sources add column if not exists disposition text not null default 'needs_follow_up'
  check (disposition in ('approved_for_ingestion', 'manual_only', 'partnership_required', 'blocked', 'rejected', 'inactive', 'needs_follow_up'));
alter table ingestion_sources add column if not exists access_method text;
alter table ingestion_sources add column if not exists tier text check (tier in ('tier_1', 'tier_2', 'tier_3', 'tier_4'));
alter table ingestion_sources add column if not exists priority_score int;
alter table ingestion_sources add column if not exists expected_yield int;
alter table ingestion_sources add column if not exists teen_eligibility_evidence text;
alter table ingestion_sources add column if not exists duplicate_risk text;
alter table ingestion_sources add column if not exists maintenance_difficulty text check (maintenance_difficulty in ('low', 'medium', 'high'));
alter table ingestion_sources add column if not exists connector_family text;
alter table ingestion_sources add column if not exists disposition_reason text;
alter table ingestion_sources add column if not exists researched_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Backfill the 14 already-registered connectors' new fields, and
--    register every source from the Stage 2 research pass (personally
--    verified via direct WebFetch/robots.txt checks by 10 parallel
--    research passes plus manual follow-up, not fabricated). A handful
--    of "unresearched batch" rows stand in for named-but-not-yet-
--    individually-verified candidates where this session's shared
--    WebSearch budget ran out — tracked honestly as needs_follow_up,
--    never padded into a false approved_for_ingestion count.

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_4', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'arizona_science_center';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_2', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'az_game_fish';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'bgc_central_az';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'chesapeake_humane';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'chesapeake_public_library';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_1', connector_family = 'dedicated_api', access_method = 'undocumented_json_api', researched_at = now() where source_name = 'cityofphoenix';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'firewheel_stem';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'foodbank_seva';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'phoenixrescuemission';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_2', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'special_olympics_az';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'stmarysfoodbank';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = 'tier_3', connector_family = 'dedicated_scraper', access_method = 'permitted_html_extraction', researched_at = now() where source_name = 'vbspca';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = null, connector_family = 'manual_curation', access_method = 'manual_import', researched_at = now() where source_name = 'manual';

update ingestion_sources set disposition = 'approved_for_ingestion', tier = null, connector_family = 'manual_curation', access_method = 'manual_import', researched_at = now() where source_name = 'manual_curated';

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('City of Mesa', 'better_impact_mesa', 'https://app.betterimpact.com/PublicEnterprise/1927de80-881a-4c5c-ab9c-79ce376d17f7', 'approved_scraper', 'Mesa, AZ', array['Community Service','Arts & Culture','Sports & Rec'], false, 'approved_for_ingestion', 'permitted_html_extraction', 'tier_3', 8, 7, 'Platform''s own structured suitability facets: ''Suitable for youth 12-15'' and ''Suitable for youth 16 and over'', cross-checked against each listing''s own description text (which can state a stricter age than the facet — verified live and corrected in the connector).', 'low', 'medium', 'better_impact', 'Real, verified, structured, teen-tagged municipal volunteer platform. Built and staged live this run: 7 candidates.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Town of Gilbert', 'better_impact_gilbert', 'https://app.betterimpact.com/PublicEnterprise/bbe8c32a-b15c-4d80-8d48-f1f3bfe3fed6', 'approved_scraper', 'Gilbert, AZ', array['Community Service','Environment'], false, 'approved_for_ingestion', 'permitted_html_extraction', 'tier_4', 8, 2, 'Platform''s own structured suitability facets: ''Youth 14-16'' and ''Youth 16 and Over''. ''Youth with Supervision'' facet excluded — no parseable numeric age.', 'low', 'medium', 'better_impact', 'Same reusable connector as Mesa. Built and staged live this run: 2 candidates.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('DoSomething.org', 'dosomething', 'https://www.dosomething.org', 'manual_research', 'National', array['Community Service','Environment'], true, 'rejected', null, null, 2, null, 'Confirmed 13-25 (''over 1M active members ages 13-25'')', null, null, null, 'Campaigns are digital pledges/photo-proof actions, not discrete opportunities with location/schedule/application — data-model mismatch with ServeFinder''s listing shape.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('National Park Service (VIP Program)', 'nps_volunteer', 'https://www.nps.gov/subjects/volunteer', 'manual_research', 'Nationwide, 20+ AZ parks', array['Environment','Education'], false, 'needs_follow_up', 'permitted_html_extraction', 'tier_3', 6, null, 'Varies wildly by park; no central minimum age; most parks 16-18+, all minors need signed VSA', 'low', 'high', null, 'No central opportunity database — every AZ park (Grand Canyon, Saguaro, Petrified Forest, Casa Grande Ruins) has its own page/eligibility. Needs a per-park manual research pass, not one connector.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('United Way Worldwide', 'united_way_national', 'https://www.unitedway.org', 'manual_research', 'National, 1,100+ independent affiliates', array['Community Service'], false, 'rejected', null, null, 1, null, 'Not centrally documented', null, null, null, 'Explicitly decentralized — no unified database across local United Way affiliates.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Habitat for Humanity (national)', 'habitat_national', 'https://www.habitat.org', 'manual_research', 'National, independent local affiliates', array['Community Service'], false, 'rejected', null, null, 3, null, '16+ confirmed, parental consent 16-17, adult supervision required, restricted from power tools', null, null, null, 'Decentralized like United Way — no central feed. A specific ''Habitat for Humanity Central Arizona'' local affiliate is a real candidate for future manual research.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Key Club International (Kiwanis)', 'key_club', 'https://www.keyclub.org', 'manual_research', 'National, school-chapter based', array['Community Service'], false, 'rejected', null, null, 1, null, 'Not centrally published; membership-based', null, null, null, 'Chapter/membership-join model, not individual browsable opportunities.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Best Buddies International', 'best_buddies_national', 'https://www.bestbuddies.org', 'manual_research', 'National, school-chapter based', array['Community Service','Education'], false, 'rejected', null, null, 2, null, 'Middle/high school chapters exist; parent signature required under 18', null, null, null, 'Chapter-membership shape, no discrete listings to scrape. See best_buddies_az for the manual-curation candidate.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Big Brothers Big Sisters of America', 'bbbs_national', 'https://www.bbbs.org', 'manual_research', 'National, independent local agencies', array['Education','Community Service'], false, 'rejected', null, null, 1, null, 'Mostly 18+; some site-based programs allow 16-17 with parent permission, varies by chapter', null, null, null, 'Decentralized, inconsistent eligibility across chapters.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Ronald McDonald House Charities (national)', 'rmhc_national', 'https://www.rmhc.org', 'manual_research', 'National umbrella', array['Healthcare','Community Service'], false, 'rejected', null, null, 2, null, 'Varies 14-18 by chapter', null, null, null, 'Decentralized. See rmhc_central_northern_az for the real, verified local chapter.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('RMHC of Central/Northern Arizona', 'rmhc_central_northern_az', 'https://ronaldmcdonaldhousecnaz.org/get-involved/volunteer/', 'manual_research', 'Phoenix, AZ', array['Healthcare','Community Service'], false, 'manual_only', 'manual_import', 'tier_4', 7, 7, 'Confirmed: ''Individuals must be at least 16 years old to become a House Volunteer''', 'low', 'low', 'manual_curation', '7 distinct real roles (Dinnertime Heroes, Baked With Love, Individual House Volunteers, Event Volunteers, Seasonal Decor, Sweet Treat Bakers, Off-Site Kit Creators), but no portal/application URL per role — contact-only (email). Recommended: hand-enter as manual_curated records.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Random Acts (Random Acts of Kindness Foundation)', 'random_acts', 'https://randomacts.org', 'manual_research', 'Global, virtual', array['Community Service'], true, 'rejected', null, null, 1, null, 'Not age-specific; loose ambassador model', null, null, null, 'Campaign-style, same data-model mismatch as DoSomething — not discrete opportunities.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Team Rubicon', 'team_rubicon', 'https://rollcall.teamrubiconusa.org/all-activities/', 'manual_research', 'National, disaster response', array['Community Service','Environment'], false, 'needs_follow_up', 'needs_follow_up', 'tier_3', 5, null, '16+ confirmed, with signed parent/guardian waiver', 'low', 'medium', null, 'Real ''Roll Call'' portal exists but structure/login requirement not confirmed this pass.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('JustServe.org', 'justserve', 'https://www.justserve.org', 'manual_research', 'Nationwide', array['Community Service','Environment','Education'], true, 'needs_follow_up', 'structured_feed', 'tier_1', 6, null, 'Promotes teen involvement (Global Youth Service Day) but no universal minimum age — varies per posted project', 'medium', 'medium', null, 'Structurally strong (permissive robots.txt, real sitemap, individual project pages, api.justserve.org referenced) but it''s a shared multi-org community bulletin board, not one organization''s own site — needs an explicit provenance policy decision before treating as first-party, same question this codebase already resolved differently for aggregators like VolunteerMatch/Idealist (excluded).', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('American Heart Association', 'american_heart_association_volunteer', 'https://www.heart.org', 'manual_research', 'National, local chapters', array['Healthcare','Community Service'], false, 'needs_follow_up', 'needs_follow_up', 'tier_3', 5, null, 'Confirmed 13+ (''starting at age 13''); American Heart Challenge is the teen-appropriate program', null, null, null, 'Confirmed age-eligible and real, but no discrete opportunity listing page found this pass.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Meals on Wheels America', 'meals_on_wheels_national', 'https://www.mealsonwheelsamerica.org', 'manual_research', 'National umbrella, decentralized', array['Community Service','Healthcare'], false, 'rejected', null, null, 1, null, 'Wildly inconsistent by chapter (13-18 across different chapters, several require 18+)', null, null, null, 'Fully decentralized, inconsistent eligibility.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('National FFA Organization', 'national_ffa', 'https://www.ffa.org', 'manual_research', 'National, school-chapter based', array['Environment','Community Service','Education'], false, 'rejected', null, null, 1, null, 'School-based chapter membership', null, null, null, 'Chapter/membership model, not discrete opportunities.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('HeadCount', 'headcount', 'https://www.headcount.org/volunteer', 'manual_research', 'National', array['Community Service'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not found — no minimum age stated anywhere on the volunteer page', null, null, null, 'Eligibility unconfirmed per the never-infer rule; also unclear if events are individually listed with dates/locations.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Youth Service America (YSA)', 'youth_service_america', 'https://ysa.org', 'manual_research', 'National', array['Community Service'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not verified this session', null, null, null, 'Technical fetch failure (SSL handshake error) this session, not a policy rejection — retry needed. Likely runs Global Youth Service Day and grants rather than a live opportunity database.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Maricopa County Animal Care & Control', 'maricopa_county_animal_care_control', 'https://www.maricopa.gov/294/Volunteer', 'manual_research', 'Maricopa County, AZ', array['Animals'], false, 'manual_only', 'manual_import', 'tier_3', 6, 8, 'Explicit: 18+ generally, but ''younger individuals aged 15-17 may participate if they attend training alongside a parent or guardian''', 'low', 'medium', 'manual_curation', 'Single program-application page (fostering + shelter roles), not a per-listing feed — good manual-record candidate, not worth a dedicated scraper.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Maricopa County Parks & Recreation', 'maricopa_county_parks', 'https://www.maricopacountyparks.net/get-involved/how-to-volunteer/', 'manual_research', 'Maricopa County, AZ', array['Environment','Community Service'], false, 'manual_only', 'manual_import', 'tier_4', 4, null, 'Minors welcome with parent/guardian waiver signature; no explicit age floor published', 'low', 'medium', null, 'Opportunities subpage was an unpopulated template at check time; roles (Trail Ambassador, Desert Defender Steward, Park Host) described generically, not itemized.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Arizona State Parks — Open Volunteer Positions', 'az_state_parks_volunteer', 'https://azstateparks.com/Open-Volunteer-Positions', 'manual_research', 'Arizona statewide', array['Environment','Education','Community Service'], false, 'needs_follow_up', 'permitted_html_extraction', 'tier_2', 7, 40, 'Unconfirmed — no minimum age stated on this page; scout/service-learning groups mentioned but no explicit individual-applicant teen policy', 'low', 'medium', null, 'Real structured per-park/per-role tables (~40 distinct positions), but teen eligibility must be confirmed directly (contact crichards@azstateparks.gov) before any record is marked teen-verified.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('City of Tempe — Summer Youth Volunteer Program', 'tempe_syvp', 'https://www.tempe.gov/government/community-services/volunteer', 'manual_research', 'Tempe, AZ', array['Community Service','Education'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 6, null, 'Explicit: separate application track for ages 17 and younger; SYVP ''open to middle and high school students''', 'low', 'medium', null, 'WebFetch returned HTTP 403 (same WAF pattern already solved for City of Phoenix/Special Olympics AZ via Playwright) — needs a real-browser access check. Currently seasonal (2026 cycle full, recruitment for 2027 begins April).', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Gilbert Mayor''s Youth Advisory Committee', 'gilbert_myac', 'https://www.gilbertaz.gov/residents/town-programs/mayor-s-youth-advisory-council', 'manual_research', 'Gilbert, AZ', array['Community Service'], false, 'manual_only', 'manual_import', 'tier_4', 5, 1, 'Explicit, ages 14-18, high schoolers only, requires 15 hrs/year community service', 'low', 'low', 'manual_curation', 'One real program, not a listing feed.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Scottsdale Parks & Recreation — Teen Volunteer Program', 'scottsdale_parks_teen_volunteer', 'https://www.scottsdaleaz.gov/volunteer/parks-and-recreation---teen-volunteer-program', 'manual_research', 'Scottsdale, AZ', array['Community Service','Sports & Rec'], false, 'manual_only', 'manual_import', 'tier_4', 5, 1, 'Explicit, ages 14-17, summer camp mentoring/leadership roles', 'low', 'low', 'manual_curation', 'Single seasonal program (interviews begin ~April).', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Scottsdale Public Library — Teen Volunteers', 'scottsdale_library_teen_volunteer', 'https://www.scottsdalelibrary.org/get-involved/teen-volunteers', 'manual_research', 'Scottsdale, AZ', array['Education','Community Service'], false, 'manual_only', 'manual_import', 'tier_4', 4, 2, 'Confirmed: ''at least 14 and not yet 18'', parent/guardian permission required', 'low', 'low', 'manual_curation', 'Two seasonal tracks (School Year, Summer), single Cognito Forms application — not a distinct-listing source.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Chandler Public Library — Teen Volunteer Program', 'chandler_library_teen_volunteer', 'https://chandlerlibrary.org/volunteer/', 'manual_research', 'Chandler, AZ', array['Education'], false, 'manual_only', 'manual_import', 'tier_4', 4, 1, 'Explicit, ages 13-17, weekly-shift commitment', 'low', 'low', 'manual_curation', 'Single seasonal program.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Tempe Public Library — Teens 12-18', 'tempe_library_teens', 'https://www.tempepubliclibrary.org/youth-teens/teens-12-18', 'manual_research', 'Tempe, AZ', array['Education'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 4, null, 'Grades 6-12 per third-party summary; page itself returned HTTP 403', null, null, null, 'Same WAF 403 pattern as other .gov domains — needs a Playwright-based check.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Mesa Public Library — Volunteer Program', 'mesa_library_volunteer', 'https://www.mesalibrary.org/about/volunteer', 'manual_research', 'Mesa, AZ', array['Education'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 4, null, 'Confirmed elsewhere: at least 14 (14-17 requires signed parent/guardian waiver); page itself returned HTTP 403', null, null, null, '403''d on direct fetch (same WAF pattern); a ''volunteer-job-descriptions'' sub-page may list multiple distinct roles, unconfirmed.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('ICAN (I Can Achieve Naturally), Chandler', 'ican_chandler', 'https://www.icanaz.org/volunteer/', 'manual_research', 'Chandler, AZ', array['Community Service','Education'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 3, null, 'Nonprofit serving Chandler youth/families; volunteers 16+', null, null, null, 'Not yet checked for listing structure.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched AZ gov batch (Glendale, Peoria, Surprise, Tucson, Flagstaff libraries/parks; AZ State Library; Maricopa County Recorder poll-worker; AZ Historical Society; ADEQ citizen-science; CASA; MCDOT Adopt-a-Highway; Medical Reserve Corps; county fair)', 'az_azgov_unresearched_batch_1', 'n/a — batch placeholder, see disposition_reason', 'manual_research', 'Arizona statewide', '{}', false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not researched this pass', null, null, null, 'WebSearch budget exhausted before these could be investigated; several .gov domains 403 to generic fetchers (same WAF pattern solved elsewhere via Playwright). Genuine follow-up candidates, not fabricated findings — this single registry row stands in for ~13 unresearched Arizona government sources pending a dedicated follow-up pass.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Musical Instrument Museum (MIM), Phoenix', 'mim_phoenix', 'https://mim.org/ways-to-give/volunteer/', 'manual_research', 'Phoenix, AZ', array['Arts & Culture'], false, 'manual_only', 'manual_import', 'tier_4', 3, 1, 'Confirmed minimum age 16, parental consent under 18. Safety caveat: background check AND drug test required.', 'low', 'low', 'manual_curation', 'Single program (two commitment tracks), not a multi-listing source.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Phoenix Art Museum', 'phoenix_art_museum', 'https://phxart.org/get-involved/teen-programs/', 'manual_research', 'Phoenix, AZ', array['Arts & Culture'], false, 'rejected', null, null, 1, null, 'General volunteering is 18+; the one teen program (Teen Art Council) is paid, not volunteer, and currently on hiatus', null, null, null, 'No current teen volunteer opportunity exists.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Heard Museum', 'heard_museum', 'https://heard.org', 'manual_research', 'Phoenix, AZ', array['Arts & Culture'], false, 'rejected', null, null, 1, null, 'Only found an adult membership/volunteer group (Heard Museum Guild); no teen-specific program surfaced', null, null, null, 'No evidence teens 13-18 are eligible.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('i.d.e.a. Museum, Mesa', 'idea_museum_mesa', 'https://www.ideamuseum.org/volunteer', 'manual_research', 'Mesa, AZ', array['Arts & Culture','Education'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 4, null, 'Confirmed via third-party (JustServe) as ''Teen and Adult''; two named roles (Programming Assistant, Gallery Assistant)', null, null, null, 'Email-based application (not self-service) — likely manual_only even after further check, worth confirming page structure.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('S''edav Va''aki Museum (formerly Pueblo Grande Museum), Phoenix', 'sedav_vaaki_museum', 'https://www.phoenix.gov/administration/departments/sedav-vaaki/support-sedav-vaaki/volunteer.html', 'manual_research', 'Phoenix, AZ', array['Education','Arts & Culture'], false, 'manual_only', 'manual_import', 'tier_4', 5, 1, 'Confirmed explicit annual Teen Volunteer Program, ages 14-17, seasonal (fall/spring) application cycles', 'low', 'low', 'manual_curation', 'Single seasonal cohort program.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('volunteer.phoenix.gov (City of Phoenix''s own dedicated multi-department portal)', 'volunteer_phoenix_gov', 'https://volunteer.phoenix.gov/', 'manual_research', 'Phoenix, AZ', array['Community Service'], false, 'needs_follow_up', 'needs_follow_up', 'tier_1', 7, null, 'Not yet confirmed', 'medium', 'medium', null, 'URL pattern (/custom/501/opp_details/{id}) strongly resembles a Galaxy Digital ''Get Connected'' platform with real per-opportunity IDs — same family as AZ Game & Fish''s already-working connector, and possibly a richer/different data source than the existing cityofphoenix connector''s own endpoint. Blocked from direct verification (403); recommend a Playwright-based follow-up check — potentially the single highest-value unresolved lead from this whole research pass.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched libraries/museums batch (Mesa Arts Center, Chandler Center for the Arts, Tempe Center for the Arts, Arizona-Sonora Desert Museum, Lowell Observatory, Glendale/Peoria/Gilbert/Chandler library systems, Phoenix Zoo, Tucson-area museums)', 'az_libraries_museums_unresearched_batch', 'n/a — batch placeholder', 'manual_research', 'Arizona statewide', '{}', false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not researched this pass', null, null, null, 'WebSearch budget exhausted before these could be investigated. Genuine follow-up candidates — this single registry row stands in for ~12 unresearched sources.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Ability360', 'ability360', 'https://ability360.org/volunteer/', 'manual_research', 'Phoenix, AZ', array['Healthcare','Community Service'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 4, null, 'Not stated anywhere on the page for any of its 4 named roles (Peer Mentor, Sports & Fitness Center Volunteer, Special Events Volunteer, Board Member)', null, null, null, 'Real, structured, multi-role org, but teen eligibility unconfirmed — would need direct contact before any record could be marked teen-verified.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Vitalant (blood donation, multi-region incl. AZ)', 'vitalant', 'https://www.vitalant.org/volunteer', 'manual_research', 'Multi-region incl. AZ', array['Healthcare'], false, 'needs_follow_up', 'partnership_required', 'tier_4', 3, null, 'Not stated', null, null, null, 'Real, multi-role, but no age evidence found and application is login-gated (vitalant.volunteerportal.org) — not scrapable even if eligibility confirms.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Foundation for Blind Children (Arizona)', 'foundation_for_blind_children', 'https://www.seeitourway.org/volunteer', 'manual_research', 'Phoenix, AZ', array['Healthcare','Community Service'], false, 'rejected', null, null, 1, null, 'No minimum age stated, no enumerated roles', null, null, null, 'Single generic Microsoft Forms interest form — nothing here is a distinct, listable opportunity.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Hospice of the Valley — Teen Volunteering / Teens in Nursing', 'hospice_of_the_valley_teen_programs', 'https://www.hospiceofthevalley.org/volunteer/', 'manual_research', 'Phoenix, AZ', array['Healthcare'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 5, null, 'Two explicit under-18-eligible sub-programs found (''Teen Volunteering'', ''Teens in Nursing''), application via pm.healthcaresource.com', null, null, null, 'Already in ServeFinder''s manual_curated catalog under the general org record — flag only: worth checking whether the existing record captures these two teen-specific sub-programs distinctly, or only the generic adult-companion role.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched biomedical batch (Maricopa County Dept. of Public Health, Valleywise Health, Abrazo Health, and ~15 more)', 'az_biomedical_unresearched_batch', 'n/a — batch placeholder', 'manual_research', 'Arizona statewide', array['Healthcare'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not researched this pass', null, null, null, 'WebSearch budget exhausted; direct-URL guessing alone couldn''t surface new organizations not already known by name. This single registry row stands in for ~16 unresearched sources.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Tucson Bird Alliance (formerly Tucson Audubon)', 'tucson_bird_alliance', 'https://tucsonbirds.org/volunteer/', 'manual_research', 'Tucson, AZ', array['Environment','Animals'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 3, null, 'Not stated', null, null, null, 'Generic ''diverse volunteer opportunities'' page, no per-role structure, eligibility unconfirmed.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Arizona Conservation Corps — Local Youth Crews (Summer YCC)', 'arizona_conservation_corps_ycc', 'https://azcorps.org/local-youth-crews', 'manual_research', 'Flagstaff/Payson/Globe/Prescott, AZ', array['Environment'], false, 'rejected', null, null, 1, null, '17-20 only, rolling application', null, null, null, 'Appears to be paid seasonal employment, not casual volunteering; minimal overlap with the 13-18 target range.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Watershed Management Group', 'watershed_management_group', 'https://www.watershedmg.org/volunteer', 'manual_research', 'Tucson, AZ', array['Environment'], false, 'needs_follow_up', 'needs_follow_up', 'tier_3', 5, 7, 'Not stated', null, null, null, '7 named distinct programs (Living Lab Caretaker, Community Science, Creek Cleanups, Board Service, Docent Program, Flow365 Monitors, River Run Network), but single generic interest form (no per-program URLs) and eligibility unconfirmed.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('McDowell Sonoran Conservancy', 'mcdowell_sonoran_conservancy', 'https://mcdowellsonoran.org/volunteering/', 'manual_research', 'Scottsdale, AZ', array['Environment'], false, 'needs_follow_up', 'partnership_required', 'tier_4', 4, null, 'Page mentions ''students... can participate'' — not a confirmed numeric policy', null, null, null, 'Application via a login-gated steward portal (steward.mcdowellsonoran.org).', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('NASA GLOBE Observer', 'nasa_globe_observer', 'https://observer.globe.gov/', 'manual_research', 'Global/nationwide-virtual', array['Environment','STEM'], true, 'manual_only', 'manual_import', 'tier_4', 6, 1, 'No minimum age stated on the app/program itself — same open-access shape as Zooniverse (already in ServeFinder)', 'low', 'low', 'manual_curation', 'Continuous citizen-science app (cloud/mosquito/land-cover/tree/eclipse observations), not a discrete scheduled opportunity — good single hand-curated record, same convention as Zooniverse. Ready now, no further research needed.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Trees Matter', 'trees_matter', 'https://treesmatter.org/volunteer/', 'manual_research', 'Phoenix/Mesa, AZ', array['Environment'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 5, 5, 'Not stated for any of the 5 named programs', null, null, null, '5 distinct programs, one using a real dated-shift portal (Bloomerang) worth a technical scrapability check; school-planting program requires a background check.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Grand Canyon Trust', 'grand_canyon_trust', 'https://www.grandcanyontrust.org/volunteer', 'manual_research', 'Grand Canyon/Colorado Plateau, AZ+UT+CO+NM', array['Environment'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 3, null, '18+ to volunteer independently; under-18 must be physically accompanied by an adult. Separate ''Rising Leaders Program'' (ages 15-30, advocacy-focused) is the real teen-relevant track.', null, null, null, '$25 membership required to participate; cost + mandatory-accompaniment caveats need a human judgment call. Flag Rising Leaders sub-program specifically for separate research.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Spaces of Opportunity (Phoenix community garden/urban ag)', 'spaces_of_opportunity', 'https://spacesofopportunity.org', 'manual_research', 'Phoenix, AZ', array['Environment','Community Service'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not stated', null, null, null, 'Page was JS-rendered/empty on plain fetch — needs a Playwright-based re-check.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched environment batch (Sierra Club Grand Canyon Chapter, eBird/Cornell Lab, Maricopa County Parks trail specifics, Nature Conservancy AZ chapter, Arizona Trail Association, Sonoran Institute, Keep Phoenix Beautiful, community gardens, Local First AZ)', 'az_environment_unresearched_batch', 'n/a — batch placeholder', 'manual_research', 'Arizona statewide', array['Environment'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not researched this pass', null, null, null, 'WebSearch budget exhausted. This single registry row stands in for ~12 unresearched sources.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Liberty Wildlife', 'liberty_wildlife', 'https://libertywildlife.org/education/youth-programs/', 'manual_research', 'Phoenix, AZ', array['Animals','Environment'], false, 'approved_for_ingestion', 'permitted_html_extraction', 'tier_4', 7, 9, 'Confirmed, explicit ''Teen Volunteer Program,'' ages 13-17; tiered by role (raptor handling 18+, Orphan Care 16+ seasonal, general Teen/Youth Programs 13-17)', 'low', 'medium', null, '11 distinct named roles, permissive robots.txt + sitemap. Strongest unimplemented candidate from the animals bucket — recommended next connector to build.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('HALO Rescue', 'halo_rescue', 'https://www.halorescue.org/volunteer', 'manual_research', 'Phoenix metro, AZ', array['Animals'], false, 'approved_for_ingestion', 'permitted_html_extraction', 'tier_4', 6, 9, 'Confirmed: ''Must be at least 16 years old''', 'low', 'medium', null, '9 distinct named roles on the main site; application via a separate TracOrp portal not itself scraped. Second-strongest unimplemented candidate.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Southwest Wildlife Conservation Center', 'southwest_wildlife_conservation_center', 'https://southwestwildlife.org/volunteer/', 'manual_research', 'Scottsdale/Phoenix, AZ', array['Animals','Environment'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 4, null, 'Unconfirmed — no minimum age published', null, null, null, '6 real named roles, but eligibility unconfirmed (do not mark teen-verified); $50 application fee noted for when/if used.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched animals batch (Arizona Humane Society — 307 redirect/WAF-blocked, Phoenix Zoo — needs correct URL, Tucson Wildlife Center, other Valley horse rescues)', 'az_animals_unresearched_batch', 'n/a — batch placeholder', 'manual_research', 'Arizona statewide', array['Animals'], false, 'needs_follow_up', 'needs_follow_up', null, 4, null, 'Not researched this pass', null, null, null, 'Arizona Humane Society hit a WAF/redirect-loop pattern needing a Playwright check; Phoenix Zoo''s guessed URL 404''d. This single registry row stands in for ~9 unresearched sources.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Phoenix Union High School District — Volunteer at Our Schools', 'phoenix_union_hsd_volunteer', 'https://www.pxu.org/page/volunteer-at-our-schools', 'manual_research', 'Phoenix, AZ', array['Education'], false, 'rejected', null, null, 1, null, 'Explicit disqualifier: ''Volunteers must be at least 21 years of age and be high school graduates or have earned GED credentials.''', null, null, null, '21+ requirement — no teen eligibility possible.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Big Brothers Big Sisters of Central Arizona', 'bbbs_central_az', 'https://bbbsaz.org/volunteer/', 'manual_research', 'Phoenix, AZ', array['Education','Community Service'], false, 'rejected', null, null, 1, null, 'Explicit disqualifier: ''Be at least 18 years old.''', null, null, null, 'No teen mentor track exists.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Literacy Connects / Reading Seed (Tucson)', 'literacy_connects_tucson', 'https://literacyconnects.org/volunteer/', 'manual_research', 'Tucson, AZ', array['Education'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'No minimum age published; requires fingerprint clearance + 8 hours training (typically adult-oriented, but not stated as 18+)', null, null, null, 'Single generic Google Form sign-up, no discrete listings even if eligibility confirms.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Free Arts for Abused Children of Arizona', 'free_arts_az', 'https://freeartsaz.org/volunteer/', 'manual_research', 'Phoenix, AZ', array['Arts & Culture','Education'], false, 'blocked', null, null, 1, null, 'Not checked — site inaccessible', null, null, null, 'Both the volunteer page and root domain returned HTTP 403 Forbidden — active bot-blocking. Do not attempt to bypass; manual research/entry only if pursued.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Valley of the Sun YMCA — Volunteer', 'valley_of_the_sun_ymca', 'https://www.valleyymca.org/volunteer', 'manual_research', 'Phoenix metro, AZ', array['Community Service','Sports & Rec','Education'], false, 'rejected', null, null, 1, null, 'No minimum age stated', null, null, null, 'Six generic categories behind one inline interest form — no discrete opportunity listings, no per-item titles/URLs/dates.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Homework House', 'homework_house', 'https://www.homeworkhouse.org/volunteer', 'manual_research', 'Phoenix, AZ', array['Education'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not verified — page returned empty content (likely JS-rendered or wrong path)', null, null, null, 'Real org (Phoenix afterschool tutoring nonprofit) but page not verifiable this pass.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Be A Leader Foundation', 'be_a_leader_foundation', 'https://www.bealeaderfoundation.org', 'manual_research', 'Phoenix, AZ', array['Education'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not verified — guessed URL 404''d', null, null, null, 'Real org, needs the correct URL located via search.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Schoolhouse.world', 'schoolhouse_world', 'https://schoolhouse.world/', 'manual_research', 'Nationwide, virtual', array['Education'], true, 'manual_only', 'manual_import', 'tier_4', 6, 1, 'Confirmed: site explicitly describes tutors as ''high school students just like you''', 'low', 'low', 'manual_curation', 'One ongoing Zoom-based tutoring program, no discrete dated listings/public calendar — good single hand-curated record, same convention as UPchieve/Learn To Be. Ready now.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Best Buddies Arizona — High School Chapter Program', 'best_buddies_az', 'https://www.bestbuddies.org/arizona/friendship', 'manual_research', 'Arizona statewide', array['Community Service','Education'], false, 'manual_only', 'manual_import', 'tier_4', 4, null, 'Genuine teen program by construction (''Best Buddies High Schools'' — one-to-one friendships between high school students with and without IDD); no numeric minimum age published', 'low', 'low', null, 'Decentralized — each AZ high school is its own chapter with its own registration link, no central browsable list. Strong manual_curated candidate (one ''join your school''s chapter'' record) but not yet added — flagged for a deliberate decision given the lack of a precise numeric age floor.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('United Food Bank', 'united_food_bank', 'https://unitedfoodbank.org/volunteer/', 'manual_research', 'Mesa/East Valley, AZ', array['Community Service'], false, 'manual_only', 'manual_import', 'tier_4', 5, null, 'Confirmed: ages 5-15 may volunteer at emergency food-bag shifts; ages 16-17 may volunteer independently with a signed parent/guardian waiver', 'low', 'low', 'manual_curation', 'Account-required shift scheduler (recurring shifts, not discrete dated listings) — 1-3 hand-curated records, not a scraper target.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('UMOM New Day Centers', 'umom_new_day_centers', 'https://umom.vomo.org/org/umom', 'manual_research', 'Phoenix, AZ', array['Community Service'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 6, 3, 'Confirmed per-listing: ''Queen of Hearts Casino Royale Gala Prep'' (15+), ''Residential Dining Volunteer'' (15+), ''Clothing Closet Restock'' (8+)', 'low', 'medium', 'vomo', 'Real structured platform (VOMO) with per-opportunity IDs and confirmed ages, but account creation is required to see full listings — unclear if a public unauthenticated feed exists. Worth checking whether other Arizona nonprofits also run on VOMO, same reusable-platform pattern as Better Impact.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Andre House', 'andre_house', 'https://andrehouse.org/volunteer/', 'manual_research', 'Phoenix, AZ', array['Community Service'], false, 'needs_follow_up', 'partnership_required', null, 3, null, 'Not found on the page', null, null, null, 'Platform is VolunteerHub (andrehouse.volunteerhub.com); eligibility unconfirmed, do not treat as teen-eligible without direct confirmation.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched food-insecurity batch (Waste Not AZ, St. Vincent de Paul Phoenix, Homeward Bound AZ, and ~9 more)', 'az_food_insecurity_unresearched_batch', 'n/a — batch placeholder', 'manual_research', 'Arizona statewide', array['Community Service'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not researched this pass', null, null, null, 'WebSearch budget exhausted; two guessed URLs (Waste Not AZ, St. Vincent de Paul Phoenix) 404''d and are not treated as real findings. This single registry row stands in for ~9-11 unresearched sources.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('AllThrive 365 (formerly Duet: Partners in Health & Aging / Foundation for Senior Living)', 'allthrive365', 'https://allthrive365.org/volunteer/', 'manual_research', 'Phoenix/Glendale/Tempe/Peoria/Wickenburg, AZ', array['Community Service','Healthcare'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 4, null, 'Not specified anywhere on the page for any of its 8 named roles; several involve driving or one-on-one homebound-senior contact', null, null, null, 'Real, structured, multi-role org, but teen eligibility must be confirmed directly; if confirmed 18+ only (plausible given background-check/driving pattern), disposition becomes rejected. Note: Duet and Foundation for Senior Living both redirect here — do not register as 3 separate sources.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Area Agency on Aging, Region One', 'area_agency_on_aging_region_one', 'https://www.aaaphx.org/volunteer', 'manual_research', 'Phoenix, AZ', array['Community Service','Healthcare'], false, 'needs_follow_up', 'needs_follow_up', 'tier_4', 3, null, 'Not specified for any of its 5 named roles', null, null, null, 'No structured listing to scrape regardless (contact-only); several roles (benefits counseling, nursing-home advocacy) plausibly skew adult-only but this is not stated.', now())
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();

insert into ingestion_sources (org_name, source_name, first_party_url, source_type, geographic_coverage, categories, includes_virtual, disposition, access_method, tier, priority_score, expected_yield, teen_eligibility_evidence, duplicate_risk, maintenance_difficulty, connector_family, disposition_reason, researched_at)
values ('Unresearched senior/disability batch (Meals on Wheels Central Arizona, CASA, nationwide-virtual senior-companionship platforms, other Valley disability-services nonprofits)', 'az_senior_disability_unresearched_batch', 'n/a — batch placeholder', 'manual_research', 'Arizona statewide + nationwide-virtual', array['Community Service','Healthcare'], false, 'needs_follow_up', 'needs_follow_up', null, 3, null, 'Not researched this pass', null, null, null, 'WebSearch budget exhausted; one guessed URL (Meals on Wheels Central Arizona) 404''d. This single registry row stands in for ~11 unresearched sources.', null)
on conflict (source_name) do update set
  org_name = excluded.org_name, first_party_url = excluded.first_party_url, geographic_coverage = excluded.geographic_coverage,
  categories = excluded.categories, includes_virtual = excluded.includes_virtual, disposition = excluded.disposition,
  access_method = excluded.access_method, tier = excluded.tier, priority_score = excluded.priority_score,
  expected_yield = excluded.expected_yield, teen_eligibility_evidence = excluded.teen_eligibility_evidence,
  duplicate_risk = excluded.duplicate_risk, maintenance_difficulty = excluded.maintenance_difficulty,
  connector_family = excluded.connector_family, disposition_reason = excluded.disposition_reason,
  researched_at = excluded.researched_at, updated_at = now();