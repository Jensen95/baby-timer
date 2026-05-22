<script lang="ts">
	import { formatDuration } from '$lib/timer/format';

	interface Props {
		running: boolean;
		elapsed: number;
		disabled?: boolean;
		onstart: () => void;
		onstop: () => void;
	}

	let { running, elapsed, disabled = false, onstart, onstop }: Props = $props();
</script>

<div class="timer-display">
	<div class="timer-time has-text-centered">
		<span class="is-size-1 has-text-weight-bold is-family-monospace">
			{formatDuration(elapsed)}
		</span>
	</div>
	<div class="timer-controls has-text-centered mt-3">
		{#if running}
			<button class="button is-danger is-large" onclick={onstop} {disabled}>
				Stop
			</button>
		{:else}
			<button class="button is-success is-large" onclick={onstart} {disabled}>
				Start
			</button>
		{/if}
	</div>
</div>

<style>
	.timer-display {
		padding: 1.5rem;
	}
</style>
