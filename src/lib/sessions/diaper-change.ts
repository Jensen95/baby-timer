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
	const countsByDay = changes.reduce<Map<string, number>>((counts, session) => {
		const day = session.started_at.slice(0, 10);
		counts.set(day, (counts.get(day) ?? 0) + 1);
		return counts;
	}, new Map());

	return dayList.reduce<Record<string, number>>((counts, day) => {
		counts[day] = countsByDay.get(day) ?? 0;
		return counts;
	}, {});
}

export function buildDiaperChangePayload(
	form: DiaperChangeFormState
): Insert<'diaper_change_sessions'> {
	const content = getDiaperContent(form.hasPoop, form.hasPee);

	return {
		baby_id: form.babyId,
		family_id: form.familyId,
		started_at: form.changedAt.toISOString(),
		has_poop: content === 'poop' || content === 'both',
		has_pee: content === 'pee' || content === 'both',
		note: form.note ?? null
	};
}
