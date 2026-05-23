<script lang="ts">
	import { getContext } from 'svelte';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { supabase } from '$lib/supabase';
	import {
		getUserFamilies,
		getFamily,
		listFamilyMemberDetails,
		createFamily,
		inviteMemberByEmail,
		acceptFamilyMembership,
		declineFamilyMembership,
		getPendingMemberships,
		getMemberDisplayLabel,
		type FamilyMemberDetails,
		type PendingMembership
	} from '$lib/db/family';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';

	const session = getContext<SessionStore>(SESSION_KEY);

	let members = $state<FamilyMemberDetails[]>([]);
	let pendingInvites = $state<PendingMembership[]>([]);
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
	let responding = $state<string | null>(null);

	let isOwner = $derived(
		members.some((member) => member.user_id === session.user?.id && member.role === 'owner')
	);

	$effect(() => {
		const userId = session.user?.id;
		if (!userId) {
			loading = false;
			return;
		}

		(async () => {
			try {
				// Load pending invites the current user has not yet accepted
				const pendingMemberships = await getPendingMemberships(supabase);
				pendingInvites = pendingMemberships;

				let localFamily = await getLocalFamily();
				if (localFamily) {
					familyId = localFamily.id;
					currentFamilyName = localFamily.name;
					members = await listFamilyMemberDetails(supabase, localFamily.id);
				} else {
					const families = await getUserFamilies(supabase);
					// Only use families where the user has fully joined (joined_at IS NOT NULL)
					const joinedFamily = families.find(
						(f) => !pendingMemberships.some((p) => p.family_id === f.id)
					);
					if (joinedFamily) {
						familyId = joinedFamily.id;
						currentFamilyName = joinedFamily.name;
						await putLocalFamily({
							id: joinedFamily.id,
							name: joinedFamily.name,
							created_at: joinedFamily.created_at
						});
						members = await listFamilyMemberDetails(supabase, joinedFamily.id);
					}
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
			await putLocalFamily({ id: family.id, name: family.name, created_at: family.created_at });
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
		const normalizedInviteEmail = inviteEmail.trim();
		if (!familyId || !normalizedInviteEmail) return;
		inviting = true;
		error = null;
		success = null;
		try {
			await inviteMemberByEmail(supabase, familyId, currentFamilyName, normalizedInviteEmail);
			members = await listFamilyMemberDetails(supabase, familyId);
			success = `Invitation sent to ${normalizedInviteEmail}.`;
			inviteEmail = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invitation';
		} finally {
			inviting = false;
		}
	}

	async function handleAcceptInvite(invite: PendingMembership) {
		responding = invite.family_id;
		error = null;
		success = null;
		try {
			await acceptFamilyMembership(supabase, invite.family_id);
			// Fetch the actual family record so we persist the correct created_at
			const family = await getFamily(supabase, invite.family_id);
			if (family) {
				familyId = family.id;
				currentFamilyName = family.name;
				await putLocalFamily({ id: family.id, name: family.name, created_at: family.created_at });
			}
			members = await listFamilyMemberDetails(supabase, invite.family_id);
			pendingInvites = pendingInvites.filter((p) => p.family_id !== invite.family_id);
			success = `You have joined ${invite.family_name}.`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to accept invitation';
		} finally {
			responding = null;
		}
	}

	async function handleDeclineInvite(invite: PendingMembership) {
		responding = invite.family_id;
		error = null;
		success = null;
		try {
			await declineFamilyMembership(supabase, invite.family_id);
			pendingInvites = pendingInvites.filter((p) => p.family_id !== invite.family_id);
			success = `Invitation to ${invite.family_name} declined.`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to decline invitation';
		} finally {
			responding = null;
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
				<button class="delete" aria-label="Dismiss success message" onclick={() => (success = null)}
				></button>
				{success}
			</div>
		{/if}

		{#if loading}
			<progress class="progress is-primary" max="100">Loading</progress>
		{:else if !session.user}
			<div class="has-text-centered py-6">
				<p class="has-text-grey mb-4">Sign in to manage your family.</p>
			</div>
		{:else}
			{#if pendingInvites.length > 0}
				<div class="box mb-4">
					<h2 class="subtitle is-5">Pending invitations</h2>
					{#each pendingInvites as invite (invite.family_id)}
						<div class="level is-mobile mb-3">
							<div class="level-left">
								<div class="level-item">
									<div>
										<p class="has-text-weight-semibold">{invite.family_name}</p>
										{#if invite.invited_by}
											<p class="is-size-7 has-text-grey">Invited by {invite.invited_by}</p>
										{/if}
									</div>
								</div>
							</div>
							<div class="level-right">
								<div class="buttons level-item">
									<button
										class="button is-success is-small"
										disabled={responding === invite.family_id}
										onclick={() => handleAcceptInvite(invite)}
									>
										Accept
									</button>
									<button
										class="button is-light is-small"
										disabled={responding === invite.family_id}
										onclick={() => handleDeclineInvite(invite)}
									>
										Decline
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if !familyId}
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
				{#each members as member (member.user_id ?? member.email)}
					<div class="box py-3">
						<div class="level is-mobile">
							<div class="level-left">
								<div class="level-item">
									<div>
										<p class="has-text-weight-semibold">
											{getMemberDisplayLabel(member)}
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
								<div class="tags level-item">
									<span class="tag {member.role === 'owner' ? 'is-primary' : 'is-light'}">
										{member.role}
									</span>
									{#if member.status !== 'joined'}
										<span class="tag is-warning is-light">
											{member.status === 'pending' ? 'pending' : 'invited'}
										</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}

				{#if isOwner}
					<div class="box mt-4">
						<h2 class="subtitle is-5">Invite family member</h2>
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
									An invitation will be sent. If they don't have an account yet, they'll receive a
									link to join.
								</p>
							</div>
							<div class="field">
								<div class="control">
									<button class="button is-primary" type="submit" disabled={inviting}>
										{inviting ? 'Sending...' : 'Send invitation'}
									</button>
								</div>
							</div>
						</form>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</section>
