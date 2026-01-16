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

export async function PUT(request, { params }) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Automation rules feature is disabled when backend is disabled');
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

    const { id } = await params;
    const body = await request.json();
    const authId = hashApiKey(apiKey);
    const url = new URL(`${BACKEND_URL}/api/automation/rules/${id}`);
    url.searchParams.set('authId', authId);

    const response = await new Promise((resolve, reject) => {
      const putData = JSON.stringify(body);
      const req = http.request(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(putData)
        },
        timeout: 5000
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
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(putData);
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      const errorData = response.data || {};
      throw new Error(errorData.error || `Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Automation rules feature is disabled when backend is disabled');
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

    const { id } = await params;
    const authId = hashApiKey(apiKey);
    const url = new URL(`${BACKEND_URL}/api/automation/rules/${id}`);
    url.searchParams.set('authId', authId);

    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'DELETE',
        timeout: 5000
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
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      const errorData = response.data || {};
      throw new Error(errorData.error || `Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
