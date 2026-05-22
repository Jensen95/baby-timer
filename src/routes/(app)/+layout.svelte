<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';

	const session = getContext<SessionStore>(SESSION_KEY);

	let { children } = $props();

	$effect(() => {
		if (!session.loading && !session.user) {
			goto('/login');
		}
	});
</script>

{#if session.loading}
	<div class="is-flex is-justify-content-center is-align-items-center" style="min-height: 100vh">
		<span class="loader"></span>
	</div>
{:else if session.user}
	{@render children()}
{/if}
