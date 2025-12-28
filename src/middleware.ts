import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware({
  ...routing,
  // Enable locale detection and persistence
  localeDetection: true,
  // Default locale fallback
  defaultLocale: 'en',
});

export const config = {
  matcher: [
    // Match all pathnames except for
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /icons (public icons)
    // - /favicon.ico, /sitemap.xml (public files)
    '/((?!api|_next|icons|favicon.ico|sitemap.xml|manifest.json|images).*)',
  ],
};
