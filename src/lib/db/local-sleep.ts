import { db, type LocalSleep } from './local';

export type { LocalSleep };

export async function listSleepSessionsLocal(babyId: string, limit = 50): Promise<LocalSleep[]> {
	const all = await db.sleep_sessions.where('baby_id').equals(babyId).toArray();
	return all.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
}

export async function getActiveSleepSessionLocal(babyId: string): Promise<LocalSleep | null> {
	const sessions = await db.sleep_sessions
		.where('baby_id')
		.equals(babyId)
		.filter((s) => s.ended_at === null)
		.toArray();
	if (sessions.length === 0) return null;
	sessions.sort((a, b) => b.started_at.localeCompare(a.started_at));
	return sessions[0];
}

export async function createSleepLocal(session: LocalSleep): Promise<LocalSleep> {
	await db.sleep_sessions.put(session);
	return session;
}

export async function updateSleepLocal(id: string, updates: Partial<LocalSleep>): Promise<void> {
	await db.sleep_sessions.update(id, updates);
}
