<script lang="ts">
	import { formatDuration, formatDateTime } from '$lib/timer/format';

	interface Props {
		type: 'feeding' | 'sleep';
		side: string;
		startedAt: Date;
		endedAt: Date | null;
		durationSeconds: number | null;
		note?: string | null;
	}

	let { type, side, startedAt, endedAt, durationSeconds, note }: Props = $props();

	const typeLabel = $derived(type === 'feeding' ? '🍼' : '😴');
	const isActive = $derived(endedAt === null);
</script>

<div class="card mb-3">
	<div class="card-content py-3">
		<div class="level is-mobile">
			<div class="level-left">
				<div class="level-item">
					<div>
						<p class="is-size-5">
							<span class="mr-2">{typeLabel}</span>
							<span class="has-text-weight-semibold">{side}</span>
							{#if isActive}
								<span class="tag is-warning is-light ml-2">Active</span>
							{/if}
						</p>
						<p class="is-size-7 has-text-grey">{formatDateTime(startedAt)}</p>
						{#if note}
							<p class="is-size-7 has-text-grey-light mt-1">{note}</p>
						{/if}
					</div>
				</div>
			</div>
			<div class="level-right">
				<div class="level-item has-text-right">
					{#if durationSeconds !== null}
						<p class="is-size-5 has-text-weight-semibold is-family-monospace">
							{formatDuration(durationSeconds)}
						</p>
					{:else}
						<p class="has-text-grey">In progress</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
