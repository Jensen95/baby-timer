create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_owner(target_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

drop policy if exists "family members see roster" on public.family_members;
create policy "family members see roster"
  on public.family_members for select
  using (public.is_family_member(family_id));

drop policy if exists "family owner invite" on public.family_members;
create policy "family owner invite"
  on public.family_members for insert
  with check (public.is_family_owner(family_id));

drop policy if exists "family member remove" on public.family_members;
create policy "family member remove"
  on public.family_members for delete
  using (user_id = auth.uid() or public.is_family_owner(family_id));
