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
	import {
		listBreastPumpSessionsLocal,
		getActiveBreastPumpSessionLocal,
		createBreastPumpLocal,
		updateBreastPumpLocal,
		deleteBreastPumpLocal,
		type LocalBreastPump
	} from '$lib/db/local-breast-pump';
	import {
		listDiaperChangeSessionsLocal,
		createDiaperChangeLocal,
		updateDiaperChangeLocal,
		deleteDiaperChangeLocal,
		type LocalDiaperChange
	} from '$lib/db/local-diaper-change';
	import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';
	import FeedingTimerCard from '$lib/components/FeedingTimerCard.svelte';
	import SleepTimerCard from '$lib/components/SleepTimerCard.svelte';
	import BreastPumpTimerCard from '$lib/components/BreastPumpTimerCard.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { PumpSide } from '$lib/sessions/breast-pump';
	import { buildDiaperChangePayload } from '$lib/sessions/diaper-change';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);

	let babies = $state<LocalBaby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let familyId = $state<string | null>(null);
	let pageLoading = $state(true);
	let error = $state<string | null>(null);

	let activeFeedingSession = $state<LocalFeeding | null>(null);
	let activeSleepSession = $state<LocalSleep | null>(null);
	let activeBreastPumpSession = $state<LocalBreastPump | null>(null);

	let recentSessions = $state<
		Array<{
			id: string;
			type: 'feeding' | 'sleep' | 'breast_pump' | 'diaper_change';
			side: string;
			startedAt: Date;
			endedAt: Date | null;
			durationSeconds: number | null;
			yieldLeftMl: number | null;
			yieldRightMl: number | null;
			note: string | null;
		}>
	>([]);
	let editingSession = $state<(typeof recentSessions)[number] | null>(null);
	let pendingDeleteSession = $state<(typeof recentSessions)[number] | null>(null);
	let editSide = $state('');
	let editStartedAt = $state('');
	let editEndedAt = $state('');
	let editYieldLeftMl = $state('');
	let editYieldRightMl = $state('');

	const feedingTimer = createTimer();
	const sleepTimer = createTimer();
	const breastPumpTimer = createTimer();

	let feedingSide = $state<FeedingSide>('left');
	let sleepSide = $state<HeadSide>('back');
	let breastPumpSide = $state<PumpSide>('both');
	let breastPumpYieldLeftMl = $state('');
	let breastPumpYieldRightMl = $state('');
	let diaperHasPoop = $state(false);
	let diaperHasPee = $state(false);

	let selectedBaby = $derived(babies.find((b) => b.id === selectedBabyId) ?? null);

	const FEEDING_SIDES: FeedingSide[] = ['left', 'right', 'both'];
	const SLEEP_SIDES: HeadSide[] = ['left', 'right', 'back', 'tummy', 'side'];
	const PUMP_SIDES: PumpSide[] = ['left', 'right', 'both'];
	const DIAPER_CONTENTS = ['poop', 'pee', 'both'] as const;

	function formatDiaperContent(
		hasPoop: boolean,
		hasPee: boolean
	): (typeof DIAPER_CONTENTS)[number] {
		if (hasPoop && hasPee) return 'both';
		return hasPoop ? 'poop' : 'pee';
	}

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
		const [
			activeFeeding,
			activeSleep,
			activePump,
			feedingSessions,
			sleepSessions,
			pumpSessions,
			diaperSessions
		] = await Promise.all([
			getActiveFeedingSessionLocal(babyId),
			getActiveSleepSessionLocal(babyId),
			getActiveBreastPumpSessionLocal(babyId),
			listFeedingSessionsLocal(babyId, 20),
			listSleepSessionsLocal(babyId, 20),
			listBreastPumpSessionsLocal(babyId, 20),
			listDiaperChangeSessionsLocal(babyId, 20)
		]);

		activeFeedingSession = activeFeeding;
		activeSleepSession = activeSleep;
		activeBreastPumpSession = activePump;

		if (activeFeeding && !feedingTimer.running) {
			feedingTimer.resume(new Date(activeFeeding.started_at));
			feedingSide = activeFeeding.side;
		}

		if (activeSleep && !sleepTimer.running) {
			sleepTimer.resume(new Date(activeSleep.started_at));
			sleepSide = activeSleep.side;
		}

		if (activePump && !breastPumpTimer.running) {
			breastPumpTimer.resume(new Date(activePump.started_at));
			breastPumpSide = activePump.side;
			breastPumpYieldLeftMl =
				activePump.yield_left_ml !== null ? String(activePump.yield_left_ml) : '';
			breastPumpYieldRightMl =
				activePump.yield_right_ml !== null ? String(activePump.yield_right_ml) : '';
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
				yieldLeftMl: null,
				yieldRightMl: null,
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
				yieldLeftMl: null,
				yieldRightMl: null,
				note: s.note
			})),
			...pumpSessions.map((s) => ({
				id: s.id,
				type: 'breast_pump' as const,
				side: s.side,
				startedAt: new Date(s.started_at),
				endedAt: s.ended_at ? new Date(s.ended_at) : null,
				durationSeconds: s.ended_at
					? buildTimerResult(new Date(s.started_at), new Date(s.ended_at)).durationSeconds
					: null,
				yieldLeftMl: s.yield_left_ml,
				yieldRightMl: s.yield_right_ml,
				note: s.note
			})),
			...diaperSessions.map((s) => ({
				id: s.id,
				type: 'diaper_change' as const,
				side: formatDiaperContent(s.has_poop, s.has_pee),
				startedAt: new Date(s.started_at),
				endedAt: new Date(s.started_at),
				durationSeconds: 0,
				yieldLeftMl: null,
				yieldRightMl: null,
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

	function parseOptionalYield(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error('Yield must be a non-negative number');
		}
		return Math.round(parsed);
	}

	async function handleStartBreastPump(state: {
		side: PumpSide;
		yieldLeftMl: string;
		yieldRightMl: string;
	}) {
		if (!selectedBabyId) return;
		try {
			const yieldLeftMl = parseOptionalYield(state.yieldLeftMl);
			const yieldRightMl = parseOptionalYield(state.yieldRightMl);
			breastPumpSide = state.side;
			breastPumpYieldLeftMl = state.yieldLeftMl;
			breastPumpYieldRightMl = state.yieldRightMl;
			breastPumpTimer.start();
			const id = crypto.randomUUID();
			const now = breastPumpTimer.startedAt!.toISOString();
			const payload: LocalBreastPump = {
				id,
				baby_id: selectedBabyId,
				family_id: familyId,
				side: state.side,
				started_at: now,
				ended_at: null,
				yield_left_ml: yieldLeftMl,
				yield_right_ml: yieldRightMl,
				note: null,
				created_at: now,
				_sync: 'pending'
			};
			await createBreastPumpLocal(payload);
			activeBreastPumpSession = payload;
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			breastPumpTimer.reset();
			error = e instanceof Error ? e.message : 'Failed to start breast pump session';
		}
	}

	async function handleBreastPumpSideChange(side: PumpSide) {
		breastPumpSide = side;
		if (!activeBreastPumpSession || !selectedBabyId || activeBreastPumpSession.side === side)
			return;
		try {
			await updateBreastPumpLocal(activeBreastPumpSession.id, { side, _sync: 'pending' });
			activeBreastPumpSession = { ...activeBreastPumpSession, side, _sync: 'pending' };
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update breast pump side';
		}
	}

	async function handleStopBreastPump() {
		if (!activeBreastPumpSession) return;
		const result = breastPumpTimer.stop();
		if (!result) return;
		try {
			const endedAt = result.endedAt.toISOString();
			await updateBreastPumpLocal(activeBreastPumpSession.id, {
				ended_at: endedAt,
				_sync: 'pending'
			});
			activeBreastPumpSession = null;
			await loadSessionsForBaby(selectedBabyId!);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop breast pump session';
		}
	}

	async function handleCreateDiaperChange() {
		if (!selectedBabyId) return;
		try {
			const now = new Date();
			if (!diaperHasPoop && !diaperHasPee) {
				throw new Error('Please select poop, pee, or both');
			}
			const payload =
				familyId !== null
					? buildDiaperChangePayload({
							babyId: selectedBabyId,
							familyId,
							changedAt: now,
							hasPoop: diaperHasPoop,
							hasPee: diaperHasPee
						})
					: null;
			const localPayload: LocalDiaperChange = {
				id: crypto.randomUUID(),
				baby_id: selectedBabyId,
				family_id: familyId,
				started_at: payload?.started_at ?? now.toISOString(),
				has_poop: payload?.has_poop ?? diaperHasPoop,
				has_pee: payload?.has_pee ?? diaperHasPee,
				note: payload?.note ?? null,
				created_at: now.toISOString(),
				_sync: 'pending'
			};
			await createDiaperChangeLocal(localPayload);
			diaperHasPoop = false;
			diaperHasPee = false;
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save diaper change';
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

	function openEditSessionModal(sessionItem: (typeof recentSessions)[number]) {
		editingSession = sessionItem;
		editSide = sessionItem.side;
		editStartedAt = formatDateTimeInput(sessionItem.startedAt);
		editEndedAt = sessionItem.endedAt ? formatDateTimeInput(sessionItem.endedAt) : '';
		editYieldLeftMl = sessionItem.yieldLeftMl !== null ? String(sessionItem.yieldLeftMl) : '';
		editYieldRightMl = sessionItem.yieldRightMl !== null ? String(sessionItem.yieldRightMl) : '';
	}

	function closeEditSessionModal() {
		editingSession = null;
		editSide = '';
		editStartedAt = '';
		editEndedAt = '';
		editYieldLeftMl = '';
		editYieldRightMl = '';
	}

	async function saveSessionEdits() {
		if (!editingSession) return;
		const allowedSides: string[] =
			editingSession.type === 'sleep'
				? SLEEP_SIDES
				: editingSession.type === 'breast_pump'
					? PUMP_SIDES
					: editingSession.type === 'diaper_change'
						? [...DIAPER_CONTENTS]
						: FEEDING_SIDES;
		const nextSide = editSide.trim().toLowerCase();
		if (!allowedSides.includes(nextSide)) {
			error = 'Invalid side selection';
			return;
		}

		const startedAt = parseDateTimeInput(editStartedAt.trim());
		if (!startedAt) {
			error = 'Invalid start time';
			return;
		}

		const endedAt = editEndedAt.trim() ? parseDateTimeInput(editEndedAt.trim()) : null;
		if (editEndedAt.trim() && !endedAt) {
			error = 'Invalid end time';
			return;
		}
		if (endedAt && endedAt < startedAt) {
			error = 'End time cannot be before start time';
			return;
		}

		if (!selectedBabyId) return;
		try {
			if (editingSession.type === 'feeding') {
				await updateFeedingLocal(editingSession.id, {
					side: nextSide as FeedingSide,
					started_at: startedAt.toISOString(),
					ended_at: endedAt ? endedAt.toISOString() : null,
					_sync: 'pending'
				});
			} else if (editingSession.type === 'breast_pump') {
				await updateBreastPumpLocal(editingSession.id, {
					side: nextSide as PumpSide,
					started_at: startedAt.toISOString(),
					ended_at: endedAt ? endedAt.toISOString() : null,
					yield_left_ml: parseOptionalYield(editYieldLeftMl),
					yield_right_ml: parseOptionalYield(editYieldRightMl),
					_sync: 'pending'
				});
			} else if (editingSession.type === 'sleep') {
				await updateSleepLocal(editingSession.id, {
					side: nextSide as HeadSide,
					started_at: startedAt.toISOString(),
					ended_at: endedAt ? endedAt.toISOString() : null,
					_sync: 'pending'
				});
			} else if (editingSession.type === 'diaper_change') {
				await updateDiaperChangeLocal(editingSession.id, {
					started_at: startedAt.toISOString(),
					has_poop: nextSide === 'poop' || nextSide === 'both',
					has_pee: nextSide === 'pee' || nextSide === 'both',
					_sync: 'pending'
				});
			} else {
				throw new Error(`Unsupported session type: ${editingSession.type}`);
			}
			closeEditSessionModal();
			await loadSessionsForBaby(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to edit session';
		}
	}

	function openDeleteSessionModal(sessionItem: (typeof recentSessions)[number]) {
		pendingDeleteSession = sessionItem;
	}

	function closeDeleteSessionModal() {
		pendingDeleteSession = null;
	}

	async function confirmRemoveSession() {
		if (!pendingDeleteSession) return;
		if (!selectedBabyId) return;
		try {
			if (pendingDeleteSession.type === 'feeding') {
				await deleteFeedingLocal(pendingDeleteSession.id);
				if (activeFeedingSession?.id === pendingDeleteSession.id) {
					activeFeedingSession = null;
					feedingTimer.reset();
				}
			} else if (pendingDeleteSession.type === 'breast_pump') {
				await deleteBreastPumpLocal(pendingDeleteSession.id);
				if (activeBreastPumpSession?.id === pendingDeleteSession.id) {
					activeBreastPumpSession = null;
					breastPumpTimer.reset();
				}
			} else if (pendingDeleteSession.type === 'diaper_change') {
				await deleteDiaperChangeLocal(pendingDeleteSession.id);
			} else {
				await deleteSleepLocal(pendingDeleteSession.id);
				if (activeSleepSession?.id === pendingDeleteSession.id) {
					activeSleepSession = null;
					sleepTimer.reset();
				}
			}
			closeDeleteSessionModal();
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
						disabled={sleepTimer.running || breastPumpTimer.running}
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
						disabled={feedingTimer.running || breastPumpTimer.running}
						onstart={handleStartSleep}
						onstop={handleStopSleep}
						onsidechange={handleSleepSideChange}
					/>
				</div>
				<div class="column">
					<BreastPumpTimerCard
						running={breastPumpTimer.running}
						elapsed={breastPumpTimer.elapsed}
						side={breastPumpSide}
						yieldLeftMl={breastPumpYieldLeftMl}
						yieldRightMl={breastPumpYieldRightMl}
						disabled={feedingTimer.running}
						onstart={handleStartBreastPump}
						onstop={handleStopBreastPump}
						onsidechange={handleBreastPumpSideChange}
						onyieldleftchange={(value) => (breastPumpYieldLeftMl = value)}
						onyieldrightchange={(value) => (breastPumpYieldRightMl = value)}
					/>
				</div>
				<div class="column">
					<div class="box">
						<h3 class="title is-6">Diaper Change</h3>
						<div class="field">
							<label class="checkbox mr-4">
								<input type="checkbox" bind:checked={diaperHasPoop} />
								Poop
							</label>
							<label class="checkbox">
								<input type="checkbox" bind:checked={diaperHasPee} />
								Pee
							</label>
						</div>
						<button
							class="button is-link is-light is-fullwidth"
							type="button"
							disabled={!selectedBabyId || (!diaperHasPoop && !diaperHasPee)}
							onclick={handleCreateDiaperChange}
						>
							Log diaper change
						</button>
					</div>
				</div>
			</div>

			<div class="mt-5">
				<h3 class="title is-5">Recent Sessions</h3>
				<SessionList
					sessions={recentSessions}
					onedit={openEditSessionModal}
					onremove={openDeleteSessionModal}
				/>
			</div>
		{/if}
	</div>
</section>

{#if editingSession}
	<div class="modal is-active">
		<button
			class="modal-background"
			type="button"
			aria-label="Close edit session modal"
			onclick={closeEditSessionModal}
		></button>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">Edit Session</p>
				<button class="delete" aria-label="Close" type="button" onclick={closeEditSessionModal}
				></button>
			</header>
			<section class="modal-card-body">
				<div class="field">
					<label class="label" for="edit-session-side">Side</label>
					<div class="control">
						<div class="select is-fullwidth">
							<select id="edit-session-side" bind:value={editSide}>
								{#each editingSession.type === 'sleep' ? SLEEP_SIDES : editingSession.type === 'breast_pump' ? PUMP_SIDES : editingSession.type === 'diaper_change' ? DIAPER_CONTENTS : FEEDING_SIDES as sideOption}
									<option value={sideOption}>{sideOption}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
				<div class="field">
					<label class="label" for="edit-session-start">Start time</label>
					<div class="control">
						<input
							id="edit-session-start"
							class="input"
							type="datetime-local"
							bind:value={editStartedAt}
						/>
					</div>
				</div>
				<div class="field">
					<label class="label" for="edit-session-end">End time</label>
					<div class="control">
						<input
							id="edit-session-end"
							class="input"
							type="datetime-local"
							bind:value={editEndedAt}
						/>
					</div>
					<p class="help">Leave blank for active session.</p>
				</div>
				{#if editingSession.type === 'breast_pump'}
					<div class="field">
						<label class="label" for="edit-session-yield-left">Left yield (ml)</label>
						<div class="control">
							<input
								id="edit-session-yield-left"
								class="input"
								type="number"
								min="0"
								step="1"
								bind:value={editYieldLeftMl}
							/>
						</div>
					</div>
					<div class="field">
						<label class="label" for="edit-session-yield-right">Right yield (ml)</label>
						<div class="control">
							<input
								id="edit-session-yield-right"
								class="input"
								type="number"
								min="0"
								step="1"
								bind:value={editYieldRightMl}
							/>
						</div>
					</div>
				{/if}
			</section>
			<footer class="modal-card-foot">
				<button class="button is-primary" type="button" onclick={saveSessionEdits}>Save</button>
				<button class="button" type="button" onclick={closeEditSessionModal}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

{#if pendingDeleteSession}
	<div class="modal is-active">
		<button
			class="modal-background"
			type="button"
			aria-label="Close delete session modal"
			onclick={closeDeleteSessionModal}
		></button>
		<div class="modal-card">
			<header class="modal-card-head">
				<p class="modal-card-title">Delete Session</p>
				<button class="delete" aria-label="Close" type="button" onclick={closeDeleteSessionModal}
				></button>
			</header>
			<section class="modal-card-body">
				<p>Are you sure you want to delete this session?</p>
			</section>
			<footer class="modal-card-foot">
				<button class="button is-danger" type="button" onclick={confirmRemoveSession}>Delete</button
				>
				<button class="button" type="button" onclick={closeDeleteSessionModal}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}
