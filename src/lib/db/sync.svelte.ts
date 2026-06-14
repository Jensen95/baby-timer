import type { Table } from 'dexie';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { db } from './local';
import { supabase } from '$lib/supabase';
import { captureException } from '$lib/error-tracking';
import { getUserFamilies } from './family';

export const SYNC_KEY = Symbol('sync');

// Tables shared across a family that we both push (local → remote) and watch
// (remote → local) via Realtime. `babies` is listed first so it is back-filled
// before sessions that reference it.
const WATCHED_TABLES = [
	'babies',
	'feeding_sessions',
	'sleep_sessions',
	'breast_pump_sessions',
	'diaper_change_sessions'
] as const;

type WatchedTable = (typeof WATCHED_TABLES)[number];

export function createSyncEngine() {
	let syncing = $state(false);
	let lastSyncedAt = $state<Date | null>(null);
	let error = $state<string | null>(null);
	let revision = $state(0);
	let channel: RealtimeChannel | null = null;
	let watchedFamilyId: string | null = null;
	const babiesRetryState = new Map<string, { attempts: number; nextAllowedAt: number }>();

	const localTables: Record<WatchedTable, Table<{ id: string; _sync: 'pending' | 'synced' }>> = {
		babies: db.babies,
		feeding_sessions: db.feeding_sessions,
		sleep_sessions: db.sleep_sessions,
		breast_pump_sessions: db.breast_pump_sessions,
		diaper_change_sessions: db.diaper_change_sessions
	};

	function canSyncBabyNow(id: string): boolean {
		const retry = babiesRetryState.get(id);
		return !retry || Date.now() >= retry.nextAllowedAt;
	}

	function markBabySyncSuccess(id: string): void {
		babiesRetryState.delete(id);
	}

	function markBabySyncFailure(id: string): void {
		const previous = babiesRetryState.get(id);
		const attempts = (previous?.attempts ?? 0) + 1;
		const delayMs = Math.min(15_000 * 2 ** (attempts - 1), 5 * 60_000);
		babiesRetryState.set(id, {
			attempts,
			nextAllowedAt: Date.now() + delayMs
		});
	}

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
				if (!canSyncBabyNow(baby.id)) {
					continue;
				}
				const { _sync, ...payload } = baby;
				const { error: err } = await supabase.from('babies').upsert(payload as any);
				if (!err) {
					await db.babies.update(baby.id, { _sync: 'synced' });
					markBabySyncSuccess(baby.id);
				} else {
					markBabySyncFailure(baby.id);
					captureException(err);
					anyError = true;
				}
			}

			const pendingFeedings = await db.feeding_sessions.where('_sync').equals('pending').toArray();
			for (const feeding of pendingFeedings) {
				if (!feeding.family_id) {
					continue;
				}
				const { _sync, ...payload } = feeding;
				const { error: err } = await supabase.from('feeding_sessions').upsert(payload as any);
				if (!err) await db.feeding_sessions.update(feeding.id, { _sync: 'synced' });
				else {
					captureException(err);
					anyError = true;
				}
			}

			const pendingSleeps = await db.sleep_sessions.where('_sync').equals('pending').toArray();
			for (const sleep of pendingSleeps) {
				if (!sleep.family_id) {
					continue;
				}
				const { _sync, ...payload } = sleep;
				const { error: err } = await supabase.from('sleep_sessions').upsert(payload as any);
				if (!err) await db.sleep_sessions.update(sleep.id, { _sync: 'synced' });
				else {
					captureException(err);
					anyError = true;
				}
			}

			const pendingPumps = await db.breast_pump_sessions.where('_sync').equals('pending').toArray();
			for (const pump of pendingPumps) {
				if (!pump.family_id) {
					continue;
				}
				const { _sync, ...payload } = pump;
				const { error: err } = await supabase.from('breast_pump_sessions').upsert(payload as any);
				if (!err) await db.breast_pump_sessions.update(pump.id, { _sync: 'synced' });
				else {
					captureException(err);
					anyError = true;
				}
			}

			const pendingDiaperChanges = await db.diaper_change_sessions
				.where('_sync')
				.equals('pending')
				.toArray();
			for (const diaperChange of pendingDiaperChanges) {
				if (!diaperChange.family_id) {
					continue;
				}
				const { _sync, ...payload } = diaperChange;
				const { error: err } = await supabase.from('diaper_change_sessions').upsert(payload as any);
				if (!err) await db.diaper_change_sessions.update(diaperChange.id, { _sync: 'synced' });
				else {
					captureException(err);
					anyError = true;
				}
			}

			// Pull every family-shared table (babies AND session events) from the
			// database into the local cache. This runs on every sync — app load,
			// reconnect, after a push — so a member sees data created by other
			// members regardless of whether the Realtime websocket ever connects.
			// (Realtime is only a live-update optimisation layered on top.)
			try {
				const families = await getUserFamilies(supabase);
				for (const family of families) {
					await pullFamilyTables(family.id);
				}
			} catch (syncError) {
				captureException(syncError);
				anyError = true;
			}

			if (anyError) {
				error = 'Some rows failed to sync';
			} else {
				error = null;
				lastSyncedAt = new Date();
			}
		} catch (e) {
			captureException(e);
			error = e instanceof Error ? e.message : 'Sync failed';
		} finally {
			syncing = false;
		}
	}

	// Apply a single remote row into the local cache. Generated columns (e.g.
	// duration_seconds) are never mirrored locally. A locally pending row is left
	// untouched so an unsynced local edit is not clobbered by an older remote copy.
	async function applyRemoteRow(table: WatchedTable, raw: Record<string, unknown>) {
		const row = { ...raw };
		delete row.duration_seconds;
		const id = row.id as string | undefined;
		if (!id) return;
		const existing = await localTables[table].get(id);
		if (existing && existing._sync === 'pending') return;
		await localTables[table].put({ ...(row as { id: string }), _sync: 'synced' });
	}

	async function applyRemoteChange(
		table: WatchedTable,
		payload: RealtimePostgresChangesPayload<Record<string, unknown>>
	) {
		try {
			if (payload.eventType === 'DELETE') {
				const id = (payload.old as { id?: string }).id;
				if (id) await localTables[table].delete(id);
				revision++;
				return;
			}
			await applyRemoteRow(table, payload.new as Record<string, unknown>);
			revision++;
		} catch (e) {
			captureException(e);
		}
	}

	// Pull every watched table for a family from the database into the local
	// cache. Used by syncNow (so sharing works without Realtime) and as the
	// catch-up fetch right after (re)subscribing to the Realtime channel.
	async function pullFamilyTables(familyId: string) {
		for (const table of WATCHED_TABLES) {
			const { data, error: err } = await supabase.from(table).select('*').eq('family_id', familyId);
			if (err) {
				captureException(err);
				continue;
			}
			for (const row of data ?? []) {
				await applyRemoteRow(table, row as Record<string, unknown>);
			}
		}
		revision++;
	}

	// Subscribe to live changes for a family. Replaces interval polling: remote
	// writes from other devices/members stream straight into the local cache.
	async function watch(familyId: string) {
		if (watchedFamilyId === familyId && channel) return;
		unwatch();
		watchedFamilyId = familyId;

		// Realtime postgres_changes is RLS-filtered per row: without the member's
		// JWT on the socket every change is evaluated as `anon` and silently
		// dropped, so events authored by other members never arrive. supabase-js
		// only auto-applies the token on SIGNED_IN / TOKEN_REFRESHED — NOT on
		// INITIAL_SESSION (a page reload that restores an existing session), which
		// is the common case here. Set it explicitly before subscribing.
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (session?.access_token) {
				await supabase.realtime.setAuth(session.access_token);
			}
		} catch (e) {
			captureException(e);
		}
		// A concurrent watch()/unwatch() may have superseded us during the await.
		if (watchedFamilyId !== familyId) return;

		let ch = supabase.channel(`family-sync:${familyId}`);
		for (const table of WATCHED_TABLES) {
			ch = ch.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
				(payload) =>
					applyRemoteChange(
						table,
						payload as RealtimePostgresChangesPayload<Record<string, unknown>>
					)
			);
		}
		ch.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				// syncNow pulls every family table itself; this is just the
				// post-(re)subscribe catch-up for rows missed while disconnected.
				syncNow();
			}
		});
		channel = ch;
	}

	function unwatch() {
		if (channel) {
			supabase.removeChannel(channel);
			channel = null;
		}
		watchedFamilyId = null;
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

		const guestPumps = await db.breast_pump_sessions.filter((s) => s.family_id === null).toArray();
		for (const pump of guestPumps) {
			await db.breast_pump_sessions.update(pump.id, { family_id: familyId, _sync: 'pending' });
		}

		const guestDiaperChanges = await db.diaper_change_sessions
			.filter((s) => s.family_id === null)
			.toArray();
		for (const diaperChange of guestDiaperChanges) {
			await db.diaper_change_sessions.update(diaperChange.id, {
				family_id: familyId,
				_sync: 'pending'
			});
		}

		await syncNow();
		await watch(familyId);
	}

	function start() {
		syncNow();
		if (typeof window !== 'undefined') {
			window.addEventListener('online', syncNow);
		}
	}

	function stop() {
		if (typeof window !== 'undefined') {
			window.removeEventListener('online', syncNow);
		}
		unwatch();
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
		get revision() {
			return revision;
		},
		syncNow,
		migrateGuestData,
		watch,
		unwatch,
		start,
		stop
	};
}

export type SyncEngineStore = ReturnType<typeof createSyncEngine>;
