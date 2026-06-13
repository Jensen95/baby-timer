import type { FeedingSide } from '$lib/sessions/feeding';
import type { HeadSide } from '$lib/sessions/sleep';
import type { PumpSide } from '$lib/sessions/breast-pump';
import type { DiaperContent } from '$lib/sessions/diaper-change';
import {
	getActiveFeedingSessionLocal,
	createFeedingLocal,
	updateFeedingLocal,
	type LocalFeeding
} from '$lib/db/local-feeding';
import {
	getActiveSleepSessionLocal,
	createSleepLocal,
	updateSleepLocal,
	type LocalSleep
} from '$lib/db/local-sleep';
import {
	getActiveBreastPumpSessionLocal,
	createBreastPumpLocal,
	updateBreastPumpLocal,
	type LocalBreastPump
} from '$lib/db/local-breast-pump';
import { createDiaperChangeLocal, type LocalDiaperChange } from '$lib/db/local-diaper-change';

export type ActiveTimerType = 'feed' | 'sleep' | 'pump';

export interface ActiveFeedingTimer {
	type: 'feed';
	localId: string;
	babyId: string;
	startedAt: Date;
	side: FeedingSide;
}

export interface ActiveSleepTimer {
	type: 'sleep';
	localId: string;
	babyId: string;
	startedAt: Date;
	headSide: HeadSide;
}

export interface ActivePumpTimer {
	type: 'pump';
	localId: string;
	babyId: string;
	startedAt: Date;
	side: PumpSide;
}

export type ActiveTimer = ActiveFeedingTimer | ActiveSleepTimer | ActivePumpTimer;

const activeTimers = $state<ActiveTimer[]>([]);

export function getActiveTimers(babyId: string): ActiveTimer[] {
	return activeTimers.filter((t) => t.babyId === babyId);
}

export function getActiveTimer(babyId: string, type: ActiveTimerType): ActiveTimer | null {
	return activeTimers.find((t) => t.babyId === babyId && t.type === type) ?? null;
}

export function canStartTimer(
	babyId: string,
	type: ActiveTimerType
): { allowed: boolean; reason: string | null } {
	const running = getActiveTimers(babyId);
	const has = (t: ActiveTimerType) => running.some((timer) => timer.type === t);

	if (has(type)) {
		return { allowed: false, reason: `A ${type} timer is already running` };
	}

	if (type === 'feed') {
		if (has('sleep')) return { allowed: false, reason: 'Cannot feed while sleeping' };
		if (has('pump')) return { allowed: false, reason: 'Cannot feed while pumping' };
	}

	if (type === 'sleep') {
		if (has('feed')) return { allowed: false, reason: 'Cannot sleep while feeding' };
	}

	if (type === 'pump') {
		if (has('feed')) return { allowed: false, reason: 'Cannot pump while feeding' };
	}

	return { allowed: true, reason: null };
}

function removeTimer(babyId: string, type: ActiveTimerType): void {
	const index = activeTimers.findIndex((t) => t.babyId === babyId && t.type === type);
	if (index !== -1) {
		activeTimers.splice(index, 1);
	}
}

export async function startFeedingTimer(
	babyId: string,
	familyId: string | null,
	side: FeedingSide
): Promise<void> {
	const startedAt = new Date();
	const now = startedAt.toISOString();
	const id = crypto.randomUUID();
	const payload: LocalFeeding = {
		id,
		baby_id: babyId,
		family_id: familyId,
		side,
		started_at: now,
		ended_at: null,
		note: null,
		created_at: now,
		_sync: 'pending'
	};
	await createFeedingLocal(payload);
	activeTimers.push({ type: 'feed', localId: id, babyId, startedAt, side });
}

export async function stopFeedingTimer(babyId: string): Promise<void> {
	const timer = getActiveTimer(babyId, 'feed');
	if (!timer) return;
	await updateFeedingLocal(timer.localId, {
		ended_at: new Date().toISOString(),
		_sync: 'pending'
	});
	removeTimer(babyId, 'feed');
}

export async function updateFeedingSide(babyId: string, side: FeedingSide): Promise<void> {
	const timer = getActiveTimer(babyId, 'feed') as ActiveFeedingTimer | null;
	if (!timer || timer.side === side) return;
	await updateFeedingLocal(timer.localId, { side, _sync: 'pending' });
	timer.side = side;
}

