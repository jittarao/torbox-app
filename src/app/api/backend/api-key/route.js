import { NextResponse } from 'next/server';
import { backendHttpRequest, backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }
    const url = new URL(`${BACKEND_URL}/api/backend/api-key`);

    const postData = JSON.stringify(body);
    const response = await backendHttpRequest(url, {
      method: 'POST',
      headers: backendProxyHeaders(null, {
        'Content-Type': 'application/json',
      }),
      body: postData,
      timeoutMs: 10000,
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        { success: false, error: response.data?.error || 'Failed to set API key' },
        { status: response.data?.error?.includes('Invalid') ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('Error setting API key:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
