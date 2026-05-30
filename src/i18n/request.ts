import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import deepmerge from 'deepmerge';

const localeLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./messages/en.json'),
  de: () => import('./messages/de.json'),
  es: () => import('./messages/es.json'),
  fr: () => import('./messages/fr.json'),
  ja: () => import('./messages/ja.json'),
  pl: () => import('./messages/pl.json'),
};

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const defaultMessages = (await localeLoaders.en()).default;

  let messages = defaultMessages;
  if (locale !== 'en') {
    try {
      const localeMessages = (await localeLoaders[locale]()).default;
      messages = deepmerge(defaultMessages, localeMessages);
    } catch (error) {
      console.warn(`Failed to load messages for locale ${locale}, falling back to English`);
    }
  }

  return {
    locale,
    messages,
    onError(error) {
      if (process.env.NODE_ENV === 'development' && error.code === 'MISSING_MESSAGE') {
        console.warn(`[i18n] Missing message: ${error.message}`);
      }
    },
  };
});
