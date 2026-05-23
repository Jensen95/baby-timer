# Pre-Push Skill

## Trigger phrases

Fire on intent, not exact wording. Load this skill when the user wants a **quality gate before
sharing work** — verifying the change is correct, conventional, and CI-safe. Examples:

- "before we push", "ready to push", "ready to merge", "push to CI"
- "are we ready", "are we good", "is everything good", "did we miss anything"
- "double check", "check everything", "review the diff", "review the change"
- "pre-push", "pre-commit", "lint and test", "run the checks"

This is a code/diff check. If the user instead wants to reflect on _how the session went_ and
capture learnings, that is the **session-review** skill — use that instead.

When unsure whether a phrase fits this skill, prefer to run it — it's a cheap, read-mostly check.

## Purpose

A **pre-push / pre-commit quality gate**. Catch problems before they hit CI or review, and verify
the change respects this project's conventions. Run the checks, then actively walk the checklist
against the actual diff and call out anything that's off.

## When invoked, do the following:

### 1. Establish what changed

```bash
git diff --stat HEAD
git diff --name-only $(git merge-base origin/main HEAD)...HEAD
```

Use this to scope the rest of the review to the files actually touched.

### 2. Run the quality gate

```bash
npm run check
npm run lint
npm run test:unit
```

Then verify the lockfile is in sync (stale `package-lock.json` breaks `npm ci` in CI):

```bash
npm install
git diff --stat package-lock.json
```

A non-empty diff means the lockfile drifted — flag it and stage the regenerated file.

### 3. Review the diff against project conventions

For each item, look at the actual changed files — don't answer from memory:

- **Untested logic:** new/changed pure functions in `src/lib/` (timer, sessions) should have
  Vitest coverage. Flag anything pure and untested.
- **Runes only:** no `writable`/`readable`/`derived` from `svelte/store` in new code — must use
  `$state` / `$derived` / `$effect`.
- **RLS:** every new table in `supabase/migrations/` must `enable row level security` and carry a
  family-scoped policy.
- **DB types:** if migrations changed, `src/lib/db/database.types.ts` must reflect them.
- **Component purity:** new components in `src/lib/components/` should be presentational — no
  Supabase calls or data fetching.
- **E2E durability:** new Playwright tests should assert data survives a `page.reload()`, not just
  that the shell renders.

### 4. Act on what you find

- **Fix small, safe, in-scope issues directly:** add a missing test for a pure function,
  regenerate the lockfile, update `database.types.ts`, swap a legacy store for a rune. Re-run the
  relevant check after fixing.
- **Flag larger or risky issues, don't silently fix them:** missing RLS, data-fetching in a
  presentational component, a failing test whose intent is unclear. Describe the problem and
  propose a fix; let the user decide.
- **Never** commit or push — that's the user's call.

### 5. Report

A tight summary:

- Files changed and their purpose (one line each)
- Gate results: check / lint / test / lockfile — pass or the exact failure
- Issues found, split into **fixed** (what you did) and **needs attention** (what to decide)
- Suggested next step (e.g. "ready to push", or "add RLS to `x` first")
