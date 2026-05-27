<script lang="ts">
	import QRCode from 'qrcode';

	const props = $props<{
		value: string;
		label: string;
		size?: number;
	}>();

	let dataUrl = $state('');
	let hasError = $state(false);

	$effect(() => {
		hasError = false;
		dataUrl = '';

		QRCode.toDataURL(props.value, {
			width: props.size ?? 220,
			margin: 1,
			errorCorrectionLevel: 'M'
		})
			.then((nextValue: string) => {
				dataUrl = nextValue;
			})
			.catch(() => {
				hasError = true;
			});
	});
</script>

<div class="qr-wrap" aria-label={props.label}>
	{#if dataUrl}
		<img class="qr-image" src={dataUrl} alt={props.label} loading="lazy" />
	{:else if hasError}
		<div class="qr-fallback">QR unavailable</div>
	{:else}
		<div class="qr-fallback">Loading QR...</div>
	{/if}
</div>

<style>
	.qr-wrap {
		display: grid;
		place-items: center;
		padding: var(--space-2);
		background: white;
		border-radius: var(--radius-2);
		border: 1px solid var(--border);
	}

	.qr-image {
		display: block;
		width: min(220px, 100%);
		height: auto;
		border-radius: var(--radius-1);
	}

	.qr-fallback {
		font-size: var(--font-size-2);
		color: var(--text-3);
		padding: var(--space-4);
	}
</style>
