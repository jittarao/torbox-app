import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
  }

  const url = `${BACKEND_URL}/api/automation/events`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: backendProxyHeaders(apiKey),
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

    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { success: false, error: 'Backend events stream unavailable' },
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': proxy-ready\n\n'));

        const pump = () => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              if (value) controller.enqueue(value);
              pump();
            })
            .catch((err) => {
              if (err?.name !== 'AbortError') controller.error(err);
              else controller.close();
            });
        };
        pump();
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to connect to backend events' },
      { status: 502 }
    );
  }
}
