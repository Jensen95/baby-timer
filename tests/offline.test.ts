import { test, expect, type Page } from '@playwright/test';

async function mockSupabaseUnauthenticated(page: Page) {
	await page.route('**/auth/v1/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: { session: null }, error: null })
		})
	);
	await page.route('**/rest/v1/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([])
		})
	);
}

async function seedBaby(page: Page) {
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('baby-timer');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('babies', 'readwrite');
			tx.objectStore('babies').put({
				id: 'test-baby-1',
				family_id: null,
				name: 'Test Baby',
				birth_date: null,
				created_at: new Date().toISOString(),
				_sync: 'pending'
			});
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	});
}

test.describe('Offline mode', () => {
	test('app loads without network (mocked offline Supabase)', async ({ page }) => {
		// Simulate network-level failures for all Supabase endpoints
		await page.route('**/auth/v1/**', (route) => route.abort('failed'));
		await page.route('**/rest/v1/**', (route) => route.abort('failed'));

		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// App should still render — not show an error page
		await expect(page.locator('body')).toBeVisible();
		// Should still be on /app (no crash redirect)
		await expect(page).toHaveURL(/\/app/);

		// Guest banner should appear because there is no auth session
		await expect(page.getByText('Sign in to sync')).toBeVisible();
	});

	test('can start and stop a feeding timer offline', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Seed a baby directly into IndexedDB (avoids UI timing issues) then reload
		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Tap the feed tile to open the start sheet, then start the timer
		const feedTile = page.locator('button.tile.type-feed');
		await expect(feedTile).toBeVisible({ timeout: 5000 });
		await feedTile.click();
		await page.getByRole('button', { name: 'Start', exact: true }).click();

		// Timer digits should be visible and the timer running
		const timerDigits = page.locator('.timer-digits').first();
		await expect(timerDigits).toBeVisible({ timeout: 3000 });

		// Wait more than one tick so the counter has a chance to advance
		await page.waitForTimeout(1100);

		// Click Stop
		const stopBtn = page.locator('.stop-button').first();
		await expect(stopBtn).toBeVisible({ timeout: 3000 });
		await stopBtn.click();

		// A session entry should appear in the recent sessions list
		await expect(page.locator('.row-wrapper').first()).toBeVisible({ timeout: 3000 });
	});

	test('IndexedDB is initialized with correct tables', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		const tableNames = await page.evaluate(async (): Promise<string[]> => {
			return new Promise((resolve) => {
				const req = indexedDB.open('baby-timer');
				req.onsuccess = () => {
					const db = req.result;
					const names = Array.from(db.objectStoreNames);
					db.close();
					resolve(names);
				};
				req.onerror = () => resolve([]);
			});
		});

		expect(tableNames).toContain('feeding_sessions');
		expect(tableNames).toContain('sleep_sessions');
		expect(tableNames).toContain('babies');
		expect(tableNames).toContain('families');

		// Prove guest data survives a reload (the actual offline-first guarantee)
		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
		// Tiles are visible, meaning the baby was loaded from IndexedDB (not showing empty state)
		await expect(page.locator('button.tile.type-feed')).toBeVisible({ timeout: 5000 });
	});

	test('can create a baby without logging in', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app/babies');
		await page.waitForLoadState('networkidle');

		// /app/babies redirects to /app/family
		await expect(page).toHaveURL(/\/app\/family/);

		// Open add baby form
		await page.getByRole('button', { name: /\+ add/i }).click();

		// Fill in and submit the form
		await page.getByPlaceholder('Baby name').fill('Guest Baby');
		await page.getByRole('button', { name: 'Save', exact: true }).click();

		// Baby should appear in the list
		await expect(page.getByText('Guest Baby')).toBeVisible({ timeout: 3000 });
	});

	test('page.context().setOffline keeps app on screen', async ({ page, context }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Wait for the service worker to be installed and activated
		await page.evaluate(async () => {
			if ('serviceWorker' in navigator) {
				await navigator.serviceWorker.ready;
			}
		});

		// Put the browser context fully offline
		await context.setOffline(true);

		// Reload — SPA shell should still render from cache
		await page.reload();
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('body')).toBeVisible();

		// Restore network for subsequent tests
		await context.setOffline(false);
	});
});
