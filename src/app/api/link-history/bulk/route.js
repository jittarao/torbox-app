import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { sanitizeError } from '@/utils/sanitizeError';
import { readJsonFromResponse } from '@/utils/fetchResponse';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// POST /api/link-history/bulk - Bulk create link history entries (for migration)
export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Link history feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/link-history/bulk`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
          detail: data.detail,
        },
        { status: responseStatus }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk creating link history entries:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// DELETE /api/link-history/bulk - Bulk delete link history entries
export async function DELETE(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Link history feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/link-history/bulk`, {
      method: 'DELETE',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
          detail: data.detail,
        },
        { status: responseStatus }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk deleting link history entries:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
