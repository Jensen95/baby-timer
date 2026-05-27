// See https://kit.svelte.dev/docs/types#app
declare global {
	namespace App {
		// No server-side locals needed — static SPA
	}

	interface ImportMetaEnv {
		readonly VITE_RELEASE?: string;
	}
}

declare module '$env/static/public' {
	export const PUBLIC_SUPABASE_URL: string;
	export const PUBLIC_SUPABASE_ANON_KEY: string;
	export const PUBLIC_BUGSINK_DSN: string;
}

export {};
