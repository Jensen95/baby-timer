<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { supabase } from '$lib/supabase';
	import { listBabiesLocal, createBabyLocal, type LocalBaby } from '$lib/db/local-babies';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { getUserFamilies } from '$lib/db/family';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);

	let babies = $state<LocalBaby[]>([]);
	let familyId = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showForm = $state(false);
	let newName = $state('');
	let newBirthDate = $state('');
	let saving = $state(false);

	$effect(() => {
		(async () => {
			try {
				if (session.user) {
					let localFamily = await getLocalFamily();
					if (!localFamily) {
						const families = await getUserFamilies(supabase);
						if (families.length > 0) {
							await putLocalFamily({
								id: families[0].id,
								name: families[0].name,
								created_at: families[0].created_at
							});
							localFamily = {
								id: families[0].id,
								name: families[0].name,
								created_at: families[0].created_at
							};
						}
					}
					familyId = localFamily?.id ?? null;
				} else {
					familyId = null;
				}

				babies = await listBabiesLocal(familyId);
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load';
			} finally {
				loading = false;
			}
		})();
	});

	async function handleAdd(e: Event) {
		e.preventDefault();
		if (!newName.trim()) return;
		saving = true;
		try {
			const baby: LocalBaby = {
				id: crypto.randomUUID(),
				family_id: familyId,
				name: newName.trim(),
				birth_date: newBirthDate || null,
				created_at: new Date().toISOString(),
				_sync: 'pending'
			};
			await createBabyLocal(baby);
			babies = [...babies, baby];
			newName = '';
			newBirthDate = '';
			showForm = false;
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create baby';
		} finally {
			saving = false;
		}
	}
</script>

<section class="section">
	<div class="container" style="max-width: 600px">
		<div class="level">
			<div class="level-left">
				<h1 class="title">Babies</h1>
			</div>
			<div class="level-right">
				<button class="button is-primary" onclick={() => (showForm = !showForm)}>
					+ Add Baby
				</button>
			</div>
		</div>

		{#if error}
			<div class="notification is-danger is-light">
				<button class="delete" aria-label="Dismiss error" onclick={() => (error = null)}></button>
				{error}
			</div>
		{/if}

		{#if showForm}
			<div class="box mb-4">
				<form onsubmit={handleAdd}>
					<div class="field">
						<label class="label" for="baby-name">Name</label>
						<div class="control">
							<input
								id="baby-name"
								class="input"
								type="text"
								bind:value={newName}
								placeholder="e.g. Emma"
								required
							/>
						</div>
					</div>
					<div class="field">
						<label class="label" for="birth-date">Birth date (optional)</label>
						<div class="control">
							<input id="birth-date" class="input" type="date" bind:value={newBirthDate} />
						</div>
					</div>
					<div class="field is-grouped">
						<div class="control">
							<button class="button is-primary" type="submit" disabled={saving}>
								{saving ? 'Saving...' : 'Add'}
							</button>
						</div>
						<div class="control">
							<button class="button" type="button" onclick={() => (showForm = false)}>
								Cancel
							</button>
						</div>
					</div>
				</form>
			</div>
		{/if}

		{#if loading}
			<progress class="progress is-primary" max="100">Loading</progress>
		{:else if babies.length === 0}
			<div class="has-text-centered py-6">
				<p class="has-text-grey">No babies yet. Add one above!</p>
			</div>
		{:else}
			{#each babies as baby (baby.id)}
				<div class="box">
					<p class="is-size-5 has-text-weight-semibold">{baby.name}</p>
					{#if baby.birth_date}
						<p class="has-text-grey is-size-7">Born {baby.birth_date}</p>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</section>
