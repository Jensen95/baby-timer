<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';

	const session = getContext<SessionStore>(SESSION_KEY);

	let email = $state('');
	let sent = $state(false);
	let error = $state('');
	let loading = $state(false);

	$effect(() => {
		if (session.user) {
			goto('/app');
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			await session.signInWithMagicLink(email);
			sent = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — Baby Timer</title>
</svelte:head>

<section class="section">
	<div class="container">
		<div class="columns is-centered">
			<div class="column is-narrow" style="min-width: 360px">
				<div class="box">
					<h1 class="title has-text-centered">Baby Timer</h1>

					{#if sent}
						<div class="notification is-success">
							<p>Check your email for a magic link to sign in!</p>
						</div>
					{:else}
						<form onsubmit={handleSubmit}>
							<div class="field">
								<label class="label" for="email">Email</label>
								<div class="control">
									<input
										id="email"
										class="input"
										type="email"
										placeholder="you@example.com"
										bind:value={email}
										required
									/>
								</div>
							</div>

							{#if error}
								<div class="notification is-danger is-light">
									{error}
								</div>
							{/if}

							<div class="field">
								<div class="control">
									<button class="button is-primary is-fullwidth" type="submit" disabled={loading}>
										{loading ? 'Sending...' : 'Send Magic Link'}
									</button>
								</div>
							</div>
						</form>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
