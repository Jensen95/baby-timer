<script lang="ts">
	interface Option {
		value: string;
		label: string;
		icon?: import('svelte').Component;
		description?: string;
	}

	interface Props {
		options: Option[];
		value: string | string[] | null;
		multiple?: boolean;
		columns?: number;
		disabled?: boolean;
		onchange: (value: string | string[]) => void;
	}

	let { options, value, multiple = false, columns, disabled = false, onchange }: Props = $props();

	function isSelected(optValue: string): boolean {
		if (multiple && Array.isArray(value)) return value.includes(optValue);
		return value === optValue;
	}

	function handleSelect(optValue: string) {
		if (disabled) return;
		if (multiple && Array.isArray(value)) {
			const next = value.includes(optValue)
				? value.filter((v) => v !== optValue)
				: [...value, optValue];
			onchange(next);
		} else {
			onchange(optValue);
		}
	}

	let gridCols = $derived(columns ?? (options.length <= 4 ? 2 : 3));
</script>

<div class="option-grid" role={multiple ? 'group' : 'radiogroup'} style="--cols: {gridCols}">
	{#each options as option (option.value)}
		<button
			type="button"
			class="option"
			class:selected={isSelected(option.value)}
			{disabled}
			aria-pressed={multiple ? isSelected(option.value) : undefined}
			aria-checked={!multiple ? isSelected(option.value) : undefined}
			role={multiple ? 'button' : 'radio'}
			onclick={() => handleSelect(option.value)}
		>
			{#if option.icon}
				<span class="icon" aria-hidden="true">
					<option.icon size={24} />
				</span>
			{/if}
			<span class="label">{option.label}</span>
			{#if option.description}
				<span class="desc">{option.description}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.option-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: var(--space-2);
	}

	.option {
		min-height: var(--tap-comfortable);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-2);
		border: 1.5px solid var(--border);
		background: var(--surface);
		color: var(--text);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		cursor: pointer;
		transition:
			background var(--duration-fast),
			border-color var(--duration-fast);
		font-family: var(--font-body);
		font-size: var(--font-size-3);
	}

	.option:hover:not(.selected) {
		background: var(--surface-2);
	}

	.option:hover.selected {
		background: var(--brand-subtle);
	}

	.option.selected {
		background: var(--brand-subtle);
		border-color: var(--brand);
		color: var(--brand);
		font-weight: var(--fw-semibold);
	}

	.option:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.option:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.label {
		font-size: var(--font-size-3);
		font-weight: var(--fw-semibold);
	}

	.desc {
		font-size: var(--font-size-1);
		color: var(--text-2);
	}
</style>
