import type { Insert } from '$lib/db/database.types';

export type HeadSide = 'left' | 'right' | 'back' | 'tummy';

export interface SleepFormState {
	babyId: string;
	familyId: string;
	side: HeadSide;
	startedAt: Date;
	endedAt: Date;
	note?: string;
}

export function buildSleepPayload(form: SleepFormState): Insert<'sleep_sessions'> {
	if (form.endedAt < form.startedAt) {
		throw new Error('endedAt must not be before startedAt');
	}
	return {
		baby_id: form.babyId,
		family_id: form.familyId,
		side: form.side,
		started_at: form.startedAt.toISOString(),
		ended_at: form.endedAt.toISOString(),
		note: form.note ?? null
	};
}

export function isValidHeadSide(value: unknown): value is HeadSide {
	return value === 'left' || value === 'right' || value === 'back' || value === 'tummy';
}
