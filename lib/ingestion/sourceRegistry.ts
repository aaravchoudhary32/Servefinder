// Maps a URL slug (the [source] segment in
// app/api/cron/fetch/[source]/route.ts) to the source's existing
// run<Name>Fetch function and ingestion_locks key. Routing/dispatch only
// — every run function, lock key, and error-route string here is
// identical to what each source's now-removed standalone route file
// used, so ingestion_locks/ingestion_runs/error_log history stays
// continuous across the consolidation.
//
// Consolidated from 9 separate route files into this one shared dynamic
// route so Next.js counts 1 deployed function instead of 9 — see
// next.config.js's outputFileTracingIncludes comment for why that
// mattered (Vercel's Hobby-plan 12-Serverless-Function cap).

import type { SupabaseClient } from "@supabase/supabase-js";
import { runArizonaScienceCenterFetch } from "./sources/arizonaScienceCenter";
import { runAZGameFishFetch } from "./sources/azGameFish";
import { runBetterImpactMesaFetch, runBetterImpactGilbertFetch, runBetterImpactSacramentoFetch, runBetterImpactSanJoseFetch, runBetterImpactBoiseFetch, runBetterImpactRosevilleFetch, runBetterImpactCorvallisFetch } from "./sources/betterImpact";
import { runBgcCentralAZFetch } from "./sources/bgcCentralAZ";
import { runChesapeakeHumaneFetch } from "./sources/chesapeakeHumane";
import { runChesapeakeLibraryFetch } from "./sources/chesapeakeLibrary";
import { runCityOfPhoenixFetch } from "./sources/cityOfPhoenix";
import { runFirewheelStemFetch } from "./sources/firewheelStem";
import { runFoodbankSevaFetch } from "./sources/foodbankSeva";
import { runHandsOnGreaterPhoenixFetch } from "./sources/handsOnGreaterPhoenix";
import { runMultnomahCountyLibraryFetch } from "./sources/multnomahCountyLibrary";
import { runSanMateoCountyLibrariesFetch } from "./sources/sanMateoCountyLibraries";
import { runWisconsinHumaneSocietyGreenBayFetch, runWisconsinHumaneSocietyMilwaukeeFetch, runWisconsinHumaneSocietyOzaukeeFetch, runWisconsinHumaneSocietyDoorCountyFetch, runWisconsinHumaneSocietyKenoshaFetch } from "./sources/wisconsinHumaneSocietyGreenBay";
import { runBellevilleAreaHumaneSocietyFetch, runKansasHumaneSocietyFetch } from "./sources/humaneSocietySiteWidePolicy";
import { runPhoenixRescueMissionFetch } from "./sources/phoenixRescueMission";
import { runSpecialOlympicsAZFetch } from "./sources/specialOlympicsAZ";
import { runStmarysFoodBankFetch } from "./sources/stmarysFoodBank";
import { runVbspcaFetch } from "./sources/vbspca";
import { runSamaritanSantaClaritaFetch, runSamaritanPrinceGeorgesParksFetch, runSamaritanMetroLibraryOkcFetch, runSamaritanMontgomeryParksFetch, runSamaritanEastBayRegionalParksFetch, runSamaritanCityOfAuroraCoFetch, runSamaritanJohnsonCountyLibraryFetch, runSamaritanPeoriaParkDistrictIlFetch, runSamaritanCaliforniaFishWildlifeFetch, runSamaritanTexasParksWildlifeFetch } from "./sources/samaritan";

// Every source's own FetchResult type (BgcCentralAZFetchResult,
// VbspcaFetchResult, ...) has this identical shape — this is a
// structural type for the registry's dispatch table, not a new type
// those files need to import or conform to explicitly.
export type IngestionSourceResult = {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  orgId: string | null;
  logs: string[];
};

export type IngestionSourceEntry = {
  /** ingestion_locks key — matches what each source's removed route file already used. */
  lockKey: string;
  run: (supabase: SupabaseClient) => Promise<IngestionSourceResult>;
};

