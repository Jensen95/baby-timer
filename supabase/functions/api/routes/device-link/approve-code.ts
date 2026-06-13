import { contentJson, OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { AuthError, getUserId, serviceClient } from '../../../_shared/auth.ts';
import { shortCodeHash } from '../../../_shared/short-code.ts';

export class ApproveDeviceLinkByCode extends OpenAPIRoute {
	override schema = {
		request: {
			body: contentJson(
				z.object({
					userCode: z.string(),
				}),
			),
		},
		responses: {
			'200': {
				description: 'Device link approved',
				...contentJson(
					z.object({
						approved: z.boolean(),
					}),
				),
			},
		},
	};

	override async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const userId = await getUserId(req);
		const { userCode } = data.body;

		const hash = await shortCodeHash(userCode);

		const { data: memberRow } = await serviceClient
			.from('family_members')
			.select('family_id')
			.eq('user_id', userId)
			.not('joined_at', 'is', null)
			.order('invited_at')
			.limit(1)
			.maybeSingle();
		const resolvedFamilyId: string | null = memberRow?.family_id ?? null;

		const { data: existing, error: fetchError } = await serviceClient
			.from('device_link_sessions')
			.select('requester_user_id, requester_family_id, attempt_count')
			.eq('user_code_hash', hash)
			.maybeSingle();

		if (fetchError) throw new AuthError(500, fetchError.message);

		const requesterUserId = existing?.requester_user_id ?? userId;
		const requesterFamilyId = existing?.requester_family_id ?? resolvedFamilyId;
		const attemptCount = (existing?.attempt_count ?? 0) + 1;

		const { data: updated, error: updateError } = await serviceClient
			.from('device_link_sessions')
			.update({
				approved_at: new Date().toISOString(),
				approved_by_user_id: userId,
				denied_at: null,
				denied_by_user_id: null,
				requester_user_id: requesterUserId,
				requester_family_id: requesterFamilyId,
				attempt_count: attemptCount,
				last_attempt_at: new Date().toISOString(),
			})
			.eq('user_code_hash', hash)
			.is('approved_at', null)
			.is('denied_at', null)
			.is('consumed_at', null)
			.gt('expires_at', new Date().toISOString())
			.select();

		if (updateError) throw new AuthError(500, updateError.message);
		if (!updated || updated.length === 0) {
			throw new AuthError(404, 'Request not found or no longer valid.');
		}

		return c.json({ approved: true });
	}
}
