-- Babies (belong to a family)
create table public.babies (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  name       text not null,
  birth_date date,
  created_at timestamptz not null default now()
);

create index on public.babies (family_id);

alter table public.babies enable row level security;

create policy "family member baby access"
  on public.babies for all
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  )
  with check (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  );
