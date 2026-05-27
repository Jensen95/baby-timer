import type { SupabaseClient } from '@supabase/supabase-js';
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

export async function createDeviceLinkRequest(
	client: Client,
	deviceLabel: string | null,
	ttlMinutes = 10
): Promise<DeviceLinkRequest> {
	const { data, error } = await (client as any).rpc('create_device_link_request', {
		device_label: deviceLabel,
		ttl_minutes: ttlMinutes
	} as never);

	if (error) throw error;
	const rows = (data as DeviceLinkRequest[] | null) ?? [];
	if (!rows[0]) {
		throw new Error('Failed to create device link request');
	}

	return rows[0];
}

export async function getDeviceLinkStatus(
	client: Client,
	pollToken: string
): Promise<DeviceLinkStatus> {
	const { data, error } = await (client as any).rpc('get_device_link_status', {
		input_poll_token: pollToken
	} as never);

	if (error) throw error;
	const rows = (data as Omit<DeviceLinkStatus, 'status'>[] | null) ?? [];
	if (!rows[0]) {
		return {
			status: 'not_found',
			expires_at: null,
			approved_at: null,
			denied_at: null,
			approved_by_user_id: null
		};
	}

	return rows[0] as DeviceLinkStatus;
}

export async function approveDeviceLinkByQr(
	client: Client,
	approvalQrToken: string
): Promise<void> {
	const { error } = await (client as any).rpc('approve_device_link_by_qr', {
		input_approval_qr_token: approvalQrToken
	} as never);

	if (error) throw error;
}

export async function approveDeviceLinkByCode(client: Client, userCode: string): Promise<void> {
	const { error } = await (client as any).rpc('approve_device_link_by_code', {
		input_user_code: userCode
	} as never);

	if (error) throw error;
}

export async function consumeDeviceLinkRequest(
	client: Client,
	pollToken: string
): Promise<ConsumedDeviceLink> {
	const { data, error } = await (client as any).rpc('consume_device_link_request', {
		input_poll_token: pollToken
	} as never);

	if (error) throw error;
	return (data ?? { status: 'not_found' }) as ConsumedDeviceLink;
}
