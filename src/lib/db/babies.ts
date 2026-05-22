import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Insert, Tables } from './database.types';

type Client = SupabaseClient<Database>;
export type Baby = Tables<'babies'>;

export async function listBabies(client: Client, familyId: string): Promise<Baby[]> {
	const { data, error } = await client
		.from('babies')
		.select('*')
		.eq('family_id', familyId)
		.order('created_at', { ascending: true });

	if (error) throw error;
	return data;
}

export async function createBaby(client: Client, payload: Insert<'babies'>): Promise<Baby> {
	const { data, error } = await (client as any)
		.from('babies' as const)
		.insert([payload])
		.select()
		.single();

	if (error) throw error;
	return data;
}

export async function getBaby(client: Client, id: string): Promise<Baby | null> {
	const { data, error } = await client.from('babies').select('*').eq('id', id).maybeSingle();

	if (error) throw error;
	return data;
}
