export interface LocalSession {
	id: string;
	type: 'feeding' | 'sleep' | 'breast_pump' | 'diaper_change';
	baby_id: string;
	family_id: string | null;
	started_at: string;
	ended_at: string | null;
	side?: string | null;
	has_poop?: boolean;
	has_pee?: boolean;
	yield_left_ml?: number | null;
	yield_right_ml?: number | null;
	yield_total_ml?: number | null;
	note?: string | null;
	_sync?: 'pending' | 'synced';
}
