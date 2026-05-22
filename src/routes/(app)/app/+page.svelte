<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';

	const session = getContext<SessionStore>(SESSION_KEY);
</script>

<section class="section">
	<div class="container">
		<h1 class="title">Dashboard</h1>
		<p class="subtitle">Welcome, {session.user?.email}</p>
		<p>Timers coming soon.</p>
	</div>
</section>
