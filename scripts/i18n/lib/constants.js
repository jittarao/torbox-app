import path from 'path';

export const ROOT = path.join(import.meta.dir, '..', '..', '..');
export const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');

const settings = await import('../../../src/i18n/settings.ts');

export const ALL_LOCALES = [...settings.locales];
export const TARGET_LOCALES = ALL_LOCALES.filter((locale) => locale !== 'en');
export const DEFAULT_LOCALE = settings.defaultLocale;

export const ADMIN_PREFIX = 'Admin.';

export function isAdminKey(dotPath) {
  return dotPath === 'Admin' || dotPath.startsWith(ADMIN_PREFIX);
}
