<script lang="ts">
	import { getContext } from 'svelte';
	import { base, resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { getTheme, setTheme, THEMES, THEME_LABELS } from '$lib/state/theme.svelte';
	import Button from '$lib/components/Button.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);

	let currentTheme = $derived(getTheme());

	let displayName = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!session.user) return;
		supabase
			.from('profiles')
			.select('display_name')
			.eq('id', session.user.id)
			.maybeSingle()
			.then(({ data }: { data: { display_name: string | null } | null }) => {
				displayName = data?.display_name ?? session.user?.user_metadata.display_name ?? '';
			});
	});

	async function handleSave(e: Event) {
		e.preventDefault();
		if (!session.user) return;
		saving = true;
		saved = false;
		error = null;
		try {
			const normalizedDisplayName = displayName.trim();
			const { error: updateError } = await (supabase as any)
				.from('profiles')
				.upsert(
					{ id: session.user.id, display_name: normalizedDisplayName || null },
					{ onConflict: 'id' }
				);

			if (updateError) throw updateError;
			const { error: authError } = await supabase.auth.updateUser({
				data: { display_name: normalizedDisplayName || null }
			});
			if (authError) throw authError;
			displayName = normalizedDisplayName;
			saved = true;
			setTimeout(() => (saved = false), 3000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function handleBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
			return;
		}
		await goto(`${resolve('/app')}`);
	}
</script>

<div class="page">
	<div class="page-header">
		<button type="button" class="back-btn" onclick={handleBack} aria-label="Go back"> Back </button>
	</div>
	<h1 class="page-title">Settings</h1>

	<section class="section-card">
		<h2 class="section-title">Theme</h2>
		<div class="theme-picker">
			{#each THEMES as t}
				<button
					class="theme-option"
					class:theme-option--active={currentTheme === t}
					onclick={() => setTheme(t)}
					aria-pressed={currentTheme === t}
				>
					{THEME_LABELS[t]}
				</button>
			{/each}
		</div>
	</section>

	{#if session.user}
		<section class="section-card">
			<h2 class="section-title">Profile</h2>
			<form onsubmit={handleSave} class="profile-form">
				<input
					id="email"
					class="form-input"
					type="email"
					value={session.user?.email ?? ''}
					disabled
				/>
				<input
					id="display-name"
					class="form-input"
					type="text"
					bind:value={displayName}
					placeholder="Your name"
				/>

				{#if error}
					<div class="error-msg">{error}</div>
				{/if}

				{#if saved}
					<div class="success-msg">Saved!</div>
				{/if}

				<div class="form-row">
					<Button variant="primary" size="sm" type="submit" loading={saving}>Save</Button>
				</div>
			</form>
		</section>

		<section class="section-card">
			<h2 class="section-title">Family management</h2>
			<a href="{base}/app/family" class="action-link manage-family-link">
				Manage family members, babies, and invites
			</a>
		</section>

		<section class="section-card">
			<h2 class="section-title">Account</h2>
			<a href="{base}/logout" class="action-link sign-out-link">Sign out</a>
		</section>
	{:else}
		<section class="section-card">
			<p class="empty">Sign in to sync your data across devices.</p>
			<a href="{base}/login" class="sign-in-link">Sign in</a>
		</section>
	{/if}
</div>

<style>
	.page {
		padding: var(--space-4) var(--space-4) calc(var(--bottom-nav-h) + var(--space-6));
		max-width: 600px;
		margin: 0 auto;
	}
	.page-header {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		margin-bottom: var(--space-2);
	}
	.back-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		background: var(--surface-2);
		color: var(--text-2);
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}
	.back-btn:hover {
		background: var(--surface-3);
		color: var(--text);
	}
	.page-title {
		font-size: var(--font-size-5);
		font-weight: var(--fw-bold);
		margin: 0 0 var(--space-5);
	}
	.section-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
	}
	.section-title {
		font-size: var(--font-size-4);
		font-weight: var(--fw-semibold);
		margin: 0 0 var(--space-3);
	}
	.theme-picker {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.theme-option {
		padding: var(--space-3) var(--space-2);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-2);
		color: var(--text);
		font-family: inherit;
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
		text-align: center;
	}
	.theme-option--active {
		border-color: var(--brand);
		background: var(--brand-subtle);
		color: var(--brand);
	}
	.profile-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.form-input {
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-3) var(--space-4);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface);
		color: var(--text);
		font-family: inherit;
		font-size: var(--font-size-3);
		box-sizing: border-box;
	}
	.form-input:focus {
		outline: 2px solid var(--brand);
		border-color: var(--brand);
	}
	.form-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.form-row {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}
	.error-msg {
		color: var(--danger);
		background: hsl(0 80% 97%);
		border: 1px solid hsl(0 80% 88%);
		border-radius: var(--radius-2);
		padding: var(--space-3) var(--space-4);
		font-size: var(--font-size-2);
	}
	.success-msg {
		color: hsl(140 60% 25%);
		background: hsl(140 60% 95%);
		border: 1px solid hsl(140 60% 80%);
		border-radius: var(--radius-2);
		padding: var(--space-3) var(--space-4);
		font-size: var(--font-size-2);
	}
	.empty {
		color: var(--text-2);
		font-size: var(--font-size-2);
		padding: var(--space-3) 0;
	}
	.action-link {
		display: flex;
		width: 100%;
		text-align: center;
		padding: var(--space-3) var(--space-4);
		min-height: var(--tap-min);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-2);
		color: var(--text-2);
		text-decoration: none;
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-3);
		align-items: center;
		justify-content: center;
		transition: background var(--duration-fast);
		box-sizing: border-box;
	}
	.manage-family-link:hover,
	.sign-out-link:hover {
		background: var(--surface-2);
	}
	.sign-in-link {
		display: flex;
		width: 100%;
		text-align: center;
		padding: var(--space-3) var(--space-4);
		min-height: var(--tap-min);
		border: 1.5px solid var(--brand);
		border-radius: var(--radius-2);
		color: var(--brand);
		text-decoration: none;
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-3);
		align-items: center;
		justify-content: center;
		transition: background var(--duration-fast);
		box-sizing: border-box;
		margin-top: var(--space-2);
	}
	.sign-in-link:hover {
		background: var(--brand-subtle);
	}
</style>
