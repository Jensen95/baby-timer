create table public.breast_pump_sessions (
  id               uuid primary key default gen_random_uuid(),
  baby_id          uuid not null references public.babies(id) on delete cascade,
  family_id        uuid not null references public.families(id) on delete cascade,
  side             public.breast_side not null default 'both',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer generated always as (
    case when ended_at is not null
      then extract(epoch from (ended_at - started_at))::int
    end
  ) stored,
  yield_left_ml    integer check (yield_left_ml is null or yield_left_ml >= 0),
  yield_right_ml   integer check (yield_right_ml is null or yield_right_ml >= 0),
  note             text,
  created_at       timestamptz not null default now()
);

create index on public.breast_pump_sessions (baby_id, started_at desc);
create index on public.breast_pump_sessions (family_id);

alter table public.breast_pump_sessions enable row level security;

create policy "family member breast pump access"
  on public.breast_pump_sessions for all
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

alter publication supabase_realtime add table public.breast_pump_sessions;
