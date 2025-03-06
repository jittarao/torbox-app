import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import deepmerge from 'deepmerge';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

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
