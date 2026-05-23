<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';
	import { db } from '$lib/db/local';
	import { buildTimerResult } from '$lib/timer/timer-logic';
	import {
		HEAD_SIDES,
		analyzeSleepPositionBalance,
		formatHeadSideLabel,
		getSleepSessionMinutes,
		type SleepPositionBalance
	} from '$lib/sessions/sleep-balance';

	interface DaySummary {
		date: string;
		feedCount: number;
		feedMinutes: number;
		sleepCount: number;
		sleepMinutes: number;
	}

	const session = getContext<SessionStore>(SESSION_KEY);

	let babies = $state<LocalBaby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let familyId = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let summaries = $state<DaySummary[]>([]);
	let sleepBalance = $state<SleepPositionBalance | null>(null);

	const days = Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() - (6 - i));
		return d.toISOString().split('T')[0];
	});

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
		loadStats(selectedBabyId);
	});

	function getLast7Days(): string[] {
		const result = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			result.push(d.toISOString().split('T')[0]);
		}
		return result;
	}

	async function loadStats(babyId: string) {
		loading = true;
		error = null;
		sleepBalance = null;
		try {
			const dayList = getLast7Days();
			const dateRangeStart = new Date(dayList[0] + 'T00:00:00');
			const dateRangeEnd = new Date(dayList[dayList.length - 1] + 'T23:59:59');
			const sleeps = await db.sleep_sessions
				.where('baby_id')
				.equals(babyId)
				.filter((s) => {
					const t = new Date(s.started_at);
					return t >= dateRangeStart && t <= dateRangeEnd;
				})
				.toArray();
			const sleepEntries = sleeps
				.map((s) => {
					const startedAt = new Date(s.started_at);
					const endedAt = s.ended_at ? new Date(s.ended_at) : null;
					const minutes = getSleepSessionMinutes({
						side: s.side,
						startedAt,
						endedAt
					});
					return {
						side: s.side,
						day: startedAt.toISOString().split('T')[0],
						startedAt,
						endedAt,
						minutes
					};
				})
				.filter((s) => s.minutes > 0);
			sleepBalance = analyzeSleepPositionBalance(
				sleepEntries.map((s) => ({
					side: s.side,
					startedAt: s.startedAt,
					endedAt: s.endedAt
				}))
			);
			summaries = await Promise.all(
				dayList.map(async (day) => {
					const dayStart = new Date(day + 'T00:00:00');
					const dayEnd = new Date(day + 'T23:59:59');
					const feedings = await db.feeding_sessions
						.where('baby_id')
						.equals(babyId)
						.filter((s) => {
							const t = new Date(s.started_at);
							return t >= dayStart && t <= dayEnd && s.ended_at !== null;
						})
						.toArray();
					const daySleeps = sleepEntries.filter((s) => s.day === day);
					const feedMinutes = Math.round(
						feedings.reduce(
							(sum, s) =>
								sum +
								buildTimerResult(new Date(s.started_at), new Date(s.ended_at!)).durationSeconds /
									60,
							0
						)
					);
					const sleepMinutes = daySleeps.reduce((sum, s) => sum + s.minutes, 0);
					return {
						date: day,
						feedCount: feedings.length,
						feedMinutes,
						sleepCount: daySleeps.length,
						sleepMinutes
					};
				})
			);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stats';
			sleepBalance = null;
		} finally {
			loading = false;
		}
	}

	function shortDay(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });
	}

	function barHeight(value: number, max: number): number {
		if (max === 0) return 0;
		return Math.round((value / max) * 80);
	}

	let maxFeedMinutes = $derived(Math.max(...summaries.map((s) => s.feedMinutes), 1));
	let maxSleepMinutes = $derived(Math.max(...summaries.map((s) => s.sleepMinutes), 1));
	let totalFeedings = $derived(summaries.reduce((acc, s) => acc + s.feedCount, 0));
	let totalSleepHours = $derived(
		Math.round((summaries.reduce((acc, s) => acc + s.sleepMinutes, 0) / 60) * 10) / 10
	);
	let avgFeedingsPerDay = $derived(
		summaries.length > 0 ? Math.round((totalFeedings / summaries.length) * 10) / 10 : 0
	);
	let sleepPositionBreakdown = $derived.by(() => {
		if (!sleepBalance || sleepBalance.totalMinutes === 0) return [];
		const totalMinutes = sleepBalance.totalMinutes;
		const minutesBySide = sleepBalance.minutesBySide;
		return HEAD_SIDES.map((side) => ({
			side,
			minutes: minutesBySide[side]
		}))
			.filter(({ minutes }) => minutes > 0)
			.sort((a, b) => b.minutes - a.minutes)
			.map(({ side, minutes }) => ({
				side,
				minutes,
				percent: Math.round((minutes / totalMinutes) * 100)
			}));
	});
