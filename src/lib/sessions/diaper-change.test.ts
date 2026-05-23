import { describe, it, expect } from 'vitest';
import { buildDiaperChangePayload } from './diaper-change';

const base = {
	babyId: 'baby-123',
	familyId: 'family-456',
	changedAt: new Date('2024-01-01T10:00:00Z')
};

describe('buildDiaperChangePayload', () => {
	it('maps form state to insert payload', () => {
		const payload = buildDiaperChangePayload({
			...base,
			hasPoop: true,
			hasPee: false
		});

		expect(payload.baby_id).toBe('baby-123');
		expect(payload.family_id).toBe('family-456');
		expect(payload.started_at).toBe('2024-01-01T10:00:00.000Z');
		expect(payload.has_poop).toBe(true);
		expect(payload.has_pee).toBe(false);
		expect(payload.note).toBeNull();
	});

	it('supports both poop and pee', () => {
		const payload = buildDiaperChangePayload({
			...base,
			hasPoop: true,
			hasPee: true
		});

		expect(payload.has_poop).toBe(true);
		expect(payload.has_pee).toBe(true);
	});

	it('throws if neither poop nor pee is selected', () => {
		expect(() =>
			buildDiaperChangePayload({
				...base,
				hasPoop: false,
				hasPee: false
			})
		).toThrow(/At least one/);
	});
});
