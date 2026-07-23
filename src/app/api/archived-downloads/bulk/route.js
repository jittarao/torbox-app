import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
import { readJsonFromResponse } from '@/utils/fetchResponse';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// POST /api/archived-downloads/bulk - Bulk archive torrent metadata
export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Archive feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/archived-downloads/bulk`, {
      method: 'POST',
      cache: 'no-store',
      headers: backendProxyHeaders(apiKey, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
        },
        { status: responseStatus }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk archiving downloads:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// DELETE /api/archived-downloads/bulk - Bulk delete archived downloads
export async function DELETE(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Archive feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/archived-downloads/bulk`, {
      method: 'DELETE',
      cache: 'no-store',
      headers: backendProxyHeaders(apiKey, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
        },
        { status: responseStatus }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk deleting archived downloads:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
