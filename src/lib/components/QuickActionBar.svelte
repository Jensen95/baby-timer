<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { Baby, Milk, Moon, Wind, type Icon as LucideIcon } from '@lucide/svelte';
	import { getActiveTimers, canStartTimer } from '$lib/timer/active-timers.svelte';

	interface Props {
		babyId: string | null;
	}

	type QuickAction = 'feed' | 'sleep' | 'pump' | 'diaper';

	interface QuickActionItem {
		action: QuickAction;
		label: string;
		icon: typeof LucideIcon;
	}

	const ACTIONS: QuickActionItem[] = [
		{ action: 'feed', label: 'Feed', icon: Milk },
		{ action: 'sleep', label: 'Sleep', icon: Moon },
		{ action: 'pump', label: 'Pump', icon: Wind },
		{ action: 'diaper', label: 'Diaper', icon: Baby }
	];

	let { babyId }: Props = $props();
	let isTrackPage = $derived(page.url.pathname === `${base}/app`);

	let activeRows = $derived.by(() => {
		if (!babyId) return 0;
		return Math.min(getActiveTimers(babyId).length, 2);
	});

	let visibleActions = $derived.by(() => {
		if (!isTrackPage || !babyId) return [] as QuickActionItem[];

		return ACTIONS.filter((item) => {
			if (item.action === 'diaper') return true;
			return canStartTimer(babyId, item.action).allowed;
		});
	});

	let bottomOffset = $derived(
		`calc(var(--bottom-nav-h) + (var(--active-bar-h) * ${activeRows}) + var(--space-2))`
	);

	async function openQuickAction(action: QuickAction) {
		await goto(`${base}/app?quickAction=${action}`, {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

{#if visibleActions.length > 0}
	<nav class="quick-actions" style:bottom={bottomOffset} aria-label="Quick tracking actions">
		{#each visibleActions as item (item.action)}
			{@const Icon = item.icon}
			<button
				type="button"
				class="action action-{item.action}"
				onclick={() => openQuickAction(item.action)}
				aria-label={`Quick start ${item.label}`}
			>
				<span class="icon" aria-hidden="true"><Icon size={16} /></span>
				<span class="label">{item.label}</span>
			</button>
		{/each}
	</nav>
{/if}

<style>
	.quick-actions {
		position: fixed;
		left: var(--space-4);
		right: var(--space-4);
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
		padding: var(--space-2);
		background: hsl(from var(--surface) h s l / 0.94);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-2);
		backdrop-filter: blur(8px);
		z-index: 95;
	}

	.action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-pill);
		color: var(--text);
		font-size: var(--font-size-1);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			filter var(--duration-fast) var(--ease-out);
	}

	.action:active {
		transform: scale(0.98);
	}

	.action-feed {
		background: var(--feed-fill);
		color: var(--feed-ink);
	}

	.action-sleep {
		background: var(--sleep-fill);
		color: var(--sleep-ink);
	}

	.action-pump {
		background: var(--pump-fill);
		color: var(--pump-ink);
	}

	.action-diaper {
		background: var(--diaper-fill);
		color: var(--diaper-ink);
	}

	.action:hover {
		filter: brightness(0.97);
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.label {
		line-height: 1;
	}

	@media (min-width: 769px) {
		.quick-actions {
			display: none;
		}
	}
</style>
