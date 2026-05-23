<script lang="ts">
	import { getContext } from 'svelte';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';

	const sync = getContext<SyncEngineStore>(SYNC_KEY);
</script>

{#if sync}
	{#if sync.syncing}
		<span class="sync-badge sync-badge--syncing">Syncing…</span>
	{:else if sync.error}
		<span class="sync-badge sync-badge--error">Sync error</span>
	{/if}
{/if}

<style>
	.sync-badge {
		display: inline-flex;
		align-items: center;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
	}

.sync-badge--syncing {
		background: hsl(210, 70%, 92%);
		color: hsl(210, 60%, 40%);
	}

.sync-badge--error {
		background: hsl(4, 80%, 92%);
		color: hsl(4, 60%, 40%);
	}
</style>
