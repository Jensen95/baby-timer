# Baby Timer — Developer Guide

## Project Overview

A family baby tracker built with SvelteKit 2 + Svelte 5 (runes), Supabase (Auth + PostgreSQL + Realtime), deployed as a static SPA on GitHub Pages.

**Stack:** SvelteKit 2 · Svelte 5 (runes) · TypeScript strict · Supabase JS · Bulma CSS · Vitest · Playwright

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
| `npm run test:integration`                                             | Playwright E2E                     |
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

## Database Conventions

- All tables are in the `public` schema with RLS enabled
- Session tables (`feeding_sessions`, `sleep_sessions`) have a denormalized `family_id` for fast, simple RLS
- `duration_seconds` is a **generated column** — never set it in INSERT/UPDATE
- Entitlement/access is family-based via `family_members` join table
- Never mirror `GENERATED ALWAYS` columns into Dexie — omit them from local schemas entirely (local interfaces correctly omit `duration_seconds`)

## Testing Philosophy

Test **pure business logic functions**, not component internals or Supabase API calls.

- ✅ `formatDuration(3661)` → `'1h 1m 1s'`
- ✅ `buildFeedingPayload({ babyId, side, startedAt })` → correct insert shape
- ✅ Timer start/stop state transitions
- ❌ "the button renders with class X"
- ❌ "Supabase.from().insert() was called"

## Conventions

- **Indentation:** tabs
- **Quotes:** single
- **Line width:** 100 chars
- **Svelte:** runes syntax (`$state`, `$derived`, `$effect`, `$props()`, `{@render}`)
- **No comments** unless the WHY is non-obvious
