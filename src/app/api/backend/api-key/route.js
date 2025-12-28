import { NextResponse } from 'next/server';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  try {
    const body = await request.json();
    const url = new URL(`${BACKEND_URL}/api/backend/api-key`);

    const response = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, data: jsonData });
          } catch (parseError) {
            reject(parseError);
          }
        });
      });

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
        { success: false, error: response.data?.error || 'Failed to set API key' },
        { status: response.data?.error?.includes('Invalid') ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('Error setting API key:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
