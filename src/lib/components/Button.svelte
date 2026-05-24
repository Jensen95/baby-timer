<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		leadingIcon?: Snippet;
		trailingIcon?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		href,
		class: className,
		onclick,
		children,
		leadingIcon,
		trailingIcon
	}: Props = $props();

	const interactive = $derived(!disabled && !loading);
</script>

{#if href}
	<a
		{href}
		class="btn btn--{variant} btn--{size} {className ?? ''}"
		class:btn--loading={loading}
		class:btn--disabled={disabled}
		aria-disabled={disabled || undefined}
		aria-busy={loading || undefined}
		onclick={interactive ? onclick : undefined}
	>
		{#if loading}
			<span class="spinner" aria-hidden="true"></span>
		{:else if leadingIcon}
			{@render leadingIcon()}
		{/if}
		<span class="btn__label" class:btn__label--dimmed={loading}>
			{@render children()}
		</span>
		{#if trailingIcon && !loading}
			{@render trailingIcon()}
		{/if}
	</a>
{:else}
	<button
		{type}
		{disabled}
		class="btn btn--{variant} btn--{size} {className ?? ''}"
		class:btn--loading={loading}
		aria-disabled={disabled || undefined}
		aria-busy={loading || undefined}
		{onclick}
	>
		{#if loading}
			<span class="spinner" aria-hidden="true"></span>
		{:else if leadingIcon}
			{@render leadingIcon()}
		{/if}
		<span class="btn__label" class:btn__label--dimmed={loading}>
			{@render children()}
		</span>
		{#if trailingIcon && !loading}
			{@render trailingIcon()}
		{/if}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border: none;
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-3);
		cursor: pointer;
		text-decoration: none;
		transition:
			background var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	/* Sizes */
	.btn--sm {
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-4);
	}

	.btn--md {
		min-height: var(--tap-comfortable);
		padding: var(--space-3) var(--space-5);
	}

	.btn--lg {
		min-height: var(--tap-hero);
		padding: var(--space-3) var(--space-6);
		font-size: var(--font-size-4);
	}

	/* Variants */
	.btn--primary {
		background: var(--brand);
		color: var(--on-brand);
	}

	.btn--primary:hover:not(:disabled):not(.btn--disabled):not(.btn--loading) {
		background: var(--brand-press);
	}

	.btn--primary:active:not(:disabled):not(.btn--disabled):not(.btn--loading) {
		transform: scale(0.97);
	}

	.btn--danger {
		background: var(--danger);
		color: var(--on-color);
	}

	.btn--danger:hover:not(:disabled):not(.btn--disabled):not(.btn--loading) {
		filter: brightness(0.88);
	}

	.btn--danger:active:not(:disabled):not(.btn--loading) {
		transform: scale(0.97);
	}

	.btn--ghost {
		background: transparent;
		color: var(--brand);
		border: 1.5px solid var(--brand);
	}

	.btn--ghost:hover:not(:disabled):not(.btn--disabled):not(.btn--loading) {
		background: var(--brand-subtle);
	}

	.btn--ghost:active:not(:disabled):not(.btn--disabled):not(.btn--loading) {
		transform: scale(0.97);
	}

	/* Disabled */
	.btn:disabled,
	.btn--disabled {
		opacity: 0.48;
		cursor: not-allowed;
		pointer-events: none;
	}

	/* Loading */
	.btn--loading {
		cursor: wait;
		pointer-events: none;
	}

	.btn__label--dimmed {
		opacity: 0.6;
	}

	/* Spinner */
	.spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
