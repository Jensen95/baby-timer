<script lang="ts">
	import { getContext } from 'svelte';
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
		supabase
			.from('profiles')
			.select('display_name')
			.eq('id', session.user.id)
			.maybeSingle()
			.then(({ data }: { data: { display_name: string | null } | null }) => {
				if (data?.display_name) displayName = data.display_name;
			});
	});

	async function handleSave(e: Event) {
		e.preventDefault();
		if (!session.user) return;
		saving = true;
		saved = false;
		error = null;
		try {
			const { error: updateError } = await (supabase as any)
				.from('profiles')
				.update({ display_name: displayName })
				.eq('id', session.user.id);

			if (updateError) throw updateError;
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
			<a href="/logout" class="button is-light is-fullwidth">Sign out</a>
		</div>
	</div>
</section>
