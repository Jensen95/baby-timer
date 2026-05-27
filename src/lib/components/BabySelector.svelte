<script lang="ts">
	import { getContext } from 'svelte';
	import { base } from '$app/paths';
	import { ChevronDown, Check } from '@lucide/svelte';
	import { t } from '@sveltia/i18n';
	import Sheet from './Sheet.svelte';
	import { BABY_STATE_KEY } from '$lib/state/baby.svelte';
	import type { BabyState } from '$lib/state/baby.svelte';

	const babyState = getContext<BabyState>(BABY_STATE_KEY);

	let open = $state(false);

	function computeAge(birthDate: string): string {
		const birth = new Date(birthDate);
		const now = new Date();
		const months =
			(now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
		if (months < 1) return t('babySelector.newborn');
		if (months < 24) return t('babySelector.ageMonths', { values: { months } });
		return t('babySelector.ageYearsMonths', {
			values: { years: Math.floor(months / 12), months: months % 12 }
		});
	}

	function selectBaby(id: string) {
		babyState.selectBaby(id);
		open = false;
	}
</script>

{#if babyState.babies.length <= 1}
	<span class="pill pill--static">
		{babyState.selectedBaby?.name ?? t('babySelector.selectBaby')}
	</span>
{:else}
	<button class="pill" type="button" onclick={() => (open = true)}>
		{babyState.selectedBaby?.name ?? t('babySelector.selectBaby')}
		<ChevronDown size={16} aria-hidden="true" />
	</button>
{/if}

<Sheet title={t('babySelector.switchBaby')} {open} onclose={() => (open = false)}>
	<ul class="baby-list" role="listbox" aria-label={t('babySelector.selectBaby')}>
		{#each babyState.babies as baby (baby.id)}
			{@const selected = baby.id === babyState.selectedBabyId}
			{@const age = baby.birth_date ? computeAge(baby.birth_date) : null}
			<li role="none">
				<button
					class="baby-row"
					class:baby-row--selected={selected}
					type="button"
					role="option"
					aria-selected={selected}
					onclick={() => selectBaby(baby.id)}
				>
					<div class="baby-row__info">
						<span class="baby-row__name">{baby.name}</span>
						{#if age}
							<span class="baby-row__age" class:baby-row__age--selected={selected}>{age}</span>
						{/if}
					</div>
					{#if selected}
						<Check size={18} aria-hidden="true" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
	{#snippet footer()}
		<a href="{base}/app/family" class="manage-link" onclick={() => (open = false)}>
			{t('babySelector.manageBabies')}
		</a>
	{/snippet}
</Sheet>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		min-height: var(--tap-min);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		color: var(--text);
		font-weight: var(--fw-semibold);
		font-family: inherit;
		font-size: var(--font-size-3);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.pill:hover {
		background: var(--surface-3);
	}

	.pill:active {
		background: var(--surface-3);
	}

	.pill--static {
		border: none;
		cursor: default;
	}

	.baby-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.baby-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		min-height: var(--tap-comfortable);
		border-radius: var(--radius-2);
		border: none;
		background: transparent;
		color: var(--text);
		font-family: inherit;
		font-size: var(--font-size-3);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
		text-align: left;
	}

	.baby-row:hover {
		background: var(--surface-2);
	}

	.baby-row--selected {
		background: var(--brand-subtle);
		color: var(--brand);
	}

	.baby-row--selected:hover {
		background: var(--brand-subtle);
	}

	.baby-row__info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.baby-row__name {
		font-weight: var(--fw-semibold);
	}

	.baby-row__age {
		font-size: var(--font-size-2);
		color: var(--text-2);
	}

	.baby-row__age--selected {
		color: var(--brand);
	}

	.manage-link {
		display: block;
		color: var(--brand);
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-3);
		text-decoration: none;
	}

	.manage-link:hover {
		text-decoration: underline;
	}
</style>
