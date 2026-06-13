import type { fromHono } from 'chanfana';
import { CreateDeviceLinkRequest } from './create.ts';
import { GetDeviceLinkStatus } from './status.ts';
import { ApproveDeviceLinkByQr } from './approve-qr.ts';
import { ApproveDeviceLinkByCode } from './approve-code.ts';
import { ConsumeDeviceLinkRequest } from './consume.ts';

export type Api = ReturnType<typeof fromHono>;

export function registerDeviceLinkRoutes(openapi: Api): void {
	openapi.post('/device-link/create', CreateDeviceLinkRequest);
	openapi.post('/device-link/status', GetDeviceLinkStatus);
	openapi.post('/device-link/approve-qr', ApproveDeviceLinkByQr);
	openapi.post('/device-link/approve-code', ApproveDeviceLinkByCode);
	openapi.post('/device-link/consume', ConsumeDeviceLinkRequest);
}
