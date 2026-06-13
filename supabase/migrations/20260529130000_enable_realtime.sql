-- Enable Realtime (postgres_changes) for the family-shared tables so clients can
-- subscribe to live inserts/updates/deletes instead of polling. Row-level
-- security still governs which rows each subscriber is allowed to receive.
--
-- REPLICA IDENTITY FULL makes the full OLD row available on UPDATE/DELETE so the
-- `family_id=eq.<id>` channel filter matches delete events (the default replica
-- identity only ships the primary key, which would not carry family_id).

do $$
declare
	tbl text;
begin
	foreach tbl in array array[
		'babies',
		'feeding_sessions',
		'sleep_sessions',
		'breast_pump_sessions',
		'diaper_change_sessions'
	]
	loop
		execute format('alter table public.%I replica identity full', tbl);

		if not exists (
			select 1
			from pg_publication_tables
			where pubname = 'supabase_realtime'
				and schemaname = 'public'
				and tablename = tbl
		) then
			execute format('alter publication supabase_realtime add table public.%I', tbl);
		end if;
	end loop;
end;
$$;
