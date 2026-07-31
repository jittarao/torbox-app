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
    return getBackendDisabledResponse('Stremio addons require the backend');
  }
  return null;
}

export async function PUT(request, { params }) {
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
    const { id } = await params;

    const response = await fetch(`${BACKEND_URL}/api/stremio/addons/${id}`, {
      cache: 'no-store',
      method: 'PUT',
      headers: backendProxyHeaders(apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...body, authId }),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating stremio addon:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const blocked = gate();
  if (blocked) return blocked;

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const authId = hashApiKey(apiKey);
    const { id } = await params;
    const url = new URL(`${BACKEND_URL}/api/stremio/addons/${id}`);
    url.searchParams.set('authId', authId);

    const response = await fetch(url, {
      cache: 'no-store',
      method: 'DELETE',
      headers: backendProxyHeaders(apiKey),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting stremio addon:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
