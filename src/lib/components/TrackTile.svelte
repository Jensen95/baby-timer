<script lang="ts">
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';
	import type { SessionType } from '$lib/types';
	import { t } from '@sveltia/i18n';

	interface Props {
		type: SessionType;
		label: string;
		icon: Component<IconProps>;
		lastSummary?: string;
		disabled?: boolean;
		disabledReason?: string;
		onstart: () => void;
	}

	let {
		type,
		label,
		icon: IconComponent,
		lastSummary,
		disabled = false,
		disabledReason,
		onstart
	}: Props = $props();
</script>

<button
	class="tile type-{type}"
	{disabled}
	title={disabled && disabledReason ? disabledReason : undefined}
	aria-label={disabled && disabledReason
		? `${label} — ${disabledReason}`
		: t('track.startLabel', { values: { label } })}
	onclick={onstart}
>
	<span class="icon" aria-hidden="true">
		<IconComponent size={32} />
	</span>
	<span class="label">{label}</span>
	{#if lastSummary}
		<span class="last">{lastSummary}</span>
	{:else}
		<span class="last empty">{t('common.tapToStart')}</span>
	{/if}
	{#if disabled && disabledReason}
		<span class="reason">{disabledReason}</span>
	{/if}
</button>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-5) var(--space-4);
		border-radius: var(--radius-3);
		border: none;
		cursor: pointer;
		text-align: center;
		width: 100%;
		min-height: 140px;
		transition:
			transform var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.tile:active:not(:disabled) {
		transform: scale(0.97);
	}

	.tile:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.type-feed {
		background: var(--feed-fill);
		color: var(--feed-ink);
	}

	.type-sleep {
		background: var(--sleep-fill);
		color: var(--sleep-ink);
	}

	.type-pump {
		background: var(--pump-fill);
		color: var(--pump-ink);
	}

	.type-diaper {
		background: var(--diaper-fill);
		color: var(--diaper-ink);
	}

	.type-feed:not(:disabled):hover {
		background: var(--feed-solid);
		color: var(--on-color);
	}

	.type-sleep:not(:disabled):hover {
		background: var(--sleep-solid);
		color: var(--on-color);
	}

	.type-pump:not(:disabled):hover {
		background: var(--pump-solid);
		color: var(--on-color);
	}

	.type-diaper:not(:disabled):hover {
		background: var(--diaper-solid);
		color: var(--on-color);
	}

	.label {
		font-size: var(--font-size-4);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.last {
		font-size: var(--font-size-2);
		opacity: 0.8;
	}

	.last.empty {
		opacity: 0.55;
		font-style: italic;
	}

	.reason {
		font-size: var(--font-size-1);
		opacity: 0.7;
		margin-top: var(--space-1);
	}

	.icon {
		display: flex;
	}
</style>
