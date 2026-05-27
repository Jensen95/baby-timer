import * as Sentry from '@sentry/sveltekit';
import type { CaptureContext } from '@sentry/sveltekit';
import { PUBLIC_BUGSINK_DSN } from '$env/static/public';

const bugsinkDsn = PUBLIC_BUGSINK_DSN?.trim();
const trackingEnabled = Boolean(bugsinkDsn);

let initialized = false;

export function initErrorTracking() {
	if (!trackingEnabled || initialized) return;

	Sentry.init({
		dsn: bugsinkDsn,
		environment: import.meta.env.MODE,
		release: import.meta.env.VITE_RELEASE || undefined
	});

	initialized = true;
}

export function captureException(error: unknown, context?: CaptureContext) {
	if (!trackingEnabled) return;
	Sentry.captureException(error, context);
}

export function captureMessage(message: string) {
	if (!trackingEnabled) return;
	Sentry.captureMessage(message);
}

export function setTrackingUser(user: { id: string } | null) {
	if (!trackingEnabled) return;
	Sentry.setUser(user);
}

export function captureAndThrow(error: unknown): never {
	captureException(error);
	throw error;
}
