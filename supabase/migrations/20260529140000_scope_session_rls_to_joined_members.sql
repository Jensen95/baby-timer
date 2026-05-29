-- Scope session/event table access to JOINED family members (not pending invitees)
-- Aligns feeding_sessions, sleep_sessions, breast_pump_sessions, and diaper_change_sessions
-- RLS with the stricter babies table policy: only users with joined_at IS NOT NULL.
-- Before this change, pending invitees (joined_at IS NULL) could read/write session data.

-- Feeding sessions
drop policy if exists "family member feeding access" on public.feeding_sessions;

create policy "family member feeding access"
  on public.feeding_sessions for all
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  )
  with check (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  );

-- Sleep sessions
drop policy if exists "family member sleep access" on public.sleep_sessions;

create policy "family member sleep access"
  on public.sleep_sessions for all
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  )
  with check (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  );

-- Breast pump sessions
drop policy if exists "family member breast pump access" on public.breast_pump_sessions;

create policy "family member breast pump access"
  on public.breast_pump_sessions for all
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  )
  with check (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  );

-- Diaper change sessions
drop policy if exists "family member diaper change access" on public.diaper_change_sessions;

create policy "family member diaper change access"
  on public.diaper_change_sessions for all
  using (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  )
  with check (
    family_id in (
      select family_id from public.family_members where user_id = auth.uid() and joined_at is not null
    )
  );
