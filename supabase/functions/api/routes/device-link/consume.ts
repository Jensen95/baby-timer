import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { serviceClient, AuthError } from '../../../_shared/auth.ts';

export class ConsumeDeviceLinkRequest extends OpenAPIRoute {
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
				description: 'Device link consumed or current status',
				...contentJson(
					z.object({
						status: z.string(),
						user_id: z.string().nullable().optional(),
						approved_by_user_id: z.string().nullable().optional()
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { pollToken } = data.body;

		const { data: row, error: fetchError } = await serviceClient
			.from('device_link_sessions')
			.select(
				'id, requester_user_id, approved_by_user_id, approved_at, consumed_at, denied_at, expires_at, attempt_count'
			)
			.eq('poll_token', pollToken)
			.limit(1)
			.maybeSingle();

		if (fetchError) throw new AuthError(500, fetchError.message);

		if (!row) return c.json({ status: 'not_found' });
		if (row.consumed_at) return c.json({ status: 'consumed' });
		if (row.denied_at) return c.json({ status: 'denied' });
		if (new Date(row.expires_at).getTime() <= Date.now()) return c.json({ status: 'expired' });

		if (!row.approved_at) {
			const { error: pendingError } = await serviceClient
				.from('device_link_sessions')
				.update({
					attempt_count: row.attempt_count + 1,
					last_attempt_at: new Date().toISOString()
				})
				.eq('id', row.id);

			if (pendingError) throw new AuthError(500, pendingError.message);
			return c.json({ status: 'pending' });
		}

		const { error: consumeError } = await serviceClient
			.from('device_link_sessions')
			.update({ consumed_at: new Date().toISOString() })
			.eq('id', row.id)
			.is('consumed_at', null);

		if (consumeError) throw new AuthError(500, consumeError.message);

		return c.json({
			status: 'approved',
			user_id: row.requester_user_id,
			approved_by_user_id: row.approved_by_user_id
		});
	}
}
