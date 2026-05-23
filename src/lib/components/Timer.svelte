<script lang="ts">
	import { formatTimerDisplay } from '$lib/timer/format';

	interface Props {
		running: boolean;
		elapsed: number;
		disabled?: boolean;
		onstart: () => void;
		onstop: () => void;
	}

	let { running, elapsed, disabled = false, onstart, onstop }: Props = $props();
</script>

<div class="timer-wrap" class:timer-wrap--running={running}>
	{#if running}
		<div class="timer-pulse" aria-hidden="true"></div>
	{/if}
	<div class="timer-digits">{formatTimerDisplay(elapsed)}</div>
	<button
		class="timer-btn"
		class:timer-btn--stop={running}
		class:timer-btn--start={!running}
		onclick={running ? onstop : onstart}
		{disabled}
		type="button"
	>
		{running ? 'Stop' : 'Start'}
	</button>
</div>

<style>
	.timer-wrap {
		position: relative;
		padding: 2rem 1.5rem;
		text-align: center;
	}

	.timer-digits {
		font-family: 'Nunito', monospace;
		font-size: clamp(2.8rem, 11vw, 4.5rem);
		font-weight: 800;
		letter-spacing: 0.03em;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-primary, #2d2d2d);
		line-height: 1;
		margin-bottom: 1.5rem;
	}

	.timer-btn {
		min-height: 56px;
		min-width: 160px;
		border-radius: 999px;
		font-size: 1.1rem;
		font-weight: 700;
		font-family: 'Nunito', sans-serif;
		border: none;
		cursor: pointer;
		transition:
			transform 0.1s ease,
			box-shadow 0.2s ease;
		color: white;
	}

	.timer-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.timer-btn:not(:disabled):active {
		transform: scale(0.97);
	}
	.timer-btn--start {
		background: hsl(152, 55%, 48%);
		box-shadow: 0 4px 16px hsla(152, 55%, 48%, 0.35);
	}
	.timer-btn--stop {
		background: hsl(4, 75%, 60%);
		box-shadow: 0 4px 16px hsla(4, 75%, 60%, 0.35);
	}

	@keyframes pulse-ring {
		0% {
			transform: scale(0.97);
			opacity: 0.5;
		}
		70% {
			transform: scale(1.03);
			opacity: 0;
		}
		100% {
			transform: scale(1.03);
			opacity: 0;
		}
	}

	.timer-pulse {
		position: absolute;
		inset: 0;
		border-radius: 16px;
		border: 2px solid var(--color-primary, hsl(340, 65%, 70%));
		animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
		pointer-events: none;
	}
</style>
