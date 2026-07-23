import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { sanitizeError } from '@/utils/sanitizeError';
import { readJsonFromResponse } from '@/utils/fetchResponse';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// POST /api/uploads/bulk/retry - Bulk retry failed uploads
export async function POST(request) {
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
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/uploads/bulk/retry`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ids }),
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
    console.error('Error bulk retrying uploads:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
