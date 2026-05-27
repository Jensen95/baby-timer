export { analyzeSleepPositionBalance } from '$lib/sessions/sleep-balance';

export interface FeedingSession {
	id: string;
	side: 'left' | 'right' | 'both';
	startedAt: Date;
	endedAt: Date | null;
}

export interface SleepSession {
	id: string;
	startedAt: Date;
	endedAt: Date | null;
}

export interface BreastPumpSession {
	id: string;
	startedAt: Date;
	endedAt: Date | null;
	yieldLeftMl: number | null;
	yieldRightMl: number | null;
}

export interface DiaperChangeSession {
	id: string;
	startedAt: Date;
	hasPoop: boolean;
	hasPee: boolean;
}

export interface DailyTotals {
	date: string;
	feedingCount: number;
	feedingMinutes: number;
	sleepMinutes: number;
	daySleepMinutes: number;
	nightSleepMinutes: number;
	pumpMl: number;
	diaperCount: number;
	poopCount: number;
	wetCount: number;
}

export interface TimelineSegment {
	type: 'feed' | 'sleep' | 'pump';
	startMs: number;
	endMs: number;
	label: string;
}

export interface FeedingInsights {
	totalFeeds: number;
	avgFeedsPerDay: number;
	avgDurationMinutes: number;
	avgGapMinutes: number | null;
	leftPercent: number;
	rightPercent: number;
	bothPercent: number;
}

export interface SleepInsights {
	totalMinutes: number;
	avgMinutesPerDay: number;
	longestStretchMinutes: number;
	avgStretchMinutes: number;
	stretchCount: number;
	avgDayMinutes: number;
	avgNightMinutes: number;
}

function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function dateFromIso(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
	const result = new Date(d);
	result.setDate(result.getDate() + n);
	return result;
}

function dayStart(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function dayEnd(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function clampMs(startMs: number, endMs: number, windowStart: number, windowEnd: number): number {
	const s = Math.max(startMs, windowStart);
	const e = Math.min(endMs, windowEnd);
	return Math.max(0, e - s);
}

// 6am in ms from midnight
const DAY_SLEEP_START_HOUR = 6;
// 10pm in ms from midnight
const DAY_SLEEP_END_HOUR = 22;

function sleepMinutesInWindow(
	sessionStart: Date,
	sessionEnd: Date,
	windowStartMs: number,
	windowEndMs: number
): number {
	const ms = clampMs(sessionStart.getTime(), sessionEnd.getTime(), windowStartMs, windowEndMs);
	return ms / 60000;
}

export function groupByDate<T extends { startedAt: Date }>(sessions: T[]): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const session of sessions) {
		const key = isoDate(session.startedAt);
		const existing = map.get(key);
		if (existing) {
			existing.push(session);
		} else {
			map.set(key, [session]);
		}
	}
	return map;
}

export function computeDailyTotals(
	feedings: FeedingSession[],
	sleepSessions: SleepSession[],
	pumps: BreastPumpSession[],
	diapers: DiaperChangeSession[],
	dateRange: [string, string]
): DailyTotals[] {
	const [startIso, endIso] = dateRange;
	const startDate = dateFromIso(startIso);
	const endDate = dateFromIso(endIso);

	const days: DailyTotals[] = [];
	let cursor = startDate;
	while (cursor <= endDate) {
		const iso = isoDate(cursor);
		const ds = dayStart(cursor);
		const de = dayEnd(cursor);
		const dsMs = ds.getTime();
		const deMs = de.getTime();
		const daySleepWindowStart = new Date(
			cursor.getFullYear(),
			cursor.getMonth(),
			cursor.getDate(),
			DAY_SLEEP_START_HOUR,
			0,
			0,
			0
		).getTime();
		const daySleepWindowEnd = new Date(
			cursor.getFullYear(),
			cursor.getMonth(),
			cursor.getDate(),
			DAY_SLEEP_END_HOUR,
			0,
			0,
			0
		).getTime();
		const nightWindowStart1 = dsMs;
		const nightWindowEnd1 = daySleepWindowStart;
		const nightWindowStart2 = daySleepWindowEnd;
		const nightWindowEnd2 = deMs;

		let feedingCount = 0;
		let feedingMinutes = 0;
		for (const f of feedings) {
			const fStart = f.startedAt.getTime();
			const fEnd = f.endedAt ? f.endedAt.getTime() : null;
			if (fEnd === null) {
				if (isoDate(f.startedAt) === iso) feedingCount++;
				continue;
			}
			if (fEnd < dsMs || fStart > deMs) continue;
			feedingCount++;
			feedingMinutes += clampMs(fStart, fEnd, dsMs, deMs) / 60000;
		}

		let sleepMinutes = 0;
		let daySleepMinutes = 0;
		let nightSleepMinutes = 0;
		for (const s of sleepSessions) {
			if (!s.endedAt) continue;
			const sStart = s.startedAt.getTime();
			const sEnd = s.endedAt.getTime();
			if (sEnd < dsMs || sStart > deMs) continue;
			const totalMs = clampMs(sStart, sEnd, dsMs, deMs);
			sleepMinutes += totalMs / 60000;
			daySleepMinutes += sleepMinutesInWindow(
				s.startedAt,
				s.endedAt,
				daySleepWindowStart,
				daySleepWindowEnd
			);
			nightSleepMinutes += sleepMinutesInWindow(
				s.startedAt,
				s.endedAt,
				nightWindowStart1,
				nightWindowEnd1
			);
			nightSleepMinutes += sleepMinutesInWindow(
				s.startedAt,
				s.endedAt,
				nightWindowStart2,
				nightWindowEnd2
			);
		}

		let pumpMl = 0;
		for (const p of pumps) {
			if (!p.endedAt) continue;
			const pStart = p.startedAt.getTime();
			const pEnd = p.endedAt.getTime();
			if (pEnd < dsMs || pStart > deMs) continue;
			pumpMl += (p.yieldLeftMl ?? 0) + (p.yieldRightMl ?? 0);
		}

		let diaperCount = 0;
		let poopCount = 0;
		let wetCount = 0;
		for (const d of diapers) {
			const dMs = d.startedAt.getTime();
			if (dMs < dsMs || dMs > deMs) continue;
			diaperCount++;
			if (d.hasPoop) poopCount++;
			if (d.hasPee) wetCount++;
		}

		days.push({
			date: iso,
			feedingCount,
			feedingMinutes,
			sleepMinutes,
			daySleepMinutes,
			nightSleepMinutes,
			pumpMl,
			diaperCount,
			poopCount,
			wetCount
		});

		cursor = addDays(cursor, 1);
	}

	return days;
}

