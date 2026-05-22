<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';

	const session = getContext<SessionStore>(SESSION_KEY);

	$effect(() => {
		session.signOut().then(() => goto(`${base}/login`));
	});
</script>

<p>Signing out...</p>
