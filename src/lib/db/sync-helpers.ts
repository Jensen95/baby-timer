/**
 * Resolve the family a pending local row should sync under.
 *
 * Rows created before their family was known — guest data, or a row created in
 * the brief window before family resolution completes — carry
 * `family_id === null`. The sync engine must NOT skip these: skipping means they
 * never reach the database, and a child session written afterwards then fails
 * its `baby_id` foreign key because the parent baby was never synced. Instead,
 * adopt such a row into the user's active family. Returns `null` only when there
 * is no family to adopt into yet (e.g. a guest with no family at all), in which
 * case the row stays local until a family exists.
 */
export function resolveSyncFamilyId(
	rowFamilyId: string | null,
	activeFamilyId: string | null
): string | null {
	return rowFamilyId ?? activeFamilyId;
}

/**
 * A session row (feeding/sleep/pump/diaper) carries a `baby_id` foreign key, so
 * it can only be pushed once its parent baby exists in the remote DB. Pushing a
 * session before the baby has synced fails with Postgres error 23503
 * ("Key is not present in table babies"). The baby is only known to be in the
 * remote DB once its local copy is marked `_sync: 'synced'`; a missing or still
 * `pending` baby means we must hold the session back for a later pass.
 */
export function babyReadyForSessionPush(
	baby: { _sync: 'pending' | 'synced' } | undefined | null
): boolean {
	return baby?._sync === 'synced';
}

/** Postgres SQLSTATE for a foreign-key violation. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * True when a PostgREST error is a foreign-key violation. After
 * `babyReadyForSessionPush` has already gated on the baby being synced, a 23503
 * on a session push means the baby was marked synced locally but never actually
 * landed remotely — the signal to re-queue the baby and retry the session.
 */
export function isForeignKeyViolation(error: { code?: string | null } | null | undefined): boolean {
	return error?.code === FOREIGN_KEY_VIOLATION;
}
