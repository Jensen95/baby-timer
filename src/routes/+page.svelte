<script lang="ts">
	import { onMount } from 'svelte';
	import { getContext } from 'svelte';
	import { base } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';

	const session = getContext<SessionStore>(SESSION_KEY);

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	}
	type NavigatorWithStandalone = Navigator & { standalone?: boolean };

	let installPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let installSupported = $state(false);
	let standalone = $state(false);
	let showInstallHelp = $state(false);

	function updateStandaloneMode() {
		standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			((window.navigator as NavigatorWithStandalone).standalone ?? false);
	}

	function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
		const candidate = event as Partial<BeforeInstallPromptEvent>;
		return (
			typeof candidate.prompt === 'function' &&
			candidate.userChoice != null &&
			typeof candidate.userChoice?.then === 'function'
		);
	}

	async function handleInstallClick() {
		if (!installPrompt) return;
		await installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === 'accepted') {
			installPrompt = null;
			installSupported = false;
		}
	}

	onMount(() => {
		updateStandaloneMode();
		showInstallHelp = !standalone;

		const onBeforeInstallPrompt = (event: Event) => {
			if (!isBeforeInstallPromptEvent(event)) return;
			event.preventDefault();
			installPrompt = event;
			installSupported = true;
			showInstallHelp = false;
		};

		const onAppInstalled = () => {
			installPrompt = null;
			installSupported = false;
			showInstallHelp = false;
			updateStandaloneMode();
		};

		window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
		window.addEventListener('appinstalled', onAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
			window.removeEventListener('appinstalled', onAppInstalled);
		};
	});
</script>

<svelte:head>
	<title>Baby Timer — Track feeding & sleep</title>
	<meta
		name="description"
		content="A simple family app for tracking baby feeding and sleep sessions in real time."
	/>
</svelte:head>

<section class="hero is-primary is-medium">
	<div class="hero-body">
		<div class="container has-text-centered">
			<h1 class="title is-1">Baby Timer</h1>
			<p class="subtitle is-4">Track feeding and sleep — together, in real time</p>
			{#if session.user}
				<a href="{base}/app" class="button is-white is-medium mt-4">Open Dashboard</a>
			{:else}
				<a href="{base}/login" class="button is-white is-medium mt-4">Get Started →</a>
			{/if}
			{#if !standalone && installSupported}
				<div class="mt-3">
					<button class="button is-light is-medium" type="button" onclick={handleInstallClick}>
						Install App
					</button>
				</div>
			{:else if showInstallHelp}
				<p class="is-size-7 mt-3 has-text-white-bis">
					To install: open your browser menu and choose <strong>Install app</strong> or
					<strong>Add to Home screen</strong>.
				</p>
			{/if}
		</div>
	</div>
</section>

<section class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-10">
				<div class="columns">
					<div class="column has-text-centered">
						<div class="box">
							<p class="is-size-2 mb-3">🍼</p>
							<h3 class="title is-5">Feeding Timer</h3>
							<p class="has-text-grey">
								Track duration and which breast — left, right, or both. Active sessions sync
								instantly across devices.
							</p>
						</div>
					</div>
					<div class="column has-text-centered">
						<div class="box">
							<p class="is-size-2 mb-3">😴</p>
							<h3 class="title is-5">Sleep Timer</h3>
							<p class="has-text-grey">
								Log sleep sessions with head position — back, tummy, left, or right. See total sleep
								at a glance.
							</p>
						</div>
					</div>
					<div class="column has-text-centered">
						<div class="box">
							<p class="is-size-2 mb-3">👨‍👩‍👦</p>
							<h3 class="title is-5">Family Sharing</h3>
							<p class="has-text-grey">
								Both parents see live updates. No manual syncing — one parent starts a timer, the
								other sees it immediately.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="has-text-centered mt-5">
			<p class="has-text-grey is-size-7">
				Open source · Hosted on GitHub Pages · Data stored securely on Supabase
			</p>
		</div>
	</div>
</section>
