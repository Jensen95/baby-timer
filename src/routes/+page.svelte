<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';

	const session = getContext<SessionStore>(SESSION_KEY);
</script>

<svelte:head>
	<title>Baby Timer — Track feeding & sleep</title>
	<meta
		name="description"
		content="A simple family app for tracking baby feeding and sleep sessions in real time."
	/>
</svelte:head>

<section class="hero is-primary is-medium">
	<div class="hero-body">
		<div class="container has-text-centered">
			<h1 class="title is-1">Baby Timer</h1>
			<p class="subtitle is-4">Track feeding and sleep — together, in real time</p>
			{#if session.user}
				<a href="/app" class="button is-white is-medium mt-4">Open Dashboard</a>
			{:else}
				<a href="/login" class="button is-white is-medium mt-4">Get Started →</a>
			{/if}
		</div>
	</div>
</section>

<section class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-10">
				<div class="columns">
					<div class="column has-text-centered">
						<div class="box">
							<p class="is-size-2 mb-3">🍼</p>
							<h3 class="title is-5">Feeding Timer</h3>
							<p class="has-text-grey">
								Track duration and which breast — left, right, or both. Active sessions sync
								instantly across devices.
							</p>
						</div>
					</div>
					<div class="column has-text-centered">
						<div class="box">
							<p class="is-size-2 mb-3">😴</p>
							<h3 class="title is-5">Sleep Timer</h3>
							<p class="has-text-grey">
								Log sleep sessions with head position — back, tummy, left, or right. See total sleep
								at a glance.
							</p>
						</div>
					</div>
					<div class="column has-text-centered">
						<div class="box">
							<p class="is-size-2 mb-3">👨‍👩‍👦</p>
							<h3 class="title is-5">Family Sharing</h3>
							<p class="has-text-grey">
								Both parents see live updates. No manual syncing — one parent starts a timer, the
								other sees it immediately.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="has-text-centered mt-5">
			<p class="has-text-grey is-size-7">
				Open source · Hosted on GitHub Pages · Data stored securely on Supabase
			</p>
		</div>
	</div>
</section>
