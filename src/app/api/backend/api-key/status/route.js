import { NextResponse } from 'next/server';
import { backendHttpGet, backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
  try {
    const url = new URL(`${BACKEND_URL}/api/backend/api-key/status`);

    const response = await backendHttpGet(url, { headers: backendProxyHeaders(null) });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to check API key status' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error checking API key status:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
