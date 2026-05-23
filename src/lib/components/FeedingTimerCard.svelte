<script lang="ts">
	import Timer from './Timer.svelte';
	import SideToggle from './SideToggle.svelte';
	import type { FeedingSide } from '$lib/sessions/feeding';

	const BREAST_OPTIONS = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'both', label: 'Both' }
	];

	interface Props {
		running: boolean;
		elapsed: number;
		side: FeedingSide;
		disabled?: boolean;
		onstart: (side: FeedingSide) => void;
		onstop: () => void;
		onsidechange: (side: FeedingSide) => void;
	}

	let { running, elapsed, side, disabled = false, onstart, onstop, onsidechange }: Props = $props();
</script>

<div class="timer-card">
	<div class="timer-card-header timer-card-header--feeding">
		<span class="timer-card-icon">🍼</span>
		<h3 class="timer-card-title">Feeding</h3>
	</div>
	<div class="timer-card-body">
		<p class="side-label">Breast side</p>
		<SideToggle
			value={side}
			options={BREAST_OPTIONS}
			onchange={(v) => onsidechange(v as FeedingSide)}
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

	.timer-card-header--feeding {
		background: linear-gradient(135deg, hsl(340, 65%, 93%), hsl(340, 65%, 88%));
	}

	.timer-card-icon {
		font-size: 1.4rem;
	}

	.timer-card-title {
		font-size: 1rem;
		font-weight: 700;
		color: hsl(340, 45%, 40%);
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
