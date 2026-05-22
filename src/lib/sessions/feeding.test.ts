import { describe, it, expect } from 'vitest';
import { buildFeedingPayload, isValidFeedingSide } from './feeding';

const base = {
	babyId: 'baby-123',
	familyId: 'family-456',
	startedAt: new Date('2024-01-01T10:00:00Z'),
	endedAt: new Date('2024-01-01T10:30:00Z')
};

describe('buildFeedingPayload', () => {
	it('maps form state to insert payload', () => {
		const payload = buildFeedingPayload({ ...base, side: 'left' });
		expect(payload.baby_id).toBe('baby-123');
		expect(payload.family_id).toBe('family-456');
		expect(payload.side).toBe('left');
		expect(payload.started_at).toBe('2024-01-01T10:00:00.000Z');
		expect(payload.ended_at).toBe('2024-01-01T10:30:00.000Z');
		expect(payload.note).toBeNull();
	});

	it('includes note when provided', () => {
		const payload = buildFeedingPayload({ ...base, side: 'right', note: 'good latch' });
		expect(payload.note).toBe('good latch');
	});

	it('throws when endedAt is before startedAt', () => {
		expect(() =>
			buildFeedingPayload({
				...base,
				side: 'left',
				startedAt: new Date('2024-01-01T10:30:00Z'),
				endedAt: new Date('2024-01-01T10:00:00Z')
			})
		).toThrow('endedAt must not be before startedAt');
	});

	it('allows all valid breast sides', () => {
		expect(() => buildFeedingPayload({ ...base, side: 'left' })).not.toThrow();
		expect(() => buildFeedingPayload({ ...base, side: 'right' })).not.toThrow();
		expect(() => buildFeedingPayload({ ...base, side: 'both' })).not.toThrow();
	});
});

describe('isValidFeedingSide', () => {
	it('accepts valid sides', () => {
		expect(isValidFeedingSide('left')).toBe(true);
		expect(isValidFeedingSide('right')).toBe(true);
		expect(isValidFeedingSide('both')).toBe(true);
	});

	it('rejects invalid values', () => {
		expect(isValidFeedingSide('top')).toBe(false);
		expect(isValidFeedingSide('')).toBe(false);
		expect(isValidFeedingSide(null)).toBe(false);
		expect(isValidFeedingSide(undefined)).toBe(false);
		expect(isValidFeedingSide(42)).toBe(false);
	});
});
