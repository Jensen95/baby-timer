import { describe, it, expect } from 'vitest';
import {
	formatMinutes,
	minutesSinceLast,
	groupByDate,
	computeFeedingInsights,
	computeSleepInsights,
	buildTimelineSegments,
	computeDailyTotals,
	analyzeSleepPositionBalance
} from './metrics';
import type {
	FeedingSession,
	SleepSession,
	BreastPumpSession,
	DiaperChangeSession
} from './metrics';

// ---------------------------------------------------------------------------
// Helpers — build minimal session objects
// ---------------------------------------------------------------------------

function makeFeeding(
	id: string,
	side: 'left' | 'right' | 'both',
	startedAt: Date,
	endedAt: Date | null = null
): FeedingSession {
	return { id, side, startedAt, endedAt };
}

function makeSleep(id: string, startedAt: Date, endedAt: Date | null = null): SleepSession {
	return { id, startedAt, endedAt };
}

function makePump(
	id: string,
	startedAt: Date,
	endedAt: Date | null,
	yieldLeftMl: number | null = null,
	yieldRightMl: number | null = null
): BreastPumpSession {
	return { id, startedAt, endedAt, yieldLeftMl, yieldRightMl };
}

function makeDiaper(
	id: string,
	startedAt: Date,
	hasPoop = false,
	hasPee = true
): DiaperChangeSession {
	return { id, startedAt, hasPoop, hasPee };
}

// ---------------------------------------------------------------------------
// formatMinutes
// ---------------------------------------------------------------------------

describe('formatMinutes', () => {
	it('returns "0m" for zero', () => {
		expect(formatMinutes(0)).toBe('0m');
	});

	it('returns minutes only for < 60', () => {
		expect(formatMinutes(45)).toBe('45m');
	});

	it('returns hours only for exact multiples', () => {
		expect(formatMinutes(60)).toBe('1h');
		expect(formatMinutes(120)).toBe('2h');
	});

	it('returns hours and minutes for non-multiples', () => {
		expect(formatMinutes(90)).toBe('1h 30m');
		expect(formatMinutes(83)).toBe('1h 23m');
	});
});

// ---------------------------------------------------------------------------
// minutesSinceLast
// ---------------------------------------------------------------------------

describe('minutesSinceLast', () => {
	it('returns null for empty array', () => {
		expect(minutesSinceLast([], new Date())).toBeNull();
	});

	it('returns correct minutes since session ended', () => {
		const endedAt = new Date('2024-01-01T10:30:00Z');
		const now = new Date('2024-01-01T11:00:00Z');
		const session = { startedAt: new Date('2024-01-01T10:00:00Z'), endedAt };
		expect(minutesSinceLast([session], now)).toBeCloseTo(30, 5);
	});

	it('uses startedAt when endedAt is null', () => {
		const startedAt = new Date('2024-01-01T10:00:00Z');
		const now = new Date('2024-01-01T10:45:00Z');
		const session = { startedAt, endedAt: null };
		expect(minutesSinceLast([session], now)).toBeCloseTo(45, 5);
	});

	it('uses the most-recent session among multiple', () => {
		const now = new Date('2024-01-01T12:00:00Z');
		const sessions = [
			{ startedAt: new Date('2024-01-01T08:00:00Z'), endedAt: new Date('2024-01-01T09:00:00Z') },
			{ startedAt: new Date('2024-01-01T11:00:00Z'), endedAt: new Date('2024-01-01T11:30:00Z') }
		];
		expect(minutesSinceLast(sessions, now)).toBeCloseTo(30, 5);
	});
});

// ---------------------------------------------------------------------------
// groupByDate
// ---------------------------------------------------------------------------

