import * as Sentry from 'npm:@sentry/deno';

let initializedForFunction: string | null = null;
let enabled = false;

export function initErrorTracking(functionName: string) {
	if (initializedForFunction === functionName) return;

	const dsn = Deno.env.get('BUGSINK_DSN')?.trim();
	if (!dsn) {
		enabled = false;
		return;
	}

	Sentry.init({
		dsn,
		environment: Deno.env.get('ENVIRONMENT') ?? Deno.env.get('SUPABASE_ENV') ?? 'production',
		serverName: functionName
	});

	enabled = true;
	initializedForFunction = functionName;
}

export function captureException(error: unknown) {
	if (!enabled) return;
	Sentry.captureException(error);
}

export async function flush(timeout = 2000) {
	if (!enabled) return;
	await Sentry.flush(timeout);
}
