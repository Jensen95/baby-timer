# Session Review Skill

## Trigger phrases

Fire on intent, not exact wording. Load this skill when the user wants to **reflect on how the
session went** and capture durable learnings — a retrospective on the conversation, not a review
of the code. Examples:

- "review this session", "let's do a retro", "retrospective", "post-mortem"
- "what did we learn", "any learnings", "lessons from this session"
- "what should we remember", "capture this for next time", "save what we learned"
- "what went well / badly", "where did you get stuck", "what was confusing"
- "update CLAUDE.md / the skills with what we learned"

This is NOT a code-quality or pre-push check. If the user wants `check`/`lint`/`test`, a diff
review, or a "are we ready to push" gate, that is the **pre-push** skill — use that instead.
If the user wants to create or rewrite a skill file, that is the **skill-authoring** skill.

## Purpose

A meta-review of the **conversation itself**. Look back at how this session unfolded, extract the
learnings worth keeping, get a second opinion from Opus on which ones are worth persisting, then
write the keepers into the right place (CLAUDE.md or a skill) so future sessions don't repeat the
same mistakes. The output is updated memory, not a fixed diff.

## When invoked, do the following:

### 1. Reconstruct the session

Work from the actual conversation transcript above — not from the code, and not from memory of how
it "should" have gone. Build a short factual timeline:

- **What was asked:** the user's goals, in order, including mid-course corrections.
- **What was done:** the approach taken and the final outcome for each goal.
- **Friction points:** where you went down a wrong path, misread a convention, needed several
  attempts, asked a question you could have answered yourself, or got corrected by the user.
- **What worked:** approaches, commands, or patterns that paid off and should be repeated.

For grounding only, you may glance at what changed — but keep the focus on the conversation:

```bash
git log --oneline -10
git diff --stat HEAD
```

### 2. Draft candidate learnings

Turn the friction points and wins into concrete, reusable statements. A good learning is specific
and actionable; a bad one is a vague platitude.

- ✅ "Pure logic in `src/lib/timer` and `src/lib/sessions` must have Vitest coverage — I shipped
  an untested formatter and the user asked for the test."
- ✅ "`duration_seconds` is a generated column; including it in an INSERT fails. I tried it twice."
- ❌ "Be more careful." / "Write better tests." (not actionable, not specific)

Only keep learnings that would change behavior in a future session. Discard anything that is
already documented, one-off, or obvious. Aim for a tight list (roughly 2–6 items), not an
exhaustive log.

### 3. Consult Opus for a second opinion

Before persisting anything, get Opus to pressure-test the candidate list. Pass it the drafted
learnings and ask which are genuinely worth saving, which are redundant or too vague, and how to
phrase each one tightly. Use the `claude` CLI in print mode:

```bash
claude -p --model opus 'You are reviewing learnings from a coding session on a SvelteKit +
Supabase project, to decide what is worth persisting to long-term memory (CLAUDE.md or skill
files).

For each candidate below, judge: (a) keep, drop, or merge; (b) if keep, the tightest one-line
phrasing; (c) where it belongs — CLAUDE.md (project-wide fact/convention/gotcha) or a specific
skill file (domain-specific procedure). Flag anything vague, redundant with what is likely already
documented, or too one-off to generalize.

Candidate learnings:
<paste the numbered candidate learnings from step 2>'
```

Treat Opus's response as advice, not orders: fold in its phrasing and keep/drop calls where they
improve the list, but you own the final decision. If the `claude` CLI is unavailable, say so and
proceed with your own judgment.

### 4. Persist the keepers in the right place

Route each surviving learning by its kind. **Show the user the proposed edits and get a yes before
writing** — memory changes are durable and easy to get wrong.

- **CLAUDE.md** — project-wide facts, conventions, and gotchas that apply regardless of task.
  These are always loaded, so the bar is high: only broadly-relevant, durable items. Add to the
  matching existing section (Known Gotchas, Database Conventions, Conventions, Testing
  Philosophy) rather than creating new top-level sections.
- **`.claude/skills/<name>/SKILL.md`** — domain-specific procedures and pitfalls that only matter
  for a particular kind of work (Svelte, Supabase migrations, screenshots, pre-push). These load
  by trigger, so task-specific detail belongs here. Add to the existing skill whose domain fits;
  create a new skill only if the learning is a genuinely new, recurring workflow.
- **Neither** — if a learning is real but fits no clear home, surface it in the report and let the
  user decide. Don't force it into a file.

Keep edits surgical: one tight line or bullet in the correct section. Match the file's existing
voice and the project's conventions (tabs, single quotes, 100-char width).

### 5. Report

A tight summary:

- **Timeline:** 2–4 lines on what the session set out to do and how it went.
- **Learnings captured:** each kept learning, where it was written (file + section), and why.
- **Considered but dropped:** learnings you discarded, with the one-word reason (vague /
  redundant / one-off) — so the user can overrule.
- **Opus notes:** anything material from the second opinion worth flagging.

## Constraints

- This skill reviews the **conversation**, not the code. No `npm run check/lint/test` here — that
  is the pre-push skill's job.
- Never commit or push. Persisting learnings means editing CLAUDE.md / skill files; the user
  commits.
- Always get explicit confirmation before writing to CLAUDE.md or a skill file.
- Don't invent learnings to fill a quota. A session with nothing worth saving is a valid outcome —
  say so.

## Skill authoring conventions

- When designing **or correcting** a skill, confirm its purpose in one sentence first — patching
  symptoms without rechecking the purpose causes full rewrites.
- Skills with overlapping trigger vocabulary must cross-reference each other in their trigger
  sections (e.g. "if the user wants X instead, use the **Y** skill").
- When spawning agents to do the persisting or research work, follow the model-selection and
  parallelism rules in the **skill-authoring** skill.
