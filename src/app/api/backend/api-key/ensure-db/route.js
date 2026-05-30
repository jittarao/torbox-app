import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import http from 'http';

import { isBackendDisabled } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  if (isBackendDisabled()) {
    return NextResponse.json({
      success: true,
      wasCreated: false,
      dbExists: false,
    });
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const url = new URL(`${BACKEND_URL}/api/backend/api-key/ensure-db`);

    const response = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ ...body, apiKey });
      const req = http.request(
        url,
        {
          method: 'POST',
          headers: backendProxyHeaders(apiKey, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          }),
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve({ ok: res.statusCode === 200, data: jsonData });
            } catch (parseError) {
              reject(parseError);
            }
          });
        }
      );

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(postData);
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        { success: false, error: response.data?.error || 'Failed to ensure user database' },
        { status: response.data?.error?.includes('Invalid') ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('Error ensuring user database:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
