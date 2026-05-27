<script lang="ts">
	import { getContext } from 'svelte';
	import { t } from '@sveltia/i18n';
	import { BABY_STATE_KEY } from '$lib/state/baby.svelte';
	import type { BabyState } from '$lib/state/baby.svelte';
	import { db } from '$lib/db/local';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import StackedBar from '$lib/components/charts/StackedBar.svelte';
	import Timeline from '$lib/components/charts/Timeline.svelte';
	import {
		computeDailyTotals,
		computeFeedingInsights,
		computeSleepInsights,
		buildTimelineSegments,
		formatMinutes,
		type DailyTotals,
		type FeedingInsights,
		type SleepInsights,
		type TimelineSegment
	} from '$lib/insights/metrics';
	import {
		analyzeSleepPositionBalance,
		formatHeadSideLabel,
		HEAD_SIDES,
		type SleepPositionBalance
	} from '$lib/sessions/sleep-balance';

	const babyState = getContext<BabyState>(BABY_STATE_KEY);

	let activeTab = $state<'overview' | 'feeding' | 'sleep' | 'diaper'>('overview');
	let loading = $state(false);
	let error = $state<string | null>(null);

	let dailyTotals = $state<DailyTotals[]>([]);
	let feedingInsights = $state<FeedingInsights | null>(null);
	let sleepInsights = $state<SleepInsights | null>(null);
	let sleepBalance = $state<SleepPositionBalance | null>(null);
	let todaySegments = $state<TimelineSegment[]>([]);
	let todayDiaperEvents = $state<{ atMs: number; label: string }[]>([]);
	let days = $state<string[]>([]);
	let allDiapers = $state<{ startedAt: Date; hasPoop: boolean; hasPee: boolean }[]>([]);

	function getLast7DayRange(): { start: Date; end: Date; days: string[] } {
		const dayList: string[] = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			dayList.push(d.toISOString().split('T')[0]);
		}
		return {
			start: new Date(dayList[0] + 'T00:00:00'),
			end: new Date(dayList[dayList.length - 1] + 'T23:59:59.999'),
			days: dayList
		};
	}

	function shortDay(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });
	}

	async function loadStats(babyId: string) {
		loading = true;
		error = null;
		try {
			const { start, end, days: dayList } = getLast7DayRange();
			days = dayList;

			const [rawFeedings, rawSleeps, rawPumps, rawDiapers] = await Promise.all([
				db.feeding_sessions
					.where('baby_id')
					.equals(babyId)
					.filter((s) => {
						const t = new Date(s.started_at);
						return t >= start && t <= end;
					})
					.toArray(),
				db.sleep_sessions
					.where('baby_id')
					.equals(babyId)
					.filter((s) => {
						const t = new Date(s.started_at);
						return t >= start && t <= end;
					})
					.toArray(),
				db.breast_pump_sessions
					.where('baby_id')
					.equals(babyId)
					.filter((s) => {
						const t = new Date(s.started_at);
						return t >= start && t <= end;
					})
					.toArray(),
				db.diaper_change_sessions
					.where('baby_id')
					.equals(babyId)
					.filter((s) => {
						const t = new Date(s.started_at);
						return t >= start && t <= end;
					})
					.toArray()
			]);

			const feedings = rawFeedings.map((f) => ({
				id: f.id,
				side: f.side,
				startedAt: new Date(f.started_at),
				endedAt: f.ended_at ? new Date(f.ended_at) : null
			}));

			const sleepSessions = rawSleeps.map((s) => ({
				id: s.id,
				side: s.side,
				startedAt: new Date(s.started_at),
				endedAt: s.ended_at ? new Date(s.ended_at) : null
			}));

			const pumps = rawPumps.map((p) => ({
				id: p.id,
				startedAt: new Date(p.started_at),
				endedAt: p.ended_at ? new Date(p.ended_at) : null,
				yieldLeftMl: p.yield_left_ml,
				yieldRightMl: p.yield_right_ml
			}));

			const diapers = rawDiapers.map((d) => ({
				id: d.id,
				startedAt: new Date(d.started_at),
				hasPoop: d.has_poop,
				hasPee: d.has_pee
			}));

			allDiapers = diapers;

			dailyTotals = computeDailyTotals(feedings, sleepSessions, pumps, diapers, [
				dayList[0],
				dayList[dayList.length - 1]
			]);

			feedingInsights = computeFeedingInsights(feedings);
			sleepInsights = computeSleepInsights(sleepSessions);

			sleepBalance = analyzeSleepPositionBalance(
				sleepSessions.map((s) => ({
					side: s.side,
					startedAt: s.startedAt,
					endedAt: s.endedAt
				}))
			);

			const todayIso = dayList[dayList.length - 1];
			const todayStart = new Date(todayIso + 'T00:00:00');
			const todayEnd = new Date(todayIso + 'T23:59:59.999');

			todaySegments = buildTimelineSegments(feedings, sleepSessions, pumps, todayStart, todayEnd);

			todayDiaperEvents = diapers
				.filter((d) => {
					const iso = d.startedAt.toISOString().split('T')[0];
					return iso === todayIso;
				})
				.map((d) => ({
					atMs: d.startedAt.getTime(),
					label: `Diaper · ${d.hasPoop && d.hasPee ? 'Poop+Pee' : d.hasPoop ? 'Poop' : 'Pee'}`
				}));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stats';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const babyId = babyState.selectedBabyId;
		if (babyId) loadStats(babyId);
	});

	let feedingBarData = $derived(
		dailyTotals.map((d) => ({
			label: shortDay(d.date),
			value: Math.round(d.feedingMinutes)
		}))
	);

	let sleepBarData = $derived(
		dailyTotals.map((d) => ({
			label: shortDay(d.date),
			value: Math.round(d.sleepMinutes)
		}))
	);

	let diaperBarData = $derived(
		dailyTotals.map((d) => ({
			label: shortDay(d.date),
			value: d.diaperCount
		}))
	);

	let totalFeeds = $derived(dailyTotals.reduce((acc, d) => acc + d.feedingCount, 0));
	let avgFeedsPerDay = $derived(
		dailyTotals.length > 0 ? Math.round((totalFeeds / dailyTotals.length) * 10) / 10 : 0
	);
	let totalSleepHours = $derived(
		Math.round((dailyTotals.reduce((acc, d) => acc + d.sleepMinutes, 0) / 60) * 10) / 10
	);
	let totalDiapers = $derived(dailyTotals.reduce((acc, d) => acc + d.diaperCount, 0));
	let totalWet = $derived(dailyTotals.reduce((acc, d) => acc + d.wetCount, 0));
	let totalPoop = $derived(dailyTotals.reduce((acc, d) => acc + d.poopCount, 0));

	let last24hDiaperStats = $derived.by(() => {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const recent = allDiapers.filter((d) => d.startedAt >= cutoff);
		return {
			total: recent.length,
			wet: recent.filter((d) => d.hasPee).length,
			poop: recent.filter((d) => d.hasPoop).length
		};
	});

	const headSideKeyMap: Record<string, string> = {
		left: 'track.options.headLeft',
		right: 'track.options.headRight',
		back: 'track.options.back',
		tummy: 'track.options.tummy',
		side: 'track.options.side'
	};

	let sleepPositionSegments = $derived.by(() => {
		if (!sleepBalance || sleepBalance.totalMinutes === 0) return [];
		return HEAD_SIDES.filter((side) => sleepBalance!.minutesBySide[side] > 0).map((side) => ({
			label: formatHeadSideLabel(side),
			value: Math.round(sleepBalance!.minutesBySide[side]),
			color:
				side === 'left'
					? 'var(--sleep-solid)'
					: side === 'right'
						? 'hsl(240 60% 55%)'
						: side === 'back'
							? 'hsl(200 60% 55%)'
							: side === 'tummy'
								? 'hsl(20 70% 55%)'
								: 'hsl(160 50% 50%)'
		}));
	});

	let todayStart = $derived(
		days.length > 0 ? new Date(days[days.length - 1] + 'T00:00:00') : new Date()
	);
	let todayEnd = $derived(
		days.length > 0 ? new Date(days[days.length - 1] + 'T23:59:59.999') : new Date()
	);
