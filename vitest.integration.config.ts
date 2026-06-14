import { defineConfig } from 'vitest/config';

// Integration tests run against a REAL local Supabase stack (`supabase start`),
// not the hermetic mocks used by the unit/e2e suites. They are kept in their own
// directory and config so the default `npm run test:unit` (which has no database)
// never tries to run them.
export default defineConfig({
	test: {
		include: ['tests-integration/**/*.test.ts'],
		environment: 'node',
		// Spinning up auth users + waiting on Realtime delivery is slower than a unit
		// test; give each test room without being flaky.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// Two members mutate the same family; run serially for deterministic state.
		fileParallelism: false
	}
});
