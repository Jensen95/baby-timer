import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';

type Client = SupabaseClient<Database>;
export type Family = Tables<'families'>;
export type FamilyMember = Tables<'family_members'>;
type ListFamilyMemberDetailsArgs =
	Database['public']['Functions']['list_family_members_with_profiles']['Args'];
type AddFamilyMemberByEmailArgs =
	Database['public']['Functions']['add_family_member_by_email']['Args'];
export type FamilyMemberDetails = FamilyMember & {
	display_name: string | null;
	email: string | null;
};

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
	const { data, error } = await client.rpc('list_family_members_with_profiles', args as never);

	if (error) throw error;
	return data ?? [];
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
	email: string
): Promise<FamilyMember> {
	const args: AddFamilyMemberByEmailArgs = {
		target_family_id: familyId,
		target_email: email
	};
	const { data, error } = await client.rpc('add_family_member_by_email', args as never);

	if (error) throw error;
	return data as FamilyMember;
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