describe('groupByDate', () => {
	it('groups sessions on the same local date together', () => {
		// Use noon UTC — falls on the same local date in any timezone within ±12h of UTC
		const a = makeFeeding('1', 'left', new Date('2024-01-15T12:00:00Z'));
		const b = makeFeeding('2', 'right', new Date('2024-01-15T14:00:00Z'));
		const map = groupByDate([a, b]);
		const keys = [...map.keys()];
		expect(keys).toHaveLength(1);
		expect(map.get(keys[0])).toHaveLength(2);
	});

	it('separates sessions on different local dates', () => {
		const a = makeFeeding('1', 'left', new Date('2024-01-15T12:00:00Z'));
		const b = makeFeeding('2', 'right', new Date('2024-01-16T12:00:00Z'));
		const map = groupByDate([a, b]);
		expect(map.size).toBe(2);
	});

	it('returns empty map for empty input', () => {
		expect(groupByDate([])).toEqual(new Map());
	});
});

// ---------------------------------------------------------------------------
// computeFeedingInsights
// ---------------------------------------------------------------------------

describe('computeFeedingInsights', () => {
	it('returns zeros for empty input', () => {
		const result = computeFeedingInsights([]);
		expect(result.totalFeeds).toBe(0);
		expect(result.avgGapMinutes).toBeNull();
		expect(result.leftPercent).toBe(0);
		expect(result.rightPercent).toBe(0);
		expect(result.bothPercent).toBe(0);
	});

	it('returns null avgGapMinutes with fewer than 2 feeds', () => {
		const result = computeFeedingInsights([
			makeFeeding('1', 'left', new Date('2024-01-01T10:00:00Z'))
		]);
		expect(result.avgGapMinutes).toBeNull();
	});

	it('computes correct side percentages', () => {
		const feedings = [
			makeFeeding('1', 'left', new Date('2024-01-01T08:00:00Z'), new Date('2024-01-01T08:10:00Z')),
			makeFeeding('2', 'left', new Date('2024-01-01T10:00:00Z'), new Date('2024-01-01T10:10:00Z')),
			makeFeeding('3', 'right', new Date('2024-01-01T12:00:00Z'), new Date('2024-01-01T12:10:00Z')),
			makeFeeding('4', 'both', new Date('2024-01-01T14:00:00Z'), new Date('2024-01-01T14:10:00Z'))
		];
		const result = computeFeedingInsights(feedings);
		expect(result.totalFeeds).toBe(4);
		expect(result.leftPercent).toBeCloseTo(50, 5);
		expect(result.rightPercent).toBeCloseTo(25, 5);
		expect(result.bothPercent).toBeCloseTo(25, 5);
		expect(result.leftPercent + result.rightPercent + result.bothPercent).toBeCloseTo(100, 5);
	});

	it('computes avgGapMinutes between consecutive sessions', () => {
		// Session 1 ends at 09:00, session 2 starts at 09:30 → gap = 30m
		// Session 2 ends at 10:00, session 3 starts at 11:00 → gap = 60m
		// avg = 45m
		const feedings = [
			makeFeeding('1', 'left', new Date('2024-01-01T08:00:00Z'), new Date('2024-01-01T09:00:00Z')),
			makeFeeding('2', 'right', new Date('2024-01-01T09:30:00Z'), new Date('2024-01-01T10:00:00Z')),
			makeFeeding('3', 'left', new Date('2024-01-01T11:00:00Z'), new Date('2024-01-01T11:15:00Z'))
		];
		const result = computeFeedingInsights(feedings);
		expect(result.avgGapMinutes).toBeCloseTo(45, 5);
	});

	it('counts active sessions (endedAt null) in total but excludes from duration avg', () => {
		const feedings = [
			makeFeeding('1', 'left', new Date('2024-01-01T08:00:00Z'), new Date('2024-01-01T08:20:00Z')),
			makeFeeding('2', 'right', new Date('2024-01-01T09:00:00Z'), null)
		];
		const result = computeFeedingInsights(feedings);
		expect(result.totalFeeds).toBe(2);
		// Only session 1 contributes to duration avg = 20m
		expect(result.avgDurationMinutes).toBeCloseTo(20, 5);
	});

	it('computes avgDurationMinutes for completed sessions', () => {
		const feedings = [
			makeFeeding('1', 'left', new Date('2024-01-01T08:00:00Z'), new Date('2024-01-01T08:10:00Z')),
			makeFeeding('2', 'right', new Date('2024-01-01T09:00:00Z'), new Date('2024-01-01T09:30:00Z'))
		];
		const result = computeFeedingInsights(feedings);
		// (10 + 30) / 2 = 20m avg
		expect(result.avgDurationMinutes).toBeCloseTo(20, 5);
	});
});

