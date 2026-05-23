import Dexie, { type Table } from 'dexie';

export interface LocalBaby {
	id: string;
	family_id: string | null;
	name: string;
	birth_date: string | null;
	created_at: string;
	_sync: 'pending' | 'synced';
}

export interface LocalFeeding {
	id: string;
	baby_id: string;
	family_id: string | null;
	side: 'left' | 'right' | 'both';
	started_at: string;
	ended_at: string | null;
	note: string | null;
	created_at: string;
	_sync: 'pending' | 'synced';
}

export interface LocalSleep {
	id: string;
	baby_id: string;
	family_id: string | null;
	side: 'left' | 'right' | 'back' | 'tummy';
	started_at: string;
	ended_at: string | null;
	note: string | null;
	created_at: string;
	_sync: 'pending' | 'synced';
}

export interface LocalBreastPump {
	id: string;
	baby_id: string;
	family_id: string | null;
	side: 'left' | 'right' | 'both';
	started_at: string;
	ended_at: string | null;
	yield_left_ml: number | null;
	yield_right_ml: number | null;
	note: string | null;
	created_at: string;
	_sync: 'pending' | 'synced';
}

export interface LocalFamily {
	id: string;
	name: string;
	created_at: string;
}

class BabyTimerDB extends Dexie {
	babies!: Table<LocalBaby>;
	feeding_sessions!: Table<LocalFeeding>;
	sleep_sessions!: Table<LocalSleep>;
	breast_pump_sessions!: Table<LocalBreastPump>;
	families!: Table<LocalFamily>;

	constructor() {
		super('baby-timer');
		this.version(1).stores({
			babies: 'id, family_id, _sync',
			feeding_sessions: 'id, baby_id, family_id, started_at, ended_at, _sync',
			sleep_sessions: 'id, baby_id, family_id, started_at, ended_at, _sync',
			families: 'id'
		});
		this.version(2).stores({
			babies: 'id, family_id, _sync',
			feeding_sessions: 'id, baby_id, family_id, started_at, ended_at, _sync',
			sleep_sessions: 'id, baby_id, family_id, started_at, ended_at, _sync',
			breast_pump_sessions: 'id, baby_id, family_id, started_at, ended_at, _sync',
			families: 'id'
		});
	}
}

export const db = new BabyTimerDB();
