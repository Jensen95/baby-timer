<script lang="ts">
	import Timer from './Timer.svelte';
	import SideToggle from './SideToggle.svelte';
	import type { PumpSide } from '$lib/sessions/breast-pump';

	const BREAST_OPTIONS = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'both', label: 'Both' }
	];

	interface Props {
		running: boolean;
		elapsed: number;
		side: PumpSide;
		yieldLeftMl: string;
		yieldRightMl: string;
		disabled?: boolean;
		onstart: (state: { side: PumpSide; yieldLeftMl: string; yieldRightMl: string }) => void;
		onstop: () => void;
		onsidechange: (side: PumpSide) => void;
		onyieldleftchange: (value: string) => void;
		onyieldrightchange: (value: string) => void;
	}

	let {
		running,
		elapsed,
		side,
		yieldLeftMl,
		yieldRightMl,
		disabled = false,
		onstart,
		onstop,
		onsidechange,
		onyieldleftchange,
		onyieldrightchange
	}: Props = $props();
</script>

<div class="timer-card">
	<div class="timer-card-header timer-card-header--pump">
		<span class="timer-card-icon">🥛</span>
		<h3 class="timer-card-title">Breast Pump</h3>
	</div>
	<div class="timer-card-body">
		<p class="side-label">Pumping side</p>
		<SideToggle
			value={side}
			options={BREAST_OPTIONS}
			onchange={(v) => onsidechange(v as PumpSide)}
			{disabled}
		/>
		<div class="field-grid">
			<div class="field">
				<label class="label" for="pump-yield-left">Left yield (ml)</label>
				<input
					id="pump-yield-left"
					class="input"
					type="number"
					min="0"
					step="1"
					placeholder="Optional"
					value={yieldLeftMl}
					oninput={(e) => onyieldleftchange((e.target as HTMLInputElement).value)}
					{disabled}
				/>
			</div>
			<div class="field">
				<label class="label" for="pump-yield-right">Right yield (ml)</label>
				<input
					id="pump-yield-right"
					class="input"
					type="number"
					min="0"
					step="1"
					placeholder="Optional"
					value={yieldRightMl}
					oninput={(e) => onyieldrightchange((e.target as HTMLInputElement).value)}
					{disabled}
				/>
			</div>
		</div>
		<Timer
			{running}
			{elapsed}
			{disabled}
			onstart={() => onstart({ side, yieldLeftMl, yieldRightMl })}
			{onstop}
		/>
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

	.timer-card-header--pump {
		background: linear-gradient(135deg, hsl(43, 95%, 92%), hsl(43, 95%, 86%));
	}

	.timer-card-icon {
		font-size: 1.4rem;
	}

	.timer-card-title {
		font-size: 1rem;
		font-weight: 700;
		color: hsl(34, 45%, 35%);
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

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.label {
		font-size: 0.75rem;
		margin-bottom: 0.35rem;
	}

	@media (max-width: 768px) {
		.field-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
