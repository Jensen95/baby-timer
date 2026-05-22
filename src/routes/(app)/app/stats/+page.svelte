<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { listBabies } from '$lib/db/babies';
	import { getUserFamilies } from '$lib/db/family';
	import type { Tables } from '$lib/db/database.types';

	type Baby = Tables<'babies'>;

	interface DaySummary {
		date: string;
		feedCount: number;
		feedMinutes: number;
		sleepCount: number;
		sleepMinutes: number;
	}

	const session = getContext<SessionStore>(SESSION_KEY);

	let babies = $state<Baby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let summaries = $state<DaySummary[]>([]);

	// Last 7 days
	const days = Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() - (6 - i));
		return d.toISOString().split('T')[0];
	});

	$effect(() => {
		const userId = session.user?.id;
		if (!userId) return;

		(async () => {
			try {
				const families = await getUserFamilies(supabase);
				if (families.length === 0) { loading = false; return; }

				babies = await listBabies(supabase, families[0].id);
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
		loadSummaries(selectedBabyId);
	});

	async function loadSummaries(babyId: string) {
		loading = true;
		error = null;
		try {
			const results = await Promise.all(
				days.map(async (day) => {
					const { data, error: rpcError } = await (supabase as any).rpc('daily_summary', {
						p_baby_id: babyId,
						p_day: day
					});
					if (rpcError) throw rpcError;
					const row = Array.isArray(data) && data.length > 0 ? data[0] : { feed_count: 0, feed_minutes: 0, sleep_count: 0, sleep_minutes: 0 };
					return {
						date: day,
						feedCount: row.feed_count ?? 0,
						feedMinutes: row.feed_minutes ?? 0,
						sleepCount: row.sleep_count ?? 0,
						sleepMinutes: row.sleep_minutes ?? 0
					};
				})
			);
			summaries = results;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stats';
		} finally {
			loading = false;
		}
	}

	function shortDay(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });
	}

	// Bar chart helpers
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
		summaries.length > 0
			? Math.round((totalFeedings / summaries.length) * 10) / 10
			: 0
	);
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
			<!-- Summary cards -->
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

			<!-- Feeding minutes bar chart -->
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
								fill="hsl(217, 71%, 53%)"
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

			<!-- Sleep minutes bar chart -->
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
								fill="hsl(141, 53%, 53%)"
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
