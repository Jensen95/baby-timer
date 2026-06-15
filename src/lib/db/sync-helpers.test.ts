import { describe, it, expect } from 'vitest';
import { resolveSyncFamilyId } from './sync-helpers';

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
