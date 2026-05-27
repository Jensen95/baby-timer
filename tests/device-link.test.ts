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

		await page.route('**/rest/v1/rpc/create_device_link_request', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						request_id: '00000000-0000-0000-0000-000000000001',
						user_code: 'AB12CD34',
						approval_qr_token: '00000000-0000-0000-0000-000000000002',
						poll_token: '00000000-0000-0000-0000-000000000003',
						expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
					}
				])
			});
		});

		await page.route('**/rest/v1/rpc/get_device_link_status', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						status: 'approved',
						expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
						approved_at: new Date().toISOString(),
						denied_at: null,
						approved_by_user_id: '00000000-0000-0000-0000-000000000004'
					}
				])
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

		await page.goto('/login');
		await page.getByRole('button', { name: /sign in with another device/i }).click();

		await expect(page.getByText('AB12CD34')).toBeVisible();
		await expect(page).toHaveURL(/\/app/);
	});
});
