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

## CI failure protocol

When CI fails and logs are not accessible:

1. **Do not guess.** Do not fix things that pass locally and hope one lands. Each bad guess = a wasted push + revert.
2. **Ask the user for the error text first.** GitHub Actions logs require auth; WebFetch on Actions pages parses JS-rendered HTML and is unreliable — do not trust it.
3. **Only fix what is confirmed broken.** Reproduce locally before pushing a fix. If you cannot reproduce, say so and ask.

Known CI log access limitations in this environment:

- `gh` CLI is not available
- `WebFetch` cannot read authenticated GitHub pages (returns error HTML that looks like real content)
- GitHub REST API `/actions/jobs/{id}/logs` requires auth and returns 403
- The GitHub MCP tools do not expose raw job log content
