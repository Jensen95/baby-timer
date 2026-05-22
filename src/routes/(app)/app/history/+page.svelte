<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { listFeedingSessions } from '$lib/db/feeding';
	import { listSleepSessions } from '$lib/db/sleep';
	import { listBabies } from '$lib/db/babies';
	import { getUserFamilies } from '$lib/db/family';
	import SessionList from '$lib/components/SessionList.svelte';
	import type { Tables } from '$lib/db/database.types';

	type Baby = Tables<'babies'>;

	const session = getContext<SessionStore>(SESSION_KEY);

	let babies = $state<Baby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sessions = $state<Array<{
		id: string;
		type: 'feeding' | 'sleep';
		side: string;
		startedAt: Date;
		endedAt: Date | null;
		durationSeconds: number | null;
		note: string | null;
	}>>([]);

	$effect(() => {
		const userId = session.user?.id;
		if (!userId) return;

		(async () => {
			try {
				const families = await getUserFamilies(supabase);
				if (families.length === 0) {
					loading = false;
					return;
				}

				const familyBabies = await listBabies(supabase, families[0].id);
				babies = familyBabies;
				if (familyBabies.length > 0) {
					selectedBabyId = familyBabies[0].id;
				}
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load';
			} finally {
				loading = false;
			}
		})();
	});

	$effect(() => {
		if (!selectedBabyId) return;
		loadHistory(selectedBabyId);
	});

	async function loadHistory(babyId: string) {
		loading = true;
		try {
			const [feedings, sleeps] = await Promise.all([
				listFeedingSessions(supabase, babyId, 100),
				listSleepSessions(supabase, babyId, 100)
			]);

			sessions = [
				...feedings.map((s) => ({
					id: s.id,
					type: 'feeding' as const,
					side: s.side,
					startedAt: new Date(s.started_at),
					endedAt: s.ended_at ? new Date(s.ended_at) : null,
					durationSeconds: s.duration_seconds,
					note: s.note
				})),
				...sleeps.map((s) => ({
					id: s.id,
					type: 'sleep' as const,
					side: s.side,
					startedAt: new Date(s.started_at),
					endedAt: s.ended_at ? new Date(s.ended_at) : null,
					durationSeconds: s.duration_seconds,
					note: s.note
				}))
			].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load history';
		} finally {
			loading = false;
		}
	}
</script>

<section class="section">
	<div class="container">
		<h1 class="title">History</h1>

		{#if error}
			<div class="notification is-danger is-light">{error}</div>
		{/if}

		{#if babies.length > 1}
			<div class="field mb-4">
				<div class="control">
					<div class="select">
						<select
							value={selectedBabyId}
							onchange={(e) => (selectedBabyId = (e.target as HTMLSelectElement).value)}
						>
							{#each babies as baby (baby.id)}
								<option value={baby.id}>{baby.name}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
		{/if}

		<SessionList {sessions} {loading} />
	</div>
</section>
