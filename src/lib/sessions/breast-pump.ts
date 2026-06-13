import type { Insert } from '$lib/db/database.types';

export type PumpSide = 'left' | 'right' | 'both';

export interface BreastPumpFormState {
	babyId: string;
	familyId: string;
	side: PumpSide;
	startedAt: Date;
	endedAt: Date;
	yieldLeftMl?: number | null;
	yieldRightMl?: number | null;
	yieldTotalMl?: number | null;
	note?: string;
}

function normalizeYield(value: number | null | undefined): number | null {
	if (value == null) return null;
	if (!Number.isFinite(value) || value < 0) {
		throw new Error('yield must be a non-negative number');
	}
	return Math.round(value);
}

export function buildBreastPumpPayload(form: BreastPumpFormState): Insert<'breast_pump_sessions'> {
	if (form.endedAt < form.startedAt) {
		throw new Error('endedAt must not be before startedAt');
	}
	return {
		baby_id: form.babyId,
		family_id: form.familyId,
		side: form.side,
		started_at: form.startedAt.toISOString(),
		ended_at: form.endedAt.toISOString(),
		yield_left_ml: normalizeYield(form.yieldLeftMl),
		yield_right_ml: normalizeYield(form.yieldRightMl),
		yield_total_ml: normalizeYield(form.yieldTotalMl),
		note: form.note ?? null
	};
}

export function isValidPumpSide(value: unknown): value is PumpSide {
	return value === 'left' || value === 'right' || value === 'both';
}
