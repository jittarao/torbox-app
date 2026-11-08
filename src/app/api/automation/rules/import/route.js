import { NextResponse } from 'next/server';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { sanitizeError } from '@/utils/sanitizeError';
import { backendProxyErrorResponse, logRouteError } from '@/utils/routeLog';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse(
      'Automation rules feature is disabled when backend is disabled'
    );
  }

  const { apiKey, response: authResponse } = await requireTorboxApiKey();
  if (authResponse) return authResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be JSON', code: 'INVALID_RULES_EXPORT' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/automation/rules/import`, {
      cache: 'no-store',
      method: 'POST',
      headers: backendProxyHeaders(apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ data: body?.data }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return NextResponse.json(data);
    }
    // Validation messages describe the user's file, not server internals: pass them through.
    if (response.status === 400) {
      return NextResponse.json(
        { success: false, error: data.error || 'Invalid automation rules file', code: data.code },
        { status: 400 }
      );
    }
    return backendProxyErrorResponse(
      { status: response.status, data },
      'Error importing automation rules to backend'
    );
  } catch (error) {
    logRouteError('Error importing automation rules to backend', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