</script>

<div class="page">
	<h1 class="page-title">{t('stats.title')}</h1>
	<p class="page-subtitle">{t('stats.last7Days')}</p>

	<div class="tab-bar" role="tablist">
		{#each ['overview', 'feeding', 'sleep', 'diaper'] as tab}
			<button
				role="tab"
				aria-selected={activeTab === tab}
				onclick={() => (activeTab = tab as typeof activeTab)}
			>
				{t(`stats.tabs.${tab}`)}
			</button>
		{/each}
	</div>

	{#if !babyState.selectedBabyId}
		<p class="empty-msg">{t('stats.selectBaby')}</p>
	{:else if loading}
		<p class="loading-msg">{t('common.loadingEllipsis')}</p>
	{:else if error}
		<p class="error-msg" role="alert">{error}</p>
	{:else}
		{#if activeTab === 'overview'}
			<div class="stat-grid">
				<div class="stat-card">
					<span class="stat-value">{totalFeeds}</span>
					<span class="stat-label">{t('stats.overview.totalFeeds')}</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{avgFeedsPerDay}</span>
					<span class="stat-label">{t('stats.overview.avgPerDay')}</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{totalSleepHours}h</span>
					<span class="stat-label">{t('stats.overview.totalSleep')}</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{totalDiapers}</span>
					<span class="stat-label">{t('stats.overview.diaperChanges')}</span>
				</div>
			</div>

			<div class="chart-card">
				<h2 class="chart-title">{t('stats.overview.todayTimeline')}</h2>
				{#if todaySegments.length === 0 && todayDiaperEvents.length === 0}
					<p class="empty-msg" style="padding: var(--space-3) 0">
						{t('stats.overview.noSessions')}
					</p>
				{:else}
					<Timeline
						segments={todaySegments}
						dayStart={todayStart}
						dayEnd={todayEnd}
						diaperEvents={todayDiaperEvents}
					/>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'feeding'}
			<div class="chart-card">
				<h2 class="chart-title">{t('stats.feeding.chartTitle')}</h2>
				<BarChart data={feedingBarData} color="var(--feed-solid)" unit="min" />
			</div>

			{#if feedingInsights}
				<div class="stat-grid">
					<div class="stat-card">
						<span class="stat-value">{feedingInsights.totalFeeds}</span>
						<span class="stat-label">{t('stats.feeding.totalFeeds')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{feedingInsights.avgFeedsPerDay.toFixed(1)}</span>
						<span class="stat-label">{t('stats.feeding.avgPerDay')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{formatMinutes(feedingInsights.avgDurationMinutes)}</span>
						<span class="stat-label">{t('stats.feeding.avgDuration')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">
							{feedingInsights.avgGapMinutes !== null
								? formatMinutes(feedingInsights.avgGapMinutes)
								: '—'}
						</span>
						<span class="stat-label">{t('stats.feeding.avgGap')}</span>
					</div>
				</div>

				{#if feedingInsights.totalFeeds > 0}
					<div class="chart-card">
						<h2 class="chart-title">{t('stats.feeding.sideBalance')}</h2>
						<StackedBar
							segments={[
								{
									label: t('stats.feeding.left'),
									value: Math.round(feedingInsights.leftPercent),
									color: 'var(--feed-solid)'
								},
								{
									label: t('stats.feeding.right'),
									value: Math.round(feedingInsights.rightPercent),
									color: 'hsl(340 65% 55%)'
								},
								{
									label: t('stats.feeding.both'),
									value: Math.round(feedingInsights.bothPercent),
									color: 'hsl(340 40% 70%)'
								}
							]}
							total={100}
							showLabels={true}
						/>
					</div>
				{/if}
			{/if}
		{/if}

		{#if activeTab === 'sleep'}
			<div class="chart-card">
				<h2 class="chart-title">{t('stats.sleep.chartTitle')}</h2>
				<BarChart data={sleepBarData} color="var(--sleep-solid)" unit="min" />
			</div>

			{#if sleepInsights}
				<div class="stat-grid">
					<div class="stat-card">
						<span class="stat-value">{formatMinutes(sleepInsights.totalMinutes)}</span>
						<span class="stat-label">{t('stats.sleep.totalSleep')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{formatMinutes(sleepInsights.avgMinutesPerDay)}</span>
						<span class="stat-label">{t('stats.sleep.avgPerDay')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{formatMinutes(sleepInsights.longestStretchMinutes)}</span>
						<span class="stat-label">{t('stats.sleep.longestStretch')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{sleepInsights.stretchCount}</span>
						<span class="stat-label">{t('stats.sleep.sessions')}</span>
					</div>
				</div>
			{/if}

			<div class="chart-card">
				<h2 class="chart-title">{t('stats.sleep.positionBalance')}</h2>
				{#if sleepBalance && sleepBalance.totalMinutes > 0}
					<StackedBar segments={sleepPositionSegments} showLabels={true} />
					{#if sleepBalance.needsWarning && sleepBalance.dominantSide}
						<div class="warning-box">
							{t('stats.sleep.positionWarning', {
								values: {
									side: t(headSideKeyMap[sleepBalance.dominantSide]),
									percent: sleepBalance.dominantPercent
								}
							})}
							{#if sleepBalance.dominantSide === 'tummy'}
								{t('stats.sleep.tummyAddendum')}
							{/if}
						</div>
					{:else if !sleepBalance.needsWarning}
						<div class="ok-box">
							{t('stats.sleep.balanced')}
						</div>
					{/if}
				{:else}
					<p class="empty-msg" style="padding: var(--space-3) 0">
						{t('stats.sleep.noSessions')}
					</p>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'diaper'}
			<div class="chart-card">
				<h2 class="chart-title">{t('stats.diaper.last24h')}</h2>
				<div class="stat-grid stat-grid-3" style="margin-bottom: 0">
					<div class="stat-card">
						<span class="stat-value">{last24hDiaperStats.total}</span>
						<span class="stat-label">{t('stats.diaper.totalLast24h')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{last24hDiaperStats.wet}</span>
						<span class="stat-label">{t('stats.diaper.wetLast24h')}</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{last24hDiaperStats.poop}</span>
						<span class="stat-label">{t('stats.diaper.poopLast24h')}</span>
					</div>
				</div>
			</div>

			<div class="chart-card">
				<h2 class="chart-title">{t('stats.diaper.chartTitle')}</h2>
				<BarChart data={diaperBarData} color="var(--diaper-solid)" showValues={true} />
			</div>

			<div class="stat-grid">
				<div class="stat-card">
					<span class="stat-value">{totalDiapers}</span>
					<span class="stat-label">{t('stats.diaper.totalChanges')}</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">
						{dailyTotals.length > 0 ? (totalDiapers / dailyTotals.length).toFixed(1) : '0'}
					</span>
					<span class="stat-label">{t('stats.diaper.avgPerDay')}</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{totalPoop}</span>
					<span class="stat-label">{t('stats.diaper.poop')}</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{totalWet}</span>
					<span class="stat-label">{t('stats.diaper.wet')}</span>
				</div>
			</div>
		{/if}
	{/if}
</div>

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
		margin: 0 0 var(--space-1);
	}
	.page-subtitle {
		font-size: var(--font-size-2);
		color: var(--text-2);
		margin: 0 0 var(--space-4);
	}
	.tab-bar {
		display: flex;
		border-bottom: 2px solid var(--border);
		margin-bottom: var(--space-5);
		gap: 0;
	}
	.tab-bar button {
		flex: 1;
		padding: var(--space-3) var(--space-2);
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		background: transparent;
		font-family: inherit;
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-2);
		color: var(--text-2);
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}
	.tab-bar button[aria-selected='true'] {
		color: var(--brand);
		border-bottom-color: var(--brand);
	}
	.stat-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		margin-bottom: var(--space-5);
	}
	.stat-grid-3 {
		grid-template-columns: repeat(3, 1fr);
	}
	.stat-card {
		background: var(--surface-2);
		border-radius: var(--radius-3);
		padding: var(--space-4);
		text-align: center;
	}
	.stat-value {
		font-size: var(--font-size-6);
		font-weight: var(--fw-bold);
		color: var(--text);
		font-variant-numeric: tabular-nums;
		display: block;
	}
	.stat-label {
		font-size: var(--font-size-1);
		color: var(--text-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: var(--space-1);
		display: block;
	}
	.chart-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
		overflow: hidden;
	}
	.chart-title {
		font-size: var(--font-size-3);
		font-weight: var(--fw-semibold);
		color: var(--text);
		margin: 0 0 var(--space-3);
	}
	.warning-box {
		background: hsl(45 100% 95%);
		border: 1px solid hsl(45 100% 80%);
		border-radius: var(--radius-2);
		padding: var(--space-3) var(--space-4);
		color: hsl(45 80% 30%);
		font-size: var(--font-size-2);
		margin-top: var(--space-3);
	}
	.ok-box {
		background: hsl(140 60% 95%);
		border: 1px solid hsl(140 60% 80%);
		border-radius: var(--radius-2);
		padding: var(--space-3) var(--space-4);
		color: hsl(140 60% 25%);
		font-size: var(--font-size-2);
		margin-top: var(--space-3);
	}
	.loading-msg,
	.empty-msg {
		color: var(--text-2);
		text-align: center;
		padding: var(--space-6) 0;
	}
	.error-msg {
		color: var(--danger);
		font-size: var(--font-size-2);
	}
</style>
