// See https://kit.svelte.dev/docs/types#app
declare global {
	namespace App {
		// No server-side locals needed — static SPA
	}
}

declare module '$env/static/public' {
	export const PUBLIC_SUPABASE_URL: string;
	export const PUBLIC_SUPABASE_ANON_KEY: string;
}

export {};
