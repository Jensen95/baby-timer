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

test.describe('Guest mode', () => {
	test('guest can access /app without logging in', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Should NOT have redirected to /login
		await expect(page).toHaveURL(/\/app/);
		await expect(page).not.toHaveURL(/\/login/);

		// Guest banner with "Sign in to sync" should be visible
		await expect(page.getByText('Sign in to sync')).toBeVisible();
	});

	test('guest banner links to /login', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');

		// Click the "Sign in to sync" link inside the guest banner
		await page.getByRole('link', { name: 'Sign in to sync' }).click();

		await expect(page).toHaveURL(/\/login/);
	});

	test('guest sees empty state with add baby prompt', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.goto('/app');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 10_000 });

		// Empty state heading
		await expect(page.getByRole('heading', { name: 'No babies yet' })).toBeVisible();

		// "Add a baby" link pointing to family management page
		const addBabyLink = page.getByRole('link', { name: 'Add a baby' });
		await expect(addBabyLink).toBeVisible();
		await expect(addBabyLink).toHaveAttribute('href', '/app/family');
	});
});
