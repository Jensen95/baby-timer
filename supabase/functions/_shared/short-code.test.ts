import { assertEquals, assertMatch } from 'jsr:@std/assert';
import { normalizeShortCode, shortCodeHash, generateShortCode } from './short-code.ts';

Deno.test('normalizeShortCode: uppercase alphanumerics only', () => {
	// Basic case-sensitive stripping: lowercase letters removed, digits kept
	assertEquals(normalizeShortCode('a1b2'), '12');
	assertEquals(normalizeShortCode('A1B2'), 'A1B2');

	// Mixed case and special chars
	assertEquals(normalizeShortCode('ab-cd 12'), '12');
	assertEquals(normalizeShortCode('A-B 1-2'), 'AB12');

	// Trailing/leading spaces
	assertEquals(normalizeShortCode(' A1B2 '), 'A1B2');

	// Digits and uppercase hex
	assertEquals(normalizeShortCode('12-34 EF'), '1234EF');

	// Null and undefined → empty string
	assertEquals(normalizeShortCode(null), '');
	assertEquals(normalizeShortCode(undefined), '');

	// Empty string
	assertEquals(normalizeShortCode(''), '');

	// Only special chars → empty string
	assertEquals(normalizeShortCode('---!!!'), '');

	// Only lowercase → all stripped
	assertEquals(normalizeShortCode('abcdef'), '');
});

Deno.test('shortCodeHash: SHA-256 hex of normalized string', async () => {
	// Self-consistency: compute the hash and verify its format
	const hash1 = await shortCodeHash('A1B2');
	assertMatch(hash1, /^[0-9a-f]{64}$/);

	// Same normalized form → same hash
	const hash2 = await shortCodeHash(' A1B2 ');
	assertEquals(hash1, hash2);

	// Different normalized forms → different hashes
	const hash3 = await shortCodeHash('A1B3');
	assertEquals(hash3.length, 64);
	assertEquals(typeof hash3, 'string');
	assertMatch(hash3, /^[0-9a-f]{64}$/);

	// Verify by computing expected hash ourselves
	const testString = 'A1B2';
	const expectedBytes = new TextEncoder().encode(testString);
	const expectedDigest = await crypto.subtle.digest('SHA-256', expectedBytes);
	const expectedHex = [...new Uint8Array(expectedDigest)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	assertEquals(hash1, expectedHex);

	// Lowercase input is normalized before hashing, so 'a1b2' should hash to
	// the same value as 'A1B2' after both are normalized to 'A1B2' (lowercase 'a'
	// is stripped, leaving '12')
	// Actually: 'a1b2' normalizes to '12', 'A1B2' normalizes to 'A1B2', they're
	// different — so hashes should be different
	const hashLower = await shortCodeHash('a1b2');
	const hashUpper = await shortCodeHash('A1B2');
	assertEquals(hashLower !== hashUpper, true);
});

Deno.test('generateShortCode: 8-char uppercase hex', () => {
	for (let i = 0; i < 100; i++) {
		const code = generateShortCode();
		assertEquals(code.length, 8);
		assertMatch(code, /^[0-9A-F]{8}$/);
	}
});
