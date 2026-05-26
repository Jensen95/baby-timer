<script lang="ts">
	import { onMount } from 'svelte';
	import { getNow, startTick, stopTick } from '$lib/state/time.svelte';
	import { HEAD_SIDES } from '$lib/sessions/sleep-balance';
	import type { ActiveTimer } from '$lib/timer/active-timers.svelte';
	import { t } from '@sveltia/i18n';
	import OptionGrid from './OptionGrid.svelte';
	import Button from './Button.svelte';

	interface Props {
		timer: ActiveTimer;
		babyName?: string;
		onstop: () => Promise<void>;
		onsidechange?: (side: string) => Promise<void>;
	}

	let { timer, babyName, onstop, onsidechange }: Props = $props();

	let typeLabels = $derived({
		feed: t('timer.type.feed'),
		sleep: t('timer.type.sleep'),
		pump: t('timer.type.pump')
	});

	let sideOptions = $derived([
		{ value: 'left', label: t('track.options.left') },
		{ value: 'right', label: t('track.options.right') },
		{ value: 'both', label: t('track.options.both') }
	]);

	const headSideKeyMap: Record<string, string> = {
		left: 'track.options.headLeft',
		right: 'track.options.headRight',
		back: 'track.options.back',
		tummy: 'track.options.tummy',
		side: 'track.options.side'
	};

	let positionOptions = $derived(
		HEAD_SIDES.map((side) => ({
			value: side,
			label: t(headSideKeyMap[side])
		}))
	);

	let options = $derived(timer.type === 'sleep' ? positionOptions : sideOptions);

	let selected = $derived(timer.type === 'sleep' ? timer.headSide : timer.side);

	let elapsedSeconds = $derived(Math.floor((getNow() - timer.startedAt.getTime()) / 1000));

	function formatClock(totalSeconds: number): string {
		const safe = Math.max(0, totalSeconds);
		const hours = Math.floor(safe / 3600);
		const minutes = Math.floor((safe % 3600) / 60);
		const seconds = safe % 60;
		const pad = (n: number) => String(n).padStart(2, '0');
		return hours > 0
			? `${hours}:${pad(minutes)}:${pad(seconds)}`
			: `${pad(minutes)}:${pad(seconds)}`;
	}

	let display = $derived(formatClock(elapsedSeconds));

	// Only changes on the minute boundary so the live region announces at most once per minute.
	let elapsedMinutes = $derived(Math.floor(elapsedSeconds / 60));
	let announcement = $derived(
		t('timer.elapsed', { values: { type: typeLabels[timer.type], count: elapsedMinutes } })
	);

	let stopping = $state(false);

	async function handleStop() {
		if (stopping) return;
		stopping = true;
		try {
			await onstop();
		} finally {
			stopping = false;
		}
	}

	async function handleSideChange(value: string | string[]) {
		if (Array.isArray(value) || !onsidechange) return;
		await onsidechange(value);
	}

	onMount(() => {
		startTick();
		return () => stopTick();
	});
</script>

<section class="hero type-{timer.type}" data-type={timer.type}>
	<p class="type-label">
		{typeLabels[timer.type]}{#if babyName}<span class="baby"> &middot; {babyName}</span>{/if}
	</p>

	<div class="digits-wrap">
		<div class="pulse-ring" aria-hidden="true"></div>
		<div class="timer-digits" aria-hidden="true">{display}</div>
	</div>

	<div class="selector">
		<OptionGrid {options} value={selected} columns={3} onchange={handleSideChange} />
	</div>

	<div class="stop-wrapper">
		<Button
			variant="danger"
			size="lg"
			loading={stopping}
			ariaLabel={t('timer.stopTimerLabel', { values: { type: typeLabels[timer.type] } })}
			onclick={handleStop}
			class="stop-button"
		>
			{t('timer.stop')}
		</Button>
	</div>

	<span class="sr-only" aria-live="polite">{announcement}</span>
</section>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-5);
		padding: var(--space-6) var(--space-5);
		border-radius: var(--radius-3);
		min-height: 420px;
	}

	.type-feed {
		background: var(--feed-fill);
	}

	.type-sleep {
		background: var(--sleep-fill);
	}

	.type-pump {
		background: var(--pump-fill);
	}

	.type-label {
		margin: 0;
		text-transform: uppercase;
		font-size: var(--font-size-2);
		font-weight: var(--fw-bold);
		letter-spacing: 0.1em;
		text-align: center;
	}

	.type-feed .type-label {
		color: var(--feed-ink);
	}

	.type-sleep .type-label {
		color: var(--sleep-ink);
	}

	.type-pump .type-label {
		color: var(--pump-ink);
	}

	.baby {
		font-weight: var(--fw-semibold);
		opacity: 0.85;
	}

	.digits-wrap {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-5) var(--space-6);
	}

	.pulse-ring {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-3);
		animation: breathe 2.5s var(--ease-out) infinite;
	}

	.type-feed .pulse-ring {
		background: var(--feed-solid);
	}

	.type-sleep .pulse-ring {
		background: var(--sleep-solid);
	}

	.type-pump .pulse-ring {
		background: var(--pump-solid);
	}

	.timer-digits {
		position: relative;
		font-size: var(--timer-display);
		font-variant-numeric: tabular-nums;
		font-weight: var(--fw-black);
		line-height: 1;
		text-align: center;
	}

	.type-feed .timer-digits {
		color: var(--feed-ink);
	}

	.type-sleep .timer-digits {
		color: var(--sleep-ink);
	}

	.type-pump .timer-digits {
		color: var(--pump-ink);
	}

	.selector {
		width: 100%;
	}

	.stop-wrapper {
		width: 100%;
	}

	.stop-wrapper :global(.stop-button) {
		width: 100%;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes breathe {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.4;
		}
		50% {
			transform: scale(1.03);
			opacity: 0.7;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse-ring {
			animation: none;
			background: transparent !important;
			opacity: 1;
			border: 2px solid currentColor;
		}

		.type-feed .pulse-ring {
			color: var(--feed-solid);
		}

		.type-sleep .pulse-ring {
			color: var(--sleep-solid);
		}

		.type-pump .pulse-ring {
			color: var(--pump-solid);
		}
	}
</style>
