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
