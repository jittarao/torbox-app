import { NextResponse } from 'next/server';
import { backendHttpGet } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET(request) {
  try {
    const adminKey = request.headers.get('x-admin-key');

    if (!adminKey) {
      return NextResponse.json({ success: false, error: 'Admin key required' }, { status: 401 });
    }

    const url = new URL(`${BACKEND_URL}/api/admin/verify`);

    const response = await backendHttpGet(url, {
      headers: {
        'x-admin-key': adminKey,
      },
      timeoutMs: 10000,
      lenientJson: true,
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(response.data || { success: false, error: 'Verification failed' }, {
        status: response.status,
      });
    }
  } catch (error) {
    console.error('Error in admin verify:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) || 'Verification failed' },
      { status: 500 }
    );
  }
}
