import { db, type LocalBaby } from './local';

export type { LocalBaby };

export async function listBabiesLocal(familyId: string | null): Promise<LocalBaby[]> {
	if (familyId === null) {
		return db.babies.orderBy('created_at').toArray();
	}
	return db.babies.where('family_id').equals(familyId).sortBy('created_at');
}

export async function createBabyLocal(baby: LocalBaby): Promise<LocalBaby> {
	await db.babies.put(baby);
	return baby;
}

export async function getBabyLocal(id: string): Promise<LocalBaby | undefined> {
	return db.babies.get(id);
}
