import { handleErrorWithSentry } from '@sentry/sveltekit';
import { initErrorTracking } from '$lib/error-tracking';

initErrorTracking();

export const handleError = handleErrorWithSentry();
