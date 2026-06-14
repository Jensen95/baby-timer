import { describe, it, expect } from 'vitest';
import { buildBreastPumpPayload, isValidPumpSide } from './breast-pump';

const base = {
	babyId: 'baby-123',
	familyId: 'family-456',
	startedAt: new Date('2024-01-01T10:00:00Z'),
	endedAt: new Date('2024-01-01T10:20:00Z')
};

describe('buildBreastPumpPayload', () => {
	it('maps form state to insert payload', () => {
		const payload = buildBreastPumpPayload({
			...base,
			side: 'both',
			yieldLeftMl: 40,
			yieldRightMl: 35
		});
		expect(payload.baby_id).toBe('baby-123');
		expect(payload.family_id).toBe('family-456');
		expect(payload.side).toBe('both');
		expect(payload.started_at).toBe('2024-01-01T10:00:00.000Z');
		expect(payload.ended_at).toBe('2024-01-01T10:20:00.000Z');
		expect(payload.yield_left_ml).toBe(40);
		expect(payload.yield_right_ml).toBe(35);
		expect(payload.yield_total_ml).toBeNull();
		expect(payload.note).toBeNull();
	});

	it('keeps yield optional', () => {
		const payload = buildBreastPumpPayload({ ...base, side: 'left' });
		expect(payload.yield_left_ml).toBeNull();
		expect(payload.yield_right_ml).toBeNull();
		expect(payload.yield_total_ml).toBeNull();
	});

	it('records total-only amount with sides as null', () => {
		const payload = buildBreastPumpPayload({
			...base,
			side: 'both',
			yieldTotalMl: 75
		});
		expect(payload.yield_left_ml).toBeNull();
		expect(payload.yield_right_ml).toBeNull();
		expect(payload.yield_total_ml).toBe(75);
	});

	it('rounds non-integer total yield', () => {
		const payload = buildBreastPumpPayload({
			...base,
			side: 'both',
			yieldTotalMl: 74.7
		});
		expect(payload.yield_total_ml).toBe(75);
	});

	it('throws when end precedes start', () => {
		expect(() =>
			buildBreastPumpPayload({
				...base,
				side: 'right',
				endedAt: new Date('2024-01-01T09:59:59Z')
			})
		).toThrow(/endedAt/);
	});

	it('throws for negative yield', () => {
		expect(() =>
			buildBreastPumpPayload({
				...base,
				side: 'both',
				yieldLeftMl: -1
			})
		).toThrow(/yield/);
	});

	it('throws for negative total yield', () => {
		expect(() =>
			buildBreastPumpPayload({
				...base,
				side: 'both',
				yieldTotalMl: -5
			})
		).toThrow(/yield/);
	});
});

describe('isValidPumpSide', () => {
	it('accepts known sides', () => {
		expect(isValidPumpSide('left')).toBe(true);
		expect(isValidPumpSide('right')).toBe(true);
		expect(isValidPumpSide('both')).toBe(true);
	});

	it('rejects invalid values', () => {
		expect(isValidPumpSide('back')).toBe(false);
		expect(isValidPumpSide('')).toBe(false);
		expect(isValidPumpSide(null)).toBe(false);
	});
});
