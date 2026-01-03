import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getDatabase } from '@/database/db';
import { encrypt } from '@/database/encryption';
import { isMultiUserBackendEnabled } from '@/utils/backendConfig';

/**
 * Helper to get current user ID from API key
 */
async function getUserIdFromApiKey(apiKey) {
  if (!apiKey) {
    return null;
  }

  // Check if backend is enabled
  if (!isMultiUserBackendEnabled()) {
    return null;
  }

  const db = getDatabase();
  if (!db) {
    return null;
  }

  const user = await db.queryOne(
    'SELECT id FROM users WHERE torbox_api_key = $1',
    [encrypt(apiKey)]
  );

  return user?.id || null;
}

/**
 * GET /api/snapshots - Get recent snapshots for current user
 * Query params: limit (default 100), offset (default 0)
 */
export async function GET(request) {
  // Check if multi-user backend is enabled
  if (!isMultiUserBackendEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Multi-user backend is not enabled. Set MULTI_USER_BACKEND_ENABLED=true to enable this feature.' },
      { status: 503 }
    );
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromApiKey(apiKey);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    const snapshots = await db.queryAll(
      `SELECT id, torrent_id, snapshot_data, state, progress, download_speed, 
              upload_speed, seeds, peers, ratio, created_at
       FROM torrent_snapshots
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count
    const countResult = await db.queryOne(
      'SELECT COUNT(*) as count FROM torrent_snapshots WHERE user_id = $1',
      [userId]
    );

    return NextResponse.json({
      success: true,
      data: snapshots,
      pagination: {
        total: parseInt(countResult.count, 10),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

