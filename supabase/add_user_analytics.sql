-- One-time migration for an existing database. Adds privacy-conscious
-- user-adoption/engagement analytics on top of the EXISTING
-- analytics_events/applications/profiles/user_roles/admins tables —
-- deliberately not a new parallel tracking system. See ARCHITECTURE.md's
-- "Product-usage analytics" section (updated alongside this file) for
-- the full design reasoning.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes all of it.
--
-- Four things this migration does, in order:
--   1. Widens analytics_events.event_type with 9 new values, and adds a
--      server-side metadata allowlist (a client can no longer insert
--      arbitrary jsonb by bypassing the app's own TypeScript layer).
--   2. Adds account_classifications — the admin-controlled mechanism for
--      marking test/demo/other-excluded accounts (does not exist today),
--      plus a one-time backfill of this repo's own __test__ fixture
--      convention. Never deletes any account or row.
--   3. Adds four admin-only, security-definer aggregate functions. These
--      are the ONLY new read path into profiles/user_roles/
--      organization_accounts/applications/auth.users for this feature —
--      no new admin-read RLS policy is added on any of those tables,
--      since a security-definer function's internal queries bypass RLS
--      as its own definer identity regardless of the caller's grants.
--      That keeps this additive to what's already readable today, not a
--      widening of who can read raw student data.
--   5. Adds one more admin-only function that surfaces (never
--      auto-excludes) accounts whose email loosely resembles a test/demo
--      fixture, for the admin's own review.

-- ============================================================
-- 1. New event types + server-side metadata allowlist
-- ============================================================

alter table analytics_events drop constraint if exists analytics_events_event_type_check;
alter table analytics_events add constraint analytics_events_event_type_check
  check (event_type in (
    'onboarding_started', 'onboarding_completed',
    'match_viewed', 'match_saved',
    'application_started', 'application_submitted',
    'application_status_changed', 'opportunity_completed',
    'external_link_clicked', 'contact_interest_clicked', 'program_availability_confirmed',
    -- New in this migration — see lib/analytics.ts's AnalyticsEventType
    -- for what fires each one and from where.
    'dashboard_viewed', 'explore_viewed', 'search_performed', 'filter_used',
    'opportunity_details_viewed', 'opportunity_unsaved', 'opportunity_accepted',
    'match_feedback_submitted', 'general_feedback_submitted'
  ));

-- Every metadata value ever actually sent (audited against every current
-- trackEvent() call site before writing this) is one of these eight
-- keys, each a short string or boolean — never free text, never a
-- nested object/array (which could otherwise smuggle an arbitrarily
-- large or structured payload under an allowed-looking key name). This
-- is enforced here, not just in TypeScript, because RLS's own insert
-- policy ("Users can record their own analytics events" — auth.uid() =
-- user_id) says nothing about the *shape* of metadata: any authenticated
-- user could otherwise POST arbitrary jsonb directly to PostgREST,
-- bypassing the app's own client code entirely.
create or replace function analytics_metadata_is_valid(metadata jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(metadata) = 'object'
    and coalesce(
      (
        select bool_and(
          e.key in ('matchMode', 'fromStatus', 'toStatus', 'category', 'filterType', 'helpful', 'reason', 'context')
          and case
            when e.key = 'helpful' then jsonb_typeof(e.value) = 'boolean'
            else jsonb_typeof(e.value) = 'string' and length(e.value #>> '{}') <= 40
          end
        )
        from jsonb_each(metadata) as e(key, value)
      ),
      -- bool_and() over zero rows (the default '{}') is NULL, not TRUE —
      -- an empty metadata object is always valid.
      true
    );
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_events_metadata_valid') then
    alter table analytics_events
      add constraint analytics_events_metadata_valid check (analytics_metadata_is_valid(metadata));
  end if;
end $$;

-- Supports "how many genuine students were active in [date range]"
-- (count(distinct user_id) where created_at >= X) — the existing
-- (event_type, created_at) and (user_id) indexes don't cover a
-- time-range-then-distinct-user scan as well as this composite does.
create index if not exists analytics_events_created_user_idx
  on analytics_events (created_at desc, user_id);

-- ============================================================
-- 2. Admin-controlled test/demo/excluded account classification
-- ============================================================

-- Does not exist anywhere in this schema today. Membership-table
-- pattern, same posture as `admins`/`organization_accounts`: existence
-- of a row (not a boolean flag) is what every genuine-user query below
-- checks. No update/delete-by-non-admin path, and — like every other
-- admin-only table here — no code path anywhere deletes an auth.users
-- row as a side effect of this; classifying an account only ever adds a
-- row here, never touches the account itself.
create table if not exists account_classifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  classification text not null check (
    classification in ('automated_test', 'manual_test', 'demo', 'other_excluded')
  ),
  -- Optional admin-authored note (e.g. "flagged 2026-09 during pilot
  -- cleanup") — admin-only readable, never shown to the classified user
  -- or on any aggregate screen.
  note text,
  classified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists account_classifications_classification_idx
  on account_classifications (classification);

alter table account_classifications enable row level security;

create policy "Admins can manage account classifications"
  on account_classifications for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- One-time backfill: this repo's own established fixture-account
-- convention (every integration/e2e test creates accounts prefixed
-- exactly "__test__-", confirmed by grepping every test file before
-- writing this) — a real, unambiguous, developer-controlled naming
-- convention, not a runtime guess applied to arbitrary future accounts.
-- Anything else is left unclassified for the admin's own review (see
-- analytics_admin_ambiguous_accounts() below) rather than guessed here.
insert into account_classifications (user_id, classification, note)
select u.id, 'automated_test', 'Backfilled: email matches this repo''s __test__ fixture-account naming convention'
from auth.users u
where starts_with(u.email, '__test__')
on conflict (user_id) do nothing;

-- ============================================================
-- 3. Admin-only aggregate analytics (security-definer; RLS-bypassing
--    by design, exactly as much as create_organization_account()/
--    org_update_application_status() below already are — see each
--    function's own admin check, which is the real gate, not any grant)
-- ============================================================

create or replace function analytics_admin_user_totals()
returns table (
  genuine_students bigint,
  genuine_organizations bigint,
  new_students_7d bigint,
  new_students_30d bigint,
  onboarding_completed bigint,
  -- The earliest timestamp any of the 9 event types this feature
  -- introduced has actually been recorded — NULL until the first one
  -- fires post-deploy. Computed from real data, not a hardcoded
  -- deploy-date guess, so it's accurate even if this migration is
  -- applied well before the app code that fires these events ships (or
  -- vice versa). Everything this page shows that depends on the event
  -- log (DAU/WAU/MAU, the funnel's "viewed"/"saved or clicked" stages,
  -- trends) is only as complete as history since this timestamp;
  -- registered-user counts and current saved/applied/accepted/completed
  -- totals are read from live tables and have no such gap.
  tracking_began_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  with genuine_students_cte as (
    select ur.user_id, u.created_at
    from user_roles ur
    join auth.users u on u.id = ur.user_id
    where ur.role = 'student'
      and not exists (select 1 from admins a where a.user_id = ur.user_id)
      and not exists (select 1 from account_classifications ac where ac.user_id = ur.user_id)
  ),
  genuine_orgs_cte as (
    select ur.user_id
    from user_roles ur
    where ur.role = 'organization'
      and not exists (select 1 from admins a where a.user_id = ur.user_id)
      and not exists (select 1 from account_classifications ac where ac.user_id = ur.user_id)
  )
  select
    (select count(*) from genuine_students_cte),
    (select count(*) from genuine_orgs_cte),
    (select count(*) from genuine_students_cte where created_at >= now() - interval '7 days'),
    (select count(*) from genuine_students_cte where created_at >= now() - interval '30 days'),
    (select count(*) from profiles p join genuine_students_cte g on g.user_id = p.user_id),
    (
      select min(e.created_at) from analytics_events e
      where e.event_type = any(array[
        'dashboard_viewed', 'explore_viewed', 'search_performed', 'filter_used',
        'opportunity_details_viewed', 'opportunity_unsaved', 'opportunity_accepted',
        'match_feedback_submitted', 'general_feedback_submitted'
      ])
    );
end;
$$;

revoke all on function analytics_admin_user_totals() from public;
grant execute on function analytics_admin_user_totals() to authenticated;

-- "Meaningful action" set shared by DAU/WAU/MAU/returning-user/trend
-- calculations below — a deliberate, documented list, not "every event
-- type": dashboard_viewed/explore_viewed/match_viewed are passive
-- page-load/impression events (the same category as the homepage load
-- this feature was explicitly asked not to count on its own), so they
-- never make a student "active" by themselves. Everything in this list
-- requires the student to have actually done something.
create or replace function analytics_admin_engagement()
returns table (
  dau bigint,
  wau bigint,
  mau bigint,
  returning_students_30d bigint,
  currently_saved bigint,
  currently_applied bigint,
  currently_accepted bigint,
  currently_completed bigint,
  official_link_clicks_total bigint,
  feedback_submissions_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  meaningful_events text[] := array[
    'onboarding_completed', 'search_performed', 'filter_used',
    'opportunity_details_viewed', 'match_saved', 'opportunity_unsaved',
    'external_link_clicked', 'application_status_changed',
    'match_feedback_submitted', 'general_feedback_submitted'
  ];
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  with genuine_students_cte as (
    select ur.user_id
    from user_roles ur
    where ur.role = 'student'
      and not exists (select 1 from admins a where a.user_id = ur.user_id)
      and not exists (select 1 from account_classifications ac where ac.user_id = ur.user_id)
  ),
  meaningful_events_cte as (
    select e.user_id, (e.created_at at time zone 'utc')::date as active_day
    from analytics_events e
    join genuine_students_cte g on g.user_id = e.user_id
    where e.event_type = any(meaningful_events)
  )
  select
    (select count(distinct user_id) from meaningful_events_cte where active_day = (now() at time zone 'utc')::date),
    (select count(distinct user_id) from meaningful_events_cte where active_day >= (now() at time zone 'utc')::date - 6),
    (select count(distinct user_id) from meaningful_events_cte where active_day >= (now() at time zone 'utc')::date - 29),
    (
      select count(*) from (
        select user_id from meaningful_events_cte
        where active_day >= (now() at time zone 'utc')::date - 29
        group by user_id
        having count(distinct active_day) >= 2
      ) r
    ),
    (select count(*) from applications a join genuine_students_cte g on g.user_id = a.user_id where a.status = 'saved'),
    (select count(*) from applications a join genuine_students_cte g on g.user_id = a.user_id where a.status = 'applied'),
    (select count(*) from applications a join genuine_students_cte g on g.user_id = a.user_id where a.status = 'accepted'),
    (select count(*) from applications a join genuine_students_cte g on g.user_id = a.user_id where a.status = 'completed'),
    (
      select count(*) from analytics_events e join genuine_students_cte g on g.user_id = e.user_id
      where e.event_type = 'external_link_clicked'
    ),
    (
      (select count(*) from match_feedback mf join genuine_students_cte g on g.user_id = mf.user_id)
      + (select count(*) from user_reports ur join genuine_students_cte g on g.user_id = ur.reporter_user_id
         where ur.report_type = 'general_feedback')
    );
end;
$$;

revoke all on function analytics_admin_engagement() from public;
grant execute on function analytics_admin_engagement() to authenticated;

-- Engagement funnel: unique genuine students who reached each stage.
-- "Applied"/"Accepted"/"Completed" here are cumulative (>= that stage),
-- unlike analytics_admin_engagement()'s currently_applied/accepted/
-- completed above (an exact-status snapshot) — a funnel counts everyone
-- who ever reached a stage, a snapshot counts where an application
-- currently sits. applications.status only ever moves forward
-- (saved -> applied -> accepted -> completed, enforced by
-- lib/applications.ts and org_update_application_status()), so "current
-- status >= X" is exactly equivalent to "reached X at some point" — no
-- separate history table is needed to compute this correctly.
create or replace function analytics_admin_funnel()
returns table (stage_order int, stage text, student_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  with genuine_students_cte as (
    select ur.user_id
    from user_roles ur
    where ur.role = 'student'
      and not exists (select 1 from admins a where a.user_id = ur.user_id)
      and not exists (select 1 from account_classifications ac where ac.user_id = ur.user_id)
  ),
  stage_counts as (
    select
      (select count(*) from genuine_students_cte) as registered,
      (select count(*) from profiles p join genuine_students_cte g on g.user_id = p.user_id) as onboarded,
      (
        select count(distinct e.user_id) from analytics_events e
        join genuine_students_cte g on g.user_id = e.user_id
        where e.event_type = 'opportunity_details_viewed'
      ) as viewed,
      (
        select count(distinct u.user_id) from (
          select a.user_id from applications a join genuine_students_cte g on g.user_id = a.user_id
          union
          select e.user_id from analytics_events e
          join genuine_students_cte g on g.user_id = e.user_id
          where e.event_type = 'external_link_clicked'
        ) u
      ) as saved_or_clicked,
      (
        select count(distinct a.user_id) from applications a
        join genuine_students_cte g on g.user_id = a.user_id
        where a.status in ('applied', 'accepted', 'completed')
      ) as applied,
      (
        select count(distinct a.user_id) from applications a
        join genuine_students_cte g on g.user_id = a.user_id
        where a.status in ('accepted', 'completed')
      ) as accepted,
      (
        select count(distinct a.user_id) from applications a
        join genuine_students_cte g on g.user_id = a.user_id
        where a.status = 'completed'
      ) as completed
  )
  select 1, 'Registered', registered from stage_counts
  union all select 2, 'Completed onboarding', onboarded from stage_counts
  union all select 3, 'Viewed an opportunity', viewed from stage_counts
  union all select 4, 'Saved or clicked official link', saved_or_clicked from stage_counts
  union all select 5, 'Marked Applied', applied from stage_counts
  union all select 6, 'Marked Accepted', accepted from stage_counts
  union all select 7, 'Marked Completed', completed from stage_counts
  order by 1;
end;
$$;

revoke all on function analytics_admin_funnel() from public;
grant execute on function analytics_admin_funnel() to authenticated;

-- 30-day daily trend series. Only this function needs to reconstruct
-- history from the event log rather than reading current table state —
-- applications.status has no history (it's overwritten in place), so
-- "how many applied-transitions happened on day X" only survives in
-- analytics_events.
create or replace function analytics_admin_trends()
returns table (
  day date,
  new_registrations bigint,
  daily_active_students bigint,
  detail_views bigint,
  link_clicks bigint,
  saves bigint,
  applied_actions bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  meaningful_events text[] := array[
    'onboarding_completed', 'search_performed', 'filter_used',
    'opportunity_details_viewed', 'match_saved', 'opportunity_unsaved',
    'external_link_clicked', 'application_status_changed',
    'match_feedback_submitted', 'general_feedback_submitted'
  ];
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  with genuine_students_cte as (
    select ur.user_id
    from user_roles ur
    where ur.role = 'student'
      and not exists (select 1 from admins a where a.user_id = ur.user_id)
      and not exists (select 1 from account_classifications ac where ac.user_id = ur.user_id)
  ),
  days as (
    select generate_series(
      ((now() at time zone 'utc')::date - 29),
      (now() at time zone 'utc')::date,
      interval '1 day'
    )::date as day
  ),
  registrations as (
    select (u.created_at at time zone 'utc')::date as day, count(*) as n
    from auth.users u
    join genuine_students_cte g on g.user_id = u.id
    where u.created_at >= now() - interval '30 days'
    group by 1
  ),
  active as (
    select (e.created_at at time zone 'utc')::date as day, count(distinct e.user_id) as n
    from analytics_events e
    join genuine_students_cte g on g.user_id = e.user_id
    where e.created_at >= now() - interval '30 days' and e.event_type = any(meaningful_events)
    group by 1
  ),
  views as (
    select (e.created_at at time zone 'utc')::date as day, count(*) as n
    from analytics_events e
    join genuine_students_cte g on g.user_id = e.user_id
    where e.created_at >= now() - interval '30 days' and e.event_type = 'opportunity_details_viewed'
    group by 1
  ),
  clicks as (
    select (e.created_at at time zone 'utc')::date as day, count(*) as n
    from analytics_events e
    join genuine_students_cte g on g.user_id = e.user_id
    where e.created_at >= now() - interval '30 days' and e.event_type = 'external_link_clicked'
    group by 1
  ),
  saves_cte as (
    select (e.created_at at time zone 'utc')::date as day, count(*) as n
    from analytics_events e
    join genuine_students_cte g on g.user_id = e.user_id
    where e.created_at >= now() - interval '30 days' and e.event_type = 'match_saved'
    group by 1
  ),
  applied_cte as (
    select (e.created_at at time zone 'utc')::date as day, count(*) as n
    from analytics_events e
    join genuine_students_cte g on g.user_id = e.user_id
    where e.created_at >= now() - interval '30 days'
      and e.event_type = 'application_status_changed'
      and e.metadata ->> 'toStatus' = 'applied'
    group by 1
  )
  select
    d.day,
    coalesce(r.n, 0),
    coalesce(a.n, 0),
    coalesce(v.n, 0),
    coalesce(c.n, 0),
    coalesce(s.n, 0),
    coalesce(ap.n, 0)
  from days d
  left join registrations r on r.day = d.day
  left join active a on a.day = d.day
  left join views v on v.day = d.day
  left join clicks c on c.day = d.day
  left join saves_cte s on s.day = d.day
  left join applied_cte ap on ap.day = d.day
  order by d.day;
end;
$$;

revoke all on function analytics_admin_trends() from public;
grant execute on function analytics_admin_trends() to authenticated;

-- ============================================================
-- 4. Ambiguous-account review queue (display only — never excludes
--    anything by itself; an admin decides via
--    account_classifications above)
-- ============================================================

create or replace function analytics_admin_ambiguous_accounts()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Unlike the other four admin functions above, this one's own return
  -- table has a column literally named user_id — PL/pgSQL turns that
  -- into an implicit variable in scope for the whole function body, so
  -- an unqualified `admins.user_id` reference here (the pattern every
  -- other function in this file uses unaliased) is genuinely ambiguous
  -- to Postgres, not just to a human reader. Aliasing admins avoids it.
  if not exists (select 1 from admins ad where ad.user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  -- auth.users.email is character varying(255) in Supabase's own auth
  -- schema, but this function's return table declares email as text —
  -- PL/pgSQL's `return query` requires an exact type match (unlike a
  -- plain SELECT, where the implicit varchar->text cast is silent), so
  -- an uncast u.email here raises "structure of query does not match
  -- function result type" for every caller. Only surfaced once the
  -- user_id-ambiguity bug above was fixed — that error always fired
  -- first and masked this one underneath it.
  select u.id, u.email::text, ur.role, u.created_at
  from auth.users u
  left join user_roles ur on ur.user_id = u.id
  where not exists (select 1 from admins a where a.user_id = u.id)
    and not exists (select 1 from account_classifications ac where ac.user_id = u.id)
    and (
      u.email ilike '%test%'
      or u.email ilike '%demo%'
      or u.email ilike '%sample%'
      or u.email ilike '%fixture%'
      or u.email ilike '%example.com'
    )
  order by u.created_at desc
  limit 200;
end;
$$;

revoke all on function analytics_admin_ambiguous_accounts() from public;
grant execute on function analytics_admin_ambiguous_accounts() to authenticated;
