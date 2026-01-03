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
 * GET /api/automation/rules - Get automation rules for current user
 */
export async function GET() {
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

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    const rules = await db.queryAll(
      `SELECT id, name, enabled, trigger_config, conditions, action_config, 
              metadata, created_at, updated_at
       FROM automation_rules
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // Transform database structure to match frontend expectations
    const transformedRules = rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      trigger: rule.trigger_config,
      trigger_config: rule.trigger_config,
      conditions: rule.conditions,
      logicOperator: 'and', // Default, can be added to schema later
      action: rule.action_config,
      action_config: rule.action_config,
      metadata: rule.metadata,
      created_at: rule.created_at,
      updated_at: rule.updated_at,
    }));

    return NextResponse.json({ success: true, rules: transformedRules });
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automation/rules - Save automation rules for current user
 * Body: { rules: Array }
 */
export async function POST(request) {
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

    const body = await request.json();
    const { rules } = body;

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { success: false, error: 'Rules must be an array' },
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

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Delete existing rules for this user
      await client.query('DELETE FROM automation_rules WHERE user_id = $1', [userId]);

      // Insert new rules
      for (const rule of rules) {
        await client.query(
          `INSERT INTO automation_rules 
           (user_id, name, enabled, trigger_config, conditions, action_config, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            rule.name,
            rule.enabled !== false, // Default to true
            JSON.stringify(rule.trigger || rule.trigger_config),
            JSON.stringify(rule.conditions || []),
            JSON.stringify(rule.action || rule.action_config),
            JSON.stringify(rule.metadata || {}),
          ]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Rules saved successfully',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving automation rules:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