export async function startSleepTimer(
	babyId: string,
	familyId: string | null,
	headSide: HeadSide
): Promise<void> {
	const startedAt = new Date();
	const now = startedAt.toISOString();
	const id = crypto.randomUUID();
	const payload: LocalSleep = {
		id,
		baby_id: babyId,
		family_id: familyId,
		side: headSide,
		started_at: now,
		ended_at: null,
		note: null,
		created_at: now,
		_sync: 'pending'
	};
	await createSleepLocal(payload);
	activeTimers.push({ type: 'sleep', localId: id, babyId, startedAt, headSide });
}

export async function stopSleepTimer(babyId: string): Promise<void> {
	const timer = getActiveTimer(babyId, 'sleep');
	if (!timer) return;
	await updateSleepLocal(timer.localId, {
		ended_at: new Date().toISOString(),
		_sync: 'pending'
	});
	removeTimer(babyId, 'sleep');
}

export async function updateSleepHeadSide(babyId: string, headSide: HeadSide): Promise<void> {
	const timer = getActiveTimer(babyId, 'sleep') as ActiveSleepTimer | null;
	if (!timer || timer.headSide === headSide) return;
	await updateSleepLocal(timer.localId, { side: headSide, _sync: 'pending' });
	timer.headSide = headSide;
}

export async function startPumpTimer(
	babyId: string,
	familyId: string | null,
	side: PumpSide
): Promise<void> {
	const startedAt = new Date();
	const now = startedAt.toISOString();
	const id = crypto.randomUUID();
	const payload: LocalBreastPump = {
		id,
		baby_id: babyId,
		family_id: familyId,
		side,
		started_at: now,
		ended_at: null,
		yield_left_ml: null,
		yield_right_ml: null,
		yield_total_ml: null,
		note: null,
		created_at: now,
		_sync: 'pending'
	};
	await createBreastPumpLocal(payload);
	activeTimers.push({ type: 'pump', localId: id, babyId, startedAt, side });
}

export async function stopPumpTimer(
	babyId: string,
	yieldLeft?: number,
	yieldRight?: number,
	yieldTotal?: number
): Promise<void> {
	const timer = getActiveTimer(babyId, 'pump');
	if (!timer) return;
	await updateBreastPumpLocal(timer.localId, {
		ended_at: new Date().toISOString(),
		yield_left_ml: yieldLeft ?? null,
		yield_right_ml: yieldRight ?? null,
		yield_total_ml: yieldTotal ?? null,
		_sync: 'pending'
	});
	removeTimer(babyId, 'pump');
}

export async function updatePumpSide(babyId: string, side: PumpSide): Promise<void> {
	const timer = getActiveTimer(babyId, 'pump') as ActivePumpTimer | null;
	if (!timer || timer.side === side) return;
	await updateBreastPumpLocal(timer.localId, { side, _sync: 'pending' });
	timer.side = side;
}

export async function logDiaperChange(
	babyId: string,
	familyId: string | null,
	contents: DiaperContent
): Promise<void> {
	const hasPoop = contents === 'poop' || contents === 'both';
	const hasPee = contents === 'pee' || contents === 'both';
	const now = new Date().toISOString();
	const payload: LocalDiaperChange = {
		id: crypto.randomUUID(),
		baby_id: babyId,
		family_id: familyId,
		started_at: now,
		has_poop: hasPoop,
		has_pee: hasPee,
		note: null,
		created_at: now,
		_sync: 'pending'
	};
	await createDiaperChangeLocal(payload);
}

export function __resetActiveTimersForTest(): void {
	activeTimers.splice(0, activeTimers.length);
}

export function __pushActiveTimerForTest(timer: ActiveTimer): void {
	activeTimers.push(timer);
}

export async function restoreActiveTimers(babyId: string): Promise<void> {
	const [activeFeeding, activeSleep, activePump] = await Promise.all([
		getActiveFeedingSessionLocal(babyId),
		getActiveSleepSessionLocal(babyId),
		getActiveBreastPumpSessionLocal(babyId)
	]);

	if (activeFeeding && !getActiveTimer(babyId, 'feed')) {
		activeTimers.push({
			type: 'feed',
			localId: activeFeeding.id,
			babyId,
			startedAt: new Date(activeFeeding.started_at),
			side: activeFeeding.side
		});
	}

	if (activeSleep && !getActiveTimer(babyId, 'sleep')) {
		activeTimers.push({
			type: 'sleep',
			localId: activeSleep.id,
			babyId,
			startedAt: new Date(activeSleep.started_at),
			headSide: activeSleep.side
		});
	}

	if (activePump && !getActiveTimer(babyId, 'pump')) {
		activeTimers.push({
			type: 'pump',
			localId: activePump.id,
			babyId,
			startedAt: new Date(activePump.started_at),
			side: activePump.side
		});
	}
}
