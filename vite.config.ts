import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const REQUIRED_PUBLIC_ENV_VARS = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'] as const;
const SVELTE_CHECK_EXECUTABLE_PATTERN = /(^|[\\/])svelte-check(?:\.c?js)?$/;

const validateRequiredEnv = (env: Record<string, string>) => {
	const missingVars = REQUIRED_PUBLIC_ENV_VARS.filter((key) => !env[key]?.trim());

	if (missingVars.length > 0) {
		throw new Error(
			[
				`Missing required environment variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}`,
				'Create a .env.local file (or set shell env vars) before running Vite.',
				'Start from .env.example and fill in your Supabase credentials.'
			].join('\n')
		);
	}
};

const rawBasePath = (process.env.BASE_PATH ?? '').trim();
const normalizedBasePath = rawBasePath ? rawBasePath.replace(/\/+$/, '') : '';
const basePath = normalizedBasePath === '/' ? '' : normalizedBasePath;
if (basePath && !basePath.startsWith('/')) {
	throw new Error('BASE_PATH must be empty or start with "/"');
}
const appPath = `${basePath}/app`;
const appScope = `${basePath}/`;
const appShellPath = `${appPath}.html`;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const isRunningSvelteCheck = process.argv.some((arg) =>
		SVELTE_CHECK_EXECUTABLE_PATTERN.test(arg)
	);
	const shouldValidateEnv =
		(command === 'serve' || command === 'build') &&
		mode !== 'test' &&
		!process.env.VITEST &&
		!isRunningSvelteCheck;

	if (shouldValidateEnv) {
		validateRequiredEnv(env);
	}

	const config = {
		plugins: [
			sveltekit(),
			VitePWA({
				registerType: 'autoUpdate',
				injectRegister: 'auto',
				strategies: 'generateSW',
				devOptions: {
					enabled: false
				},
				includeAssets: ['favicon.svg', 'favicon.png', 'robots.txt'],
				manifest: {
					name: 'Baby Timer',
					short_name: 'BabyTimer',
					description: 'Track feeding and sleep for your baby — works offline',
					theme_color: '#f8a5c2',
					background_color: '#fdf6f9',
					display: 'standalone',
					orientation: 'portrait',
					start_url: appPath,
					scope: appScope,
					icons: [
						{
							src: `${basePath}/icons/pwa-192x192.png`,
							sizes: '192x192',
							type: 'image/png'
						},
						{
							src: `${basePath}/icons/pwa-512x512.png`,
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable any'
						}
					]
				},
				workbox: {
					globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
					additionalManifestEntries: [{ url: appShellPath, revision: null }],
					navigateFallback: appShellPath,
					navigateFallbackAllowlist: [new RegExp(`^${escapeRegex(appPath)}(?:/|$|\\.html$)`)],
					clientsClaim: true,
					skipWaiting: true
				}
			})
		],

		test: {
			include: ['src/**/*.{test,spec}.{js,ts}']
		}
	} satisfies import('vite').UserConfig & {
		test: {
			include: string[];
		};
	};

	return config;
});
