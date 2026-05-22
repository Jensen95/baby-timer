import type { Insert } from '$lib/db/database.types';

export type FeedingSide = 'left' | 'right' | 'both';

export interface FeedingFormState {
	babyId: string;
	familyId: string;
	side: FeedingSide;
	startedAt: Date;
	endedAt: Date;
	note?: string;
}

export function buildFeedingPayload(form: FeedingFormState): Insert<'feeding_sessions'> {
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

export function isValidFeedingSide(value: unknown): value is FeedingSide {
	return value === 'left' || value === 'right' || value === 'both';
}
