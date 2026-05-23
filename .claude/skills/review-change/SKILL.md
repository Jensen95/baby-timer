# Review Change Skill

## Trigger phrases

"review change", "/review-change", "screenshot the changes", "take a screenshot"

## When invoked, do the following:

### 1. Determine target URLs

If positional args are given (e.g. `/review-change /app/stats`), use them as the URL list.

Otherwise, detect changed routes via:

```bash
git diff --name-only $(git merge-base origin/main HEAD)...HEAD
```

Route-to-URL mapping:

- `src/routes/(app)/app/+page.svelte` → `/app`
- `src/routes/(app)/app/<x>/+page.svelte` → `/app/<x>`
- `src/routes/+page.svelte` → `/`
- `src/routes/(auth)/login/+page.svelte` → `/login`

If any shared file changed (`+layout.svelte`, `app.scss`, `variables.scss`, or anything under `src/lib/components/`), use the default list: `[/app, /app/history, /app/stats]`.

Fallback default: `[/app, /app/history, /app/stats]`.

### 2. Compute the screenshots branch name

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SCREENSHOTS_BRANCH="screenshots/$(echo "$BRANCH" | tr '/' '-')"
```

Example: `claude/dexie-offline-sync-pwa-DYe7x` → `screenshots/claude-dexie-offline-sync-pwa-DYe7x`

### 3. Start the dev server

Test whether `http://localhost:5173` is already responding. If it is, reuse it.

Otherwise start it and poll until the port responds:

```bash
npm run dev &
DEV_PID=$!
until curl -s http://localhost:5173 > /dev/null; do sleep 1; done
```

Kill the server at cleanup if you started it.

The 2-second settle wait (step 4) is intentional — `ssr=false` means content only appears after JS hydration.

### 4. Screenshot each URL

Use Playwright CLI. Slug = URL with `/` replaced by `-`, leading `-` stripped.

```bash
npx playwright screenshot --browser=chromium \
  --wait-for-timeout=2000 \
  "http://localhost:5173<URL>" \
  "/tmp/screenshots/<slug>.png"
```

Example: `/app/history` → slug `app-history` → file `app-history.png`

### 5. Commit screenshots via a git worktree (images only, orphan branch)

Never touch the user's working tree. Always build a true orphan so the screenshots branch contains **only images** — no code, no history:

```bash
TMPWT=$(mktemp -d)

# Detach then create a fresh orphan every time.
# Never reuse an existing screenshots branch (that carries history/code).
git worktree add --detach "$TMPWT"
cd "$TMPWT"
git checkout --orphan "$SCREENSHOTS_BRANCH"
git reset --hard   # orphan inherits the prior index; wipe it
git clean -fdx     # remove any stray files — only screenshots go in

mkdir -p .screenshots
cp /tmp/screenshots/*.png .screenshots/

git add .screenshots/
git commit -m "chore: screenshots for $BRANCH"

# Force-push the single orphan commit — remote ref has exactly one commit
# with only the images, regardless of what was there before.
git push --force origin "HEAD:$SCREENSHOTS_BRANCH"

cd - >/dev/null
git worktree remove --force "$TMPWT"
```

Only ever force-push to `screenshots/*` refs — never to `main` or the user's feature branch.

### 6. Output markdown image links

Emit one `![slug](raw-url)` line per screenshot so they render inline in PR comments:

```
![app](https://raw.githubusercontent.com/Jensen95/baby-timer/<SCREENSHOTS_BRANCH>/.screenshots/app.png)
![app-history](https://raw.githubusercontent.com/Jensen95/baby-timer/<SCREENSHOTS_BRANCH>/.screenshots/app-history.png)
```

Replace `<SCREENSHOTS_BRANCH>` with the actual branch name computed in step 2.

## Constraints

- Only force-push to `screenshots/*` refs — never to `main` or the user's branch.
- The 2-second wait in step 4 is intentional: `ssr=false` means the page hydrates after JS load.
- The repository must be public for `raw.githubusercontent.com` URLs to render in PR comments.
- The sanitization rule (`/` → `-`) must match the companion cleanup workflow exactly.
