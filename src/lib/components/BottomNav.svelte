<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	const navItems = [
		{ href: `${base}/app`, label: 'Home', icon: '🏠', exact: true },
		{ href: `${base}/app/history`, label: 'History', icon: '📋', exact: false },
		{ href: `${base}/app/stats`, label: 'Stats', icon: '📊', exact: false },
		{ href: `${base}/app/babies`, label: 'Babies', icon: '👶', exact: false },
		{ href: `${base}/app/family`, label: 'Family', icon: '👨‍👩‍👧', exact: false }
	];

	function isActive(href: string, exact: boolean): boolean {
		const path = $page.url.pathname;
		return exact ? path === href : path.startsWith(href);
	}
</script>

<nav class="bottom-nav" aria-label="bottom navigation">
	{#each navItems as item}
		<a
			href={item.href}
			class="bottom-nav-item"
			class:bottom-nav-item--active={isActive(item.href, item.exact)}
			aria-label={item.label}
		>
			<span class="bottom-nav-icon">{item.icon}</span>
			<span class="bottom-nav-label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-nav-height, 64px);
		background: var(--color-surface, #fff);
		border-top: 1px solid var(--color-border, #f0e8ed);
		display: flex;
		align-items: stretch;
		z-index: 100;
		box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
	}

	@media (min-width: 769px) {
		.bottom-nav {
			display: none;
		}
	}

	.bottom-nav-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		text-decoration: none;
		color: var(--color-text-secondary, #888);
		font-size: 0.7rem;
		font-weight: 600;
		transition: color 0.15s ease;
	}

	.bottom-nav-item--active {
		color: var(--color-primary, hsl(340, 65%, 70%));
	}

	.bottom-nav-item:hover {
		text-decoration: none;
		color: var(--color-primary, hsl(340, 65%, 70%));
	}

	.bottom-nav-icon {
		font-size: 1.3rem;
		line-height: 1;
	}

	.bottom-nav-label {
		line-height: 1;
	}
</style>
