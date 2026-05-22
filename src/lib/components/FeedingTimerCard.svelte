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

<div class="box">
	<h3 class="title is-5 mb-3">Feeding</h3>
	<div class="mb-3">
		<p class="label mb-2">Breast side</p>
		<SideToggle
			value={side}
			options={BREAST_OPTIONS}
			onchange={(v) => onsidechange(v as FeedingSide)}
			{disabled}
		/>
	</div>
	<Timer {running} {elapsed} {disabled} onstart={() => onstart(side)} {onstop} />
</div>
