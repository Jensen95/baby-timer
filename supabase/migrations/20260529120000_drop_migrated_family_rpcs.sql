-- GATED CLEANUP — apply ONLY after the `api` edge function (supabase/functions/api)
-- is deployed and verified in the target project. These family/invite RPCs were
-- reimplemented in TypeScript there; dropping them before the edge function is
-- live would break the frontend. After applying, regenerate the DB types:
--   supabase gen types typescript --local > src/lib/db/database.types.ts
--
-- Intentionally NOT dropped: is_family_member/is_family_owner (used by RLS),
-- the short_code_* helpers, add_family_member_by_email and
-- list_family_members_with_profiles (kept as DB RPCs), and the
-- accept/decline/get_pending_memberships functions.

drop function if exists public.create_family(text);
drop function if exists public.create_family_invite_code(uuid, integer, integer);
drop function if exists public.list_active_family_invite_codes(uuid);
drop function if exists public.revoke_family_invite_code(uuid, uuid);
drop function if exists public.join_family_by_code(text);
