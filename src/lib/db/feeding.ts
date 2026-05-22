import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Insert, Update, Tables } from './database.types';

type Client = SupabaseClient<Database>;
export type FeedingSession = Tables<'feeding_sessions'>;

export async function startFeeding(
	client: Client,
	payload: Omit<Insert<'feeding_sessions'>, 'ended_at'>
): Promise<FeedingSession> {
	const { data, error } = await (client as any)
		.from('feeding_sessions' as const)
		.insert([{ ...payload, ended_at: null }])
		.select()
		.single();

	if (error) throw error;
	return data;
}

export async function stopFeeding(
	client: Client,
	id: string,
	endedAt: Date
): Promise<FeedingSession> {
	const { data, error } = await (client as any)
		.from('feeding_sessions' as const)
		.update({ ended_at: endedAt.toISOString() })
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data;
}

export async function listFeedingSessions(
	client: Client,
	babyId: string,
	limit = 50
): Promise<FeedingSession[]> {
	const { data, error } = await client
		.from('feeding_sessions')
		.select('*')
		.eq('baby_id', babyId)
		.order('started_at', { ascending: false })
		.limit(limit);

	if (error) throw error;
	return data;
}

export async function getActiveFeedingSession(
	client: Client,
	babyId: string
): Promise<FeedingSession | null> {
	const { data, error } = await client
		.from('feeding_sessions')
		.select('*')
		.eq('baby_id', babyId)
		.is('ended_at', null)
		.order('started_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) throw error;
	return data;
}
