import { describe, it, expect } from 'vitest';
import {
	resolveSyncFamilyId,
	babyReadyForSessionPush,
	isForeignKeyViolation
} from './sync-helpers';

describe('resolveSyncFamilyId', () => {
	it("keeps the row's own family when it is set", () => {
		expect(resolveSyncFamilyId('fam-1', 'active-2')).toBe('fam-1');
	});

	it('adopts an orphaned (null) row into the active family instead of skipping it', () => {
		// Regression guard: the old code did `if (!family_id) continue`, so a row
		// with a null family_id was never pushed — babies vanished and child
		// sessions later failed their baby_id foreign key.
		expect(resolveSyncFamilyId(null, 'active-2')).toBe('active-2');
	});

	it('returns null only when there is no family to adopt into', () => {
		expect(resolveSyncFamilyId(null, null)).toBeNull();
	});
});

describe('babyReadyForSessionPush', () => {
	it('is true only once the parent baby is confirmed synced', () => {
		expect(babyReadyForSessionPush({ _sync: 'synced' })).toBe(true);
	});

	it('holds the session back while the baby is still pending', () => {
		// Regression guard for the FK 23503 ("Key is not present in table babies"):
		// a session must not be pushed before its offline-created baby has synced.
		expect(babyReadyForSessionPush({ _sync: 'pending' })).toBe(false);
	});

	it('holds the session back when the baby is missing locally', () => {
		expect(babyReadyForSessionPush(undefined)).toBe(false);
		expect(babyReadyForSessionPush(null)).toBe(false);
	});
});

describe('isForeignKeyViolation', () => {
	it('detects the Postgres 23503 foreign-key-violation code', () => {
		expect(isForeignKeyViolation({ code: '23503' })).toBe(true);
	});

	it('ignores other errors and nullish input', () => {
		expect(isForeignKeyViolation({ code: '23505' })).toBe(false);
		expect(isForeignKeyViolation(null)).toBe(false);
		expect(isForeignKeyViolation(undefined)).toBe(false);
	});
});
