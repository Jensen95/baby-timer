import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			strategies: 'generateSW',
			outDir: 'build',
			includeAssets: ['favicon.png', 'robots.txt'],
			manifest: {
				name: 'Baby Timer',
				short_name: 'BabyTimer',
				description: 'Track feeding and sleep for your baby — works offline',
				theme_color: '#f8a5c2',
				background_color: '#fdf6f9',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/app',
				scope: '/',
				icons: [
					{
						src: '/icons/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icons/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable any'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				navigateFallback: '/404.html',
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
