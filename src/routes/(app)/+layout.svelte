<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { createBabyState, BABY_STATE_KEY } from '$lib/state/baby.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);
	const babyState = createBabyState();
	setContext(BABY_STATE_KEY, babyState);

	let { children } = $props();

	$effect(() => {
		if (!session.loading && !session.user) {
			goto('/login');
		}
	});
</script>

{#if session.loading}
	<div class="is-flex is-justify-content-center is-align-items-center" style="min-height: 100vh">
		<progress class="progress is-primary is-small" max="100">Loading</progress>
	</div>
{:else if session.user}
	{@render children()}
{/if}
