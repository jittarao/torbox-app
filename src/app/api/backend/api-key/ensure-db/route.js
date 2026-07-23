import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { isBackendDisabled } from '@/utils/backendCheck';
import { backendHttpRequest, backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  if (isBackendDisabled()) {
    return NextResponse.json({
      success: true,
      wasCreated: false,
      dbExists: false,
    });
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const url = new URL(`${BACKEND_URL}/api/backend/api-key/ensure-db`);

    const postData = JSON.stringify({ ...body, apiKey });
    const response = await backendHttpRequest(url, {
      method: 'POST',
      headers: backendProxyHeaders(apiKey, {
        'Content-Type': 'application/json',
      }),
      body: postData,
      timeoutMs: 10000,
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        { success: false, error: response.data?.error || 'Failed to ensure user database' },
        { status: response.data?.error?.includes('Invalid') ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('Error ensuring user database:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
