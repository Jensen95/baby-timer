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

## Commands

- `npm run check` — TypeScript + Svelte type checking
- `npm run dev` — dev server
- `npm run build` — static build
