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
	</svg>
	<div class="legend" class:legend-with-pct={showLabels}>
		{#each layout as seg (seg.label)}
			<div class="legend-item">
				<span class="swatch" style="background: {seg.color}"></span>
				<span class="legend-label">{seg.label}</span>
				{#if showLabels}
					<span class="legend-pct">{seg.percent}%</span>
				{:else}
					<span class="legend-value">{seg.value}</span>
				{/if}
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

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}

	.legend-with-pct {
		flex-direction: column;
		gap: var(--space-2);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-2);
		color: var(--text-2);
	}

	.legend-with-pct .legend-item {
		gap: var(--space-2);
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.legend-label {
		flex: 1;
	}

	.legend-value {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.legend-pct {
		font-weight: var(--fw-semibold);
		color: var(--text);
		font-variant-numeric: tabular-nums;
		min-width: 3rem;
		text-align: right;
	}
</style>
