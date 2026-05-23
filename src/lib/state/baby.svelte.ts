import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';

export type Baby = LocalBaby;

export function createBabyState() {
	let babies = $state<Baby[]>([]);
	let selectedBabyId = $state<string | null>(null);
	let loading = $state(false);

	let selectedBaby = $derived(babies.find((b) => b.id === selectedBabyId) ?? null);

	async function loadBabies(familyId: string | null) {
		loading = true;
		try {
			babies = await listBabiesLocal(familyId);
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