export const INGESTION_SOURCES: Record<string, IngestionSourceEntry> = {
  "arizona-science-center": { lockKey: "arizona_science_center", run: runArizonaScienceCenterFetch },
  "az-game-fish": { lockKey: "az_game_fish", run: runAZGameFishFetch },
  "better-impact-mesa": { lockKey: "better_impact_mesa", run: runBetterImpactMesaFetch },
  "better-impact-gilbert": { lockKey: "better_impact_gilbert", run: runBetterImpactGilbertFetch },
  "better-impact-sacramento": { lockKey: "better_impact_sacramento", run: runBetterImpactSacramentoFetch },
  "better-impact-san-jose": { lockKey: "better_impact_san_jose", run: runBetterImpactSanJoseFetch },
  "better-impact-boise": { lockKey: "better_impact_boise", run: runBetterImpactBoiseFetch },
  "better-impact-roseville": { lockKey: "better_impact_roseville", run: runBetterImpactRosevilleFetch },
  "better-impact-corvallis": { lockKey: "better_impact_corvallis", run: runBetterImpactCorvallisFetch },
  "bgc-central-az": { lockKey: "bgc_central_az", run: runBgcCentralAZFetch },
  "chesapeake-humane": { lockKey: "chesapeake_humane", run: runChesapeakeHumaneFetch },
  "chesapeake-library": { lockKey: "chesapeake_public_library", run: runChesapeakeLibraryFetch },
  "city-of-phoenix": { lockKey: "cityofphoenix", run: runCityOfPhoenixFetch },
  "firewheel-stem": { lockKey: "firewheel_stem", run: runFirewheelStemFetch },
  "foodbank-seva": { lockKey: "foodbank_seva", run: runFoodbankSevaFetch },
  "handson-greater-phoenix": { lockKey: "handson_greater_phoenix", run: runHandsOnGreaterPhoenixFetch },
  "multnomah-county-library": { lockKey: "multnomah_county_library", run: runMultnomahCountyLibraryFetch },
  "samaritan-santa-clarita": { lockKey: "samaritan_santa_clarita", run: runSamaritanSantaClaritaFetch },
  "samaritan-prince-georges-parks": { lockKey: "samaritan_prince_georges_parks", run: runSamaritanPrinceGeorgesParksFetch },
  "samaritan-metro-library-okc": { lockKey: "samaritan_metro_library_okc", run: runSamaritanMetroLibraryOkcFetch },
  "samaritan-montgomery-parks": { lockKey: "samaritan_montgomery_parks", run: runSamaritanMontgomeryParksFetch },
  "samaritan-east-bay-regional-parks": { lockKey: "samaritan_east_bay_regional_parks", run: runSamaritanEastBayRegionalParksFetch },
  "samaritan-city-of-aurora-co": { lockKey: "samaritan_city_of_aurora_co", run: runSamaritanCityOfAuroraCoFetch },
  "samaritan-johnson-county-library": { lockKey: "samaritan_johnson_county_library", run: runSamaritanJohnsonCountyLibraryFetch },
  "samaritan-peoria-park-district-il": { lockKey: "samaritan_peoria_park_district_il", run: runSamaritanPeoriaParkDistrictIlFetch },
  "samaritan-california-fish-wildlife": { lockKey: "samaritan_california_fish_wildlife", run: runSamaritanCaliforniaFishWildlifeFetch },
  "samaritan-texas-parks-wildlife": { lockKey: "samaritan_texas_parks_wildlife", run: runSamaritanTexasParksWildlifeFetch },
  "san-mateo-county-libraries": { lockKey: "san_mateo_county_libraries", run: runSanMateoCountyLibrariesFetch },
  "wisconsin-humane-society-green-bay": { lockKey: "wisconsin_humane_society_green_bay", run: runWisconsinHumaneSocietyGreenBayFetch },
  "wisconsin-humane-society-milwaukee": { lockKey: "wisconsin_humane_society_milwaukee", run: runWisconsinHumaneSocietyMilwaukeeFetch },
  "wisconsin-humane-society-ozaukee": { lockKey: "wisconsin_humane_society_ozaukee", run: runWisconsinHumaneSocietyOzaukeeFetch },
  "wisconsin-humane-society-door-county": { lockKey: "wisconsin_humane_society_door_county", run: runWisconsinHumaneSocietyDoorCountyFetch },
  "wisconsin-humane-society-kenosha": { lockKey: "wisconsin_humane_society_kenosha", run: runWisconsinHumaneSocietyKenoshaFetch },
  "belleville-area-humane-society": { lockKey: "belleville_area_humane_society", run: runBellevilleAreaHumaneSocietyFetch },
  "kansas-humane-society": { lockKey: "kansas_humane_society", run: runKansasHumaneSocietyFetch },
  "phoenix-rescue-mission": { lockKey: "phoenixrescuemission", run: runPhoenixRescueMissionFetch },
  "special-olympics-az": { lockKey: "special_olympics_az", run: runSpecialOlympicsAZFetch },
  "stmarys-foodbank": { lockKey: "stmarysfoodbank", run: runStmarysFoodBankFetch },
  "vbspca": { lockKey: "vbspca", run: runVbspcaFetch },
};
