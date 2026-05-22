import { supabase } from '$lib/supabase';
import { listBabies, type Baby } from '$lib/db/babies';

export function createBabyState() {
	let babies = $state<Baby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let loading = $state(false);

	let selectedBaby = $derived(babies.find((b) => b.id === selectedBabyId) ?? null);

	async function loadBabies(familyId: string) {
		loading = true;
		try {
			babies = await listBabies(supabase, familyId);
			if (babies.length > 0 && !selectedBabyId) {
				selectedBabyId = babies[0].id;
			}
		} finally {
			loading = false;
		}
	}

	function selectBaby(id: string) {
		selectedBabyId = id;
	}

	return {
		get babies() {
			return babies;
		},
		get selectedBaby() {
			return selectedBaby;
		},
		get selectedBabyId() {
			return selectedBabyId;
		},
		get loading() {
			return loading;
		},
		loadBabies,
		selectBaby
	};
}

export type BabyState = ReturnType<typeof createBabyState>;
export const BABY_STATE_KEY = Symbol('babyState');
