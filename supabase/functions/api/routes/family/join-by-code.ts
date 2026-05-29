import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import { getUserId, serviceClient, AuthError } from '../../../_shared/auth.ts';
import { shortCodeHash } from '../../../_shared/short-code.ts';

export class JoinFamilyByCode extends OpenAPIRoute {
	schema = {
		request: {
			body: contentJson(
				z.object({
					code: z.string()
				})
			)
		},
		responses: {
			'200': {
				description: 'Joined family',
				...contentJson(
					z.object({
						family_id: z.string()
					})
				)
			}
		}
	};

	async handle(c: Context) {
		const data = await this.getValidatedData<typeof this.schema>();
		const req = c.req.raw;
		const userId = await getUserId(req);

		const { code } = data.body;
		const hash = await shortCodeHash(code);
		const now = new Date().toISOString();

		const { data: candidates, error: lookupErr } = await serviceClient
			.from('family_invite_codes')
			.select('id, family_id, uses, max_uses')
			.eq('code_hash', hash)
			.is('revoked_at', null)
			.gt('expires_at', now);

		if (lookupErr) throw new AuthError(500, lookupErr.message);

		const validCode = (candidates ?? []).find((r) => r.uses < r.max_uses);
		if (!validCode) throw new AuthError(400, 'Invalid or expired invite code.');

		const familyId = validCode.family_id;

		const { data: existingMemberships, error: memberErr } = await serviceClient
			.from('family_members')
			.select('family_id, joined_at')
			.eq('user_id', userId)
			.not('joined_at', 'is', null);

		if (memberErr) throw new AuthError(500, memberErr.message);

		for (const membership of existingMemberships ?? []) {
			if (membership.family_id !== familyId) {
				throw new AuthError(409, 'You can only be part of one family at a time.');
			}
			// membership.family_id === familyId: already a member of THIS family
			throw new AuthError(409, 'You are already in this family.');
		}

		const { error: incrementErr } = await serviceClient
			.from('family_invite_codes')
			.update({ uses: validCode.uses + 1 })
			.eq('id', validCode.id)
			.eq('family_id', familyId)
			.is('revoked_at', null)
			.gt('expires_at', now)
			.lt('uses', validCode.max_uses);

		if (incrementErr) throw new AuthError(500, incrementErr.message);

		const { error: upsertErr } = await serviceClient.from('family_members').upsert(
			{
				family_id: familyId,
				user_id: userId,
				role: 'member',
				joined_at: new Date().toISOString()
			},
			{ onConflict: 'family_id,user_id' }
		);

		if (upsertErr) throw new AuthError(500, upsertErr.message);

		return c.json({ family_id: familyId });
	}
}
