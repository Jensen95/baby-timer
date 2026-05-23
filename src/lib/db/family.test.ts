import { describe, it, expect } from 'vitest';
import { getMemberDisplayLabel } from './family';

const base = {
	user_id: 'user-abc',
	display_name: null,
	email: null
};

describe('getMemberDisplayLabel', () => {
	it('prefers display_name when set', () => {
		expect(
			getMemberDisplayLabel({ ...base, display_name: 'Alice', email: 'alice@example.com' })
		).toBe('Alice');
	});

	it('falls back to email when display_name is null', () => {
		expect(getMemberDisplayLabel({ ...base, email: 'bob@example.com' })).toBe('bob@example.com');
	});

	it('falls back to user_id when both display_name and email are null', () => {
		expect(getMemberDisplayLabel({ ...base })).toBe('user-abc');
	});

	it('returns "Unknown" when all fields are null', () => {
		expect(getMemberDisplayLabel({ user_id: null, display_name: null, email: null })).toBe(
			'Unknown'
		);
	});

	it('uses email invite placeholder (no user_id) correctly', () => {
		expect(
			getMemberDisplayLabel({ user_id: null, display_name: null, email: 'invited@example.com' })
		).toBe('invited@example.com');
	});
});
