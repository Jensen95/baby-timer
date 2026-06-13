// Shared "now" tick. Components use this instead of each spinning their own interval.
// Ref-counted: interval only runs while at least one consumer is active.
// On visibilitychange/focus/pageshow the clock is immediately refreshed — browsers throttle
// setInterval in hidden tabs and mobile PWAs may suspend JS entirely, so the interval alone
// cannot be relied upon to catch up after the app is reopened.

let now = $state(Date.now());
let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

export function getNow() {
	return now;
}

export function refreshNow() {
	now = Date.now();
}

function handleVisibilityChange() {
	if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
		refreshNow();
	}
}

function handleFocus() {
	refreshNow();
}

function handlePageShow() {
	refreshNow();
}

export function startTick() {
	refCount++;
	if (refCount === 1) {
		intervalId = setInterval(() => {
			now = Date.now();
		}, 1000);
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', handleVisibilityChange);
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('focus', handleFocus);
			window.addEventListener('pageshow', handlePageShow);
		}
	}
}

export function stopTick() {
	refCount = Math.max(0, refCount - 1);
	if (refCount === 0 && intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('pageshow', handlePageShow);
		}
	}
}

export function __resetTickForTest() {
	if (intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
	refCount = 0;
	now = Date.now();
}
