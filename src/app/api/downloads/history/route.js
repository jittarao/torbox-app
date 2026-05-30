import { NextResponse } from 'next/server';

/**
 * Legacy route — backend has no /api/downloads/history handler.
 * Download history uses /api/link-history via downloadHistoryStore.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated. Use /api/link-history instead.',
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated. Use /api/link-history instead.',
    },
    { status: 410 }
  );
}
