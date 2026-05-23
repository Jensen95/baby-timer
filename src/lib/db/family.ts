import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';

type Client = SupabaseClient<Database>;
export type Family = Tables<'families'>;
export type FamilyMember = Tables<'family_members'>;
export type FamilyInvite = Tables<'family_invites'>;
type ListFamilyMemberDetailsArgs =
	Database['public']['Functions']['list_family_members_with_profiles']['Args'];
type AddFamilyMemberByEmailArgs =
	Database['public']['Functions']['add_family_member_by_email']['Args'];

export type MemberStatus = 'joined' | 'pending' | 'invited';

export type FamilyMemberDetails = {
	user_id: string | null;
	family_id: string;
	role: 'owner' | 'member';
	invited_at: string;
	joined_at: string | null;
	display_name: string | null;
	email: string | null;
	status: MemberStatus;
};

export type PendingMembership = {
	family_id: string;
	family_name: string;
	invited_at: string;
	invited_by: string | null;
};

/**
 * Returns a human-readable label for a family member.
 * Prefers display_name, then email, then user_id, then 'Unknown'.
 */
export function getMemberDisplayLabel(
	member: Pick<FamilyMemberDetails, 'display_name' | 'email' | 'user_id'>
): string {
	return member.display_name ?? member.email ?? member.user_id ?? 'Unknown';
}

export async function getFamily(client: Client, familyId: string): Promise<Family | null> {
	const { data, error } = await client
		.from('families')
		.select('*')
		.eq('id', familyId)
		.maybeSingle();

	if (error) throw error;
	return data;
}

export async function getUserFamilies(client: Client): Promise<Family[]> {
	const { data, error } = await client
		.from('families')
		.select('*')
		.order('created_at', { ascending: true });

	if (error) throw error;
	return data ?? [];
}

export async function createFamily(client: Client, name: string): Promise<Family> {
	const { data, error } = await client.rpc('create_family', { family_name: name } as any);

	if (error) throw error;
	return data as Family;
}

export async function listFamilyMembers(client: Client, familyId: string): Promise<FamilyMember[]> {
	const { data, error } = await client
		.from('family_members')
		.select('*')
		.eq('family_id', familyId)
		.order('invited_at', { ascending: true });

	if (error) throw error;
	return data ?? [];
}

export async function listFamilyMemberDetails(
	client: Client,
	familyId: string
): Promise<FamilyMemberDetails[]> {
	const args: ListFamilyMemberDetailsArgs = {
		target_family_id: familyId
	};
	// `as never` is required because the Supabase TS client does not correctly
	// resolve generic RPC arg types for this Database shape.
	const { data, error } = await client.rpc('list_family_members_with_profiles', args as never);

	if (error) throw error;
	// Attach family_id to each row (the RPC does not return it for invited placeholders)
	const rows =
		(data as Database['public']['Functions']['list_family_members_with_profiles']['Returns']) ?? [];
	return rows.map((row) => ({ family_id: familyId, ...row }) as FamilyMemberDetails);
}

export async function inviteMember(
	client: Client,
	familyId: string,
	userId: string
): Promise<FamilyMember> {
	const { data, error } = await (client as any)
		.from('family_members' as const)
		.insert([{ family_id: familyId, user_id: userId }])
		.select()
		.single();

	if (error) throw error;
	return data;
}

export async function inviteMemberByEmail(
	client: Client,
	familyId: string,
	familyName: string,
	email: string
): Promise<void> {
	const args: AddFamilyMemberByEmailArgs = {
		target_family_id: familyId,
		target_email: email
	};
	const { error } = await client.rpc('add_family_member_by_email', args as never);

	if (error) throw error;

	// Best-effort: trigger an invitation email via the edge function.
	// Failures here are non-fatal; the invite row was already created.
	try {
		await client.functions.invoke('send-invite', {
			body: { familyId, inviteeEmail: email, familyName }
		});
	} catch {
		// Intentionally swallowed – email delivery failure must not block the invite.
	}
}

export async function acceptFamilyMembership(client: Client, familyId: string): Promise<void> {
	const { error } = await client.rpc('accept_family_membership', {
		target_family_id: familyId
	} as never);

	if (error) throw error;
}

export async function declineFamilyMembership(client: Client, familyId: string): Promise<void> {
	const { error } = await client.rpc('decline_family_membership', {
		target_family_id: familyId
	} as never);

	if (error) throw error;
}

export async function getPendingMemberships(client: Client): Promise<PendingMembership[]> {
	const { data, error } = await client.rpc('get_pending_memberships', {} as never);

	if (error) throw error;
	return (data ?? []) as PendingMembership[];
}

export async function removeMember(
	client: Client,
	familyId: string,
	userId: string
): Promise<void> {
	const { error } = await client
		.from('family_members')
		.delete()
		.eq('family_id', familyId)
		.eq('user_id', userId);

	if (error) throw error;
}
