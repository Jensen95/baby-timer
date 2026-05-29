import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { getUserId, serviceClient, AuthError } from '../../../_shared/auth.ts';

export class ApproveDeviceLinkByQr extends OpenAPIRoute {
	schema = {
		request: {
			body: contentJson(
				z.object({
					approvalQrToken: z.string()
				})
			)
		},
		responses: {
			'200': {
				description: 'Device link approved',
				...contentJson(
					z.object({
						approved: z.boolean()
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const userId = await getUserId(req);
		const { approvalQrToken } = data.body;

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
			.select('requester_user_id, requester_family_id')
			.eq('approval_qr_token', approvalQrToken)
			.maybeSingle();

		if (fetchError) throw new AuthError(500, fetchError.message);

		const requesterUserId = existing?.requester_user_id ?? userId;
		const requesterFamilyId = existing?.requester_family_id ?? resolvedFamilyId;

		const { data: updated, error: updateError } = await serviceClient
			.from('device_link_sessions')
			.update({
				approved_at: new Date().toISOString(),
				approved_by_user_id: userId,
				denied_at: null,
				denied_by_user_id: null,
				requester_user_id: requesterUserId,
				requester_family_id: requesterFamilyId
			})
			.eq('approval_qr_token', approvalQrToken)
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
