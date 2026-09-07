-- One-time migration for an existing database. Adds a real "organization"
-- account type alongside students, and scopes opportunities write access
-- for organization reps to their own organization_id only.
--
-- Skip this if you're seeding a brand-new database — the updated
-- schema.sql already includes all of this.

-- ---------- user_roles ----------
-- Set once, client-side, immediately after signup — before any
-- onboarding data exists for either account type. This is deliberately
-- separate from `profiles` (student-only data) and `organization_accounts`
-- (only exists once org onboarding actually completes): a user who
-- picked "organization" at signup but abandoned onboarding halfway
-- through has neither of those rows yet, and without a role recorded
-- up front, a later login would have no way to know which onboarding
-- flow to send them back to.
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'organization')),
  created_at timestamptz not null default now()
);

alter table user_roles enable row level security;

create policy "Users can check their own role"
  on user_roles for select
  using (auth.uid() = user_id);

-- Insert-only, no update/delete policy: a user sets their own role
-- exactly once, at signup (`with check` still restricts it to their own
-- user_id, so no one can set another user's role). Changing roles after
-- the fact isn't a supported self-service flow, same philosophy as
-- `admins` — fix mistakes by hand via the SQL editor if they happen.
create policy "Users can set their own role once at signup"
  on user_roles for insert
  with check (auth.uid() = user_id);

-- ---------- organization_accounts ----------
-- Which organization a user represents. Existence of a row (not a role
-- string) is what the new opportunities write policies below actually
-- check — same "membership table, not a flag" pattern as `admins`.
create table if not exists organization_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists organization_accounts_org_idx
  on organization_accounts (organization_id);

alter table organization_accounts enable row level security;

create policy "Users can check their own organization membership"
  on organization_accounts for select
  using (auth.uid() = user_id);

-- Deliberately no insert/update/delete policy here at all. Rows are
-- created exclusively by create_organization_account() below (a
-- security definer function), which is the only path that can ever
-- populate this table — and it only ever links a user to a brand-new
-- organization it creates on their behalf in the same transaction,
-- never to an existing one. Without this restriction, an open
-- `with check (auth.uid() = user_id)` insert policy would let any
-- authenticated user link themselves to *any* existing organization_id
-- of their choosing and immediately gain write access to that org's
-- opportunities under the policies added further down.

-- ---------- self-service organization creation ----------
-- The one sanctioned way to create an organization_accounts row.
-- Runs as its owner (security definer), so it can insert into
-- `organizations` despite that table's insert policy being admin-only —
-- the safety guarantee isn't "this role can bypass RLS," it's that this
-- specific function only ever creates a *new* organization and links it
-- to the *caller's own* auth.uid(), so there's no path to hijacking an
-- existing organization's id this way.
create or replace function create_organization_account(
  org_name text,
  org_description text default null,
  org_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create an organization account';
  end if;

  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'organization'
  ) then
    raise exception 'This account is not registered as an organization';
  end if;

  if exists (select 1 from organization_accounts where user_id = auth.uid()) then
    raise exception 'This account is already linked to an organization';
  end if;

  if org_name is null or btrim(org_name) = '' then
    raise exception 'Organization name is required';
  end if;

  insert into organizations (name, description, contact_email)
  values (
    btrim(org_name),
    nullif(btrim(coalesce(org_description, '')), ''),
    nullif(btrim(coalesce(org_contact_email, '')), '')
  )
  returning id into new_org_id;

  insert into organization_accounts (user_id, organization_id)
  values (auth.uid(), new_org_id);

  return new_org_id;
end;
$$;

revoke all on function create_organization_account(text, text, text) from public;
grant execute on function create_organization_account(text, text, text) to authenticated;

-- ---------- opportunities: scoped write access for org reps ----------
-- Additional permissive policies alongside the existing admin ones —
-- Postgres OR's multiple permissive policies for the same command, so
-- a write succeeds if it satisfies *either* the admin policy or this
-- one, never neither. An org rep can only ever touch rows whose
-- organization_id matches the organization_accounts row for their own
-- auth.uid(); opportunities.organization_id is nullable (org-less
-- listings from /admin), and a null can never satisfy this exists()
-- check, so org reps can't touch or create organization-less rows —
-- that stays an admin-only capability, unchanged.
create policy "Org reps can add opportunities for their own organization"
  on opportunities for insert
  with check (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );

create policy "Org reps can update opportunities for their own organization"
  on opportunities for update
  using (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  )
  with check (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );

create policy "Org reps can delete opportunities for their own organization"
  on opportunities for delete
  using (
    exists (
      select 1 from organization_accounts
      where user_id = auth.uid() and organization_id = opportunities.organization_id
    )
  );
