<script lang="ts">
	interface Props {
		data: { label: string; value: number }[];
		color?: string;
		maxValue?: number;
		unit?: string;
		height?: number;
		showValues?: boolean;
	}

	let {
		data,
		color = 'var(--brand)',
		maxValue,
		unit = '',
		height = 160,
		showValues = false
	}: Props = $props();

	const VIEW_WIDTH = 280;
	const PAD_LEFT = 4;
	const PAD_RIGHT = 4;
	const AXIS_LABEL_H = 16;
	const VALUE_LABEL_H = 12;

	let max = $derived(Math.max(maxValue ?? Math.max(0, ...data.map((d) => d.value)), 1));

	let chartTop = $derived(showValues ? VALUE_LABEL_H : 2);
	let chartBottom = $derived(height - AXIS_LABEL_H);
	let chartHeight = $derived(chartBottom - chartTop);

	let plotWidth = $derived(VIEW_WIDTH - PAD_LEFT - PAD_RIGHT);
	let slotWidth = $derived(data.length > 0 ? plotWidth / data.length : plotWidth);
	let barWidth = $derived(Math.max(2, slotWidth * 0.62));

	function barHeight(value: number): number {
		if (value <= 0) return 2;
		return Math.max(2, Math.round((value / max) * chartHeight));
	}

	const gridLineCount = 4;
	let gridLines = $derived(
		Array.from(
			{ length: gridLineCount + 1 },
			(_, i) => chartTop + (chartHeight / gridLineCount) * i
		)
	);

	let bars = $derived(
		data.map((d, i) => {
			const h = barHeight(d.value);
			const cx = PAD_LEFT + slotWidth * i + slotWidth / 2;
			return {
				...d,
				h,
				x: cx - barWidth / 2,
				y: chartBottom - h,
				cx
			};
		})
	);

	let caption = $derived(
		data.length === 0
			? 'Bar chart with no data'
			: 'Bar chart: ' + data.map((d) => `${d.label} ${d.value}${unit ? ' ' + unit : ''}`).join(', ')
	);
</script>

<figure class="bar-chart">
	<svg
		width="100%"
		viewBox="0 0 {VIEW_WIDTH} {height}"
		preserveAspectRatio="none"
		role="img"
		aria-label={caption}
	>
		{#each gridLines as gy}
			<line
				x1={PAD_LEFT}
				y1={gy}
				x2={VIEW_WIDTH - PAD_RIGHT}
				y2={gy}
				stroke="var(--divider)"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
		{/each}

		{#each bars as bar (bar.label)}
			<rect x={bar.x} y={bar.y} width={barWidth} height={bar.h} rx="4" fill={color} />
			<text x={bar.cx} y={height - 4} text-anchor="middle" font-size="10" fill="var(--text-2)">
				{bar.label}
			</text>
			{#if showValues && bar.value > 0}
				<text x={bar.cx} y={bar.y - 4} text-anchor="middle" font-size="10" fill="var(--text-2)">
					{bar.value}
				</text>
			{/if}
		{/each}
	</svg>
	<figcaption class="visually-hidden">{caption}</figcaption>
</figure>

<style>
	.bar-chart {
		margin: 0;
		width: 100%;
	}

	svg text {
		font-family: var(--font-body);
	}
</style>
