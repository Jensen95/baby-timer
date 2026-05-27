<script lang="ts">
	import { t } from '@sveltia/i18n';
	import type { TimelineSegment } from '$lib/insights/metrics';

	interface DiaperEvent {
		atMs: number;
		label: string;
	}

	interface Props {
		segments: TimelineSegment[];
		dayStart: Date;
		dayEnd: Date;
		height?: number;
		diaperEvents?: DiaperEvent[];
	}

	let { segments, dayStart, dayEnd, height = 48, diaperEvents = [] }: Props = $props();

	const VIEW_WIDTH = 1440;
	const RIBBON_TOP = 6;
	const HOUR_LABEL_H = 12;
	const MIN_SEGMENT_WIDTH = (VIEW_WIDTH * 2) / 100;

	let windowStartMs = $derived(dayStart.getTime());
	let windowEndMs = $derived(dayEnd.getTime());
	let windowMs = $derived(Math.max(1, windowEndMs - windowStartMs));

	let ribbonHeight = $derived(height - RIBBON_TOP - HOUR_LABEL_H);
	let ribbonBottom = $derived(RIBBON_TOP + ribbonHeight);

	function colorFor(type: TimelineSegment['type']): string {
		if (type === 'feed') return 'var(--feed-solid)';
		if (type === 'sleep') return 'var(--sleep-solid)';
		return 'var(--pump-solid)';
	}

	function xFor(ms: number): number {
		return ((ms - windowStartMs) / windowMs) * VIEW_WIDTH;
	}

	let bars = $derived(
		segments.map((seg) => {
			const x = xFor(seg.startMs);
			const rawWidth = xFor(seg.endMs) - x;
			return {
				...seg,
				x,
				width: Math.max(MIN_SEGMENT_WIDTH, rawWidth),
				color: colorFor(seg.type)
			};
		})
	);

	const hourMarks = [
		{ hour: 6, label: t('charts.timeline6am') },
		{ hour: 12, label: t('charts.timeline12pm') },
		{ hour: 18, label: t('charts.timeline6pm') }
	];

	let marks = $derived(
		hourMarks.map((m) => ({
			...m,
			x: (m.hour / 24) * VIEW_WIDTH
		}))
	);

	let dots = $derived(
		diaperEvents.map((d) => ({
			...d,
			x: xFor(d.atMs)
		}))
	);

	let caption = $derived.by(() => {
		const parts = [...bars.map((b) => b.label), ...dots.map((d) => d.label)];
		return parts.length === 0
			? '24-hour timeline with no sessions'
			: '24-hour timeline: ' + parts.join('; ');
	});
</script>

<figure class="timeline">
	<svg
		width="100%"
		{height}
		viewBox="0 0 {VIEW_WIDTH} {height}"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label={caption}
	>
		<rect
			x="0"
			y={RIBBON_TOP}
			width={VIEW_WIDTH}
			height={ribbonHeight}
			rx="6"
			fill="var(--surface-2)"
		/>

		{#each marks as m}
			<line
				x1={m.x}
				y1={RIBBON_TOP}
				x2={m.x}
				y2={ribbonBottom}
				stroke="var(--divider)"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
			<text x={m.x} y={height - 2} text-anchor="middle" font-size="9" fill="var(--text-3)">
				{m.label}
			</text>
		{/each}

		{#each bars as bar, i (i)}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<rect
				x={bar.x}
				y={RIBBON_TOP}
				width={bar.width}
				height={ribbonHeight}
				rx="2"
				fill={bar.color}
				role="img"
				aria-label={bar.label}
				tabindex="0"
			>
				<title>{bar.label}</title>
			</rect>
		{/each}

		{#each dots as dot, i (i)}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<circle
				cx={dot.x}
				cy={RIBBON_TOP + ribbonHeight / 2}
				r="4"
				fill="var(--diaper-solid)"
				role="img"
				aria-label={dot.label}
				tabindex="0"
			>
				<title>{dot.label}</title>
			</circle>
		{/each}
	</svg>
	<figcaption class="visually-hidden">{caption}</figcaption>
</figure>

<style>
	.timeline {
		margin: 0;
		width: 100%;
	}

	svg text {
		font-family: var(--font-body);
	}

	rect:focus-visible,
	circle:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 1px;
	}
</style>
