import { NextResponse } from 'next/server';
import { backendHttpRequest, isHttp2xx } from '@/utils/backendRequest';
import { sanitizeError } from '@/utils/sanitizeError';
const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

async function proxyRequest(request, pathSegments) {
  try {
    const method = request.method;
    const adminKey = request.headers.get('x-admin-key');

    if (!adminKey) {
      return NextResponse.json({ success: false, error: 'Admin key required' }, { status: 401 });
    }

    // Reconstruct the path - handle both array and undefined cases
    const pathSegmentsArray = Array.isArray(pathSegments)
      ? pathSegments
      : pathSegments
        ? [pathSegments]
        : [];
    const path = pathSegmentsArray.length > 0 ? pathSegmentsArray.join('/') : '';
    const url = new URL(`${BACKEND_URL}/api/admin${path ? `/${path}` : ''}`);

    // Forward query parameters
    const searchParams = new URL(request.url).searchParams;
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
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
      'x-admin-key': adminKey,
    };

    if (bodyString) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const response = await backendHttpRequest(url, {
      method,
      headers,
      body: bodyString,
      timeoutMs: 30000,
      isOk: isHttp2xx,
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
      { success: false, error: sanitizeError(error) || 'Request failed' },
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
