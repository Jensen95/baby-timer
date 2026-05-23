import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rawBasePath = (process.env.BASE_PATH ?? '').trim();
let basePath = '';
if (rawBasePath === '/') {
	basePath = '';
} else if (rawBasePath) {
	basePath = rawBasePath.replace(/\/$/, '');
}
if (basePath && !basePath.startsWith('/')) {
	throw new Error('BASE_PATH must be empty or start with "/"');
}
const appPath = `${basePath}/app`;
const appScope = `${basePath}/`;

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: null,
			strategies: 'generateSW',
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
				additionalManifestEntries: [{ url: appPath, revision: null }],
				navigateFallback: appPath,
				navigateFallbackAllowlist: [new RegExp(`^${appPath}`)],
				clientsClaim: true,
				skipWaiting: true
			}
		})
	],

	// @ts-expect-error — vitest reads `test` from vite config at runtime
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
