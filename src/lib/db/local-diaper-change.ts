import { db, type LocalDiaperChange } from './local';

export type { LocalDiaperChange };

export async function listDiaperChangeSessionsLocal(
	babyId: string,
	limit = 50
): Promise<LocalDiaperChange[]> {
	const all = await db.diaper_change_sessions.where('baby_id').equals(babyId).toArray();
	return all.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
}

export async function createDiaperChangeLocal(
	session: LocalDiaperChange
): Promise<LocalDiaperChange> {
	await db.diaper_change_sessions.put(session);
	return session;
}

export async function updateDiaperChangeLocal(
	id: string,
	updates: Partial<LocalDiaperChange>
): Promise<void> {
	await db.diaper_change_sessions.update(id, updates);
}

export async function deleteDiaperChangeLocal(id: string): Promise<void> {
	await db.diaper_change_sessions.delete(id);
}
