<script lang="ts">
	import '$lib/i18n';
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { setContext } from 'svelte';
	import { createSession } from '$lib/auth/session.svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import { createSyncEngine, SYNC_KEY } from '$lib/db/sync.svelte';
	import { createBabyState, BABY_STATE_KEY } from '$lib/state/baby.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';

	const session = createSession();
	setContext(SESSION_KEY, session);

	const sync = createSyncEngine();
	setContext(SYNC_KEY, sync);

	const babyState = createBabyState();
	setContext(BABY_STATE_KEY, babyState);

	let { children } = $props();

	let appPrefix = $derived(resolve('/app'));
	let inAppRoute = $derived.by(() => {
		const path = page.url.pathname;
		return path === appPrefix || path.startsWith(`${appPrefix}/`);
	});

	$effect(() => {
		sync.start();
		return () => sync.stop();
	});
</script>

<div class="app">
	{#if inAppRoute}
		<AppBar />
	{/if}
	<main>
		{@render children()}
	</main>
	{#if inAppRoute}
		<BottomNav />
	{/if}
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
	}
</style>
