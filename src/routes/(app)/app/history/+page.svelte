<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { supabase } from '$lib/supabase';
	import {
		listFeedingSessionsLocal,
		updateFeedingLocal,
		deleteFeedingLocal
	} from '$lib/db/local-feeding';
	import { listSleepSessionsLocal, updateSleepLocal, deleteSleepLocal } from '$lib/db/local-sleep';
	import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';
	import { buildTimerResult } from '$lib/timer/timer-logic';
	import SessionList from '$lib/components/SessionList.svelte';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);

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

	const FEEDING_SIDES: FeedingSide[] = ['left', 'right', 'both'];
	const SLEEP_SIDES: HeadSide[] = ['left', 'right', 'back', 'tummy'];

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

	function formatDateTimeInput(date: Date): string {
		const pad = (value: number) => String(value).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function parseDateTimeInput(value: string): Date | null {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	async function handleEditSession(sessionItem: (typeof sessions)[number]) {
		const allowedSides: string[] = sessionItem.type === 'feeding' ? FEEDING_SIDES : SLEEP_SIDES;
		const nextSideInput = window.prompt(`Side (${allowedSides.join('/')})`, sessionItem.side);
		if (nextSideInput === null) return;
		const nextSide = nextSideInput.trim().toLowerCase();
		if (!allowedSides.includes(nextSide)) {
			error = 'Invalid side selection';
			return;
		}

		const startedInput = window.prompt(
			'Start time (YYYY-MM-DDTHH:mm)',
			formatDateTimeInput(sessionItem.startedAt)
		);
		if (startedInput === null) return;
		const startedAt = parseDateTimeInput(startedInput.trim());
		if (!startedAt) {
			error = 'Invalid start time';
			return;
		}

		const endedInput = window.prompt(
			'End time (YYYY-MM-DDTHH:mm, leave blank for active)',
			sessionItem.endedAt ? formatDateTimeInput(sessionItem.endedAt) : ''
		);
		if (endedInput === null) return;
		const endedAt = endedInput.trim() ? parseDateTimeInput(endedInput.trim()) : null;
		if (endedInput.trim() && !endedAt) {
			error = 'Invalid end time';
			return;
		}
		if (endedAt && endedAt < startedAt) {
			error = 'End time cannot be before start time';
			return;
		}

		if (!selectedBabyId) return;
		try {
			if (sessionItem.type === 'feeding') {
				await updateFeedingLocal(sessionItem.id, {
					side: nextSide as FeedingSide,
					started_at: startedAt.toISOString(),
					ended_at: endedAt ? endedAt.toISOString() : null,
					_sync: 'pending'
				});
			} else {
				await updateSleepLocal(sessionItem.id, {
					side: nextSide as HeadSide,
					started_at: startedAt.toISOString(),
					ended_at: endedAt ? endedAt.toISOString() : null,
					_sync: 'pending'
				});
			}
			await loadHistory(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to edit session';
		}
	}

	async function handleRemoveSession(sessionItem: (typeof sessions)[number]) {
		if (!window.confirm('Delete this session?')) return;
		if (!selectedBabyId) return;
		try {
			if (sessionItem.type === 'feeding') {
				await deleteFeedingLocal(sessionItem.id);
			} else {
				await deleteSleepLocal(sessionItem.id);
			}
			await loadHistory(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove session';
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

		<SessionList {sessions} {loading} onedit={handleEditSession} onremove={handleRemoveSession} />
	</div>
</section>
