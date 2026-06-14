import { describe, it, expect } from 'vitest';
import { resolveRedirectBase } from './redirect';

describe('resolveRedirectBase', () => {
	it('returns window origin when no override is set', () => {
		expect(resolveRedirectBase(undefined, 'http://localhost:5173')).toBe('http://localhost:5173');
	});

	it('returns the override URL when set, ignoring window origin', () => {
		expect(resolveRedirectBase('http://localhost:4173', 'https://prod.example.com')).toBe(
			'http://localhost:4173'
		);
	});

	it('strips trailing slash from override URL', () => {
		expect(resolveRedirectBase('http://localhost:4173/', 'https://prod.example.com')).toBe(
			'http://localhost:4173'
		);
	});

	it('strips trailing slash from window origin', () => {
		expect(resolveRedirectBase(undefined, 'https://prod.example.com/')).toBe(
			'https://prod.example.com'
		);
	});

	it('treats empty string override as unset, falling back to window origin', () => {
		expect(resolveRedirectBase('', 'http://localhost:5173')).toBe('http://localhost:5173');
	});

	it('treats whitespace-only override as unset, falling back to window origin', () => {
		expect(resolveRedirectBase('   ', 'http://localhost:5173')).toBe('http://localhost:5173');
	});

	it('returns empty string when both override and window origin are undefined', () => {
		expect(resolveRedirectBase(undefined, undefined)).toBe('');
	});
});
