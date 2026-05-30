import { NextResponse } from 'next/server';

/**
 * Legacy route — backend has no /api/storage handler.
 * Client-side audio prefs use localStorage (see AudioPlayer/storage.js).
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is deprecated and not available.' },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is deprecated and not available.' },
    { status: 410 }
  );
}
