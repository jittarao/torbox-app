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

export async function GET(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Tags feature is disabled when backend is disabled');
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

    const authId = hashApiKey(apiKey);
    const url = new URL(`${BACKEND_URL}/api/tags`);
    url.searchParams.set('authId', authId);
    
    const response = await new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
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
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error fetching tags from backend:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Tags feature is disabled when backend is disabled');
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

    const body = await request.json();
    const authId = hashApiKey(apiKey);
    
    // Add authId to the request body
    const requestBody = {
      ...body,
      authId
    };
    
    const response = await fetch(`${BACKEND_URL}/api/tags`, {
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
      throw new Error(errorData.error || `Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error creating tag in backend:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
