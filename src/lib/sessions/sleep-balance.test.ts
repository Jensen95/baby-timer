import { describe, expect, it } from 'vitest';
import {
	analyzeSleepPositionBalance,
	formatHeadSideLabel,
	getSleepSessionMinutes
} from './sleep-balance';

describe('analyzeSleepPositionBalance', () => {
	it('summarizes minutes by side and dominant side', () => {
		const result = analyzeSleepPositionBalance([
			{
				side: 'left',
				startedAt: new Date('2024-01-01T10:00:00Z'),
				endedAt: new Date('2024-01-01T11:00:00Z')
			},
			{
				side: 'right',
				startedAt: new Date('2024-01-01T12:00:00Z'),
				endedAt: new Date('2024-01-01T12:30:00Z')
			}
		]);

		expect(result.minutesBySide.left).toBe(60);
		expect(result.minutesBySide.right).toBe(30);
		expect(result.totalMinutes).toBe(90);
		expect(result.dominantSide).toBe('left');
		expect(result.dominantPercent).toBe(67);
	});

	it('warns when one position dominates recent sleep', () => {
		const result = analyzeSleepPositionBalance([
			{
				side: 'left',
				startedAt: new Date('2024-01-01T10:00:00Z'),
				endedAt: new Date('2024-01-01T12:00:00Z')
			},
			{
				side: 'right',
				startedAt: new Date('2024-01-01T13:00:00Z'),
				endedAt: new Date('2024-01-01T13:20:00Z')
			}
		]);

		expect(result.needsWarning).toBe(true);
		expect(result.message).toContain('mostly head left');
	});

	it('does not warn when sleep positions are balanced', () => {
		const result = analyzeSleepPositionBalance([
			{
				side: 'left',
				startedAt: new Date('2024-01-01T10:00:00Z'),
				endedAt: new Date('2024-01-01T10:30:00Z')
			},
			{
				side: 'right',
				startedAt: new Date('2024-01-01T11:00:00Z'),
				endedAt: new Date('2024-01-01T11:30:00Z')
			}
		]);

		expect(result.needsWarning).toBe(false);
		expect(result.message).toBeNull();
	});

	it('ignores sessions without valid end times', () => {
		const result = analyzeSleepPositionBalance([
			{
				side: 'left',
				startedAt: new Date('2024-01-01T10:00:00Z'),
				endedAt: null
			},
			{
				side: 'right',
				startedAt: new Date('2024-01-01T11:00:00Z'),
				endedAt: new Date('2024-01-01T10:59:00Z')
			}
		]);

		expect(result.totalMinutes).toBe(0);
		expect(result.dominantSide).toBeNull();
	});
});

describe('formatHeadSideLabel', () => {
	it('returns readable labels', () => {
		expect(formatHeadSideLabel('left')).toBe('head left');
		expect(formatHeadSideLabel('right')).toBe('head right');
		expect(formatHeadSideLabel('back')).toBe('back');
		expect(formatHeadSideLabel('tummy')).toBe('tummy');
		expect(formatHeadSideLabel('side')).toBe('side');
	});
});

describe('getSleepSessionMinutes', () => {
	it('returns rounded minutes for completed sessions', () => {
		expect(
			getSleepSessionMinutes({
				side: 'left',
				startedAt: new Date('2024-01-01T10:00:00Z'),
				endedAt: new Date('2024-01-01T10:29:29Z')
			})
		).toBe(29);
	});
});
