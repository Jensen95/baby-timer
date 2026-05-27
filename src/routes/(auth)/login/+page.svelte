<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { getGuestId } from '$lib/offline/guest';
	import { t } from '@sveltia/i18n';
	import Button from '$lib/components/Button.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);

	let email = $state('');
	let displayName = $state('');
	let sent = $state(false);
	let error = $state('');
	let loading = $state(false);

	$effect(() => {
		if (session.user) {
			goto(`${base}/app`);
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			await session.signInWithMagicLink(email, displayName);
			sent = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	function handleGuestMode() {
		getGuestId();
		goto(`${base}/app`);
	}
</script>

<svelte:head>
	<title>{t('auth.pageTitle')}</title>
</svelte:head>

<div class="page">
	<div class="login-card">
		<h1 class="login-title">{t('auth.heading')}</h1>

		{#if sent}
			<div class="confirmation">
				<div class="confirmation-icon">✓</div>
				<h2 class="confirmation-title">{t('auth.checkEmail')}</h2>
				<p class="confirmation-text">
					{t('auth.magicLinkSent', { values: { email } })}
				</p>
				<p class="confirmation-hint">{t('auth.linkExpiry')}</p>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="login-form">
				<div class="form-group">
					<label class="form-label" for="display-name">{t('auth.nameLabel')}</label>
					<input
						id="display-name"
						class="form-input"
						type="text"
						placeholder={t('auth.namePlaceholder')}
						bind:value={displayName}
					/>
					<p class="form-help">{t('auth.nameHelp')}</p>
				</div>

				<div class="form-group">
					<label class="form-label" for="email">{t('auth.emailLabel')}</label>
					<input
						id="email"
						class="form-input"
						type="email"
						placeholder={t('auth.emailPlaceholder')}
						bind:value={email}
						required
					/>
				</div>

				{#if error}
					<div class="error-box">
						{error}
					</div>
				{/if}

				<Button
					variant="primary"
					size="lg"
					type="submit"
					disabled={loading}
					{loading}
					class="form-submit"
				>
					{loading ? t('auth.sending') : t('auth.sendMagicLink')}
				</Button>
			</form>

			<div class="form-divider">
				<span>{t('auth.or')}</span>
			</div>

			<button type="button" class="guest-link" onclick={handleGuestMode}>
				{t('auth.continueWithoutAccount')}
			</button>
		{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-5);
		background: var(--bg);
		color: var(--text);
	}

	.login-card {
		width: 100%;
		max-width: 420px;
		background: var(--surface);
		border-radius: var(--radius-2);
		border: 1px solid var(--border);
		padding: var(--space-7);
	}

	.login-title {
		font-size: var(--font-size-6);
		font-weight: var(--fw-black);
		text-align: center;
		margin: 0 0 var(--space-6) 0;
		color: var(--text);
	}

	.confirmation {
		text-align: center;
		padding: var(--space-4) 0;
	}

	.confirmation-icon {
		font-size: 3rem;
		margin-bottom: var(--space-4);
		color: var(--brand);
	}

	.confirmation-title {
		font-size: var(--font-size-5);
		font-weight: var(--fw-bold);
		margin: 0 0 var(--space-3) 0;
		color: var(--text);
	}

	.confirmation-text {
		font-size: var(--font-size-3);
		line-height: var(--lh-normal);
		margin: 0 0 var(--space-3) 0;
		color: var(--text-2);
	}

	.confirmation-hint {
		font-size: var(--font-size-2);
		color: var(--text-3);
		margin: 0;
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-label {
		font-size: var(--font-size-3);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.form-input {
		min-height: var(--tap-comfortable);
		padding: var(--space-3) var(--space-4);
		font-size: var(--font-size-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-1);
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-body);
		transition: border-color var(--duration-fast);
	}

	.form-input::placeholder {
		color: var(--text-3);
	}

	.form-input:focus {
		outline: none;
		border-color: var(--brand);
		box-shadow: 0 0 0 2px var(--brand-subtle);
	}

	.form-help {
		font-size: var(--font-size-2);
		color: var(--text-3);
		margin: 0;
	}

	.error-box {
		padding: var(--space-3) var(--space-4);
		background: var(--danger-fill);
		border: 1px solid var(--danger);
		border-radius: var(--radius-1);
		color: var(--danger);
		font-size: var(--font-size-2);
	}

	:global(.form-submit) {
		width: 100%;
	}

	.form-divider {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin: var(--space-5) 0;
		color: var(--text-3);
		font-size: var(--font-size-2);
	}

	.form-divider::before,
	.form-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.guest-link {
		display: block;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		border: none;
		background: transparent;
		color: var(--brand);
		font-size: var(--font-size-3);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		text-decoration: none;
		border-radius: var(--radius-1);
		transition: background-color var(--duration-fast);
		text-align: center;
		font-family: var(--font-body);
	}

	.guest-link:hover {
		background-color: var(--brand-subtle);
	}

	.guest-link:active {
		transform: scale(0.98);
	}

	@media (max-width: 480px) {
		.login-card {
			padding: var(--space-5);
		}

		.login-title {
			font-size: var(--font-size-5);
			margin-bottom: var(--space-5);
		}

		.confirmation-title {
			font-size: var(--font-size-4);
		}
	}
</style>
