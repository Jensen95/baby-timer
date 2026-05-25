import { test, expect, type Locator, type Page } from '@playwright/test';

// TimerHero mounts its shared 1s tick after the sheet closes, so wait just over 2s
// to guarantee the visible clock advances at least once in CI.
const TICK_ADVANCE_MS = 2100;

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

async function openSheet(page: Page, tileSelector: string, title: string) {
	const tile = page.locator(tileSelector);
	await expect(tile).toBeVisible({ timeout: 5000 });
	await tile.click();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible({ timeout: 5000 });
	await dialog.evaluate(async (element) => {
		const animations = element.getAnimations?.() ?? [];
		await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
	});
	return dialog;
}

async function startFromSheet(dialog: Locator) {
	const startButton = dialog.getByRole('button', { name: 'Start', exact: true });
	await expect(startButton).toBeVisible({ timeout: 5000 });
	await startButton.evaluate((button: HTMLButtonElement) => button.click());
}

async function activateOption(option: Locator) {
	await expect(option).toBeVisible({ timeout: 5000 });
	await option.evaluate((button: HTMLButtonElement) => button.click());
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
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		const feedDialog = await openSheet(page, 'button.tile.type-feed', 'Start feeding');
		await startFromSheet(feedDialog);

		// Timer digits should now be visible inside TimerHero
		const timerDigits = page.locator('.timer-digits').first();
		await expect(timerDigits).toBeVisible({ timeout: 3000 });
		const initialText = await timerDigits.innerText();

		// Confirm the display has advanced (poll until it changes)
		await expect.poll(() => timerDigits.innerText(), { timeout: 5000 }).not.toBe(initialText);
	});

	test('timer shows in-progress session in recent list', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Start feeding timer
		const feedDialog = await openSheet(page, 'button.tile.type-feed', 'Start feeding');
		await startFromSheet(feedDialog);

		// TimerHero digits appear while the timer is in progress
		await expect(page.locator('.timer-digits')).toBeVisible({ timeout: 3000 });

		// Stop the timer
		await page.locator('.stop-button').first().click();

		// Timer digits disappear after stopping
		await expect(page.locator('.timer-digits')).not.toBeVisible({ timeout: 3000 });

		// The session entry should now appear in the recent sessions list
		await expect(page.locator('.row-wrapper').first()).toBeVisible({ timeout: 3000 });
	});

	test('bottom nav is visible on mobile viewport', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		const nav = page.locator('nav.bottom-nav');
		await expect(nav).toBeVisible();

		// Verify all expected navigation labels are present
		await expect(nav.getByText('Track')).toBeVisible();
		await expect(nav.getByText('History')).toBeVisible();
		await expect(nav.getByText('Insights')).toBeVisible();
		await expect(nav.getByText('More')).toBeVisible();
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
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Stop button visible without any user interaction proves auto-resume
		const stopBtn = page.locator('.stop-button').first();
		await expect(stopBtn).toBeVisible({ timeout: 5000 });

		// Timer digits are visible and not at zero (resumed from ~5 min ago)
		const timerDigits = page.locator('.timer-digits').first();
		await expect(timerDigits).toBeVisible();
		const elapsedText = await timerDigits.innerText();
		// A freshly-started (non-resumed) timer would show 0:00 or near-zero
		expect(elapsedText).not.toMatch(/^0:0[0-4]/);

		// Timer is counting — digits advance (poll until they change)
		await expect.poll(() => timerDigits.innerText(), { timeout: 5000 }).not.toBe(elapsedText);

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
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Start feeding timer via tile + sheet (default side is left)
		const feedDialog = await openSheet(page, 'button.tile.type-feed', 'Start feeding');
		await startFromSheet(feedDialog);

		// Switch to Right side in the TimerHero OptionGrid
		await page.getByRole('radio', { name: 'Right' }).click();

		// Stop the timer
		await page.locator('.stop-button').first().click();

		// Session label should reflect the updated side
		await expect(page.locator('.row-wrapper .label').first()).toContainText(/right/i);
	});

	test('sleep timer supports side sleeping option', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Open sleep start sheet and select the 'Side' position
		const sleepDialog = await openSheet(page, 'button.tile.type-sleep', 'Start sleep');
		await activateOption(sleepDialog.getByRole('radio', { name: 'Side' }));
		await startFromSheet(sleepDialog);

		// Stop the timer
		await page.locator('.stop-button').first().click();

		// Session label should reflect the 'side' position
		await expect(page.locator('.row-wrapper .label').first()).toContainText(/side/i);
	});

	test('breast pump can start while sleep timer is running', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Start sleep timer
		const sleepDialog = await openSheet(page, 'button.tile.type-sleep', 'Start sleep');
		await startFromSheet(sleepDialog);
		await expect(page.locator('section.hero.type-sleep')).toBeVisible({ timeout: 3000 });

		// Pump tile should still be enabled while sleep is running
		const pumpTile = page.locator('button.tile.type-pump');
		await expect(pumpTile).toBeEnabled({ timeout: 3000 });

		// Start pump timer
		const pumpDialog = await openSheet(page, 'button.tile.type-pump', 'Start pump');
		await startFromSheet(pumpDialog);

		// Both timers should now be running
		await expect(page.locator('section.hero.type-pump')).toBeVisible({ timeout: 3000 });
	});

	test('session can be edited and deleted from recent sessions', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		await seedBaby(page);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Start and stop a feeding timer to create a session
		const feedDialog = await openSheet(page, 'button.tile.type-feed', 'Start feeding');
		await startFromSheet(feedDialog);
		await page.locator('.stop-button').first().click();
		await expect(page.locator('.row-wrapper').first()).toBeVisible({ timeout: 3000 });

		// Open overflow menu and edit the session
		await page.locator('.row-wrapper').first().locator('.menu-btn').click();
		await page.getByRole('menuitem', { name: 'Edit' }).click();

		// Edit sheet should open with the session title
		await expect(page.getByText('Edit session')).toBeVisible();

		// Change side to 'Both'
		await activateOption(page.getByRole('radio', { name: 'Both' }));

		// Change start and end times using input IDs (labels have mixed text content)
		await page.locator('#edit-started-at').fill('2026-01-01T01:00');
		await page.locator('#edit-ended-at').fill('2026-01-01T01:05');

		await page
			.getByRole('button', { name: 'Save' })
			.evaluate((button: HTMLButtonElement) => button.click());

		// Session label should now show 'Both'
		await expect(page.locator('.row-wrapper .label').first()).toContainText('Both');

		// Open overflow menu and delete the session (direct delete — no modal on home page)
		await page.locator('.row-wrapper').first().locator('.menu-btn').click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		await expect(page.locator('.row-wrapper')).toHaveCount(0);
	});
});
