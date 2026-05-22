import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Insert, Tables } from './database.types';

type Client = SupabaseClient<Database>;
export type Family = Tables<'families'>;
export type FamilyMember = Tables<'family_members'>;

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
	const { data, error } = await client
		.rpc('create_family', { family_name: name } as any);

	if (error) throw error;
	return data as Family;
}

export async function listFamilyMembers(
	client: Client,
	familyId: string
): Promise<FamilyMember[]> {
	const { data, error } = await client
		.from('family_members')
		.select('*')
		.eq('family_id', familyId)
		.order('invited_at', { ascending: true });

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
