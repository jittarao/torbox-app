import { NextResponse } from 'next/server';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function POST(request) {
  try {
    // Get admin key from header first, then try body if header is not present
    let adminKey = request.headers.get('x-admin-key');
    
    // Only try to parse body if we don't have the key from header
    if (!adminKey) {
      try {
        const body = await request.json().catch(() => ({}));
        adminKey = body.adminKey;
      } catch (e) {
        // Body parsing failed or no body, continue without it
      }
    }
    
    if (!adminKey) {
      return NextResponse.json(
        { success: false, error: 'Admin key required' },
        { status: 401 }
      );
    }

    const url = new URL(`${BACKEND_URL}/api/admin/auth`);
    const postData = JSON.stringify({ adminKey });

    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = data.trim() ? JSON.parse(data) : {};
            resolve({ ok: res.statusCode === 200, status: res.statusCode, data: jsonData });
          } catch (parseError) {
            // If parsing fails, return the raw data or an error
            resolve({ 
              ok: false, 
              status: res.statusCode || 500, 
              data: { success: false, error: 'Invalid response from backend', raw: data } 
            });
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
        response.data || { success: false, error: 'Authentication failed' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error in admin auth:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
