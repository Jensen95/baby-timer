<script lang="ts">
	import { formatDuration, formatDateTime } from '$lib/timer/format';
	interface Props {
		type: 'feeding' | 'sleep' | 'breast_pump' | 'diaper_change';
		side: string;
		startedAt: Date;
		endedAt: Date | null;
		durationSeconds: number | null;
		yieldLeftMl?: number | null;
		yieldRightMl?: number | null;
		note?: string | null;
		onedit?: () => void | Promise<void>;
		onremove?: () => void | Promise<void>;
	}
	let {
		type,
		side,
		startedAt,
		endedAt,
		durationSeconds,
		yieldLeftMl = null,
		yieldRightMl = null,
		note,
		onedit,
		onremove
	}: Props = $props();
	const TYPE_LABELS: Record<Props['type'], string> = {
		feeding: '🍼',
		sleep: '😴',
		breast_pump: '🥛',
		diaper_change: '🧷'
	};
	const TYPE_NAMES: Record<Props['type'], string> = {
		feeding: 'Feeding',
		sleep: 'Sleep',
		breast_pump: 'Breast Pump',
		diaper_change: 'Diaper Change'
	};
	const typeLabel = $derived(TYPE_LABELS[type]);
	const typeName = $derived(TYPE_NAMES[type]);
	const isActive = $derived(endedAt === null);
	const yieldText = $derived.by(() => {
		if (type !== 'breast_pump') return null;
		const parts = [];
		if (yieldLeftMl !== null) parts.push(`L: ${yieldLeftMl} ml`);
		if (yieldRightMl !== null) parts.push(`R: ${yieldRightMl} ml`);
		return parts.length > 0 ? parts.join(' · ') : null;
	});
</script>

<div
	class="session-entry"
	class:session-entry--feeding={type === 'feeding'}
	class:session-entry--sleep={type === 'sleep'}
	class:session-entry--pump={type === 'breast_pump'}
	class:session-entry--diaper={type === 'diaper_change'}
>
	<div class="session-icon">{typeLabel}</div>
	<div class="session-body">
		<div class="session-header">
			<span class="session-type">{typeName} · {side}</span>
			{#if isActive}<span class="session-live">Live</span>{/if}
		</div>
		<div class="session-time">{formatDateTime(startedAt)}</div>
		{#if yieldText}<div class="session-note">{yieldText}</div>{/if}
		{#if note}<div class="session-note">{note}</div>{/if}
	</div>
	<div class="session-duration">
		{#if durationSeconds !== null}{formatDuration(durationSeconds)}{:else}<span
				class="session-in-progress">…</span
			>{/if}
	</div>
	{#if onedit || onremove}
		<div class="session-actions">
			{#if onedit}
				<button class="button is-small is-light" type="button" onclick={onedit}>Edit</button>
			{/if}
			{#if onremove}
				<button class="button is-small is-danger is-light" type="button" onclick={onremove}
					>Delete</button
				>
			{/if}
		</div>
	{/if}
</div>

<style>
	.session-entry {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		background: var(--color-surface, #fff);
		border-radius: 12px;
		margin-bottom: 0.5rem;
		border-left: 4px solid transparent;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}
	.session-entry--feeding {
		border-left-color: hsl(340, 65%, 70%);
	}
	.session-entry--sleep {
		border-left-color: hsl(240, 60%, 70%);
	}
	.session-entry--pump {
		border-left-color: hsl(43, 80%, 70%);
	}
	.session-entry--diaper {
		border-left-color: hsl(176, 60%, 55%);
	}
	.session-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}
	.session-body {
		flex: 1;
		min-width: 0;
	}
	.session-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.session-type {
		font-weight: 600;
		font-size: 0.925rem;
		color: var(--color-text-primary, #2d2d2d);
	}
	.session-live {
		font-size: 0.7rem;
		font-weight: 700;
		background: hsl(40, 90%, 65%);
		color: white;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.session-time {
		font-size: 0.775rem;
		color: var(--color-text-secondary, #888);
		margin-top: 0.15rem;
	}
	.session-note {
		font-size: 0.75rem;
		color: var(--color-text-secondary, #888);
		margin-top: 0.15rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.session-duration {
		font-weight: 700;
		font-size: 0.925rem;
		font-family: 'Nunito', monospace;
		color: var(--color-text-primary, #2d2d2d);
		flex-shrink: 0;
	}
	.session-actions {
		display: flex;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.session-in-progress {
		color: var(--color-text-secondary, #888);
	}
</style>
