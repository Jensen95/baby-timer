<script lang="ts">
	import SessionCard from './SessionCard.svelte';

	interface Session {
		id: string;
		type: 'feeding' | 'sleep';
		side: string;
		startedAt: Date;
		endedAt: Date | null;
		durationSeconds: number | null;
		note?: string | null;
	}

	interface Props {
		sessions: Session[];
		loading?: boolean;
	}

	let { sessions, loading = false }: Props = $props();
</script>

{#if loading}
	<div class="has-text-centered py-6">
		<p class="has-text-grey">Loading...</p>
	</div>
{:else if sessions.length === 0}
	<div class="has-text-centered py-6">
		<p class="has-text-grey is-size-5">No sessions yet</p>
		<p class="has-text-grey-light">Start a feeding or sleep timer above</p>
	</div>
{:else}
	{#each sessions as session (session.id)}
		<SessionCard
			type={session.type}
			side={session.side}
			startedAt={session.startedAt}
			endedAt={session.endedAt}
			durationSeconds={session.durationSeconds}
			note={session.note}
		/>
	{/each}
{/if}
