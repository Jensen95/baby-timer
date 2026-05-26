<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { Sun, Moon, Sunset, Cloud, Settings } from '@lucide/svelte';
	import BabySelector from './BabySelector.svelte';
	import { getTheme, setTheme, THEMES } from '$lib/state/theme.svelte';
	import type { Theme } from '$lib/state/theme.svelte';

	type AppNavItem = {
		href: string;
		label: string;
		exact: boolean;
	};

	function cycleTheme() {
		const current = getTheme();
		const idx = THEMES.indexOf(current);
		const next = THEMES[(idx + 1) % THEMES.length];
		setTheme(next);
	}

	function themeIcon(theme: Theme) {
		if (theme === 'light') return Sun;
		if (theme === 'dark') return Moon;
		if (theme === 'night') return Sunset;
		return Cloud;
	}

	const NEXT_THEME_LABEL: Record<Theme, string> = {
		light: 'dark',
		dark: 'night',
		night: 'grey',
		grey: 'light'
	};

	const appNavItems: AppNavItem[] = [
		{ href: `${base}/app`, label: 'Track', exact: true },
		{ href: `${base}/app/history`, label: 'History', exact: false },
		{ href: `${base}/app/stats`, label: 'Insights', exact: false },
		{ href: `${base}/app/settings`, label: 'More', exact: false }
	];

	function isActive(href: string, exact: boolean): boolean {
		const path = $page.url.pathname;
		return exact ? path === href : path.startsWith(href);
	}

	let currentTheme = $derived(getTheme());
	let ThemeIcon = $derived(themeIcon(currentTheme));
	let nextThemeLabel = $derived(NEXT_THEME_LABEL[currentTheme]);
</script>

<header class="appbar">
	<div class="appbar__left">
		<BabySelector />
	</div>
	<nav class="appbar__nav" aria-label="primary navigation">
		{#each appNavItems as item}
			<a href={item.href} class="appbar__nav-link" class:active={isActive(item.href, item.exact)}>
				{item.label}
			</a>
		{/each}
	</nav>
	<div class="appbar__right">
		<button
			class="icon-btn"
			type="button"
			onclick={cycleTheme}
			aria-label="Switch to {nextThemeLabel} theme"
		>
			<ThemeIcon size={20} aria-hidden="true" />
		</button>
		<a href="{base}/app/settings" class="icon-btn" aria-label="Settings">
			<Settings size={20} aria-hidden="true" />
		</a>
	</div>
</header>

<style>
	.appbar {
		position: sticky;
		top: 0;
		z-index: 50;
		height: var(--appbar-h);
		padding-top: env(safe-area-inset-top);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		padding-left: var(--space-4);
		padding-right: var(--space-4);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.appbar__left {
		display: flex;
		align-items: center;
	}

	.appbar__nav {
		display: none;
		align-items: center;
		gap: var(--space-1);
	}

	.appbar__nav-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
		text-decoration: none;
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--text-2);
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.appbar__nav-link:hover {
		text-decoration: none;
		color: var(--text);
		background: var(--surface-2);
	}

	.appbar__nav-link.active {
		color: var(--brand);
		background: var(--brand-subtle);
	}

	.appbar__right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: none;
		background: none;
		border-radius: var(--radius-2);
		color: var(--text-2);
		cursor: pointer;
		text-decoration: none;
		transition:
			color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.icon-btn:hover {
		color: var(--text);
		background: var(--surface-2);
	}

	@media (min-width: 769px) {
		.appbar__nav {
			display: flex;
		}
	}
</style>
