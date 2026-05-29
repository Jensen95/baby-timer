import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { getUserId, serviceClient, AuthError } from '../../../_shared/auth.ts';

export class CreateFamily extends OpenAPIRoute {
	schema = {
		request: {
			body: contentJson(
				z.object({
					name: z
						.string()
						.min(1)
						.transform((s) => s.trim())
				})
			)
		},
		responses: {
			'200': {
				description: 'Family created',
				...contentJson(
					z.object({
						family: z.object({
							id: z.string(),
							name: z.string(),
							created_by: z.string(),
							created_at: z.string()
						})
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const userId = await getUserId(req);

		const { name } = data.body;

		const { data: existingMembership, error: memberErr } = await serviceClient
			.from('family_members')
			.select('user_id')
			.eq('user_id', userId)
			.not('joined_at', 'is', null)
			.maybeSingle();

		if (memberErr) throw new AuthError(500, memberErr.message);
		if (existingMembership) {
			throw new AuthError(409, 'You can only be part of one family at a time.');
		}

		const { data: family, error: insertErr } = await serviceClient
			.from('families')
			.insert({ name, created_by: userId })
			.select()
			.single();

		if (insertErr) throw new AuthError(500, insertErr.message);

		const { error: memberInsertErr } = await serviceClient.from('family_members').insert({
			family_id: family.id,
			user_id: userId,
			role: 'owner',
			joined_at: new Date().toISOString()
		});

		if (memberInsertErr) throw new AuthError(500, memberInsertErr.message);

		return c.json({ family });
	}
}
