<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import { t } from '@sveltia/i18n';
	import { base } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { BABY_STATE_KEY } from '$lib/state/baby.svelte';
	import type { BabyState } from '$lib/state/baby.svelte';
	import { createFamily } from '$lib/db/family';
	import { supabase } from '$lib/supabase';
	import ActiveTimerBar from '$lib/components/ActiveTimerBar.svelte';
	import QuickActionBar from '$lib/components/QuickActionBar.svelte';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);
	const babyState = getContext<BabyState>(BABY_STATE_KEY);

	let { children } = $props();

	$effect(() => {
		if (typeof window === 'undefined') return;

		async function handleSignedIn(e: Event) {
			const { userId } = (e as CustomEvent).detail;
			try {
				const families = await (supabase as any).from('families').select('id').limit(1);
				let familyId: string;
				if (families.data && families.data.length > 0) {
					familyId = families.data[0].id;
				} else {
					const newFamily = await createFamily(supabase, 'My Family');
					familyId = newFamily.id;
				}
				await sync.migrateGuestData(userId, familyId);
			} catch (e) {
				console.error('Guest migration failed:', e);
			}
		}

		window.addEventListener('baby-timer:signed-in', handleSignedIn);
		return () => window.removeEventListener('baby-timer:signed-in', handleSignedIn);
	});
</script>

{#if session.loading}
	<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
		<progress style="width: 200px; accent-color: var(--brand);" max="100"
			>{t('common.loading')}</progress
		>
	</div>
{:else}
	{#if !session.user}
		<div class="guest-banner">
			<span>{t('app.offlineBanner')}</span>
			<a href="{base}/login" class="guest-banner-link">{t('app.signInToSync')}</a>
		</div>
	{/if}
	{@render children()}
	<QuickActionBar babyId={babyState?.selectedBabyId ?? null} />
	<ActiveTimerBar babyId={babyState?.selectedBabyId ?? null} />
{/if}

<style>
	.guest-banner {
		background: hsl(40, 90%, 95%);
		border-bottom: 1px solid hsl(40, 60%, 85%);
		padding: 0.6rem 1rem;
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		color: hsl(40, 30%, 35%);
	}
	.guest-banner-link {
		font-weight: 700;
		color: hsl(340, 65%, 55%);
		text-decoration: none;
	}
	.guest-banner-link:hover {
		text-decoration: underline;
	}
</style>
