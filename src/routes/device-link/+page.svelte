<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { approveDeviceLinkByCode, approveDeviceLinkByQr } from '$lib/db/device-link';
	import Button from '$lib/components/Button.svelte';
	import { t } from '@sveltia/i18n';

	const session = getContext<SessionStore>(SESSION_KEY);

	let manualCode = $state('');
	let approvalToken = $derived(page.url.searchParams.get('approval'));
	let loading = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);

	async function handleApproveByQr() {
		if (!approvalToken) return;
		loading = true;
		error = null;
		try {
			await approveDeviceLinkByQr(supabase, approvalToken);
			success = true;
		} catch (e) {
			error = e instanceof Error ? e.message : t('auth.deviceLinkApproveFailed');
		} finally {
			loading = false;
		}
	}

	async function handleApproveByCode() {
		const normalizedCode = manualCode.trim().toUpperCase();
		if (!normalizedCode) return;

		loading = true;
		error = null;
		try {
			await approveDeviceLinkByCode(supabase, normalizedCode);
			success = true;
		} catch (e) {
			error = e instanceof Error ? e.message : t('auth.deviceLinkApproveFailed');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{t('auth.deviceLinkApproveTitle')}</title>
</svelte:head>

<div class="page">
	<div class="card">
		<h1>{t('auth.deviceLinkApproveTitle')}</h1>
		<p class="help">{t('auth.deviceLinkApproveDescription')}</p>

		{#if !session.user}
			<p class="error">{t('auth.deviceLinkRequiresSignIn')}</p>
			<Button variant="primary" size="sm" onclick={() => goto(resolve('/login'))}>
				{t('auth.sendMagicLink')}
			</Button>
		{:else}
			{#if approvalToken}
				<Button variant="primary" size="sm" onclick={handleApproveByQr} {loading}>
					{t('auth.deviceLinkApproveCta')}
				</Button>
				<p class="hint">{t('auth.deviceLinkApproveFromQrHint')}</p>
			{/if}

			<div class="divider"><span>{t('auth.or')}</span></div>

			<input
				class="code-input"
				type="text"
				bind:value={manualCode}
				placeholder={t('auth.deviceCodePlaceholder')}
				autocapitalize="characters"
				maxlength="12"
			/>
			<Button variant="ghost" size="sm" onclick={handleApproveByCode} {loading}>
				{t('auth.deviceLinkApproveManualCta')}
			</Button>
		{/if}

		{#if error}
			<p class="error">{error}</p>
		{/if}
		{#if success}
			<p class="success">{t('auth.deviceLinkApproveSuccess')}</p>
		{/if}
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
		width: min(440px, 100%);
		display: grid;
		gap: var(--space-3);
		padding: var(--space-5);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-5);
	}

	.help,
	.hint {
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

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-3);
		font-size: var(--font-size-1);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: var(--font-size-2);
	}

	.success {
		margin: 0;
		color: hsl(140 60% 25%);
		font-size: var(--font-size-2);
	}
</style>
