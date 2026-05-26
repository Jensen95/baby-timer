export type Theme = 'light' | 'dark' | 'night' | 'grey';

const STORAGE_KEY = 'baby-tracker:theme';

export const THEME_LABELS: Record<Theme, string> = {
	light: 'Light',
	dark: 'Dark',
	night: 'Night',
	grey: 'Grey'
};

export const THEMES: Theme[] = ['light', 'dark', 'night', 'grey'];

function getSystemTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme | null {
	if (typeof localStorage === 'undefined') return null;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'night' || stored === 'grey') {
		return stored;
	}
	return null;
}

function applyTheme(_theme: Theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = _theme;
}

let theme = $state<Theme>(readStoredTheme() ?? getSystemTheme());

applyTheme(theme);

export function getTheme() {
	return theme;
}

export function setTheme(newTheme: Theme) {
	theme = newTheme;
	applyTheme(newTheme);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, newTheme);
	}
}
