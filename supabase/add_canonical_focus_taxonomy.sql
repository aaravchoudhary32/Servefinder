-- Canonical 10-category focus taxonomy (see lib/interestTaxonomy.ts).
-- Widens profiles.interests's CHECK constraint additively to allow every
-- new canonical broad tag and focus value, plus keeps every legacy value
-- valid (aliases and retired values still need to pass this constraint,
-- since existing profile rows already contain them and this migration
-- never rewrites stored rows).
--
-- This is a strict superset of the constraint in schema.sql /
-- add_stem_subtag_taxonomy.sql / add_business_interest_taxonomy.sql: all
-- 28 previously-valid values are included unchanged below (verified
-- programmatically against lib/interestTaxonomy.ts's
-- ALL_VALID_INTEREST_VALUES before writing this file). No existing
-- profile row can violate the new constraint, since nothing is removed.
--
-- What this migration does NOT do, by design:
-- - Does not touch opportunities.interests_tags or opportunities.category
--   at all — those columns are unconstrained free text already (see
--   schema.sql), so opportunity-side tagging with new focus values needs
--   no schema change.
-- - Does not rewrite any existing profiles.interests row to replace a
--   legacy value (e.g. 'computer_science') with its new canonical
--   equivalent ('cs_software_engineering'). That reclassification happens
--   transparently at match time via resolveCanonicalFocus() in
--   lib/matching.ts — this migration only widens what's a *valid* value
--   to store, so both the legacy alias and its canonical replacement
--   remain independently valid.
-- - Does not retire any value outright. 'stem_leadership' (demoted from
--   selectable focus to legacy/skill tag in onboarding) still needs to
--   pass this constraint for any student profile that already has it.
--
-- Run this AFTER schema.sql, add_stem_subtag_taxonomy.sql, and
-- add_business_interest_taxonomy.sql, in the Supabase SQL editor.
--
-- Safe to run on a database with existing rows: this is a strict
-- superset of the prior constraint, so no existing row can violate it.
-- (If you want to double-check first anyway, this guard should return
-- zero rows both before and after this migration — it uses the exact
-- new array below.)

-- select user_id, interests
-- from profiles
-- where not (interests <@ array[
--     'stem','healthcare','education','business','environment','animals',
--     'community','arts','government_law','sports','cs_software_engineering','data_science_ai',
--     'cybersecurity','electrical_computer_engineering','mechanical_engineering','civil_engineering','environmental_engineering','chemical_engineering',
--     'chemistry','physics_astronomy','biology_biotechnology','mathematics_statistics','robotics','aerospace_engineering',
--     'architecture_design_engineering','general_engineering','medicine_physician','nursing','dentistry','pharmacy',
--     'veterinary_medicine','physical_therapy','occupational_therapy','psychology_mental_health','public_health','biomedical_research',
--     'emergency_medicine_first_aid','nutrition_wellness','healthcare_administration','early_childhood_education','elementary_education','secondary_education',
--     'special_education','literacy','stem_education','college_career_readiness','youth_mentoring','educational_technology',
--     'entrepreneurship','finance','economics','marketing','management_operations','nonprofit_management',
--     'human_resources','information_systems','event_planning','social_innovation','environmental_science','conservation',
--     'climate_sustainability','ecology','marine_science','agriculture_food_systems','parks_outdoor_stewardship','recycling_waste_reduction',
--     'veterinary_interests','animal_shelters','wildlife_conservation','animal_welfare','zoology','marine_wildlife',
--     'animal_assisted_services','food_security','housing_homelessness','disability_support','senior_support','youth_services',
--     'disaster_preparedness','immigrant_refugee_support','community_development','visual_arts','music','theater_performing_arts',
--     'writing_journalism','photography_film','graphic_design','museums_history','digital_media','social_media_communications',
--     'law_legal_services','government_public_administration','public_policy','civic_engagement','human_rights','voter_education',
--     'international_relations','criminal_justice','advocacy_community_organizing','coaching','youth_sports','adaptive_sports',
--     'recreation_programs','sports_management','event_support','outdoor_recreation','health_fitness_education','computer_science',
--     'software_engineering','data_science','artificial_intelligence','computer_engineering','electrical_engineering','semiconductor_engineering',
--     'quantum_computing','stem_leadership'
-- ]::text[]);

alter table profiles drop constraint if exists profiles_interests_valid_tags;
alter table profiles add constraint profiles_interests_valid_tags
  check (interests <@ array[
    'stem','healthcare','education','business','environment','animals',
    'community','arts','government_law','sports','cs_software_engineering','data_science_ai',
    'cybersecurity','electrical_computer_engineering','mechanical_engineering','civil_engineering','environmental_engineering','chemical_engineering',
    'chemistry','physics_astronomy','biology_biotechnology','mathematics_statistics','robotics','aerospace_engineering',
    'architecture_design_engineering','general_engineering','medicine_physician','nursing','dentistry','pharmacy',
    'veterinary_medicine','physical_therapy','occupational_therapy','psychology_mental_health','public_health','biomedical_research',
    'emergency_medicine_first_aid','nutrition_wellness','healthcare_administration','early_childhood_education','elementary_education','secondary_education',
    'special_education','literacy','stem_education','college_career_readiness','youth_mentoring','educational_technology',
    'entrepreneurship','finance','economics','marketing','management_operations','nonprofit_management',
    'human_resources','information_systems','event_planning','social_innovation','environmental_science','conservation',
    'climate_sustainability','ecology','marine_science','agriculture_food_systems','parks_outdoor_stewardship','recycling_waste_reduction',
    'veterinary_interests','animal_shelters','wildlife_conservation','animal_welfare','zoology','marine_wildlife',
    'animal_assisted_services','food_security','housing_homelessness','disability_support','senior_support','youth_services',
    'disaster_preparedness','immigrant_refugee_support','community_development','visual_arts','music','theater_performing_arts',
    'writing_journalism','photography_film','graphic_design','museums_history','digital_media','social_media_communications',
    'law_legal_services','government_public_administration','public_policy','civic_engagement','human_rights','voter_education',
    'international_relations','criminal_justice','advocacy_community_organizing','coaching','youth_sports','adaptive_sports',
    'recreation_programs','sports_management','event_support','outdoor_recreation','health_fitness_education','computer_science',
    'software_engineering','data_science','artificial_intelligence','computer_engineering','electrical_engineering','semiconductor_engineering',
    'quantum_computing','stem_leadership'
  ]::text[]);
