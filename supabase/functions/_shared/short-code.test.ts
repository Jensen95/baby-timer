import { match, strictEqual } from 'node:assert/strict';
import { generateShortCode, normalizeShortCode, shortCodeHash } from './short-code.ts';

Deno.test('normalizeShortCode: uppercase alphanumerics only', () => {
	// Basic case-sensitive stripping: lowercase letters removed, digits kept
	strictEqual(normalizeShortCode('a1b2'), '12');
	strictEqual(normalizeShortCode('A1B2'), 'A1B2');

	// Mixed case and special chars
	strictEqual(normalizeShortCode('ab-cd 12'), '12');
	strictEqual(normalizeShortCode('A-B 1-2'), 'AB12');

	// Trailing/leading spaces
	strictEqual(normalizeShortCode(' A1B2 '), 'A1B2');

	// Digits and uppercase hex
	strictEqual(normalizeShortCode('12-34 EF'), '1234EF');

	// Null and undefined → empty string
	strictEqual(normalizeShortCode(null), '');
	strictEqual(normalizeShortCode(undefined), '');

	// Empty string
	strictEqual(normalizeShortCode(''), '');

	// Only special chars → empty string
	strictEqual(normalizeShortCode('---!!!'), '');

	// Only lowercase → all stripped
	strictEqual(normalizeShortCode('abcdef'), '');
});

Deno.test('shortCodeHash: SHA-256 hex of normalized string', async () => {
	// Self-consistency: compute the hash and verify its format
	const hash1 = await shortCodeHash('A1B2');
	match(hash1, /^[0-9a-f]{64}$/);

	// Same normalized form → same hash
	const hash2 = await shortCodeHash(' A1B2 ');
	strictEqual(hash1, hash2);

	// Different normalized forms → different hashes
	const hash3 = await shortCodeHash('A1B3');
	strictEqual(hash3.length, 64);
	strictEqual(typeof hash3, 'string');
	match(hash3, /^[0-9a-f]{64}$/);

	// Verify by computing the expected hash ourselves
	const testString = 'A1B2';
	const expectedBytes = new TextEncoder().encode(testString);
	const expectedDigest = await crypto.subtle.digest('SHA-256', expectedBytes);
	const expectedHex = [...new Uint8Array(expectedDigest)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	strictEqual(hash1, expectedHex);

	// 'a1b2' normalizes to '12' while 'A1B2' normalizes to 'A1B2', so their
	// hashes must differ.
	const hashLower = await shortCodeHash('a1b2');
	const hashUpper = await shortCodeHash('A1B2');
	strictEqual(hashLower !== hashUpper, true);
});

Deno.test('generateShortCode: 8-char uppercase hex', () => {
	for (let i = 0; i < 100; i++) {
		const code = generateShortCode();
		strictEqual(code.length, 8);
		match(code, /^[0-9A-F]{8}$/);
	}
});
