<script lang="ts">
	import { getContext } from 'svelte';
	import { t } from '@sveltia/i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import { base } from '$app/paths';
	import { Milk, Moon, Wind, Baby } from '@lucide/svelte';
	import type { IconProps } from '@lucide/svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { BABY_STATE_KEY } from '$lib/state/baby.svelte';
	import type { BabyState } from '$lib/state/baby.svelte';
	import { supabase } from '$lib/supabase';
	import { resolveLocalFamilyForUser } from '$lib/db/local-family';
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
	import {
		getActiveTimer,
		canStartTimer,
		restoreActiveTimers,
		startFeedingTimer,
		stopFeedingTimer,
		updateFeedingSide,
		startSleepTimer,
		stopSleepTimer,
		updateSleepHeadSide,
		startPumpTimer,
		stopPumpTimer,
		updatePumpSide,
		logDiaperChange
	} from '$lib/timer/active-timers.svelte';
	import type { ActiveTimer } from '$lib/timer/active-timers.svelte';
	import type { LocalSession } from '$lib/sessions/local-session';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { PumpSide } from '$lib/sessions/breast-pump';
	import type { DiaperContent } from '$lib/sessions/diaper-change';
	import { getNow } from '$lib/state/time.svelte';
	import TrackTile from '$lib/components/TrackTile.svelte';
	import TimerHero from '$lib/components/TimerHero.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Button from '$lib/components/Button.svelte';
	import OptionGrid from '$lib/components/OptionGrid.svelte';
	import SessionRow from '$lib/components/SessionRow.svelte';
	import SessionEditSheet from '$lib/components/SessionEditSheet.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);
	const babyState = getContext<BabyState>(BABY_STATE_KEY);

	let familyId = $state<string | null>(null);
	let pageLoading = $state(true);
	let error = $state<string | null>(null);

	let recentSessions = $state<LocalSession[]>([]);
	let editingSession = $state<LocalSession | null>(null);

	const feedIcon = Milk as unknown as Component<IconProps>;
	const sleepIcon = Moon as unknown as Component<IconProps>;
	const pumpIcon = Wind as unknown as Component<IconProps>;
	const diaperIcon = Baby as unknown as Component<IconProps>;

	const sideKeyMap: Record<string, string> = {
		left: 'track.options.left',
		right: 'track.options.right',
		both: 'track.options.both',
		back: 'track.options.back',
		tummy: 'track.options.tummy',
		side: 'track.options.side'
	};

	const headSideKeyMap: Record<string, string> = {
		left: 'track.options.headLeft',
		right: 'track.options.headRight',
		back: 'track.options.back',
		tummy: 'track.options.tummy',
		side: 'track.options.side'
	};

	const FEEDING_OPTIONS = $derived([
		{ value: 'left', label: t('track.options.left') },
		{ value: 'right', label: t('track.options.right') },
		{ value: 'both', label: t('track.options.both') }
	]);
	const SLEEP_OPTIONS = $derived([
		{ value: 'back', label: t('track.options.back') },
		{ value: 'left', label: t('track.options.headLeft') },
		{ value: 'right', label: t('track.options.headRight') },
		{ value: 'tummy', label: t('track.options.tummy') },
		{ value: 'side', label: t('track.options.side') }
	]);
	const PUMP_OPTIONS = $derived([
		{ value: 'left', label: t('track.options.left') },
		{ value: 'right', label: t('track.options.right') },
		{ value: 'both', label: t('track.options.both') }
	]);
	const DIAPER_OPTIONS = $derived([
		{ value: 'poop', label: t('track.options.poop') },
		{ value: 'pee', label: t('track.options.pee') },
		{ value: 'both', label: t('track.options.bothWaste') }
	]);

	let feedSheetOpen = $state(false);
	let feedSide = $state<FeedingSide>('left');
	let sleepSheetOpen = $state(false);
	let sleepSide = $state<HeadSide>('back');
	let pumpSheetOpen = $state(false);
	let pumpSide = $state<PumpSide>('both');
	let diaperSheetOpen = $state(false);
	let diaperContent = $state<DiaperContent>('poop');

	let pumpCompleteOpen = $state(false);
	let pumpYieldMode = $state<'per-side' | 'total-only'>('per-side');
	let pumpYieldLeft = $state('');
	let pumpYieldRight = $state('');
	let pumpYieldTotal = $state('');
	let pumpStopping = $state(false);

	let babyId = $derived(babyState.selectedBabyId);
	let selectedBaby = $derived(babyState.selectedBaby);

	let feedTimer = $derived(babyId ? getActiveTimer(babyId, 'feed') : null);
	let sleepTimer = $derived(babyId ? getActiveTimer(babyId, 'sleep') : null);
	let pumpTimer = $derived(babyId ? getActiveTimer(babyId, 'pump') : null);
	let hasActiveTimer = $derived(Boolean(feedTimer || sleepTimer || pumpTimer));

	let feedCanStart = $derived(babyId ? canStartTimer(babyId, 'feed') : null);
	let sleepCanStart = $derived(babyId ? canStartTimer(babyId, 'sleep') : null);
	let pumpCanStart = $derived(babyId ? canStartTimer(babyId, 'pump') : null);

	type QuickAction = 'feed' | 'sleep' | 'pump' | 'diaper';

	let loaded = false;

	$effect(() => {
		if (session.loading || loaded) return;
		loaded = true;
		pageLoading = false;
		const userId = session.user?.id;
		if (!userId) {
			babyState.loadBabies(null).catch((e: unknown) => {
				error = e instanceof Error ? e.message : 'Failed to load babies';
			});
			return;
		}
		(async () => {
			try {
				const localFamily = await resolveLocalFamilyForUser(supabase, userId);
				const fid = localFamily?.id ?? null;
				familyId = fid;
				babyState.loadBabies(fid).catch((e: unknown) => {
					error = e instanceof Error ? e.message : 'Failed to load babies';
				});
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load data';
			}
		})();
	});

	$effect(() => {
		const id = babyId;
		void sync.revision;
		if (!id) {
			recentSessions = [];
			return;
		}
		restoreActiveTimers(id);
		loadSessions(id);
	});

	function clearQuickActionParam() {
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('quickAction');
		const query = params.toString();
		const target = query ? `${page.url.pathname}?${query}` : page.url.pathname;
		goto(target, { replaceState: true, keepFocus: true, noScroll: true });
	}

	$effect(() => {
		const action = page.url.searchParams.get('quickAction') as QuickAction | null;
		if (!action || !babyId) return;

		if (action === 'feed' && feedCanStart?.allowed) {
			feedSheetOpen = true;
		} else if (action === 'sleep' && sleepCanStart?.allowed) {
			sleepSheetOpen = true;
		} else if (action === 'pump' && pumpCanStart?.allowed) {
			pumpSheetOpen = true;
		} else if (action === 'diaper') {
			diaperSheetOpen = true;
		}

		clearQuickActionParam();
	});

	async function loadSessions(id: string) {
		try {
			const [feedings, sleeps, pumps, diapers] = await Promise.all([
				listFeedingSessionsLocal(id, 10),
				listSleepSessionsLocal(id, 10),
				listBreastPumpSessionsLocal(id, 10),
				listDiaperChangeSessionsLocal(id, 10)
			]);

			const combined: LocalSession[] = [
				...feedings.map((s) => ({
					id: s.id,
					type: 'feeding' as const,
					baby_id: s.baby_id,
					family_id: s.family_id,
					started_at: s.started_at,
					ended_at: s.ended_at,
					side: s.side,
					note: s.note,
					_sync: s._sync
				})),
				...sleeps.map((s) => ({
					id: s.id,
					type: 'sleep' as const,
					baby_id: s.baby_id,
					family_id: s.family_id,
					started_at: s.started_at,
					ended_at: s.ended_at,
					side: s.side,
					note: s.note,
					_sync: s._sync
				})),
				...pumps.map((s) => ({
					id: s.id,
					type: 'breast_pump' as const,
					baby_id: s.baby_id,
					family_id: s.family_id,
					started_at: s.started_at,
					ended_at: s.ended_at,
					side: s.side,
					yield_left_ml: s.yield_left_ml,
					yield_right_ml: s.yield_right_ml,
					yield_total_ml: s.yield_total_ml,
					note: s.note,
					_sync: s._sync
				})),
				...diapers.map((s) => ({
					id: s.id,
					type: 'diaper_change' as const,
					baby_id: s.baby_id,
					family_id: s.family_id,
					started_at: s.started_at,
					ended_at: null,
					has_poop: s.has_poop,
					has_pee: s.has_pee,
					note: s.note,
					_sync: s._sync
				}))
			];

			combined.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
			recentSessions = combined.slice(0, 10);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load sessions';
		}
	}

	function relativeAgo(iso: string): string {
		const seconds = Math.max(0, Math.floor((getNow() - new Date(iso).getTime()) / 1000));
		if (seconds < 60) return t('timer.justNow');
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			const remMinutes = minutes % 60;
			return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
		}
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function summaryFor(type: LocalSession['type']): string | undefined {
		const last = recentSessions.find((s) => s.type === type);
		if (!last) return undefined;
		const when = relativeAgo(last.started_at);
		if (type === 'diaper_change') {
			const hasPoop = last.has_poop ?? false;
			const hasPee = last.has_pee ?? false;
			const detail =
				hasPoop && hasPee
					? t('track.options.bothWaste')
					: hasPoop
						? t('track.options.poop')
						: t('track.options.pee');
			return `${when} · ${detail}`;
		}
		if (last.side) {
			const keyMap = type === 'sleep' ? headSideKeyMap : sideKeyMap;
			const sideLabel = keyMap[last.side] ? t(keyMap[last.side]) : last.side;
			return `${when} · ${sideLabel}`;
		}
		return when;
	}

	let feedSummary = $derived(summaryFor('feeding'));
	let sleepSummary = $derived(summaryFor('sleep'));
	let pumpSummary = $derived(summaryFor('breast_pump'));
	let diaperSummary = $derived(summaryFor('diaper_change'));

	async function refresh() {
		if (babyId) await loadSessions(babyId);
		sync.syncNow();
	}

	async function withError(action: () => Promise<void>, fallback: string) {
		try {
			await action();
		} catch (e) {
			error = e instanceof Error ? e.message : fallback;
		}
	}

	async function confirmStartFeed() {
		if (!babyId) return;
		await withError(async () => {
			await startFeedingTimer(babyId!, familyId, feedSide);
			feedSheetOpen = false;
			await refresh();
		}, 'Failed to start feeding');
	}

	async function confirmStartSleep() {
		if (!babyId) return;
		await withError(async () => {
			await startSleepTimer(babyId!, familyId, sleepSide);
			sleepSheetOpen = false;
			await refresh();
		}, 'Failed to start sleep');
	}

	async function confirmStartPump() {
		if (!babyId) return;
		await withError(async () => {
			await startPumpTimer(babyId!, familyId, pumpSide);
			pumpSheetOpen = false;
			await refresh();
		}, 'Failed to start pump');
	}

	async function confirmLogDiaper() {
		if (!babyId) return;
		await withError(async () => {
			await logDiaperChange(babyId!, familyId, diaperContent);
			diaperSheetOpen = false;
			await refresh();
		}, 'Failed to log diaper change');
	}

	async function handleStopFeed() {
		if (!babyId) return;
		await withError(async () => {
			await stopFeedingTimer(babyId!);
			await refresh();
		}, 'Failed to stop feeding');
	}

	async function handleStopSleep() {
		if (!babyId) return;
		await withError(async () => {
			await stopSleepTimer(babyId!);
			await refresh();
		}, 'Failed to stop sleep');
	}

	async function handleStopPump() {
		pumpYieldMode = 'per-side';
		pumpYieldLeft = '';
		pumpYieldRight = '';
		pumpYieldTotal = '';
		pumpCompleteOpen = true;
	}

	function parseOptionalYield(value: string | number): number | undefined {
		let numValue = value;
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) {
				return undefined;
			}
			numValue = trimmed;
		}

		const parsed = Number(numValue);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error('Yield must be a non-negative number');
		}
		return Math.round(parsed);
	}

	async function confirmPumpComplete() {
		if (!babyId || pumpStopping) return;
		pumpStopping = true;
		try {
			if (pumpYieldMode === 'total-only') {
				const total = parseOptionalYield(pumpYieldTotal);
				await stopPumpTimer(babyId, undefined, undefined, total);
			} else {
				const left = parseOptionalYield(pumpYieldLeft);
				const right = parseOptionalYield(pumpYieldRight);
				await stopPumpTimer(babyId, left, right, undefined);
			}
			pumpCompleteOpen = false;
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop pump';
		} finally {
			pumpStopping = false;
		}
	}

	async function handleSideChange(timer: ActiveTimer, side: string) {
		if (!babyId) return;
		await withError(async () => {
			if (timer.type === 'feed') {
				await updateFeedingSide(babyId!, side as FeedingSide);
			} else if (timer.type === 'sleep') {
				await updateSleepHeadSide(babyId!, side as HeadSide);
			} else {
				await updatePumpSide(babyId!, side as PumpSide);
			}
			await refresh();
		}, 'Failed to update side');
	}

	async function handleSave(updated: LocalSession) {
		await withError(async () => {
			if (updated.type === 'feeding') {
				await updateFeedingLocal(updated.id, {
					side: (updated.side ?? 'left') as FeedingSide,
					started_at: updated.started_at,
					ended_at: updated.ended_at,
					_sync: 'pending'
				});
			} else if (updated.type === 'sleep') {
				await updateSleepLocal(updated.id, {
					side: (updated.side ?? 'back') as HeadSide,
					started_at: updated.started_at,
					ended_at: updated.ended_at,
					_sync: 'pending'
				});
			} else if (updated.type === 'breast_pump') {
				await updateBreastPumpLocal(updated.id, {
					side: (updated.side ?? 'both') as PumpSide,
					started_at: updated.started_at,
					ended_at: updated.ended_at,
					yield_left_ml: updated.yield_left_ml ?? null,
					yield_right_ml: updated.yield_right_ml ?? null,
					yield_total_ml: updated.yield_total_ml ?? null,
					_sync: 'pending'
				});
			} else {
				await updateDiaperChangeLocal(updated.id, {
					started_at: updated.started_at,
					has_poop: updated.has_poop ?? false,
					has_pee: updated.has_pee ?? false,
					_sync: 'pending'
				});
			}
			editingSession = null;
			await refresh();
		}, 'Failed to save session');
	}

	async function handleDelete(deleted: LocalSession) {
		await withError(async () => {
			if (deleted.type === 'feeding') {
				await deleteFeedingLocal(deleted.id);
			} else if (deleted.type === 'sleep') {
				await deleteSleepLocal(deleted.id);
			} else if (deleted.type === 'breast_pump') {
				await deleteBreastPumpLocal(deleted.id);
			} else {
				await deleteDiaperChangeLocal(deleted.id);
			}
			editingSession = null;
			await refresh();
		}, 'Failed to delete session');
	}
