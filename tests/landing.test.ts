import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
	test('renders the hero title', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Baby Tracker' })).toBeVisible();
	});

	test('shows Start Tracking CTA when not logged in', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('link', { name: /start tracking/i })).toBeVisible();
	});

	test('shows feature cards', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Works offline' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Share with family' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Track everything' })).toBeVisible();
	});

	test('Start Tracking link goes to /login', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: /start tracking/i }).click();
		await expect(page).toHaveURL(/\/login/);
	});
});
