import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const adminKey = request.headers.get('x-admin-key') || searchParams.get('adminKey');
  
  if (!adminKey) {
    return NextResponse.json(
      { success: false, error: 'Admin key required' },
      { status: 401 }
    );
  }

  const container = searchParams.get('container') || 'torbox-backend';
  const tail = searchParams.get('tail') || '100';

  try {
    // Proxy the SSE request to backend
    const backendUrl = `${BACKEND_URL}/api/admin/logs/stream?container=${container}&tail=${tail}`;
    
    const response = await fetch(backendUrl, {
      headers: {
        'x-admin-key': adminKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to connect to backend' }));
      return NextResponse.json(error, { status: response.status });
    }

    // Return the SSE stream
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stream logs' },
      { status: 500 }
    );
  }
}
