export interface TimerResult {
	startedAt: Date;
	endedAt: Date;
	durationSeconds: number;
}

export function createTimer() {
	let startedAt = $state<Date | null>(null);
	let running = $state(false);
	let now = $state(Date.now());

	let elapsed = $derived(
		running && startedAt ? Math.floor((now - startedAt.getTime()) / 1000) : 0
	);

	let intervalId: ReturnType<typeof setInterval> | null = null;

	function tick() {
		now = Date.now();
	}

	function start() {
		if (running) return;
		startedAt = new Date();
		running = true;
		now = Date.now();
		intervalId = setInterval(tick, 1000);
	}

	function stop(): TimerResult | null {
		if (!running || !startedAt) return null;
		clearInterval(intervalId!);
		intervalId = null;
		running = false;
		const endedAt = new Date();
		const result: TimerResult = {
			startedAt,
			endedAt,
			durationSeconds: Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
		};
		startedAt = null;
		return result;
	}

	function reset() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		startedAt = null;
		running = false;
		now = Date.now();
	}

	return {
		get startedAt() {
			return startedAt;
		},
		get running() {
			return running;
		},
		get elapsed() {
			return elapsed;
		},
		start,
		stop,
		reset
	};
}

export type Timer = ReturnType<typeof createTimer>;
