# Baby Timer

A family app for tracking baby feeding and sleep sessions in real time.

## Features

- **Feeding timer** — track duration + which breast (left/right/both)
- **Sleep timer** — track duration + head position (back/tummy/left/right)
- **Real-time sync** — both parents see live updates via Supabase Realtime
- **Family sharing** — invite your partner, share baby data securely
- **Session history** — browse past sessions
- **Stats** — 7-day summary charts

## Stack

| Layer    | Technology                                               |
| -------- | -------------------------------------------------------- |
| Frontend | SvelteKit 2 + Svelte 5 (runes)                           |
| Styling  | Bulma CSS                                                |
| Backend  | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Hosting  | GitHub Pages (static SPA)                                |
| CI/CD    | GitHub Actions                                           |

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations

### Setup

1. Clone the repo.
1. Install dependencies.

```bash
npm install
```

1. Create a `.env.local` file.

```dotenv
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_BUGSINK_DSN=
```

1. Push database migrations.

```bash
supabase db push
```

1. Start the dev server.

```bash
npm run dev
```

### Deploy to GitHub Pages

1. Fork this repo
2. Add repository secrets in GitHub Settings → Secrets:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_BUGSINK_DSN`
3. Enable GitHub Pages in Settings → Pages → Source: GitHub Actions
4. Push to `main` — the deploy workflow runs automatically

### Supabase Edge Function secrets

Set Bugsink DSN for edge-function error reporting:

```bash
supabase secrets set BUGSINK_DSN=https://9848e4f8dff34803bebb3dda44439340@jensen.bugsink.com/1
```

## Development

```bash
npm run dev          # dev server
npm run check        # TypeScript + Svelte type check
npm run lint         # ESLint + Prettier
npm run test:unit    # Vitest unit tests (36 tests)
npm run build        # Static build
```

## Database migrations

```bash
supabase db push                                              # Apply migrations
supabase gen types typescript --local > src/lib/db/database.types.ts  # Regen types
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for full developer documentation including:

- Route structure
- Where business logic lives
- Database conventions and RLS patterns
- Testing philosophy
