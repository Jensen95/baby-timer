<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { Timer, List, ChartNoAxesColumn, Ellipsis } from '@lucide/svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: any;
		exact: boolean;
	}

	const navItems: NavItem[] = [
		{ href: `${base}/app`, label: 'Track', icon: Timer, exact: true },
		{ href: `${base}/app/history`, label: 'History', icon: List, exact: false },
		{ href: `${base}/app/stats`, label: 'Insights', icon: ChartNoAxesColumn, exact: false },
		{ href: `${base}/app/settings`, label: 'More', icon: Ellipsis, exact: false }
	];

	function isActive(href: string, exact: boolean): boolean {
		const path = $page.url.pathname;
		return exact ? path === href : path.startsWith(href);
	}
</script>

<nav class="bottom-nav" aria-label="bottom navigation">
	{#each navItems as item}
		{@const active = isActive(item.href, item.exact)}
		<a href={item.href} class="bottom-nav-item" class:active aria-label={item.label}>
			<span class="icon-wrapper" class:icon-active={active}>
				<svelte:component this={item.icon} size={22} />
			</span>
			<span class="label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-nav-h);
		background: var(--surface);
		border-top: 1px solid var(--border);
		display: flex;
		align-items: stretch;
		padding-bottom: max(var(--space-2), env(safe-area-inset-bottom));
		z-index: 100;
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
		gap: var(--space-1);
		padding: var(--space-2) var(--space-1);
		min-height: var(--tap-min);
		text-decoration: none;
		color: var(--text-2);
		font-size: var(--font-size-1);
		transition: color var(--duration-fast) ease;
	}

	.bottom-nav-item:hover {
		color: var(--text);
	}

	.bottom-nav-item.active {
		color: var(--brand);
	}

	.icon-wrapper {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: currentColor;
	}

	.icon-wrapper.icon-active {
		background: var(--brand-subtle);
		border-radius: var(--radius-pill);
		padding: 2px 12px;
	}

	.label {
		line-height: 1;
		font-weight: var(--fw-semibold);
	}
</style>
