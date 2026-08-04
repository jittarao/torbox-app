import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { isBackendDisabled } from '@/utils/backendCheck';
import { backendHttpRequest, backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

function isBackendUnreachable(error) {
  const code = error?.code || error?.cause?.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'ETIMEDOUT'
  ) {
    return true;
  }
  const message = error?.message || '';
  return (
    message === 'Request timeout' ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNRESET')
  );
}

export async function POST() {
  if (isBackendDisabled()) {
    return NextResponse.json({ success: true });
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const url = new URL(`${BACKEND_URL}/api/activity`);

    const response = await backendHttpRequest(url, {
      method: 'POST',
      headers: backendProxyHeaders(apiKey, {
        'Content-Type': 'application/json',
      }),
      timeoutMs: 10000,
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    }

    return NextResponse.json(
      { success: false, error: response.data?.error || 'Failed to record activity' },
      { status: response.status || 500 }
    );
  } catch (error) {
    // Beacon is best-effort — backend restarts must not spam 500s or stack traces.
    if (isBackendUnreachable(error)) {
      console.warn('Activity beacon deferred: backend unreachable');
      return NextResponse.json({ success: true, deferred: true });
    }

    console.error('Error recording user activity:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
