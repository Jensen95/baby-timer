<script lang="ts">
	import { getContext } from 'svelte';
	import { base } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';

	const session = getContext<SessionStore>(SESSION_KEY);

	let displayName = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!session.user) return;
		displayName = session.user.user_metadata.display_name ?? '';
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
				.upsert({ id: session.user.id, display_name: normalizedDisplayName || null });

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
</script>

<section class="section">
	<div class="container" style="max-width: 480px">
		<h1 class="title">Settings</h1>
		<p class="subtitle is-6 has-text-grey">Set the name shown around the app for your account.</p>

		<div class="box">
			<form onsubmit={handleSave}>
				<div class="field">
					<label class="label" for="email">Email</label>
					<div class="control">
						<input
							id="email"
							class="input"
							type="email"
							value={session.user?.email ?? ''}
							disabled
						/>
					</div>
				</div>

				<div class="field">
					<label class="label" for="display-name">Display name</label>
					<div class="control">
						<input
							id="display-name"
							class="input"
							type="text"
							bind:value={displayName}
							placeholder="Your name"
						/>
					</div>
				</div>

				{#if error}
					<div class="notification is-danger is-light">{error}</div>
				{/if}

				{#if saved}
					<div class="notification is-success is-light">Saved!</div>
				{/if}

				<div class="field">
					<div class="control">
						<button class="button is-primary" type="submit" disabled={saving}>
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
			</form>
		</div>

		<div class="box mt-4">
			<h2 class="subtitle is-6">Account</h2>
			<a href="{base}/logout" class="button is-light is-fullwidth">Sign out</a>
		</div>
	</div>
</section>
