create table public.diaper_change_sessions (
  id               uuid primary key default gen_random_uuid(),
  baby_id          uuid not null references public.babies(id) on delete cascade,
  family_id        uuid not null references public.families(id) on delete cascade,
  started_at       timestamptz not null default now(),
  has_poop         boolean not null default false,
  has_pee          boolean not null default false,
  note             text,
  created_at       timestamptz not null default now(),
  constraint diaper_change_has_content check (has_poop or has_pee)
);

create index on public.diaper_change_sessions (baby_id, started_at desc);
create index on public.diaper_change_sessions (family_id);

alter table public.diaper_change_sessions enable row level security;

create policy "family member diaper change access"
  on public.diaper_change_sessions for all
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

alter publication supabase_realtime add table public.diaper_change_sessions;
