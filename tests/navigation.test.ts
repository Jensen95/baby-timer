import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
	test('login page has correct page title', async ({ page }) => {
		await page.goto('/login');
		await expect(page).toHaveTitle(/sign in.*baby tracker/i);
	});

	test('landing page has correct meta title', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/baby tracker/i);
	});

	test('404 page returns a page (SPA fallback)', async ({ page }) => {
		// GitHub Pages serves 404.html for unknown paths — the SPA router handles it
		const response = await page.goto('/nonexistent-route-xyz');
		// Should either return 200 (SPA handles routing) or 404 with our fallback
		// Either way, the page should load without crashing
		expect([200, 404]).toContain(response?.status());
	});
});
