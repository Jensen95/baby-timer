import type { SupabaseClient } from '@supabase/supabase-js';
import { captureAndThrow } from '$lib/error-tracking';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

export type DeviceLinkRequest = {
	request_id: string;
	user_code: string;
	approval_qr_token: string;
	poll_token: string;
	expires_at: string;
};

export type DeviceLinkStatus = {
	status: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed' | 'not_found';
	expires_at: string | null;
	approved_at: string | null;
	denied_at: string | null;
	approved_by_user_id: string | null;
};

export type ConsumedDeviceLink = {
	status: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed' | 'not_found';
	user_id?: string;
	approved_by_user_id?: string;
};

export type DeviceLinkExchangeResult = {
	status: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed' | 'not_found';
	actionLink?: string;
	error?: string;
};

export async function createDeviceLinkRequest(
	client: Client,
	deviceLabel: string | null,
	ttlMinutes = 10
): Promise<DeviceLinkRequest> {
	const { data, error } = await client.functions.invoke('api/device-link/create', {
		body: { deviceLabel, ttlMinutes },
		method: 'POST'
	});

	if (error) captureAndThrow(error);
	return data as DeviceLinkRequest;
}

export async function getDeviceLinkStatus(
	client: Client,
	pollToken: string
): Promise<DeviceLinkStatus> {
	const { data, error } = await client.functions.invoke('api/device-link/status', {
		body: { pollToken },
		method: 'POST'
	});

	if (error) captureAndThrow(error);
	return (data ?? {
		status: 'not_found',
		expires_at: null,
		approved_at: null,
		denied_at: null,
		approved_by_user_id: null
	}) as DeviceLinkStatus;
}

export async function approveDeviceLinkByQr(
	client: Client,
	approvalQrToken: string
): Promise<void> {
	const { error } = await client.functions.invoke('api/device-link/approve-qr', {
		body: { approvalQrToken },
		method: 'POST'
	});

	if (error) captureAndThrow(error);
}

export async function approveDeviceLinkByCode(client: Client, userCode: string): Promise<void> {
	const { error } = await client.functions.invoke('api/device-link/approve-code', {
		body: { userCode },
		method: 'POST'
	});

	if (error) captureAndThrow(error);
}

export async function consumeDeviceLinkRequest(
	client: Client,
	pollToken: string
): Promise<ConsumedDeviceLink> {
	const { data, error } = await client.functions.invoke('api/device-link/consume', {
		body: { pollToken },
		method: 'POST'
	});

	if (error) captureAndThrow(error);
	return (data ?? { status: 'not_found' }) as ConsumedDeviceLink;
}

export async function exchangeDeviceLinkRequest(
	client: Client,
	pollToken: string,
	redirectBase?: string
): Promise<DeviceLinkExchangeResult> {
	const body: Record<string, string> = { pollToken };
	if (redirectBase) {
		body.redirectTo = `${redirectBase}/app`;
	}

	const { data, error } = await client.functions.invoke('device-link-exchange', {
		method: 'POST',
		body
	});

	if (error) captureAndThrow(error);
	return (data ?? { status: 'not_found' }) as DeviceLinkExchangeResult;
}
