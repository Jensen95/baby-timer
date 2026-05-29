import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { getUserId, userClient, assertFamilyOwner, AuthError } from '../../../_shared/auth.ts';

export class RevokeFamilyInviteCode extends OpenAPIRoute {
	schema = {
		request: {
			body: contentJson(
				z.object({
					familyId: z.string().uuid(),
					codeId: z.string().uuid()
				})
			)
		},
		responses: {
			'200': {
				description: 'Invite code revoked',
				...contentJson(
					z.object({
						revoked: z.literal(true)
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const userId = await getUserId(req);
		const client = userClient(req);

		const { familyId, codeId } = data.body;

		await assertFamilyOwner(client, familyId, userId);

		const { data: rows, error } = await client
			.from('family_invite_codes')
			.update({ revoked_at: new Date().toISOString() })
			.eq('id', codeId)
			.eq('family_id', familyId)
			.is('revoked_at', null)
			.select();

		if (error) throw new AuthError(500, error.message);
		if (!rows || rows.length === 0) throw new AuthError(404, 'Invite code not found.');

		return c.json({ revoked: true as const });
	}
}
