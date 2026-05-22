-- Families
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;

-- family_members join table
create table public.family_members (
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.family_role not null default 'member',
  invited_at timestamptz not null default now(),
  joined_at  timestamptz,
  primary key (family_id, user_id)
);

create index on public.family_members (user_id);

alter table public.family_members enable row level security;

-- RLS: family members can read their family
create policy "family members read"
  on public.families for select
  using (
    id in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  );

-- RLS: family owners can update/delete
create policy "family owner update"
  on public.families for update
  using (created_by = auth.uid());

create policy "family owner delete"
  on public.families for delete
  using (created_by = auth.uid());

-- RLS: allow insert (creating a family)
create policy "family create"
  on public.families for insert
  with check (created_by = auth.uid());

-- RLS: members can see their family roster
create policy "family members see roster"
  on public.family_members for select
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  );

-- RLS: owners can invite members
create policy "family owner invite"
  on public.family_members for insert
  with check (
    family_id in (
      select family_id from public.family_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- RLS: owners can remove members (or members can remove themselves)
create policy "family member remove"
  on public.family_members for delete
  using (
    user_id = auth.uid()
    or family_id in (
      select family_id from public.family_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Helper: create family and add creator as owner in one call
create or replace function public.create_family(family_name text)
returns public.families
language plpgsql
security definer set search_path = public
as $$
declare
  new_family public.families;
begin
  insert into public.families (name, created_by)
  values (family_name, auth.uid())
  returning * into new_family;

  insert into public.family_members (family_id, user_id, role, joined_at)
  values (new_family.id, auth.uid(), 'owner', now());

  return new_family;
end;
$$;
