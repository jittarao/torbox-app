import { NextResponse } from 'next/server';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { backendHttpGet, backendProxyHeaders } from '@/utils/backendRequest';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { sanitizeError } from '@/utils/sanitizeError';
import { backendProxyErrorResponse, logRouteError } from '@/utils/routeLog';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse(
      'Automation rules feature is disabled when backend is disabled'
    );
  }

  const { apiKey, response: authResponse } = await requireTorboxApiKey();
  if (authResponse) return authResponse;

  try {
    const url = new URL(`${BACKEND_URL}/api/automation/rules/export`);
    const response = await backendHttpGet(url, { headers: backendProxyHeaders(apiKey) });
    if (response.ok) {
      return NextResponse.json(response.data);
    }
    return backendProxyErrorResponse(response, 'Error exporting automation rules from backend');
  } catch (error) {
    logRouteError('Error exporting automation rules from backend', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
