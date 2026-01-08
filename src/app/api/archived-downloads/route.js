import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import http from 'http';
import crypto from 'crypto';

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

export async function GET(request) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      );
    }

    const authId = hashApiKey(apiKey);
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';
    
    const url = new URL(`${BACKEND_URL}/api/archived-downloads`);
    url.searchParams.set('authId', authId);
    url.searchParams.set('page', page);
    url.searchParams.set('limit', limit);
    
    const response = await new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, data: jsonData, status: res.statusCode });
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
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        { success: false, error: response.data?.error || 'Failed to fetch archived downloads' },
        { status: response.status || 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching archived downloads from backend:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const authId = hashApiKey(apiKey);
    
    // Add authId to the request body
    const requestBody = {
      ...body,
      authId
    };
    
    const response = await fetch(`${BACKEND_URL}/api/archived-downloads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error || `Backend responded with status: ${response.status}` },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error creating archived download in backend:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
