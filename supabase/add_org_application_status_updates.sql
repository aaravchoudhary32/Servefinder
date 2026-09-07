-- One-time migration for an existing database. Lets an organization rep
-- move an applicant's status forward (Applied -> Accepted -> Completed)
-- from /org-dashboard, synced with the same `applications` row the
-- student's own tracker (/applications) reads and writes.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes it.
--
-- Deliberately a security definer function, not a raw permissive UPDATE
-- policy (the way "Org reps can view applications for their own
-- organization" in add_org_application_stats_access.sql is a raw SELECT
-- policy): a table-level UPDATE policy's `with check` only constrains
-- which *rows* satisfy it, not which *columns* a client is allowed to
-- change on those rows — a crafted PostgREST PATCH could otherwise
-- reassign `user_id` or `opportunity_id` on someone else's application
-- row instead of just moving its status. This function only ever
-- touches `status` and `updated_at`, and re-derives the org-ownership
-- check itself rather than trusting a policy to have already run in the
-- caller's favor — same shape as create_organization_account() below it
-- (also security definer, also re-validates everything server-side
-- rather than trusting the caller).
create or replace function org_update_application_status(
  application_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  owns_it boolean;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated';
  end if;

  -- Orgs can only ever move an application forward to one of these two
  -- states — not back to 'applied', and never to 'saved' (a student's
  -- private bookmark, not something an org should be able to touch or
  -- even necessarily know exists as "theirs" to act on).
  if new_status not in ('accepted', 'completed') then
    raise exception 'Organizations can only mark an application Accepted or Completed';
  end if;

  select a.status,
    exists (
      select 1
      from opportunities o
      join organization_accounts oa on oa.organization_id = o.organization_id
      where o.id = a.opportunity_id and oa.user_id = auth.uid()
    )
  into current_status, owns_it
  from applications a
  where a.id = application_id;

  if current_status is null then
    raise exception 'Application not found';
  end if;

  if not owns_it then
    raise exception 'Not authorized to update this application';
  end if;

  if current_status = 'saved' then
    raise exception 'This application has not been submitted yet';
  end if;

  if new_status = 'completed' and current_status not in ('accepted', 'completed') then
    raise exception 'An application must be Accepted before it can be marked Completed';
  end if;

  update applications
  set status = new_status, updated_at = now()
  where id = application_id;
end;
$$;

-- Like create_organization_account(), this function's owner (whichever
-- role runs this migration, typically the table-owning `postgres` role)
-- bypasses `applications` RLS entirely while it executes — that's what
-- `security definer` means in practice. The safety guarantee is
-- everything checked above, not RLS: the function only ever updates the
-- one row identified by application_id, only to 'accepted'/'completed',
-- and only after confirming the caller's own organization_accounts row
-- owns the opportunity that application belongs to. `authenticated`
-- just needs permission to call the function at all.
revoke all on function org_update_application_status(uuid, text) from public;
grant execute on function org_update_application_status(uuid, text) to authenticated;
