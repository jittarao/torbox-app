import { NextResponse } from 'next/server';
import { sanitizeError } from '@/utils/sanitizeError';
export async function GET() {
  try {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: sanitizeError(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
