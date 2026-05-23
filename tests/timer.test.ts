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
				id: 'timer-test-baby',
				family_id: null,
				name: 'Timer Test Baby',
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

test.describe('Timer', () => {
	test('feeding timer starts and displays elapsed time', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Pre-seed a baby so the timer is shown
		await seedBaby(page);
		// Reload so the app picks up the seeded baby
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Feeding Start button should be present
		const startBtn = page.locator('.timer-btn--start').first();
		await expect(startBtn).toBeVisible({ timeout: 5000 });

		// Capture the initial digit display
		const timerDigits = page.locator('.timer-digits').first();
		const initialText = await timerDigits.innerText();

		// Start the timer
		await startBtn.click();

		// Timer digits should be visible
		await expect(timerDigits).toBeVisible();

		// Wait over one second and confirm the display has advanced
		await page.waitForTimeout(1100);
		const laterText = await timerDigits.innerText();
		expect(laterText).not.toBe(initialText);
	});

	test('timer shows in-progress session in recent list', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Start feeding timer
		const startBtn = page.locator('.timer-btn--start').first();
		await expect(startBtn).toBeVisible({ timeout: 5000 });
		await startBtn.click();

		// A "Live" badge should appear in the recent sessions area
		await expect(page.locator('.session-live')).toBeVisible({ timeout: 3000 });

		// Stop the timer
		const stopBtn = page.locator('.timer-btn--stop').first();
		await expect(stopBtn).toBeVisible({ timeout: 3000 });
		await stopBtn.click();

		// The Live badge should disappear
		await expect(page.locator('.session-live')).not.toBeVisible({ timeout: 3000 });

		// The session entry should now show a duration (not the in-progress placeholder)
		await expect(page.locator('.session-entry').first()).toBeVisible();
		await expect(page.locator('.session-in-progress')).not.toBeVisible();
	});

	test('bottom nav is visible on mobile viewport', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		const nav = page.locator('nav.bottom-nav');
		await expect(nav).toBeVisible();

		// Verify all expected navigation labels are present
		await expect(nav.getByText('Home')).toBeVisible();
		await expect(nav.getByText('History')).toBeVisible();
		await expect(nav.getByText('Stats')).toBeVisible();
		await expect(nav.getByText('Babies')).toBeVisible();
		await expect(nav.getByText('Profile')).toBeVisible();
	});

	test('bottom nav is hidden on desktop viewport', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// The CSS hides bottom-nav above 769px — Playwright respects computed styles
		const nav = page.locator('nav.bottom-nav');
		// The element is in the DOM but hidden via CSS media query
		await expect(nav).toBeHidden();
	});
});
