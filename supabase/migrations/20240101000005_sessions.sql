-- Feeding sessions
create table public.feeding_sessions (
  id               uuid primary key default gen_random_uuid(),
  baby_id          uuid not null references public.babies(id) on delete cascade,
  family_id        uuid not null references public.families(id) on delete cascade,
  side             public.breast_side not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer generated always as (
    case when ended_at is not null
      then extract(epoch from (ended_at - started_at))::int
    end
  ) stored,
  note             text,
  created_at       timestamptz not null default now()
);

create index on public.feeding_sessions (baby_id, started_at desc);
create index on public.feeding_sessions (family_id);

alter table public.feeding_sessions enable row level security;

create policy "family member feeding access"
  on public.feeding_sessions for all
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

-- Sleep sessions
create table public.sleep_sessions (
  id               uuid primary key default gen_random_uuid(),
  baby_id          uuid not null references public.babies(id) on delete cascade,
  family_id        uuid not null references public.families(id) on delete cascade,
  side             public.head_side not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer generated always as (
    case when ended_at is not null
      then extract(epoch from (ended_at - started_at))::int
    end
  ) stored,
  note             text,
  created_at       timestamptz not null default now()
);

create index on public.sleep_sessions (baby_id, started_at desc);
create index on public.sleep_sessions (family_id);

alter table public.sleep_sessions enable row level security;

create policy "family member sleep access"
  on public.sleep_sessions for all
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

-- Enable Realtime on sessions tables
alter publication supabase_realtime add table public.feeding_sessions;
alter publication supabase_realtime add table public.sleep_sessions;
