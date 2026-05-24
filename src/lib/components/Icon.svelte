<script lang="ts">
	import { type Component } from 'svelte';
	import type { IconProps } from 'lucide-svelte';

	interface Props {
		icon: Component<IconProps>;
		size?: number;
		strokeWidth?: number;
		label?: string;
		class?: string;
	}

	let {
		icon: IconComponent,
		size = 20,
		strokeWidth = 2,
		label,
		class: className
	}: Props = $props();
</script>

{#if label}
	<span role="img" aria-label={label} class={className}>
		<IconComponent {size} {strokeWidth} />
	</span>
{:else}
	<span aria-hidden="true" class={className}>
		<IconComponent {size} {strokeWidth} />
	</span>
{/if}

<style>
	span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: currentColor;
		flex-shrink: 0;
	}
</style>
