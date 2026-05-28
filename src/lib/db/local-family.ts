import { db, type LocalFamily } from './local';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { createFamily, getUserFamilies } from './family';

export type { LocalFamily };

type Client = SupabaseClient<Database>;

const inFlightFamilyBootstrap = new Map<string, Promise<LocalFamily | null>>();

export async function getLocalFamily(): Promise<LocalFamily | undefined> {
	const all = await db.families.toArray();
	return all[0];
}

export async function putLocalFamily(family: LocalFamily): Promise<void> {
	await db.transaction('rw', db.families, async () => {
		await db.families.clear();
		await db.families.put(family);
	});
}

async function bootstrapLocalFamily(
	client: Client,
	userId: string,
	createIfMissing: boolean,
	defaultFamilyName = 'My Family'
): Promise<LocalFamily | null> {
	const existing = inFlightFamilyBootstrap.get(userId);
	if (existing) {
		return existing;
	}

	const task = (async () => {
		const localFamily = await getLocalFamily();
		if (localFamily) {
			return localFamily;
		}

		const families = await getUserFamilies(client);
		if (families.length > 0) {
			const resolved = {
				id: families[0].id,
				name: families[0].name,
				created_at: families[0].created_at
			};
			await putLocalFamily(resolved);
			return resolved;
		}

		if (!createIfMissing) {
			return null;
		}

		const created = await createFamily(client, defaultFamilyName);
		const resolved = {
			id: created.id,
			name: created.name,
			created_at: created.created_at
		};
		await putLocalFamily(resolved);
		return resolved;
	})().finally(() => {
		inFlightFamilyBootstrap.delete(userId);
	});

	inFlightFamilyBootstrap.set(userId, task);
	return task;
}

export async function resolveLocalFamilyForUser(
	client: Client,
	userId: string
): Promise<LocalFamily | null> {
	return bootstrapLocalFamily(client, userId, false);
}

export async function ensureLocalFamilyForUser(
	client: Client,
	userId: string,
	defaultFamilyName = 'My Family'
): Promise<LocalFamily> {
	const family = await bootstrapLocalFamily(client, userId, true, defaultFamilyName);
	if (!family) {
		throw new Error('Failed to resolve or create local family');
	}
	return family;
}
