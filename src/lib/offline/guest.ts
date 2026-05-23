const GUEST_ID_KEY = 'baby-timer:guest-id';

export function getGuestId(): string {
	let id = localStorage.getItem(GUEST_ID_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(GUEST_ID_KEY, id);
	}
	return id;
}

export function isGuest(userId?: string | null): boolean {
	return !userId;
}

export function clearGuestId(): void {
	localStorage.removeItem(GUEST_ID_KEY);
}
