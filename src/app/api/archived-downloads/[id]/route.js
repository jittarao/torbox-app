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

export async function DELETE(request, { params }) {
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
    const { id: archiveId } = await params;
    
    const url = new URL(`${BACKEND_URL}/api/archived-downloads/${archiveId}`);
    url.searchParams.set('authId', authId);
    
    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'DELETE',
        timeout: 10000
      }, (res) => {
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
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      return NextResponse.json(
        { success: false, error: response.data?.error || 'Failed to delete archived download' },
        { status: response.status || 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting archived download from backend:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
