# Baby Timer — Developer Guide

## Project Overview

A family baby tracker built with SvelteKit 2 + Svelte 5 (runes), Supabase (Auth + PostgreSQL + Realtime), deployed as a static SPA on GitHub Pages.

**Stack:** SvelteKit 2 · Svelte 5 (runes) · TypeScript strict · Supabase JS · Token CSS · Vitest · Playwright

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

## Commands

| Command                                                                | Description                        |
| ---------------------------------------------------------------------- | ---------------------------------- |
| `npm run dev`                                                          | Dev server (http://localhost:5173) |
| `npm run build`                                                        | Static build → `build/`            |
| `npm run check`                                                        | TypeScript + Svelte type check     |
| `npm run lint`                                                         | Prettier check + ESLint            |
| `npm run format`                                                       | Auto-format all files              |
| `npm run test:unit`                                                    | Vitest unit tests                  |
| `npm run test:integration`                                             | Playwright E2E (hermetic, mocked)  |
| `npm run test:supabase`                                                | Integration tests vs real Supabase |
| `supabase db push`                                                     | Push migrations to Supabase        |
| `supabase gen types typescript --local > src/lib/db/database.types.ts` | Regen DB types                     |

## Architecture

### Route structure

```
src/routes/
  +layout.svelte        # Root shell: init Supabase auth context
  +layout.ts            # prerender=true, ssr=false (global)
  +page.svelte          # Landing page
  (auth)/login/         # Login page (magic link)
  (auth)/logout/        # Sign out
  (app)/                # Auth-guarded group
    +layout.svelte      # Redirects to /login if no session
    +page.svelte        # Dashboard (timers)
    history/            # Session history
    stats/              # Charts & summaries
    babies/             # Manage babies
    family/             # Manage family members
    settings/           # Profile
```

### Where logic lives

- `src/lib/timer/` — Timer factory (runes), formatters. **Pure, unit-tested.**
- `src/lib/sessions/` — Session payload mappers, validation. **Pure, unit-tested.**
- `src/lib/db/` — Supabase data-access wrappers (only place touching the client).
- `src/lib/auth/` — Auth session factory (runes), context key.
- `src/lib/components/` — Presentational Svelte components (no data fetching).

## Known Gotchas

### package-lock.json must stay in sync

After adding or changing packages in `package.json`, always run `npm install` and commit the updated `package-lock.json`. `npm ci` (used in CI) fails hard if the lockfile is stale — it does not auto-update. This is not caught locally if `node_modules` is already populated.

### CI log access

There is no `gh` CLI in this remote environment. GitHub Actions logs require authentication. `WebFetch` on Actions pages returns unreliable parsed HTML, not real log content. When CI fails: **ask the user to paste the error text** rather than guessing at the cause.

### Static SPA mode

`ssr = false` is set globally in `+layout.ts`. There is no server-side rendering. All data fetching happens in `$effect` blocks or event handlers in Svelte components.

### Svelte 5 runes only

**Never use legacy stores (`writable`, `readable`, `derived` from `svelte/store`) for new code.**
Use `$state`, `$derived`, `$effect` instead.

### Auth security note

We use `supabase.auth.getUser()` (validates JWT with Supabase server) for security-sensitive checks, NOT `getSession()` (reads unvalidated local storage). For this static SPA, Supabase RLS is the primary security boundary.

### Database types

`src/lib/db/database.types.ts` is the TypeScript representation of the Supabase schema. When you add a migration, update this file too (or run `supabase gen types typescript --local` if the local stack is running).

### RLS needs GRANTs too (cross-member sharing)

RLS only _restricts_ access — it never _grants_ it. A new `public` table needs
**both** a permissive RLS policy **and** a table-level `GRANT` to `authenticated`
(and `service_role`) before PostgREST or Realtime can touch it. Supabase's
implicit default privileges do **not** include select/insert/update/delete on the
current Postgres images, so a policy-only table returns "permission denied" — and
because the app is offline-first, the author still sees their own rows from Dexie
while other family members see nothing. `20260614120000_grant_table_privileges.sql`
grants DML and sets matching default privileges; keep new tables covered.
Realtime is RLS-filtered per row, so the socket must be authenticated
(`supabase.realtime.setAuth(token)`) or every change is dropped as `anon`.
`npm run test:supabase` is the regression guard (two real members, one family).

### Reproducing RLS/Realtime bugs locally

Mocks won't catch them — use the real stack. Start Docker (`sudo dockerd &` in
this sandbox), then `supabase start -x edge-runtime,studio,imgproxy,storage-api,vector,supavisor,pooler`
— edge-runtime hits an rlimit error in the sandbox, and db/auth/rest/realtime are
all `test:supabase` needs.

### Integration tests live outside `src`

`tests-integration/` (run via `npm run test:supabase`) has its own
`vitest.integration.config.ts` **and** a standalone `tsconfig.json`. Don't make it
extend the root tsconfig — that extends `.svelte-kit/tsconfig.json`, which oxc
cannot resolve for files outside `src` (build fails with "Tsconfig not found").
The separate config is deliberate.

## Database Conventions

- All tables are in the `public` schema with RLS enabled
- Session tables (`feeding_sessions`, `sleep_sessions`) have a denormalized `family_id` for fast, simple RLS
- `duration_seconds` is a **generated column** — never set it in INSERT/UPDATE
- Entitlement/access is family-based via `family_members` join table
- Never mirror `GENERATED ALWAYS` columns into Dexie — omit them from local schemas entirely (local interfaces correctly omit `duration_seconds`)
- The UI layer uses `SessionType = 'feed' | 'sleep' | 'pump' | 'diaper'` (`$lib/types`); DB/`LocalSession` types are `'feeding' | 'sleep' | 'breast_pump' | 'diaper_change'`. Sub-agent briefs must include this distinction explicitly.

## Testing Philosophy

Test **pure business logic functions**, not component internals or Supabase API calls.

- ✅ `formatDuration(3661)` → `'1h 1m 1s'`
- ✅ `buildFeedingPayload({ babyId, side, startedAt })` → correct insert shape
- ✅ Timer start/stop state transitions
- ❌ "the button renders with class X"
- ❌ "Supabase.from().insert() was called"

Two cross-cutting rules learned the hard way:

- Offline-first hides remote write failures from the author (Dexie still shows their own data). Never accept single-account "works for me" as proof of sharing/sync — validate cross-account (that is what `test:supabase`'s two-member fixture is for).
- ⚠️ Don't assert on a not-yet-synced or empty state as if it were correct — a test that waits for "empty" can lock in the very bug you later fix (fixing it then "breaks" the test). Assert on the synced/populated outcome.

## Agent delegation

When breaking work into sub-agents, fan out **in parallel** by default — send multiple `Agent`
tool calls in one message. Sequential calls are only correct when one output feeds the next.

Pick the model for the task:

- **Opus** — complex analysis, code review, architecture decisions, pressure-testing learnings
- **Sonnet** — implementation, debugging, refactoring, writing (default)
- **Haiku** — fast lookups, grep, summarising, formatting checks
- After a worktree agent reports success, verify by reading the actual file in the main working tree — agents can push to their own worktree branch rather than the feature branch, silently not landing changes.

## Conventions

- **Indentation:** tabs
- **Quotes:** single
- **Line width:** 100 chars
- **Svelte:** runes syntax (`$state`, `$derived`, `$effect`, `$props()`, `{@render}`)
- **No comments** unless the WHY is non-obvious
