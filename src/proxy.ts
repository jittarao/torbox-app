import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { hasLocale } from 'next-intl';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const first = request.nextUrl.pathname.split('/').filter(Boolean)[0];
  const locale =
    first && hasLocale(routing.locales, first) ? first : routing.defaultLocale;
  const headers = new Headers(request.headers);
  headers.set('x-tbm-locale', locale);
  return intlMiddleware(new NextRequest(request, { headers }));
}

export const config = {
  matcher: [
    '/((?!api|_next|icons|favicon.ico|sitemap.xml|manifest.json|images).*)',
  ],
};
