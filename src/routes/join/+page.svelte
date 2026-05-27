<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { joinFamilyByCode } from '$lib/db/family';
	import Button from '$lib/components/Button.svelte';
	import { t } from '@sveltia/i18n';

	const session = getContext<SessionStore>(SESSION_KEY);

	let code = $state('');
	let joining = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const codeParam = page.url.searchParams.get('code');
		if (codeParam) {
			code = codeParam.toUpperCase();
		}
	});

	async function handleJoin() {
		const normalizedCode = code.trim().toUpperCase();
		if (!normalizedCode) return;

		if (!session.user) {
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('baby-timer:pending-join-code', normalizedCode);
			}
			goto(`${base}/login`);
			return;
		}

		joining = true;
		error = null;
		try {
			await joinFamilyByCode(supabase, normalizedCode);
			success = true;
			if (typeof window !== 'undefined') {
				window.localStorage.removeItem('baby-timer:pending-join-code');
			}
			setTimeout(() => {
				goto(`${base}/app/family`);
			}, 750);
		} catch (e) {
			error = e instanceof Error ? e.message : t('family.joinByCodeFailed');
		} finally {
			joining = false;
		}
	}
</script>

<svelte:head>
	<title>{t('family.joinByCodeTitle')}</title>
</svelte:head>

<div class="page">
	<div class="card">
		<h1>{t('family.joinByCodeTitle')}</h1>
		<p class="help">{t('family.joinByCodeHelp')}</p>

		<input
			class="code-input"
			type="text"
			bind:value={code}
			placeholder={t('family.codePlaceholder')}
			autocapitalize="characters"
			autocomplete="one-time-code"
			maxlength="12"
		/>

		{#if error}
			<p class="error">{error}</p>
		{/if}
		{#if success}
			<p class="success">{t('family.joinByCodeSuccess')}</p>
		{/if}

		<div class="actions">
			<Button variant="ghost" size="sm" onclick={() => goto(`${base}/app/family`)}>
				{t('common.cancel')}
			</Button>
			<Button variant="primary" size="sm" onclick={handleJoin} loading={joining}>
				{t('family.joinByCodeCta')}
			</Button>
		</div>
	</div>
</div>

<style>
	.page {
		display: grid;
		place-items: center;
		min-height: 100vh;
		padding: var(--space-4);
	}

	.card {
		width: min(420px, 100%);
		padding: var(--space-5);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		display: grid;
		gap: var(--space-3);
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-5);
	}

	.help {
		margin: 0;
		font-size: var(--font-size-2);
		color: var(--text-2);
	}

	.code-input {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		font-size: var(--font-size-4);
		font-family: var(--font-mono, monospace);
		font-weight: var(--fw-bold);
		letter-spacing: 0.08em;
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		box-sizing: border-box;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.error {
		margin: 0;
		font-size: var(--font-size-2);
		color: var(--danger);
	}

	.success {
		margin: 0;
		font-size: var(--font-size-2);
		color: hsl(140 60% 25%);
	}
</style>
