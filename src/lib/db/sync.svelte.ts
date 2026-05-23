import { db } from './local';
import { supabase } from '$lib/supabase';

export const SYNC_KEY = Symbol('sync');

export function createSyncEngine() {
	let syncing = $state(false);
	let lastSyncedAt = $state<Date | null>(null);
	let error = $state<string | null>(null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	async function syncNow() {
		if (syncing) return;
		syncing = true;
		error = null;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session) return;

			let anyError = false;

			const pendingBabies = await db.babies.where('_sync').equals('pending').toArray();
			for (const baby of pendingBabies) {
				if (!baby.family_id) {
					continue;
				}
				const { _sync, ...payload } = baby;
				const { error: err } = await supabase.from('babies').upsert(payload as any);
				if (!err) await db.babies.update(baby.id, { _sync: 'synced' });
				else anyError = true;
			}

			const pendingFeedings = await db.feeding_sessions.where('_sync').equals('pending').toArray();
			for (const feeding of pendingFeedings) {
				if (!feeding.family_id) {
					continue;
				}
				const { _sync, ...payload } = feeding;
				const { error: err } = await supabase.from('feeding_sessions').upsert(payload as any);
				if (!err) await db.feeding_sessions.update(feeding.id, { _sync: 'synced' });
				else anyError = true;
			}

			const pendingSleeps = await db.sleep_sessions.where('_sync').equals('pending').toArray();
			for (const sleep of pendingSleeps) {
				if (!sleep.family_id) {
					continue;
				}
				const { _sync, ...payload } = sleep;
				const { error: err } = await supabase.from('sleep_sessions').upsert(payload as any);
				if (!err) await db.sleep_sessions.update(sleep.id, { _sync: 'synced' });
				else anyError = true;
			}

			if (anyError) {
				error = 'Some rows failed to sync';
			} else {
				error = null;
				lastSyncedAt = new Date();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Sync failed';
		} finally {
			syncing = false;
		}
	}

	async function migrateGuestData(userId: string, familyId: string) {
		const guestBabies = await db.babies.filter((b) => b.family_id === null).toArray();
		for (const baby of guestBabies) {
			await db.babies.update(baby.id, { family_id: familyId, _sync: 'pending' });
		}

		const guestFeedings = await db.feeding_sessions.filter((s) => s.family_id === null).toArray();
		for (const feeding of guestFeedings) {
			await db.feeding_sessions.update(feeding.id, { family_id: familyId, _sync: 'pending' });
		}

		const guestSleeps = await db.sleep_sessions.filter((s) => s.family_id === null).toArray();
		for (const sleep of guestSleeps) {
			await db.sleep_sessions.update(sleep.id, { family_id: familyId, _sync: 'pending' });
		}

		await syncNow();
	}

	function start() {
		syncNow();
		intervalId = setInterval(syncNow, 30_000);
	}

	function stop() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	return {
		get syncing() {
			return syncing;
		},
		get lastSyncedAt() {
			return lastSyncedAt;
		},
		get error() {
			return error;
		},
		syncNow,
		migrateGuestData,
		start,
		stop
	};
}

export type SyncEngineStore = ReturnType<typeof createSyncEngine>;
