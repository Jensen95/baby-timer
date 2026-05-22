<script lang="ts">
	import '../app.scss';
	import { setContext } from 'svelte';
	import { createSession } from '$lib/auth/session.svelte';
	import { SESSION_KEY } from '$lib/auth/context';

	const session = createSession();
	setContext(SESSION_KEY, session);

	let { children } = $props();
</script>

<div class="app">
	<main>
		{@render children()}
	</main>
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
