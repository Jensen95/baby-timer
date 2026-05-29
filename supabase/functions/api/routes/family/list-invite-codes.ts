import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { userClient, AuthError } from '../../../_shared/auth.ts';

export class ListActiveFamilyInviteCodes extends OpenAPIRoute {
	schema = {
		request: {
			body: contentJson(
				z.object({
					familyId: z.string().uuid()
				})
			)
		},
		responses: {
			'200': {
				description: 'Active invite codes',
				...contentJson(
					z.object({
						codes: z.array(
							z.object({
								code_id: z.string(),
								code_hint: z.string(),
								created_at: z.string(),
								expires_at: z.string(),
								max_uses: z.number(),
								uses: z.number()
							})
						)
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const client = userClient(req);

		const { familyId } = data.body;

		const now = new Date().toISOString();

		const { data: rows, error } = await client
			.from('family_invite_codes')
			.select('id, code_hint, created_at, expires_at, max_uses, uses')
			.eq('family_id', familyId)
			.is('revoked_at', null)
			.gt('expires_at', now)
			.order('created_at', { ascending: false });

		if (error) throw new AuthError(500, error.message);

		// PostgREST cannot compare two columns directly; filter uses < max_uses in JS.
		const codes = (rows ?? [])
			.filter((r) => r.uses < r.max_uses)
			.map((r) => ({
				code_id: r.id,
				code_hint: r.code_hint,
				created_at: r.created_at,
				expires_at: r.expires_at,
				max_uses: r.max_uses,
				uses: r.uses
			}));

		return c.json({ codes });
	}
}
