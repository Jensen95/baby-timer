import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNow, refreshNow, startTick, stopTick, __resetTickForTest } from './time.svelte';

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	__resetTickForTest();
	vi.useRealTimers();
});

describe('refreshNow', () => {
	it('updates getNow() to current Date.now()', () => {
		vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
		__resetTickForTest();
		const before = getNow();

		vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
		refreshNow();

		expect(getNow()).toBeGreaterThan(before);
		expect(getNow()).toBe(new Date('2024-01-01T12:00:00Z').getTime());
	});

	it('can be called multiple times and always reflects current time', () => {
		vi.setSystemTime(new Date('2024-06-01T08:00:00Z'));
		__resetTickForTest();
		refreshNow();
		const t1 = getNow();

		vi.setSystemTime(new Date('2024-06-01T10:30:00Z'));
		refreshNow();
		const t2 = getNow();

		expect(t2).toBeGreaterThan(t1);
		expect(t2).toBe(new Date('2024-06-01T10:30:00Z').getTime());
	});
});

describe('startTick / stopTick interval', () => {
	it('interval advances getNow() each second', () => {
		vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
		__resetTickForTest();
		startTick();
		const t0 = getNow();

		vi.setSystemTime(new Date('2024-01-01T10:00:03Z'));
		vi.advanceTimersByTime(3000);

		expect(getNow()).toBeGreaterThan(t0);

		stopTick();
	});

	it('clears the interval when stopTick drops refCount to 0', () => {
		__resetTickForTest();
		startTick();
		stopTick();

		vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
		const captured = getNow();
		vi.advanceTimersByTime(5000);

		expect(getNow()).toBe(captured);
	});

	it('is ref-counted: two startTick calls need two stopTick calls to stop', () => {
		vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
		__resetTickForTest();
		startTick();
		startTick();
		stopTick();
		const captured = getNow();

		vi.setSystemTime(new Date('2030-01-01T00:00:01Z'));
		vi.advanceTimersByTime(1000);

		expect(getNow()).toBeGreaterThan(captured);

		stopTick();
	});
});

describe('refreshNow acts as the visibility/focus/pageshow handler', () => {
	it('simulating app reopen: time jumps 2h, refreshNow catches up immediately', () => {
		vi.setSystemTime(new Date('2024-01-01T08:00:00Z'));
		__resetTickForTest();
		startTick();
		const atOpen = getNow();

		vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

		refreshNow();
		const afterReopen = getNow();

		expect(afterReopen - atOpen).toBe(2 * 60 * 60 * 1000);

		stopTick();
	});

	it('without refreshNow, getNow stays stale until the next tick', () => {
		vi.setSystemTime(new Date('2024-01-01T08:00:00Z'));
		__resetTickForTest();
		startTick();
		const atOpen = getNow();

		vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

		expect(getNow()).toBe(atOpen);

		stopTick();
	});
});
