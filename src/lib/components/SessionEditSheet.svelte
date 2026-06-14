<script lang="ts">
	import { t } from '@sveltia/i18n';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import OptionGrid from './OptionGrid.svelte';
	import type { LocalSession } from '$lib/sessions/local-session';
	import type { FeedingSide } from '$lib/sessions/feeding';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { PumpSide } from '$lib/sessions/breast-pump';

	interface Props {
		session: LocalSession | null;
		onclose: () => void;
		onsave: (updated: LocalSession) => Promise<void>;
		ondelete: (session: LocalSession) => Promise<void>;
	}

	let { session, onclose, onsave, ondelete }: Props = $props();

	const open = $derived(session !== null);

	let editStartedAt = $state('');
	let editEndedAt = $state('');
	let editSide = $state('');
	let editYieldMode = $state<'per-side' | 'total-only'>('per-side');
	let editYieldLeftMl = $state('');
	let editYieldRightMl = $state('');
	let editYieldTotalMl = $state('');

	let saving = $state(false);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let validationError = $state<string | null>(null);

	function formatDateTimeInput(date: Date): string {
		const pad = (v: number) => String(v).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function parseDateTimeInput(value: string): Date | null {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	function parseOptionalYield(value: string | number): number | null {
		let numValue = value;
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) {
				return null;
			}
			numValue = trimmed;
		}
		const n = Number(numValue);
		if (!Number.isFinite(n) || n < 0) throw new Error(t('sessions.errors.yieldInvalid'));
		return Math.round(n);
	}

	$effect(() => {
		if (!session) {
			editStartedAt = '';
			editEndedAt = '';
			editSide = '';
			editYieldMode = 'per-side';
			editYieldLeftMl = '';
			editYieldRightMl = '';
			editYieldTotalMl = '';
			validationError = null;
			confirmDelete = false;
			return;
		}
		editStartedAt = formatDateTimeInput(new Date(session.started_at));
		editEndedAt = session.ended_at ? formatDateTimeInput(new Date(session.ended_at)) : '';
		if (session.type === 'diaper_change') {
			const hasPoop = session.has_poop ?? false;
			const hasPee = session.has_pee ?? false;
			editSide = hasPoop && hasPee ? 'both' : hasPoop ? 'poop' : 'pee';
		} else {
			editSide = session.side ?? '';
		}
		if (session.type === 'breast_pump') {
			if (session.yield_total_ml != null) {
				editYieldMode = 'total-only';
				editYieldTotalMl = String(session.yield_total_ml);
				editYieldLeftMl = '';
				editYieldRightMl = '';
			} else {
				editYieldMode = 'per-side';
				editYieldLeftMl = session.yield_left_ml != null ? String(session.yield_left_ml) : '';
				editYieldRightMl = session.yield_right_ml != null ? String(session.yield_right_ml) : '';
				editYieldTotalMl = '';
			}
		} else {
			editYieldLeftMl = session.yield_left_ml != null ? String(session.yield_left_ml) : '';
			editYieldRightMl = session.yield_right_ml != null ? String(session.yield_right_ml) : '';
			editYieldTotalMl = '';
		}
		validationError = null;
		confirmDelete = false;
	});

	const FEEDING_OPTIONS = $derived([
		{ value: 'left', label: t('track.options.left') },
		{ value: 'right', label: t('track.options.right') },
		{ value: 'both', label: t('track.options.both') }
	]);

	const SLEEP_OPTIONS = $derived([
		{ value: 'back', label: t('track.options.back') },
		{ value: 'left', label: t('track.options.headLeft') },
		{ value: 'right', label: t('track.options.headRight') },
		{ value: 'tummy', label: t('track.options.tummy') },
		{ value: 'side', label: t('track.options.side') }
	]);

	const PUMP_OPTIONS = $derived([
		{ value: 'left', label: t('track.options.left') },
		{ value: 'right', label: t('track.options.right') },
		{ value: 'both', label: t('track.options.both') }
	]);

	const DIAPER_OPTIONS = $derived([
		{ value: 'poop', label: t('track.options.poop') },
		{ value: 'pee', label: t('track.options.pee') },
		{ value: 'both', label: t('track.options.both') }
	]);

	const YIELD_MODE_OPTIONS = $derived([
		{ value: 'per-side', label: t('sessions.yieldPerSide') },
		{ value: 'total-only', label: t('sessions.yieldTotalOnly') }
	]);

	const showYieldLeft = $derived(
		editYieldMode === 'per-side' && (editSide === 'left' || editSide === 'both')
	);
	const showYieldRight = $derived(
		editYieldMode === 'per-side' && (editSide === 'right' || editSide === 'both')
	);

	async function handleSave() {
		if (!session) return;
		validationError = null;

		const startedAt = parseDateTimeInput(editStartedAt);
		if (!startedAt) {
			validationError = t('sessions.errors.startRequired');
			return;
		}

		const endedAt = editEndedAt.trim() ? parseDateTimeInput(editEndedAt) : null;
		if (editEndedAt.trim() && !endedAt) {
			validationError = t('sessions.errors.endInvalid');
			return;
		}
		if (endedAt && endedAt < startedAt) {
			validationError = t('sessions.errors.endBeforeStart');
			return;
		}

		let yieldLeftMl: number | null = null;
		let yieldRightMl: number | null = null;
		let yieldTotalMl: number | null = null;
		if (session.type === 'breast_pump') {
			try {
				if (editYieldMode === 'total-only') {
					yieldTotalMl = parseOptionalYield(editYieldTotalMl);
				} else {
					yieldLeftMl = parseOptionalYield(editYieldLeftMl);
					yieldRightMl = parseOptionalYield(editYieldRightMl);
				}
			} catch (e) {
				validationError = e instanceof Error ? e.message : t('sessions.errors.yieldInvalid');
				return;
			}
		}

		let updated: LocalSession;
		if (session.type === 'diaper_change') {
			updated = {
				...session,
				started_at: startedAt.toISOString(),
				ended_at: null,
				has_poop: editSide === 'poop' || editSide === 'both',
				has_pee: editSide === 'pee' || editSide === 'both',
				_sync: 'pending'
			};
		} else if (session.type === 'feeding') {
			updated = {
				...session,
				started_at: startedAt.toISOString(),
				ended_at: endedAt ? endedAt.toISOString() : null,
				side: editSide as FeedingSide,
				_sync: 'pending'
			};
		} else if (session.type === 'sleep') {
			updated = {
				...session,
				started_at: startedAt.toISOString(),
				ended_at: endedAt ? endedAt.toISOString() : null,
				side: editSide as HeadSide,
				_sync: 'pending'
			};
		} else {
			updated = {
				...session,
				started_at: startedAt.toISOString(),
				ended_at: endedAt ? endedAt.toISOString() : null,
				side: editSide as PumpSide,
				yield_left_ml: yieldLeftMl,
				yield_right_ml: yieldRightMl,
				yield_total_ml: yieldTotalMl,
				_sync: 'pending'
			};
		}

		saving = true;
		try {
			await onsave(updated);
		} catch (e) {
			validationError = e instanceof Error ? e.message : t('sessions.errors.saveFailed');
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!session) return;
		deleting = true;
		try {
			await ondelete(session);
		} catch (e) {
			validationError = e instanceof Error ? e.message : t('sessions.errors.deleteFailed');
			deleting = false;
		}
	}

	function handleClose() {
		if (saving || deleting) return;
		onclose();
	}