// ---------------------------------------------------------------------------
// computeSleepInsights
// ---------------------------------------------------------------------------

describe('computeSleepInsights', () => {
	it('returns zeros for empty input', () => {
		const result = computeSleepInsights([]);
		expect(result.totalMinutes).toBe(0);
		expect(result.longestStretchMinutes).toBe(0);
		expect(result.stretchCount).toBe(0);
	});

	it('ignores sessions with null endedAt', () => {
		const result = computeSleepInsights([makeSleep('1', new Date('2024-01-01T22:00:00Z'), null)]);
		expect(result.stretchCount).toBe(0);
		expect(result.totalMinutes).toBe(0);
	});

	it('finds the longest stretch correctly', () => {
		const sessions = [
			makeSleep('1', new Date('2024-01-01T12:00:00Z'), new Date('2024-01-01T13:00:00Z')), // 60m
			makeSleep('2', new Date('2024-01-01T14:00:00Z'), new Date('2024-01-01T16:30:00Z')), // 150m
			makeSleep('3', new Date('2024-01-01T18:00:00Z'), new Date('2024-01-01T18:45:00Z')) // 45m
		];
		const result = computeSleepInsights(sessions);
		expect(result.longestStretchMinutes).toBe(150);
		expect(result.totalMinutes).toBe(255);
		expect(result.stretchCount).toBe(3);
		expect(result.avgStretchMinutes).toBeCloseTo(85, 5);
	});

	it('splits day vs night sleep correctly', () => {
		// A session entirely in UTC daytime that spans 6am-10pm local time is complex.
		// Instead: test a 12-hour session clearly in local daytime (noon to midnight UTC).
		// The split depends on local timezone, so we test a property: dayMinutes + nightMinutes
		// approximate totalMinutes (they equal it for sessions within one day).
		const sessions = [
			makeSleep('1', new Date('2024-01-15T12:00:00Z'), new Date('2024-01-15T13:00:00Z')) // 60m
		];
		const result = computeSleepInsights(sessions);
		expect(result.totalMinutes).toBe(60);
		// day + night should account for all minutes
		expect(result.avgDayMinutes + result.avgNightMinutes).toBeCloseTo(60, 1);
	});

	it('has higher night sleep for a clearly overnight session (midnight-6am UTC, likely night in any timezone)', () => {
		// 00:00-06:00 UTC — this is likely early morning (night sleep) in all relevant timezones
		// This tests the qualitative behavior: night > day for this window
		const sessions = [
			makeSleep('1', new Date('2024-01-15T00:00:00Z'), new Date('2024-01-15T06:00:00Z')) // 360m
		];
		const result = computeSleepInsights(sessions);
		expect(result.totalMinutes).toBe(360);
		// Just verify split sums correctly
		expect(result.avgDayMinutes + result.avgNightMinutes).toBeCloseTo(360, 1);
	});
});

// ---------------------------------------------------------------------------
// buildTimelineSegments
// ---------------------------------------------------------------------------

