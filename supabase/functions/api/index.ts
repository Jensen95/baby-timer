import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fromHono } from 'chanfana';
import { captureException, initErrorTracking } from '../_shared/error-tracking.ts';
import { AuthError } from '../_shared/auth.ts';
import { registerFamilyRoutes } from './routes/family/index.ts';
import { registerDeviceLinkRoutes } from './routes/device-link/index.ts';

initErrorTracking('api');

const app = new Hono();

app.use(
	'*',
	cors({
		origin: '*',
		allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
		allowMethods: ['GET', 'POST', 'OPTIONS'],
	}),
);

// Errors thrown from route handlers land here. AuthError carries an HTTP status;
// everything else is an unexpected 500 and is reported to Bugsink.
app.onError((err, c) => {
	if (err instanceof AuthError) {
		return c.json({ error: err.message }, err.status as 400);
	}
	captureException(err);
	console.error('Unhandled error in api function:', err);
	return c.json({ error: 'Unexpected error' }, 500);
});

// Chanfana wraps the Hono app: routes registered via `openapi.post(...)` get
// Zod request/response validation and are published to /api/openapi.json.
export const openapi = fromHono(app, {
	base: '/api',
	schema: {
		info: {
			title: 'Baby Timer API',
			version: '1.0.0',
			description: 'Family, invite-code and device-link operations migrated out of Postgres RPCs.',
		},
	},
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

registerFamilyRoutes(openapi);
registerDeviceLinkRoutes(openapi);

Deno.serve(app.fetch);
