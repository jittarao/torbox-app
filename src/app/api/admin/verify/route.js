import { NextResponse } from 'next/server';
import http from 'http';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET(request) {
  try {
    const adminKey = request.headers.get('x-admin-key');

    if (!adminKey) {
      return NextResponse.json({ success: false, error: 'Admin key required' }, { status: 401 });
    }

    const url = new URL(`${BACKEND_URL}/api/admin/verify`);

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: 'GET',
          headers: {
            'x-admin-key': adminKey,
          },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const jsonData = data.trim() ? JSON.parse(data) : {};
              resolve({ ok: res.statusCode === 200, status: res.statusCode, data: jsonData });
            } catch (parseError) {
              // If parsing fails, return the raw data or an error
              resolve({
                ok: false,
                status: res.statusCode || 500,
                data: { success: false, error: 'Invalid response from backend', raw: data },
              });
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
    } else {
      return NextResponse.json(response.data || { success: false, error: 'Verification failed' }, {
        status: response.status,
      });
    }
  } catch (error) {
    console.error('Error in admin verify:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) || 'Verification failed' },
      { status: 500 }
    );
  }
}
