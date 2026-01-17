import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import http from 'http';
import crypto from 'crypto';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

/**
 * Hash an API key to create a unique user identifier (matches backend implementation)
 */
function hashApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function POST(request, { params }) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse(
      'Automation rules feature is disabled when backend is disabled'
    );
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const { id } = await params;
    const authId = hashApiKey(apiKey);
    const url = new URL(`${BACKEND_URL}/api/automation/rules/${id}/run`);
    url.searchParams.set('authId', authId);

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: 'POST',
          timeout: 30000, // 30 second timeout for rule execution
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve({ ok: res.statusCode === 200, status: res.statusCode, data: jsonData });
            } catch (parseError) {
              reject(parseError);
            }
          });
        }
      );

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      const errorData = response.data || {};
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend responded with status: ${response.status}`,
        },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error running automation rule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
