import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';

/** Long-lived SSE proxy; avoid static optimization. On Vercel, allow up to 300s per invocation. */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

function hashApiKey(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * GET /api/automation/events
 * Proxies SSE stream from backend so frontend can use same-origin fetch with x-api-key.
 * When backend automation poll completes with changes, backend sends "changed" event;
 * frontend can refetch torrents on that event instead of relying only on 15s polling.
 */
export async function GET(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Backend events are disabled');
  }

  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 }
    );
  }

  const authId = hashApiKey(apiKey);
  const url = `${BACKEND_URL}/api/automation/events`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-auth-id': authId },
      cache: 'no-store',
      signal: request.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { success: false, error: text || res.statusText },
        { status: res.status }
      );
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to connect to backend events' },
      { status: 502 }
    );
  }
}
