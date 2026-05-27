import type { Session, User } from '@supabase/supabase-js';
import { resolve } from '$app/paths';
import { supabase } from '$lib/supabase';

export function createSession() {
	let session = $state<Session | null>(null);
	let user = $state<User | null>(null);
	let loading = $state(true);
	let hasMigrated = $state(false);

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

			session = newSession;
			user = newSession?.user ?? null;
			loading = false;

			if (newSession?.user && (wasSignedOut || _event === 'SIGNED_IN') && !hasMigrated) {
				hasMigrated = true;
				if (typeof window !== 'undefined') {
					window.dispatchEvent(
						new CustomEvent('baby-timer:signed-in', {
							detail: { userId: newSession.user.id }
						})
					);
				}
			}
		});

		return () => subscription.unsubscribe();
	});

	async function signInWithMagicLink(
		email: string,
		displayName = '',
		redirectPath = resolve('/app')
	) {
		const normalizedDisplayName = displayName.trim();
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${window.location.origin}${redirectPath}`,
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
