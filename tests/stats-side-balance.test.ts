import { test, expect, type Page } from '@playwright/test';

// Verifies the redesigned stats percentage bars (issue #91) with a real
// authenticated session and seeded data, so the StackedBar actually renders.
//
// The fix moved the percentage value OUT of the centered SVG <text> and into a
// right-aligned legend row (.legend-pct). This test asserts the new legend shows
// percentages AND that there is no number text baked into the bar's <svg>.

const FAMILY_ID = '00000000-0000-0000-0000-0000000000f9';
const BABY_ID = '00000000-0000-0000-0000-0000000000b9';
const USER_ID = '00000000-0000-0000-0000-0000000000a9';

const SELECTED_BABY_KEY = 'baby-tracker:selectedBabyId';

const BABY = {
	id: BABY_ID,
	family_id: FAMILY_ID,
	name: 'Stats Baby',
	birth_date: null,
	created_at: new Date(Date.now() - 86_400_000).toISOString(),
	_sync: 'synced'
};

const FAMILY = {
	id: FAMILY_ID,
	name: 'Stats Family',
	created_at: new Date(Date.now() - 172_800_000).toISOString(),
	created_by: USER_ID
};

// Three completed feedings within the last 7 days: 2 left, 1 right → a non-trivial
// side balance so the StackedBar renders multiple segments.
function feeding(id: string, side: 'left' | 'right', minutesAgo: number) {
	const start = new Date(Date.now() - minutesAgo * 60_000);
	const end = new Date(start.getTime() + 15 * 60_000);
	return {
		id,
		baby_id: BABY_ID,
		family_id: FAMILY_ID,
		side,
		started_at: start.toISOString(),
		ended_at: end.toISOString(),
		note: null,
		created_at: start.toISOString(),
		_sync: 'synced'
	};
}

const FEEDINGS = [
	feeding('00000000-0000-0000-0000-0000000000e1', 'left', 60),
	feeding('00000000-0000-0000-0000-0000000000e2', 'left', 180),
	feeding('00000000-0000-0000-0000-0000000000e3', 'right', 300)
];

async function seedAuthenticatedMember(page: Page) {
	await page.addInitScript(
		({ babyId, userId, selectedKey }) => {
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
					email: 'stats-user@example.com',
					app_metadata: {},
					user_metadata: {},
					created_at: new Date().toISOString()
				}
			};
			localStorage.setItem(storageKey, JSON.stringify(session));
			localStorage.setItem(selectedKey, babyId);
		},
		{ babyId: BABY_ID, userId: USER_ID, selectedKey: SELECTED_BABY_KEY }
	);
}

async function mockSupabaseRest(page: Page) {
	await page.route('**/auth/v1/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
	);
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		let body = '[]';
		if (path.endsWith('/families')) body = JSON.stringify([FAMILY]);
		else if (path.endsWith('/babies')) body = JSON.stringify([BABY]);
		else if (path.endsWith('/feeding_sessions')) body = JSON.stringify(FEEDINGS);
		route.fulfill({ status: 200, contentType: 'application/json', body });
	});
}

// Wait until the app's Dexie object stores exist before we seed via raw
// IndexedDB. We can't key off the "Add a baby" empty state anymore — the mocked
// REST returns a baby that now syncs in and auto-selects on first load — and the
// loading message detaches before db.open() finishes its upgrade, so polling the
// store names directly is the only race-free signal.
async function waitForAppReady(page: Page) {
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						new Promise<boolean>((resolve) => {
							const req = indexedDB.open('baby-timer');
							req.onsuccess = () => {
								const names = Array.from(req.result.objectStoreNames);
								req.result.close();
								resolve(names.includes('babies') && names.includes('feeding_sessions'));
							};
							req.onerror = () => resolve(false);
						})
				),
			{ timeout: 10_000 }
		)
		.toBe(true);
}

async function seedBabyAndFeedings(page: Page) {
	await page.evaluate(
		async ({ baby, feedings, selectedKey }) => {
			const idb = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('baby-timer');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			await new Promise<void>((resolve, reject) => {
				const tx = idb.transaction(['babies', 'feeding_sessions'], 'readwrite');
				tx.objectStore('babies').put(baby);
				for (const f of feedings) tx.objectStore('feeding_sessions').put(f);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			idb.close();
			// The dashboard's loadBabies clears the selection when no baby was cached
			// yet; restore it so the stats page has a baby selected after navigation.
			localStorage.setItem(selectedKey, baby.id);
		},
		{ baby: BABY, feedings: FEEDINGS, selectedKey: SELECTED_BABY_KEY }
	);
}

test.describe('Stats side-balance bar (#91)', () => {
	test('percentage shows in the legend, not inside the bar', async ({ page }) => {
		await seedAuthenticatedMember(page);
		await mockSupabaseRest(page);

		await page.goto('/app');
		await waitForAppReady(page);
		await seedBabyAndFeedings(page);

		await page.goto('/app/stats');
		await page.getByRole('tab', { name: 'Feeding' }).click();

		// The redesigned side-balance bar renders its percentages in the legend.
		const sideBalanceBar = page.locator('.stacked-bar').first();
		await expect(sideBalanceBar).toBeVisible({ timeout: 10_000 });

		const pcts = sideBalanceBar.locator('.legend-pct');
		await expect(pcts.first()).toBeVisible();
		await expect(pcts.first()).toHaveText(/\d+%/);

		// Regression guard: the old design baked the numbers into centered <text>
		// inside the SVG. The new design must not.
		await expect(sideBalanceBar.locator('svg text')).toHaveCount(0);

		await page.screenshot({ path: '/tmp/stats-side-balance-after.png', fullPage: true });
	});
});
