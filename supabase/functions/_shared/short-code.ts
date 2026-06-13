// TypeScript port of the Postgres short-code helpers from
// 20260527120000_qr_invites_and_device_link.sql. These MUST stay byte-for-byte
// compatible with the SQL functions so that codes created/hashed by the
// database and by the edge functions are interchangeable during the migration.

const NON_CODE_CHARS = /[^A-Z0-9]/g;

/**
 * Mirrors public.normalize_short_code:
 *   upper(regexp_replace(raw, '[^A-Z0-9]', '', 'g'))
 *
 * Note the (intentional) quirk: the strip is case-SENSITIVE, so lowercase
 * letters are removed *before* upper-casing. Generated codes only ever contain
 * 0-9 and A-F, so this is a no-op for them, but we replicate it exactly to keep
 * the hash identical to the DB function.
 */
export function normalizeShortCode(raw: string | null | undefined): string {
	return (raw ?? '').replace(NON_CODE_CHARS, '').toUpperCase();
}

/**
 * Mirrors public.short_code_hash:
 *   encode(digest(normalize_short_code(raw), 'sha256'), 'hex')
 */
export async function shortCodeHash(raw: string): Promise<string> {
	const bytes = new TextEncoder().encode(normalizeShortCode(raw));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mirrors public.generate_short_code:
 *   upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
 * 6 random bytes -> 12 hex chars -> first 8 -> uppercase.
 */
export function generateShortCode(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
	return hex.slice(0, 8).toUpperCase();
}
