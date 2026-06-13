import { test, expect, type Page } from '@playwright/test';

// Regression test for family event sharing.
//
// Bug: session events (feeding/sleep/pump/diaper) created by one family member
// were only pulled from the database inside the Realtime `SUBSCRIBED` callback.
// If the Realtime websocket never connected, another member never fetched the
// existing events — they appeared "account-only / not synced from the database".
//
// This test signs in as a second family member, mocks the REST backend to return
// a feeding session authored by *another* member, and intentionally provides NO
// working Realtime channel (the websocket cannot connect to the placeholder host).
// The shared event must still appear, proving syncNow() pulls it over REST.

const FAMILY_ID = '00000000-0000-0000-0000-0000000000fa';
const BABY_ID = '00000000-0000-0000-0000-0000000000ba';
const MEMBER_B_ID = '00000000-0000-0000-0000-0000000000b2';

// A completed feeding session created by family member A (right side).
const SHARED_FEEDING = {
	id: '00000000-0000-0000-0000-0000000000f1',
	baby_id: BABY_ID,
	family_id: FAMILY_ID,
	side: 'right',
	started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
	ended_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
	duration_seconds: 1200,
	note: null,
	created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
};

const SHARED_BABY = {
	id: BABY_ID,
	family_id: FAMILY_ID,
	name: 'Shared Baby',
	birth_date: null,
	created_at: new Date(Date.now() - 86_400_000).toISOString()
};

const FAMILY = {
	id: FAMILY_ID,
	name: 'Shared Family',
	created_at: new Date(Date.now() - 172_800_000).toISOString(),
	created_by: '00000000-0000-0000-0000-0000000000a1'
};

// Seed an authenticated Supabase session for member B into localStorage so the
// app boots signed-in with no auth network round-trip. Default storage key for
// host `placeholder.supabase.co` is `sb-placeholder-auth-token`.
async function seedAuthenticatedMember(page: Page) {
	await page.addInitScript(
		({ babyId, userId }) => {
			const storageKey = 'sb-placeholder-auth-token';
			const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
			const b64url = (obj: unknown) =>
				btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
			const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
				sub: userId,
				role: 'authenticated',
				exp: farFuture
			})}.sig`;
			const session = {
				access_token: accessToken,
				refresh_token: 'fake-refresh-token',
				token_type: 'bearer',
				expires_in: 60 * 60 * 24 * 365,
				expires_at: farFuture,
				user: {
					id: userId,
					aud: 'authenticated',
					role: 'authenticated',
					email: 'member-b@example.com',
					app_metadata: {},
					user_metadata: {},
					created_at: new Date().toISOString()
				}
			};
			localStorage.setItem(storageKey, JSON.stringify(session));
			localStorage.setItem('baby-tracker:selectedBabyId', babyId);
		},
		{ babyId: BABY_ID, userId: MEMBER_B_ID }
	);
}

// One handler for the PostgREST surface: families/babies/feeding_sessions return
// the shared rows, every other table returns empty.
async function mockSupabaseRest(page: Page) {
	await page.route('**/auth/v1/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
	);

	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		let body = '[]';
		if (path.endsWith('/families')) body = JSON.stringify([FAMILY]);
		else if (path.endsWith('/babies')) body = JSON.stringify([SHARED_BABY]);
		else if (path.endsWith('/feeding_sessions')) body = JSON.stringify([SHARED_FEEDING]);
		route.fulfill({ status: 200, contentType: 'application/json', body });
	});
}

// The dashboard "Add a baby" empty-state link only renders after the app has
// successfully opened and queried the Dexie DB, so waiting for it guarantees the
// object stores exist before we seed (avoids racing the app's own db.open()).
async function waitForAppReady(page: Page) {
	await expect(page.getByRole('link', { name: 'Add a baby' })).toBeVisible({ timeout: 10_000 });
}

async function seedSharedBabyLocally(page: Page) {
	await page.evaluate(async (baby) => {
		const idb = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('baby-timer');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = idb.transaction('babies', 'readwrite');
			tx.objectStore('babies').put({ ...baby, _sync: 'synced' });
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		idb.close();
	}, SHARED_BABY);
}

test.describe('Family event sharing', () => {
	test("a member sees another member's event without realtime", async ({ page }) => {
		await seedAuthenticatedMember(page);
		await mockSupabaseRest(page);

		// First load establishes the local DB; seed the shared baby so the
		// dashboard renders for the selected baby (baby sync is out of scope here).
		// `networkidle` is unusable here — the authenticated Realtime websocket
		// retries forever — so wait for the app shell to finish its initial load.
		await page.goto('/app');
		await waitForAppReady(page);
		await seedSharedBabyLocally(page);

		await page.reload();
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// The shared feeding (member A, right side) must appear in Recent — it can
		// only have arrived via syncNow's REST pull, since no realtime channel is
		// available in this test.
		await expect(page.getByText('Feeding · Right')).toBeVisible({ timeout: 10_000 });
	});
});
