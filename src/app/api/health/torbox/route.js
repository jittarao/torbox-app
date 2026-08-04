import { headers } from 'next/headers';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { NextResponse } from 'next/server';

import { sanitizeError } from '@/utils/sanitizeError';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { TORBOX_ERROR_CODES } from '@/config/errors';

export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      {
        status: 'no-api-key',
        message: 'API key is required to verify your TorBox connection',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  try {
    const startTime = Date.now();
    const response = await torboxFetch(`${API_BASE}/${API_VERSION}/api/user/me`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    // TorBox contract: prefer `success`, not only HTTP status.
    if (response.ok && data.success === true) {
      return NextResponse.json({
        status: 'healthy',
        message: 'API key is valid and connected',
        timestamp: new Date().toISOString(),
        responseTime,
      });
    }

    // Permanent credential failures (client faults). AUTH_ERROR is a TorBox
    // server-side verification fault and is treated as unhealthy/retryable.
    const permanentAuthErrors = [TORBOX_ERROR_CODES.BAD_TOKEN, TORBOX_ERROR_CODES.NO_AUTH];

    if (
      permanentAuthErrors.includes(data.error) ||
      response.status === 401 ||
      response.status === 403
    ) {
      return NextResponse.json({
        status: 'invalid-key',
        message: data.detail || 'Invalid or expired API key',
        timestamp: new Date().toISOString(),
        responseTime,
        errorCode: data.error,
      });
    }

    return NextResponse.json({
      status: 'unhealthy',
      message: data.detail || `TorBox API responded with status ${response.status}`,
      timestamp: new Date().toISOString(),
      responseTime,
      errorCode: data.error,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      message: sanitizeError(error),
      timestamp: new Date().toISOString(),
      error: error.name,
    });
  }
}
