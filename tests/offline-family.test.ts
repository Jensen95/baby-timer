import { test, expect, type Page } from '@playwright/test';

// Regression test for issue #64 (offline mode loses family + related data).
//
// The family page used to issue a network RPC (getPendingMemberships) as the very
// first thing it did. Offline, that threw before the locally cached family was
// ever read, so an authenticated user lost their family and babies until they
// reloaded with connectivity. This test seeds a cached family + baby, takes the
// network down (REST/functions aborted), and asserts they remain visible.

const FAMILY_ID = '00000000-0000-0000-0000-0000000000fc';
const BABY_ID = '00000000-0000-0000-0000-0000000000bc';
const USER_ID = '00000000-0000-0000-0000-0000000000c6';

const LOCAL_FAMILY = {
	id: FAMILY_ID,
	name: 'Cached Family',
	created_at: new Date(Date.now() - 172_800_000).toISOString()
};

const LOCAL_BABY = {
	id: BABY_ID,
	family_id: FAMILY_ID,
	name: 'Offline Baby',
	birth_date: null,
	created_at: new Date(Date.now() - 86_400_000).toISOString(),
	_sync: 'synced'
};

async function seedAuthenticatedMember(page: Page) {
	await page.addInitScript((userId) => {
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
				email: 'offline-user@example.com',
				app_metadata: {},
				user_metadata: {},
				created_at: new Date().toISOString()
			}
		};
		localStorage.setItem(storageKey, JSON.stringify(session));
	}, USER_ID);
}

// Simulate being offline: the auth session is read from localStorage (no network),
// but every Supabase data/RPC/function call fails.
async function goOffline(page: Page) {
	await page.route('**/auth/v1/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
	);
	await page.route('**/rest/v1/**', (route) => route.abort('failed'));
	await page.route('**/functions/v1/**', (route) => route.abort('failed'));
}

// The dashboard "Add a baby" empty-state link only renders after the app has
// successfully opened and queried the Dexie DB, so waiting for it guarantees the
// object stores exist before we seed (avoids racing the app's own db.open()).
async function waitForAppReady(page: Page) {
	await expect(page.getByRole('link', { name: 'Add a baby' })).toBeVisible({ timeout: 10_000 });
}

async function seedLocalFamilyAndBaby(page: Page) {
	await page.evaluate(
		async ({ family, baby }) => {
			const idb = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('baby-timer');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			await new Promise<void>((resolve, reject) => {
				const tx = idb.transaction(['families', 'babies'], 'readwrite');
				tx.objectStore('families').put(family);
				tx.objectStore('babies').put(baby);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			idb.close();
		},
		{ family: LOCAL_FAMILY, baby: LOCAL_BABY }
	);
}

test.describe('Offline family data', () => {
	test('authenticated user keeps family + babies while offline', async ({ page }) => {
		await seedAuthenticatedMember(page);
		await goOffline(page);

		// Boot once to create the local DB, then seed the cached family + baby.
		await page.goto('/app');
		await waitForAppReady(page);
		await seedLocalFamilyAndBaby(page);

		await page.goto('/app/family');

		// The cached baby must render (proves the local family resolved despite the
		// network being down) — not the "no babies" / "not in a family" empty state.
		await expect(page.getByText('Offline Baby')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('not in a family')).not.toBeVisible();
	});
});
