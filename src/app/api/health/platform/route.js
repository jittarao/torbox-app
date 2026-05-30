import { NextResponse } from 'next/server';

import { API_BASE, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { sanitizeError } from '@/utils/sanitizeError';
export async function GET() {
  try {
    const startTime = Date.now();
    const response = await torboxFetch(API_BASE, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
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
      message: sanitizeError(error),
      timestamp: new Date().toISOString(),
      error: error.name,
    });
  }
}
