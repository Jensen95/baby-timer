import { register, init, locale } from '@sveltia/i18n';
import enMessages from './locales/en.json';
import daMessages from './locales/da.json';

export type AppLocale = 'en' | 'da';
export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'da'];
export const LOCALE_LABELS: Record<AppLocale, string> = { en: 'English', da: 'Dansk' };

const STORAGE_KEY = 'baby-tracker:locale';

function resolveInitialLocale(): AppLocale {
	if (typeof window === 'undefined') return 'en';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'en' || stored === 'da') return stored as AppLocale;
	return navigator.language.startsWith('da') ? 'da' : 'en';
}

register('en', () => Promise.resolve(enMessages as unknown as Record<string, string>));
register('da', () => Promise.resolve(daMessages as unknown as Record<string, string>));
init({ fallbackLocale: 'en', initialLocale: resolveInitialLocale() });

export async function setLocale(next: AppLocale): Promise<void> {
	await locale.set(next);
	if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
}

export function getLocale(): AppLocale {
	return (locale.current as AppLocale) ?? 'en';
}
