# Skill Authoring

## Trigger phrases

Fire on intent. Load this skill when the user wants to create, rewrite, or significantly redesign
a skill file. Examples:

- "create a skill", "new skill", "add a skill", "write a skill for X"
- "I want a skill that", "make a skill for", "add to my skills"
- "rewrite this skill", "the skill is wrong", "fix the skill"

If the user wants to reflect on how the session went and capture learnings, that is the
**session-review** skill — use that instead.

## Purpose

A guide for creating well-scoped, correctly triggered, useful `.claude/skills/*/SKILL.md` files.
The most common failure mode is writing steps before the purpose is clear — which leads to full
rewrites. Always resolve purpose before structure.

## When invoked, do the following:

### 1. State the purpose in one sentence

Before writing a single step, answer: **what specific user need does this skill serve, and what
does it explicitly NOT cover?**

If the boundary is unclear, ask the user. A bad purpose caught here costs one question. A bad
purpose caught after writing costs a full rewrite.

Examples:

- ✅ "Takes screenshots of changed routes and commits them to a dedicated orphan branch."
- ✅ "Retrospective on the conversation — extracts learnings to persist, not a code review."
- ❌ "Helps with reviews." (too vague — reviews of what?)

### 2. Check for overlap with existing skills

Scan `.claude/skills/*/SKILL.md` for existing skills that touch the same domain. If one already
covers it, extend it rather than creating a new file. If the new skill's triggers will overlap
with an existing skill's triggers, plan a cross-reference for both files.

### 3. Design the trigger section

Triggers should be **intent-based**, not exact-phrase matching. Group by intent cluster. Always
include a disambiguation line if another skill covers adjacent territory. Use this template for
the skill being written (not for this skill itself):

```markdown
## Trigger phrases

Fire on intent. Load this skill when ...

- "phrase A", "phrase B", "phrase C"
- "phrase D", "phrase E"

If the user wants [adjacent thing] instead, that is the **other-skill** skill — use that.
```

When unsure whether to load, prefer loading — skills are cheap to run.

### 4. Write the steps

Each step must be **concrete and executable** — specify what to run, what to look for, what to
decide. Avoid hand-wavy instructions like "reflect on X" without telling the agent what to do.

Bad: "Review the code for quality issues."  
Good: "Run `npm run check && npm run lint`. If either fails, show the exact error and fix it before
proceeding."

### 5. Spawning sub-work

When a step needs research, a second opinion, or parallel exploration, spawn agents following the
model-selection and parallelism rules in `CLAUDE.md` → **Agent delegation**. For Opus consultation
specifically (e.g. pressure-testing learnings), see **session-review** step 3 for the canonical
shell-out pattern.

### 6. File conventions

Match existing skill structure exactly:

- **Location:** `.claude/skills/<kebab-name>/SKILL.md`
- **Format:** plain markdown, no YAML frontmatter
- **Sections (in order):** `# Title`, `## Trigger phrases`, `## Purpose`,
  `## When invoked, do the following:`, `## Constraints` (if needed)
- **Style:** tabs for indentation, single quotes in code, 100-char line width
- **Voice:** imperative, terse — instructions not explanations

### 7. Verify before showing the user

Before presenting the draft skill for confirmation:

- [ ] Purpose is one sentence with a clear NOT-scope
- [ ] Trigger phrases are intent-based, not exact-match
- [ ] Cross-references added in **both directions** for any overlapping skills
- [ ] Every step is concrete and executable (no hand-wavy verbs)
- [ ] Agent model and parallelism guidance included if agents are spawned
- [ ] File follows naming, section order, and style conventions above

## Constraints

- Never create a new skill when extending an existing one is sufficient.
- When correcting a skill that is behaving wrong, re-check its **purpose** first — don't just
  patch the symptoms. Wrong purpose → wrong steps regardless of how well they are written.
- Skills with overlapping trigger vocabulary **must** cross-reference each other. Both files need
  the cross-reference, not just one.
- Show the user the proposed skill content and get confirmation before writing the file.
