<script lang="ts">
	import { getContext } from 'svelte';
	import { t } from '@sveltia/i18n';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { BABY_STATE_KEY } from '$lib/state/baby.svelte';
	import type { BabyState } from '$lib/state/baby.svelte';
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
	import type { LocalSession } from '$lib/sessions/local-session';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { PumpSide } from '$lib/sessions/breast-pump';
	import SessionRow from '$lib/components/SessionRow.svelte';
	import SessionEditSheet from '$lib/components/SessionEditSheet.svelte';

	const sync = getContext<SyncEngineStore>(SYNC_KEY);
	const babyState = getContext<BabyState>(BABY_STATE_KEY);

	let loading = $state(true);
	let error = $state<string | null>(null);
	let sessions = $state<LocalSession[]>([]);
	let editingSession = $state<LocalSession | null>(null);

	$effect(() => {
		const babyId = babyState.selectedBabyId;
		if (!babyId) {
			sessions = [];
			loading = false;
			return;
		}
		loadHistory(babyId);
	});

	async function loadHistory(babyId: string) {
		loading = true;
		try {
			const [feedings, sleeps, pumps, diapers] = await Promise.all([
				listFeedingSessionsLocal(babyId, 200),
				listSleepSessionsLocal(babyId, 200),
				listBreastPumpSessionsLocal(babyId, 200),
				listDiaperChangeSessionsLocal(babyId, 200)
			]);
			sessions = [
				...feedings.map(
					(s): LocalSession => ({
						id: s.id,
						type: 'feeding',
						baby_id: s.baby_id,
						family_id: s.family_id,
						started_at: s.started_at,
						ended_at: s.ended_at,
						side: s.side,
						note: s.note,
						_sync: s._sync
					})
				),
				...sleeps.map(
					(s): LocalSession => ({
						id: s.id,
						type: 'sleep',
						baby_id: s.baby_id,
						family_id: s.family_id,
						started_at: s.started_at,
						ended_at: s.ended_at,
						side: s.side,
						note: s.note,
						_sync: s._sync
					})
				),
				...pumps.map(
					(s): LocalSession => ({
						id: s.id,
						type: 'breast_pump',
						baby_id: s.baby_id,
						family_id: s.family_id,
						started_at: s.started_at,
						ended_at: s.ended_at,
						side: s.side,
						yield_left_ml: s.yield_left_ml,
						yield_right_ml: s.yield_right_ml,
						note: s.note,
						_sync: s._sync
					})
				),
				...diapers.map(
					(s): LocalSession => ({
						id: s.id,
						type: 'diaper_change',
						baby_id: s.baby_id,
						family_id: s.family_id,
						started_at: s.started_at,
						ended_at: null,
						has_poop: s.has_poop,
						has_pee: s.has_pee,
						note: s.note,
						_sync: s._sync
					})
				)
			].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load history';
		} finally {
			loading = false;
		}
	}

	const grouped = $derived.by(() => {
		const groups: { dateKey: string; label: string; sessions: LocalSession[] }[] = [];
		const today = new Date().toLocaleDateString('en-CA');
		const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

		for (const s of sessions) {
			const dateKey = new Date(s.started_at).toLocaleDateString('en-CA');
			let group = groups.find((g) => g.dateKey === dateKey);
			if (!group) {
				const label =
					dateKey === today
						? t('history.today')
						: dateKey === yesterday
							? t('history.yesterday')
							: new Date(s.started_at).toLocaleDateString([], {
									weekday: 'short',
									day: 'numeric',
									month: 'short'
								});
				group = { dateKey, label, sessions: [] };
				groups.push(group);
			}
			group.sessions.push(s);
		}
		return groups;
	});

	function handleEdit(s: LocalSession) {
		editingSession = s;
	}

	async function handleSave(updated: LocalSession) {
		const babyId = babyState.selectedBabyId;
		if (!babyId) return;
		if (updated.type === 'feeding') {
			await updateFeedingLocal(updated.id, {
				side: updated.side as FeedingSide,
				started_at: updated.started_at,
				ended_at: updated.ended_at,
				_sync: 'pending'
			});
		} else if (updated.type === 'sleep') {
			await updateSleepLocal(updated.id, {
				side: updated.side as HeadSide,
				started_at: updated.started_at,
				ended_at: updated.ended_at,
				_sync: 'pending'
			});
		} else if (updated.type === 'breast_pump') {
			await updateBreastPumpLocal(updated.id, {
				side: updated.side as PumpSide,
				started_at: updated.started_at,
				ended_at: updated.ended_at,
				yield_left_ml: updated.yield_left_ml ?? null,
				yield_right_ml: updated.yield_right_ml ?? null,
				_sync: 'pending'
			});
		} else if (updated.type === 'diaper_change') {
			await updateDiaperChangeLocal(updated.id, {
				started_at: updated.started_at,
				has_poop: updated.has_poop ?? false,
				has_pee: updated.has_pee ?? false,
				_sync: 'pending'
			});
		}
		editingSession = null;
		await loadHistory(babyId);
		sync.syncNow();
	}

	async function handleDelete(s: LocalSession) {
		const babyId = babyState.selectedBabyId;
		if (!babyId) return;
		if (s.type === 'feeding') await deleteFeedingLocal(s.id);
		else if (s.type === 'sleep') await deleteSleepLocal(s.id);
		else if (s.type === 'breast_pump') await deleteBreastPumpLocal(s.id);
		else if (s.type === 'diaper_change') await deleteDiaperChangeLocal(s.id);
		editingSession = null;
		await loadHistory(babyId);
		sync.syncNow();
	}
</script>

<div class="page">
	<h1 class="page-title">{t('history.title')}</h1>

	{#if error}
		<p class="error-msg" role="alert">{error}</p>
	{/if}

	{#if !babyState.selectedBabyId}
		<p class="empty-msg">{t('history.selectBaby')}</p>
	{:else if loading}
		<p class="loading-msg">{t('common.loadingEllipsis')}</p>
	{:else if grouped.length === 0}
		<p class="empty-msg">{t('history.noSessions')}</p>
	{:else}
		{#each grouped as group (group.dateKey)}
			<div class="date-group">
				<h2 class="date-header">{group.label}</h2>
				<div class="session-list">
					{#each group.sessions as s, i (s.id)}
						<SessionRow
							session={s}
							onedit={handleEdit}
							ondelete={handleDelete}
							isLast={i === group.sessions.length - 1}
						/>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<SessionEditSheet
	session={editingSession}
	onclose={() => (editingSession = null)}
	onsave={handleSave}
	ondelete={handleDelete}
/>

<style>
	.page {
		padding: var(--space-4) var(--space-4) calc(var(--bottom-nav-h) + var(--space-6));
		max-width: 720px;
		margin: 0 auto;
	}

	.page-title {
		font-size: var(--font-size-5);
		font-weight: var(--fw-bold);
		color: var(--text);
		margin: 0 0 var(--space-5);
	}

	.date-header {
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--text-2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: var(--space-5) 0 var(--space-2);
	}

	.session-list {
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		overflow: hidden;
	}

	.error-msg {
		color: var(--danger);
		font-size: var(--font-size-2);
		margin-bottom: var(--space-3);
	}

	.loading-msg,
	.empty-msg {
		color: var(--text-2);
		text-align: center;
		padding: var(--space-6) 0;
	}
</style>
