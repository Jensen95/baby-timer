import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { serviceClient, AuthError } from '../../../_shared/auth.ts';

export class GetDeviceLinkStatus extends OpenAPIRoute {
	schema = {
		request: {
			body: contentJson(
				z.object({
					pollToken: z.string()
				})
			)
		},
		responses: {
			'200': {
				description: 'Device link status',
				...contentJson(
					z.object({
						status: z.string(),
						expires_at: z.string().nullable(),
						approved_at: z.string().nullable(),
						denied_at: z.string().nullable(),
						approved_by_user_id: z.string().nullable()
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { pollToken } = data.body;

		const { data: row, error } = await serviceClient
			.from('device_link_sessions')
			.select('id, consumed_at, denied_at, expires_at, approved_at, approved_by_user_id')
			.eq('poll_token', pollToken)
			.limit(1)
			.maybeSingle();

		if (error) throw new AuthError(500, error.message);

		if (!row) {
			return c.json({
				status: 'not_found',
				expires_at: null,
				approved_at: null,
				denied_at: null,
				approved_by_user_id: null
			});
		}

		let status: string;
		if (row.consumed_at) {
			status = 'consumed';
		} else if (row.denied_at) {
			status = 'denied';
		} else if (new Date(row.expires_at).getTime() <= Date.now()) {
			status = 'expired';
		} else if (row.approved_at) {
			status = 'approved';
		} else {
			status = 'pending';
		}

		return c.json({
			status,
			expires_at: row.expires_at,
			approved_at: row.approved_at,
			denied_at: row.denied_at,
			approved_by_user_id: row.approved_by_user_id
		});
	}
}
