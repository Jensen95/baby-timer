<script lang="ts">
	import { formatDuration, formatTime } from '$lib/timer/format';
	import { formatDiaperContentLabel } from '$lib/sessions/diaper-change';
	import { formatHeadSideLabel } from '$lib/sessions/sleep-balance';
	import type { HeadSide } from '$lib/sessions/sleep';
	import type { DiaperContent } from '$lib/sessions/diaper-change';
	import type { LocalSession } from '$lib/sessions/local-session';

	interface Props {
		session: LocalSession;
		onedit: (session: LocalSession) => void;
		ondelete: (session: LocalSession) => void;
		isLast?: boolean;
	}

	let { session, onedit, ondelete, isLast = false }: Props = $props();

	let reducedMotion = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			reducedMotion = e.matches;
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// Swipe state
	let swipeX = $state(0);
	let isRevealed = $state(false);
	let isDragging = $state(false);
	let pointerStartX = $state(0);
	let pointerStartY = $state(0);
	let isHorizontalSwipe = $state(false);

	const REVEAL_WIDTH = 160; // two 80px buttons
	const SWIPE_THRESHOLD = 60;

	const translateX = $derived(
		isRevealed ? -REVEAL_WIDTH : Math.min(0, Math.max(-REVEAL_WIDTH, swipeX))
	);

	// Overflow menu state (keyboard/mouse fallback)
	let menuOpen = $state(false);
	let menuButtonEl = $state<HTMLElement | null>(null);
	let menuPopoverEl = $state<HTMLElement | null>(null);

	function closeMenu() {
		menuOpen = false;
	}

	function handleMenuKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeMenu();
			menuButtonEl?.focus();
		}
	}

	function handleDocumentClick(e: MouseEvent) {
		if (!menuOpen) return;
		if (
			menuPopoverEl &&
			!menuPopoverEl.contains(e.target as Node) &&
			menuButtonEl &&
			!menuButtonEl.contains(e.target as Node)
		) {
			closeMenu();
		}
	}

	$effect(() => {
		if (menuOpen) {
			document.addEventListener('click', handleDocumentClick);
			return () => document.removeEventListener('click', handleDocumentClick);
		}
	});

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;
		isDragging = true;
		isHorizontalSwipe = false;
		pointerStartX = e.clientX;
		pointerStartY = e.clientY;
		swipeX = isRevealed ? -REVEAL_WIDTH : 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const dx = e.clientX - pointerStartX;
		const dy = e.clientY - pointerStartY;

		if (!isHorizontalSwipe) {
			if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
			if (Math.abs(dy) > Math.abs(dx)) {
				isDragging = false;
				return;
			}
			isHorizontalSwipe = true;
		}

		e.preventDefault();
		const base = isRevealed ? -REVEAL_WIDTH : 0;
		swipeX = Math.min(0, Math.max(-REVEAL_WIDTH, base + dx));
	}

	function onPointerUp(_e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;

		const base = isRevealed ? -REVEAL_WIDTH : 0;
		const dx = swipeX - base;

		if (!isHorizontalSwipe) {
			swipeX = isRevealed ? -REVEAL_WIDTH : 0;
			return;
		}

		if (!isRevealed && dx < -SWIPE_THRESHOLD) {
			isRevealed = true;
			swipeX = -REVEAL_WIDTH;
		} else if (isRevealed && dx > SWIPE_THRESHOLD) {
			isRevealed = false;
			swipeX = 0;
		} else {
			swipeX = isRevealed ? -REVEAL_WIDTH : 0;
		}
	}

	function snapBack() {
		if (isRevealed) {
			isRevealed = false;
			swipeX = 0;
		}
	}

	// Label derivations
	const typeLabel = $derived.by(() => {
		switch (session.type) {
			case 'feeding':
				return 'Feeding';
			case 'sleep':
				return 'Sleep';
			case 'breast_pump':
				return 'Pump';
			case 'diaper_change':
				return 'Diaper';
		}
	});

	const detailLabel = $derived.by(() => {
		if (session.type === 'feeding') {
			const s = session.side ?? 'left';
			return s.charAt(0).toUpperCase() + s.slice(1);
		}
		if (session.type === 'sleep') {
			const s = session.side as HeadSide | null | undefined;
			if (!s) return '';
			const label = formatHeadSideLabel(s);
			return label.charAt(0).toUpperCase() + label.slice(1);
		}
		if (session.type === 'breast_pump') {
			const side = session.side ?? 'both';
			const sideLbl = side.charAt(0).toUpperCase() + side.slice(1);
			const parts: string[] = [sideLbl];
			if (session.yield_left_ml != null && session.yield_left_ml > 0) {
				parts.push(`L: ${session.yield_left_ml}ml`);
			}
			if (session.yield_right_ml != null && session.yield_right_ml > 0) {
				parts.push(`R: ${session.yield_right_ml}ml`);
			}
			return parts.join(' · ');
		}
		if (session.type === 'diaper_change') {
			const hasPoop = session.has_poop ?? false;
			const hasPee = session.has_pee ?? false;
			let content: DiaperContent = 'pee';
			if (hasPoop && hasPee) content = 'both';
			else if (hasPoop) content = 'poop';
			return formatDiaperContentLabel(content);
		}
		return '';
	});

	const startedAtDate = $derived(new Date(session.started_at));

	const durationSeconds = $derived.by(() => {
		if (!session.ended_at) return null;
		if (session.type === 'diaper_change') return null;
		const start = new Date(session.started_at).getTime();
		const end = new Date(session.ended_at).getTime();
		return Math.max(0, Math.floor((end - start) / 1000));
	});

	const typeShort = $derived.by(() => {
		switch (session.type) {
			case 'feeding':
				return 'feed';
			case 'sleep':
				return 'sleep';
			case 'breast_pump':
				return 'pump';
			case 'diaper_change':
				return 'diaper';
		}
	});
