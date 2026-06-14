/**
 * Returns the base URL to use for post-login redirect targets.
 *
 * In production, this is the current window origin (so magic links always point
 * back to wherever the app is actually hosted). In local dev or CI, callers can
 * supply PUBLIC_APP_REDIRECT_URL (baked in at build time) to override without
 * touching Supabase project settings.
 *
 * The override is a BUILD-TIME value only — it is never read from an untrusted
 * runtime source such as a URL query parameter, so there is no open-redirect risk.
 */
export function resolveRedirectBase(
	overrideUrl: string | undefined,
	windowOrigin: string | undefined
): string {
	const trimmed = overrideUrl?.trim();
	if (trimmed) {
		return trimmed.replace(/\/+$/, '');
	}
	return (windowOrigin ?? '').replace(/\/+$/, '');
}
