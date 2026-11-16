import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';
import { backendProxyErrorResponse, logRouteError } from '@/utils/routeLog';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

async function proxy(method) {
  if (isBackendDisabled()) return getBackendDisabledResponse('Tags feature requires the backend');
  const apiKey = (await headers()).get('x-api-key');
  if (!apiKey)
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
  try {
    const response = await fetch(`${BACKEND_URL}/api/tags/sync`, {
      method,
      headers: backendProxyHeaders(apiKey),
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError('Error syncing tags', error);
    return backendProxyErrorResponse({ status: 502 }, 'Unable to sync tags');
  }
}

export async function POST() {
  return proxy('POST');
}
export async function GET() {
  return proxy('GET');
}
