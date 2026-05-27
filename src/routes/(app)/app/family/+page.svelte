<script lang="ts">
	import { getContext } from 'svelte';
	import { resolve } from '$app/paths';
	import { SESSION_KEY } from '$lib/auth/context';
	import type { SessionStore } from '$lib/auth/context';
	import { SYNC_KEY } from '$lib/db/sync.svelte';
	import type { SyncEngineStore } from '$lib/db/sync.svelte';
	import { supabase } from '$lib/supabase';
	import {
		getUserFamilies,
		getFamily,
		listFamilyMemberDetails,
		createFamily,
		inviteMemberByEmail,
		createFamilyInviteCode,
		listActiveFamilyInviteCodes,
		revokeFamilyInviteCode,
		acceptFamilyMembership,
		declineFamilyMembership,
		getPendingMemberships,
		getMemberDisplayLabel,
		type FamilyInviteCode,
		type FamilyMemberDetails,
		type PendingMembership
	} from '$lib/db/family';
	import { getLocalFamily, putLocalFamily } from '$lib/db/local-family';
	import { listBabiesLocal, createBabyLocal, type LocalBaby } from '$lib/db/local-babies';
	import Button from '$lib/components/Button.svelte';
	import QrCode from '$lib/components/QrCode.svelte';
	import { t } from '@sveltia/i18n';

	const session = getContext<SessionStore>(SESSION_KEY);
	const sync = getContext<SyncEngineStore>(SYNC_KEY);

	let babies = $state<LocalBaby[]>([]);
	let showAddBabyForm = $state(false);
	let newBabyName = $state('');
	let newBabyBirthDate = $state('');
	let addingBaby = $state(false);

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
	let activeInviteCodes = $state<FamilyInviteCode[]>([]);
	let generatedInviteCode = $state<string | null>(null);
	let generatingInviteCode = $state(false);
	let revokingInviteCodeId = $state<string | null>(null);

	let latestInviteLink = $derived.by(() => {
		if (!generatedInviteCode || typeof window === 'undefined') {
			return null;
		}

		const joinUrl = new URL(resolve('/join'), window.location.origin);
		joinUrl.searchParams.set('code', generatedInviteCode);
		return joinUrl.toString();
	});

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
				const pendingMemberships = await getPendingMemberships(supabase);
				pendingInvites = pendingMemberships;

				let localFamily = await getLocalFamily();
				if (localFamily) {
					familyId = localFamily.id;
					currentFamilyName = localFamily.name;
					members = await listFamilyMemberDetails(supabase, localFamily.id);
					if (members.some((member) => member.user_id === userId && member.role === 'owner')) {
						activeInviteCodes = await listActiveFamilyInviteCodes(supabase, localFamily.id);
					}
				} else {
					const families = await getUserFamilies(supabase);
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
						if (members.some((member) => member.user_id === userId && member.role === 'owner')) {
							activeInviteCodes = await listActiveFamilyInviteCodes(supabase, joinedFamily.id);
						}
					}
				}

				babies = await listBabiesLocal(familyId);
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load';
			} finally {
				loading = false;
			}
		})();
	});

	async function handleAddBaby(e: Event) {
		e.preventDefault();
		if (!newBabyName.trim()) return;
		addingBaby = true;
		try {
			const baby: LocalBaby = {
				id: crypto.randomUUID(),
				family_id: familyId,
				name: newBabyName.trim(),
				birth_date: newBabyBirthDate || null,
				created_at: new Date().toISOString(),
				_sync: 'pending'
			};
			await createBabyLocal(baby);
			babies = [...babies, baby];
			newBabyName = '';
			newBabyBirthDate = '';
			showAddBabyForm = false;
			sync.syncNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add baby';
		} finally {
			addingBaby = false;
		}
	}

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
			success = t('family.invitationSent', { values: { email: normalizedInviteEmail } });
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
			const family = await getFamily(supabase, invite.family_id);
			if (family) {
				familyId = family.id;
				currentFamilyName = family.name;
				await putLocalFamily({ id: family.id, name: family.name, created_at: family.created_at });
			}
			members = await listFamilyMemberDetails(supabase, invite.family_id);
			pendingInvites = pendingInvites.filter((p) => p.family_id !== invite.family_id);
			success = t('family.joinedFamily', { values: { family: invite.family_name } });
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
			success = t('family.inviteDeclined', { values: { family: invite.family_name } });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to decline invitation';
		} finally {
			responding = null;
		}
	}

	async function handleGenerateInviteCode() {
		if (!familyId) return;
		generatingInviteCode = true;
		error = null;
		success = null;
		try {
			const created = await createFamilyInviteCode(supabase, familyId);
			generatedInviteCode = created.code;
			activeInviteCodes = await listActiveFamilyInviteCodes(supabase, familyId);
			success = t('family.codeGenerated');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to generate invite code';
		} finally {
			generatingInviteCode = false;
		}
	}

	async function handleRevokeInviteCode(codeId: string) {
		if (!familyId) return;
		revokingInviteCodeId = codeId;
		error = null;
		success = null;
		try {
			await revokeFamilyInviteCode(supabase, familyId, codeId);
			activeInviteCodes = activeInviteCodes.filter((code) => code.code_id !== codeId);
			success = t('family.codeRevoked');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to revoke invite code';
		} finally {
			revokingInviteCodeId = null;
		}
	}
