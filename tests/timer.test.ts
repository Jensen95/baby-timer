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

async function seedActiveFeedingSession(page: Page) {
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('baby-timer');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('feeding_sessions', 'readwrite');
			tx.objectStore('feeding_sessions').put({
				id: 'test-feed-resume-1',
				baby_id: 'timer-test-baby',
				family_id: null,
				side: 'left',
				started_at: new Date(Date.now() - 300_000).toISOString(),
				ended_at: null,
				note: null,
				created_at: new Date(Date.now() - 300_000).toISOString(),
				_sync: 'pending'
			});
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	});
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
		await expect(nav.getByText('Family')).toBeVisible();
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

	test('feeding timer resumes after page reload', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Seed baby + an in-progress feeding session from ~5 min ago
		await seedBaby(page);
		await seedActiveFeedingSession(page);

		// Reload — this is the key step: proves resume happens on reload, not just first load
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Stop button visible without any user interaction proves auto-resume
		const stopBtn = page.locator('.timer-btn--stop').first();
		await expect(stopBtn).toBeVisible({ timeout: 5000 });

		// Timer digits are visible and not at zero (resumed from ~5 min ago)
		const timerDigits = page.locator('.timer-digits').first();
		await expect(timerDigits).toBeVisible();
		const elapsedText = await timerDigits.innerText();
		// A freshly-started (non-resumed) timer would show 0:00 or near-zero
		expect(elapsedText).not.toMatch(/^0:0[0-4]/);

		// Timer is counting — digits advance after 1 second
		await page.waitForTimeout(1100);
		expect(await timerDigits.innerText()).not.toBe(elapsedText);

		// No duplicate session created — resume reused the existing row
		const count = await page.evaluate(async (): Promise<number> => {
			return new Promise((resolve) => {
				const req = indexedDB.open('baby-timer');
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction('feeding_sessions', 'readonly');
					const countReq = tx.objectStore('feeding_sessions').count();
					countReq.onsuccess = () => {
						db.close();
						resolve(countReq.result);
					};
				};
				req.onerror = () => resolve(-1);
			});
		});
		expect(count).toBe(1);
	});

	test('switching side during active feeding updates saved session side', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');

		const feedingCard = page.locator('.timer-card').filter({ hasText: 'Feeding' }).first();
		await feedingCard.locator('.timer-btn--start').click();
		await feedingCard.getByRole('button', { name: 'Right' }).click();
		await feedingCard.locator('.timer-btn--stop').click();

		await expect(page.locator('.session-type').first()).toContainText('right');
	});

	test('session can be edited and deleted from recent sessions', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');

		const feedingCard = page.locator('.timer-card').filter({ hasText: 'Feeding' }).first();
		await feedingCard.locator('.timer-btn--start').click();
		await feedingCard.locator('.timer-btn--stop').click();
		await expect(page.locator('.session-entry').first()).toBeVisible();

		const sessionEntry = page.locator('.session-entry').first();
		const editButton = sessionEntry.getByRole('button', { name: 'Edit' });
		const deleteButton = sessionEntry.getByRole('button', { name: 'Delete' });

		await editButton.click();
		await expect(page.getByText('Edit Session')).toBeVisible();
		await page.getByLabel('Side').selectOption('both');
		await page.getByLabel('Start time').fill('2026-01-01T01:00');
		await page.getByLabel('End time').fill('2026-01-01T01:05');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(sessionEntry.locator('.session-type')).toContainText('both');

		await deleteButton.click();
		const deleteModal = page.locator('.modal.is-active').filter({ hasText: 'Delete Session' });
		await expect(deleteModal).toBeVisible();
		await deleteModal.getByRole('button', { name: 'Delete' }).click();

		await expect(page.locator('.session-entry')).toHaveCount(0);
	});
});
