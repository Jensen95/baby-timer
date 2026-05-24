<script lang="ts">
	import '../app.css';
	import { setContext } from 'svelte';
	import { createSession } from '$lib/auth/session.svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import { createSyncEngine, SYNC_KEY } from '$lib/db/sync.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';

	const session = createSession();
	setContext(SESSION_KEY, session);

	const sync = createSyncEngine();
	setContext(SYNC_KEY, sync);

	let { children } = $props();

	$effect(() => {
		sync.start();
		return () => sync.stop();
	});
</script>

<div class="app">
	{#if session.user}
		<AppBar />
	{/if}
	<main>
		{@render children()}
	</main>
	<BottomNav />
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
