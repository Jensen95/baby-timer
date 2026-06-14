import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		env: {
			// E2E is hermetic: all Supabase traffic is mocked via page.route, so the
			// build must use the PLACEHOLDER url, never a real (secret) one. supabase-js
			// derives its auth storage key from the url host (`sb-<label>-auth-token`),
			// so tests that seed a session in localStorage rely on this being constant
			// (`sb-placeholder-auth-token`). Inheriting a real secret URL in CI would
			// change the key and break session seeding.
			PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
			PUBLIC_SUPABASE_ANON_KEY: 'placeholder-key',
			PUBLIC_APP_REDIRECT_URL: process.env.PUBLIC_APP_REDIRECT_URL ?? ''
		}
	},
	testDir: 'tests',
	testMatch: '**/*.test.ts',
	timeout: 15_000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
