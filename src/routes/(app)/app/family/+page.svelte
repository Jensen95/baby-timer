<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import {
		getUserFamilies,
		listFamilyMembers,
		createFamily,
		type FamilyMember
	} from '$lib/db/family';

	const session = getContext<SessionStore>(SESSION_KEY);

	let familyName = $state('');
	let members = $state<FamilyMember[]>([]);
	let familyId = $state<string | null>(null);
	let currentFamilyName = $state('');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showCreateForm = $state(false);
	let newFamilyName = $state('');
	let saving = $state(false);

	$effect(() => {
		const userId = session.user?.id;
		if (!userId) return;

		(async () => {
			try {
				const families = await getUserFamilies(supabase);
				if (families.length > 0) {
					familyId = families[0].id;
					currentFamilyName = families[0].name;
					members = await listFamilyMembers(supabase, familyId);
				}
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load';
			} finally {
				loading = false;
			}
		})();
	});

	async function handleCreateFamily(e: Event) {
		e.preventDefault();
		if (!newFamilyName.trim()) return;
		saving = true;
		try {
			const family = await createFamily(supabase, newFamilyName.trim());
			familyId = family.id;
			currentFamilyName = family.name;
			members = await listFamilyMembers(supabase, family.id);
			showCreateForm = false;
			newFamilyName = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create family';
		} finally {
			saving = false;
		}
	}
</script>

<section class="section">
	<div class="container" style="max-width: 600px">
		<h1 class="title">Family</h1>

		{#if error}
			<div class="notification is-danger is-light">
				<button class="delete" onclick={() => (error = null)}></button>
				{error}
			</div>
		{/if}

		{#if loading}
			<progress class="progress is-primary" max="100">Loading</progress>
		{:else if !familyId}
			<div class="has-text-centered py-6">
				<p class="has-text-grey mb-4">You're not in a family yet.</p>
				{#if showCreateForm}
					<form onsubmit={handleCreateFamily} style="max-width: 300px; margin: 0 auto">
						<div class="field">
							<input
								class="input"
								type="text"
								bind:value={newFamilyName}
								placeholder="Family name"
								required
							/>
						</div>
						<div class="field is-grouped is-justify-content-center">
							<div class="control">
								<button class="button is-primary" type="submit" disabled={saving}>Create</button>
							</div>
							<div class="control">
								<button class="button" type="button" onclick={() => (showCreateForm = false)}>
									Cancel
								</button>
							</div>
						</div>
					</form>
				{:else}
					<button class="button is-primary" onclick={() => (showCreateForm = true)}>
						Create Family
					</button>
				{/if}
			</div>
		{:else}
			<div class="box mb-4">
				<p class="label">Family name</p>
				<p class="is-size-5">{currentFamilyName}</p>
			</div>

			<h2 class="subtitle is-5">Members ({members.length})</h2>
			{#each members as member (member.user_id)}
				<div class="box py-3">
					<div class="level is-mobile">
						<div class="level-left">
							<p class="level-item">{member.user_id}</p>
						</div>
						<div class="level-right">
							<span class="tag {member.role === 'owner' ? 'is-primary' : 'is-light'} level-item">
								{member.role}
							</span>
						</div>
					</div>
				</div>
			{/each}

			<div class="notification is-info is-light mt-4">
				<p>
					To invite someone, share your Supabase project URL and have them sign up. Invite system
					coming soon.
				</p>
			</div>
		{/if}
	</div>
</section>
