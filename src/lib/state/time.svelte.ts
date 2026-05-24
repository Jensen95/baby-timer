// Shared "now" tick. Components use this instead of each spinning their own interval.
// Ref-counted: interval only runs while at least one consumer is active.

let now = $state(Date.now());
let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

export function getNow() {
	return now;
}

export function startTick() {
	refCount++;
	if (refCount === 1) {
		intervalId = setInterval(() => {
			now = Date.now();
		}, 1000);
	}
}

export function stopTick() {
	refCount = Math.max(0, refCount - 1);
	if (refCount === 0 && intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
}
