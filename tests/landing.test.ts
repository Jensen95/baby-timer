import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
	test('renders the hero title', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Baby Timer' })).toBeVisible();
	});

	test('shows Get Started button when not logged in', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
	});

	test('shows feature cards', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Feeding Timer' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Sleep Timer' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Family Sharing' })).toBeVisible();
	});

	test('Get Started link goes to /login', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: /get started/i }).click();
		await expect(page).toHaveURL(/\/login/);
	});
});