</script>

<div class="page" class:has-active-timer={hasActiveTimer}>
	{#if pageLoading}
		<p class="loading-msg">{t('common.loadingEllipsis')}</p>
	{:else if !babyId}
		{#if error}
			<p class="error-msg" role="alert">{error}</p>
		{/if}
		<div class="empty">
			<h2 class="empty-title">{t('app.noBabyYetTitle')}</h2>
			<p class="empty-text">{t('app.noBabyYetDesc')}</p>
			<Button variant="primary" href="{base}/app/family">{t('app.addABaby')}</Button>
		</div>
	{:else}
		{#if error}
			<p class="error-msg" role="alert">{error}</p>
		{/if}

		<div class="tiles">
			{#if feedTimer}
				<div class="hero-slot">
					<TimerHero
						timer={feedTimer}
						babyName={selectedBaby?.name}
						onstop={handleStopFeed}
						onsidechange={(side) => handleSideChange(feedTimer!, side)}
					/>
				</div>
			{:else}
				<TrackTile
					type="feed"
					label={t('track.feed')}
					icon={feedIcon}
					lastSummary={feedSummary}
					disabled={!feedCanStart?.allowed}
					disabledReason={feedCanStart?.reason ?? undefined}
					onstart={() => (feedSheetOpen = true)}
				/>
			{/if}

			{#if sleepTimer}
				<div class="hero-slot">
					<TimerHero
						timer={sleepTimer}
						babyName={selectedBaby?.name}
						onstop={handleStopSleep}
						onsidechange={(side) => handleSideChange(sleepTimer!, side)}
					/>
				</div>
			{:else}
				<TrackTile
					type="sleep"
					label={t('track.sleep')}
					icon={sleepIcon}
					lastSummary={sleepSummary}
					disabled={!sleepCanStart?.allowed}
					disabledReason={sleepCanStart?.reason ?? undefined}
					onstart={() => (sleepSheetOpen = true)}
				/>
			{/if}

			{#if pumpTimer}
				<div class="hero-slot">
					<TimerHero
						timer={pumpTimer}
						babyName={selectedBaby?.name}
						onstop={handleStopPump}
						onsidechange={(side) => handleSideChange(pumpTimer!, side)}
					/>
				</div>
			{:else}
				<TrackTile
					type="pump"
					label={t('track.pump')}
					icon={pumpIcon}
					lastSummary={pumpSummary}
					disabled={!pumpCanStart?.allowed}
					disabledReason={pumpCanStart?.reason ?? undefined}
					onstart={() => (pumpSheetOpen = true)}
				/>
			{/if}

			<TrackTile
				type="diaper"
				label={t('track.diaper')}
				icon={diaperIcon}
				lastSummary={diaperSummary}
				onstart={() => (diaperSheetOpen = true)}
			/>
		</div>

		<section class="recent">
			<h2 class="recent-title">{t('app.recent')}</h2>
			{#if recentSessions.length === 0}
				<p class="recent-empty">{t('app.noSessionsYet')}</p>
			{:else}
				<div class="recent-list">
					{#each recentSessions as item, i (item.id)}
						<SessionRow
							session={item}
							onedit={(s) => (editingSession = s)}
							ondelete={handleDelete}
							isLast={i === recentSessions.length - 1}
						/>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<Sheet open={feedSheetOpen} title={t('track.startFeeding')} onclose={() => (feedSheetOpen = false)}>
	<span class="sheet-label">{t('track.side')}</span>
	<OptionGrid
		options={FEEDING_OPTIONS}
		value={feedSide}
		columns={3}
		onchange={(v) => (feedSide = v as FeedingSide)}
	/>
	{#snippet footer()}
		<Button variant="primary" class="full" onclick={confirmStartFeed}>{t('common.start')}</Button>
	{/snippet}
</Sheet>

<Sheet open={sleepSheetOpen} title={t('track.startSleep')} onclose={() => (sleepSheetOpen = false)}>
	<span class="sheet-label">{t('track.headPosition')}</span>
	<OptionGrid
		options={SLEEP_OPTIONS}
		value={sleepSide}
		columns={3}
		onchange={(v) => (sleepSide = v as HeadSide)}
	/>
	{#snippet footer()}
		<Button variant="primary" class="full" onclick={confirmStartSleep}>{t('common.start')}</Button>
	{/snippet}
</Sheet>

<Sheet open={pumpSheetOpen} title={t('track.startPump')} onclose={() => (pumpSheetOpen = false)}>
	<span class="sheet-label">{t('track.side')}</span>
	<OptionGrid
		options={PUMP_OPTIONS}
		value={pumpSide}
		columns={3}
		onchange={(v) => (pumpSide = v as PumpSide)}
	/>
	{#snippet footer()}
		<Button variant="primary" class="full" onclick={confirmStartPump}>{t('common.start')}</Button>
	{/snippet}
</Sheet>

<Sheet
	open={diaperSheetOpen}
	title={t('track.logDiaper')}
	onclose={() => (diaperSheetOpen = false)}
>
	<span class="sheet-label">{t('track.contents')}</span>
	<OptionGrid
		options={DIAPER_OPTIONS}
		value={diaperContent}
		columns={3}
		onchange={(v) => (diaperContent = v as DiaperContent)}
	/>
	{#snippet footer()}
		<Button variant="primary" class="full" onclick={confirmLogDiaper}>{t('common.log')}</Button>
	{/snippet}
</Sheet>

<Sheet
	open={pumpCompleteOpen}
	title={t('track.pumpComplete')}
	onclose={() => (pumpCompleteOpen = false)}
>
	<div class="yield-fields">
		<div class="field">
			<span class="sheet-label">{t('track.yieldMode')}</span>
			<OptionGrid
				options={[
					{ value: 'per-side', label: t('track.yieldPerSide') },
					{ value: 'total-only', label: t('track.yieldTotalOnly') }
				]}
				value={pumpYieldMode}
				columns={2}
				onchange={(v) => (pumpYieldMode = v as 'per-side' | 'total-only')}
			/>
		</div>
		{#if pumpYieldMode === 'per-side'}
			<div class="field">
				<label class="sheet-label" for="pump-yield-left">{t('track.leftYield')}</label>
				<input
					id="pump-yield-left"
					class="number-input"
					type="number"
					min="0"
					step="1"
					placeholder="optional"
					bind:value={pumpYieldLeft}
				/>
			</div>
			<div class="field">
				<label class="sheet-label" for="pump-yield-right">{t('track.rightYield')}</label>
				<input
					id="pump-yield-right"
					class="number-input"
					type="number"
					min="0"
					step="1"
					placeholder="optional"
					bind:value={pumpYieldRight}
				/>
			</div>
		{:else}
			<div class="field">
				<label class="sheet-label" for="pump-yield-total">{t('track.totalYield')}</label>
				<input
					id="pump-yield-total"
					class="number-input"
					type="number"
					min="0"
					step="1"
					placeholder="optional"
					bind:value={pumpYieldTotal}
				/>
			</div>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="primary" class="full" loading={pumpStopping} onclick={confirmPumpComplete}>
			{t('common.done')}
		</Button>
	{/snippet}
</Sheet>

<SessionEditSheet
	session={editingSession}
	onclose={() => (editingSession = null)}
	onsave={handleSave}
	ondelete={handleDelete}
/>

<style>
	.page {
		padding: var(--space-4) var(--space-4) calc(var(--bottom-nav-h) + var(--space-6));
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	@media (max-width: 768px) {
		.page {
			padding-bottom: calc(var(--bottom-nav-h) + 64px + var(--space-6));
		}

		.page.has-active-timer {
			padding-bottom: calc(var(--bottom-nav-h) + var(--active-bar-h) + 64px + var(--space-6));
		}
	}

	.loading-msg {
		color: var(--text-2);
		text-align: center;
		padding: var(--space-6) 0;
	}

	.error-msg {
		color: var(--danger);
		margin: 0;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
		padding: var(--space-6) var(--space-4);
	}

	.empty-title {
		margin: 0;
		font-size: var(--font-size-5);
		font-weight: var(--fw-bold);
		color: var(--text);
	}

	.empty-text {
		margin: 0;
		color: var(--text-2);
	}

	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}

	.hero-slot {
		grid-column: 1 / -1;
	}

	.recent-title {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-4);
		font-weight: var(--fw-bold);
		color: var(--text);
	}

	.recent-empty {
		color: var(--text-2);
		margin: 0;
	}

	.recent-list {
		background: var(--surface);
		border-radius: var(--radius-3);
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.sheet-label {
		display: block;
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--text-2);
		margin-bottom: var(--space-2);
	}

	.yield-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.number-input {
		width: 100%;
		min-height: var(--tap-comfortable);
		padding: var(--space-3) var(--space-4);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--font-size-3);
		appearance: none;
		-webkit-appearance: none;
		box-sizing: border-box;
	}

	.number-input:focus {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
		border-color: var(--brand);
	}

	:global(.btn.full) {
		width: 100%;
	}
</style>
