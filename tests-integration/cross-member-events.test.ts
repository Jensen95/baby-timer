import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Real integration test for issue #96: "events are not shared between members".
//
// Unlike the hermetic Playwright suite (which mocks PostgREST), this test runs
// against a live local Supabase stack and exercises the actual security
// boundary: two *separately authenticated* members of the same family, plus a
// third member of a different family for isolation. It is the regression guard
// for the two real causes that were masked by the offline-first cache:
//
//   1. Missing table GRANTs — RLS policies existed but `authenticated` had no
//      select/insert/update/delete, so PostgREST denied every write/read.
//   2. Realtime subscriptions running unauthenticated, so RLS dropped every row.
//
// Start the stack first:  npx supabase start
// Then:                   npm run test:supabase

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// Well-known local-dev keys (constant across `supabase start` installs). Override
// via env in CI using `supabase status -o env`.
const ANON_KEY =
	process.env.SUPABASE_ANON_KEY ??
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ??
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const PASSWORD = 'integration-test-password';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const SESSION_TABLES = [
	'feeding_sessions',
	'sleep_sessions',
	'breast_pump_sessions',
	'diaper_change_sessions'
] as const;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

// Sign in as a real user and (crucially) authenticate the Realtime socket so
// RLS-filtered postgres_changes are delivered — mirroring the fix in the app.
async function signInMember(email: string): Promise<SupabaseClient> {
	const client = createClient(SUPABASE_URL, ANON_KEY, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
	expect(error, `sign-in failed for ${email}`).toBeNull();
	await client.realtime.setAuth(data.session!.access_token);
	return client;
}

async function createUser(email: string): Promise<string> {
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password: PASSWORD,
		email_confirm: true
	});
	if (error) throw error;
	return data.user.id;
}

// Build an event payload for a given session table (matches the app's shapes).
function eventPayload(table: (typeof SESSION_TABLES)[number], babyId: string, familyId: string) {
	const base = { baby_id: babyId, family_id: familyId, started_at: ago(20) };
	switch (table) {
		case 'feeding_sessions':
			return { ...base, side: 'right', ended_at: ago(5) };
		case 'sleep_sessions':
			return { ...base, side: 'back', ended_at: ago(5) };
		case 'breast_pump_sessions':
			return { ...base, side: 'both', ended_at: ago(5) };
		case 'diaper_change_sessions':
			return { ...base, has_poop: true, has_pee: false };
	}
}

const runId = Math.random().toString(36).slice(2, 8);
const emailA = `it-a-${runId}@example.com`;
const emailB = `it-b-${runId}@example.com`;
const emailC = `it-c-${runId}@example.com`;

let userA: string;
let userB: string;
let userC: string;
let familyId: string;
let otherFamilyId: string;
let babyId: string;

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
	// Fail fast with a helpful message if the stack isn't up.
	const { error: pingError } = await admin.from('families').select('id').limit(1);
	if (pingError) {
		throw new Error(
			`Cannot reach local Supabase at ${SUPABASE_URL} (${pingError.message}). ` +
				'Run `npx supabase start` before `npm run test:supabase`.'
		);
	}

	[userA, userB, userC] = await Promise.all([
		createUser(emailA),
		createUser(emailB),
		createUser(emailC)
	]);

	// Family 1: A (owner) + B (joined member). Family 2: C (owner), isolated.
	const { data: fam, error: famErr } = await admin
		.from('families')
		.insert({ name: `IT Family ${runId}`, created_by: userA })
		.select()
		.single();
	if (famErr) throw famErr;
	familyId = fam.id;

	const { data: otherFam, error: otherErr } = await admin
		.from('families')
		.insert({ name: `IT Other ${runId}`, created_by: userC })
		.select()
		.single();
	if (otherErr) throw otherErr;
	otherFamilyId = otherFam.id;

	const joinedAt = new Date().toISOString();
	const { error: memErr } = await admin.from('family_members').insert([
		{ family_id: familyId, user_id: userA, role: 'owner', joined_at: joinedAt },
		{ family_id: familyId, user_id: userB, role: 'member', joined_at: joinedAt },
		{ family_id: otherFamilyId, user_id: userC, role: 'owner', joined_at: joinedAt }
	]);
	if (memErr) throw memErr;

	const { data: baby, error: babyErr } = await admin
		.from('babies')
		.insert({ family_id: familyId, name: 'IT Baby' })
		.select()
		.single();
	if (babyErr) throw babyErr;
	babyId = baby.id;

	[clientA, clientB, clientC] = await Promise.all([
		signInMember(emailA),
		signInMember(emailB),
		signInMember(emailC)
	]);
});

