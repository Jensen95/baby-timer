# Svelte 5 Development Skill

## When to use

Load this skill when working on Svelte components, stores, or SvelteKit routes.

## Svelte 5 Runes (REQUIRED for this project)

This project uses Svelte 5 runes exclusively. Never use legacy stores or slot syntax.

### State

```svelte
<script lang="ts">
	let count = $state(0);
	let doubled = $derived(count * 2);
</script>
```

### Props

```svelte
<script lang="ts">
	let { name, onchange }: { name: string; onchange: (v: string) => void } = $props();
</script>
```

### Effects

```svelte
<script lang="ts">
	$effect(() => {
		console.log('count changed:', count);
		return () => console.log('cleanup');
	});
</script>
```

### Children (replaces <slot>)

```svelte
<script lang="ts">
	let { children } = $props();
</script>

{@render children()}
```

### Context

```svelte
<script lang="ts">
	import { setContext, getContext } from 'svelte';
	setContext('key', value);
	const value = getContext('key');
</script>
```

## SvelteKit patterns (static SPA mode)

- No SSR: `ssr = false` is set globally
- No `+page.server.ts` — all data loading is client-side in `+page.svelte` via `$effect`
- Navigation: `import { goto } from '$app/navigation'`
- Route params: `import { page } from '$app/state'`

## Common Pitfalls

### $effect double-fire

Writing reactive state in one effect (`$state var = x`) schedules all effects that read that var.
Do NOT also call the dependent logic manually in the same effect — it double-invokes on mount.
Let the reactive effect own the downstream logic exclusively.

```svelte
// BAD — loadSessions called twice on mount
$effect(() => {
  selectedBabyId = babies[0].id;   // schedules Effect 2
  loadSessions(babies[0].id);      // also calls it directly → double-fire
});
$effect(() => { loadSessions(selectedBabyId); });

// GOOD — Effect 1 sets state, Effect 2 reacts
$effect(() => { selectedBabyId = babies[0].id; });
$effect(() => { if (selectedBabyId) loadSessions(selectedBabyId); });
```

## Commands

- `npm run check` — TypeScript + Svelte type checking
- `npm run dev` — dev server
- `npm run build` — static build
