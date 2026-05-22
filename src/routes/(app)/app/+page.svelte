<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { createTimer } from '$lib/timer/timer.svelte';
	import { startFeeding, stopFeeding, getActiveFeedingSession, listFeedingSessions } from '$lib/db/feeding';
	import { startSleep, stopSleep, getActiveSleepSession, listSleepSessions } from '$lib/db/sleep';
	import { listBabies } from '$lib/db/babies';
	import { getUserFamilies } from '$lib/db/family';
	import FeedingTimerCard from '$lib/components/FeedingTimerCard.svelte';
	import SleepTimerCard from '$lib/components/SleepTimerCard.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { Tables } from '$lib/db/database.types';

	type Baby = Tables<'babies'>;
	type FeedingSession = Tables<'feeding_sessions'>;
	type SleepSession = Tables<'sleep_sessions'>;

	const session = getContext<SessionStore>(SESSION_KEY);

	// State
	let babies = $state<Baby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let familyId = $state<string | null>(null);
	let pageLoading = $state(true);
	let error = $state<string | null>(null);

	// Active sessions in DB (null = no session running)
	let activeFeedingSession = $state<FeedingSession | null>(null);
	let activeSleepSession = $state<SleepSession | null>(null);

	// Recent sessions for the list
	let recentSessions = $state<Array<{
		id: string;
		type: 'feeding' | 'sleep';
		side: string;
		startedAt: Date;
		endedAt: Date | null;
		durationSeconds: number | null;
		note: string | null;
	}>>([]);

	// Timer state (client-side clock, synced from DB on load)
	const feedingTimer = createTimer();
	const sleepTimer = createTimer();

	// Side selections
	let feedingSide = $state<FeedingSide>('left');
	let sleepSide = $state<HeadSide>('back');

	let selectedBaby = $derived(babies.find((b) => b.id === selectedBabyId) ?? null);

	// Load everything on mount
	$effect(() => {
		const userId = session.user?.id;
		if (!userId) return;

		(async () => {
			try {
				const families = await getUserFamilies(supabase);
				if (families.length === 0) {
					pageLoading = false;
					return;
				}
				familyId = families[0].id;

				babies = await listBabies(supabase, familyId);
				if (babies.length > 0) {
					selectedBabyId = babies[0].id;
					await loadSessionsForBaby(babies[0].id);
				}
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load data';
			} finally {
				pageLoading = false;
			}
		})();
	});

	// Reload when selected baby changes
	$effect(() => {
		if (!selectedBabyId) return;
		loadSessionsForBaby(selectedBabyId);
	});

	// Realtime subscription
	$effect(() => {
		if (!selectedBabyId) return;

		const channel = supabase
			.channel(`sessions:${selectedBabyId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'feeding_sessions', filter: `baby_id=eq.${selectedBabyId}` },
				() => { loadSessionsForBaby(selectedBabyId!); }
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'sleep_sessions', filter: `baby_id=eq.${selectedBabyId}` },
				() => { loadSessionsForBaby(selectedBabyId!); }
			)
			.subscribe();

		return () => { supabase.removeChannel(channel); };
	});

	async function loadSessionsForBaby(babyId: string) {
		const [activeFeeding, activeSleep, feedingSessions, sleepSessions] = await Promise.all([
			getActiveFeedingSession(supabase, babyId),
			getActiveSleepSession(supabase, babyId),
			listFeedingSessions(supabase, babyId, 20),
			listSleepSessions(supabase, babyId, 20)
		]);

		activeFeedingSession = activeFeeding;
		activeSleepSession = activeSleep;

		// Re-attach timers to in-progress sessions
		if (activeFeeding && !feedingTimer.running) {
			feedingTimer.reset();
		}

		// Build unified session list, sorted by startedAt desc
		const combined = [
			...feedingSessions.map((s) => ({
				id: s.id,
				type: 'feeding' as const,
				side: s.side,
				startedAt: new Date(s.started_at),
				endedAt: s.ended_at ? new Date(s.ended_at) : null,
				durationSeconds: s.duration_seconds,
				note: s.note
			})),
			...sleepSessions.map((s) => ({
				id: s.id,
				type: 'sleep' as const,
				side: s.side,
				startedAt: new Date(s.started_at),
				endedAt: s.ended_at ? new Date(s.ended_at) : null,
				durationSeconds: s.duration_seconds,
				note: s.note
			}))
		].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

		recentSessions = combined.slice(0, 20);
	}

	async function handleStartFeeding(side: FeedingSide) {
		if (!selectedBabyId || !familyId) return;
		feedingSide = side;
		feedingTimer.start();
		try {
			activeFeedingSession = await startFeeding(supabase, {
				baby_id: selectedBabyId,
				family_id: familyId,
				side,
				started_at: feedingTimer.startedAt!.toISOString()
			});
		} catch (e) {
			feedingTimer.reset();
			error = e instanceof Error ? e.message : 'Failed to start feeding';
		}
	}

	async function handleStopFeeding() {
		if (!activeFeedingSession) return;
		const result = feedingTimer.stop();
		if (!result) return;
		try {
			await stopFeeding(supabase, activeFeedingSession.id, result.endedAt);
			activeFeedingSession = null;
			await loadSessionsForBaby(selectedBabyId!);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop feeding';
		}
	}

	async function handleStartSleep(side: HeadSide) {
		if (!selectedBabyId || !familyId) return;
		sleepSide = side;
		sleepTimer.start();
		try {
			activeSleepSession = await startSleep(supabase, {
				baby_id: selectedBabyId,
				family_id: familyId,
				side,
				started_at: sleepTimer.startedAt!.toISOString()
			});
		} catch (e) {
			sleepTimer.reset();
			error = e instanceof Error ? e.message : 'Failed to start sleep';
		}
	}

	async function handleStopSleep() {
		if (!activeSleepSession) return;
		const result = sleepTimer.stop();
		if (!result) return;
		try {
			await stopSleep(supabase, activeSleepSession.id, result.endedAt);
			activeSleepSession = null;
			await loadSessionsForBaby(selectedBabyId!);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop sleep';
		}
	}
</script>

<section class="section">
	<div class="container">
		{#if pageLoading}
			<progress class="progress is-primary" max="100">Loading</progress>

		{:else if error}
			<div class="notification is-danger">
				<button class="delete" onclick={() => (error = null)}></button>
				{error}
			</div>

		{:else if babies.length === 0}
			<div class="has-text-centered py-6">
				<h2 class="title is-4">Welcome to Baby Timer!</h2>
				<p class="subtitle">Add a baby to get started.</p>
				<a href="/app/babies" class="button is-primary">Add Baby</a>
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
						onsidechange={(s) => (feedingSide = s)}
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
						onsidechange={(s) => (sleepSide = s)}
					/>
				</div>
			</div>

			<div class="mt-5">
				<h3 class="title is-5">Recent Sessions</h3>
				<SessionList sessions={recentSessions} />
			</div>
		{/if}
	</div>
</section>
