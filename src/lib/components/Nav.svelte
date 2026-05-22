<script lang="ts">
	import { page } from '$app/stores';

	interface Props {
		familyName?: string;
	}

	let { familyName }: Props = $props();
	let menuOpen = $state(false);
</script>

<nav class="navbar is-primary" aria-label="main navigation">
	<div class="container">
		<div class="navbar-brand">
			<a class="navbar-item has-text-weight-bold" href="/app">
				Baby Timer
				{#if familyName}
					<span class="tag is-light ml-2">{familyName}</span>
				{/if}
			</a>

			<button
				class="navbar-burger {menuOpen ? 'is-active' : ''}"
				aria-label="menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
				type="button"
			>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
			</button>
		</div>

		<div class="navbar-menu {menuOpen ? 'is-active' : ''}">
			<div class="navbar-end">
				<a class="navbar-item {$page.url.pathname === '/app' ? 'is-active' : ''}" href="/app">
					Dashboard
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith('/app/history') ? 'is-active' : ''}"
					href="/app/history"
				>
					History
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith('/app/stats') ? 'is-active' : ''}"
					href="/app/stats"
				>
					Stats
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith('/app/babies') ? 'is-active' : ''}"
					href="/app/babies"
				>
					Babies
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith('/app/family') ? 'is-active' : ''}"
					href="/app/family"
				>
					Family
				</a>
				<div class="navbar-item">
					<a class="button is-light is-small" href="/logout">Sign out</a>
				</div>
			</div>
		</div>
	</div>
</nav>
