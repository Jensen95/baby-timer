<script lang="ts">
	interface Option { value: string; label: string; }
	interface Props { value: string; options: Option[]; onchange: (value: string) => void; disabled?: boolean; }
	let { value, options, onchange, disabled = false }: Props = $props();
</script>

<div class="side-toggle">
	{#each options as option (option.value)}
		<button
			class="side-btn"
			class:side-btn--active={value === option.value}
			onclick={() => onchange(option.value)}
			{disabled}
			type="button"
		>{option.label}</button>
	{/each}
</div>

<style>
	.side-toggle { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.side-btn {
		flex: 1; min-height: 44px; border-radius: 12px;
		font-size: 0.875rem; font-weight: 600; font-family: 'Nunito', sans-serif;
		border: 2px solid var(--color-border, #e8e0ed);
		background: var(--color-surface, #fff); color: var(--color-text-secondary, #888);
		cursor: pointer; transition: all 0.15s ease;
	}
	.side-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.side-btn--active { background: var(--color-primary, hsl(340, 65%, 70%)); color: white; border-color: var(--color-primary, hsl(340, 65%, 70%)); }
</style>
