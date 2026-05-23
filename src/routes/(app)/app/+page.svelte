<script lang="ts">
	import { getContext } from 'svelte';
	import { base } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { supabase } from '$lib/supabase';
	import { createTimer } from '$lib/timer/timer.svelte';
	import { buildTimerResult } from '$lib/timer/timer-logic';
	import {
		listFeedingSessionsLocal,
		getActiveFeedingSessionLocal,
		createFeedingLocal,
		updateFeedingLocal,
		deleteFeedingLocal,
		type LocalFeeding
	} from '$lib/db/local-feeding';
	import {
		listSleepSessionsLocal,
		getActiveSleepSessionLocal,
		createSleepLocal,
		updateSleepLocal,
		deleteSleepLocal,
		type LocalSleep
	} from '$lib/db/local-sleep';
	import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';
	import FeedingTimerCard from '$lib/components/FeedingTimerCard.svelte';
	import SleepTimerCard from '$lib/components/SleepTimerCard.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);

	let babies = $state<LocalBaby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let familyId = $state<string | null>(null);
	let pageLoading = $state(true);
	let error = $state<string | null>(null);

	let activeFeedingSession = $state<LocalFeeding | null>(null);
	let activeSleepSession = $state<LocalSleep | null>(null);

	let recentSessions = $state<
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

	const feedingTimer = createTimer();
	const sleepTimer = createTimer();

	let feedingSide = $state<FeedingSide>('left');
	let sleepSide = $state<HeadSide>('back');

	let selectedBaby = $derived(babies.find((b) => b.id === selectedBabyId) ?? null);

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
				error = e instanceof Error ? e.message : 'Failed to load data';
			} finally {
				pageLoading = false;
			}
		})();
	});

	$effect(() => {
		if (!selectedBabyId) return;
		loadSessionsForBaby(selectedBabyId);
	});

	async function loadSessionsForBaby(babyId: string) {
		const [activeFeeding, activeSleep, feedingSessions, sleepSessions] = await Promise.all([
			getActiveFeedingSessionLocal(babyId),
			getActiveSleepSessionLocal(babyId),
			listFeedingSessionsLocal(babyId, 20),
			listSleepSessionsLocal(babyId, 20)
		]);

		activeFeedingSession = activeFeeding;
		activeSleepSession = activeSleep;

		if (activeFeeding && !feedingTimer.running) {
			feedingTimer.resume(new Date(activeFeeding.started_at));
			feedingSide = activeFeeding.side;
		}

		if (activeSleep && !sleepTimer.running) {
			sleepTimer.resume(new Date(activeSleep.started_at));
			sleepSide = activeSleep.side;
		}

		const combined = [
			...feedingSessions.map((s) => ({
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
			...sleepSessions.map((s) => ({
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

		recentSessions = combined.slice(0, 20);
	}

	async function handleStartFeeding(side: FeedingSide) {
		if (!selectedBabyId) return;
		feedingSide = side;
		feedingTimer.start();
		try {
			const id = crypto.randomUUID();
			const now = feedingTimer.startedAt!.toISOString();
			const payload: LocalFeeding = {
				id,
				baby_id: selectedBabyId,
				family_id: familyId,
				side,
				started_at: now,
				ended_at: null,
				note: null,
				created_at: now,
				_sync: 'pending'
			};
			await createFeedingLocal(payload);
			activeFeedingSession = payload;
			await loadSessionsForBaby(selectedBabyId!);
			sync.syncNow();
		} catch (e) {
			feedingTimer.reset();
			error = e instanceof Error ? e.message : 'Failed to start feeding';
		}
	}

	async function handleFeedingSideChange(side: FeedingSide) {
		feedingSide = side;
		if (!activeFeedingSession || !selectedBabyId || activeFeedingSession.side === side) return;
		try {
			await updateFeedingLocal(activeFeedingSession.id, { side, _sync: 'pending' });
			activeFeedingSession = { ...activeFeedingSession, side, _sync: 'pending' };
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update feeding side';
		}
	}

	async function handleStopFeeding() {
		if (!activeFeedingSession) return;
		const result = feedingTimer.stop();
		if (!result) return;
		try {
			const endedAt = result.endedAt.toISOString();
			await updateFeedingLocal(activeFeedingSession.id, { ended_at: endedAt, _sync: 'pending' });
			activeFeedingSession = null;
			await loadSessionsForBaby(selectedBabyId!);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop feeding';
		}
	}

	async function handleStartSleep(side: HeadSide) {
		if (!selectedBabyId) return;
		sleepSide = side;
		sleepTimer.start();
		try {
			const id = crypto.randomUUID();
			const now = sleepTimer.startedAt!.toISOString();
			const payload: LocalSleep = {
				id,
				baby_id: selectedBabyId,
				family_id: familyId,
				side,
				started_at: now,
				ended_at: null,
				note: null,
				created_at: now,
				_sync: 'pending'
			};
			await createSleepLocal(payload);
			activeSleepSession = payload;
			await loadSessionsForBaby(selectedBabyId!);
			sync.syncNow();
		} catch (e) {
			sleepTimer.reset();
			error = e instanceof Error ? e.message : 'Failed to start sleep';
		}
	}

	async function handleSleepSideChange(side: HeadSide) {
		sleepSide = side;
		if (!activeSleepSession || !selectedBabyId || activeSleepSession.side === side) return;
		try {
			await updateSleepLocal(activeSleepSession.id, { side, _sync: 'pending' });
			activeSleepSession = { ...activeSleepSession, side, _sync: 'pending' };
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update sleep side';
		}
	}

	async function handleStopSleep() {
		if (!activeSleepSession) return;
		const result = sleepTimer.stop();
		if (!result) return;
		try {
			const endedAt = result.endedAt.toISOString();
			await updateSleepLocal(activeSleepSession.id, { ended_at: endedAt, _sync: 'pending' });
			activeSleepSession = null;
			await loadSessionsForBaby(selectedBabyId!);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop sleep';
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

	async function handleEditSession(sessionItem: (typeof recentSessions)[number]) {
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
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to edit session';
		}
	}

	async function handleRemoveSession(sessionItem: (typeof recentSessions)[number]) {
		if (!window.confirm('Delete this session?')) return;
		if (!selectedBabyId) return;
		try {
			if (sessionItem.type === 'feeding') {
				await deleteFeedingLocal(sessionItem.id);
				if (activeFeedingSession?.id === sessionItem.id) {
					activeFeedingSession = null;
					feedingTimer.reset();
				}
			} else {
				await deleteSleepLocal(sessionItem.id);
				if (activeSleepSession?.id === sessionItem.id) {
					activeSleepSession = null;
					sleepTimer.reset();
				}
			}
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove session';
		}
	}
</script>

<section class="section">
	<div class="container">
		{#if pageLoading}
			<progress class="progress is-primary" max="100">Loading</progress>
		{:else if error}
			<div class="notification is-danger">
				<button class="delete" aria-label="Dismiss error" onclick={() => (error = null)}></button>
				{error}
			</div>
		{:else if babies.length === 0}
			<div class="has-text-centered py-6">
				<h2 class="title is-4">Welcome to Baby Timer!</h2>
				<p class="subtitle">Add a baby to get started.</p>
				<a href="{base}/app/babies" class="button is-primary">Add Baby</a>
			</div>
		{:else}
			{#if babies.length > 1}
				<div class="field mb-4">
					<label class="label" for="baby-select">Baby</label>
					<div class="control">
						<div class="select">
							<select
								id="baby-select"
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
			{:else if selectedBaby}
				<h2 class="title is-4 mb-4">{selectedBaby.name}</h2>
			{/if}

			<div class="columns">
				<div class="column">
					<FeedingTimerCard
						running={feedingTimer.running}
						elapsed={feedingTimer.elapsed}
						side={feedingSide}
						disabled={sleepTimer.running}
						onstart={handleStartFeeding}
						onstop={handleStopFeeding}
						onsidechange={handleFeedingSideChange}
					/>
				</div>
				<div class="column">
					<SleepTimerCard
						running={sleepTimer.running}
						elapsed={sleepTimer.elapsed}
						side={sleepSide}
						disabled={feedingTimer.running}
						onstart={handleStartSleep}
						onstop={handleStopSleep}
						onsidechange={handleSleepSideChange}
					/>
				</div>
			</div>

			<div class="mt-5">
				<h3 class="title is-5">Recent Sessions</h3>
				<SessionList
					sessions={recentSessions}
					onedit={handleEditSession}
					onremove={handleRemoveSession}
				/>
			</div>
		{/if}
	</div>
</section>
