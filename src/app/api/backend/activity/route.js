import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import http from 'http';

import { isBackendDisabled } from '@/utils/backendCheck';
import { backendProxyHeaders } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST() {
  if (isBackendDisabled()) {
    return NextResponse.json({ success: true });
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const url = new URL(`${BACKEND_URL}/api/activity`);

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: 'POST',
          headers: backendProxyHeaders(apiKey, {
            'Content-Type': 'application/json',
            'Content-Length': 0,
          }),
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const jsonData = data ? JSON.parse(data) : { success: res.statusCode === 200 };
              resolve({ ok: res.statusCode === 200, data: jsonData, status: res.statusCode });
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
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    }

    return NextResponse.json(
      { success: false, error: response.data?.error || 'Failed to record activity' },
      { status: response.status || 500 }
    );
  } catch (error) {
    console.error('Error recording user activity:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
