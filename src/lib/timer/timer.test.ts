import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeElapsed, buildTimerResult } from './timer-logic';

describe('computeElapsed', () => {
	it('returns 0 when not running', () => {
		expect(computeElapsed(null, false, Date.now())).toBe(0);
	});

	it('returns 0 when running but no startedAt', () => {
		expect(computeElapsed(null, true, Date.now())).toBe(0);
	});

	it('computes elapsed seconds correctly', () => {
		const start = new Date('2024-01-01T10:00:00Z');
		const now = new Date('2024-01-01T10:00:45Z').getTime();
		expect(computeElapsed(start, true, now)).toBe(45);
	});

	it('floors to whole seconds', () => {
		const start = new Date('2024-01-01T10:00:00Z');
		const now = new Date('2024-01-01T10:00:45.999Z').getTime();
		expect(computeElapsed(start, true, now)).toBe(45);
	});
});

describe('buildTimerResult', () => {
	it('calculates duration correctly', () => {
		const start = new Date('2024-01-01T10:00:00Z');
		const end = new Date('2024-01-01T10:05:30Z');
		const result = buildTimerResult(start, end);
		expect(result.durationSeconds).toBe(330);
		expect(result.startedAt).toBe(start);
		expect(result.endedAt).toBe(end);
	});

	it('handles sub-minute durations', () => {
		const start = new Date('2024-01-01T10:00:00Z');
		const end = new Date('2024-01-01T10:00:45Z');
		const result = buildTimerResult(start, end);
		expect(result.durationSeconds).toBe(45);
	});

	it('handles zero duration', () => {
		const d = new Date();
		const result = buildTimerResult(d, d);
		expect(result.durationSeconds).toBe(0);
	});
});

describe('createTimer (runes-based)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts with running=false and no startedAt', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		expect(timer.running).toBe(false);
		expect(timer.startedAt).toBeNull();
		expect(timer.elapsed).toBe(0);
	});

	it('transitions to running=true after start()', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		timer.start();
		expect(timer.running).toBe(true);
		expect(timer.startedAt).toBeInstanceOf(Date);
	});

	it('does not re-start if already running', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		timer.start();
		const firstStart = timer.startedAt;
		vi.advanceTimersByTime(2000);
		timer.start();
		expect(timer.startedAt).toBe(firstStart);
	});

	it('returns a result with durationSeconds when stopped', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		timer.start();
		vi.advanceTimersByTime(5000);
		const result = timer.stop();
		expect(result).not.toBeNull();
		expect(result!.durationSeconds).toBe(5);
		expect(result!.startedAt).toBeInstanceOf(Date);
		expect(result!.endedAt).toBeInstanceOf(Date);
	});

	it('returns null when stopped without starting', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		const result = timer.stop();
		expect(result).toBeNull();
	});

	it('resets to initial state after reset()', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		timer.start();
		vi.advanceTimersByTime(3000);
		timer.reset();
		expect(timer.running).toBe(false);
		expect(timer.startedAt).toBeNull();
		expect(timer.elapsed).toBe(0);
	});

	it('transitions to running=false after stop()', async () => {
		const { createTimer } = await import('./timer.svelte');
		const timer = createTimer();
		timer.start();
		timer.stop();
		expect(timer.running).toBe(false);
		expect(timer.startedAt).toBeNull();
	});
});
