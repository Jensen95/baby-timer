<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	interface Props {
		familyName?: string;
	}

	let { familyName }: Props = $props();
	let menuOpen = $state(false);
</script>

<nav class="navbar is-primary" aria-label="main navigation">
	<div class="container">
		<div class="navbar-brand">
			<a class="navbar-item has-text-weight-bold" href="{base}/app">
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
				<a
					class="navbar-item {$page.url.pathname === `${base}/app` ? 'is-active' : ''}"
					href="{base}/app"
				>
					Dashboard
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith(`${base}/app/history`)
						? 'is-active'
						: ''}"
					href="{base}/app/history"
				>
					History
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith(`${base}/app/stats`)
						? 'is-active'
						: ''}"
					href="{base}/app/stats"
				>
					Stats
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith(`${base}/app/babies`)
						? 'is-active'
						: ''}"
					href="{base}/app/babies"
				>
					Babies
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith(`${base}/app/family`)
						? 'is-active'
						: ''}"
					href="{base}/app/family"
				>
					Family
				</a>
				<a
					class="navbar-item {$page.url.pathname.startsWith(`${base}/app/settings`)
						? 'is-active'
						: ''}"
					href="{base}/app/settings"
				>
					Settings
				</a>
				<div class="navbar-item">
					<a class="button is-light is-small" href="{base}/logout">Sign out</a>
				</div>
			</div>
		</div>
	</div>
</nav>
