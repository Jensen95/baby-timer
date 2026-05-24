import type { Insert } from '$lib/db/database.types';

export type DiaperContent = 'poop' | 'pee' | 'both';

export interface DiaperChangeFormState {
	babyId: string;
	familyId: string;
	changedAt: Date;
	hasPoop: boolean;
	hasPee: boolean;
	note?: string;
}

export function getDiaperContent(hasPoop: boolean, hasPee: boolean): DiaperContent {
	if (hasPoop && hasPee) return 'both';
	if (hasPoop) return 'poop';
	if (hasPee) return 'pee';
	throw new Error('At least one diaper content type must be selected');
}

export function formatDiaperContentLabel(content: DiaperContent): string {
	if (content === 'both') return 'Poop + Pee';
	return content === 'poop' ? 'Poop' : 'Pee';
}

export function buildDailyDiaperChangeCounts(
	dayList: string[],
	changes: Array<{ started_at: string }>
): Record<string, number> {
	return dayList.reduce<Record<string, number>>((counts, day) => {
		counts[day] = changes.filter((session) => session.started_at.startsWith(day)).length;
		return counts;
	}, {});
}

export function buildDiaperChangePayload(
	form: DiaperChangeFormState
): Insert<'diaper_change_sessions'> {
	getDiaperContent(form.hasPoop, form.hasPee);

	return {
		baby_id: form.babyId,
		family_id: form.familyId,
		started_at: form.changedAt.toISOString(),
		has_poop: form.hasPoop,
		has_pee: form.hasPee,
		note: form.note ?? null
	};
}
