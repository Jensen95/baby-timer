import { test, expect } from '@playwright/test';

test.describe('Join By Code', () => {
	test('unauthenticated user is redirected to login and join code is persisted', async ({
		page
	}) => {
		await page.route('**/auth/v1/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ data: { session: null }, error: null })
			});
		});

		await page.goto('/join?code=ZXCV1234');
		await page.getByRole('button', { name: /join family/i }).click();

		await expect(page).toHaveURL(/\/login/);
		await expect(
			page.evaluate(() => window.localStorage.getItem('baby-timer:pending-join-code'))
		).resolves.toBe('ZXCV1234');
	});
});
