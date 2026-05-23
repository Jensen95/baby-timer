<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { listFeedingSessionsLocal } from '$lib/db/local-feeding';
	import { listSleepSessionsLocal } from '$lib/db/local-sleep';
	import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';
	import { buildTimerResult } from '$lib/timer/timer-logic';
	import SessionList from '$lib/components/SessionList.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);

	let babies = $state<LocalBaby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let familyId = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sessions = $state<
		Array<{
			id: string;
			type: 'feeding' | 'sleep';
			side: string;
			startedAt: Date;
			endedAt: Date | null;
			durationSeconds: number | null;
			note: string | null;
		}>
	>([]);

	$effect(() => {
		(async () => {
			try {
				if (session.user) {
					let localFamily = await getLocalFamily();
					if (!localFamily) {
						const families = await getUserFamilies(supabase);
						if (families.length > 0) {
							await putLocalFamily({
								id: families[0].id,
								name: families[0].name,
								created_at: families[0].created_at
							});
							localFamily = {
								id: families[0].id,
								name: families[0].name,
								created_at: families[0].created_at
							};
						}
					}
					familyId = localFamily?.id ?? null;
				} else {
					familyId = null;
				}

				babies = await listBabiesLocal(familyId);
				if (babies.length > 0) {
					selectedBabyId = babies[0].id;
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
				listFeedingSessionsLocal(babyId, 100),
				listSleepSessionsLocal(babyId, 100)
			]);

			sessions = [
				...feedings.map((s) => ({
					id: s.id,
					type: 'feeding' as const,
					side: s.side,
					startedAt: new Date(s.started_at),
					endedAt: s.ended_at ? new Date(s.ended_at) : null,
					durationSeconds: s.ended_at
						? buildTimerResult(new Date(s.started_at), new Date(s.ended_at)).durationSeconds
						: null,
					note: s.note
				})),
				...sleeps.map((s) => ({
					id: s.id,
					type: 'sleep' as const,
					side: s.side,
					startedAt: new Date(s.started_at),
					endedAt: s.ended_at ? new Date(s.ended_at) : null,
					durationSeconds: s.ended_at
						? buildTimerResult(new Date(s.started_at), new Date(s.ended_at)).durationSeconds
						: null,
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
