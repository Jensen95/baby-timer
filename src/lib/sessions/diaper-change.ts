import type { Insert } from '$lib/db/database.types';

export interface DiaperChangeFormState {
	babyId: string;
	familyId: string;
	changedAt: Date;
	hasPoop: boolean;
	hasPee: boolean;
	note?: string;
}

export function buildDiaperChangePayload(
	form: DiaperChangeFormState
): Insert<'diaper_change_sessions'> {
	if (!form.hasPoop && !form.hasPee) {
		throw new Error('at least one diaper content type must be selected');
	}

	return {
		baby_id: form.babyId,
		family_id: form.familyId,
		started_at: form.changedAt.toISOString(),
		has_poop: form.hasPoop,
		has_pee: form.hasPee,
		note: form.note ?? null
	};
}
