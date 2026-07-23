import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { sanitizeError } from '@/utils/sanitizeError';
import { readJsonFromResponse } from '@/utils/fetchResponse';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// PATCH /api/uploads/reorder - Update queue order
export async function PATCH(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/uploads/reorder`, {
      method: 'PATCH',
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
    console.error('Error reordering uploads:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
