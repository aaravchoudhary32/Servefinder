-- Phase 6 (Adoption): enforce the `organizations.verified` flag (added
-- in Phase 2, never enforced anywhere until now) — an org must be
-- verified before its opportunities are publicly visible. Run this in
-- the Supabase SQL editor. Safe to re-run.
--
-- CRITICAL ROLLOUT STEP, run first: every organization already in this
-- database predates any verification workflow and is currently
-- verified = false (confirmed live: 18/18 orgs, 0 verified). Shipping
-- the new read policy below without this backfill would instantly hide
-- every opportunity from every student — the entire live catalog,
-- including all 7 scraped ingestion sources' orgs. Grandfathering
-- everything that exists as of this migration means only NEW orgs
-- created after this point (self-signups via /onboarding/organization)
-- start unverified and need admin approval; nothing already live is
-- disrupted.
update organizations set verified = true where verified = false;

-- Public read is now gated on the posting org being verified. Manually-
-- entered opportunities (organization_id is null — always the /admin
-- form) are exempt: there is no "unverified org" for those, since no
-- org account created them.
drop policy if exists "Anyone can read opportunities" on opportunities;

create policy "Public can read opportunities from verified orgs or admin-entered listings"
  on opportunities for select
  using (
    organization_id is null
    or exists (
      select 1 from organizations
      where organizations.id = opportunities.organization_id
        and organizations.verified = true
    )
  );

-- Admins need to see every opportunity regardless of verification status
-- to manage /admin's list — previously covered incidentally by the fully
-- public policy above; needs its own explicit grant now that that
-- policy is scoped down.
create policy "Admins can read all opportunities regardless of verification"
  on opportunities for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- Org reps need to see their own organization's opportunities regardless
-- of verification status, so they can review/edit what they've posted
-- while waiting on approval — same reasoning as the admin policy above.
create policy "Org reps can read their own opportunities regardless of verification"
  on opportunities for select
  using (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );
