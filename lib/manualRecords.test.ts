import { describe, it, expect } from "vitest";
import { MANUAL_RECORDS } from "./manualRecords";

describe("MANUAL_RECORDS data integrity", () => {
  it("has exactly the 64 organizations from the six approved integration plans plus 18 added across four 2026-08-31 autonomous sessions (2 Habitat, 4 Tucson/Pima municipal, 10 Banner Health, 2 more: Northern Arizona Healthcare and Onvida Health), plus 9 added in the nationwide-expansion pass (6 Northwell Health NY hospitals + 2 UCHealth CO hospitals + San José Public Library King Library Youth Services), plus 4 added in the Phase 2 continuation (Glen Cove Hospital, Mount Sinai South Nassau, Cleveland Clinic Avon Hospital, City of Long Beach Parks/Rec/Marine), plus 5 added in the Phase 2 continuation's third wave (Baylor Scott & White Temple, Baylor Scott & White Grapevine, Harris Health, Santa Barbara Cottage Hospital, Virtua Health), plus 5 added in the Phase 2 continuation's fourth wave (4 more Northwell hospitals: LIJ Forest Hills, LIJ Medical Center, LIJ Valley Stream, Peconic Bay Medical Center, plus King County Library System), plus 1 added in the Phase 2 continuation's fifth wave (Fremont Main Library, 2 opportunities), plus 7 added in the sixth wave (Nuvance Health hospitals: Danbury, New Milford, Sharon, Northern Dutchess, Norwalk, Putnam, Vassar Brothers), plus 5 added in the seventh wave (Alameda County Library branches: Albany [2 opportunities], Centerville, Dublin, Newark, Union City), plus 2 added in the Arizona-priority batch (United Food Bank's second independent-16-17 role, Arizona Humane Society's Humane Teens program) — note: HonorHealth and Phoenix Children's Hospital were already present from an earlier, pre-existing biomedical batch and were NOT re-added, plus 24 added in the high-yield nationwide batch (11 NewYork-Presbyterian campuses sharing one VSys One portal, 6 Wellstar Health System GA hospitals, 4 Geisinger PA hospitals sharing one Junior Volunteer Program, 3 new Habitat for Humanity affiliates: Twin Cities [2 opportunities], Seattle-King & Kittitas [1], Greater Los Angeles [2]), plus 14 added in the AZ municipal batch (Tempe Youth Volunteer Program, Goodyear GRC-U + Junior Leader Volunteer [2 opportunities], Goodyear Police Youth Cadet, Prescott Library TAG, Prescott Teen Task Force, Avondale Library [seasonal/closed until July 2027], Avondale Youth Advisory Council, Buckeye Library & Museum, Yuma Police Explorers, Chandler Leaders In Training, Glendale Police Cadets, Gilbert Police Cadet [confirmed no overlap with existing Better Impact Gilbert connector], Mesa Cadet Post #2055, Maricopa County Elections Student Election Program), plus 5 added in the Phase 2 platform-discovery continuation (Trinity Health Grand Rapids, Trinity Health Muskegon, Virtua Voorhees Hospital, Baylor Scott & White McKinney, Ascension Providence Waco — the first record from a newly-discovered Ascension VSys One system), plus 10 added in the Ascension platform build-out (8 Florida facilities sharing one 'ages 15-17' teen portal: Sacred Heart Bay/Emerald Coast/Gulf/Pensacola, St. Vincent's Clay County/Riverside/Southside/St. Johns; 2 Tennessee facilities with a seasonal Junior Volunteer Summer Program, both currently closed/full: Saint Thomas West, Saint Thomas Rutherford), plus 3 added via direct Communico-tenant verification (Ocean County Library NJ, Gail Borden Public Library District IL, Pasco County Libraries FL — each confirmed live and current, cross-checked against a currently-dated calendar event where available, after a parallel research pass on this platform stalled twice), plus 1 added via a narrower-scoped Communico research pass (York County Libraries SC, independently re-verified), plus 2 added via a Volgistics platform-discovery pass (Rockwood Park & Museum DE, Irvine Public Library CA — 2 of 4 sampled tenants verified, a 50% hit rate worth a deeper future pass), plus 5 added via a Samaritan platform discovery + off-target Volgistics-search finds (City of Santa Clarita CA, Howard County Recreation & Parks MD via Samaritan; Canby Public Library OR, Three Rivers Park District MN, Forsyth County Public Library GA found off-platform but independently verified), plus 3 added via a deeper Samaritan pass + humane-society sweep (Prince George's Parks and Recreation MD, Metropolitan Library System OKC via Samaritan; Nebraska Humane Society), plus 2 added via an Arizona sweep this session (City of Goodyear Youth Commission, Chandler Center for the Arts — Avondale's Youth Advisory Commission was also found but confirmed a duplicate of the already-approved AYAC record, correctly not re-added), plus 1 added via a Volgistics aquarium/garden/conservatory phrase search (The Open Door Pantry, Eagan MN — tiered age policy confirmed via the org's own page and Volunteer Handbook), plus 2 added via a second Communico age-phrase pass (Hartford Public Library CT, Braswell Memorial Library NC), plus 1 added via a Teen Advisory Board search (Jacksonville Public Library FL), plus 5 added via a humane-society sweep (Austin Humane Society, Tri-County Humane Society MN, Humane Society of Charlotte, Humane Society of Broward County, Dane County Humane Society), plus 3 added via an Arizona depth pass (Coolidge Police Department, Queen Creek Library, Town of Queen Creek Parks and Recreation — Phoenix Public Library and Casa Grande's library were checked and confirmed already covered by the existing City of Phoenix Samaritan connector and the Pinal County Library District's Vista Grande branch respectively, correctly not re-added), plus 4 added via a museum/library discovery pass (DISCOVERY Children's Museum Las Vegas, Florida Museum of Natural History, San Antonio Public Library, Santa Clara City Library — a fifth, ProRodeo Hall of Fame, was researched and staged but withdrawn during independent review since its own page has no age requirement at all; the original 16+ figure came only from a third-party listing), plus 3 added via a general search pass (Pierce County Library System, Westminster Public Library CO, East Valley Fire Cadet Program AZ — the last currently closed for new applicants, staged with accurate seasonal status rather than omitted), plus 2 added via an Arizona depth pass continuation (Avondale Police Department AZ, Peoria Zoo IL — the latter genuinely Illinois's zoo, not Arizona, staged as seasonal since its annual cycle had already concluded by this session)", () => {
    // Plus 1 added in the canonical-taxonomy Healthcare source-research
    // batch (2026-09-05), after review: Maricopa County Department of
    // Public Health (STAND Coalition + Youth Advisory Council), both
    // approved. Three other candidates from the same research pass
    // (Active Minds' Mental Health Advocacy Academy, OHSU School of
    // Dentistry's Dental Explorers, MentorKids USA's iLEAD Youth
    // Leadership) were reviewed and rejected — not clearly volunteer-
    // based (a training curriculum with a paid phase, a paid class, and
    // a paid part-time job, respectively) — and removed from this file;
    // see the comment above the Maricopa County Public Health record.
    // Plus 1 added in the high-demand-focus research batch (2026-09-05,
    // revised coverage strategy): Teen Lifeline (2 opportunities —
    // Maricopa County and Pima County peer-counselor intakes).
    expect(MANUAL_RECORDS).toHaveLength(230);
  });

  it("has a unique slug per organization", () => {
    const slugs = MANUAL_RECORDS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has a unique external_id (org-slug + suffix) across every opportunity, no collisions", () => {
    const externalIds = MANUAL_RECORDS.flatMap((r) =>
      r.opportunities.map((o) => `${r.slug}-${o.externalIdSuffix}`)
    );
    expect(new Set(externalIds).size).toBe(externalIds.length);
  });

  it("has exactly 7 pure directory records (no opportunities) — AMNH, ADEQ, MESA, Science Bowl, Arizona Burn Foundation, ASU Fulton, AZFirst", () => {
    const directoryOnly = MANUAL_RECORDS.filter((r) => r.opportunities.length === 0).map((r) => r.slug);
    expect(directoryOnly.sort()).toEqual(
      [
        "arizona-museum-of-natural-history",
        "arizona-community-science-alliance",
        "arizona-mesa",
        "arizona-science-bowl",
        "arizona-burn-foundation",
        "asu-fulton-summer-academy",
        "azfirst-robotics",
      ].sort()
    );
  });

  it("never geocodes Future Stars AZ's opportunity (no real address published — a PO Box only)", () => {
    const futureStars = MANUAL_RECORDS.find((r) => r.slug === "future-stars-az");
    expect(futureStars).toBeDefined();
    for (const opp of futureStars!.opportunities) {
      expect(opp.zip).toBeNull();
      expect(opp.geocodeCity).toBeNull();
    }
  });

  it("every opportunity's category is a real platform category", () => {
    const validCategories = new Set([
      "STEM", "Environment", "Healthcare", "Education", "Animals", "Arts & Culture", "Community Service", "Sports & Rec",
      "Business & Entrepreneurship",
    ]);
    for (const record of MANUAL_RECORDS) {
      for (const opp of record.opportunities) {
        expect(validCategories.has(opp.category)).toBe(true);
      }
    }
  });

  it("SARSEF's two roles are genuinely distinct records, not duplicated ones", () => {
    const sarsef = MANUAL_RECORDS.find((r) => r.slug === "sarsef");
    expect(sarsef?.opportunities).toHaveLength(2);
    const titles = sarsef!.opportunities.map((o) => o.title);
    expect(new Set(titles).size).toBe(2);
  });

  it("only the specific opportunities verified as genuinely currently-open are marked 'open'", () => {
    const openIds = MANUAL_RECORDS.flatMap((r) => r.opportunities)
      .filter((o) => o.availabilityStatus === "open")
      .map((o) => o.externalIdSuffix)
      .sort();
    expect(openIds).toEqual(
      [
        "arizona-stem-adventure-event-staff",
        "arizona-stem-adventure-exhibitors",
        "teen-volunteering",
        "red-cross-club",
        "robotics-camp",
        "game-and-ai-camp",
        "2026",
        "pathways",
        "volunteer-tutor",
        "volunteer-academic-coach",
        "english-conversation-volunteer",
        "business-social-innovation-competition",
        "innovation-entrepreneurship-competition",
        "student-entrepreneur-competition",
        "global-high-school-investment-competition",
        "ja-inspire-virtual-career-exploration",
        "teens-in-the-garden",
        "citizen-science-volunteer",
        "digital-volunteer-transcription",
        "outdoor-aviary-monitor",
        "general-construction",
        "construction-chuck-habistore",
        "explorer-post-180",
        "dog-walkers",
        "adoption-counselors",
        "administrative-support",
        "greeter-crew",
        "transport",
        "bin-buddies",
        "medical-cat-care-assistant",
        "special-event-volunteers",
        "family-volunteer-program",
        "teen-volunteer",
        "teen-volunteer-application",
        "teen-volunteer-application",
        "teen-volunteer-application",
        "teen-volunteer-application",
        "teen-volunteer-program",
        "teen-volunteer-program",
        "teen-volunteer-program",
        "teen-volunteer-program",
        "teen-volunteer-program",
        "jr-teen-volunteer-application",
        "volunteer",
        "junior-volunteer-program",
        // Nationwide-expansion pass: Lenox Hill, Phelps, and University of
        // Colorado Hospital are all confirmed standing/rolling-cohort
        // programs (never a narrow date-gated window), so — unlike North
        // Shore, Cohen Children's, and Mather in the same batch, which are
        // seasonal — these three are genuinely "open" today.
        "junior-volunteer-program",
        "junior-volunteer-program",
        "junior-volunteer-program",
        "teen-volunteer-application",
        // Phase 2 continuation: Glen Cove Hospital has no published
        // application window — reads as standing/open, same reasoning as
        // Lenox Hill/Phelps above. Mount Sinai South Nassau is currently
        // closed (seasonal), not included here.
        "junior-volunteer-program",
        // Phase 2 continuation, second wave: Cleveland Clinic Avon
        // Hospital and City of Long Beach Parks/Rec/Marine both publish
        // no application window — standing/open.
        "junior-volunteer-application",
        "teen-volunteers-ages-13-17",
        // Phase 2 continuation, third wave: Baylor Scott & White Temple,
        // Santa Barbara Cottage Hospital, and Virtua Health all publish
        // no application window — standing/open. Baylor Scott & White
        // Grapevine and Harris Health are both currently closed/seasonal
        // (explicit reopen-window text on their own pages), not included
        // here. City of Boise is connector-sourced (unverified), not a
        // manual record.
        "junior-volunteer-ambassador",
        "volunteer-application",
        "junior-volunteer-applications",
        // Phase 2 continuation, fourth wave: LIJ Forest Hills, Peconic
        // Bay Medical Center, and King County Library's Burien Tech
        // Tutor all publish no application window — standing/open. LIJ
        // Medical Center and LIJ Valley Stream are both currently
        // closed/seasonal (explicit date-gated application windows on
        // their own pages), not included here.
        "junior-volunteer-program",
        "junior-volunteer-program",
        "burien-tech-tutor",
        // Phase 2 continuation, fifth wave: Fremont Main Library's 2
        // qualifying activities both publish no application window —
        // standing/open.
        "seed-library",
        "virtual-book-reviewer",
        // Sixth wave: Nuvance Health hospitals — all 7 publish no
        // application window, standing/open.
        "student-volunteer-application",
        "student-volunteer-application",
        "student-volunteer-application",
        "student-volunteer-application",
        "student-volunteer-application",
        "student-volunteer-application",
        "junior-volunteer-application",
        // Seventh wave: Alameda County Library branches — all 6
        // publish no application window, standing/open.
        "dd-campaign-leader",
        "general-volunteering-books",
        "teen-advisory-board",
        "teen-volunteer-orientation",
        "teen-advisory-group",
        "teen-advisory-group",
        // Arizona-priority batch: United Food Bank's independent 16-17
        // role and Arizona Humane Society's Humane Teens program both
        // publish a current, open application pathway (Humane Teens has
        // a specific deadline but is not seasonally closed).
        "volunteer-independently-16-17",
        "humane-teens",
        // High-yield nationwide batch: all 11 NewYork-Presbyterian
        // campuses publish no application window for their Ongoing
        // track — standing/open.
        "volunteer-program", "volunteer-program", "volunteer-program", "volunteer-program", "volunteer-program",
        "volunteer-program", "volunteer-program", "volunteer-program", "volunteer-program", "volunteer-program", "volunteer-program",
        // Wellstar: Cobb, Paulding, Kennestone, North Fulton, and MCG are
        // open; West Georgia is seasonal (explicit 2027 program dates),
        // not included here.
        "volunteen-program", "volunteen-program", "volunteen-program", "volunteen-program", "volunteen-program",
        // Habitat for Humanity: Twin Cities (2), Seattle-King & Kittitas
        // (1), Greater Los Angeles (2) all publish no application
        // window — standing/open.
        "construction-home-repair-volunteer", "restore-one-day-at-a-time-volunteer",
        "construction-habitat-stores-volunteer",
        "build-construction-volunteer", "restore-youth-volunteer",
        // AZ municipal batch: all standing/open except Avondale Library
        // (seasonal — confirmed still closed until July 2027, triple-
        // verified against a fork's incorrect "reopened" claim).
        "youth-volunteer-program", "grc-u", "junior-leader-volunteer",
        "police-youth-cadet-program", "teen-advisory-group", "teen-task-force",
        "avondale-youth-advisory-council", "teen-volunteer-application",
        "police-explorers", "leaders-in-training", "police-cadets-explorers",
        "police-cadet-program", "cadet-post-2055", "student-election-program",
        // Phase 2 platform-discovery continuation: all 5 new records
        // publish no application window — standing/open.
        "junior-volunteer", "junior-volunteer", "junior-volunteer",
        "junior-volunteer", "junior-volunteer",
        // Ascension platform build-out: all 8 Florida facilities share
        // one year-round teen policy with no application window —
        // standing/open. The 2 Tennessee facilities are seasonal
        // (current cycle closed/full) and excluded from this list.
        "junior-volunteer", "junior-volunteer", "junior-volunteer",
        "junior-volunteer", "junior-volunteer", "junior-volunteer",
        "junior-volunteer", "junior-volunteer",
        // Communico direct-verification batch: all 3 publish no
        // application window — standing/open.
        "teen-volunteer-program", "teen-volunteer-program", "teen-volunteer",
        // York County Libraries — no application window, standing/open.
        "teen-volunteer",
        // Rockwood Park & Museum — no application window, standing/open.
        // Irvine Public Library is waitlisted, not open — excluded here.
        "youth-volunteer",
        // Samaritan + off-target finds: Santa Clarita, Howard County,
        // Canby Library, and Forsyth County Library are all standing/
        // open. Three Rivers Park District CIT is seasonal — excluded.
        "bike-park-workdays", "mpea-conservation-stewardship",
        "library-volunteer", "library-volunteer",
        // Metro Library OKC and Nebraska Humane Society are standing/
        // open. Prince George's Parks is seasonal — excluded.
        "library-volunteer", "youth-volunteer-day",
        // Chandler Center for the Arts — no application window,
        // standing/open. Goodyear Youth Commission is seasonal —
        // excluded here.
        "volunteer-usher-greeter",
        // The River Food Pantry (Volgistics sweep) — all 3 roles publish
        // no application window, standing/open.
        "pantry-assistant-walkups", "cooler-recovery-assistant", "client-registration-assistant",
        // Poudre River Public Library District (Volgistics sweep) — both
        // roles are current 2026-dated listings with no application
        // window, standing/open. The org's seasonal summer Teen Reading
        // Buddies program was found but excluded (out of cycle).
        "tween-night-volunteer", "fiesta-familiar-de-loteria-volunteer",
        // Virginia Living Museum (Volgistics sweep) — both roles publish
        // no application window, standing/open. Cabell Huntington
        // Hospital's VolunTeen Program (same sweep) is seasonal/closed —
        // excluded here.
        "education-interpretation-volunteer", "green-teens",
        // IU Health West Hospital (Volgistics sweep) — both roles publish
        // no application window, standing/open. ED Volunteer at the same
        // hospital is 18+ — excluded here.
        "care-volunteer", "welcome-desk-guest-ambassador",
        // FAAS Alameda Animal Shelter (Volgistics sweep) — all 3 roles
        // publish no application window, standing/open.
        "canine-support", "small-creature-support", "shelter-support",
        // Communico platform sweep — standing/open library programs.
        // Dallas's Summer Book Buddies and Fairfield's Teen Council /
        // Content Creation are seasonal/status-ambiguous — excluded here.
        "library-volunteer-general", "library-volunteer", "library-volunteer",
        "library-volunteer", "teen-advisory-board", "book-master",
        "teen-advisory-council", "teen-volunteer", "teen-volunteer-program",
        "teen-library-volunteer", "teen-library-connections", "teen-volunteer",
        "teen-advisory-board", "teen-volunteer", "library-volunteer",
        "teen-volunteer", "teen-council", "teens-leading-change",
        // Arizona library gap-check — The Bookworms is open; Peoria's
        // summer program and Maricopa County Library District's teen
        // volunteer role are both seasonal/status-varying, excluded.
        "the-bookworms-teen-advisory-board",
        // Wave A continuation — Cheekwood's Harvest Weekends is
        // seasonal (excluded); the rest are standing/open.
        "teen-volunteer-program", "youth-volunteer", "volunteer-at-three-square",
        "teen-bright-futures-food-drive",
        // Communico Wave A, second pass — Salt Lake County's Teen Summer
        // Volunteer is seasonal (excluded); the rest are standing/open.
        "library-volunteer", "teen-library-advisory-committee", "teen-volunteer",
        "library-volunteer", "library-volunteer",
        "teen-advisory-board", "school-year-volunteen",
        "teen-volunteer", "teen-advisory-board",
        // Volgistics aquarium/garden/conservatory search.
        "warehouse-assistant",
        // Second Communico age-phrase pass + humane-society sweep.
        "teen-young-adult-volunteer", "teen-volunteer-childrens-room", "teen-advisory-board",
        "volunteer", "volunteer", "on-site-volunteer", "teen-animal-care-volunteer-program",
        "youth-volunteer",
        // Arizona depth pass.
        "police-explorer-program", "library-volunteer", "parks-grounds-maintenance-volunteer",
        // Museum/library discovery pass.
        "teen-volunteer-program", "junior-volunteer-program",
        "teen-volunteer", "teen-volunteer",
        // General search pass (East Valley Fire Cadet Program excluded — closed, not open).
        "teen-volunteer", "teen-advisory-board",
        // Arizona depth pass continuation (Peoria Zoo excluded — seasonal, not open).
        "avondale-cadet-program",
        // Canonical-taxonomy Healthcare source-research batch: STAND
        // Coalition is confirmed currently open (and approved). Maricopa's
        // Youth Advisory Council is seasonal (closed) — excluded here.
        // Active Minds' Mental Health Advocacy Academy was open but was
        // rejected on review and removed from this file entirely.
        "stand-coalition",
        // High-demand-focus research batch: Teen Lifeline's application
        // forms are live with no stated closed/full status for either
        // county intake — standing/open.
        "peer-counselor-maricopa", "peer-counselor-pima",
      ].sort()
    );
  });

  it("never labels a tuition-based program as volunteering (UA College of Medicine's Summer Scrubs tracks)", () => {
    for (const record of MANUAL_RECORDS) {
      for (const opp of record.opportunities) {
        if (opp.compensation === "tuition_based") {
          expect(opp.programType).not.toBe("volunteering");
        }
      }
    }
  });

  it("never labels a genuine internship (Barrow's Summer High School Internship) as volunteering", () => {
    const barrow = MANUAL_RECORDS.find((r) => r.slug === "barrow-neurological-institute");
    const internship = barrow?.opportunities.find((o) => o.externalIdSuffix === "summer-high-school-internship");
    expect(internship?.programType).toBe("internship");
  });

  it("UA College of Medicine's three Summer Scrubs tracks are genuinely distinct (different costs)", () => {
    const uaCom = MANUAL_RECORDS.find((r) => r.slug === "ua-college-of-medicine-phoenix");
    const scrubsTracks = uaCom?.opportunities.filter((o) => o.title.startsWith("Summer Scrubs")) ?? [];
    expect(scrubsTracks).toHaveLength(3);
    const costs = scrubsTracks.map((o) => o.cost);
    expect(new Set(costs).size).toBe(3);
  });

  it("TGen's live-verified lab shadowing correction is reflected in the data", () => {
    const tgen = MANUAL_RECORDS.find((r) => r.slug === "tgen");
    const academy = tgen?.opportunities.find((o) => o.externalIdSuffix === "bioscience-leadership-academy");
    expect(academy?.shadowingComponent).toBe(true);
  });

  // CS/Engineering/Robotics/Cybersecurity/Aerospace/Technology batch
  it("never labels a competition (judged/ranked/scored/award-based event) as volunteering", () => {
    for (const record of MANUAL_RECORDS) {
      for (const opp of record.opportunities) {
        if (opp.programType === "competition") {
          expect(opp.programType).not.toBe("volunteering");
        }
      }
    }
  });

  it("classifies Congressional App Challenge and the NASA challenges as competition, not volunteering or career_exploration_program by default", () => {
    const cac = MANUAL_RECORDS.find((r) => r.slug === "congressional-app-challenge");
    expect(cac?.opportunities[0]?.programType).toBe("competition");

    const nasa = MANUAL_RECORDS.find((r) => r.slug === "nasa-high-school-stem-opportunities");
    const spaceApps = nasa?.opportunities.find((o) => o.externalIdSuffix === "space-apps-challenge");
    expect(spaceApps?.programType).toBe("competition");
  });

  it("AZFirst's directory-only record excludes all 5 competition/team-registration pages (no opportunities created)", () => {
    const azfirst = MANUAL_RECORDS.find((r) => r.slug === "azfirst-robotics");
    expect(azfirst?.opportunities).toHaveLength(0);
  });

  it("CyberPatriot's record leaves unverified fields genuinely unknown rather than fabricated (no cost, no eligibleGrades)", () => {
    const cyberpatriot = MANUAL_RECORDS.find((r) => r.slug === "cyberpatriot");
    const opp = cyberpatriot?.opportunities[0];
    expect(opp?.cost).toBeUndefined();
    expect(opp?.eligibleGrades).toBeUndefined();
    expect(opp?.applicationDeadline).toBeNull();
  });

  it("does not reuse 2026 dates as if they were future-cycle dates for UA Quantum Camp (marked seasonal, not open-ended)", () => {
    const eao = MANUAL_RECORDS.find((r) => r.slug === "university-of-arizona-early-academic-outreach");
    const quantumCamp = eao?.opportunities.find((o) => o.externalIdSuffix === "quantum-camp");
    expect(quantumCamp?.availabilityStatus).toBe("seasonal");
  });

  it("Quantum Camp's expired 2026 deadline was cleared, not left presented as current, and no 2027 date was invented", () => {
    const eao = MANUAL_RECORDS.find((r) => r.slug === "university-of-arizona-early-academic-outreach");
    const quantumCamp = eao?.opportunities.find((o) => o.externalIdSuffix === "quantum-camp");
    expect(quantumCamp?.applicationDeadline).toBeNull();
    expect(quantumCamp?.availabilityNote).toBe("2026 registration has closed. 2027 dates have not yet been announced.");
    expect(quantumCamp?.availabilityNote).not.toMatch(/2027-\d{2}-\d{2}/);
  });

  it("NASEP's sensitive eligibility text is stored as descriptive context only, never a separate filterable field", () => {
    const eao = MANUAL_RECORDS.find((r) => r.slug === "university-of-arizona-early-academic-outreach");
    const nasep = eao?.opportunities.find((o) => o.externalIdSuffix === "nasep");
    expect(nasep?.eligibleGrades).toContain("Native American");
    // ManualOpportunity has no dedicated ethnicity/tribal-identity field
    // at all — the only structural way this fact could exist is as free
    // text, which is exactly how it's stored (see lib/matching.ts's hard
    // filters: age and distance only).
    expect(Object.keys(nasep ?? {})).not.toContain("tribalAffiliation");
    expect(Object.keys(nasep ?? {})).not.toContain("ethnicity");
  });

  it("marks only the independently-verified virtual/hybrid records — everything else defaults to in_person", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    // Confidently virtual — a genuine no-physical-attendance format.
    expect(findOpp("congressional-app-challenge", "2026")?.deliveryMode).toBe("virtual");
    expect(findOpp("cyberpatriot", "national-competition")?.deliveryMode).toBe("virtual");
    expect(findOpp("girls-who-code-pathways", "pathways")?.deliveryMode).toBe("virtual");
    expect(findOpp("scitech-institute-chief-science-officers", "chief-science-officers")?.deliveryMode).toBe("virtual");
    expect(findOpp("nasa-high-school-stem-opportunities", "techrise-challenge")?.deliveryMode).toBe("virtual");
    expect(findOpp("nasa-high-school-stem-opportunities", "app-development-challenge")?.deliveryMode).toBe("virtual");

    // Hybrid — both a real local-event track and a genuine remote track exist.
    expect(findOpp("nasa-high-school-stem-opportunities", "space-apps-challenge")?.deliveryMode).toBe("hybrid");

    // Deliberately left at the default (in_person) — insufficient
    // confirmed info, or a genuine physical-attendance requirement.
    expect(findOpp("nasa-high-school-stem-opportunities", "dream-with-us")?.deliveryMode).toBeUndefined();
    expect(findOpp("nasa-high-school-stem-opportunities", "hunch")?.deliveryMode).toBeUndefined();
    expect(findOpp("nasa-high-school-stem-opportunities", "rover-challenge")?.deliveryMode).toBeUndefined();
  });

  it("never marks an opportunity virtual merely because it has an online application form (spot check: ASU/UA camps stay in_person despite online registration links)", () => {
    const scai = MANUAL_RECORDS.find((r) => r.slug === "asu-scai-summer-camps");
    for (const opp of scai?.opportunities ?? []) {
      expect(opp.deliveryMode).toBeUndefined(); // defaults to in_person — these are real physical camps
    }
  });

  // Education/Tutoring/Literacy/Mentoring/Academic Support batch
  describe("Education batch", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("only the 3 link-confirmed records are open; both RBBB records stay unverified", () => {
      expect(findOpp("learn-to-be", "volunteer-tutor")?.availabilityStatus).toBe("open");
      expect(findOpp("upchieve", "volunteer-academic-coach")?.availabilityStatus).toBe("open");
      expect(findOpp("engin-program", "english-conversation-volunteer")?.availabilityStatus).toBe("open");
      expect(findOpp("read-better-be-better", "pathway-education-professions")?.availabilityStatus).toBe("unverified");
      expect(findOpp("read-better-be-better", "pathway-civic-leadership")?.availabilityStatus).toBe("unverified");
    });

    it("never claims a confirmed background check for any of the 5 records — none was independently confirmed", () => {
      const pairs: [string, string][] = [
        ["learn-to-be", "volunteer-tutor"],
        ["upchieve", "volunteer-academic-coach"],
        ["engin-program", "english-conversation-volunteer"],
        ["read-better-be-better", "pathway-education-professions"],
        ["read-better-be-better", "pathway-civic-leadership"],
      ];
      for (const [orgSlug, suffix] of pairs) {
        expect(findOpp(orgSlug, suffix)?.backgroundCheckRequired).toBeUndefined();
      }
    });

    it("ENGin's confirmed parental-consent requirement is recorded; the other 4 records leave it unconfirmed rather than guessed", () => {
      expect(findOpp("engin-program", "english-conversation-volunteer")?.parentalConsentRequired).toBe(true);
      expect(findOpp("learn-to-be", "volunteer-tutor")?.parentalConsentRequired).toBeUndefined();
      expect(findOpp("upchieve", "volunteer-academic-coach")?.parentalConsentRequired).toBeUndefined();
      expect(findOpp("read-better-be-better", "pathway-education-professions")?.parentalConsentRequired).toBeUndefined();
      expect(findOpp("read-better-be-better", "pathway-civic-leadership")?.parentalConsentRequired).toBeUndefined();
    });

    it("ENGin is tagged as mentoring, distinct from Learn To Be/UPchieve's tutoring tag — language mentoring, not formal tutoring", () => {
      expect(findOpp("engin-program", "english-conversation-volunteer")?.programFocusTags).toContain("mentoring");
      expect(findOpp("engin-program", "english-conversation-volunteer")?.programFocusTags).not.toContain("tutoring");
      expect(findOpp("learn-to-be", "volunteer-tutor")?.programFocusTags).toContain("tutoring");
      expect(findOpp("upchieve", "volunteer-academic-coach")?.programFocusTags).toContain("tutoring");
    });

    it("no application deadline is invented for any of the 5 records", () => {
      const pairs: [string, string][] = [
        ["learn-to-be", "volunteer-tutor"],
        ["upchieve", "volunteer-academic-coach"],
        ["engin-program", "english-conversation-volunteer"],
        ["read-better-be-better", "pathway-education-professions"],
        ["read-better-be-better", "pathway-civic-leadership"],
      ];
      for (const [orgSlug, suffix] of pairs) {
        expect(findOpp(orgSlug, suffix)?.applicationDeadline).toBeNull();
      }
    });

    it("all 3 open records use virtual delivery; both RBBB records default to in_person (real Phoenix placements)", () => {
      expect(findOpp("learn-to-be", "volunteer-tutor")?.deliveryMode).toBe("virtual");
      expect(findOpp("upchieve", "volunteer-academic-coach")?.deliveryMode).toBe("virtual");
      expect(findOpp("engin-program", "english-conversation-volunteer")?.deliveryMode).toBe("virtual");
      expect(findOpp("read-better-be-better", "pathway-education-professions")?.deliveryMode).toBeUndefined();
      expect(findOpp("read-better-be-better", "pathway-civic-leadership")?.deliveryMode).toBeUndefined();
    });

    it("RBBB's two programs use distinct, real Formstack application URLs, not a shared or fabricated link", () => {
      const edu = findOpp("read-better-be-better", "pathway-education-professions");
      const civic = findOpp("read-better-be-better", "pathway-civic-leadership");
      expect(edu?.applicationUrl).toBe("https://formstack.io/82EF8");
      expect(civic?.applicationUrl).toBe("https://formstack.io/929E5");
      expect(edu?.applicationUrl).not.toBe(civic?.applicationUrl);
    });

    it("every Education-batch opportunity uses the broad 'education' interest tag so existing Education-interested students match it", () => {
      const eduOrgSlugs = ["learn-to-be", "upchieve", "engin-program", "read-better-be-better"];
      for (const slug of eduOrgSlugs) {
        const org = MANUAL_RECORDS.find((r) => r.slug === slug);
        for (const opp of org?.opportunities ?? []) {
          expect(opp.interestsTags).toContain("education");
        }
      }
    });
  });

  // Business/Entrepreneurship/Finance/Marketing/Social Innovation batch
  describe("Business batch", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("5 link-confirmed records are open; NFTE's World Series of Innovation is seasonal (confirmed upcoming, not yet open)", () => {
      expect(findOpp("diamond-challenge", "business-social-innovation-competition")?.availabilityStatus).toBe("open");
      expect(findOpp("conrad-challenge", "innovation-entrepreneurship-competition")?.availabilityStatus).toBe("open");
      expect(findOpp("blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition")?.availabilityStatus).toBe(
        "open"
      );
      expect(findOpp("wharton-global-youth-program", "global-high-school-investment-competition")?.availabilityStatus).toBe(
        "open"
      );
      expect(findOpp("junior-achievement-arizona", "ja-inspire-virtual-career-exploration")?.availabilityStatus).toBe("open");
      expect(findOpp("nfte-world-series-of-innovation", "world-series-of-innovation-impact-league")?.availabilityStatus).toBe(
        "seasonal"
      );
    });

    it("only NFTE's seasonal record gets an applicationOpenDate — it's the one record that isn't open yet", () => {
      expect(findOpp("nfte-world-series-of-innovation", "world-series-of-innovation-impact-league")?.applicationOpenDate).toBe(
        "2026-09-09"
      );
      const otherSlugs: [string, string][] = [
        ["diamond-challenge", "business-social-innovation-competition"],
        ["conrad-challenge", "innovation-entrepreneurship-competition"],
        ["blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition"],
        ["wharton-global-youth-program", "global-high-school-investment-competition"],
        ["junior-achievement-arizona", "ja-inspire-virtual-career-exploration"],
      ];
      for (const [orgSlug, suffix] of otherSlugs) {
        expect(findOpp(orgSlug, suffix)?.applicationOpenDate).toBeUndefined();
      }
    });

    it("NFTE's confirmed parental-consent requirement is recorded; every other record leaves it unconfirmed rather than guessed", () => {
      expect(findOpp("nfte-world-series-of-innovation", "world-series-of-innovation-impact-league")?.parentalConsentRequired).toBe(
        true
      );
      const otherSlugs: [string, string][] = [
        ["diamond-challenge", "business-social-innovation-competition"],
        ["conrad-challenge", "innovation-entrepreneurship-competition"],
        ["blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition"],
        ["wharton-global-youth-program", "global-high-school-investment-competition"],
        ["junior-achievement-arizona", "ja-inspire-virtual-career-exploration"],
      ];
      for (const [orgSlug, suffix] of otherSlugs) {
        expect(findOpp(orgSlug, suffix)?.parentalConsentRequired).toBeUndefined();
      }
    });

    it("never claims a confirmed background check for any of the 6 records — none was independently confirmed", () => {
      const pairs: [string, string][] = [
        ["diamond-challenge", "business-social-innovation-competition"],
        ["conrad-challenge", "innovation-entrepreneurship-competition"],
        ["blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition"],
        ["wharton-global-youth-program", "global-high-school-investment-competition"],
        ["junior-achievement-arizona", "ja-inspire-virtual-career-exploration"],
        ["nfte-world-series-of-innovation", "world-series-of-innovation-impact-league"],
      ];
      for (const [orgSlug, suffix] of pairs) {
        expect(findOpp(orgSlug, suffix)?.backgroundCheckRequired).toBeUndefined();
      }
    });

    it("Conrad Challenge's real $499/team fee is disclosed, not smoothed into 'Free' like the other 5 records", () => {
      expect(findOpp("conrad-challenge", "innovation-entrepreneurship-competition")?.cost).toContain("499");
      expect(findOpp("conrad-challenge", "innovation-entrepreneurship-competition")?.financialAidAvailable).toBe(true);
      const freeSlugs: [string, string][] = [
        ["diamond-challenge", "business-social-innovation-competition"],
        ["blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition"],
        ["wharton-global-youth-program", "global-high-school-investment-competition"],
        ["junior-achievement-arizona", "ja-inspire-virtual-career-exploration"],
        ["nfte-world-series-of-innovation", "world-series-of-innovation-impact-league"],
      ];
      for (const [orgSlug, suffix] of freeSlugs) {
        expect(findOpp(orgSlug, suffix)?.cost).toBe("Free");
      }
    });

    it("no application deadline is invented for the 2 records with no confirmed date (JA Inspire, NFTE)", () => {
      expect(findOpp("junior-achievement-arizona", "ja-inspire-virtual-career-exploration")?.applicationDeadline).toBeNull();
      expect(findOpp("nfte-world-series-of-innovation", "world-series-of-innovation-impact-league")?.applicationDeadline).toBeNull();
    });

    it("all 6 records use virtual delivery — every accepted source in this batch is nationwide/online, none required physical geocoding", () => {
      const pairs: [string, string][] = [
        ["diamond-challenge", "business-social-innovation-competition"],
        ["conrad-challenge", "innovation-entrepreneurship-competition"],
        ["blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition"],
        ["wharton-global-youth-program", "global-high-school-investment-competition"],
        ["junior-achievement-arizona", "ja-inspire-virtual-career-exploration"],
        ["nfte-world-series-of-innovation", "world-series-of-innovation-impact-league"],
      ];
      for (const [orgSlug, suffix] of pairs) {
        expect(findOpp(orgSlug, suffix)?.deliveryMode).toBe("virtual");
      }
    });

    it("every Business-batch opportunity carries a specific subtag, not just the broad 'business' fallback, except JA Inspire (a general career-exploration platform, not finance/marketing/entrepreneurship-specific)", () => {
      expect(findOpp("diamond-challenge", "business-social-innovation-competition")?.interestsTags).toEqual(
        expect.arrayContaining(["entrepreneurship", "social_innovation"])
      );
      expect(findOpp("conrad-challenge", "innovation-entrepreneurship-competition")?.interestsTags).toContain("entrepreneurship");
      expect(findOpp("blue-ocean-student-entrepreneur-competition", "student-entrepreneur-competition")?.interestsTags).toContain(
        "entrepreneurship"
      );
      expect(findOpp("wharton-global-youth-program", "global-high-school-investment-competition")?.interestsTags).toContain(
        "finance"
      );
      expect(findOpp("nfte-world-series-of-innovation", "world-series-of-innovation-impact-league")?.interestsTags).toEqual(
        expect.arrayContaining(["entrepreneurship", "social_innovation"])
      );
      expect(findOpp("junior-achievement-arizona", "ja-inspire-virtual-career-exploration")?.interestsTags).toEqual(["business"]);
    });

    it("Wharton's real 'a teacher must register the team, not the student' constraint is disclosed in the description", () => {
      const wharton = findOpp("wharton-global-youth-program", "global-high-school-investment-competition");
      expect(wharton?.description.toLowerCase()).toContain("cannot register");
      expect(wharton?.eligibleGrades?.toLowerCase()).toContain("teacher");
    });

    it("Wharton's simulated-investment framing is explicit — never implies real money", () => {
      const wharton = findOpp("wharton-global-youth-program", "global-high-school-investment-competition");
      expect(wharton?.description.toLowerCase()).toContain("simulated");
      expect(wharton?.description.toLowerCase()).toMatch(/no real money/);
    });
  });

  // STEM expansion + virtual volunteering batch
  describe("STEM expansion / virtual volunteering batch", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("does not create a duplicate record for Arizona Science Center — it was dropped after confirming its 'teens' page just points to the same general volunteer program an existing scraped source already covers", () => {
      expect(MANUAL_RECORDS.find((r) => r.slug === "arizona-science-center")).toBeUndefined();
    });

    it("3 link-confirmed records are open; Reid Park Zoo's Zoo Crew is seasonal (confirmed closed for 2026, reopens January 2027)", () => {
      expect(findOpp("desert-botanical-garden", "teens-in-the-garden")?.availabilityStatus).toBe("open");
      expect(findOpp("zooniverse", "citizen-science-volunteer")?.availabilityStatus).toBe("open");
      expect(findOpp("smithsonian-digital-volunteers", "digital-volunteer-transcription")?.availabilityStatus).toBe("open");
      expect(findOpp("reid-park-zoo", "zoo-crew-teen-volunteer")?.availabilityStatus).toBe("seasonal");
    });

    it("no application deadline or applicationOpenDate is invented for Reid Park Zoo — only the month (not a specific day) was confirmed, so the reopen fact lives in availabilityNote as free text", () => {
      const zooCrew = findOpp("reid-park-zoo", "zoo-crew-teen-volunteer");
      expect(zooCrew?.applicationDeadline).toBeNull();
      expect(zooCrew?.applicationOpenDate).toBeUndefined();
      expect(zooCrew?.availabilityNote).toMatch(/January 2027/);
    });

    it("no application deadline is invented for any of the 4 records — none published one", () => {
      const pairs: [string, string][] = [
        ["desert-botanical-garden", "teens-in-the-garden"],
        ["reid-park-zoo", "zoo-crew-teen-volunteer"],
        ["zooniverse", "citizen-science-volunteer"],
        ["smithsonian-digital-volunteers", "digital-volunteer-transcription"],
      ];
      for (const [orgSlug, suffix] of pairs) {
        expect(findOpp(orgSlug, suffix)?.applicationDeadline).toBeNull();
      }
    });

    it("never claims a confirmed background check or parental-consent requirement for any of the 4 records — none was independently confirmed", () => {
      const pairs: [string, string][] = [
        ["desert-botanical-garden", "teens-in-the-garden"],
        ["reid-park-zoo", "zoo-crew-teen-volunteer"],
        ["zooniverse", "citizen-science-volunteer"],
        ["smithsonian-digital-volunteers", "digital-volunteer-transcription"],
      ];
      for (const [orgSlug, suffix] of pairs) {
        expect(findOpp(orgSlug, suffix)?.backgroundCheckRequired).toBeUndefined();
        expect(findOpp(orgSlug, suffix)?.parentalConsentRequired).toBeUndefined();
      }
    });

    it("only Zooniverse and the Smithsonian's records use virtual delivery; the 2 real physical locations default to in_person", () => {
      expect(findOpp("zooniverse", "citizen-science-volunteer")?.deliveryMode).toBe("virtual");
      expect(findOpp("smithsonian-digital-volunteers", "digital-volunteer-transcription")?.deliveryMode).toBe("virtual");
      expect(findOpp("desert-botanical-garden", "teens-in-the-garden")?.deliveryMode).toBeUndefined();
      expect(findOpp("reid-park-zoo", "zoo-crew-teen-volunteer")?.deliveryMode).toBeUndefined();
    });

    it("the 2 in-person records carry real, geocodable street addresses, not a null/placeholder location", () => {
      expect(findOpp("desert-botanical-garden", "teens-in-the-garden")?.zip).toBe("85008");
      expect(findOpp("reid-park-zoo", "zoo-crew-teen-volunteer")?.zip).toBe("85716");
    });

    it("the 2 virtual records are deliberately not geocoded (genuinely global platforms, no real address)", () => {
      expect(findOpp("zooniverse", "citizen-science-volunteer")?.zip).toBeNull();
      expect(findOpp("smithsonian-digital-volunteers", "digital-volunteer-transcription")?.zip).toBeNull();
    });

    it("uses only existing taxonomy — Desert Botanical Garden and Reid Park Zoo carry both their primary category's tag and 'stem', per the approved instruction", () => {
      expect(findOpp("desert-botanical-garden", "teens-in-the-garden")?.interestsTags).toEqual(
        expect.arrayContaining(["environment", "stem"])
      );
      expect(findOpp("reid-park-zoo", "zoo-crew-teen-volunteer")?.interestsTags).toEqual(
        expect.arrayContaining(["animals", "stem"])
      );
      expect(findOpp("zooniverse", "citizen-science-volunteer")?.interestsTags).toEqual(["stem"]);
      expect(findOpp("smithsonian-digital-volunteers", "digital-volunteer-transcription")?.interestsTags).toEqual(
        expect.arrayContaining(["stem", "education"])
      );
    });

    it("Desert Botanical Garden's teen-specific application form is distinct from its general (18+) volunteer form", () => {
      const dbg = findOpp("desert-botanical-garden", "teens-in-the-garden");
      expect(dbg?.applicationUrl).toBe("https://www.volgistics.com/appform/1208246188");
      expect(dbg?.applicationUrl).not.toBe("https://www.volgistics.com/appform/1776089558");
    });

    it("categories match the approved taxonomy exactly: Environment, Animals, STEM, STEM", () => {
      expect(MANUAL_RECORDS.find((r) => r.slug === "desert-botanical-garden")?.opportunities[0].category).toBe("Environment");
      expect(MANUAL_RECORDS.find((r) => r.slug === "reid-park-zoo")?.opportunities[0].category).toBe("Animals");
      expect(MANUAL_RECORDS.find((r) => r.slug === "zooniverse")?.opportunities[0].category).toBe("STEM");
      expect(MANUAL_RECORDS.find((r) => r.slug === "smithsonian-digital-volunteers")?.opportunities[0].category).toBe("STEM");
    });
  });

  describe("2026-08-31 autonomous session additions — never self-approved", () => {
    const NEW_THIS_SESSION: [string, string][] = [
      ["reid-park-zoo", "outdoor-aviary-monitor"],
      ["habitat-for-humanity-central-arizona", "general-construction"],
      ["habitat-for-humanity-tucson", "construction-chuck-habistore"],
      ["tucson-police-department", "explorer-post-180"],
      ["pima-animal-care-center", "dog-walkers"],
      ["pima-animal-care-center", "adoption-counselors"],
      ["pima-animal-care-center", "administrative-support"],
      ["pima-animal-care-center", "greeter-crew"],
      ["pima-animal-care-center", "transport"],
      ["pima-animal-care-center", "bin-buddies"],
      ["pima-animal-care-center", "medical-cat-care-assistant"],
      ["pima-animal-care-center", "special-event-volunteers"],
      ["pima-animal-care-center", "family-volunteer-program"],
      ["pima-county-health-department", "counter-strike-program"],
      ["yuma-county-library-district", "teen-volunteer"],
      ["banner-heart-hospital", "teen-volunteer-application"],
      ["banner-baywood-medical-center", "teen-volunteer-application"],
      ["banner-boswell-medical-center", "teen-volunteer-program"],
      ["banner-del-e-webb-medical-center", "teen-volunteer-program"],
      ["banner-goldfield-medical-center", "teen-volunteer-program"],
      ["banner-ironwood-medical-center", "teen-volunteer-program"],
      ["banner-ocotillo-medical-center", "teen-volunteer-application"],
      ["banner-thunderbird-medical-center", "teen-volunteer-application"],
      ["banner-estrella-medical-center", "jr-teen-volunteer-application"],
      ["banner-university-medical-center-tucson", "volunteer"],
      ["northern-arizona-healthcare", "teen-volunteer-program"],
      ["onvida-health", "junior-volunteer-program"],
      // Nationwide-expansion pass, same "staged pending, never
      // self-approved" discipline — see the dedicated describe block
      // below for the fuller per-hospital assertions.
      ["north-shore-university-hospital", "junior-volunteer-program"],
      ["huntington-hospital-ny", "junior-volunteer-program"],
      ["lenox-hill-hospital", "junior-volunteer-program"],
      ["cohen-childrens-medical-center", "junior-volunteer-summer-program"],
      ["phelps-hospital", "junior-volunteer-program"],
      ["mather-hospital", "summer-junior-volunteer-placement"],
      ["university-of-colorado-hospital", "junior-volunteer-program"],
      ["uchealth-highlands-ranch-hospital", "teen-volunteer-application"],
      ["san-jose-public-library-king-library-youth-services", "teen-authors-corner"],
      ["san-jose-public-library-king-library-youth-services", "teen-library-volunteer"],
      ["san-jose-public-library-king-library-youth-services", "teens-reach"],
      ["san-jose-public-library-king-library-youth-services", "teen-book-reviewer"],
      ["san-jose-public-library-king-library-youth-services", "youth-advisory-council"],
      // Phase 2 continuation.
      ["glen-cove-hospital", "junior-volunteer-program"],
      ["mount-sinai-south-nassau", "junior-volunteer-program"],
      ["cleveland-clinic-avon-hospital", "junior-volunteer-application"],
      ["long-beach-parks-recreation-marine", "teen-volunteers-ages-13-17"],
      // Phase 2 continuation, third wave.
      ["baylor-scott-white-temple", "junior-volunteer-ambassador"],
      ["baylor-scott-white-grapevine", "junior-volunteer-program"],
      ["harris-health", "junior-volunteer-program"],
      ["santa-barbara-cottage-hospital", "volunteer-application"],
      ["virtua-health", "junior-volunteer-applications"],
      // Phase 2 continuation, fourth wave.
      ["long-island-jewish-forest-hills", "junior-volunteer-program"],
      ["long-island-jewish-medical-center", "summer-junior-volunteer-program"],
      ["long-island-jewish-valley-stream", "junior-volunteer-program"],
      ["peconic-bay-medical-center", "junior-volunteer-program"],
      ["king-county-library-system", "burien-tech-tutor"],
      // Phase 2 continuation, fifth wave.
      ["fremont-main-library", "seed-library"],
      ["fremont-main-library", "virtual-book-reviewer"],
      // Sixth wave: Nuvance Health hospitals.
      ["danbury-hospital", "student-volunteer-application"],
      ["new-milford-hospital", "student-volunteer-application"],
      ["sharon-hospital", "student-volunteer-application"],
      ["northern-dutchess-hospital", "student-volunteer-application"],
      ["norwalk-hospital", "student-volunteer-application"],
      ["putnam-hospital-center", "junior-volunteer-application"],
      ["vassar-brothers-medical-center", "student-volunteer-application"],
      // Seventh wave: Alameda County Library branches.
      ["albany-library", "dd-campaign-leader"],
      ["albany-library", "general-volunteering-books"],
      ["centerville-library", "teen-advisory-board"],
      ["dublin-library", "teen-volunteer-orientation"],
      ["newark-library-ca", "teen-advisory-group"],
      ["union-city-library", "teen-advisory-group"],
      // Arizona-priority batch.
      ["united-food-bank", "volunteer-independently-16-17"],
      ["arizona-humane-society", "humane-teens"],
      // High-yield nationwide batch: NewYork-Presbyterian (11 campuses).
      ["nyp-allen-hospital", "volunteer-program"],
      ["nyp-brooklyn-methodist", "volunteer-program"],
      ["nyp-columbia", "volunteer-program"],
      ["nyp-gracie-square", "volunteer-program"],
      ["nyp-hudson-valley", "volunteer-program"],
      ["nyp-lower-manhattan", "volunteer-program"],
      ["nyp-morgan-stanley-childrens", "volunteer-program"],
      ["nyp-queens", "volunteer-program"],
      ["nyp-weill-cornell", "volunteer-program"],
      ["nyp-westchester", "volunteer-program"],
      ["nyp-westchester-behavioral-health", "volunteer-program"],
      // Wellstar Health System (6 GA hospitals).
      ["wellstar-cobb", "volunteen-program"],
      ["wellstar-paulding", "volunteen-program"],
      ["wellstar-kennestone", "volunteen-program"],
      ["wellstar-north-fulton", "volunteen-program"],
      ["wellstar-west-georgia", "volunteen-program"],
      ["wellstar-mcg", "volunteen-program"],
      // Geisinger (4 PA hospitals).
      ["geisinger-community-medical-center", "junior-volunteer-program"],
      ["geisinger-lewistown-hospital", "junior-volunteer-program"],
      ["geisinger-medical-center-danville", "junior-volunteer-program"],
      ["geisinger-wyoming-valley-medical-center", "junior-volunteer-program"],
      // Habitat for Humanity (3 new affiliates).
      ["habitat-for-humanity-twin-cities", "construction-home-repair-volunteer"],
      ["habitat-for-humanity-twin-cities", "restore-one-day-at-a-time-volunteer"],
      ["habitat-for-humanity-seattle-king-kittitas", "construction-habitat-stores-volunteer"],
      ["habitat-for-humanity-greater-los-angeles", "build-construction-volunteer"],
      ["habitat-for-humanity-greater-los-angeles", "restore-youth-volunteer"],
      // AZ municipal batch.
      ["tempe-volunteer-program", "youth-volunteer-program"],
      ["goodyear-parks-recreation", "grc-u"],
      ["goodyear-parks-recreation", "junior-leader-volunteer"],
      ["goodyear-police-youth-cadet", "police-youth-cadet-program"],
      ["prescott-public-library", "teen-advisory-group"],
      ["prescott-recreation-services", "teen-task-force"],
      ["avondale-public-library", "teen-volunteer-program"],
      ["avondale-neighborhood-family-services", "avondale-youth-advisory-council"],
      ["buckeye-library-museum", "teen-volunteer-application"],
      ["yuma-police-explorers", "police-explorers"],
      ["chandler-leaders-in-training", "leaders-in-training"],
      ["glendale-police-cadets", "police-cadets-explorers"],
      ["gilbert-police-cadets", "police-cadet-program"],
      ["mesa-police-cadets", "cadet-post-2055"],
      ["maricopa-county-elections", "student-election-program"],
      // Phase 2 platform-discovery continuation.
      ["trinity-health-grand-rapids", "junior-volunteer"],
      ["trinity-health-muskegon", "junior-volunteer"],
      ["virtua-voorhees", "junior-volunteer"],
      ["baylor-scott-white-mckinney", "junior-volunteer"],
      ["ascension-providence-waco", "junior-volunteer"],
      // Ascension platform build-out.
      ["ascension-sacred-heart-bay", "junior-volunteer"],
      ["ascension-sacred-heart-emerald-coast", "junior-volunteer"],
      ["ascension-sacred-heart-gulf", "junior-volunteer"],
      ["ascension-sacred-heart-pensacola", "junior-volunteer"],
      ["ascension-st-vincents-clay-county", "junior-volunteer"],
      ["ascension-st-vincents-riverside", "junior-volunteer"],
      ["ascension-st-vincents-southside", "junior-volunteer"],
      ["ascension-st-vincents-st-johns", "junior-volunteer"],
      ["ascension-saint-thomas-west", "junior-volunteer"],
      ["ascension-saint-thomas-rutherford", "junior-volunteer"],
      // Communico direct-verification batch.
      ["ocean-county-library", "teen-volunteer-program"],
      ["gail-borden-public-library", "teen-volunteer-program"],
      ["pasco-county-libraries", "teen-volunteer"],
      ["york-county-libraries", "teen-volunteer"],
      // Volgistics platform-discovery batch.
      ["rockwood-park-museum", "youth-volunteer"],
      ["irvine-public-library", "teen-volunteer-program"],
      // Samaritan + off-target Volgistics-search finds.
      ["city-of-santa-clarita-trail-volunteers", "bike-park-workdays"],
      ["howard-county-recreation-parks", "mpea-conservation-stewardship"],
      ["canby-public-library", "library-volunteer"],
      ["three-rivers-park-district", "counselor-in-training"],
      ["forsyth-county-public-library", "library-volunteer"],
      // Deeper Samaritan pass + humane-society sweep.
      ["prince-georges-parks-recreation", "summer-playtime-volunteer"],
      ["metropolitan-library-system-okc", "library-volunteer"],
      ["nebraska-humane-society", "youth-volunteer-day"],
      // Arizona sweep.
      ["goodyear-youth-commission", "youth-commission"],
      ["chandler-center-for-the-arts", "volunteer-usher-greeter"],
      // Volgistics platform sweep (site:volgistics.com/od "Age 1X" search).
      ["the-river-food-pantry", "pantry-assistant-walkups"],
      ["the-river-food-pantry", "cooler-recovery-assistant"],
      ["the-river-food-pantry", "client-registration-assistant"],
      ["poudre-river-public-library-district", "tween-night-volunteer"],
      ["poudre-river-public-library-district", "fiesta-familiar-de-loteria-volunteer"],
      ["cabell-huntington-hospital", "volunteen-program"],
      ["virginia-living-museum", "education-interpretation-volunteer"],
      ["virginia-living-museum", "green-teens"],
      ["iu-health-west-hospital", "care-volunteer"],
      ["iu-health-west-hospital", "welcome-desk-guest-ambassador"],
      ["faas-alameda-animal-shelter", "canine-support"],
      ["faas-alameda-animal-shelter", "small-creature-support"],
      ["faas-alameda-animal-shelter", "shelter-support"],
      ["help-of-southern-nevada", "turkey-food-bag-distribution"],
      ["city-of-southlake-teen-court", "teen-jury-member"],
      // Communico platform sweep (site:librarymarket.com and
      // site:libnet.info searches for explicit teen ages).
      ["montgomery-county-public-libraries-md-general", "library-volunteer-general"],
      ["rapid-city-public-library", "library-volunteer"],
      ["hiawatha-public-library", "library-volunteer"],
      ["carroll-county-public-library", "library-volunteer"],
      ["carroll-county-public-library", "teen-advisory-board"],
      ["dallas-public-library", "book-master"],
      ["dallas-public-library", "teen-advisory-council"],
      ["dallas-public-library", "summer-book-buddies"],
      ["fairfield-public-library-ct", "teen-council"],
      ["fairfield-public-library-ct", "content-creation-reviews"],
      ["clearwater-public-library-system", "teen-volunteer"],
      ["faulkner-county-library-system", "teen-volunteer-program"],
      ["pueblo-city-county-library", "teen-library-volunteer"],
      ["pueblo-city-county-library", "teen-library-connections"],
      ["delaware-county-district-library", "teen-volunteer"],
      ["delaware-county-district-library", "teen-advisory-board"],
      ["altadena-library-district", "teen-volunteer"],
      ["la-county-library", "library-volunteer"],
      ["los-angeles-public-library", "teen-volunteer"],
      ["los-angeles-public-library", "teen-council"],
      ["los-angeles-public-library", "teens-leading-change"],
      // Arizona library gap-check.
      ["peoria-public-library-az", "summer-teen-volunteer-book-buddies"],
      ["surprise-public-library", "the-bookworms-teen-advisory-board"],
      ["maricopa-county-library-district", "teen-volunteer"],
      // Wave A continuation (Volgistics sweep, more search angles) —
      // independently re-verified via WebFetch against each org's own
      // current domain on 2026-09-03 and promoted to approved; no longer
      // tracked here. aurora-public-library-co was resolved and approved
      // in a later pass (the applicationUrl 404 was a missing path
      // segment, not a real restructuring; the city's own Samaritan
      // portal independently corroborates age 13). the-open-door-pantry
      // was independently re-verified against its own current page in
      // the same later pass — verbatim match, working application link.
      // Second Communico age-phrase pass + humane-society sweep +
      // Arizona depth pass — all independently re-verified via WebFetch
      // (Queen Creek via cross-corroborated search of the same
      // first-party domain, its own page 403s to direct fetch) and
      // promoted to approved; no longer tracked here.
      // General search pass — independently re-verified via WebFetch and
      // promoted to approved; no longer tracked here.
      // Arizona depth pass continuation — independently re-verified and
      // promoted to approved; no longer tracked here.
      // Canonical-taxonomy Healthcare + Education source-research batches
      // (2026-09-05) — reviewed the same day: Maricopa County Public
      // Health's two records were approved and are no longer tracked
      // here; Active Minds, OHSU School of Dentistry, and MentorKids USA
      // were rejected as not clearly volunteer-based and removed from
      // this file entirely (see the comment above the Maricopa County
      // Public Health record).
      // High-demand-focus research batch (2026-09-05, revised coverage
      // strategy) — Teen Lifeline's two records were re-verified
      // directly against the organization's own pages on 2026-09-06 and
      // approved; no longer tracked here.
    ];

    it("every opportunity discovered this session is staged reviewStatus: 'pending', never 'approved'", () => {
      for (const [slug, suffix] of NEW_THIS_SESSION) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        const opp = record?.opportunities.find((o) => o.externalIdSuffix === suffix);
        expect(opp, `${slug}/${suffix} should exist`).toBeDefined();
        expect(opp?.reviewStatus, `${slug}/${suffix} must not self-approve`).toBe("pending");
      }
    });

    it("every opportunity NOT discovered this session is unaffected — reviewStatus stays undefined (defaults to approved)", () => {
      const newSet = new Set(NEW_THIS_SESSION.map(([slug, suffix]) => `${slug}/${suffix}`));
      for (const record of MANUAL_RECORDS) {
        for (const opp of record.opportunities) {
          if (newSet.has(`${record.slug}/${opp.externalIdSuffix}`)) continue;
          expect(opp.reviewStatus, `${record.slug}/${opp.externalIdSuffix} predates review gating`).toBeUndefined();
        }
      }
    });

    it("Habitat Central Arizona's General Construction age evidence is independently confirmed at 16+, never guessed; ReStore isn't duplicated here since it's already approved under a different source", () => {
      const habitatCaz = MANUAL_RECORDS.find((r) => r.slug === "habitat-for-humanity-central-arizona");
      expect(habitatCaz?.opportunities.find((o) => o.externalIdSuffix === "general-construction")?.minimumAge).toBe(16);
      expect(habitatCaz?.opportunities.find((o) => o.externalIdSuffix === "restore-volunteer")).toBeUndefined();
      expect(habitatCaz?.opportunities).toHaveLength(1);
    });

    it("Habitat Tucson's ambiguous accompanied-minor role (Brush With Kindness) is deliberately excluded, not guessed at", () => {
      const habitatTucson = MANUAL_RECORDS.find((r) => r.slug === "habitat-for-humanity-tucson");
      expect(habitatTucson?.opportunities).toHaveLength(1);
      expect(habitatTucson?.opportunities[0].externalIdSuffix).toBe("construction-chuck-habistore");
    });

    it("Phoenix Zoo is deliberately not present as its own record — its ZooTeens program duplicated an already-approved opportunity from a prior session, merged rather than re-added", () => {
      expect(MANUAL_RECORDS.find((r) => r.slug === "phoenix-zoo")).toBeUndefined();
    });
  });

  describe("second 2026-08-31 session: Tucson/Pima County municipal-hub research", () => {
    const pacc = () => MANUAL_RECORDS.find((r) => r.slug === "pima-animal-care-center");

    it("Pima Animal Care Center has 9 distinct roles: 8 independent (16+) plus 1 separate accompanied-minor role (13+/real evidence 12+), never merged into one", () => {
      const opps = pacc()?.opportunities ?? [];
      expect(opps).toHaveLength(9);
      const independent = opps.filter((o) => o.minimumAge === 16);
      const accompanied = opps.filter((o) => o.externalIdSuffix === "family-volunteer-program");
      expect(independent).toHaveLength(8);
      expect(accompanied).toHaveLength(1);
    });

    it("PACC's accompanied-minor role (12-15, real-time parent supervision) is never conflated with the 16-17 independent roles — different minimumAge, both consent-flagged", () => {
      const family = pacc()?.opportunities.find((o) => o.externalIdSuffix === "family-volunteer-program");
      const dogWalkers = pacc()?.opportunities.find((o) => o.externalIdSuffix === "dog-walkers");
      expect(family?.minimumAge).toBe(13);
      expect(dogWalkers?.minimumAge).toBe(16);
      expect(family?.parentalConsentRequired).toBe(true);
      expect(dogWalkers?.parentalConsentRequired).toBe(true);
      // The real distinction this platform has no dedicated schema field
      // for (per ARCHITECTURE.md's Special Olympics AZ precedent) — an
      // up-front waiver (16-17) vs. continuous in-shift supervision
      // (12-15) — must be disclosed in the description text, not just
      // implied by the age number alone.
      expect(family?.description).toMatch(/entire time/i);
    });

    it("Pima County Health Department's Counter Strike Program is staged unverified, not open — undated-freshness source, per this platform's own convention", () => {
      const counterStrike = MANUAL_RECORDS.find((r) => r.slug === "pima-county-health-department")?.opportunities[0];
      expect(counterStrike?.availabilityStatus).toBe("unverified");
      expect(counterStrike?.minimumAge).toBe(14);
    });

    it("Tucson Police Explorer Post 180 and Yuma County Library District's Teen Volunteer both have explicit, non-inferred numeric age evidence", () => {
      const explorer = MANUAL_RECORDS.find((r) => r.slug === "tucson-police-department")?.opportunities[0];
      const yuma = MANUAL_RECORDS.find((r) => r.slug === "yuma-county-library-district")?.opportunities[0];
      expect(explorer?.minimumAge).toBe(14);
      expect(yuma?.minimumAge).toBe(14);
      expect(explorer?.eligibleGrades).toBeTruthy();
      expect(yuma?.eligibleGrades).toBeTruthy();
    });
  });

  describe("third 2026-08-31 session: Banner Health statewide teen-volunteer batch", () => {
    const BANNER_SLUGS = [
      "banner-heart-hospital",
      "banner-baywood-medical-center",
      "banner-boswell-medical-center",
      "banner-del-e-webb-medical-center",
      "banner-goldfield-medical-center",
      "banner-ironwood-medical-center",
      "banner-ocotillo-medical-center",
      "banner-thunderbird-medical-center",
      "banner-estrella-medical-center",
      "banner-university-medical-center-tucson",
    ];

    it("all 10 new Banner facilities exist, each with exactly 1 opportunity, each pending", () => {
      for (const slug of BANNER_SLUGS) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
    });

    it("age evidence varies genuinely by facility, never uniformly assumed — Heart/Baywood are 14+, the rest are 16+", () => {
      const fourteenPlus = ["banner-heart-hospital", "banner-baywood-medical-center"];
      const sixteenPlus = BANNER_SLUGS.filter((s) => !fourteenPlus.includes(s));
      for (const slug of fourteenPlus) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].minimumAge).toBe(14);
      }
      for (const slug of sixteenPlus) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].minimumAge).toBe(16);
      }
    });

    it("does not duplicate or modify the pre-existing (pre-2026-08-31) Banner records — Banner Desert, Banner Children's at Desert, and the paused Banner-UMC Phoenix stay exactly as they were", () => {
      const desert = MANUAL_RECORDS.find((r) => r.slug === "banner-desert-medical-center");
      expect(desert?.opportunities).toHaveLength(2);
      expect(desert?.opportunities.every((o) => o.reviewStatus === undefined)).toBe(true);

      const umcPhoenix = MANUAL_RECORDS.find((r) => r.slug === "banner-university-medical-center-phoenix");
      expect(umcPhoenix?.opportunities[0].availabilityStatus).toBe("paused");
      expect(umcPhoenix?.opportunities[0].reviewStatus).toBeUndefined();

      // Banner - University Medical Center Tucson (new this session) is a
      // genuinely different city/market from Banner - University Medical
      // Center Phoenix (pre-existing, paused) -- never conflated.
      const umcTucson = MANUAL_RECORDS.find((r) => r.slug === "banner-university-medical-center-tucson");
      expect(umcTucson?.city).toBe("Tucson, AZ");
      expect(umcPhoenix?.city).toBe("Phoenix, AZ");
    });

    it("every Banner facility's application_url is either its own bannerhealth.com page or its own distinct Volgistics form — no two facilities share the same application_url", () => {
      const urls = BANNER_SLUGS.map((slug) => MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].applicationUrl);
      expect(new Set(urls).size).toBe(urls.length);
    });
  });

  describe("fourth 2026-08-31 session: additional AZ healthcare systems", () => {
    it("Northern Arizona Healthcare (Flagstaff) and Onvida Health (Yuma) both have explicit, independently-confirmed numeric age evidence, not inferred from each other or from Banner's pattern", () => {
      const nah = MANUAL_RECORDS.find((r) => r.slug === "northern-arizona-healthcare")?.opportunities[0];
      const onvida = MANUAL_RECORDS.find((r) => r.slug === "onvida-health")?.opportunities[0];
      expect(nah?.minimumAge).toBe(16);
      expect(onvida?.minimumAge).toBe(15);
      expect(nah?.reviewStatus).toBe("pending");
      expect(onvida?.reviewStatus).toBe("pending");
    });

    it("Dignity Health Arizona is deliberately NOT present — every AZ teen program (Chandler Regional, Mercy Gilbert, St. Joseph's) was confirmed currently closed/paused, not stageable as open", () => {
      const chr = ["dignity-health", "chandler-regional", "mercy-gilbert", "st-josephs", "dignity-health-arizona"];
      for (const slug of chr) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)).toBeUndefined();
      }
    });

    it("Tucson Medical Center and Yavapai/other adult-only or currently-inactive hospital programs found this session are not present", () => {
      expect(MANUAL_RECORDS.find((r) => r.slug === "tucson-medical-center")).toBeUndefined();
    });
  });

  describe("nationwide-expansion pass: first non-Arizona hospital-network batch (6 Northwell Health NY + 2 UCHealth CO)", () => {
    const NATIONWIDE_HOSPITAL_SLUGS = [
      "north-shore-university-hospital",
      "huntington-hospital-ny",
      "lenox-hill-hospital",
      "cohen-childrens-medical-center",
      "phelps-hospital",
      "mather-hospital",
      "university-of-colorado-hospital",
      "uchealth-highlands-ranch-hospital",
    ];

    it("all 8 new hospitals exist, each with exactly 1 opportunity, each pending — never self-approved", () => {
      for (const slug of NATIONWIDE_HOSPITAL_SLUGS) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
    });

    it("age evidence varies genuinely by hospital, never uniformly assumed across the batch", () => {
      const expectedAges: Record<string, number> = {
        "north-shore-university-hospital": 15,
        "huntington-hospital-ny": 14,
        "lenox-hill-hospital": 16,
        "cohen-childrens-medical-center": 15,
        "phelps-hospital": 16,
        "mather-hospital": 15,
        "university-of-colorado-hospital": 16,
        "uchealth-highlands-ranch-hospital": 16,
      };
      for (const [slug, age] of Object.entries(expectedAges)) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].minimumAge, slug).toBe(age);
      }
    });

    it("current status is honestly per-hospital, not defaulted to 'open' — 3 seasonal (narrow date-gated windows), 1 paused (explicit waitlist), 4 open (standing/rolling-cohort programs)", () => {
      const expectedStatus: Record<string, string> = {
        "north-shore-university-hospital": "seasonal",
        "huntington-hospital-ny": "paused",
        "lenox-hill-hospital": "open",
        "cohen-childrens-medical-center": "seasonal",
        "phelps-hospital": "open",
        "mather-hospital": "seasonal",
        "university-of-colorado-hospital": "open",
        "uchealth-highlands-ranch-hospital": "open",
      };
      for (const [slug, status] of Object.entries(expectedStatus)) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].availabilityStatus, slug).toBe(status);
      }
    });

    it("Huntington's explicit application pause is quoted, not paraphrased into a guess", () => {
      const huntington = MANUAL_RECORDS.find((r) => r.slug === "huntington-hospital-ny")?.opportunities[0];
      expect(huntington?.availabilityNote).toMatch(/currently pausing new applications/);
    });

    it("every hospital's application_url is its own distinct VSys One page — no two hospitals share the same application_url", () => {
      const urls = NATIONWIDE_HOSPITAL_SLUGS.map(
        (slug) => MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].applicationUrl
      );
      expect(new Set(urls).size).toBe(urls.length);
    });

    it("each hospital has its own real, distinct geocodable address — never a shared or placeholder location", () => {
      const locations = NATIONWIDE_HOSPITAL_SLUGS.map(
        (slug) => MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].location
      );
      expect(new Set(locations).size).toBe(locations.length);
      for (const loc of locations) expect(loc).toBeTruthy();
    });
  });

  describe("nationwide-expansion pass: San José Public Library — King Library Youth Services", () => {
    const sjpl = () => MANUAL_RECORDS.find((r) => r.slug === "san-jose-public-library-king-library-youth-services");

    it("has exactly 5 opportunities, each pending — never self-approved", () => {
      const opps = sjpl()?.opportunities ?? [];
      expect(opps).toHaveLength(5);
      for (const opp of opps) expect(opp.reviewStatus).toBe("pending");
    });

    it("every opportunity's minimum age is the explicit 'Qualifications Required Age' figure from its own activity page — all 13, none guessed higher or lower", () => {
      for (const opp of sjpl()?.opportunities ?? []) {
        expect(opp.minimumAge, opp.externalIdSuffix).toBe(13);
      }
    });

    it("ChAD 60 Homework Coach is deliberately excluded — its 15+ age floor is real, but it also requires being an enrolled SJSU ChAD student, not independently actionable for a general teen applicant", () => {
      expect(sjpl()?.opportunities.find((o) => o.externalIdSuffix === "chad-60-homework-coach")).toBeUndefined();
    });

    it("Teen Book Reviewer is the only virtual role in this batch — deliberately left ungeocoded (no physical address published), the other four are real in-person addresses", () => {
      const reviewer = sjpl()?.opportunities.find((o) => o.externalIdSuffix === "teen-book-reviewer");
      expect(reviewer?.deliveryMode).toBe("virtual");
      expect(reviewer?.zip).toBeNull();
      expect(reviewer?.geocodeCity).toBeNull();

      const inPerson = sjpl()?.opportunities.filter((o) => o.externalIdSuffix !== "teen-book-reviewer") ?? [];
      expect(inPerson).toHaveLength(4);
      for (const opp of inPerson) {
        expect(opp.zip, opp.externalIdSuffix).toBeTruthy();
        expect(opp.deliveryMode).not.toBe("virtual");
      }
    });

    it("every opportunity's application_url is its own distinct activity detail page — no two share the same URL", () => {
      const urls = (sjpl()?.opportunities ?? []).map((o) => o.applicationUrl);
      expect(new Set(urls).size).toBe(urls.length);
    });
  });

  describe("Phase 2 continuation: Glen Cove Hospital + Mount Sinai South Nassau", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("both hospitals exist, each with exactly 1 opportunity, each pending — never self-approved", () => {
      for (const slug of ["glen-cove-hospital", "mount-sinai-south-nassau"]) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
    });

    it("Glen Cove (16-18, standing/open) and Mount Sinai South Nassau (15-17, currently closed) have genuinely different age evidence and status, never uniformly assumed", () => {
      const glenCove = findOpp("glen-cove-hospital", "junior-volunteer-program");
      const southNassau = findOpp("mount-sinai-south-nassau", "junior-volunteer-program");
      expect(glenCove?.minimumAge).toBe(16);
      expect(glenCove?.availabilityStatus).toBe("open");
      expect(southNassau?.minimumAge).toBe(15);
      expect(southNassau?.availabilityStatus).toBe("seasonal");
      expect(southNassau?.availabilityNote).toMatch(/now closed/);
    });

    it("both hospitals' application_urls are distinct real pages — no shared or fabricated link", () => {
      const glenCove = findOpp("glen-cove-hospital", "junior-volunteer-program");
      const southNassau = findOpp("mount-sinai-south-nassau", "junior-volunteer-program");
      expect(glenCove?.applicationUrl).not.toBe(southNassau?.applicationUrl);
      expect(glenCove?.applicationUrl).toContain("vsyslive.com");
      expect(southNassau?.applicationUrl).toContain("mountsinai.org");
    });

    it("Mount Sinai's Student Research Volunteer program is deliberately NOT present — its own page requires an already-secured PI/lab placement before it will even process an application, failing the independently-actionable-role requirement", () => {
      expect(MANUAL_RECORDS.find((r) => r.slug === "mount-sinai-hospital-student-research")).toBeUndefined();
      expect(MANUAL_RECORDS.find((r) => r.slug === "mount-sinai-hospital")).toBeUndefined();
    });
  });

  describe("Phase 2 continuation, second wave: Cleveland Clinic Avon + City of Long Beach", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("both exist, each with exactly 1 opportunity, each pending — never self-approved", () => {
      for (const slug of ["cleveland-clinic-avon-hospital", "long-beach-parks-recreation-marine"]) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
    });

    it("Cleveland Clinic Avon (15-17) and Long Beach (13-17) have genuinely different, independently-confirmed age evidence", () => {
      const clinic = findOpp("cleveland-clinic-avon-hospital", "junior-volunteer-application");
      const longBeach = findOpp("long-beach-parks-recreation-marine", "teen-volunteers-ages-13-17");
      expect(clinic?.minimumAge).toBe(15);
      expect(longBeach?.minimumAge).toBe(13);
    });

    it("Long Beach's other 4 listed volunteer programs (Youth Sports Assistant, El Dorado Nature Center, Teen Center Programs, Senior Center Programs) are deliberately excluded — none states a numeric age", () => {
      const longBeach = MANUAL_RECORDS.find((r) => r.slug === "long-beach-parks-recreation-marine");
      expect(longBeach?.opportunities).toHaveLength(1);
      expect(longBeach?.opportunities[0].title).toContain("Ages 13-17");
    });
  });

  describe("Phase 2 continuation, third wave: Baylor Scott & White (Temple + Grapevine) + Harris Health + Santa Barbara Cottage Hospital + Virtua Health", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("all 5 exist, each with exactly 1 opportunity, each pending — never self-approved", () => {
      for (const slug of [
        "baylor-scott-white-temple",
        "baylor-scott-white-grapevine",
        "harris-health",
        "santa-barbara-cottage-hospital",
        "virtua-health",
      ]) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
    });

    it("Temple and Grapevine are genuinely distinct Baylor Scott & White campuses, not duplicates of each other", () => {
      const temple = MANUAL_RECORDS.find((r) => r.slug === "baylor-scott-white-temple");
      const grapevine = MANUAL_RECORDS.find((r) => r.slug === "baylor-scott-white-grapevine");
      expect(temple?.city).toBe("Temple, TX");
      expect(grapevine?.city).toBe("Grapevine, TX");
      expect(temple?.opportunities[0].location).not.toBe(grapevine?.opportunities[0].location);
    });

    it("Grapevine and Harris Health are correctly staged seasonal (closed/date-gated), not open — Temple, Santa Barbara Cottage, and Virtua are open", () => {
      expect(findOpp("baylor-scott-white-grapevine", "junior-volunteer-program")?.availabilityStatus).toBe("seasonal");
      expect(findOpp("harris-health", "junior-volunteer-program")?.availabilityStatus).toBe("seasonal");
      expect(findOpp("baylor-scott-white-temple", "junior-volunteer-ambassador")?.availabilityStatus).toBe("open");
      expect(findOpp("santa-barbara-cottage-hospital", "volunteer-application")?.availabilityStatus).toBe("open");
      expect(findOpp("virtua-health", "junior-volunteer-applications")?.availabilityStatus).toBe("open");
    });

    it("each has independently-confirmed, genuinely different minimum ages, never copied from another source", () => {
      expect(findOpp("baylor-scott-white-temple", "junior-volunteer-ambassador")?.minimumAge).toBe(16);
      expect(findOpp("baylor-scott-white-grapevine", "junior-volunteer-program")?.minimumAge).toBe(16);
      expect(findOpp("harris-health", "junior-volunteer-program")?.minimumAge).toBe(14);
      expect(findOpp("santa-barbara-cottage-hospital", "volunteer-application")?.minimumAge).toBe(14);
      expect(findOpp("virtua-health", "junior-volunteer-applications")?.minimumAge).toBe(14);
    });

    it("Harris Health's general 18+ volunteer floor is NOT applied to its Junior Volunteer Program — the program-specific 14+ figure is used instead", () => {
      const harris = findOpp("harris-health", "junior-volunteer-program");
      expect(harris?.minimumAge).toBe(14);
      expect(harris?.minimumAge).not.toBe(18);
    });
  });

  describe("Phase 2 continuation, fourth wave: 4 more Northwell hospitals + King County Library System", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    it("all 5 exist, each with exactly 1 opportunity, each pending — never self-approved", () => {
      for (const slug of [
        "long-island-jewish-forest-hills",
        "long-island-jewish-medical-center",
        "long-island-jewish-valley-stream",
        "peconic-bay-medical-center",
        "king-county-library-system",
      ]) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
    });

    it("the 4 new Northwell hospitals are genuinely distinct campuses, not duplicates of each other or of the 7 already shipped", () => {
      const slugs = [
        "long-island-jewish-forest-hills",
        "long-island-jewish-medical-center",
        "long-island-jewish-valley-stream",
        "peconic-bay-medical-center",
        "north-shore-university-hospital",
        "huntington-hospital-ny",
        "lenox-hill-hospital",
        "cohen-childrens-medical-center",
        "phelps-hospital",
        "mather-hospital",
        "glen-cove-hospital",
      ];
      const locations = slugs.map((s) => MANUAL_RECORDS.find((r) => r.slug === s)?.opportunities[0]?.location);
      expect(new Set(locations).size).toBe(locations.length);
    });

    it("LIJ Medical Center and LIJ Valley Stream are correctly staged seasonal (explicit date-gated application windows) — Forest Hills and Peconic Bay are open", () => {
      expect(findOpp("long-island-jewish-medical-center", "summer-junior-volunteer-program")?.availabilityStatus).toBe("seasonal");
      expect(findOpp("long-island-jewish-valley-stream", "junior-volunteer-program")?.availabilityStatus).toBe("seasonal");
      expect(findOpp("long-island-jewish-forest-hills", "junior-volunteer-program")?.availabilityStatus).toBe("open");
      expect(findOpp("peconic-bay-medical-center", "junior-volunteer-program")?.availabilityStatus).toBe("open");
    });

    it("King County Library's 4 other candidate activities (2 bare-word 'Teen' council/board roles, 2 adult-only 18+ Tech Tutor roles) are deliberately excluded — only Burien Tech Tutor (15+) qualifies", () => {
      const kcls = MANUAL_RECORDS.find((r) => r.slug === "king-county-library-system");
      expect(kcls?.opportunities).toHaveLength(1);
      expect(kcls?.opportunities[0].title).toBe("Burien Tech Tutor");
      expect(kcls?.opportunities[0].minimumAge).toBe(15);
    });
  });

  describe("Phase 2 continuation, fifth wave: Fremont Main Library", () => {
    it("exists with exactly 2 opportunities, both pending — never self-approved", () => {
      const fremont = MANUAL_RECORDS.find((r) => r.slug === "fremont-main-library");
      expect(fremont).toBeDefined();
      expect(fremont?.opportunities).toHaveLength(2);
      for (const opp of fremont!.opportunities) {
        expect(opp.reviewStatus).toBe("pending");
      }
    });

    it("Seed Library (in-person, ages 12-18) and Virtual Book Reviewer (virtual, ages 13-17) have genuinely different delivery modes and ages", () => {
      const fremont = MANUAL_RECORDS.find((r) => r.slug === "fremont-main-library");
      const seedLibrary = fremont?.opportunities.find((o) => o.externalIdSuffix === "seed-library");
      const virtualReviewer = fremont?.opportunities.find((o) => o.externalIdSuffix === "virtual-book-reviewer");
      expect(seedLibrary?.minimumAge).toBe(12);
      expect(seedLibrary?.deliveryMode).toBeUndefined(); // defaults to in_person
      expect(virtualReviewer?.minimumAge).toBe(13);
      expect(virtualReviewer?.deliveryMode).toBe("virtual");
    });

    it("Fremont's other 3 candidate activities (English Buddies, Teen Advisory Group — both only 'High School Teen' with no number, and Booklegger — adult-only) are deliberately excluded", () => {
      const fremont = MANUAL_RECORDS.find((r) => r.slug === "fremont-main-library");
      const titles = fremont!.opportunities.map((o) => o.title);
      expect(titles).not.toContain("English Buddies");
      expect(titles).not.toContain("Teen Advisory Group");
      expect(titles).not.toContain("Booklegger Volunteer");
    });
  });

  describe("Sixth wave: Nuvance Health hospitals (Northwell Health affiliate, separate VSys One portal)", () => {
    const slugs = [
      "danbury-hospital",
      "new-milford-hospital",
      "sharon-hospital",
      "northern-dutchess-hospital",
      "norwalk-hospital",
      "putnam-hospital-center",
      "vassar-brothers-medical-center",
    ];

    it("all 7 exist, each with exactly 1 opportunity, each pending, each age 16 — never self-approved", () => {
      for (const slug of slugs) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
        expect(record?.opportunities[0].minimumAge).toBe(16);
      }
    });

    it("Danbury, New Milford, and Sharon share one application URL (a real shared-portal pattern, not a duplicate) — each is still a genuinely distinct physical hospital", () => {
      const danbury = MANUAL_RECORDS.find((r) => r.slug === "danbury-hospital");
      const newMilford = MANUAL_RECORDS.find((r) => r.slug === "new-milford-hospital");
      const sharon = MANUAL_RECORDS.find((r) => r.slug === "sharon-hospital");
      expect(danbury?.opportunities[0].applicationUrl).toBe(newMilford?.opportunities[0].applicationUrl);
      expect(newMilford?.opportunities[0].applicationUrl).toBe(sharon?.opportunities[0].applicationUrl);
      const locations = [danbury, newMilford, sharon].map((r) => r?.opportunities[0].location);
      expect(new Set(locations).size).toBe(3);
    });

    it("Northern Dutchess, Norwalk, Putnam, and Vassar Brothers each have their own distinct application URL", () => {
      const urls = ["northern-dutchess-hospital", "norwalk-hospital", "putnam-hospital-center", "vassar-brothers-medical-center"].map(
        (slug) => MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0].applicationUrl
      );
      expect(new Set(urls).size).toBe(4);
    });
  });

  describe("Seventh wave: Alameda County Library branches (excluding Fremont, already covered separately)", () => {
    it("all 5 branch orgs exist, each pending — never self-approved", () => {
      for (const slug of ["albany-library", "centerville-library", "dublin-library", "newark-library-ca", "union-city-library"]) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        for (const opp of record!.opportunities) {
          expect(opp.reviewStatus).toBe("pending");
        }
      }
    });

    it("Albany has exactly 2 distinct opportunities with different ages (14 vs 13); the other 4 branches have exactly 1 each", () => {
      const albany = MANUAL_RECORDS.find((r) => r.slug === "albany-library");
      expect(albany?.opportunities).toHaveLength(2);
      const ages = albany!.opportunities.map((o) => o.minimumAge).sort();
      expect(ages).toEqual([13, 14]);
      for (const slug of ["centerville-library", "dublin-library", "newark-library-ca", "union-city-library"]) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities).toHaveLength(1);
      }
    });

    it("does not duplicate Fremont Main Library's existing activities — no overlapping external_id/activityGuid across branches", () => {
      const allExternalIds = MANUAL_RECORDS.filter((r) =>
        ["albany-library", "centerville-library", "dublin-library", "newark-library-ca", "union-city-library", "fremont-main-library"].includes(r.slug)
      ).flatMap((r) => r.opportunities.map((o) => `${r.slug}-${o.externalIdSuffix}`));
      expect(new Set(allExternalIds).size).toBe(allExternalIds.length);
    });
  });

  describe("Arizona-priority batch: United Food Bank second role + Arizona Humane Society", () => {
    it("United Food Bank's new independent-16-17 role is a genuinely distinct external_id from its existing connector-sourced accompanied-minor role (different source, different suffix)", () => {
      const ufb = MANUAL_RECORDS.find((r) => r.slug === "united-food-bank");
      expect(ufb).toBeDefined();
      expect(ufb?.opportunities).toHaveLength(1);
      expect(ufb?.opportunities[0].externalIdSuffix).toBe("volunteer-independently-16-17");
      expect(ufb?.opportunities[0].minimumAge).toBe(16);
      expect(ufb?.opportunities[0].reviewStatus).toBe("pending");
    });

    it("Arizona Humane Society's Humane Teens program exists, pending, ages 14-17, with a real application deadline", () => {
      const ahs = MANUAL_RECORDS.find((r) => r.slug === "arizona-humane-society");
      expect(ahs).toBeDefined();
      expect(ahs?.opportunities).toHaveLength(1);
      const humaneTeens = ahs!.opportunities[0];
      expect(humaneTeens.reviewStatus).toBe("pending");
      expect(humaneTeens.minimumAge).toBe(14);
      expect(humaneTeens.applicationDeadline).toBe("2026-09-17");
      expect(humaneTeens.availabilityStatus).toBe("open");
    });

    it("HonorHealth and Phoenix Children's Hospital were already present before this batch (not duplicated) — both fully approved", () => {
      const honorhealth = MANUAL_RECORDS.find((r) => r.slug === "honorhealth");
      const phoenixChildrens = MANUAL_RECORDS.find((r) => r.slug === "phoenix-childrens-hospital");
      expect(honorhealth?.opportunities).toHaveLength(3);
      expect(phoenixChildrens?.opportunities).toHaveLength(2);
      // Every opportunity in these two pre-existing orgs predates review
      // gating (reviewStatus is undefined, defaulting to approved) —
      // confirming they were never touched by this session's edits.
      for (const opp of [...honorhealth!.opportunities, ...phoenixChildrens!.opportunities]) {
        expect(opp.reviewStatus).toBeUndefined();
      }
    });
  });

  describe("High-yield nationwide batch: NewYork-Presbyterian + Wellstar + Geisinger + 3 Habitat affiliates", () => {
    it("all 11 NewYork-Presbyterian campuses exist, pending, age 16, sharing one application URL (shared-portal, not a duplicate) — each a distinct location", () => {
      const slugs = [
        "nyp-allen-hospital", "nyp-brooklyn-methodist", "nyp-columbia", "nyp-gracie-square",
        "nyp-hudson-valley", "nyp-lower-manhattan", "nyp-morgan-stanley-childrens", "nyp-queens",
        "nyp-weill-cornell", "nyp-westchester", "nyp-westchester-behavioral-health",
      ];
      const urls = new Set<string>();
      const locations = new Set<string>();
      for (const slug of slugs) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities).toHaveLength(1);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
        expect(record?.opportunities[0].minimumAge).toBe(16);
        urls.add(record!.opportunities[0].applicationUrl!);
        locations.add(record!.opportunities[0].location!);
      }
      expect(urls.size).toBe(1); // one shared application URL
      expect(locations.size).toBe(11); // 11 genuinely distinct locations
    });

    it("Wellstar's 6 hospitals have genuinely different, independently-verified ages (not copy-pasted) — West Georgia is seasonal, the other 5 are open", () => {
      const ages: Record<string, number> = {
        "wellstar-cobb": 16, "wellstar-paulding": 16, "wellstar-kennestone": 16,
        "wellstar-north-fulton": 16, "wellstar-west-georgia": 14, "wellstar-mcg": 15,
      };
      for (const [slug, age] of Object.entries(ages)) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record?.opportunities[0].minimumAge, slug).toBe(age);
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
      }
      expect(MANUAL_RECORDS.find((r) => r.slug === "wellstar-west-georgia")?.opportunities[0].availabilityStatus).toBe("seasonal");
      expect(MANUAL_RECORDS.find((r) => r.slug === "wellstar-cobb")?.opportunities[0].availabilityStatus).toBe("open");
    });

    it("Geisinger's 4 hospitals all share one Junior Volunteer Program (one age, one shared application, one deadline) — a genuinely different shared-program shape than Wellstar's per-site variation", () => {
      const slugs = [
        "geisinger-community-medical-center", "geisinger-lewistown-hospital",
        "geisinger-medical-center-danville", "geisinger-wyoming-valley-medical-center",
      ];
      const urls = new Set<string>();
      for (const slug of slugs) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        expect(record?.opportunities[0].minimumAge).toBe(15);
        expect(record?.opportunities[0].availabilityStatus).toBe("seasonal");
        expect(record?.opportunities[0].applicationDeadline).toBe("2027-02-14");
        expect(record?.opportunities[0].reviewStatus).toBe("pending");
        urls.add(record!.opportunities[0].applicationUrl!);
      }
      expect(urls.size).toBe(1);
    });

    it("all 3 new Habitat for Humanity affiliates are genuinely distinct organizations from the existing Central Arizona and Tucson affiliates, each pending", () => {
      const slugs = [
        "habitat-for-humanity-twin-cities",
        "habitat-for-humanity-seattle-king-kittitas",
        "habitat-for-humanity-greater-los-angeles",
      ];
      for (const slug of slugs) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        for (const opp of record!.opportunities) {
          expect(opp.reviewStatus).toBe("pending");
        }
      }
      expect(MANUAL_RECORDS.find((r) => r.slug === "habitat-for-humanity-twin-cities")?.opportunities).toHaveLength(2);
      expect(MANUAL_RECORDS.find((r) => r.slug === "habitat-for-humanity-greater-los-angeles")?.opportunities).toHaveLength(2);
    });
  });

  describe("AZ municipal batch: parks/rec/library/police-cadet programs", () => {
    const findOpp = (orgSlug: string, suffix: string) =>
      MANUAL_RECORDS.find((r) => r.slug === orgSlug)?.opportunities.find((o) => o.externalIdSuffix === suffix);

    const ORG_SLUGS = [
      "tempe-volunteer-program",
      "goodyear-parks-recreation",
      "goodyear-police-youth-cadet",
      "prescott-public-library",
      "prescott-recreation-services",
      "avondale-public-library",
      "avondale-neighborhood-family-services",
      "buckeye-library-museum",
      "yuma-police-explorers",
      "chandler-leaders-in-training",
      "glendale-police-cadets",
      "gilbert-police-cadets",
      "mesa-police-cadets",
      "maricopa-county-elections",
    ];

    it("all 14 orgs exist, every opportunity pending — never self-approved", () => {
      for (const slug of ORG_SLUGS) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        expect(record, `${slug} should exist`).toBeDefined();
        for (const opp of record!.opportunities) {
          expect(opp.reviewStatus, `${slug}/${opp.externalIdSuffix}`).toBe("pending");
        }
      }
    });

    it("Goodyear Parks & Recreation has 2 genuinely distinct roles (GRC-U ages 13-15, Junior Leader ages 13-14); every other org has exactly 1", () => {
      const goodyear = MANUAL_RECORDS.find((r) => r.slug === "goodyear-parks-recreation");
      expect(goodyear?.opportunities).toHaveLength(2);
      for (const slug of ORG_SLUGS.filter((s) => s !== "goodyear-parks-recreation")) {
        expect(MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities).toHaveLength(1);
      }
    });

    it("Avondale Library is correctly staged seasonal (closed until July 2027), not open — a fork's claim it had reopened was independently re-checked live and refuted", () => {
      const avondale = findOpp("avondale-public-library", "teen-volunteer-program");
      expect(avondale?.availabilityStatus).toBe("seasonal");
      expect(avondale?.availabilityNote).toMatch(/2027/);
    });

    it("every other org in this batch is genuinely open (no other closures found)", () => {
      for (const slug of ORG_SLUGS.filter((s) => s !== "avondale-public-library")) {
        const record = MANUAL_RECORDS.find((r) => r.slug === slug);
        for (const opp of record!.opportunities) {
          expect(opp.availabilityStatus, `${slug}/${opp.externalIdSuffix}`).toBe("open");
        }
      }
    });

    it("Gilbert Police Cadet Program is independently confirmed distinct from the existing Better Impact Gilbert connector — no 'cadet' listing found there", () => {
      const gilbertCadet = MANUAL_RECORDS.find((r) => r.slug === "gilbert-police-cadets");
      expect(gilbertCadet).toBeDefined();
      expect(gilbertCadet?.opportunities[0].minimumAge).toBe(14);
    });

    it("Mesa Cadet Post #2055 is independently confirmed distinct from the existing Better Impact Mesa connector", () => {
      const mesaCadet = MANUAL_RECORDS.find((r) => r.slug === "mesa-police-cadets");
      expect(mesaCadet).toBeDefined();
      expect(mesaCadet?.opportunities[0].minimumAge).toBe(14);
    });

    it("every org has its own distinct, real geocodable address — no shared or placeholder location", () => {
      const locations = ORG_SLUGS.map((slug) => MANUAL_RECORDS.find((r) => r.slug === slug)?.opportunities[0]?.location);
      expect(new Set(locations).size).toBe(locations.length);
      for (const loc of locations) expect(loc).toBeTruthy();
    });
  });
});
