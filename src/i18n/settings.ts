export const locales = ['en', 'es', 'de', 'fr', 'ja'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];
