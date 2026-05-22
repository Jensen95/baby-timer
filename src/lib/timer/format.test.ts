import { describe, it, expect } from 'vitest';
import { formatDuration, elapsedSeconds, formatTime } from './format';

describe('formatDuration', () => {
	it('returns "0s" for zero seconds', () => {
		expect(formatDuration(0)).toBe('0s');
	});

	it('returns "0s" for negative values', () => {
		expect(formatDuration(-5)).toBe('0s');
	});

	it('formats seconds only (under 60s)', () => {
		expect(formatDuration(45)).toBe('45s');
		expect(formatDuration(1)).toBe('1s');
		expect(formatDuration(59)).toBe('59s');
	});

	it('formats minutes and seconds', () => {
		expect(formatDuration(60)).toBe('1m');
		expect(formatDuration(90)).toBe('1m 30s');
		expect(formatDuration(61)).toBe('1m 1s');
	});

	it('formats hours, minutes and seconds', () => {
		expect(formatDuration(3600)).toBe('1h');
		expect(formatDuration(3661)).toBe('1h 1m 1s');
		expect(formatDuration(3660)).toBe('1h 1m');
		expect(formatDuration(7384)).toBe('2h 3m 4s');
	});

	it('omits zero-value components', () => {
		expect(formatDuration(3600)).toBe('1h');
		expect(formatDuration(3660)).toBe('1h 1m');
		expect(formatDuration(60)).toBe('1m');
	});
});

describe('elapsedSeconds', () => {
	it('returns 0 for same timestamps', () => {
		const d = new Date();
		expect(elapsedSeconds(d, d)).toBe(0);
	});

	it('returns correct elapsed time', () => {
		const start = new Date('2024-01-01T10:00:00Z');
		const end = new Date('2024-01-01T10:01:30Z');
		expect(elapsedSeconds(start, end)).toBe(90);
	});

	it('floors to whole seconds', () => {
		const start = new Date('2024-01-01T10:00:00.000Z');
		const end = new Date('2024-01-01T10:00:00.999Z');
		expect(elapsedSeconds(start, end)).toBe(0);
	});

	it('returns 0 if end is before start', () => {
		const start = new Date('2024-01-01T10:00:00Z');
		const end = new Date('2024-01-01T09:59:59Z');
		expect(elapsedSeconds(start, end)).toBe(0);
	});
});