export function buildTimelineSegments(
	feedings: FeedingSession[],
	sleepSessions: SleepSession[],
	pumps: BreastPumpSession[],
	dayStart: Date,
	dayEnd: Date
): TimelineSegment[] {
	const windowStart = dayStart.getTime();
	const windowEnd = dayEnd.getTime();

	const segments: TimelineSegment[] = [];

	for (const f of feedings) {
		if (!f.endedAt) continue;
		const s = Math.max(f.startedAt.getTime(), windowStart);
		const e = Math.min(f.endedAt.getTime(), windowEnd);
		if (s >= e) continue;
		const durationMinutes = Math.round((f.endedAt.getTime() - f.startedAt.getTime()) / 60000);
		const sideLabel = f.side === 'left' ? 'Left' : f.side === 'right' ? 'Right' : 'Both';
		segments.push({
			type: 'feed',
			startMs: s,
			endMs: e,
			label: `Feed · ${sideLabel} · ${durationMinutes}m`
		});
	}

	for (const sl of sleepSessions) {
		if (!sl.endedAt) continue;
		const s = Math.max(sl.startedAt.getTime(), windowStart);
		const e = Math.min(sl.endedAt.getTime(), windowEnd);
		if (s >= e) continue;
		const durationMinutes = Math.round((sl.endedAt.getTime() - sl.startedAt.getTime()) / 60000);
		segments.push({
			type: 'sleep',
			startMs: s,
			endMs: e,
			label: `Sleep · ${durationMinutes}m`
		});
	}

	for (const p of pumps) {
		if (!p.endedAt) continue;
		const s = Math.max(p.startedAt.getTime(), windowStart);
		const e = Math.min(p.endedAt.getTime(), windowEnd);
		if (s >= e) continue;
		const totalMl = (p.yieldLeftMl ?? 0) + (p.yieldRightMl ?? 0);
		const durationMinutes = Math.round((p.endedAt.getTime() - p.startedAt.getTime()) / 60000);
		const mlLabel = totalMl > 0 ? ` · ${totalMl}ml` : '';
		segments.push({
			type: 'pump',
			startMs: s,
			endMs: e,
			label: `Pump · ${durationMinutes}m${mlLabel}`
		});
	}

	segments.sort((a, b) => a.startMs - b.startMs);
	return segments;
}

export function computeFeedingInsights(feedings: FeedingSession[]): FeedingInsights {
	const totalFeeds = feedings.length;

	if (totalFeeds === 0) {
		return {
			totalFeeds: 0,
			avgFeedsPerDay: 0,
			avgDurationMinutes: 0,
			avgGapMinutes: null,
			leftPercent: 0,
			rightPercent: 0,
			bothPercent: 0
		};
	}

	const sorted = [...feedings].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

	const completed = feedings.filter((f) => f.endedAt !== null);
	let avgDurationMinutes = 0;
	if (completed.length > 0) {
		const totalDurationMs = completed.reduce(
			(sum, f) => sum + (f.endedAt!.getTime() - f.startedAt.getTime()),
			0
		);
		avgDurationMinutes = totalDurationMs / completed.length / 60000;
	}

	let avgGapMinutes: number | null = null;
	if (sorted.length >= 2) {
		const gaps: number[] = [];
		for (let i = 1; i < sorted.length; i++) {
			const prev = sorted[i - 1];
			const curr = sorted[i];
			const prevEnd = prev.endedAt ?? prev.startedAt;
			const gapMs = curr.startedAt.getTime() - prevEnd.getTime();
			if (gapMs > 0) gaps.push(gapMs);
		}
		if (gaps.length > 0) {
			avgGapMinutes = gaps.reduce((s, g) => s + g, 0) / gaps.length / 60000;
		}
	}

	const dayCount = (() => {
		if (sorted.length === 0) return 1;
		const firstDay = isoDate(sorted[0].startedAt);
		const lastDay = isoDate(sorted[sorted.length - 1].startedAt);
		if (firstDay === lastDay) return 1;
		const diffMs = dateFromIso(lastDay).getTime() - dateFromIso(firstDay).getTime();
		return Math.max(1, Math.round(diffMs / 86400000) + 1);
	})();

	const leftCount = feedings.filter((f) => f.side === 'left').length;
	const rightCount = feedings.filter((f) => f.side === 'right').length;
	const bothCount = feedings.filter((f) => f.side === 'both').length;

	return {
		totalFeeds,
		avgFeedsPerDay: totalFeeds / dayCount,
		avgDurationMinutes,
		avgGapMinutes,
		leftPercent: (leftCount / totalFeeds) * 100,
		rightPercent: (rightCount / totalFeeds) * 100,
		bothPercent: (bothCount / totalFeeds) * 100
	};
}

