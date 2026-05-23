import { describe, it, expect } from 'vitest';
import { buildSleepPayload, isValidHeadSide } from './sleep';

const base = {
	babyId: 'baby-123',
	familyId: 'family-456',
	startedAt: new Date('2024-01-01T22:00:00Z'),
	endedAt: new Date('2024-01-02T06:00:00Z')
};

describe('buildSleepPayload', () => {
	it('maps form state to insert payload', () => {
		const payload = buildSleepPayload({ ...base, side: 'back' });
		expect(payload.baby_id).toBe('baby-123');
		expect(payload.family_id).toBe('family-456');
		expect(payload.side).toBe('back');
		expect(payload.started_at).toBe('2024-01-01T22:00:00.000Z');
		expect(payload.ended_at).toBe('2024-01-02T06:00:00.000Z');
		expect(payload.note).toBeNull();
	});

	it('includes note when provided', () => {
		const payload = buildSleepPayload({ ...base, side: 'left', note: 'in crib' });
		expect(payload.note).toBe('in crib');
	});

	it('throws when endedAt is before startedAt', () => {
		expect(() =>
			buildSleepPayload({
				...base,
				side: 'back',
				startedAt: new Date('2024-01-02T06:00:00Z'),
				endedAt: new Date('2024-01-01T22:00:00Z')
			})
		).toThrow('endedAt must not be before startedAt');
	});

	it('allows all valid head sides', () => {
		expect(() => buildSleepPayload({ ...base, side: 'left' })).not.toThrow();
		expect(() => buildSleepPayload({ ...base, side: 'right' })).not.toThrow();
		expect(() => buildSleepPayload({ ...base, side: 'back' })).not.toThrow();
		expect(() => buildSleepPayload({ ...base, side: 'tummy' })).not.toThrow();
		expect(() => buildSleepPayload({ ...base, side: 'side' })).not.toThrow();
	});
});

describe('isValidHeadSide', () => {
	it('accepts valid sides', () => {
		expect(isValidHeadSide('left')).toBe(true);
		expect(isValidHeadSide('right')).toBe(true);
		expect(isValidHeadSide('back')).toBe(true);
		expect(isValidHeadSide('tummy')).toBe(true);
		expect(isValidHeadSide('side')).toBe(true);
	});

	it('rejects invalid values', () => {
		expect(isValidHeadSide('front')).toBe(false);
		expect(isValidHeadSide('')).toBe(false);
		expect(isValidHeadSide(null)).toBe(false);
		expect(isValidHeadSide(undefined)).toBe(false);
	});
});
