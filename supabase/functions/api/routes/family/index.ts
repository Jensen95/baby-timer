import type { fromHono } from 'chanfana';
import { CreateFamily } from './create-family.ts';
import { CreateFamilyInviteCode } from './create-invite-code.ts';
import { ListActiveFamilyInviteCodes } from './list-invite-codes.ts';
import { RevokeFamilyInviteCode } from './revoke-invite-code.ts';
import { JoinFamilyByCode } from './join-by-code.ts';

export type Api = ReturnType<typeof fromHono>;

export function registerFamilyRoutes(openapi: Api): void {
	openapi.post('/family/create', CreateFamily);
	openapi.post('/family/invite-code/create', CreateFamilyInviteCode);
	openapi.post('/family/invite-code/list', ListActiveFamilyInviteCodes);
	openapi.post('/family/invite-code/revoke', RevokeFamilyInviteCode);
	openapi.post('/family/join-by-code', JoinFamilyByCode);
}