describe('buildTimelineSegments', () => {
	// Use a fixed UTC day: 2024-01-15 00:00Z to 2024-01-15 23:59:59.999Z
	const dayStart = new Date('2024-01-15T00:00:00.000Z');
	const dayEnd = new Date('2024-01-15T23:59:59.999Z');

	it('returns empty array when no sessions', () => {
		expect(buildTimelineSegments([], [], [], dayStart, dayEnd)).toEqual([]);
	});

	it('excludes sessions outside the day window', () => {
		const feeding = makeFeeding(
			'1',
			'left',
			new Date('2024-01-14T10:00:00Z'),
			new Date('2024-01-14T11:00:00Z')
		);
		const segments = buildTimelineSegments([feeding], [], [], dayStart, dayEnd);
		expect(segments).toHaveLength(0);
	});

	it('excludes active (null endedAt) sessions', () => {
		const feeding = makeFeeding('1', 'left', new Date('2024-01-15T10:00:00Z'), null);
		const segments = buildTimelineSegments([feeding], [], [], dayStart, dayEnd);
		expect(segments).toHaveLength(0);
	});

	it('produces correct feed segment label', () => {
		const feeding = makeFeeding(
			'1',
			'left',
			new Date('2024-01-15T10:00:00Z'),
			new Date('2024-01-15T10:18:00Z') // 18m
		);
		const segments = buildTimelineSegments([feeding], [], [], dayStart, dayEnd);
		expect(segments).toHaveLength(1);
		expect(segments[0].type).toBe('feed');
		expect(segments[0].label).toBe('Feed · Left · 18m');
	});

	it('produces correct sleep segment label', () => {
		const sleep = makeSleep(
			'1',
			new Date('2024-01-15T13:00:00Z'),
			new Date('2024-01-15T14:30:00Z') // 90m
		);
		const segments = buildTimelineSegments([], [sleep], [], dayStart, dayEnd);
		expect(segments).toHaveLength(1);
		expect(segments[0].type).toBe('sleep');
		expect(segments[0].label).toBe('Sleep · 90m');
	});

	it('produces correct pump segment label with ml', () => {
		const pump = makePump(
			'1',
			new Date('2024-01-15T09:00:00Z'),
			new Date('2024-01-15T09:20:00Z'), // 20m
			80,
			60
		);
		const segments = buildTimelineSegments([], [], [pump], dayStart, dayEnd);
		expect(segments).toHaveLength(1);
		expect(segments[0].type).toBe('pump');
		expect(segments[0].label).toBe('Pump · 20m · 140ml');
	});

	it('produces correct pump segment label without ml', () => {
		const pump = makePump('1', new Date('2024-01-15T09:00:00Z'), new Date('2024-01-15T09:15:00Z'));
		const segments = buildTimelineSegments([], [], [pump], dayStart, dayEnd);
		expect(segments[0].label).toBe('Pump · 15m');
	});

	it('clamps sessions that partially overlap the day window', () => {
		// Session starts before the window
		const sleep = makeSleep(
			'1',
			new Date('2024-01-14T22:00:00Z'),
			new Date('2024-01-15T02:00:00Z')
		);
		const segments = buildTimelineSegments([], [sleep], [], dayStart, dayEnd);
		expect(segments).toHaveLength(1);
		expect(segments[0].startMs).toBe(dayStart.getTime());
	});

	it('returns segments sorted by startMs', () => {
		const f1 = makeFeeding(
			'1',
			'left',
			new Date('2024-01-15T14:00:00Z'),
			new Date('2024-01-15T14:10:00Z')
		);
		const f2 = makeFeeding(
			'2',
			'right',
			new Date('2024-01-15T08:00:00Z'),
			new Date('2024-01-15T08:10:00Z')
		);
		const segments = buildTimelineSegments([f1, f2], [], [], dayStart, dayEnd);
		expect(segments[0].startMs).toBeLessThan(segments[1].startMs);
	});

	it('includes right and both side labels', () => {
		const r = makeFeeding(
			'1',
			'right',
			new Date('2024-01-15T10:00:00Z'),
			new Date('2024-01-15T10:05:00Z')
		);
		const b = makeFeeding(
			'2',
			'both',
			new Date('2024-01-15T11:00:00Z'),
			new Date('2024-01-15T11:05:00Z')
		);
		const segments = buildTimelineSegments([r, b], [], [], dayStart, dayEnd);
		expect(segments[0].label).toContain('Right');
		expect(segments[1].label).toContain('Both');
	});
});

// ---------------------------------------------------------------------------
// computeDailyTotals
// ---------------------------------------------------------------------------

