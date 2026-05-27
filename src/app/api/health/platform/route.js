import { NextResponse } from 'next/server';

import { API_BASE, TORBOX_MANAGER_VERSION } from '@/components/constants';

export async function GET() {
  try {
    const startTime = Date.now();
    const response = await fetch(API_BASE, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success === true) {
      return NextResponse.json({
        status: 'healthy',
        message: data.detail || 'TorBox API is running',
        timestamp: new Date().toISOString(),
        responseTime,
      });
    }

    return NextResponse.json({
      status: 'unhealthy',
      message: data.detail || `TorBox API responded with status ${response.status}`,
      timestamp: new Date().toISOString(),
      responseTime,
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
