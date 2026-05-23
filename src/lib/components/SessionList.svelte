<script lang="ts">
	import SessionCard from './SessionCard.svelte';

	interface Session {
		id: string;
		type: 'feeding' | 'sleep' | 'breast_pump' | 'diaper_change';
		side: string;
		startedAt: Date;
		endedAt: Date | null;
		durationSeconds: number | null;
		yieldLeftMl: number | null;
		yieldRightMl: number | null;
		note: string | null;
	}

	interface Props {
		sessions: Session[];
		loading?: boolean;
		onedit?: (session: Session) => void | Promise<void>;
		onremove?: (session: Session) => void | Promise<void>;
	}

	let { sessions, loading = false, onedit, onremove }: Props = $props();
</script>

{#if loading}
	<div class="has-text-centered py-6">
		<p class="has-text-grey">Loading...</p>
	</div>
{:else if sessions.length === 0}
	<div class="has-text-centered py-6">
		<p class="has-text-grey is-size-5">No sessions yet</p>
		<p class="has-text-grey-light">Start a feeding, sleep, breast pump, or diaper change above</p>
	</div>
{:else}
	{#each sessions as session (session.id)}
		<SessionCard
			type={session.type}
			side={session.side}
			startedAt={session.startedAt}
			endedAt={session.endedAt}
			durationSeconds={session.durationSeconds}
			yieldLeftMl={session.yieldLeftMl ?? null}
			yieldRightMl={session.yieldRightMl ?? null}
			note={session.note}
			onedit={onedit ? () => onedit(session) : undefined}
			onremove={onremove ? () => onremove(session) : undefined}
		/>
	{/each}
{/if}
