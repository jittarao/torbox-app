import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getDatabase } from '@/database/db';
import { encrypt } from '@/database/encryption';

/**
 * Helper to get current user ID from API key
 */
async function getUserIdFromApiKey(apiKey) {
  if (!apiKey) {
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
 * GET /api/snapshots/:torrentId - Get history for specific torrent
 */
export async function GET(request, { params }) {
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

    const { torrentId } = params;

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    const snapshots = await db.queryAll(
      `SELECT id, snapshot_data, state, progress, download_speed, 
              upload_speed, seeds, peers, ratio, created_at
       FROM torrent_snapshots
       WHERE user_id = $1 AND torrent_id = $2
       ORDER BY created_at DESC`,
      [userId, torrentId]
    );

    return NextResponse.json({
      success: true,
      data: snapshots,
    });
  } catch (error) {
    console.error('Error fetching torrent snapshots:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

