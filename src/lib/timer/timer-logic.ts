export interface TimerState {
	startedAt: Date | null;
	running: boolean;
}

export interface TimerResult {
	startedAt: Date;
	endedAt: Date;
	durationSeconds: number;
}

export function computeElapsed(startedAt: Date | null, running: boolean, now: number): number {
	if (!running || !startedAt) return 0;
	return Math.floor((now - startedAt.getTime()) / 1000);
}

export function buildTimerResult(startedAt: Date, endedAt: Date): TimerResult {
	return {
		startedAt,
		endedAt,
		durationSeconds: Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
	};
}
