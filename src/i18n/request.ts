import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import deepmerge from 'deepmerge';

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const defaultMessages = (await import(`./messages/en.json`)).default;

  let messages = defaultMessages;
  if (locale !== 'en') {
    try {
      const localeMessages = (await import(`./messages/${locale}.json`))
        .default;
      messages = deepmerge(defaultMessages, localeMessages);
    } catch (error) {
      console.warn(
        `Failed to load messages for locale ${locale}, falling back to English`,
      );
    }
  }

  return {
    locale,
    messages,
  };
});
