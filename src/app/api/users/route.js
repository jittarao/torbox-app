import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getDatabase } from '@/database/db';
import { encrypt, decrypt } from '@/database/encryption';
import { isMultiUserBackendEnabled } from '@/utils/backendConfig';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

/**
 * POST /api/users - Register/add API key
 * Body: { apiKey: string }
 */
export async function POST(request) {
  // Check if multi-user backend is enabled
  if (!isMultiUserBackendEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Multi-user backend is not enabled. Set MULTI_USER_BACKEND_ENABLED=true to enable this feature.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate API key by making a test request to TorBox API
    try {
      const testResponse = await fetch(
        `${API_BASE}/${API_VERSION}/api/user/me`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        }
      );

      if (!testResponse.ok) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key or TorBox API unavailable' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to validate API key with TorBox API' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Check if user with this API key already exists
    const existingUser = await db.queryOne(
      'SELECT id FROM users WHERE torbox_api_key = $1',
      [encrypt(apiKey)]
    );

    if (existingUser) {
      // Update last_polled_at and ensure user is active
      await db.query(
        'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1',
        [existingUser.id]
      );

      return NextResponse.json({
        success: true,
        message: 'API key already registered',
        userId: existingUser.id,
      });
    }

    // Create new user
    const result = await db.query(
      `INSERT INTO users (torbox_api_key, next_poll_at)
       VALUES ($1, NOW())
       RETURNING id, created_at`,
      [encrypt(apiKey)]
    );

    return NextResponse.json({
      success: true,
      message: 'API key registered successfully',
      userId: result.rows[0].id,
    });
  } catch (error) {
    console.error('Error registering API key:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/me - Get current user (from API key in header)
 */
export async function GET() {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      );
    }

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Find user by encrypted API key
    const user = await db.queryOne(
      'SELECT id, created_at, last_polled_at, is_active, next_poll_at FROM users WHERE torbox_api_key = $1',
      [encrypt(apiKey)]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        created_at: user.created_at,
        last_polled_at: user.last_polled_at,
        is_active: user.is_active,
        next_poll_at: user.next_poll_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/me - Remove user/API key
 */
export async function DELETE() {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      );
    }

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Find and delete user
    const result = await db.query(
      'DELETE FROM users WHERE torbox_api_key = $1 RETURNING id',
      [encrypt(apiKey)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User and API key removed successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

