import { describe, it, expect, beforeEach } from 'vitest';
import {
	canStartTimer,
	getActiveTimer,
	getActiveTimers,
	__resetActiveTimersForTest,
	__pushActiveTimerForTest,
	type ActiveTimer
} from './active-timers.svelte';

const BABY_A = 'baby-a';
const BABY_B = 'baby-b';

function feedTimer(babyId = BABY_A): ActiveTimer {
	return { type: 'feed', localId: 'feed-1', babyId, startedAt: new Date(), side: 'left' };
}

function sleepTimer(babyId = BABY_A): ActiveTimer {
	return { type: 'sleep', localId: 'sleep-1', babyId, startedAt: new Date(), headSide: 'back' };
}

function pumpTimer(babyId = BABY_A): ActiveTimer {
	return { type: 'pump', localId: 'pump-1', babyId, startedAt: new Date(), side: 'both' };
}

beforeEach(() => {
	__resetActiveTimersForTest();
});

describe('canStartTimer', () => {
	it('allows every type when no timers are running', () => {
		expect(canStartTimer(BABY_A, 'feed').allowed).toBe(true);
		expect(canStartTimer(BABY_A, 'sleep').allowed).toBe(true);
		expect(canStartTimer(BABY_A, 'pump').allowed).toBe(true);
	});

	it('blocks a second timer of the same type', () => {
		__pushActiveTimerForTest(feedTimer());
		expect(canStartTimer(BABY_A, 'feed').allowed).toBe(false);
	});

	it('feeding blocks pump and pump blocks feeding', () => {
		__pushActiveTimerForTest(feedTimer());
		expect(canStartTimer(BABY_A, 'pump').allowed).toBe(false);

		__resetActiveTimersForTest();
		__pushActiveTimerForTest(pumpTimer());
		expect(canStartTimer(BABY_A, 'feed').allowed).toBe(false);
	});

	it('feeding blocks sleep and sleep blocks feeding', () => {
		__pushActiveTimerForTest(feedTimer());
		expect(canStartTimer(BABY_A, 'sleep').allowed).toBe(false);

		__resetActiveTimersForTest();
		__pushActiveTimerForTest(sleepTimer());
		expect(canStartTimer(BABY_A, 'feed').allowed).toBe(false);
	});

	it('allows sleep and pump to run concurrently', () => {
		__pushActiveTimerForTest(sleepTimer());
		expect(canStartTimer(BABY_A, 'pump').allowed).toBe(true);

		__resetActiveTimersForTest();
		__pushActiveTimerForTest(pumpTimer());
		expect(canStartTimer(BABY_A, 'sleep').allowed).toBe(true);
	});

	it('only restricts timers belonging to the same baby', () => {
		__pushActiveTimerForTest(feedTimer(BABY_A));
		expect(canStartTimer(BABY_B, 'feed').allowed).toBe(true);
		expect(canStartTimer(BABY_B, 'sleep').allowed).toBe(true);
	});

	it('reports a reason when blocked', () => {
		__pushActiveTimerForTest(feedTimer());
		const result = canStartTimer(BABY_A, 'sleep');
		expect(result.allowed).toBe(false);
		expect(result.reason).toBeTruthy();
	});
});

describe('getActiveTimer', () => {
	it('returns null when no timers are active', () => {
		expect(getActiveTimer(BABY_A, 'feed')).toBeNull();
	});

	it('returns the matching timer when one is active', () => {
		const timer = feedTimer();
		__pushActiveTimerForTest(timer);
		expect(getActiveTimer(BABY_A, 'feed')).toEqual(timer);
	});

	it('returns null for a different type', () => {
		__pushActiveTimerForTest(feedTimer());
		expect(getActiveTimer(BABY_A, 'sleep')).toBeNull();
	});

	it("returns null for a different baby's timer", () => {
		__pushActiveTimerForTest(feedTimer(BABY_A));
		expect(getActiveTimer(BABY_B, 'feed')).toBeNull();
	});
});

describe('getActiveTimers', () => {
	it('returns an empty array when none are active', () => {
		expect(getActiveTimers(BABY_A)).toEqual([]);
	});

	it('returns multiple timers for the same baby', () => {
		__pushActiveTimerForTest(sleepTimer());
		__pushActiveTimerForTest(pumpTimer());
		const timers = getActiveTimers(BABY_A);
		expect(timers).toHaveLength(2);
		expect(timers.map((t) => t.type).sort()).toEqual(['pump', 'sleep']);
	});

	it('excludes timers belonging to other babies', () => {
		__pushActiveTimerForTest(feedTimer(BABY_A));
		__pushActiveTimerForTest(sleepTimer(BABY_B));
		expect(getActiveTimers(BABY_A)).toHaveLength(1);
		expect(getActiveTimers(BABY_A)[0].babyId).toBe(BABY_A);
	});
});
