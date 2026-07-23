import { NextResponse } from 'next/server';
import { backendHttpRequest } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  try {
    const adminKey = request.headers.get('x-admin-key');

    if (!adminKey) {
      return NextResponse.json({ success: false, error: 'Admin key required' }, { status: 401 });
    }

    const url = new URL(`${BACKEND_URL}/api/admin/auth`);
    const postData = JSON.stringify({ adminKey });

    const response = await backendHttpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: postData,
      timeoutMs: 10000,
      lenientJson: true,
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        response.data || { success: false, error: 'Authentication failed' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error in admin auth:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) || 'Authentication failed' },
      { status: 500 }
    );
  }
}
