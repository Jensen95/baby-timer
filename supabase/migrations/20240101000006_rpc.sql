-- Daily summary RPC for stats page
create or replace function public.daily_summary(
  p_baby_id uuid,
  p_day date
)
returns table (
  feed_count       int,
  feed_minutes     int,
  sleep_count      int,
  sleep_minutes    int
)
language sql
stable
security invoker
as $$
  select
    count(f.id)::int as feed_count,
    coalesce(sum(f.duration_seconds) / 60, 0)::int as feed_minutes,
    (
      select count(s.id)::int
      from public.sleep_sessions s
      where s.baby_id = p_baby_id
        and s.started_at::date = p_day
        and s.ended_at is not null
    ) as sleep_count,
    (
      select coalesce(sum(s.duration_seconds) / 60, 0)::int
      from public.sleep_sessions s
      where s.baby_id = p_baby_id
        and s.started_at::date = p_day
        and s.ended_at is not null
    ) as sleep_minutes
  from public.feeding_sessions f
  where f.baby_id = p_baby_id
    and f.started_at::date = p_day
    and f.ended_at is not null
$$;
