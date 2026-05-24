<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { base } from '$app/paths';
	import { Milk, Moon, Wind, type Icon as LucideIcon } from 'lucide-svelte';
	import { getNow, startTick, stopTick } from '$lib/state/time.svelte';
	import {
		getActiveTimers,
		stopFeedingTimer,
		stopSleepTimer,
		stopPumpTimer,
		type ActiveTimer
	} from '$lib/timer/active-timers.svelte';
	import { BABY_STATE_KEY, type BabyState } from '$lib/state/baby.svelte';

	interface Props {
		babyId: string | null;
	}

	let { babyId }: Props = $props();

	const babyState = getContext<BabyState | undefined>(BABY_STATE_KEY);

	const typeLabels: Record<ActiveTimer['type'], string> = {
		feed: 'FEEDING',
		sleep: 'SLEEP',
		pump: 'PUMP'
	};

	const typeIcons: Record<ActiveTimer['type'], typeof LucideIcon> = {
		feed: Milk,
		sleep: Moon,
		pump: Wind
	};

	let activeTimers = $derived(babyId ? getActiveTimers(babyId) : []);

	// Only label the baby when more than one is tracked; single-baby use omits it to save space.
	let showBabyName = $derived((babyState?.babies.length ?? 0) > 1);

	function babyNameFor(timer: ActiveTimer): string | null {
		if (!showBabyName) return null;
		return babyState?.babies.find((b) => b.id === timer.babyId)?.name ?? null;
	}

	function elapsedFor(timer: ActiveTimer): number {
		return Math.max(0, Math.floor((getNow() - timer.startedAt.getTime()) / 1000));
	}

	function formatClock(totalSeconds: number): string {
		const safe = Math.max(0, totalSeconds);
		const hours = Math.floor(safe / 3600);
		const minutes = Math.floor((safe % 3600) / 60);
		const seconds = safe % 60;
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
	}

	let stoppingIds = $state<Set<string>>(new Set());

	async function handleStop(timer: ActiveTimer) {
		if (stoppingIds.has(timer.localId)) return;
		stoppingIds = new Set(stoppingIds).add(timer.localId);
		try {
			if (timer.type === 'feed') {
				await stopFeedingTimer(timer.babyId);
			} else if (timer.type === 'sleep') {
				await stopSleepTimer(timer.babyId);
			} else {
				await stopPumpTimer(timer.babyId);
			}
		} finally {
			const next = new Set(stoppingIds);
			next.delete(timer.localId);
			stoppingIds = next;
		}
	}

	onMount(() => {
		startTick();
		return () => stopTick();
	});
</script>

{#if activeTimers.length > 0}
	<div
		class="active-bar"
		class:stacked={activeTimers.length > 1}
		role="status"
		aria-label="Active timers"
	>
		{#each activeTimers as timer (timer.localId)}
			{@const Icon = typeIcons[timer.type]}
			{@const name = babyNameFor(timer)}
			<div class="row type-{timer.type}">
				<a href="{base}/app" class="bar-link" aria-label="View {typeLabels[timer.type]} timer">
					<span class="type-icon" aria-hidden="true"><Icon size={20} /></span>
					<span class="type-label">{typeLabels[timer.type]}</span>
					{#if name}<span class="baby-name">&middot; {name}</span>{/if}
					<span class="elapsed">&middot; {formatClock(elapsedFor(timer))}</span>
				</a>
				<button
					class="stop-button"
					type="button"
					disabled={stoppingIds.has(timer.localId)}
					aria-label="Stop {typeLabels[timer.type]} timer"
					onclick={() => handleStop(timer)}
				>
					{stoppingIds.has(timer.localId) ? '…' : 'STOP'}
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.active-bar {
		position: fixed;
		bottom: var(--bottom-nav-h);
		left: 0;
		right: 0;
		z-index: 90;
		height: var(--active-bar-h);
		background: var(--surface);
		border-top: 1px solid var(--border);
		box-shadow: 0 -2px 8px hsl(0 0% 0% / 0.08);
		padding: 0 var(--space-4);
	}

	.active-bar.stacked {
		height: calc(var(--active-bar-h) * 2);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--active-bar-h);
	}

	.active-bar.stacked .row + .row {
		border-top: 1px solid var(--divider);
	}

	.bar-link {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		height: 100%;
		text-decoration: none;
		color: var(--text);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.type-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	.type-label {
		flex: none;
	}

	.baby-name,
	.elapsed {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.type-feed .type-icon,
	.type-feed .type-label {
		color: var(--feed-ink);
	}

	.type-sleep .type-icon,
	.type-sleep .type-label {
		color: var(--sleep-ink);
	}

	.type-pump .type-icon,
	.type-pump .type-label {
		color: var(--pump-ink);
	}

	.stop-button {
		flex: none;
		background: var(--danger);
		color: white;
		border-radius: var(--radius-pill);
		padding: var(--space-1) var(--space-3);
		border: none;
		min-height: 36px;
		cursor: pointer;
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-2);
	}

	.stop-button:disabled {
		opacity: 0.7;
		cursor: default;
	}
</style>