</script>

<div class="page">
	<h1 class="page-title">{t('family.title')}</h1>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if success}
		<div class="success-msg">{success}</div>
	{/if}

	<section class="section-card">
		<div class="section-header">
			<h2 class="section-title">{t('family.babies')}</h2>
			<Button variant="ghost" size="sm" onclick={() => (showAddBabyForm = !showAddBabyForm)}>
				{t('common.add')}
			</Button>
		</div>

		{#if showAddBabyForm}
			<form onsubmit={handleAddBaby} class="invite-form">
				<input
					class="form-input"
					type="text"
					bind:value={newBabyName}
					placeholder={t('family.babyNamePlaceholder')}
					required
				/>
				<input class="form-input" type="date" bind:value={newBabyBirthDate} />
				<div class="form-row">
					<Button variant="ghost" size="sm" type="button" onclick={() => (showAddBabyForm = false)}>
						{t('common.cancel')}
					</Button>
					<Button variant="primary" size="sm" type="submit" loading={addingBaby}
						>{t('common.save')}</Button
					>
				</div>
			</form>
		{/if}

		{#if loading}
			<p class="empty">{t('family.loading')}</p>
		{:else if babies.length === 0}
			<p class="empty">{t('family.noBabies')}</p>
		{:else}
			{#each babies as baby (baby.id)}
				<div class="baby-row">
					<span>{baby.name}</span>
					{#if baby.birth_date}
						<span class="birth-date"
							>{t('family.bornDate', { values: { date: baby.birth_date } })}</span
						>
					{/if}
				</div>
			{/each}
		{/if}
	</section>

	{#if !session.user}
		<section class="section-card">
			<p class="empty">{t('family.signInPrompt')}</p>
		</section>
	{:else}
		{#if pendingInvites.length > 0}
			<section class="section-card">
				<h2 class="section-title">{t('family.pendingInvitations')}</h2>
				{#each pendingInvites as invite (invite.family_id)}
					<div class="pending-invite-row">
						<div>
							<p class="member-name">{invite.family_name}</p>
							{#if invite.invited_by}
								<p class="member-email">Invited by {invite.invited_by}</p>
							{/if}
						</div>
						<div class="pending-actions">
							<Button
								variant="primary"
								size="sm"
								loading={responding === invite.family_id}
								onclick={() => handleAcceptInvite(invite)}
							>
								{t('family.accept')}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								loading={responding === invite.family_id}
								onclick={() => handleDeclineInvite(invite)}
							>
								{t('family.decline')}
							</Button>
						</div>
					</div>
				{/each}
			</section>
		{/if}

		{#if !familyId}
			<section class="section-card">
				<h2 class="section-title">{t('family.createFamilyTitle')}</h2>
				<p class="empty">{t('family.notInFamily')}</p>
				{#if showCreateForm}
					<form onsubmit={handleCreateFamily} class="invite-form">
						<input
							class="form-input"
							type="text"
							bind:value={newFamilyName}
							placeholder={t('family.familyNamePlaceholder')}
							required
						/>
						<div class="form-row">
							<Button
								variant="ghost"
								size="sm"
								type="button"
								onclick={() => (showCreateForm = false)}
							>
								{t('common.cancel')}
							</Button>
							<Button variant="primary" size="sm" type="submit" loading={saving}
								>{t('family.createFamily')}</Button
							>
						</div>
					</form>
				{:else}
					<Button variant="primary" size="sm" onclick={() => (showCreateForm = true)}>
						{t('family.createFamily')}
					</Button>
				{/if}
			</section>
		{:else}
			<section class="section-card">
				<div class="section-header">
					<h2 class="section-title">
						{t('family.membersHeading', { values: { count: members.length } })}
					</h2>
				</div>
				{#each members as member (member.user_id ?? member.email)}
					<div class="member-row">
						<div>
							<p class="member-name">
								{getMemberDisplayLabel(member)}
								{#if member.user_id === session.user?.id}
									<span class="tag tag--you">{t('family.youTag')}</span>
								{/if}
							</p>
							{#if member.display_name && member.email}
								<p class="member-email">{member.email}</p>
							{/if}
						</div>
						<div>
							<span class="tag {member.role === 'owner' ? 'tag--owner' : ''}">
								{member.role === 'owner' ? t('family.ownerTag') : member.role}
							</span>
							{#if member.status !== 'joined'}
								<span class="tag tag--pending">
									{member.status === 'pending' ? t('family.pendingTag') : t('family.invitedTag')}
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</section>

			{#if isOwner}
				<section class="section-card">
					<h2 class="section-title">{t('family.inviteMember')}</h2>
					<form onsubmit={handleInviteMember} class="invite-form">
						<input
							id="invite-email"
							class="form-input"
							type="email"
							bind:value={inviteEmail}
							placeholder={t('family.emailPlaceholder')}
							required
						/>
						<div class="form-row">
							<Button variant="primary" size="sm" type="submit" loading={inviting}>
								{t('family.sendInvitation')}
							</Button>
						</div>
					</form>
				</section>

				<section class="section-card">
					<h2 class="section-title">{t('family.inviteByCode')}</h2>
					<p class="help-text">{t('family.inviteByCodeHelp')}</p>

					<div class="form-row code-actions">
						<Button
							variant="primary"
							size="sm"
							onclick={handleGenerateInviteCode}
							loading={generatingInviteCode}
						>
							{t('family.generateCode')}
						</Button>
					</div>

					{#if generatedInviteCode && latestInviteLink}
						<div class="invite-code-card">
							<QrCode value={latestInviteLink} label={t('family.inviteQrLabel')} size={220} />
							<p class="invite-code-value">{generatedInviteCode}</p>
							<p class="help-text code-help">{t('family.scanOrTypeCode')}</p>
						</div>
					{/if}

					{#if activeInviteCodes.length > 0}
						<div class="code-list">
							{#each activeInviteCodes as inviteCode (inviteCode.code_id)}
								<div class="code-row">
									<div>
										<p class="code-hint">****{inviteCode.code_hint}</p>
										<p class="code-meta">
											{t('family.codeUsage', {
												values: { used: inviteCode.uses, max: inviteCode.max_uses }
											})}
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleRevokeInviteCode(inviteCode.code_id)}
										loading={revokingInviteCodeId === inviteCode.code_id}
									>
										{t('family.revokeCode')}
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.page {
		padding: var(--space-4) var(--space-4) calc(var(--bottom-nav-h) + var(--space-6));
		max-width: 600px;
		margin: 0 auto;
	}
	.page-title {
		font-size: var(--font-size-5);
		font-weight: var(--fw-bold);
		margin: 0 0 var(--space-5);
	}
	.section-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-3);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
	}
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-3);
	}
	.section-title {
		font-size: var(--font-size-4);
		font-weight: var(--fw-semibold);
		margin: 0;
	}
	.baby-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border);
		font-weight: var(--fw-semibold);
	}
	.baby-row:last-child {
		border-bottom: none;
	}
	.birth-date {
		font-size: var(--font-size-1);
		color: var(--text-2);
		font-weight: normal;
	}
	.member-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border);
	}
	.member-row:last-child {
		border-bottom: none;
	}
	.member-name {
		font-weight: var(--fw-semibold);
	}
	.member-email {
		font-size: var(--font-size-1);
		color: var(--text-2);
	}
	.tag {
		display: inline-flex;
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-1);
		font-weight: var(--fw-semibold);
	}
	.tag--owner {
		background: var(--brand-subtle);
		color: var(--brand);
	}
	.tag--pending {
		background: hsl(45 100% 92%);
		color: hsl(45 80% 30%);
	}
	.tag--you {
		background: var(--surface-2);
		color: var(--text-2);
	}
	.invite-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.form-input {
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-3) var(--space-4);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface);
		color: var(--text);
		font-family: inherit;
		font-size: var(--font-size-3);
		box-sizing: border-box;
	}
	.form-input:focus {
		outline: 2px solid var(--brand);
		border-color: var(--brand);
	}
	.form-row {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}
	.code-actions {
		justify-content: flex-start;
	}
	.help-text {
		color: var(--text-2);
		font-size: var(--font-size-2);
		margin: 0;
	}
	.invite-code-card {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface-2);
	}
	.invite-code-value {
		margin: 0;
		font-family: var(--font-mono, monospace);
		font-size: var(--font-size-4);
		font-weight: var(--fw-bold);
		letter-spacing: 0.08em;
	}
	.code-help {
		text-align: center;
	}
	.code-list {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.code-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) 0;
		border-top: 1px solid var(--border);
	}
	.code-hint {
		margin: 0;
		font-family: var(--font-mono, monospace);
		font-size: var(--font-size-3);
		font-weight: var(--fw-semibold);
	}
	.code-meta {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-1);
		color: var(--text-2);
	}
	.empty {
		color: var(--text-2);
		font-size: var(--font-size-2);
		padding: var(--space-3) 0;
	}
	.error-msg {
		color: var(--danger);
		background: hsl(0 80% 97%);
		border: 1px solid hsl(0 80% 88%);
		border-radius: var(--radius-2);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-3);
		font-size: var(--font-size-2);
	}
	.success-msg {
		color: hsl(140 60% 25%);
		background: hsl(140 60% 95%);
		border: 1px solid hsl(140 60% 80%);
		border-radius: var(--radius-2);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-3);
		font-size: var(--font-size-2);
	}
	.pending-invite-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) 0;
	}
	.pending-actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
