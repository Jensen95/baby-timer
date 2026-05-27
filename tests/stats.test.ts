import { test, expect, type Page } from '@playwright/test';

const MIN_DESKTOP_PAGE_WIDTH = 850;
const MAX_DESKTOP_PAGE_WIDTH = 1080;
const MIN_TABLET_PAGE_WIDTH = 700;
const MAX_TABLET_PAGE_WIDTH = 820;

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

test.describe('Stats', () => {
	async function expectCompactTabLayout(page: Page) {
		const layoutDimensions = await page.locator('.tab-bar').evaluate((el) => {
			const tabBarWidth = el.getBoundingClientRect().width;
			const parentWidth = (el.parentElement as HTMLElement).getBoundingClientRect().width;
			return { tabBarWidth, parentWidth };
		});
		expect(layoutDimensions.tabBarWidth).toBeLessThan(layoutDimensions.parentWidth);
	}

	test('desktop stats layout uses wider page and compact tab bar', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/app/stats');
		await page.waitForLoadState('networkidle');

		const pageWidth = await page
			.locator('.page')
			.evaluate((el) => el.getBoundingClientRect().width);
		expect(pageWidth).toBeGreaterThan(MIN_DESKTOP_PAGE_WIDTH);
		expect(pageWidth).toBeLessThanOrEqual(MAX_DESKTOP_PAGE_WIDTH);
		await expectCompactTabLayout(page);
	});

	test('tablet stats layout remains wide and keeps compact tab bar', async ({ page }) => {
		await mockSupabaseUnauthenticated(page);
		await page.setViewportSize({ width: 820, height: 1180 });
		await page.goto('/app/stats');
		await page.waitForLoadState('networkidle');

		const pageWidth = await page
			.locator('.page')
			.evaluate((el) => el.getBoundingClientRect().width);
		expect(pageWidth).toBeGreaterThan(MIN_TABLET_PAGE_WIDTH);
		expect(pageWidth).toBeLessThanOrEqual(MAX_TABLET_PAGE_WIDTH);
		await expectCompactTabLayout(page);
	});
});
