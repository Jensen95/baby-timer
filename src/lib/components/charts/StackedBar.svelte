<script lang="ts">
	interface Props {
		segments: { label: string; value: number; color: string }[];
		total?: number;
		showLabels?: boolean;
		height?: number;
	}

	let { segments, total, showLabels = false, height = 40 }: Props = $props();

	const VIEW_WIDTH = 100;
	const clipId = `stacked-clip-${Math.random().toString(36).slice(2, 9)}`;

	let sum = $derived(total ?? segments.reduce((acc, s) => acc + s.value, 0));

	let layout = $derived.by(() => {
		if (sum <= 0) return [];
		let offset = 0;
		return segments
			.filter((s) => s.value > 0)
			.map((s) => {
				const widthPct = (s.value / sum) * VIEW_WIDTH;
				const seg = {
					...s,
					x: offset,
					width: widthPct,
					percent: Math.round((s.value / sum) * 100)
				};
				offset += widthPct;
				return seg;
			});
	});

	let caption = $derived(
		layout.length === 0
			? 'No data'
			: layout.map((s) => `${s.label}: ${s.value} (${s.percent}%)`).join(', ')
	);
</script>

<figure class="stacked-bar">
	<svg
		width="100%"
		{height}
		viewBox="0 0 {VIEW_WIDTH} {height}"
		preserveAspectRatio="none"
		role="img"
		aria-label={caption}
	>
		<defs>
			<clipPath id={clipId}>
				<rect x="0" y="0" width={VIEW_WIDTH} {height} rx={height / 4} ry={height / 4} />
			</clipPath>
		</defs>
		<g clip-path="url(#{clipId})">
			{#each layout as seg (seg.label)}
				<rect x={seg.x} y="0" width={seg.width} {height} fill={seg.color} />
			{/each}
		</g>
		{#if showLabels}
			{#each layout as seg (seg.label)}
				{#if seg.width > 15}
					<text
						x={seg.x + seg.width / 2}
						y={height / 2}
						text-anchor="middle"
						dominant-baseline="central"
						font-size="11"
						font-weight="bold"
						fill="var(--on-color)"
					>
						{seg.percent}%
					</text>
				{/if}
			{/each}
		{/if}
	</svg>
	<div class="legend">
		{#each layout as seg (seg.label)}
			<div class="legend-item">
				<span class="swatch" style="background: {seg.color}"></span>
				<span class="legend-label">{seg.label}</span>
				<span class="legend-value">{seg.value}</span>
			</div>
		{/each}
	</div>
	<figcaption class="visually-hidden">{caption}</figcaption>
</figure>

<style>
	.stacked-bar {
		margin: 0;
		width: 100%;
	}

	svg text {
		font-family: var(--font-body);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--font-size-2);
		color: var(--text-2);
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.legend-value {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
</style>
