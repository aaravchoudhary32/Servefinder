-- One-time migration for an existing database. Adds match_feedback,
-- powering the "Was this match helpful?" control on each opportunity
-- card and /admin/analytics's "Matching quality" section — Phase 3 of
-- the "Matching Quality" plan.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.
--
-- Closer in spirit to `applications`/`saved_opportunities`
-- (current-state-per-user-per-opportunity, upsertable) than to
-- `analytics_events` (append-only log): a student can change their mind
-- about a rating, so re-submitting updates the existing row via the
-- unique index below rather than creating duplicates — same shape
-- `applications` already uses for one-row-per-student-per-opportunity.
--
-- `algorithm` records which mode (classic/semantic) was active when the
-- student rated the match, since the same opportunity could be rated
-- once under each if a student toggles modes.
--
-- `reason` is a fixed preset, not free text — consistent with this
-- app's UI vocabulary elsewhere (TagSelect, category selects) and
-- because a dashboard can aggregate a bar of reason counts, not a pile
-- of freeform strings a human would have to read one by one. Only
-- meaningful (and only ever prompted client-side) when helpful = false.
create table if not exists match_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  algorithm text not null check (algorithm in ('classic', 'semantic')),
  helpful boolean not null,
  reason text check (reason in ('wrong_category', 'too_far', 'schedule_conflict', 'age_mismatch', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_feedback_user_opportunity_algorithm_idx
  on match_feedback (user_id, opportunity_id, algorithm);

alter table match_feedback enable row level security;

-- Same shape as "Users manage their own applications"/"...saved
-- opportunities" above — full access to a student's own rows only, no
-- security-definer function needed since this never crosses an
-- ownership boundary.
create policy "Users manage their own match feedback"
  on match_feedback for all
  using (auth.uid() = user_id);

-- Same admins-exists-check pattern used for analytics_events and the
-- applications admin-read policy — needed so /admin/analytics can
-- compute helpfulness rates across all students, not just the admin's
-- own (nonexistent) feedback rows.
create policy "Admins can view all match feedback"
  on match_feedback for select
  using (exists (select 1 from admins where user_id = auth.uid()));
