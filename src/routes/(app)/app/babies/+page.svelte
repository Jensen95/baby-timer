<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	goto(`${base}/app/family`, { replaceState: true });
</script>
