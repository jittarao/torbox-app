import { NextResponse } from 'next/server';
import { sanitizeError } from '@/utils/sanitizeError';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { validateExternalUrl } from '@/utils/validateExternalUrl';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Hit a Stremio stream URL server-side without following the CDN download redirect
 * or buffering the media body.
 *
 * TorBox-oriented addons typically add the video on the first GET, then 302 to a
 * download link. `redirect: 'manual'` stops there. We only treat redirect statuses
 * as success — a 200 body would be media, so we cancel immediately and fail rather
 * than risk buffering bytes on the server.
 */
export async function POST(request) {
  try {
    const auth = await requireTorboxApiKey();
    if (auth.response) {
      return auth.response;
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = validateExternalUrl(body?.url);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.reason }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(validation.url, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          'User-Agent': 'TorBoxManager/1.0',
          Accept: '*/*',
        },
        signal: controller.signal,
      });

      // Drop any body immediately — never buffer media bytes.
      try {
        await response.body?.cancel?.();
      } catch {
        // ignore
      }

      if (!REDIRECT_STATUSES.has(response.status)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Stream URL did not redirect (expected 301/302/303/307/308). Refusing to read a media body.',
            status: response.status,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        status: response.status,
        redirected: true,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        return NextResponse.json({ success: false, error: 'Request timed out' }, { status: 504 });
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to reach stream URL',
          details: sanitizeError(error),
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
