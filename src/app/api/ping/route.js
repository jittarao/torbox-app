import { NextResponse } from 'next/server';
import { sanitizeError } from '@/utils/sanitizeError';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { validateExternalUrl } from '@/utils/validateExternalUrl';

export async function POST(request) {
  try {
    const auth = await requireTorboxApiKey();
    if (auth.response) {
      return auth.response;
    }

    const { domain, region, serverName } = await request.json();

    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domain is required' }, { status: 400 });
    }

    const validation = validateExternalUrl(domain);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.reason }, { status: 400 });
    }

    const validatedDomain = validation.url;

    // Server-side ping test
    const startTime = Date.now();

    try {
      // Special handling for different server types
      let headers = {
        'User-Agent': 'TorBoxManager/1.0',
      };

      // Add specific headers for Cloudflare to avoid CORS issues
      if (serverName && serverName.includes('cloudflare')) {
        headers['Accept'] = '*/*';
        headers['Accept-Encoding'] = 'gzip, deflate, br';
        headers['Connection'] = 'keep-alive';
      }

      // Add specific headers for Bunny CDN
      if (serverName && (serverName.includes('bunny') || serverName.includes('bunnycdn'))) {
        headers['Accept'] = '*/*';
        headers['Accept-Encoding'] = 'gzip, deflate, br';
      }

      const response = await fetch(validatedDomain, {
        method: 'HEAD',
        cache: 'no-store',
        headers,
        // Add timeout for better error handling
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const endTime = Date.now();
      const pingTime = endTime - startTime;

      return NextResponse.json({
        success: true,
        ping: pingTime,
        status: response.status,
        domain: validatedDomain,
        serverType: serverName,
      });
    } catch (error) {
      // Handle specific error types
      let errorMessage = 'Ping failed';

      if (error.name === 'AbortError') {
        errorMessage = 'Ping timeout';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS error - server may be blocking requests';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error';
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        domain: validatedDomain,
        details: sanitizeError(error),
        serverType: serverName,
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