</script>

<Sheet {open} title={t('sessions.edit')} onclose={handleClose}>
	{#if session}
		<div class="form">
			{#if session.type === 'diaper_change'}
				<div class="field">
					<label class="field-label" for="edit-started-at">{t('sessions.time')}</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">{t('sessions.contents')}</span>
					<OptionGrid
						options={DIAPER_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
			{:else if session.type === 'feeding'}
				<div class="field">
					<label class="field-label" for="edit-started-at">{t('sessions.startTime')}</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<label class="field-label" for="edit-ended-at"
						>{t('sessions.endTime')} <span class="optional">{t('common.optional')}</span></label
					>
					<input
						id="edit-ended-at"
						class="time-input"
						type="datetime-local"
						bind:value={editEndedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">{t('sessions.side')}</span>
					<OptionGrid
						options={FEEDING_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
			{:else if session.type === 'sleep'}
				<div class="field">
					<label class="field-label" for="edit-started-at">{t('sessions.startTime')}</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<label class="field-label" for="edit-ended-at"
						>{t('sessions.endTime')} <span class="optional">{t('common.optional')}</span></label
					>
					<input
						id="edit-ended-at"
						class="time-input"
						type="datetime-local"
						bind:value={editEndedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">{t('sessions.headPosition')}</span>
					<OptionGrid
						options={SLEEP_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
			{:else if session.type === 'breast_pump'}
				<div class="field">
					<label class="field-label" for="edit-started-at">{t('sessions.startTime')}</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<label class="field-label" for="edit-ended-at"
						>{t('sessions.endTime')} <span class="optional">{t('common.optional')}</span></label
					>
					<input
						id="edit-ended-at"
						class="time-input"
						type="datetime-local"
						bind:value={editEndedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">{t('sessions.side')}</span>
					<OptionGrid
						options={PUMP_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
				<div class="field">
					<span class="field-label">{t('sessions.yieldMode')}</span>
					<OptionGrid
						options={YIELD_MODE_OPTIONS}
						value={editYieldMode}
						columns={2}
						onchange={(v) => (editYieldMode = v as 'per-side' | 'total-only')}
					/>
				</div>
				{#if editYieldMode === 'total-only'}
					<div class="field">
						<label class="field-label" for="edit-yield-total">{t('sessions.totalYield')}</label>
						<input
							id="edit-yield-total"
							class="number-input"
							type="number"
							min="0"
							step="1"
							bind:value={editYieldTotalMl}
						/>
					</div>
				{:else}
					{#if showYieldLeft}
						<div class="field">
							<label class="field-label" for="edit-yield-left">{t('sessions.leftYield')}</label>
							<input
								id="edit-yield-left"
								class="number-input"
								type="number"
								min="0"
								step="1"
								bind:value={editYieldLeftMl}
							/>
						</div>
					{/if}
					{#if showYieldRight}
						<div class="field">
							<label class="field-label" for="edit-yield-right">{t('sessions.rightYield')}</label>
							<input
								id="edit-yield-right"
								class="number-input"
								type="number"
								min="0"
								step="1"
								bind:value={editYieldRightMl}
							/>
						</div>
					{/if}
				{/if}
			{/if}

			{#if validationError}
				<p class="validation-error" role="alert">{validationError}</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		{#if confirmDelete}
			<div class="confirm-delete">
				<p class="confirm-delete__text">{t('sessions.deleteConfirm')}</p>
				<div class="confirm-delete__actions">
					<Button variant="ghost" onclick={() => (confirmDelete = false)}
						>{t('common.cancel')}</Button
					>
					<Button variant="danger" loading={deleting} onclick={handleDelete}
						>{t('common.delete')}</Button
					>
				</div>
			</div>
		{:else}
			<div class="footer-actions">
				<Button variant="danger" onclick={() => (confirmDelete = true)}>{t('common.delete')}</Button
				>
				<Button variant="primary" loading={saving} onclick={handleSave}>{t('common.save')}</Button>
			</div>
		{/if}
	{/snippet}
</Sheet>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field-label {
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--text-2);
	}

	.optional {
		font-weight: var(--fw-regular);
		color: var(--text-2);
	}

	.time-input,
	.number-input {
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-3) var(--space-4);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-2);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--font-size-3);
		appearance: none;
		-webkit-appearance: none;
		box-sizing: border-box;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.time-input:focus,
	.number-input:focus {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
		border-color: var(--brand);
	}

	.validation-error {
		font-size: var(--font-size-2);
		color: var(--danger);
		margin: 0;
	}

	.footer-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.confirm-delete {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.confirm-delete__text {
		font-size: var(--font-size-3);
		font-weight: var(--fw-semibold);
		color: var(--text);
		margin: 0;
	}

	.confirm-delete__actions {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}
</style>
