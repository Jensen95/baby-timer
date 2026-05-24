import { listBabiesLocal, type LocalBaby } from '$lib/db/local-babies';

export type Baby = LocalBaby;

export const SELECTED_BABY_STORAGE_KEY = 'baby-tracker:selectedBabyId';

function readStoredBabyId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(SELECTED_BABY_STORAGE_KEY);
}

function writeStoredBabyId(id: string | null): void {
	if (typeof localStorage === 'undefined') return;
	if (id === null) {
		localStorage.removeItem(SELECTED_BABY_STORAGE_KEY);
	} else {
		localStorage.setItem(SELECTED_BABY_STORAGE_KEY, id);
	}
}

export function createBabyState() {
	let babies = $state<Baby[]>([]);
	let selectedBabyId = $state<string | null>(readStoredBabyId());
	let loading = $state(false);

	let selectedBaby = $derived(babies.find((b) => b.id === selectedBabyId) ?? null);

	async function loadBabies(familyId: string | null) {
		loading = true;
		try {
			babies = await listBabiesLocal(familyId);
			if (babies.length > 0) {
				const persistedId = selectedBabyId;
				const persistedIsValid = persistedId !== null && babies.some((b) => b.id === persistedId);
				if (!persistedIsValid) {
					selectedBabyId = babies[0].id;
					writeStoredBabyId(selectedBabyId);
				}
			}
		} finally {
			loading = false;
		}
	}

	function selectBaby(id: string) {
		selectedBabyId = id;
		writeStoredBabyId(id);
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
