import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  API_BASE,
  API_VERSION,
  NON_RETRYABLE_ERRORS,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

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
      { status: 400 },
    );
  }

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_BASE}/${API_VERSION}/api/user/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success === true) {
      return NextResponse.json({
        status: 'healthy',
        message: 'API key is valid and connected',
        timestamp: new Date().toISOString(),
        responseTime,
      });
    }

    const authErrors = [
      NON_RETRYABLE_ERRORS.AUTH_ERROR,
      NON_RETRYABLE_ERRORS.BAD_TOKEN,
      NON_RETRYABLE_ERRORS.NO_AUTH,
    ];

    if (
      authErrors.includes(data.error) ||
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
      message: error.message,
      timestamp: new Date().toISOString(),
      error: error.name,
    });
  }
}
