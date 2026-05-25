<script lang="ts">
	import { base } from '$app/paths';
	import { Sun, Moon, Sunset, Cloud, Settings } from '@lucide/svelte';
	import BabySelector from './BabySelector.svelte';
	import { getTheme, setTheme, THEMES } from '$lib/state/theme.svelte';
	import type { Theme } from '$lib/state/theme.svelte';

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

	let currentTheme = $derived(getTheme());
	let ThemeIcon = $derived(themeIcon(currentTheme));
	let nextThemeLabel = $derived(NEXT_THEME_LABEL[currentTheme]);
</script>

<header class="appbar">
	<div class="appbar__left">
		<BabySelector />
	</div>
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
</style>
