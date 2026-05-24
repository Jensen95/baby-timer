<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title?: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let { open, title, onclose, children, footer }: Props = $props();

	let panelEl = $state<HTMLElement | null>(null);
	let titleId = $state(`sheet-title-${Math.random().toString(36).slice(2)}`);

	// Drag state
	let dragStartY = $state(0);
	let dragCurrentY = $state(0);
	let isDragging = $state(false);
	let translateY = $derived(isDragging ? Math.max(0, dragCurrentY - dragStartY) : 0);

	// Detect reduced motion preference
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

	// Track the element that triggered open so we can restore focus on close
	let triggerEl = $state<Element | null>(null);

	$effect(() => {
		if (open) {
			triggerEl = document.activeElement;
			document.body.style.overflow = 'hidden';

			// Set inert on main content
			const main = document.querySelector('main, [data-main], #app-content') as HTMLElement | null;
			if (main) main.inert = true;

			// Auto-focus first focusable element or close button
			requestAnimationFrame(() => {
				if (!panelEl) return;
				const focusable = getFocusable();
				if (focusable.length > 0) {
					(focusable[0] as HTMLElement).focus();
				}
			});
		} else {
			document.body.style.overflow = '';

			const main = document.querySelector('main, [data-main], #app-content') as HTMLElement | null;
			if (main) main.inert = false;

			// Restore focus to trigger element
			if (triggerEl instanceof HTMLElement) {
				triggerEl.focus();
				triggerEl = null;
			}
		}

		return () => {
			document.body.style.overflow = '';
			const main = document.querySelector('main, [data-main], #app-content') as HTMLElement | null;
			if (main) main.inert = false;
		};
	});

	const FOCUSABLE_SELECTOR =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function getFocusable(): Element[] {
		if (!panelEl) return [];
		return Array.from(panelEl.querySelectorAll(FOCUSABLE_SELECTOR));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
			return;
		}

		if (e.key === 'Tab') {
			const focusable = getFocusable();
			if (focusable.length === 0) {
				e.preventDefault();
				return;
			}
			const first = focusable[0] as HTMLElement;
			const last = focusable[focusable.length - 1] as HTMLElement;

			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}
	}

	function handleScrimClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	// Drag-to-dismiss handlers
	function onDragStart(e: PointerEvent) {
		// Only drag from the handle or header area on mobile viewports
		if (window.innerWidth >= 600) return;
		isDragging = true;
		dragStartY = e.clientY;
		dragCurrentY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onDragMove(e: PointerEvent) {
		if (!isDragging) return;
		dragCurrentY = e.clientY;
	}

	function onDragEnd(_e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;

		const delta = dragCurrentY - dragStartY;
		const sheetHeight = panelEl?.offsetHeight ?? 300;
		const threshold = Math.min(80, sheetHeight * 0.4);

		if (delta > threshold) {
			onclose();
		}

		dragStartY = 0;
		dragCurrentY = 0;
	}
</script>

{#if open}
	<div class="scrim" onclick={handleScrimClick} aria-hidden="true"></div>

	<div
		bind:this={panelEl}
		class="sheet"
		class:sheet--reduced-motion={reducedMotion}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? titleId : undefined}
		aria-label={title ? undefined : 'Dialog'}
		style:transform={isDragging ? `translateY(${translateY}px)` : undefined}
		style:transition={isDragging ? 'none' : undefined}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Drag handle — role="presentation" is purely gestural; aria-hidden removes it from the a11y tree -->
		<div
			class="drag-handle-area"
			role="presentation"
			onpointerdown={onDragStart}
			onpointermove={onDragMove}
			onpointerup={onDragEnd}
			onpointercancel={onDragEnd}
		>
			<div class="drag-handle" aria-hidden="true"></div>
		</div>

		<!-- Header -->
		<div class="sheet__header">
			{#if title}
				<h2 id={titleId} class="sheet__title">{title}</h2>
			{:else}
				<div class="sheet__title-placeholder"></div>
			{/if}
			<button class="sheet__close" type="button" aria-label="Close" onclick={onclose}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					focusable="false"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<!-- Body -->
		<div class="sheet__body">
			{@render children()}
		</div>

		<!-- Optional footer -->
		{#if footer}
			<div class="sheet__footer">
				{@render footer()}
			</div>
		{/if}
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 400;
		background: var(--scrim);
		animation: scrim-in var(--duration-normal) var(--ease-out) both;
	}

	@keyframes scrim-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 401;
		max-height: 90svh;
		overflow-y: auto;
		background: var(--surface);
		border-radius: var(--radius-3) var(--radius-3) 0 0;
		box-shadow: var(--shadow-3);
		outline: none;
		animation: sheet-in-mobile var(--duration-slow) var(--ease-out) both;
		overscroll-behavior: contain;
	}

	.sheet--reduced-motion {
		animation: sheet-fade-in var(--duration-normal) var(--ease-out) both;
	}

	@keyframes sheet-in-mobile {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes sheet-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (min-width: 600px) {
		.sheet {
			top: 50%;
			left: 50%;
			right: auto;
			bottom: auto;
			width: min(480px, 95vw);
			max-height: 85svh;
			border-radius: var(--radius-3);
			transform: translate(-50%, -50%);
			animation: sheet-in-desktop var(--duration-normal) var(--ease-out) both;
		}

		.sheet--reduced-motion {
			animation: sheet-fade-in var(--duration-normal) var(--ease-out) both;
		}

		@keyframes sheet-in-desktop {
			from {
				opacity: 0;
				transform: translate(-50%, -50%) scale(0.96);
			}
			to {
				opacity: 1;
				transform: translate(-50%, -50%) scale(1);
			}
		}
	}

	.drag-handle-area {
		display: flex;
		justify-content: center;
		padding: var(--space-3) var(--space-4) var(--space-2);
		cursor: grab;
		touch-action: none;
	}

	.drag-handle-area:active {
		cursor: grabbing;
	}

	@media (min-width: 600px) {
		.drag-handle-area {
			display: none;
		}
	}

	.drag-handle {
		width: 36px;
		height: 4px;
		background: var(--border-strong);
		border-radius: var(--radius-pill);
	}

	.sheet__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4) var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--divider);
	}

	.sheet__title {
		margin: 0;
		font-size: var(--font-size-4);
		font-weight: var(--fw-bold);
		color: var(--text);
		line-height: var(--lh-tight);
	}

	.sheet__title-placeholder {
		flex: 1;
	}

	.sheet__close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-width: 44px;
		min-height: 44px;
		width: 44px;
		height: 44px;
		padding: 0;
		border: none;
		border-radius: var(--radius-2);
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.sheet__close:hover {
		background: var(--surface-2);
	}

	.sheet__close:active {
		background: var(--surface-3);
	}

	.sheet__body {
		padding: var(--space-5);
	}

	.sheet__footer {
		padding: var(--space-4) var(--space-5);
		border-top: 1px solid var(--divider);
	}
</style>
