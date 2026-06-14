import { test, expect } from '@playwright/test';

test.describe('Device Link Flow', () => {
	test('new device can start device-link and exchange approved request', async ({ page }) => {
		await page.route('**/auth/v1/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ data: { session: null }, error: null })
			});
		});

		await page.route('**/functions/v1/api/device-link/create', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					request_id: '00000000-0000-0000-0000-000000000001',
					user_code: 'AB12CD34',
					approval_qr_token: '00000000-0000-0000-0000-000000000002',
					poll_token: '00000000-0000-0000-0000-000000000003',
					expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
				})
			});
		});

		await page.route('**/functions/v1/api/device-link/status', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					status: 'approved',
					expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
					approved_at: new Date().toISOString(),
					denied_at: null,
					approved_by_user_id: '00000000-0000-0000-0000-000000000004'
				})
			});
		});

		await page.route('**/functions/v1/device-link-exchange', async (route) => {
			const requestUrl = new URL(route.request().url());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					status: 'approved',
					actionLink: `${requestUrl.origin}/app`
				})
			});
		});

		// The approved exchange hands back a magic-link `actionLink` that the page
		// navigates to via window.location.assign. That target lives on the Supabase
		// origin (unreachable in tests), so stub the navigation with a minimal page
		// to make the post-login redirect deterministic.
		await page.route('**/app', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<!doctype html><html><body>app</body></html>'
			});
		});

		await page.goto('/login');
		await page.getByRole('button', { name: /sign in with another device/i }).click();

		await expect(page.getByText('AB12CD34')).toBeVisible();
		await expect(page).toHaveURL(/\/app/);
	});

	// Issue #85: the requesting device must tell the exchange function where to
	// redirect, so local/dev testing returns to the local origin instead of the
	// prod default baked into Supabase settings. With no PUBLIC_APP_REDIRECT_URL
	// override set, the resolved base is window.location.origin (the local app).
	// The old code sent no redirectTo at all.
	test('approval forwards a redirectTo base to the exchange function', async ({ page }) => {
		await page.route('**/auth/v1/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ data: { session: null }, error: null })
			});
		});

		await page.route('**/functions/v1/api/device-link/create', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					request_id: '00000000-0000-0000-0000-000000000001',
					user_code: 'AB12CD34',
					approval_qr_token: '00000000-0000-0000-0000-000000000002',
					poll_token: '00000000-0000-0000-0000-000000000003',
					expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
				})
			});
		});

		await page.route('**/functions/v1/api/device-link/status', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					status: 'approved',
					expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
					approved_at: new Date().toISOString(),
					denied_at: null,
					approved_by_user_id: '00000000-0000-0000-0000-000000000004'
				})
			});
		});

		let exchangeBody: Record<string, unknown> | null = null;
		await page.route('**/functions/v1/device-link-exchange', async (route) => {
			exchangeBody = route.request().postDataJSON();
			const requestUrl = new URL(route.request().url());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					status: 'approved',
					actionLink: `${requestUrl.origin}/app`
				})
			});
		});

		await page.route('**/app', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<!doctype html><html><body>app</body></html>'
			});
		});

		await page.goto('/login');
		await page.getByRole('button', { name: /sign in with another device/i }).click();
		await expect(page).toHaveURL(/\/app/);

		// The client resolved a redirect base and forwarded it as `${base}/app`.
		// Default (no override) base is the local origin under test.
		expect(exchangeBody).not.toBeNull();
		expect(exchangeBody!.redirectTo).toBe('http://localhost:4173/app');
	});
});
