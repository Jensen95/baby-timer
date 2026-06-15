import type { Table } from 'dexie';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { db } from './local';
import { supabase } from '$lib/supabase';
import { captureException } from '$lib/error-tracking';
import { getUserFamilies, type Family } from './family';
import { getLocalFamily } from './local-family';
import { resolveSyncFamilyId } from './sync-helpers';

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
	// Set synchronously at the top of watch() so a second, overlapping watch() for
	// the same family bails out instead of building a duplicate channel (which
	// throws "cannot add postgres_changes callbacks ... after subscribe()").
	let subscribingFamilyId: string | null = null;
	let realtimeConnected = $state(false);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	// Only used when Realtime is unavailable. Realtime pushes changes live, so a
	// healthy socket needs no polling at all; this is the degraded-mode fallback
	// and a 30s cadence is plenty (the old code effectively re-pulled on every
	// reconnect, which hammered the DB roughly once a second on a flaky socket).
	const FALLBACK_POLL_MS = 30_000;
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

			// Resolve the families this user belongs to once, and pick the active one.
			// Used to (1) adopt orphaned local rows (family_id === null) into the
			// active family before pushing and (2) pull shared rows back down. Without
			// the adoption, a baby created before its family was known is skipped on
			// every pass and never reaches the DB — and a child session created later
			// (with a valid family_id) then fails its baby_id foreign key, because the
			// parent baby was never synced.
			let families: Family[] = [];
			try {
				families = await getUserFamilies(supabase);
			} catch (e) {
				captureException(e);
				anyError = true;
			}
			const activeFamilyId = (await getLocalFamily())?.id ?? families[0]?.id ?? null;

			const pendingBabies = await db.babies.where('_sync').equals('pending').toArray();
			for (const baby of pendingBabies) {
				const familyId = resolveSyncFamilyId(baby.family_id, activeFamilyId);
				if (!familyId) {
					continue;
				}
				if (baby.family_id !== familyId) {
					await db.babies.update(baby.id, { family_id: familyId });
				}
				if (!canSyncBabyNow(baby.id)) {
					continue;
				}
				const { _sync, ...payload } = { ...baby, family_id: familyId };
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
				const familyId = resolveSyncFamilyId(feeding.family_id, activeFamilyId);
				if (!familyId) {
					continue;
				}
				if (feeding.family_id !== familyId) {
					await db.feeding_sessions.update(feeding.id, { family_id: familyId });
				}
				const { _sync, ...payload } = { ...feeding, family_id: familyId };
				const { error: err } = await supabase.from('feeding_sessions').upsert(payload as any);
				if (!err) await db.feeding_sessions.update(feeding.id, { _sync: 'synced' });
				else {
					captureException(err);
					anyError = true;
				}
			}

			const pendingSleeps = await db.sleep_sessions.where('_sync').equals('pending').toArray();
			for (const sleep of pendingSleeps) {
				const familyId = resolveSyncFamilyId(sleep.family_id, activeFamilyId);
				if (!familyId) {
					continue;
				}
				if (sleep.family_id !== familyId) {
					await db.sleep_sessions.update(sleep.id, { family_id: familyId });
				}
				const { _sync, ...payload } = { ...sleep, family_id: familyId };
				const { error: err } = await supabase.from('sleep_sessions').upsert(payload as any);
				if (!err) await db.sleep_sessions.update(sleep.id, { _sync: 'synced' });
				else {
					captureException(err);
					anyError = true;
				}
			}

			const pendingPumps = await db.breast_pump_sessions.where('_sync').equals('pending').toArray();
			for (const pump of pendingPumps) {
				const familyId = resolveSyncFamilyId(pump.family_id, activeFamilyId);
				if (!familyId) {
					continue;
				}
				if (pump.family_id !== familyId) {
					await db.breast_pump_sessions.update(pump.id, { family_id: familyId });
				}
				const { _sync, ...payload } = { ...pump, family_id: familyId };
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
				const familyId = resolveSyncFamilyId(diaperChange.family_id, activeFamilyId);
				if (!familyId) {
					continue;
				}
				if (diaperChange.family_id !== familyId) {
					await db.diaper_change_sessions.update(diaperChange.id, { family_id: familyId });
				}
				const { _sync, ...payload } = { ...diaperChange, family_id: familyId };
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

	// Shallow value-equality for two cache rows. Used to skip a no-op `put` (and
	// the reactive `revision` bump it would trigger) when a remote row is byte-for-
	// byte what we already hold — the root cause of the stats page re-rendering on
	// every sync pass even though nothing changed.
	function rowsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
		const aKeys = Object.keys(a);
		if (aKeys.length !== Object.keys(b).length) return false;
		return aKeys.every((k) => a[k] === b[k]);
	}

	// Apply a single remote row into the local cache. Generated columns (e.g.
	// duration_seconds) are never mirrored locally. A locally pending row is left
	// untouched so an unsynced local edit is not clobbered by an older remote copy.
	// Returns true only when the cache actually changed, so callers can avoid
	// bumping `revision` (and re-rendering the UI) for a no-op pull.
	async function applyRemoteRow(
		table: WatchedTable,
		raw: Record<string, unknown>
	): Promise<boolean> {
		const row = { ...raw };
		delete row.duration_seconds;
		const id = row.id as string | undefined;
		if (!id) return false;
		const existing = await localTables[table].get(id);
		if (existing && existing._sync === 'pending') return false;
		const next = { ...(row as { id: string }), _sync: 'synced' as const };
		if (existing && rowsEqual(existing, next)) return false;
		await localTables[table].put(next);
		return true;
	}

	async function applyRemoteChange(
		table: WatchedTable,
		payload: RealtimePostgresChangesPayload<Record<string, unknown>>
	) {
		try {
			if (payload.eventType === 'DELETE') {
				const id = (payload.old as { id?: string }).id;
				if (id && (await localTables[table].get(id))) {
					await localTables[table].delete(id);
					revision++;
				}
				return;
			}
			if (await applyRemoteRow(table, payload.new as Record<string, unknown>)) revision++;
		} catch (e) {
			captureException(e);
		}
	}

	// Pull every watched table for a family from the database into the local
	// cache. Used by syncNow (so sharing works without Realtime) and as the
	// catch-up fetch right after (re)subscribing to the Realtime channel.
	async function pullFamilyTables(familyId: string) {
		let changed = false;
		for (const table of WATCHED_TABLES) {
			const { data, error: err } = await supabase.from(table).select('*').eq('family_id', familyId);
			if (err) {
				captureException(err);
				continue;
			}
			for (const row of data ?? []) {
				if (await applyRemoteRow(table, row as Record<string, unknown>)) changed = true;
			}
		}
		if (changed) revision++;
	}

	// Subscribe to live changes for a family. Replaces interval polling: remote
	// writes from other devices/members stream straight into the local cache.
	async function watch(familyId: string) {
		// Bail if we already watch (or are mid-subscribe for) this family. The
		// `channel` is only assigned at the very end, so without the
		// `subscribingFamilyId` guard two overlapping calls (the layout effect can
		// fire more than once before the first await resolves) both get past the
		// `channel` check and build a second channel for the same topic. The reused,
		// already-subscribed channel then throws "cannot add postgres_changes
		// callbacks ... after subscribe()" when listeners are attached.
		if (watchedFamilyId === familyId && (channel || subscribingFamilyId === familyId)) return;
		subscribingFamilyId = familyId;
		unwatch();
		watchedFamilyId = familyId;

		try {
			// Realtime postgres_changes is RLS-filtered per row: without the member's
			// JWT on the socket every change is evaluated as `anon` and silently
			// dropped, so events authored by other members never arrive. supabase-js
			// only auto-applies the token on SIGNED_IN / TOKEN_REFRESHED — NOT on
			// INITIAL_SESSION (a page reload that restores an existing session), which
			// is the common case here. Set it explicitly before subscribing.
			const {
				data: { session }
			} = await supabase.auth.getSession();
			// A concurrent watch()/unwatch() may have superseded us during the await.
			if (watchedFamilyId !== familyId) return;
			if (session?.access_token) {
				await supabase.realtime.setAuth(session.access_token);
			}
			if (watchedFamilyId !== familyId) return;

			// Defensive: drop any stale channel left on the client for this topic
			// before creating a fresh one, so we never attach listeners to an
			// already-subscribed channel.
			const topic = `family-sync:${familyId}`;
			for (const existing of supabase.getChannels()) {
				if (existing.topic === topic || existing.topic === `realtime:${topic}`) {
					supabase.removeChannel(existing);
				}
			}

			let ch = supabase.channel(topic);
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
					// Socket is live: Realtime now streams every change, so the fallback
					// poll is not needed. Do one catch-up pull for rows missed while we
					// were disconnected, then rely on push.
					realtimeConnected = true;
					stopFallbackPolling();
					syncNow();
				} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
					// Socket is down. supabase-js keeps retrying the subscription on its
					// own; we must NOT re-pull on every transient drop (that is the
					// "pulling every second" storm). Instead fall back to a single slow
					// periodic pull until Realtime recovers.
					realtimeConnected = false;
					startFallbackPolling();
				}
			});
			channel = ch;
		} catch (e) {
			captureException(e);
		} finally {
			if (subscribingFamilyId === familyId) subscribingFamilyId = null;
		}
	}

	function startFallbackPolling() {
		if (pollTimer !== null || typeof window === 'undefined') return;
		pollTimer = setInterval(() => {
			if (realtimeConnected) {
				stopFallbackPolling();
				return;
			}
			syncNow();
		}, FALLBACK_POLL_MS);
	}

	function stopFallbackPolling() {
		if (pollTimer !== null) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	function unwatch() {
		stopFallbackPolling();
		realtimeConnected = false;
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
