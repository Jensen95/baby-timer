-- GATED CLEANUP — apply ONLY after the `api` edge function (supabase/functions/api)
-- is deployed and verified. These device-link RPCs were reimplemented in
-- TypeScript there. After applying, regenerate the DB types.
--
-- Intentionally NOT dropped: deny_device_link_request (still a DB RPC) and the
-- short_code_* helpers.

drop function if exists public.create_device_link_request(text, integer);
drop function if exists public.get_device_link_status(uuid);
drop function if exists public.approve_device_link_by_qr(uuid);
drop function if exists public.approve_device_link_by_code(text);
drop function if exists public.consume_device_link_request(uuid);
