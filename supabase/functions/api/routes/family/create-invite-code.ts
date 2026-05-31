import { contentJson, OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { assertFamilyOwner, AuthError, getUserId, userClient } from '../../../_shared/auth.ts';
import { generateShortCode, shortCodeHash } from '../../../_shared/short-code.ts';

export class CreateFamilyInviteCode extends OpenAPIRoute {
	override schema = {
		request: {
			body: contentJson(
				z.object({
					familyId: z.string().uuid(),
					ttlMinutes: z.number().int().optional(),
					maxUses: z.number().int().optional(),
				}),
			),
		},
		responses: {
			'200': {
				description: 'Invite code created',
				...contentJson(
					z.object({
						code_id: z.string(),
						code: z.string(),
						expires_at: z.string(),
					}),
				),
			},
		},
	};

	override async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const userId = await getUserId(req);
		const client = userClient(req);

		const { familyId, ttlMinutes, maxUses } = data.body;

		await assertFamilyOwner(client, familyId, userId);

		const ttl = Math.max(5, Math.min(ttlMinutes ?? 60, 10080));
		const effectiveMaxUses = Math.max(1, Math.min(maxUses ?? 25, 1000));
		const expiresAt = new Date(Date.now() + ttl * 60000).toISOString();

		for (let attempt = 0; attempt < 5; attempt++) {
			const code = generateShortCode();
			const hash = await shortCodeHash(code);

			const { data: row, error } = await client
				.from('family_invite_codes')
				.insert({
					family_id: familyId,
					code_hash: hash,
					code_hint: code.slice(-4),
					created_by: userId,
					expires_at: expiresAt,
					max_uses: effectiveMaxUses,
				})
				.select('id, expires_at')
				.single();

			if (error) {
				if (error.code === '23505') continue;
				throw new AuthError(500, error.message);
			}

			return c.json({ code_id: row.id, code, expires_at: row.expires_at });
		}

		throw new AuthError(500, 'Could not allocate invite code.');
	}
}
