-- family_invites: holds pending invitations for email addresses not yet registered
create table public.family_invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  email      text not null,
  invited_at timestamptz not null default now(),
  unique (family_id, email)
);

create index on public.family_invites (family_id);
alter table public.family_invites enable row level security;

-- Family owners can manage pending email invites
create policy "family owner can manage invites"
  on public.family_invites for all
  using (public.is_family_owner(family_id))
  with check (public.is_family_owner(family_id));

-- Family members can see who has been invited (email addresses are visible to all members)
create policy "family member can see invites"
  on public.family_invites for select
  using (public.is_family_member(family_id));

-- Allow a family member to accept their invitation (set joined_at)
create policy "family member can accept invite"
  on public.family_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Rewrite add_family_member_by_email without registration-status leakage.
-- Registered users get a pending family_members row (joined_at = null);
-- unregistered users get a family_invites row.  Both paths return the same
-- opaque JSON so callers cannot infer whether the email was registered.
create or replace function public.add_family_member_by_email(
  target_family_id uuid,
  target_email     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_user_id   uuid;
begin
  if not public.is_family_owner(target_family_id) then
    raise exception 'Only family owners can invite members.';
  end if;

  if normalized_email = '' then
    raise exception 'Email is required.';
  end if;

  -- Look up the user; intentionally no error if not found so registration
  -- status is never revealed to the caller.
  select id into target_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if target_user_id is not null then
    -- Registered user: add as a pending member requiring their acceptance.
    -- Silently succeed if they are already in the family (do not reveal status).
    insert into public.family_members (family_id, user_id, role, joined_at)
    values (target_family_id, target_user_id, 'member', null)
    on conflict (family_id, user_id) do nothing;
  else
    -- Unregistered email: store a placeholder invite.
    -- Silently succeed on duplicates for the same reason as above.
    insert into public.family_invites (family_id, email)
    values (target_family_id, normalized_email)
    on conflict (family_id, email) do nothing;
  end if;

  -- Return the same shape regardless of path so callers learn nothing about
  -- whether the address was already registered.
  return jsonb_build_object('invited', true);
end;
$$;

-- Update list_family_members_with_profiles to include pending members and
-- unregistered invite placeholders, with a status field.
create or replace function public.list_family_members_with_profiles(target_family_id uuid)
returns table (
  user_id      uuid,
  role         public.family_role,
  invited_at   timestamptz,
  joined_at    timestamptz,
  display_name text,
  email        text,
  status       text
)
language sql
security definer
stable
set search_path = public, auth
as $$
  -- Registered members (joined or pending acceptance)
  select
    fm.user_id,
    fm.role,
    fm.invited_at,
    fm.joined_at,
    p.display_name,
    u.email,
    case when fm.joined_at is not null then 'joined' else 'pending' end as status
  from public.family_members fm
  join auth.users u on u.id = fm.user_id
  left join public.profiles p on p.id = fm.user_id
  where fm.family_id = target_family_id
    and public.is_family_member(target_family_id)

  union all

  -- Unregistered email placeholders (awaiting sign-up)
  select
    null::uuid              as user_id,
    'member'::public.family_role as role,
    fi.invited_at,
    null::timestamptz       as joined_at,
    null::text              as display_name,
    fi.email,
    'invited'               as status
  from public.family_invites fi
  where fi.family_id = target_family_id
    and public.is_family_member(target_family_id)

  order by coalesce(joined_at, invited_at), invited_at, user_id;
$$;

-- Accept a pending family membership for the currently authenticated user.
create or replace function public.accept_family_membership(target_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.family_members
  set joined_at = now()
  where family_id = target_family_id
    and user_id   = auth.uid()
    and joined_at is null;

  if not found then
    raise exception 'No pending invitation found for this family.';
  end if;
end;
$$;

-- Decline (remove) a pending family membership for the currently authenticated user.
create or replace function public.decline_family_membership(target_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.family_members
  where family_id = target_family_id
    and user_id   = auth.uid()
    and joined_at is null;

  if not found then
    raise exception 'No pending invitation found for this family.';
  end if;
end;
$$;

-- Return all families where the current user has a pending (unaccepted) invite.
create or replace function public.get_pending_memberships()
returns table (
  family_id   uuid,
  family_name text,
  invited_at  timestamptz,
  invited_by  text
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    f.id   as family_id,
    f.name as family_name,
    fm.invited_at,
    coalesce(p.display_name, owner_u.email) as invited_by
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  -- find the owner of that family
  join public.family_members owner_fm
    on owner_fm.family_id = fm.family_id and owner_fm.role = 'owner'
  join auth.users owner_u on owner_u.id = owner_fm.user_id
  left join public.profiles p on p.id = owner_fm.user_id
  where fm.user_id   = auth.uid()
    and fm.joined_at is null;
$$;

-- Trigger: when a new user is created, promote any email-based invites to
-- pending family_members rows so they can accept or decline on first login.
create or replace function public.handle_new_user_invites()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.family_members (family_id, user_id, role, joined_at)
  select fi.family_id, NEW.id, 'member', null
  from public.family_invites fi
  where lower(fi.email) = lower(NEW.email)
  on conflict (family_id, user_id) do nothing;

  delete from public.family_invites
  where lower(email) = lower(NEW.email);

  return NEW;
end;
$$;

create trigger on_auth_user_created_convert_invites
  after insert on auth.users
  for each row execute procedure public.handle_new_user_invites();
