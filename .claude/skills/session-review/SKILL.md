# Session Review Skill

## Trigger phrases

"review this session", "wrap up", "what did we do", "session summary"

## When invoked, do the following:

1. Run quality checks:

   ```bash
   npm run check
   npm run lint
   npm run test:unit
   ```

2. Show git diff summary:

   ```bash
   git diff --stat HEAD
   ```

3. Report:
   - Files changed and their purpose
   - Any check/lint/test failures
   - Suggested next steps based on the plan

## Improvement suggestions to consider

- Are there untested pure functions in `src/lib/`?
- Are Svelte 5 runes used (not legacy stores)?
- Are all new tables in `supabase/migrations/` covered by RLS?
- Is `src/lib/db/database.types.ts` up to date with migrations?
- Are new components purely presentational (no data fetching)?
- Do E2E tests assert data survives reload (e.g. visible data after `page.reload()`), not just that the shell renders?
- Is `package-lock.json` in sync? Run `npm install` and check for diff — stale lockfiles break `npm ci` in CI.
