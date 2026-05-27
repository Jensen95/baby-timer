import type { SupabaseClient } from '@supabase/supabase-js';
import { captureAndThrow } from '$lib/error-tracking';
import type { Database, Insert, Update, Tables } from './database.types';

type Client = SupabaseClient<Database>;
export type SleepSession = Tables<'sleep_sessions'>;

export async function startSleep(
	client: Client,
	payload: Omit<Insert<'sleep_sessions'>, 'ended_at'>
): Promise<SleepSession> {
	const { data, error } = await (client as any)
		.from('sleep_sessions' as const)
		.insert([{ ...payload, ended_at: null }])
		.select()
		.single();

	if (error) captureAndThrow(error);
	return data;
}

export async function stopSleep(client: Client, id: string, endedAt: Date): Promise<SleepSession> {
	const { data, error } = await (client as any)
		.from('sleep_sessions' as const)
		.update({ ended_at: endedAt.toISOString() })
		.eq('id', id)
		.select()
		.single();

	if (error) captureAndThrow(error);
	return data;
}

export async function listSleepSessions(
	client: Client,
	babyId: string,
	limit = 50
): Promise<SleepSession[]> {
	const { data, error } = await client
		.from('sleep_sessions')
		.select('*')
		.eq('baby_id', babyId)
		.order('started_at', { ascending: false })
		.limit(limit);

	if (error) captureAndThrow(error);
	return data;
}

export async function getActiveSleepSession(
	client: Client,
	babyId: string
): Promise<SleepSession | null> {
	const { data, error } = await client
		.from('sleep_sessions')
		.select('*')
		.eq('baby_id', babyId)
		.is('ended_at', null)
		.order('started_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) captureAndThrow(error);
	return data;
}
