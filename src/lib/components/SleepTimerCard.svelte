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

	let { running, elapsed, side, disabled = false, onstart, onstop, onsidechange }: Props =
		$props();
</script>

<div class="box">
	<h3 class="title is-5 mb-3">Sleep</h3>
	<div class="mb-3">
		<p class="label mb-2">Head position</p>
		<SideToggle
			value={side}
			options={HEAD_OPTIONS}
			onchange={(v) => onsidechange(v as HeadSide)}
			{disabled}
		/>
	</div>
	<Timer {running} {elapsed} {disabled} onstart={() => onstart(side)} {onstop} />
</div>