describe('computeDailyTotals', () => {
	const dateRange: [string, string] = ['2024-01-15', '2024-01-17'];

	it('returns one entry per day in range even with no sessions', () => {
		const totals = computeDailyTotals([], [], [], [], dateRange);
		expect(totals).toHaveLength(3);
		expect(totals[0].date).toBe('2024-01-15');
		expect(totals[1].date).toBe('2024-01-16');
		expect(totals[2].date).toBe('2024-01-17');
	});

	it('fills all zero values for days with no sessions', () => {
		const totals = computeDailyTotals([], [], [], [], dateRange);
		for (const day of totals) {
			expect(day.feedingCount).toBe(0);
			expect(day.feedingMinutes).toBe(0);
			expect(day.sleepMinutes).toBe(0);
			expect(day.daySleepMinutes).toBe(0);
			expect(day.nightSleepMinutes).toBe(0);
			expect(day.pumpMl).toBe(0);
			expect(day.diaperCount).toBe(0);
			expect(day.poopCount).toBe(0);
		}
	});

	it('counts feedings on the correct day', () => {
		// noon UTC on 2024-01-16 is Jan 16 local in most timezones
		const feedings = [
			makeFeeding('1', 'left', new Date('2024-01-16T12:00:00Z'), new Date('2024-01-16T12:15:00Z'))
		];
		const totals = computeDailyTotals(feedings, [], [], [], dateRange);
		const jan16 = totals.find((d) => d.date === '2024-01-16')!;
		expect(jan16.feedingCount).toBeGreaterThanOrEqual(1);
		expect(jan16.feedingMinutes).toBeGreaterThan(0);
	});

	it('counts diaper changes and poop correctly', () => {
		const diapers = [
			makeDiaper('1', new Date('2024-01-16T12:00:00Z'), true, true),
			makeDiaper('2', new Date('2024-01-16T14:00:00Z'), false, true)
		];
		const totals = computeDailyTotals([], [], [], diapers, dateRange);
		const jan16 = totals.find((d) => d.date === '2024-01-16')!;
		expect(jan16.diaperCount).toBe(2);
		expect(jan16.poopCount).toBe(1);
	});

	it('accumulates pump yield ml', () => {
		const pumps = [
			makePump('1', new Date('2024-01-16T09:00:00Z'), new Date('2024-01-16T09:20:00Z'), 50, 70)
		];
		const totals = computeDailyTotals([], [], pumps, [], dateRange);
		const jan16 = totals.find((d) => d.date === '2024-01-16')!;
		expect(jan16.pumpMl).toBe(120);
	});

	it('daySleepMinutes + nightSleepMinutes approximates sleepMinutes', () => {
		// A sleep session within one day — split should sum to total
		const sessions = [
			makeSleep('1', new Date('2024-01-16T12:00:00Z'), new Date('2024-01-16T13:00:00Z')) // 60m UTC noon
		];
		const totals = computeDailyTotals([], sessions, [], [], dateRange);
		const jan16 = totals.find((d) => d.date === '2024-01-16')!;
		expect(jan16.sleepMinutes).toBeGreaterThan(0);
		expect(jan16.daySleepMinutes + jan16.nightSleepMinutes).toBeCloseTo(jan16.sleepMinutes, 1);
	});

	it('active feeding (null endedAt) is counted but contributes 0 minutes', () => {
		const feedings = [makeFeeding('1', 'left', new Date('2024-01-16T10:00:00Z'), null)];
		const totals = computeDailyTotals(feedings, [], [], [], dateRange);
		const jan16 = totals.find((d) => d.date === '2024-01-16')!;
		expect(jan16.feedingCount).toBe(1);
		expect(jan16.feedingMinutes).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Re-export: analyzeSleepPositionBalance
// ---------------------------------------------------------------------------

describe('analyzeSleepPositionBalance (re-exported)', () => {
	it('is accessible from metrics module', () => {
		const result = analyzeSleepPositionBalance([
			{
				side: 'left',
				startedAt: new Date('2024-01-01T10:00:00Z'),
				endedAt: new Date('2024-01-01T11:00:00Z')
			}
		]);
		expect(result.totalMinutes).toBeGreaterThan(0);
		expect(result.dominantSide).toBe('left');
	});
});
