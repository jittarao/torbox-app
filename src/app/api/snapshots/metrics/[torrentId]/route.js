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
 * Calculate metrics from snapshots
 */
function calculateMetrics(snapshots) {
  if (snapshots.length === 0) {
    return {
      stalled_time_hours: 0,
      seeding_time_hours: 0,
      stuck_progress: false,
      queued_count: 0,
    };
  }

  let stalledTimeMs = 0;
  let seedingTimeMs = 0;
  let queuedCount = 0;
  let lastProgress = null;
  let stuckProgress = false;

  // Sort by created_at ascending
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  let lastStalledAt = null;
  let lastSeedingAt = null;

  for (let i = 0; i < sorted.length; i++) {
    const snapshot = sorted[i];
    const createdAt = new Date(snapshot.created_at);

    // Track stalled time
    if (snapshot.state === 'stalled') {
      if (lastStalledAt === null) {
        lastStalledAt = createdAt;
      }
    } else {
      if (lastStalledAt !== null) {
        stalledTimeMs += createdAt - lastStalledAt;
        lastStalledAt = null;
      }
    }

    // Track seeding time
    if (snapshot.state === 'seeding') {
      if (lastSeedingAt === null) {
        lastSeedingAt = createdAt;
      }
    } else {
      if (lastSeedingAt !== null) {
        seedingTimeMs += createdAt - lastSeedingAt;
        lastSeedingAt = null;
      }
    }

    // Track queued count
    if (snapshot.state === 'queued') {
      queuedCount++;
    }

    // Check for stuck progress
    if (snapshot.progress !== null && snapshot.progress !== undefined) {
      if (lastProgress !== null && lastProgress === snapshot.progress) {
        // Check if progress hasn't changed for more than 2 hours
        if (i > 0) {
          const timeDiff = createdAt - new Date(sorted[i - 1].created_at);
          if (timeDiff > 2 * 60 * 60 * 1000) {
            stuckProgress = true;
          }
        }
      }
      lastProgress = snapshot.progress;
    }
  }

  // Handle case where last snapshot is still in stalled/seeding state
  if (lastStalledAt !== null && sorted.length > 0) {
    const now = new Date();
    stalledTimeMs += now - lastStalledAt;
  }
  if (lastSeedingAt !== null && sorted.length > 0) {
    const now = new Date();
    seedingTimeMs += now - lastSeedingAt;
  }

  return {
    stalled_time_hours: stalledTimeMs / (1000 * 60 * 60),
    seeding_time_hours: seedingTimeMs / (1000 * 60 * 60),
    stuck_progress: stuckProgress,
    queued_count: queuedCount,
  };
}

/**
 * GET /api/snapshots/metrics/:torrentId - Get calculated metrics for a torrent
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
      `SELECT state, progress, created_at
       FROM torrent_snapshots
       WHERE user_id = $1 AND torrent_id = $2
       ORDER BY created_at ASC`,
      [userId, torrentId]
    );

    const metrics = calculateMetrics(snapshots);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

