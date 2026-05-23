import type { HeadSide } from './sleep';

export const HEAD_SIDES: HeadSide[] = ['left', 'right', 'back', 'tummy', 'side'];

export interface SleepPositionSession {
	side: HeadSide;
	startedAt: Date;
	endedAt: Date | null;
}

export interface SleepPositionBalance {
	minutesBySide: Record<HeadSide, number>;
	totalMinutes: number;
	dominantSide: HeadSide | null;
	dominantPercent: number;
	needsWarning: boolean;
	message: string | null;
}

const IMBALANCE_THRESHOLD_PERCENT = 60;

export function formatHeadSideLabel(side: HeadSide): string {
	switch (side) {
		case 'left':
			return 'head left';
		case 'right':
			return 'head right';
		case 'back':
			return 'back';
		case 'tummy':
			return 'tummy';
		case 'side':
			return 'side';
	}
}

export function analyzeSleepPositionBalance(
	sessions: SleepPositionSession[]
): SleepPositionBalance {
	const minutesBySide: Record<HeadSide, number> = {
		left: 0,
		right: 0,
		back: 0,
		tummy: 0,
		side: 0
	};

	for (const session of sessions) {
		const durationMinutes = getSleepSessionMinutes(session);
		if (durationMinutes <= 0) continue;
		minutesBySide[session.side] += durationMinutes;
	}

	const totalMinutes = Object.values(minutesBySide).reduce((sum, minutes) => sum + minutes, 0);
	if (totalMinutes === 0) {
		return {
			minutesBySide,
			totalMinutes: 0,
			dominantSide: null,
			dominantPercent: 0,
			needsWarning: false,
			message: null
		};
	}

	let dominantSide: HeadSide | null = null;
	let dominantMinutes = 0;
	for (const side of HEAD_SIDES) {
		if (minutesBySide[side] > dominantMinutes) {
			dominantSide = side;
			dominantMinutes = minutesBySide[side];
		}
	}
	const dominantPercent = Math.round((dominantMinutes / totalMinutes) * 100);
	const needsWarning = dominantPercent >= IMBALANCE_THRESHOLD_PERCENT;

	let message: string | null = null;
	if (needsWarning && dominantSide) {
		message = `Sleep has been mostly ${formatHeadSideLabel(dominantSide)} (${dominantPercent}%). Try rotating positions between naps to avoid too much pressure on one area of the head.`;
		if (dominantSide === 'tummy') {
			message +=
				' For safe sleep, place baby on their back unless your pediatrician says otherwise.';
		}
	}

	return {
		minutesBySide,
		totalMinutes,
		dominantSide,
		dominantPercent,
		needsWarning,
		message
	};
}

export function getSleepSessionMinutes(session: SleepPositionSession): number {
	if (!session.endedAt || session.endedAt <= session.startedAt) return 0;
	return Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000);
}
