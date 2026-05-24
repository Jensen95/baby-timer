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
	import {
		listBreastPumpSessionsLocal,
		updateBreastPumpLocal,
		deleteBreastPumpLocal
	} from '$lib/db/local-breast-pump';
	import {
		listDiaperChangeSessionsLocal,
		updateDiaperChangeLocal,
		deleteDiaperChangeLocal
	} from '$lib/db/local-diaper-change';
	import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';
	import { buildTimerResult } from '$lib/timer/timer-logic';
	import SessionList from '$lib/components/SessionList.svelte';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { PumpSide } from '$lib/sessions/breast-pump';
	import { getDiaperContent } from '$lib/sessions/diaper-change';

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
	let editingSession = $state<(typeof sessions)[number] | null>(null);
	let pendingDeleteSession = $state<(typeof sessions)[number] | null>(null);
	let editSide = $state('');
	let editStartedAt = $state('');
	let editEndedAt = $state('');
	let editYieldLeftMl = $state('');
	let editYieldRightMl = $state('');

	const FEEDING_SIDES: FeedingSide[] = ['left', 'right', 'both'];
	const SLEEP_SIDES: HeadSide[] = ['left', 'right', 'back', 'tummy', 'side'];
	const PUMP_SIDES: PumpSide[] = ['left', 'right', 'both'];
	const DIAPER_CONTENTS = ['poop', 'pee', 'both'] as const;

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
			const [feedings, sleeps, pumps, diaperChanges] = await Promise.all([
				listFeedingSessionsLocal(babyId, 100),
				listSleepSessionsLocal(babyId, 100),
				listBreastPumpSessionsLocal(babyId, 100),
				listDiaperChangeSessionsLocal(babyId, 100)
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
					yieldLeftMl: null,
					yieldRightMl: null,
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
					yieldLeftMl: null,
					yieldRightMl: null,
					note: s.note
				})),
				...pumps.map((s) => ({
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
				...diaperChanges.map((s) => ({
					id: s.id,
					type: 'diaper_change' as const,
					side: getDiaperContent(s.has_poop, s.has_pee),
					startedAt: new Date(s.started_at),
					endedAt: new Date(s.started_at),
					durationSeconds: 0,
					yieldLeftMl: null,
					yieldRightMl: null,
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

	function parseOptionalYield(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error('Yield must be a non-negative number');
		}
		return Math.round(parsed);
	}

	function openEditSessionModal(sessionItem: (typeof sessions)[number]) {
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
			await loadHistory(selectedBabyId);
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to edit session';
		}
	}

	function openDeleteSessionModal(sessionItem: (typeof sessions)[number]) {
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
			} else if (pendingDeleteSession.type === 'breast_pump') {
				await deleteBreastPumpLocal(pendingDeleteSession.id);
			} else if (pendingDeleteSession.type === 'diaper_change') {
				await deleteDiaperChangeLocal(pendingDeleteSession.id);
			} else {
				await deleteSleepLocal(pendingDeleteSession.id);
			}
			closeDeleteSessionModal();
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

		<SessionList
			{sessions}
			{loading}
			onedit={openEditSessionModal}
			onremove={openDeleteSessionModal}
		/>
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