export function computeSleepInsights(sleepSessions: SleepSession[]): SleepInsights {
	const completed = sleepSessions.filter((s) => s.endedAt !== null);

	if (completed.length === 0) {
		return {
			totalMinutes: 0,
			avgMinutesPerDay: 0,
			longestStretchMinutes: 0,
			avgStretchMinutes: 0,
			stretchCount: 0,
			avgDayMinutes: 0,
			avgNightMinutes: 0
		};
	}

	const sorted = [...completed].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

	const stretchMinutes = sorted.map((s) =>
		Math.round((s.endedAt!.getTime() - s.startedAt.getTime()) / 60000)
	);

	const totalMinutes = stretchMinutes.reduce((sum, m) => sum + m, 0);
	const longestStretchMinutes = Math.max(...stretchMinutes);
	const avgStretchMinutes = totalMinutes / completed.length;
	const stretchCount = completed.length;

	const firstDay = isoDate(sorted[0].startedAt);
	const lastDay = isoDate(sorted[sorted.length - 1].startedAt);
	const dayCount = (() => {
		if (firstDay === lastDay) return 1;
		const diffMs = dateFromIso(lastDay).getTime() - dateFromIso(firstDay).getTime();
		return Math.max(1, Math.round(diffMs / 86400000) + 1);
	})();

	let totalDayMinutes = 0;
	let totalNightMinutes = 0;

	for (const s of completed) {
		const sStart = s.startedAt;
		const sEnd = s.endedAt!;

		let cursor = dateFromIso(isoDate(sStart));
		const endDate = dateFromIso(isoDate(sEnd));

		while (cursor <= endDate) {
			const daySleepWindowStart = new Date(
				cursor.getFullYear(),
				cursor.getMonth(),
				cursor.getDate(),
				DAY_SLEEP_START_HOUR,
				0,
				0,
				0
			).getTime();
			const daySleepWindowEnd = new Date(
				cursor.getFullYear(),
				cursor.getMonth(),
				cursor.getDate(),
				DAY_SLEEP_END_HOUR,
				0,
				0,
				0
			).getTime();
			const nightWindowStart1 = new Date(
				cursor.getFullYear(),
				cursor.getMonth(),
				cursor.getDate(),
				0,
				0,
				0,
				0
			).getTime();
			const nightWindowEnd1 = daySleepWindowStart;
			const nightWindowStart2 = daySleepWindowEnd;
			const nightWindowEnd2 = new Date(
				cursor.getFullYear(),
				cursor.getMonth(),
				cursor.getDate(),
				23,
				59,
				59,
				999
			).getTime();

			totalDayMinutes += sleepMinutesInWindow(sStart, sEnd, daySleepWindowStart, daySleepWindowEnd);
			totalNightMinutes += sleepMinutesInWindow(sStart, sEnd, nightWindowStart1, nightWindowEnd1);
			totalNightMinutes += sleepMinutesInWindow(sStart, sEnd, nightWindowStart2, nightWindowEnd2);

			cursor = addDays(cursor, 1);
		}
	}

	return {
		totalMinutes,
		avgMinutesPerDay: totalMinutes / dayCount,
		longestStretchMinutes,
		avgStretchMinutes,
		stretchCount,
		avgDayMinutes: totalDayMinutes / dayCount,
		avgNightMinutes: totalNightMinutes / dayCount
	};
}

export function minutesSinceLast(
	sessions: { startedAt: Date; endedAt?: Date | null }[],
	now: Date
): number | null {
	if (sessions.length === 0) return null;

	let latest: Date | null = null;
	for (const s of sessions) {
		const ref = s.endedAt ?? s.startedAt;
		if (latest === null || ref > latest) {
			latest = ref;
		}
	}

	if (latest === null) return null;
	return (now.getTime() - latest.getTime()) / 60000;
}

export function formatMinutes(minutes: number): string {
	if (minutes === 0) return '0m';
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}
