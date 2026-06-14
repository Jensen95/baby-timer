-- Fix cross-member event sharing at the privilege layer.
--
-- Row Level Security only *restricts* access — it never *grants* it. Postgres
-- requires BOTH a table-level GRANT and a permissive RLS policy before a role can
-- read or write a row. Every prior migration added RLS policies but relied on
-- Supabase's implicit default privileges to supply the GRANT. On the current
-- Postgres images those defaults give the API roles only TRIGGER / REFERENCES /
-- TRUNCATE / MAINTAIN — NOT select/insert/update/delete.
--
-- The result is the exact bug reported: a member writes an event, PostgREST
-- returns "permission denied for table", and the offline-first Dexie cache
-- silently masks the failure so the author still sees their own event. Other
-- family members — with an empty cache — fetch nothing, and Realtime (whose
-- per-row RLS check runs as a role that cannot SELECT) delivers nothing either.
--
-- Grant the DML the RLS policies have always assumed, and set matching default
-- privileges so tables added by future migrations cannot silently regress.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter default privileges in schema public
	grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
	grant all on tables to service_role;
