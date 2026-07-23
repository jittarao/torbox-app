import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
import { readJsonFromResponse } from '@/utils/fetchResponse';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// PATCH /api/custom-views/reorder - Update custom view sort order
export async function PATCH(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Custom views feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/custom-views/reorder`, {
      method: 'PATCH',
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
          detail: data.detail,
        },
        { status: responseStatus }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reordering custom views:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
