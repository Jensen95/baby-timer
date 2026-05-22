drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create or replace function public.list_family_members_with_profiles(target_family_id uuid)
returns table (
  user_id uuid,
  role public.family_role,
  invited_at timestamptz,
  joined_at timestamptz,
  display_name text,
  email text
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    fm.user_id,
    fm.role,
    fm.invited_at,
    fm.joined_at,
    p.display_name,
    u.email
  from public.family_members fm
  join auth.users u on u.id = fm.user_id
  left join public.profiles p on p.id = fm.user_id
  where fm.family_id = target_family_id
    and public.is_family_member(target_family_id)
  order by coalesce(fm.joined_at, fm.invited_at), fm.invited_at, fm.user_id;
$$;

create or replace function public.invite_family_member_by_email(target_family_id uuid, target_email text)
returns public.family_members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_user_id uuid;
  invited_member public.family_members;
begin
  if not public.is_family_owner(target_family_id) then
    raise exception 'Only family owners can invite members.';
  end if;

  if normalized_email = '' then
    raise exception 'Email is required.';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'That email has not signed in yet.';
  end if;

  if exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = target_user_id
  ) then
    raise exception 'That person is already in this family.';
  end if;

  insert into public.family_members (family_id, user_id, role, joined_at)
  values (target_family_id, target_user_id, 'member', now())
  returning * into invited_member;

  return invited_member;
end;
$$;
