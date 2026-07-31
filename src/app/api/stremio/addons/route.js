import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { isSearchPageDisabled, getSearchPageDisabledResponse } from '@/utils/featureFlags';
import { backendHttpGet, backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

function hashApiKey(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function gate() {
  if (isSearchPageDisabled()) return getSearchPageDisabledResponse();
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Stremio addons require the backend');
  }
  return null;
}

export async function GET() {
  const blocked = gate();
  if (blocked) return blocked;

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const authId = hashApiKey(apiKey);
    const url = new URL(`${BACKEND_URL}/api/stremio/addons`);
    url.searchParams.set('authId', authId);

    const response = await backendHttpGet(url, {
      headers: backendProxyHeaders(apiKey),
      timeoutMs: 15_000,
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    }
    return NextResponse.json(
      response.data || {
        success: false,
        error: `Backend responded with status: ${response.status}`,
      },
      { status: response.status || 500 }
    );
  } catch (error) {
    console.error('Error listing stremio addons:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request) {
  const blocked = gate();
  if (blocked) return blocked;

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const body = await request.json();
    const authId = hashApiKey(apiKey);

    const response = await fetch(`${BACKEND_URL}/api/stremio/addons`, {
      cache: 'no-store',
      method: 'POST',
      headers: backendProxyHeaders(apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...body, authId }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error adding stremio addon:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
