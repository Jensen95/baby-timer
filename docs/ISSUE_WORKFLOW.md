# Issue-Solving Workflow

A repeatable, end-to-end process for taking any GitHub issue in `jensen95/baby-timer`
from triage to a merged, **verified** fix. Follow every phase in order — the hard rule
is that nothing is called "fixed" until a test proves it.

> Companion docs: [`CLAUDE.md`](../CLAUDE.md) (architecture, conventions, gotchas) and
> [`README.md`](../README.md) (setup). This file is the _process_; those are the _facts_.

---

## 0. Pick up the issue

1. Read the issue in full, including every comment and linked PR/issue.
2. Restate the problem in one sentence and the **observable** expected behaviour.
   If you can't state how to observe success, the issue is underspecified — ask the
   reporter before writing code.
3. Label your understanding of the type, since it changes the workflow:
   - **Bug** — something behaves wrong. Reproduce it first (Phase 2).
   - **Enhancement / feature** — new behaviour. Define acceptance criteria first.
   - **UX / polish** (e.g. #91) — capture a before/after; a screenshot is the deliverable.
   - **Question / discussion** — answer in a comment; usually no branch.

## 1. Branch

- One branch per issue: `fix/<slug>`, `feat/<slug>`, `chore/<slug>`, or `refactor/<slug>`.
  (Agent sessions use the pre-assigned `claude/<task>` branch — see CLAUDE.md.)
- Branch off the latest `main`: `git fetch origin main && git switch -c fix/<slug> origin/main`.
- Never commit straight to `main`.

## 2. Reproduce (bugs) / specify (features) — _before touching source_

- **Reproduce the bug.** Find the smallest path that triggers it. If you cannot
  reproduce, you cannot prove a fix — keep digging or ask for repro steps.
  Prefer a **failing test** as the reproduction (see Phase 4); a red test is the
  cleanest possible repro.
- **For features**, write the acceptance criteria as a checklist in the issue or PR
  so "done" is unambiguous.
- Locate the real layer the change belongs in. This is a layered app:
  - Pure logic → `src/lib/timer/`, `src/lib/sessions/`, `src/lib/insights/`
  - Data access (only place that touches Supabase) → `src/lib/db/`
  - Local-first cache / sync → `src/lib/db/local*.ts`, `src/lib/db/sync.svelte.ts`
  - UI → `src/lib/components/`, `src/routes/`
  - Schema / RLS → `supabase/migrations/` (+ regenerate `database.types.ts`)
    Fix the cause at its proper layer, not the symptom in the UI.

## 3. Implement

- Match surrounding style: tabs, single quotes, 100-col, Svelte 5 runes only
  (`$state`/`$derived`/`$effect`/`$props`) — **no legacy stores**.
- Mind the documented gotchas in CLAUDE.md, especially:
  - **`SessionType` mismatch**: UI uses `'feed' | 'sleep' | 'pump' | 'diaper'`;
    DB/`LocalSession` use `'feeding' | 'sleep' | 'breast_pump' | 'diaper_change'`.
  - **Generated columns** (`duration_seconds`) are never written or mirrored locally.
  - **Family model**: access is family-scoped via `family_members` (joined members
    only). Sessions carry a denormalized `family_id` for RLS.
  - **Static SPA**: `ssr = false`; data loads in `$effect`/handlers, never on a server.
- DB change? Add a migration, enable RLS + Realtime where relevant, and update
  `src/lib/db/database.types.ts` (or `supabase gen types`).
- Package change? Run `npm install` and **commit the updated `package-lock.json`**
  (`npm ci` in CI fails on a stale lockfile).

## 4. Prove it — the non-negotiable phase

> **An issue is not fixed until a test demonstrates the fix.** Prefer a test that
> fails before the change and passes after.

Test at the level the bug lives (see CLAUDE.md "Testing Philosophy"):

- **Pure logic** → Vitest unit test (`*.test.ts` next to the code).
  `formatDuration(3661) → '1h 1m 1s'`, payload mappers, timer transitions.
- **User-visible behaviour, flows, sync, persistence** → Playwright E2E in `tests/`.
  E2E runs against a static build with a **mocked Supabase** (`page.route` for
  `**/auth/v1/**` and `**/rest/v1/**`); seed local state via `localStorage` /
  IndexedDB. See `tests/family-event-sharing.test.ts` for the pattern of simulating
  an authenticated user and a mocked backend with **no Realtime** available.
- Don't test framework/Supabase internals ("the button has class X", "`.insert()`
  was called").

**Validate the test, not just the code.** Confirm the new test _fails_ on the old
behaviour (temporarily revert the fix, watch it go red, then restore). A test that
passes regardless proves nothing.

> Gotcha: Playwright reuses a running preview server locally (`reuseExistingServer`).
> After changing source, kill the old server / `npm run build` before re-running, or
> you'll test a stale bundle.

## 5. Run the full gate locally

Mirror CI (`.github/workflows/ci.yml`) before pushing:

```bash
npm run lint          # prettier --check + eslint
npm run check         # svelte-check / TypeScript
npm run test:unit -- --run
npm run test:integration   # Playwright
# If you touched supabase/functions:
# deno fmt --check && deno lint && deno check api/index.ts && deno test _shared/
```

All green, or it's not ready.

## 6. Commit & push

- Small, focused commits with imperative messages explaining **why**:
  `fix: pull family session events in syncNow so they sync without Realtime`.
- Reference the issue (`Fixes #NN`) so it auto-closes on merge.
- `git push -u origin <branch>` (retry with backoff on transient network errors).

## 7. PR (only when asked)

- Open a PR **only if the user explicitly requests one.**
- PR body: what changed, why, the root cause, and **how it was verified** (name the
  test and the before/after). Add a screenshot for any UI/UX issue.
- After CI runs, drive it to green: read the failure, re-diagnose, fix, push again.
  (No `gh` CLI here — use the GitHub MCP tools; if CI logs are inaccessible, ask the
  reporter to paste the error rather than guessing.)
- Address review comments; if a comment is ambiguous or architectural, ask before
  acting.

## 8. Close the loop

- Confirm the issue's acceptance criteria are all met and checked off.
- Note any follow-ups or out-of-scope discoveries as new issues rather than
  expanding the current one.

---

## Quick checklist

- [ ] Understood the issue; expected behaviour is observable
- [ ] Branch off latest `main`
- [ ] Reproduced the bug (ideally as a failing test) / wrote acceptance criteria
- [ ] Fixed at the correct layer, following conventions & gotchas
- [ ] Migration + `database.types.ts` updated (if schema changed)
- [ ] `package-lock.json` committed (if deps changed)
- [ ] Test added; **verified it fails without the fix and passes with it**
- [ ] `lint` + `check` + unit + E2E all green locally
- [ ] Focused commits referencing the issue, pushed to the feature branch
- [ ] (If requested) PR opened with root cause + verification; CI green
