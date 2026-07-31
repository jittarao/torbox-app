import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { isSearchPageDisabled, getSearchPageDisabledResponse } from '@/utils/featureFlags';
import { backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

function hashApiKey(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function gate() {
  if (isSearchPageDisabled()) return getSearchPageDisabledResponse();
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('TMDB title search requires the backend');
  }
  return null;
}

export async function GET(request) {
  const blocked = gate();
  if (blocked) return blocked;

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const authId = hashApiKey(apiKey);
    const incoming = new URL(request.url);
    const url = new URL(`${BACKEND_URL}/api/tmdb/search`);
    url.searchParams.set('authId', authId);
    const q = incoming.searchParams.get('q');
    const allowTmdbFallback = incoming.searchParams.get('allowTmdbFallback');
    if (q) url.searchParams.set('q', q);
    if (allowTmdbFallback) url.searchParams.set('allowTmdbFallback', allowTmdbFallback);

    const response = await fetch(url, {
      cache: 'no-store',
      method: 'GET',
      headers: backendProxyHeaders(apiKey),
      signal: AbortSignal.timeout(20_000),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying TMDB search:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
