export function formatTimerDisplay(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
	if (totalSeconds <= 0) return '0s';

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

	return parts.join(' ');
}

export function elapsedSeconds(start: Date, now: Date): number {
	return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
}

export function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date): string {
	return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: Date): string {
	return `${formatDate(date)} ${formatTime(date)}`;
}
