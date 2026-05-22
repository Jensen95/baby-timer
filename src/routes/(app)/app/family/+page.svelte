<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import {
		getUserFamilies,
		listFamilyMemberDetails,
		createFamily,
		inviteMemberByEmail,
		type FamilyMemberDetails
	} from '$lib/db/family';

	const session = getContext<SessionStore>(SESSION_KEY);

	let members = $state<FamilyMemberDetails[]>([]);
	let familyId = $state<string | null>(null);
	let currentFamilyName = $state('');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let showCreateForm = $state(false);
	let newFamilyName = $state('');
	let saving = $state(false);
	let inviteEmail = $state('');
	let inviting = $state(false);

	let isOwner = $derived(
		members.some((member) => member.user_id === session.user?.id && member.role === 'owner')
	);

	$effect(() => {
		const userId = session.user?.id;
		if (!userId) return;

		(async () => {
			try {
				const families = await getUserFamilies(supabase);
				if (families.length > 0) {
					familyId = families[0].id;
					currentFamilyName = families[0].name;
					members = await listFamilyMemberDetails(supabase, familyId);
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
		error = null;
		success = null;
		try {
			const family = await createFamily(supabase, newFamilyName.trim());
			familyId = family.id;
			currentFamilyName = family.name;
			members = await listFamilyMemberDetails(supabase, family.id);
			showCreateForm = false;
			newFamilyName = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create family';
		} finally {
			saving = false;
		}
	}

	async function handleInviteMember(e: Event) {
		e.preventDefault();
		if (!familyId || !inviteEmail.trim()) return;
		inviting = true;
		error = null;
		success = null;
		try {
			await inviteMemberByEmail(supabase, familyId, inviteEmail.trim());
			members = await listFamilyMemberDetails(supabase, familyId);
			success = `Added ${inviteEmail.trim()} to the family.`;
			inviteEmail = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add family member';
		} finally {
			inviting = false;
		}
	}
</script>

<section class="section">
	<div class="container" style="max-width: 600px">
		<h1 class="title">Family</h1>

		{#if error}
			<div class="notification is-danger is-light">
				<button class="delete" aria-label="Dismiss error" onclick={() => (error = null)}></button>
				{error}
			</div>
		{/if}

		{#if success}
			<div class="notification is-success is-light">
				<button
					class="delete"
					aria-label="Dismiss success message"
					onclick={() => (success = null)}
				></button>
				{success}
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
					<div class="level">
						<div class="level-left">
							<div class="level-item">
								<div>
									<p class="has-text-weight-semibold">
										{member.display_name || member.email || member.user_id}
										{#if member.user_id === session.user?.id}
											<span class="tag is-light ml-2">You</span>
										{/if}
									</p>
									{#if member.display_name && member.email}
										<p class="is-size-7 has-text-grey">{member.email}</p>
									{/if}
								</div>
							</div>
						</div>
						<div class="level-right">
							<span class="tag {member.role === 'owner' ? 'is-primary' : 'is-light'} level-item">
								{member.role}
							</span>
						</div>
					</div>
				</div>
			{/each}

			{#if isOwner}
				<div class="box mt-4">
					<h2 class="subtitle is-5">Add family member</h2>
					<form onsubmit={handleInviteMember}>
						<div class="field">
							<label class="label" for="invite-email">Email</label>
							<div class="control">
								<input
									id="invite-email"
									class="input"
									type="email"
									bind:value={inviteEmail}
									placeholder="partner@example.com"
									required
								/>
							</div>
							<p class="help">
								They need to sign in once before you can add them by email.
							</p>
						</div>
						<div class="field">
							<div class="control">
								<button class="button is-primary" type="submit" disabled={inviting}>
									{inviting ? 'Adding...' : 'Add member'}
								</button>
							</div>
						</div>
					</form>
				</div>
			{/if}
		{/if}
	</div>
</section>
