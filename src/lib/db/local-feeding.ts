import { db, type LocalFeeding } from './local';

export type { LocalFeeding };

export async function listFeedingSessionsLocal(
	babyId: string,
	limit = 50
): Promise<LocalFeeding[]> {
	const all = await db.feeding_sessions.where('baby_id').equals(babyId).toArray();
	return all.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
}

export async function getActiveFeedingSessionLocal(babyId: string): Promise<LocalFeeding | null> {
	const sessions = await db.feeding_sessions
		.where('baby_id')
		.equals(babyId)
		.filter((s) => s.ended_at === null)
		.toArray();
	if (sessions.length === 0) return null;
	sessions.sort((a, b) => b.started_at.localeCompare(a.started_at));
	return sessions[0];
}

export async function createFeedingLocal(session: LocalFeeding): Promise<LocalFeeding> {
	await db.feeding_sessions.put(session);
	return session;
}

export async function updateFeedingLocal(
	id: string,
	updates: Partial<LocalFeeding>
): Promise<void> {
	await db.feeding_sessions.update(id, updates);
}
