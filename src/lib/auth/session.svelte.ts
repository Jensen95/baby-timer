import type { Session, User } from '@supabase/supabase-js';
import { base } from '$app/paths';
import { supabase } from '$lib/supabase';

export function createSession() {
	let session = $state<Session | null>(null);
	let user = $state<User | null>(null);
	let loading = $state(true);

	$effect(() => {
		supabase.auth.getSession().then(({ data }) => {
			session = data.session;
			user = data.session?.user ?? null;
			loading = false;
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			const wasSignedOut = !session;
			const isNowSignedIn = !!newSession?.user;

			if (wasSignedOut && isNowSignedIn && typeof window !== 'undefined') {
				window.dispatchEvent(
					new CustomEvent('baby-timer:signed-in', {
						detail: { userId: newSession!.user.id }
					})
				);
			}

			session = newSession;
			user = newSession?.user ?? null;
			loading = false;
		});

		return () => subscription.unsubscribe();
	});

	async function signInWithMagicLink(email: string, displayName = '') {
		const normalizedDisplayName = displayName.trim();
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${window.location.origin}${base}/app`,
				...(normalizedDisplayName
					? {
							data: {
								display_name: normalizedDisplayName
							}
						}
					: {})
			}
		});
		if (error) throw error;
	}

	async function signOut() {
		const { error } = await supabase.auth.signOut();
		if (error) throw error;
	}

	return {
		get session() {
			return session;
		},
		get user() {
			return user;
		},
		get loading() {
			return loading;
		},
		signInWithMagicLink,
		signOut
	};
}

export type SessionStore = ReturnType<typeof createSession>;