</script>

<div class="row-wrapper" class:row-wrapper--last={isLast}>
	<!-- Action buttons revealed on swipe (absolutely behind the row) -->
	<div class="actions" aria-hidden="true">
		<button
			class="action-btn action-btn--edit"
			type="button"
			tabindex="-1"
			onclick={() => {
				snapBack();
				onedit(session);
			}}>Edit</button
		>
		<button
			class="action-btn action-btn--delete"
			type="button"
			tabindex="-1"
			onclick={() => {
				snapBack();
				ondelete(session);
			}}>Delete</button
		>
	</div>

	<!-- The sliding row -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="row"
		class:row--animate={!isDragging && !reducedMotion}
		class:row--revealed={isRevealed}
		style:transform="translateX({translateX}px)"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onclick={isRevealed ? snapBack : undefined}
	>
		<span class="dot dot--{typeShort}" aria-hidden="true"></span>

		<div class="content">
			<span class="label">
				{typeLabel}{detailLabel ? ` · ${detailLabel}` : ''}
			</span>
			<span class="time">{formatTime(startedAtDate)}</span>
		</div>

		{#if durationSeconds !== null}
			<span class="duration">{formatDuration(durationSeconds)}</span>
		{/if}

		<!-- Overflow menu button for mouse / keyboard users -->
		<div class="menu-wrap">
			<button
				bind:this={menuButtonEl}
				class="menu-btn"
				type="button"
				aria-label="Session options"
				aria-expanded={menuOpen}
				aria-haspopup="menu"
				onclick={(e) => {
					e.stopPropagation();
					menuOpen = !menuOpen;
				}}
				onkeydown={handleMenuKeydown}
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 18 18"
					fill="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<circle cx="9" cy="3" r="1.5" />
					<circle cx="9" cy="9" r="1.5" />
					<circle cx="9" cy="15" r="1.5" />
				</svg>
			</button>

			{#if menuOpen}
				<div
					bind:this={menuPopoverEl}
					class="menu-popover"
					role="menu"
					tabindex="-1"
					onkeydown={handleMenuKeydown}
				>
					<button
						class="menu-item"
						type="button"
						role="menuitem"
						onclick={() => {
							closeMenu();
							onedit(session);
						}}>Edit</button
					>
					<button
						class="menu-item menu-item--danger"
						type="button"
						role="menuitem"
						onclick={() => {
							closeMenu();
							ondelete(session);
						}}>Delete</button
					>
				</div>
			{/if}
		</div>

		<!-- Visually-hidden keyboard-accessible action buttons -->
		<button class="visually-hidden" type="button" onclick={() => onedit(session)}
			>Edit {typeLabel} session</button
		>
		<button class="visually-hidden" type="button" onclick={() => ondelete(session)}
			>Delete {typeLabel} session</button
		>
	</div>
</div>

<style>
	.visually-hidden {
		border: 0;
		clip: rect(0 0 0 0);
		height: auto;
		margin: 0;
		overflow: hidden;
		padding: 0;
		position: absolute;
		width: 1px;
		white-space: nowrap;
	}

	.row-wrapper {
		position: relative;
		overflow: hidden;
		border-bottom: 1px solid var(--divider);
	}

	.row-wrapper--last {
		border-bottom: none;
	}

	/* Action buttons sit behind the row, right-aligned */
	.actions {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		display: flex;
		width: 160px;
	}

	.action-btn {
		flex: 0 0 80px;
		width: 80px;
		border: none;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--on-color);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-btn--edit {
		background: var(--brand);
		color: var(--on-brand);
	}

	.action-btn--delete {
		background: var(--danger);
	}

	/* The sliding row */
	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		min-height: var(--tap-comfortable);
		background: var(--surface);
		touch-action: pan-y;
		user-select: none;
		cursor: default;
	}

	.row--animate {
		transition: transform var(--duration-normal) var(--ease-out);
	}

	.row--revealed {
		cursor: pointer;
	}

	/* Colored dot */
	.dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-pill);
	}

	.dot--feed {
		background: var(--feed-solid);
	}
	.dot--sleep {
		background: var(--sleep-solid);
	}
	.dot--pump {
		background: var(--pump-solid);
	}
	.dot--diaper {
		background: var(--diaper-solid);
	}

	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.label {
		font-weight: var(--fw-semibold);
		font-size: var(--font-size-2);
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.time {
		font-size: var(--font-size-1);
		color: var(--text-2);
		white-space: nowrap;
	}

	.duration {
		flex-shrink: 0;
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	/* Overflow menu */
	.menu-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: transparent;
		border-radius: var(--radius-2);
		color: var(--text-2);
		cursor: pointer;
		padding: 0;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.menu-btn:hover {
		background: var(--surface-2);
	}

	.menu-btn:active {
		background: var(--surface-3);
	}

	.menu-popover {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 100;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-2);
		min-width: 120px;
		overflow: hidden;
	}

	.menu-item {
		display: block;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		border: none;
		background: transparent;
		text-align: left;
		font-family: var(--font-body);
		font-size: var(--font-size-2);
		font-weight: var(--fw-semibold);
		color: var(--text);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.menu-item:hover {
		background: var(--surface-2);
	}

	.menu-item--danger {
		color: var(--danger);
	}

	@media (prefers-reduced-motion: reduce) {
		.row--animate {
			transition: none;
		}
	}
</style>
