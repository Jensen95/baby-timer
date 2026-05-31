import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { corsHeaders } from './cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Error carrying an HTTP status; mapped to a JSON response by the api handler. */
export class AuthError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = 'AuthError';
		this.status = status;
	}
}

export function bearerToken(req: Request): string {
	return (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

/**
 * RLS-scoped client that runs AS THE CALLER. This is the DEFAULT for every
 * authenticated route: `auth.uid()` resolves to the user and the kept-in-DB
 * `is_family_member` / `is_family_owner` RLS policies enforce access for free.
 * Prefer this over `serviceClient` unless the operation genuinely needs elevation.
 */
export function userClient(req: Request): SupabaseClient {
	return createClient(SUPABASE_URL, ANON_KEY, {
		global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

/**
 * Service-role client that BYPASSES RLS. Use ONLY for genuine elevation:
 * `auth.users` lookups, admin / magic-link APIs, the auth hook, and device-link
 * pre-auth flows where the secret token is the capability. Every use MUST be
 * guarded manually — there is no RLS safety net here.
 */
export const serviceClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: { persistSession: false, autoRefreshToken: false },
});

/** Validates the bearer JWT and returns the user id. Throws AuthError(401). */
export async function getUserId(req: Request): Promise<string> {
	const token = bearerToken(req);
	if (!token) throw new AuthError(401, 'Authentication required.');
	const { data, error } = await serviceClient.auth.getUser(token);
	if (error || !data.user) throw new AuthError(401, 'Authentication required.');
	return data.user.id;
}

/**
 * Friendly-error guard mirroring public.is_family_owner. RLS is the real
 * boundary; this exists so routes can return a clear 403 instead of a raw
 * PostgREST policy-violation error. Pass the RLS-scoped `userClient`.
 */
export async function assertFamilyOwner(
	client: SupabaseClient,
	familyId: string,
	userId: string,
): Promise<void> {
	const { data, error } = await client
		.from('family_members')
		.select('user_id')
		.eq('family_id', familyId)
		.eq('user_id', userId)
		.eq('role', 'owner')
		.not('joined_at', 'is', null)
		.maybeSingle();
	if (error) throw new AuthError(500, error.message);
	if (!data) throw new AuthError(403, 'Only family owners can do this.');
}

/** Friendly-error guard mirroring public.is_family_member. */
export async function assertFamilyMember(
	client: SupabaseClient,
	familyId: string,
	userId: string,
): Promise<void> {
	const { data, error } = await client
		.from('family_members')
		.select('user_id')
		.eq('family_id', familyId)
		.eq('user_id', userId)
		.not('joined_at', 'is', null)
		.maybeSingle();
	if (error) throw new AuthError(500, error.message);
	if (!data) throw new AuthError(403, 'You are not a member of this family.');
}

export function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}
