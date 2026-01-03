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
 * PUT /api/automation/rules/:id - Update rule status (enable/disable)
 */
export async function PUT(request, { params }) {
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

    const { id } = params;
    const body = await request.json();
    const { enabled } = body;

    if (enabled === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing enabled field' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    const result = await db.query(
      `UPDATE automation_rules 
       SET enabled = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [enabled, id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule updated successfully',
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automation/rules/:id - Delete a rule
 */
export async function DELETE(request, { params }) {
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

    const { id } = params;

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    const result = await db.query(
      'DELETE FROM automation_rules WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
