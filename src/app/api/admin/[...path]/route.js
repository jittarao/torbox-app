import { NextResponse } from 'next/server';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

async function proxyRequest(request, pathSegments) {
  try {
    const method = request.method;
    const adminKey = request.headers.get('x-admin-key') || 
                    new URL(request.url).searchParams.get('adminKey');
    
    if (!adminKey) {
      return NextResponse.json(
        { success: false, error: 'Admin key required' },
        { status: 401 }
      );
    }

    // Reconstruct the path - handle both array and undefined cases
    const pathSegmentsArray = Array.isArray(pathSegments) ? pathSegments : (pathSegments ? [pathSegments] : []);
    const path = pathSegmentsArray.length > 0 ? pathSegmentsArray.join('/') : '';
    const url = new URL(`${BACKEND_URL}/api/admin${path ? `/${path}` : ''}`);
    
    // Forward query parameters
    const searchParams = new URL(request.url).searchParams;
    searchParams.forEach((value, key) => {
      if (key !== 'adminKey') {
        url.searchParams.append(key, value);
      }
    });

    // Get request body if present
    let body = null;
    let bodyString = null;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.json();
        bodyString = JSON.stringify(body);
      } catch (e) {
        // No body or invalid JSON, continue without body
      }
    }

    const headers = {
      'x-admin-key': adminKey
    };

    if (bodyString) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: method,
        headers: headers,
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : {};
            resolve({ 
              ok: res.statusCode >= 200 && res.statusCode < 300, 
              status: res.statusCode, 
              data: jsonData,
              headers: res.headers
            });
          } catch (parseError) {
            // If not JSON, return as text
            resolve({ 
              ok: res.statusCode >= 200 && res.statusCode < 300, 
              status: res.statusCode, 
              data: data,
              headers: res.headers
            });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (bodyString) {
        req.write(bodyString);
      }
      req.end();
    });

    const nextResponse = NextResponse.json(response.data, { status: response.status });
    
    // Forward relevant headers
    if (response.headers['content-type']) {
      nextResponse.headers.set('content-type', response.headers['content-type']);
    }

    return nextResponse;
  } catch (error) {
    console.error('Error proxying admin request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path || []);
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path || []);
}

export async function PUT(request, { params }) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path || []);
}

export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path || []);
}

export async function PATCH(request, { params }) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path || []);
}
