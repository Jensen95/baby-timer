import { db, type LocalFamily } from './local';

export type { LocalFamily };

export async function getLocalFamily(): Promise<LocalFamily | undefined> {
	const all = await db.families.toArray();
	return all[0];
}

export async function putLocalFamily(family: LocalFamily): Promise<void> {
	await db.families.put(family);
}
