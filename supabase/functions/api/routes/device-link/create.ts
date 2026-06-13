import { contentJson, OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { AuthError, bearerToken, serviceClient } from '../../../_shared/auth.ts';
import { generateShortCode, shortCodeHash } from '../../../_shared/short-code.ts';

export class CreateDeviceLinkRequest extends OpenAPIRoute {
	override schema = {
		request: {
			body: contentJson(
				z.object({
					deviceLabel: z.string().nullable().optional(),
					ttlMinutes: z.number().int().optional(),
				}),
			),
		},
		responses: {
			'200': {
				description: 'Device link request created',
				...contentJson(
					z.object({
						request_id: z.string(),
						user_code: z.string(),
						approval_qr_token: z.string(),
						poll_token: z.string(),
						expires_at: z.string(),
					}),
				),
			},
		},
	};

	override async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const { deviceLabel, ttlMinutes } = data.body;

		const token = bearerToken(req);
		let userId: string | null = null;
		if (token) {
			const { data: userData } = await serviceClient.auth.getUser(token);
			userId = userData.user?.id ?? null;
		}

		let resolvedFamilyId: string | null = null;
		if (userId) {
			const { data: memberRow } = await serviceClient
				.from('family_members')
				.select('family_id')
				.eq('user_id', userId)
				.not('joined_at', 'is', null)
				.order('invited_at')
				.limit(1)
				.maybeSingle();
			resolvedFamilyId = memberRow?.family_id ?? null;
		}

		const ttl = Math.max(3, Math.min(ttlMinutes ?? 10, 30));
		const expiresAt = new Date(Date.now() + ttl * 60000).toISOString();

		for (let attempt = 0; attempt < 5; attempt++) {
			const code = generateShortCode();
			const hash = await shortCodeHash(code);

			const { data: row, error } = await serviceClient
				.from('device_link_sessions')
				.insert({
					requester_user_id: userId,
					requester_family_id: resolvedFamilyId,
					device_label: deviceLabel ?? null,
					user_code_hash: hash,
					user_code_hint: code.slice(-4),
					expires_at: expiresAt,
				})
				.select('id, approval_qr_token, poll_token, expires_at')
				.single();

			if (error) {
				if (error.code === '23505') continue;
				throw new AuthError(500, error.message);
			}

			return c.json({
				request_id: row.id,
				user_code: code,
				approval_qr_token: row.approval_qr_token,
				poll_token: row.poll_token,
				expires_at: row.expires_at,
			});
		}

		throw new AuthError(500, 'Could not allocate device link request.');
	}
}
