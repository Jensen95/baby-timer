import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
	test('login page renders the magic link form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByRole('heading', { name: 'Baby Timer' })).toBeVisible();
		await expect(page.getByLabel('Email')).toBeVisible();
		await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
	});

	test('login form validates email input', async ({ page }) => {
		await page.goto('/login');
		const emailInput = page.getByLabel('Email');
		const submitButton = page.getByRole('button', { name: /send magic link/i });

		// Click submit without filling in email — HTML validation should prevent submission
		await submitButton.click();
		// The form should not navigate away (stays on /login)
		await expect(page).toHaveURL(/\/login/);
		await expect(emailInput).toBeVisible();
	});

	test('unauthenticated user accessing /app is redirected to /login', async ({ page }) => {
		// Mock all Supabase API calls to return unauthenticated
		await page.route('**/rest/v1/**', (route) =>
			route.fulfill({ status: 401, body: '{"error":"unauthorized"}' })
		);
		await page.route('**/auth/v1/**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ data: { session: null }, error: null })
			})
		);

		await page.goto('/app');

		// Wait for the client-side redirect
		await page.waitForURL(/\/login/, { timeout: 5000 });
		await expect(page).toHaveURL(/\/login/);
	});
});
