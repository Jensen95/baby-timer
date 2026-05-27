<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import { getGuestId } from '$lib/offline/guest';
	import {
		consumeDeviceLinkRequest,
		createDeviceLinkRequest,
		getDeviceLinkStatus,
		type DeviceLinkRequest,
		type DeviceLinkStatus
	} from '$lib/db/device-link';
	import { t } from '@sveltia/i18n';
	import Button from '$lib/components/Button.svelte';
	import QrCode from '$lib/components/QrCode.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);

	let email = $state('');
	let displayName = $state('');
	let sent = $state(false);
	let error = $state('');
	let loading = $state(false);
	let deviceMode = $state(false);
	let deviceRequest = $state<DeviceLinkRequest | null>(null);
	let deviceStatus = $state<DeviceLinkStatus['status']>('pending');
	let deviceLoading = $state(false);
	let pollingActive = $state(false);
	let lastPolledAt = $state<string | null>(null);

	let approvalLink = $derived.by(() => {
		if (!deviceRequest || typeof window === 'undefined') {
			return null;
		}

		const url = new URL(resolve('/device-link'), window.location.origin);
		url.searchParams.set('approval', deviceRequest.approval_qr_token);
		return url.toString();
	});

	$effect(() => {
		if (session.user) {
			if (typeof window !== 'undefined') {
				const pendingJoinCode = window.localStorage.getItem('baby-timer:pending-join-code');
				if (pendingJoinCode) {
					goto(`${resolve('/join')}?code=${encodeURIComponent(pendingJoinCode)}`);
					return;
				}
			}

			goto(resolve('/app'));
		}
	});

	$effect(() => {
		if (!pollingActive || !deviceRequest) {
			return;
		}

		let disposed = false;
		let inFlight = false;

		const poll = async () => {
			if (disposed || inFlight || !deviceRequest) {
				return;
			}

			inFlight = true;
			try {
				const status = await getDeviceLinkStatus(supabase, deviceRequest.poll_token);
				deviceStatus = status.status;
				lastPolledAt = new Date().toISOString();

				if (status.status === 'approved') {
					await consumeDeviceLinkRequest(supabase, deviceRequest.poll_token);
					pollingActive = false;
				} else if (
					status.status === 'denied' ||
					status.status === 'expired' ||
					status.status === 'consumed'
				) {
					pollingActive = false;
				}
			} catch {
				pollingActive = false;
				error = t('auth.deviceLinkPollFailed');
			} finally {
				inFlight = false;
			}
		};

		poll();
		const timer = window.setInterval(poll, 3000);

		return () => {
			disposed = true;
			window.clearInterval(timer);
		};
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			const pendingJoinCode =
				typeof window !== 'undefined'
					? window.localStorage.getItem('baby-timer:pending-join-code')
					: null;
			const redirectPath = pendingJoinCode
				? `${resolve('/join')}?code=${encodeURIComponent(pendingJoinCode)}`
				: `${resolve('/app')}`;

			await session.signInWithMagicLink(email, displayName, redirectPath);
			sent = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	async function handleStartDeviceLink() {
		deviceLoading = true;
		error = '';
		deviceStatus = 'pending';
		try {
			const label = typeof navigator !== 'undefined' ? navigator.userAgent : null;
			deviceRequest = await createDeviceLinkRequest(supabase, label);
			deviceMode = true;
			pollingActive = true;
		} catch (err) {
			error = err instanceof Error ? err.message : t('auth.deviceLinkStartFailed');
		} finally {
			deviceLoading = false;
		}
	}

	function handleCancelDeviceLink() {
		deviceMode = false;
		deviceRequest = null;
		deviceStatus = 'pending';
		pollingActive = false;
		lastPolledAt = null;
	}

	function handleGuestMode() {
		getGuestId();
		goto(resolve('/app'));
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
		{:else if deviceMode && deviceRequest && approvalLink}
			<div class="device-link-panel">
				<h2 class="confirmation-title">{t('auth.deviceLinkTitle')}</h2>
				<p class="confirmation-text">{t('auth.deviceLinkDescription')}</p>
				<QrCode value={approvalLink} label={t('auth.deviceLinkQrLabel')} size={220} />
				<p class="device-code">{deviceRequest.user_code}</p>
				<p class="confirmation-hint">{t('auth.deviceLinkFallback')}</p>

				{#if deviceStatus === 'pending'}
					<p class="device-status pending">{t('auth.deviceLinkWaiting')}</p>
				{:else if deviceStatus === 'approved'}
					<p class="device-status success">{t('auth.deviceLinkApproved')}</p>
				{:else if deviceStatus === 'denied'}
					<p class="device-status error">{t('auth.deviceLinkDenied')}</p>
				{:else if deviceStatus === 'expired'}
					<p class="device-status error">{t('auth.deviceLinkExpired')}</p>
				{:else}
					<p class="device-status">{deviceStatus}</p>
				{/if}

				{#if lastPolledAt}
					<p class="poll-time">
						{t('auth.lastChecked', {
							values: { time: new Date(lastPolledAt).toLocaleTimeString() }
						})}
					</p>
				{/if}

				<div class="device-actions">
					<Button variant="ghost" size="sm" onclick={handleCancelDeviceLink}>
						{t('common.back')}
					</Button>
					{#if deviceStatus === 'denied' || deviceStatus === 'expired' || deviceStatus === 'consumed'}
						<Button
							variant="primary"
							size="sm"
							onclick={handleStartDeviceLink}
							loading={deviceLoading}
						>
							{t('auth.deviceLinkRetry')}
						</Button>
					{/if}
				</div>
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

			<Button variant="ghost" size="lg" onclick={handleStartDeviceLink} loading={deviceLoading}>
				{t('auth.signInWithAnotherDevice')}
			</Button>

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

	.device-link-panel {
		display: grid;
		gap: var(--space-3);
		justify-items: center;
	}

	.device-code {
		margin: 0;
		font-size: var(--font-size-5);
		font-weight: var(--fw-black);
		font-family: var(--font-mono, monospace);
		letter-spacing: 0.08em;
	}

	.device-status {
		margin: 0;
		font-size: var(--font-size-2);
	}

	.device-status.pending {
		color: var(--text-2);
	}

	.device-status.success {
		color: hsl(140 60% 25%);
	}

	.device-status.error {
		color: var(--danger);
	}

	.poll-time {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--text-3);
	}

	.device-actions {
		display: flex;
		gap: var(--space-2);
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