afterAll(async () => {
	await clientA?.removeAllChannels();
	await clientB?.removeAllChannels();
	await clientC?.removeAllChannels();
	// Deleting the families cascades to babies + sessions; then drop the users.
	if (familyId) await admin.from('families').delete().eq('id', familyId);
	if (otherFamilyId) await admin.from('families').delete().eq('id', otherFamilyId);
	for (const id of [userA, userB, userC]) {
		if (id) await admin.auth.admin.deleteUser(id);
	}
});

describe('cross-member event sharing', () => {
	it('member B reads every event type member A created (REST pull path)', async () => {
		// Member A logs each kind of event, exactly like the app's sync upsert.
		for (const table of SESSION_TABLES) {
			const { error } = await clientA.from(table).insert(eventPayload(table, babyId, familyId));
			expect(error, `member A could not write ${table}`).toBeNull();
		}

		// Member B — a different account in the same family — must see them all.
		for (const table of SESSION_TABLES) {
			const { data, error } = await clientB
				.from(table)
				.select('*')
				.eq('family_id', familyId)
				.eq('baby_id', babyId);
			expect(error, `member B could not read ${table}`).toBeNull();
			expect(data?.length, `member B saw no ${table} from member A`).toBeGreaterThan(0);
		}
	});

	it("member B receives member A's new event over Realtime", async () => {
		const received: Record<string, unknown>[] = [];
		const channel: RealtimeChannel = clientB.channel(`it-realtime-${runId}`).on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'feeding_sessions',
				filter: `family_id=eq.${familyId}`
			},
			(payload) => received.push(payload.new as Record<string, unknown>)
		);

		await new Promise<void>((resolve, reject) => {
			channel.subscribe((status, err) => {
				if (status === 'SUBSCRIBED') resolve();
				else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
					reject(err ?? new Error(status));
			});
		});
		await sleep(750); // let the subscription bind before we write

		const { error } = await clientA
			.from('feeding_sessions')
			.insert(eventPayload('feeding_sessions', babyId, familyId));
		expect(error).toBeNull();

		const deadline = Date.now() + 12_000;
		while (received.length === 0 && Date.now() < deadline) await sleep(200);
		await clientB.removeChannel(channel);

		expect(received.length, 'member B never received member A event via Realtime').toBeGreaterThan(
			0
		);
	});

	it('writes are bidirectional (member B → member A)', async () => {
		const { error: writeErr } = await clientB
			.from('feeding_sessions')
			.insert(eventPayload('feeding_sessions', babyId, familyId));
		expect(writeErr, 'member B could not write').toBeNull();

		const { data, error } = await clientA
			.from('feeding_sessions')
			.select('*')
			.eq('family_id', familyId);
		expect(error).toBeNull();
		expect(data?.length, 'member A saw none of member B writes').toBeGreaterThan(0);
	});

	it('a member of another family cannot see these events (RLS isolation)', async () => {
		for (const table of SESSION_TABLES) {
			const { data, error } = await clientC.from(table).select('*').eq('family_id', familyId);
			// RLS returns an empty set (not an error) for rows the user can't see.
			expect(error).toBeNull();
			expect(data?.length, `outsider leaked ${table}`).toBe(0);
		}
	});
});
