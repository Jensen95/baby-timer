<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		value: string;
		options: Option[];
		onchange: (value: string) => void;
		disabled?: boolean;
	}

	let { value, options, onchange, disabled = false }: Props = $props();
</script>

<div class="buttons has-addons is-centered">
	{#each options as option (option.value)}
		<button
			class="button {value === option.value ? 'is-primary is-selected' : ''}"
			onclick={() => onchange(option.value)}
			{disabled}
			type="button"
		>
			{option.label}
		</button>
	{/each}
</div>
