<script lang="ts">
	import { formatDuration, formatDateTime } from '$lib/timer/format';
	interface Props { type: 'feeding' | 'sleep'; side: string; startedAt: Date; endedAt: Date | null; durationSeconds: number | null; note?: string | null; }
	let { type, side, startedAt, endedAt, durationSeconds, note }: Props = $props();
	const typeLabel = $derived(type === 'feeding' ? '🍼' : '😴');
	const isActive = $derived(endedAt === null);
</script>

<div class="session-entry" class:session-entry--feeding={type === 'feeding'} class:session-entry--sleep={type === 'sleep'}>
	<div class="session-icon">{typeLabel}</div>
	<div class="session-body">
		<div class="session-header">
			<span class="session-type">{type === 'feeding' ? 'Feeding' : 'Sleep'} · {side}</span>
			{#if isActive}<span class="session-live">Live</span>{/if}
		</div>
		<div class="session-time">{formatDateTime(startedAt)}</div>
		{#if note}<div class="session-note">{note}</div>{/if}
	</div>
	<div class="session-duration">
		{#if durationSeconds !== null}{formatDuration(durationSeconds)}{:else}<span class="session-in-progress">…</span>{/if}
	</div>
</div>

<style>
	.session-entry { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; background: var(--color-surface, #fff); border-radius: 12px; margin-bottom: 0.5rem; border-left: 4px solid transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
	.session-entry--feeding { border-left-color: hsl(340, 65%, 70%); }
	.session-entry--sleep { border-left-color: hsl(240, 60%, 70%); }
	.session-icon { font-size: 1.5rem; flex-shrink: 0; }
	.session-body { flex: 1; min-width: 0; }
	.session-header { display: flex; align-items: center; gap: 0.5rem; }
	.session-type { font-weight: 600; font-size: 0.925rem; color: var(--color-text-primary, #2d2d2d); }
	.session-live { font-size: 0.7rem; font-weight: 700; background: hsl(40, 90%, 65%); color: white; padding: 0.1rem 0.4rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; }
	.session-time { font-size: 0.775rem; color: var(--color-text-secondary, #888); margin-top: 0.15rem; }
	.session-note { font-size: 0.75rem; color: var(--color-text-secondary, #888); margin-top: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.session-duration { font-weight: 700; font-size: 0.925rem; font-family: 'Nunito', monospace; color: var(--color-text-primary, #2d2d2d); flex-shrink: 0; }
	.session-in-progress { color: var(--color-text-secondary, #888); }
</style>
