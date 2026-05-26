<script lang="ts">
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
	let editYieldLeftMl = $state('');
	let editYieldRightMl = $state('');

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
		if (!Number.isFinite(n) || n < 0) throw new Error('Yield must be a non-negative number');
		return Math.round(n);
	}

	$effect(() => {
		if (!session) {
			editStartedAt = '';
			editEndedAt = '';
			editSide = '';
			editYieldLeftMl = '';
			editYieldRightMl = '';
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
		editYieldLeftMl = session.yield_left_ml != null ? String(session.yield_left_ml) : '';
		editYieldRightMl = session.yield_right_ml != null ? String(session.yield_right_ml) : '';
		validationError = null;
		confirmDelete = false;
	});

	const FEEDING_OPTIONS = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'both', label: 'Both' }
	];

	const SLEEP_OPTIONS = [
		{ value: 'back', label: 'Back' },
		{ value: 'left', label: 'Head Left' },
		{ value: 'right', label: 'Head Right' },
		{ value: 'tummy', label: 'Tummy' },
		{ value: 'side', label: 'Side' }
	];

	const PUMP_OPTIONS = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'both', label: 'Both' }
	];

	const DIAPER_OPTIONS = [
		{ value: 'poop', label: 'Poop' },
		{ value: 'pee', label: 'Pee' },
		{ value: 'both', label: 'Both' }
	];

	const showYieldLeft = $derived(editSide === 'left' || editSide === 'both');
	const showYieldRight = $derived(editSide === 'right' || editSide === 'both');

	async function handleSave() {
		if (!session) return;
		validationError = null;

		const startedAt = parseDateTimeInput(editStartedAt);
		if (!startedAt) {
			validationError = 'Start time is required and must be a valid date.';
			return;
		}

		const endedAt = editEndedAt.trim() ? parseDateTimeInput(editEndedAt) : null;
		if (editEndedAt.trim() && !endedAt) {
			validationError = 'End time must be a valid date.';
			return;
		}
		if (endedAt && endedAt < startedAt) {
			validationError = 'End time must be after start time.';
			return;
		}

		let yieldLeftMl: number | null = null;
		let yieldRightMl: number | null = null;
		if (session.type === 'breast_pump') {
			try {
				yieldLeftMl = parseOptionalYield(editYieldLeftMl);
				yieldRightMl = parseOptionalYield(editYieldRightMl);
			} catch (e) {
				validationError = e instanceof Error ? e.message : 'Invalid yield value.';
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
				_sync: 'pending'
			};
		}

		saving = true;
		try {
			await onsave(updated);
		} catch (e) {
			validationError = e instanceof Error ? e.message : 'Failed to save.';
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
			validationError = e instanceof Error ? e.message : 'Failed to delete.';
			deleting = false;
		}
	}

	function handleClose() {
		if (saving || deleting) return;
		onclose();
	}
</script>

<Sheet {open} title="Edit session" onclose={handleClose}>
	{#if session}
		<div class="form">
			{#if session.type === 'diaper_change'}
				<div class="field">
					<label class="field-label" for="edit-started-at">Time</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">Contents</span>
					<OptionGrid
						options={DIAPER_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
			{:else if session.type === 'feeding'}
				<div class="field">
					<label class="field-label" for="edit-started-at">Start time</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<label class="field-label" for="edit-ended-at"
						>End time <span class="optional">(optional)</span></label
					>
					<input
						id="edit-ended-at"
						class="time-input"
						type="datetime-local"
						bind:value={editEndedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">Side</span>
					<OptionGrid
						options={FEEDING_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
			{:else if session.type === 'sleep'}
				<div class="field">
					<label class="field-label" for="edit-started-at">Start time</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<label class="field-label" for="edit-ended-at"
						>End time <span class="optional">(optional)</span></label
					>
					<input
						id="edit-ended-at"
						class="time-input"
						type="datetime-local"
						bind:value={editEndedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">Head position</span>
					<OptionGrid
						options={SLEEP_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
			{:else if session.type === 'breast_pump'}
				<div class="field">
					<label class="field-label" for="edit-started-at">Start time</label>
					<input
						id="edit-started-at"
						class="time-input"
						type="datetime-local"
						bind:value={editStartedAt}
					/>
				</div>
				<div class="field">
					<label class="field-label" for="edit-ended-at"
						>End time <span class="optional">(optional)</span></label
					>
					<input
						id="edit-ended-at"
						class="time-input"
						type="datetime-local"
						bind:value={editEndedAt}
					/>
				</div>
				<div class="field">
					<span class="field-label">Side</span>
					<OptionGrid
						options={PUMP_OPTIONS}
						value={editSide}
						columns={3}
						onchange={(v) => (editSide = v as string)}
					/>
				</div>
				{#if showYieldLeft}
					<div class="field">
						<label class="field-label" for="edit-yield-left">Left yield (ml)</label>
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
						<label class="field-label" for="edit-yield-right">Right yield (ml)</label>
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

			{#if validationError}
				<p class="validation-error" role="alert">{validationError}</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		{#if confirmDelete}
			<div class="confirm-delete">
				<p class="confirm-delete__text">Delete this session?</p>
				<div class="confirm-delete__actions">
					<Button variant="ghost" onclick={() => (confirmDelete = false)}>Cancel</Button>
					<Button variant="danger" loading={deleting} onclick={handleDelete}>Delete</Button>
				</div>
			</div>
		{:else}
			<div class="footer-actions">
				<Button variant="danger" onclick={() => (confirmDelete = true)}>Delete</Button>
				<Button variant="primary" loading={saving} onclick={handleSave}>Save</Button>
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
