import { describe, it, expect } from 'vitest';
import {
	buildDiaperChangePayload,
	buildDailyDiaperChangeCounts,
	formatDiaperContentLabel,
	getDiaperContent
} from './diaper-change';

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

describe('getDiaperContent', () => {
	it('maps selected diaper contents to key', () => {
		expect(getDiaperContent(true, false)).toBe('poop');
		expect(getDiaperContent(false, true)).toBe('pee');
		expect(getDiaperContent(true, true)).toBe('both');
	});
});

describe('formatDiaperContentLabel', () => {
	it('formats diaper content keys into display labels', () => {
		expect(formatDiaperContentLabel('poop')).toBe('Poop');
		expect(formatDiaperContentLabel('pee')).toBe('Pee');
		expect(formatDiaperContentLabel('both')).toBe('Poop + Pee');
	});
});

describe('buildDailyDiaperChangeCounts', () => {
	it('returns daily diaper change counts for trend charts', () => {
		const counts = buildDailyDiaperChangeCounts(
			['2024-01-01', '2024-01-02', '2024-01-03'],
			[
				{ started_at: '2024-01-01T10:00:00.000Z' },
				{ started_at: '2024-01-01T11:00:00.000Z' },
				{ started_at: '2024-01-03T09:30:00.000Z' }
			]
		);

		expect(counts).toEqual({
			'2024-01-01': 2,
			'2024-01-02': 0,
			'2024-01-03': 1
		});
	});
});