</script>

<section class="section">
	<div class="container">
		<h1 class="title">Stats</h1>
		<p class="subtitle">Last 7 days</p>

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

		{#if loading}
			<progress class="progress is-primary" max="100">Loading</progress>
		{:else if summaries.length > 0}
			<div class="columns mb-5">
				<div class="column">
					<div class="box has-text-centered">
						<p class="heading">Total Feedings</p>
						<p class="title">{totalFeedings}</p>
					</div>
				</div>
				<div class="column">
					<div class="box has-text-centered">
						<p class="heading">Avg/Day</p>
						<p class="title">{avgFeedingsPerDay}</p>
					</div>
				</div>
				<div class="column">
					<div class="box has-text-centered">
						<p class="heading">Total Sleep</p>
						<p class="title">{totalSleepHours}h</p>
					</div>
				</div>
			</div>

			<div class="box mb-4">
				<h3 class="subtitle is-6 mb-3">Sleep position balance (last 7 days)</h3>
				{#if sleepBalance && sleepBalance.totalMinutes > 0}
					<div class="tags mb-3">
						{#each sleepPositionBreakdown as position}
							<span class="tag is-light"
								>{formatHeadSideLabel(position.side)}: {position.minutes} min ({position.percent}%)</span
							>
						{/each}
					</div>
					{#if sleepBalance.needsWarning && sleepBalance.message}
						<div class="notification is-warning is-light">{sleepBalance.message}</div>
					{:else}
						<div class="notification is-success is-light">
							Sleep positions look balanced. Keep alternating head direction between sleeps.
						</div>
					{/if}
				{:else}
					<p class="has-text-grey">No completed sleep sessions in the last 7 days yet.</p>
				{/if}
			</div>

			<div class="box mb-4">
				<h3 class="subtitle is-6 mb-3">Feeding time (minutes/day)</h3>
				<svg width="100%" viewBox="0 0 280 110" preserveAspectRatio="xMidYMid meet">
					{#each summaries as s, i}
						<g transform="translate({i * 40 + 10}, 0)">
							<rect
								x="5"
								y={90 - barHeight(s.feedMinutes, maxFeedMinutes)}
								width="25"
								height={barHeight(s.feedMinutes, maxFeedMinutes)}
								fill="hsl(340, 65%, 70%)"
								rx="2"
							/>
							<text x="17" y="105" text-anchor="middle" font-size="9" fill="#888">
								{shortDay(s.date)}
							</text>
							{#if s.feedMinutes > 0}
								<text
									x="17"
									y={86 - barHeight(s.feedMinutes, maxFeedMinutes)}
									text-anchor="middle"
									font-size="8"
									fill="#555"
								>
									{s.feedMinutes}
								</text>
							{/if}
						</g>
					{/each}
				</svg>
			</div>

			<div class="box">
				<h3 class="subtitle is-6 mb-3">Sleep time (minutes/day)</h3>
				<svg width="100%" viewBox="0 0 280 110" preserveAspectRatio="xMidYMid meet">
					{#each summaries as s, i}
						<g transform="translate({i * 40 + 10}, 0)">
							<rect
								x="5"
								y={90 - barHeight(s.sleepMinutes, maxSleepMinutes)}
								width="25"
								height={barHeight(s.sleepMinutes, maxSleepMinutes)}
								fill="hsl(240, 60%, 70%)"
								rx="2"
							/>
							<text x="17" y="105" text-anchor="middle" font-size="9" fill="#888">
								{shortDay(s.date)}
							</text>
							{#if s.sleepMinutes > 0}
								<text
									x="17"
									y={86 - barHeight(s.sleepMinutes, maxSleepMinutes)}
									text-anchor="middle"
									font-size="8"
									fill="#555"
								>
									{s.sleepMinutes}
								</text>
							{/if}
						</g>
					{/each}
				</svg>
			</div>
		{:else}
			<div class="has-text-centered py-6">
				<p class="has-text-grey">No data yet. Start tracking to see stats!</p>
			</div>
		{/if}
	</div>
</section>
