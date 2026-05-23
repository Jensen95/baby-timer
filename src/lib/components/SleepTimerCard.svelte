<script lang="ts">
	import Timer from './Timer.svelte';
	import SideToggle from './SideToggle.svelte';
	import type { HeadSide } from '$lib/sessions/sleep';

	const HEAD_OPTIONS = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'back', label: 'Back' },
		{ value: 'tummy', label: 'Tummy' }
	];

	interface Props {
		running: boolean;
		elapsed: number;
		side: HeadSide;
		disabled?: boolean;
		onstart: (side: HeadSide) => void;
		onstop: () => void;
		onsidechange: (side: HeadSide) => void;
	}

	let { running, elapsed, side, disabled = false, onstart, onstop, onsidechange }: Props = $props();
</script>

<div class="timer-card">
	<div class="timer-card-header timer-card-header--sleep">
		<span class="timer-card-icon">😴</span>
		<h3 class="timer-card-title">Sleep</h3>
	</div>
	<div class="timer-card-body">
		<p class="side-label">Head position</p>
		<SideToggle
			value={side}
			options={HEAD_OPTIONS}
			onchange={(v) => onsidechange(v as HeadSide)}
			{disabled}
		/>
		<Timer {running} {elapsed} {disabled} onstart={() => onstart(side)} {onstop} />
	</div>
</div>

<style>
	.timer-card {
		background: var(--color-surface, #fff);
		border-radius: 20px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.07);
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.timer-card-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 1.25rem;
	}

	.timer-card-header--sleep {
		background: linear-gradient(135deg, hsl(240, 60%, 93%), hsl(240, 60%, 88%));
	}

	.timer-card-icon {
		font-size: 1.4rem;
	}

	.timer-card-title {
		font-size: 1rem;
		font-weight: 700;
		color: hsl(240, 45%, 40%);
		margin: 0;
	}

	.timer-card-body {
		padding: 1rem 1.25rem 1.25rem;
	}

	.side-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-secondary, #888);
		margin-bottom: 0.5rem;
	}
</style>
