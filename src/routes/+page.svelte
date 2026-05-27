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

	function handleGuestMode() {
		getGuestId();
		goto(`${base}/app`);
	}

	let primaryHref = $derived(session.user ? `${base}/app` : `${base}/login`);
	let primaryLabel = $derived(
		session.user ? t('landing.openDashboard') : t('landing.startTracking')
	);
</script>

<svelte:head>
	<title>{t('landing.title')}</title>
	<meta name="description" content={t('landing.metaDescription')} />
</svelte:head>

<div class="page">
	<section class="hero">
		<div class="hero-content">
			<h1 class="headline">{t('landing.headline')}</h1>
			<p class="subheadline">{t('landing.subheadline')}</p>

			<div class="cta-group">
				<Button variant="primary" size="lg" href={primaryHref}>
					{primaryLabel}
				</Button>
				<Button variant="ghost" size="lg" onclick={handleGuestMode}>
					{t('landing.trackWithoutAccount')}
				</Button>
			</div>
		</div>
	</section>

	<section class="features">
		<div class="features-grid">
			<div class="feature-card">
				<div class="feature-emoji">✓</div>
				<h3 class="feature-title">{t('landing.worksOfflineTitle')}</h3>
				<p class="feature-desc">{t('landing.worksOfflineDesc')}</p>
			</div>

			<div class="feature-card">
				<div class="feature-emoji">✓</div>
				<h3 class="feature-title">{t('landing.shareFamilyTitle')}</h3>
				<p class="feature-desc">{t('landing.shareFamilyDesc')}</p>
			</div>

			<div class="feature-card">
				<div class="feature-emoji">✓</div>
				<h3 class="feature-title">{t('landing.trackEverythingTitle')}</h3>
				<p class="feature-desc">
					{t('landing.trackEverythingDesc')}
				</p>
			</div>
		</div>
	</section>

	<footer class="page-footer">
		<p>{t('landing.footer')}</p>
	</footer>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
	}

	.hero {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-7);
		background: var(--bg);
	}

	.hero-content {
		max-width: 480px;
		text-align: center;
	}

	.headline {
		font-size: var(--font-size-6);
		font-weight: var(--fw-black);
		line-height: var(--lh-tight);
		margin: 0 0 var(--space-4) 0;
		color: var(--text);
	}

	.subheadline {
		font-size: var(--font-size-4);
		font-weight: var(--fw-semibold);
		line-height: var(--lh-normal);
		margin: 0 0 var(--space-6) 0;
		color: var(--text-2);
	}

	.cta-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-8);
	}

	.features {
		background: var(--surface);
		padding: var(--space-8) var(--space-7);
		border-top: 1px solid var(--border);
	}

	.features-grid {
		max-width: 720px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-6);
	}

	.feature-card {
		text-align: center;
	}

	.feature-emoji {
		font-size: var(--font-size-6);
		margin-bottom: var(--space-3);
	}

	.feature-title {
		font-size: var(--font-size-4);
		font-weight: var(--fw-semibold);
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
	}

	.feature-desc {
		font-size: var(--font-size-2);
		color: var(--text-2);
		margin: 0;
		line-height: var(--lh-normal);
	}

	.page-footer {
		background: var(--surface);
		border-top: 1px solid var(--border);
		padding: var(--space-5) var(--space-7);
		text-align: center;
		font-size: var(--font-size-2);
		color: var(--text-3);
		margin: 0;
	}

	@media (max-width: 600px) {
		.hero {
			padding: var(--space-5);
		}

		.hero-content {
			max-width: 100%;
		}

		.headline {
			font-size: var(--font-size-5);
		}

		.subheadline {
			font-size: var(--font-size-3);
		}

		.features {
			padding: var(--space-5);
		}

		.features-grid {
			grid-template-columns: 1fr;
			gap: var(--space-4);
		}
	}
</style>
