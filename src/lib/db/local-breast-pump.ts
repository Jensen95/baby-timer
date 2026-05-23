import { db, type LocalBreastPump } from './local';

export type { LocalBreastPump };

export async function listBreastPumpSessionsLocal(
	babyId: string,
	limit = 50
): Promise<LocalBreastPump[]> {
	const all = await db.breast_pump_sessions.where('baby_id').equals(babyId).toArray();
	return all.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
}

export async function getActiveBreastPumpSessionLocal(
	babyId: string
): Promise<LocalBreastPump | null> {
	const sessions = await db.breast_pump_sessions
		.where('baby_id')
		.equals(babyId)
		.filter((s) => s.ended_at === null)
		.toArray();
	if (sessions.length === 0) return null;
	sessions.sort((a, b) => b.started_at.localeCompare(a.started_at));
	return sessions[0];
}

export async function createBreastPumpLocal(session: LocalBreastPump): Promise<LocalBreastPump> {
	await db.breast_pump_sessions.put(session);
	return session;
}

export async function updateBreastPumpLocal(
	id: string,
	updates: Partial<LocalBreastPump>
): Promise<void> {
	await db.breast_pump_sessions.update(id, updates);
}

export async function deleteBreastPumpLocal(id: string): Promise<void> {
	await db.breast_pump_sessions.delete(id);
}
